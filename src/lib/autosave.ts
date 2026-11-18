import { openDB } from "idb";
import type { Project } from "../types/document";

const DB = "elograph";
const LEGACY_DB = "procdisg";
const STORE = "autosave";
const KEY = "current";

/** Base de datos compartida por el autoguardado y los espacios de trabajo. */
export function openAppDb() {
  return openDB(DB, 2, {
    upgrade(d) {
      if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE);
      if (!d.objectStoreNames.contains("workspaces")) {
        d.createObjectStore("workspaces", { keyPath: "id" });
      }
    },
  });
}

function openNamed(name: string) {
  return openDB(name, 2, {
    upgrade(d) {
      if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE);
      if (!d.objectStoreNames.contains("workspaces")) {
        d.createObjectStore("workspaces", { keyPath: "id" });
      }
    },
  });
}

function db() {
  return openAppDb();
}

export async function saveAutosave(project: Project): Promise<void> {
  const d = await db();
  await d.put(STORE, project, KEY);
}

export async function loadAutosave(): Promise<Project | null> {
  try {
    const d = await db();
    const current = await d.get(STORE, KEY);
    if (current) return current;
    // Compatibilidad: recupera el autoguardado de versiones anteriores
    const legacy = await openNamed(LEGACY_DB);
    const old = await legacy.get(STORE, KEY);
    if (old) {
      await d.put(STORE, old, KEY);
      return old;
    }
    return null;
  } catch {
    return null;
  }
}

export async function clearAutosave(): Promise<void> {
  const d = await db();
  await d.delete(STORE, KEY);
}
