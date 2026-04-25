/**
 * Runtime registry for tracking which optional external assets actually
 * loaded successfully. Other systems query this registry to decide whether
 * to use loaded sprite/audio resources or fall back to procedural ones.
 */

const presence = new Map<string, boolean>();

export function markAssetPresent(key: string): void {
  presence.set(key, true);
}

export function markAssetMissing(key: string): void {
  presence.set(key, false);
}

export function isAssetPresent(key: string): boolean {
  return presence.get(key) === true;
}

/** For tests. */
export function resetAssetRegistry(): void {
  presence.clear();
}

export function getAllAssetStatus(): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const [k, v] of presence.entries()) out[k] = v;
  return out;
}
