/* Conversión de escenas .excalidraw en pestañas del proyecto */

import type { TabScene } from "../types/document";

/** Un proyecto guardado por elograph */
export function isElographProject(data: any): boolean {
  return !!data && typeof data === "object" && data.format === "elograph" && Array.isArray(data.tabs);
}

/** Una escena completa de Excalidraw (no una librería .excalidrawlib) */
export function isExcalidrawScene(data: any): boolean {
  if (!data || typeof data !== "object") return false;
  if (data.type === "excalidrawlib") return false;
  if (data.type === "excalidraw") return Array.isArray(data.elements);
  return !data.type && Array.isArray(data.elements);
}

/** Convierte el JSON de una escena .excalidraw en la escena de una pestaña */
export function excalidrawToTabScene(data: any): TabScene {
  if (!isExcalidrawScene(data)) throw new Error("No es una escena .excalidraw válida");

  const src = data.appState || {};
  const appState: any = { viewBackgroundColor: src.viewBackgroundColor || "#ffffff" };
  // Se conserva la vista original; se descarta el estado volátil (selecciones, colaboradores…)
  for (const key of ["gridSize", "gridStep", "gridModeEnabled", "scrollX", "scrollY", "zoom"]) {
    if (src[key] !== undefined) appState[key] = src[key];
  }

  return {
    elements: data.elements
      .filter((el: any) => el && typeof el.type === "string")
      .map((el: any) => ({ ...el })),
    appState,
    files: data.files && typeof data.files === "object" ? { ...data.files } : {},
  };
}
