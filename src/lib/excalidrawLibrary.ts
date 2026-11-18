/* Normaliza las piezas con el propio validador de Excalidraw antes de inyectarlas. */

import { restoreLibraryItems } from "@excalidraw/excalidraw";
import type { LibraryItem } from "./libraryUrl";

export function normalizeForExcalidraw(items: LibraryItem[]): any[] {
  try {
    return restoreLibraryItems(items as any, "published") as any[];
  } catch (err) {
    console.error("No se pudo normalizar la librería", err);
    return items as any[];
  }
}
