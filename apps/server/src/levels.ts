import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseLevelSchema, type LevelSchema } from "@coop-game/shared";

const levelFilePattern = /^level-[0-9]{3}\.json$/;

export async function loadLevelSet(): Promise<LevelSchema[]> {
  const levelsDirectory = await findLevelsDirectory();
  const levelFiles = (await readdir(levelsDirectory)).filter((fileName) => levelFilePattern.test(fileName)).sort();

  if (levelFiles.length === 0) {
    throw new Error(`No level JSON files found in ${levelsDirectory}`);
  }

  const levels: LevelSchema[] = [];

  for (const fileName of levelFiles) {
    const filePath = path.join(levelsDirectory, fileName);
    const rawLevel = JSON.parse(await readFile(filePath, "utf8")) as unknown;
    const level = parseLevelSchema(rawLevel, filePath);
    const expectedId = path.basename(fileName, ".json");

    if (level.id !== expectedId) {
      throw new Error(`${filePath} id must match file name ${expectedId}`);
    }

    levels.push(level);
  }

  return levels;
}

async function findLevelsDirectory(): Promise<string> {
  const startDirectories = [process.cwd(), path.dirname(fileURLToPath(import.meta.url))];

  for (const startDirectory of startDirectories) {
    let currentDirectory = startDirectory;

    for (let depth = 0; depth < 8; depth += 1) {
      const candidate = path.join(currentDirectory, "levels");

      if (await isDirectory(candidate)) {
        return candidate;
      }

      const parentDirectory = path.dirname(currentDirectory);

      if (parentDirectory === currentDirectory) {
        break;
      }

      currentDirectory = parentDirectory;
    }
  }

  throw new Error("Could not locate levels directory");
}

async function isDirectory(candidate: string): Promise<boolean> {
  try {
    return (await stat(candidate)).isDirectory();
  } catch {
    return false;
  }
}
