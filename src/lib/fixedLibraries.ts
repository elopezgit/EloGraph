/* Librerías fijas: las incluidas en la app + las integradas por el usuario.
   Las integradas se guardan en IndexedDB para que sobrevivan a recargas. */

import { openDB, type IDBPDatabase } from "idb";
import { fetchLibraryItems, type LibraryItem } from "./libraryUrl";

export type FixedLibrary = {
  id: string;
  name: string;
  items: LibraryItem[];
  builtin: boolean;
  sourceUrl?: string;
  created: number;
};

export type BuiltinLibrary = {
  id: string;
  name: string;
  file: string;
  sourceUrl: string;
};

/** Librerías que viajan con la aplicación (descargadas en public/libraries). */
export const BUILTIN_LIBRARIES: BuiltinLibrary[] = [
  {
    id: "builtin:software-architecture",
    name: "Software Architecture",
    file: "/libraries/software-architecture.excalidrawlib",
    sourceUrl: "https://libraries.excalidraw.com/libraries/youritjang/software-architecture.excalidrawlib",
  },
  {
    id: "builtin:uml-er",
    name: "Shapes for UML & ER Diagrams",
    file: "/libraries/uml-er-library.excalidrawlib",
    sourceUrl: "https://libraries.excalidraw.com/libraries/BjoernKW/UML-ER-library.excalidrawlib",
  },
  {
    id: "builtin:forms",
    name: "Forms",
    file: "/libraries/forms.excalidrawlib",
    sourceUrl: "https://libraries.excalidraw.com/libraries/g-script/forms.excalidrawlib",
  },
];

const DB_NAME = "elograph-libraries";
const STORE = "libraries";

let dbPromise: Promise<IDBPDatabase> | null = null;

function db(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(d) {
        if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: "id" });
      },
    });
  }
  return dbPromise;
}

let itemsCache: Promise<LibraryItem[]> | null = null;

const LIBRARIES_CHANGED = "elograph:libraries-changed";

function notifyLibrariesChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(LIBRARIES_CHANGED));
}

/** Se suscribe a cambios en la colección de librerías fijas. */
export function onLibrariesChanged(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(LIBRARIES_CHANGED, cb);
  return () => window.removeEventListener(LIBRARIES_CHANGED, cb);
}

function invalidateCache() {
  itemsCache = null;
  notifyLibrariesChanged();
}

function dedupe(items: LibraryItem[]): LibraryItem[] {
  const seen = new Set<string>();
  const out: LibraryItem[] = [];
  for (const item of items) {
    if (!item || !item.id) continue;
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

export async function getStoredLibraries(): Promise<FixedLibrary[]> {
  try {
    const d = await db();
    const list = await d.getAll(STORE);
    return (list as FixedLibrary[]).filter((l) => l && Array.isArray(l.items)).sort((a, b) => a.created - b.created);
  } catch {
    return [];
  }
}

async function builtinLibraries(): Promise<FixedLibrary[]> {
  const result: FixedLibrary[] = [];
  for (const def of BUILTIN_LIBRARIES) {
    try {
      const items = await fetchLibraryItems(def.file);
      result.push({
        id: def.id,
        name: def.name,
        items,
        builtin: true,
        sourceUrl: def.sourceUrl,
        created: 0,
      });
    } catch (err) {
      console.error(`No se pudo cargar la librería fija «${def.name}»`, err);
    }
  }
  return result;
}

/** Todas las librerías disponibles: incluidas + integradas por el usuario. */
export async function listFixedLibraries(): Promise<FixedLibrary[]> {
  const [builtins, stored] = await Promise.all([builtinLibraries(), getStoredLibraries()]);
  return [...builtins, ...stored];
}

/** Elementos de todas las librerías fijas, sin duplicados por id. */
export function getAllLibraryItems(): Promise<LibraryItem[]> {
  if (!itemsCache) {
    itemsCache = listFixedLibraries().then((libs) => dedupe(libs.flatMap((l) => l.items)));
  }
  return itemsCache;
}

/** Guarda (o actualiza) una librería integrada y devuelve sus elementos. */
export async function saveFixedLibrary(input: {
  id?: string;
  name: string;
  items: LibraryItem[];
  sourceUrl?: string;
}): Promise<{ library: FixedLibrary; items: LibraryItem[] }> {
  const items = dedupe(input.items.map((i) => ({ ...i })));
  if (!items.length) throw new Error("La librería no contiene elementos");

  const existing = await getStoredLibraries();
  // Una URL ya incluida o ya guardada no se duplica: se actualiza en su sitio.
  const match = existing.find(
    (l) => (input.id && l.id === input.id) || (input.sourceUrl && l.sourceUrl === input.sourceUrl)
  );
  const isBuiltin = BUILTIN_LIBRARIES.some((b) => b.sourceUrl === input.sourceUrl);
  if (isBuiltin) {
    invalidateCache();
    return { library: { id: input.sourceUrl!, name: input.name, items, builtin: true, created: 0 }, items };
  }

  const library: FixedLibrary = {
    id: match?.id ?? input.id ?? `fixed:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    name: input.name,
    items,
    builtin: false,
    sourceUrl: input.sourceUrl,
    created: match?.created ?? Date.now(),
  };
  const d = await db();
  await d.put(STORE, library);
  invalidateCache();
  return { library, items };
}

export async function removeFixedLibrary(id: string): Promise<void> {
  const d = await db();
  await d.delete(STORE, id);
  invalidateCache();
}

/** Fusiona en la colección fija los elementos guardados dentro de un proyecto .cdsgn. */
export async function mergeProjectLibraries(items: LibraryItem[]): Promise<void> {
  if (!items?.length) return;
  const current = await getAllLibraryItems();
  const known = new Set(current.map((i) => i.id));
  const missing = items.filter((i) => i && i.id && !known.has(i.id));
  if (!missing.length) return;
  await saveFixedLibrary({ name: "Librerías del proyecto", items: missing });
}
