/**
 * Asset downloader for Kenney CC0 packs.
 *
 * Fetches each pack page from kenney.nl, extracts the dynamic ZIP URL via
 * regex, downloads the archive into a temp folder, expands it, and copies
 * the specific files declared in MAPPINGS into apps/client/public/assets/.
 *
 * Usage:
 *   node apps/client/scripts/download-assets.mjs
 *
 * Requirements: Node 20+ (uses fetch + AdmZip via dynamic import). To avoid
 * adding any npm dependency, we extract the bundled `node:zlib` deflate +
 * a tiny zip parser written below. The zip parser only handles the central
 * directory + STORE/DEFLATE entries which is what Kenney ZIPs use.
 */

import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, "..");
const ASSETS_DIR = resolve(PROJECT_ROOT, "public", "assets");
const TMP_DIR = resolve(PROJECT_ROOT, ".asset-cache");

/**
 * Per-pack mapping: which Kenney asset page, and which extracted files
 * map to which destination path under public/assets/.
 *
 * `pickFromInternal` is an array of [internal_glob, dest_relative_to_assets].
 * Globs use * as a single-segment wildcard. Order matters; first match wins
 * for each destination, multiple destinations may match different sources.
 */
const PACKS = [
  {
    slug: "pixel-platformer",
    pageUrl: "https://kenney.nl/assets/pixel-platformer",
    files: [
      { internal: "Tilemap/tilemap-characters_packed.png", dest: "sprites/players.png" },
      { internal: "Tilemap/tilemap_packed.png", dest: "sprites/tiles_terrain.png" },
    ],
  },
  // Background pack omitted on purpose: kenney.nl has no pixel-style
  // parallax pack that lines up with our 1080×600 canvas. The procedural
  // BackgroundRenderer already produces a polished multi-layer parallax,
  // so we keep that as the only background source.
  {
    slug: "music-jingles",
    pageUrl: "https://kenney.nl/assets/music-jingles",
    files: [
      // music-jingles has 8-bit NES jingles + thematic variants. We use
      // three NES loops as background music tracks and two longer jingles
      // for level/game completion fanfares.
      { pickByName: /8-Bit jingles\/jingles_NES00\.ogg$/i, dest: "audio/music/menu_loop.ogg" },
      { pickByName: /8-Bit jingles\/jingles_NES03\.ogg$/i, dest: "audio/music/level_loop.ogg" },
      { pickByName: /8-Bit jingles\/jingles_NES10\.ogg$/i, dest: "audio/music/victory_loop.ogg" },
      { pickByName: /Pizzicato jingles\/jingles_PIZZI00\.ogg$/i, dest: "audio/sfx/level_complete.ogg" },
      { pickByName: /Steel jingles\/jingles_STEEL00\.ogg$/i, dest: "audio/sfx/game_complete.ogg" },
    ],
  },
  {
    slug: "impact-sounds",
    pageUrl: "https://kenney.nl/assets/impact-sounds",
    files: [
      { pickByName: /footstep_concrete_000/i, dest: "audio/sfx/jump.ogg" },
      { pickByName: /impactPlate_heavy_001/i, dest: "audio/sfx/land.ogg" },
      { pickByName: /impactPlank_medium_004/i, dest: "audio/sfx/death.ogg" },
    ],
  },
  {
    slug: "interface-sounds",
    pageUrl: "https://kenney.nl/assets/interface-sounds",
    files: [
      { pickByName: /click_001/i, dest: "audio/sfx/button_press.ogg" },
      { pickByName: /click_002/i, dest: "audio/sfx/button_release.ogg" },
      { pickByName: /select_002/i, dest: "audio/sfx/interact.ogg" },
    ],
  },
  {
    slug: "sci-fi-sounds",
    pageUrl: "https://kenney.nl/assets/sci-fi-sounds",
    files: [
      { pickByName: /doorOpen_001/i, dest: "audio/sfx/door_open.ogg" },
      { pickByName: /doorClose_001/i, dest: "audio/sfx/door_close.ogg" },
      { pickByName: /forceField_001/i, dest: "audio/sfx/respawn.ogg" },
      { pickByName: /laserSmall_000\.ogg$/i, dest: "audio/sfx/laser_hum.ogg" },
    ],
  },
  // ui-audio pack omitted: it only has clicks/switches/rollovers, not
  // celebratory sounds. level_complete / game_complete are sourced from
  // music-jingles instead.
];

// ── Networking ───────────────────────────────────────────────────

async function findZipUrl(pageUrl) {
  const res = await fetch(pageUrl, { redirect: "follow" });
  if (!res.ok) throw new Error(`Failed to fetch page ${pageUrl}: HTTP ${res.status}`);
  const html = await res.text();
  const match = html.match(/href=['"](https:\/\/kenney\.nl\/media\/pages\/assets\/[^'"]+\.zip)['"]/);
  if (!match) throw new Error(`Could not find ZIP link on ${pageUrl}`);
  return match[1];
}

