/* Conversión de archivos de Excalidraw (.excalidraw y .excalidrawlib) */

import type { TabScene } from "../types/document";
import { libraryItemsFromData, type LibraryItem } from "./libraryUrl";

/** Un proyecto guardado por elograph */
export function isElographProject(data: any): boolean {
  return !!data && typeof data === "object" && data.format === "elograph" && Array.isArray(data.tabs);
}

/** Un archivo de librería de Excalidraw (.excalidrawlib) */
export function isExcalidrawLibrary(data: any): boolean {
  if (!data || typeof data !== "object") return false;
  if (data.type === "excalidrawlib") return true;
  return !data.type && (Array.isArray(data.library) || Array.isArray(data.libraryItems) || Array.isArray(data.items));
}

/** Una escena completa de Excalidraw. Se acepta cualquier `type` distinto de librería. */
export function isExcalidrawScene(data: any): boolean {
  if (!data || typeof data !== "object") return false;
  if (isElographProject(data) || isExcalidrawLibrary(data)) return false;
  return Array.isArray(data.elements);
}

/** Convierte el JSON de una librería en elementos utilizables por Excalidraw */
export function libraryToItems(data: any): LibraryItem[] {
  const items = libraryItemsFromData(data);
  if (!items.length) throw new Error("La librería no contiene elementos dibujables");
  return items;
}

/** Convierte el JSON de una escena .excalidraw en la escena de una pestaña */
export function excalidrawToTabScene(data: any): TabScene {
  if (!isExcalidrawScene(data)) throw new Error("No es una escena .excalidraw válida");

  const src = data.appState || {};
  const keep = [
    "viewBackgroundColor", "gridSize", "gridStep", "gridModeEnabled",
    "scrollX", "scrollY", "zoom", "name",
    "currentItemStrokeColor", "currentItemBackgroundColor", "currentItemFillStyle",
    "currentItemStrokeWidth", "currentItemStrokeStyle", "currentItemRoughness",
    "currentItemOpacity", "currentItemFontFamily", "currentItemFontSize",
    "currentItemTextAlign", "currentItemStartArrowhead", "currentItemEndArrowhead",
  ];
  const appState: any = {};
  for (const key of keep) {
    if (src[key] !== undefined) appState[key] = src[key];
  }
  if (!appState.viewBackgroundColor) appState.viewBackgroundColor = "#ffffff";

  return {
    elements: data.elements
      .filter((el: any) => el && typeof el.type === "string" && !el.isDeleted)
      .map((el: any) => ({ ...el })),
    appState,
    files: data.files && typeof data.files === "object" ? { ...data.files } : {},
  };
}
