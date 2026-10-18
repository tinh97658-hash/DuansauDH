import { createHash } from "node:crypto";

export function serializeSnapshot(value: unknown): string {
  const sort = (item: any): any => Array.isArray(item) ? item.map(sort) : item && typeof item === "object"
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, sort(item[key])])) : item;
  return JSON.stringify(sort(JSON.parse(JSON.stringify(value))));
}

export const snapshotDigest = (snapshot: unknown) => createHash("sha256").update(serializeSnapshot(snapshot)).digest("hex");