async function downloadFile(url, destPath) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`Failed to download ${url}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await mkdir(dirname(destPath), { recursive: true });
  await writeFile(destPath, buf);
  return buf.length;
}

// ── Minimal ZIP reader (central directory + STORE/DEFLATE) ──────

function readU16LE(buf, off) {
  return buf.readUInt16LE(off);
}
function readU32LE(buf, off) {
  return buf.readUInt32LE(off);
}

function locateEndOfCentralDir(buf) {
  // EOCD signature: 0x06054b50, search from end.
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 0x10000); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) return i;
  }
  throw new Error("Not a valid ZIP (EOCD not found)");
}

function listEntries(buf) {
  const eocd = locateEndOfCentralDir(buf);
  const cdEntries = readU16LE(buf, eocd + 10);
  const cdSize = readU32LE(buf, eocd + 12);
  const cdOffset = readU32LE(buf, eocd + 16);
  const entries = [];
  let p = cdOffset;
  for (let i = 0; i < cdEntries; i++) {
    if (readU32LE(buf, p) !== 0x02014b50) throw new Error("Bad central directory header");
    const compMethod = readU16LE(buf, p + 10);
    const compSize = readU32LE(buf, p + 20);
    const uncompSize = readU32LE(buf, p + 24);
    const fnLen = readU16LE(buf, p + 28);
    const extraLen = readU16LE(buf, p + 30);
    const commentLen = readU16LE(buf, p + 32);
    const localHeaderOffset = readU32LE(buf, p + 42);
    const fileName = buf.slice(p + 46, p + 46 + fnLen).toString("utf-8");
    entries.push({ fileName, compMethod, compSize, uncompSize, localHeaderOffset });
    p += 46 + fnLen + extraLen + commentLen;
    if (p > cdOffset + cdSize) throw new Error("Central directory overflow");
  }
  return entries;
}

function extractEntry(buf, entry) {
  const p = entry.localHeaderOffset;
  if (readU32LE(buf, p) !== 0x04034b50) throw new Error("Bad local header");
  const fnLen = readU16LE(buf, p + 26);
  const extraLen = readU16LE(buf, p + 28);
  const dataStart = p + 30 + fnLen + extraLen;
  const data = buf.slice(dataStart, dataStart + entry.compSize);
  if (entry.compMethod === 0) return data;
  if (entry.compMethod === 8) return inflateRawSync(data);
  throw new Error(`Unsupported compression method ${entry.compMethod} for ${entry.fileName}`);
}

// ── Glob helpers ─────────────────────────────────────────────────

function normalizeName(n) {
  return n.replace(/\\/g, "/");
}

function matchExact(entries, internalPath) {
  const wanted = internalPath.replace(/\\/g, "/").toLowerCase();
  return entries.find((e) => normalizeName(e.fileName).toLowerCase() === wanted);
}

function matchByName(entries, regex, ext) {
  return entries.find((e) => {
    const name = normalizeName(e.fileName);
    if (ext && !name.toLowerCase().endsWith(ext)) return false;
    return regex.test(name);
  });
}

function pickByIndexFn(entries, index, ext) {
  const filtered = entries
    .filter((e) => !e.fileName.endsWith("/"))
    .filter((e) => (ext ? normalizeName(e.fileName).toLowerCase().endsWith(ext) : true))
    .sort((a, b) => a.fileName.localeCompare(b.fileName));
  return filtered[index];
}

// ── Pipeline ─────────────────────────────────────────────────────

async function fileExists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function processPack(pack) {
  console.log(`\n📦 ${pack.slug}`);
  const zipPath = join(TMP_DIR, `${pack.slug}.zip`);

  if (!(await fileExists(zipPath))) {
    console.log(`   resolving download URL…`);
    const zipUrl = await findZipUrl(pack.pageUrl);
    console.log(`   downloading ${zipUrl}`);
    const size = await downloadFile(zipUrl, zipPath);
    console.log(`   saved ${(size / 1024).toFixed(1)} KB`);
  } else {
    console.log(`   using cached ${zipPath}`);
  }

  const buf = await readFile(zipPath);
  const entries = listEntries(buf);

  for (const fileSpec of pack.files) {
    let entry = null;
    if (fileSpec.internal) {
      entry = matchExact(entries, fileSpec.internal);
    } else if (fileSpec.pickByName) {
      entry = matchByName(entries, fileSpec.pickByName, fileSpec.ext);
    } else if (typeof fileSpec.pickByIndex === "number") {
      entry = pickByIndexFn(entries, fileSpec.pickByIndex, fileSpec.ext);
    }

    if (!entry) {
      console.warn(`   ⚠ could not find entry for ${fileSpec.dest} (criteria: ${JSON.stringify(fileSpec)})`);
      continue;
    }

    const data = extractEntry(buf, entry);
    const destPath = join(ASSETS_DIR, fileSpec.dest);
    await mkdir(dirname(destPath), { recursive: true });
    await writeFile(destPath, data);
    console.log(`   ✓ ${entry.fileName} → ${fileSpec.dest} (${data.length} B)`);
  }
}

async function main() {
  await mkdir(TMP_DIR, { recursive: true });
  await mkdir(ASSETS_DIR, { recursive: true });

  let failed = 0;
  for (const pack of PACKS) {
    try {
      await processPack(pack);
    } catch (error) {
      failed++;
      console.error(`   ✗ ${pack.slug} failed:`, error.message);
    }
  }

  console.log("");
  console.log(failed === 0 ? "All packs processed." : `${failed} pack(s) failed; remaining processed.`);
  console.log(`Cache directory: ${TMP_DIR}`);
  console.log(`Output directory: ${ASSETS_DIR}`);
  console.log("");
  console.log("Tip: delete .asset-cache/ to re-download.");

  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
