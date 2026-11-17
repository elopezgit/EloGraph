import { openDB } from "idb";
import type { Project } from "../types/document";

const DB = "procdisg";
const STORE = "autosave";
const KEY = "current";

async function db() {
  return openDB(DB, 1, {
    upgrade(d) {
      if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE);
    },
  });
}

export async function saveAutosave(project: Project): Promise<void> {
  const d = await db();
  await d.put(STORE, project, KEY);
}

export async function loadAutosave(): Promise<Project | null> {
  try {
    const d = await db();
    return (await d.get(STORE, KEY)) ?? null;
  } catch {
    return null;
  }
}

export async function clearAutosave(): Promise<void> {
  const d = await db();
  await d.delete(STORE, KEY);
}