/* Integra una librería en Excalidraw y la deja fija (navegador + proyecto). */

import { useDocumentStore } from "../store/useDocumentStore";
import {
  getAllLibraryItems,
  getStoredLibraries,
  removeFixedLibrary,
  saveFixedLibrary,
  type FixedLibrary,
} from "./fixedLibraries";
import type { LibraryItem } from "./libraryUrl";
import { normalizeForExcalidraw } from "./excalidrawLibrary";

function dedupe(items: LibraryItem[]): LibraryItem[] {
  const seen = new Set<string>();
  return items.filter((i) => {
    if (!i?.id || seen.has(i.id)) return false;
    seen.add(i.id);
    return true;
  });
}

export async function integrateLibrary(opts: {
  name: string;
  items: LibraryItem[];
  sourceUrl?: string;
  api?: any;
  openMenu?: boolean;
}): Promise<FixedLibrary> {
  const { library, items } = await saveFixedLibrary({
    name: opts.name,
    items: opts.items,
    sourceUrl: opts.sourceUrl,
  });

  const store = useDocumentStore.getState();
  store.setProjectLibraryItems(dedupe([...(store.project.libraryItems || []), ...items]));

  if (opts.api) {
    try {
      await opts.api.updateLibrary({
        libraryItems: normalizeForExcalidraw(items),
        merge: true,
        defaultStatus: "published",
        openLibraryMenu: opts.openMenu ?? true,
      });
    } catch (err) {
      console.error("No se pudo actualizar la biblioteca de Excalidraw", err);
    }
  }
  return library;
}

/** Quita una librería integrada del navegador, del proyecto y del lienzo. */
export async function unintegrateLibrary(id: string, api?: any): Promise<void> {
  const stored = await getStoredLibraries();
  const lib = stored.find((l) => l.id === id);
  if (!lib) return;
  const ids = new Set(lib.items.map((i) => i.id));
  const store = useDocumentStore.getState();
  store.setProjectLibraryItems((store.project.libraryItems || []).filter((i) => !ids.has(i.id)));
  await removeFixedLibrary(id);

  if (api) {
    const remaining = (await getAllLibraryItems()).filter((i) => !ids.has(i.id));
    try {
      await api.updateLibrary({
        libraryItems: normalizeForExcalidraw(remaining),
        merge: false,
        defaultStatus: "published",
      });
    } catch (err) {
      console.error("No se pudo actualizar la biblioteca de Excalidraw", err);
    }
  }
}
