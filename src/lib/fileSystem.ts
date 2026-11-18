import type { Project, TabScene } from "../types/document";
import {
  excalidrawToTabScene,
  isElographProject,
  isExcalidrawLibrary,
  isExcalidrawScene,
  libraryToItems,
} from "./excalidrawImport";
import type { LibraryItem } from "./libraryUrl";

export type OpenedFile =
  | { kind: "project"; project: Project; handle: any }
  | { kind: "scene"; name: string; scene: TabScene; handle: any }
  | { kind: "library"; name: string; items: LibraryItem[]; handle: any };

export const INVALID_MESSAGE =
  "El archivo seleccionado no es un proyecto elograph (.cdsgn), un lienzo (.excalidraw) ni una librería (.excalidrawlib) válidos.";

export const OPEN_ACCEPT =
  ".pdisg,.cdsgn,.excalidraw,.excalidrawlib,.json,application/json";

function nameFrom(fileName: string): string {
  const base = fileName.replace(/\.(excalidrawlib|excalidraw|cdsgn|pdisg|json)$/i, "").trim();
  return base || "Importado";
}

export function parseOpenedFile(text: string, fileName: string, handle: any = null): OpenedFile | null {
  let data: any;
  try {
    // Algunos editores guardan el JSON con BOM; JSON.parse no lo tolera.
    data = JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch {
    return null;
  }
  if (isElographProject(data)) {
    return { kind: "project", project: data as Project, handle };
  }
  if (isExcalidrawLibrary(data)) {
    try {
      return { kind: "library", name: nameFrom(fileName), items: libraryToItems(data), handle };
    } catch {
      return null;
    }
  }
  if (isExcalidrawScene(data)) {
    try {
      return { kind: "scene", name: nameFrom(fileName), scene: excalidrawToTabScene(data), handle };
    } catch {
      return null;
    }
  }
  return null;
}

/** Lee un archivo del dispositivo. Funciona en cualquier navegador. */
export async function readOpenedFile(file: File): Promise<OpenedFile | null> {
  const text = await file.text();
  return parseOpenedFile(text, file.name, null);
}

/** Guarda el proyecto. Usa el diálogo nativo si está disponible; si no, descarga el archivo. */
export async function saveProjectFile(project: Project, handle: any): Promise<any> {
  const data = JSON.stringify(project, null, 2);
  const blob = new Blob([data], { type: "application/json" });

  // Guardar sobre el archivo ya elegido (solo escritorio con API disponible).
  if (handle && typeof handle.createWritable === "function") {
    try {
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return handle;
    } catch {
      // Si falla, se continúa con la descarga.
    }
  }

  if (typeof (window as any).showSaveFilePicker === "function") {
    try {
      const newHandle = await (window as any).showSaveFilePicker({
        suggestedName: `${project.meta.title || "proyecto"}.cdsgn`,
        types: [{ description: "elograph", accept: { "application/json": [".cdsgn", ".pdisg"] } }],
      });
      const writable = await newHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      return newHandle;
    } catch (e) {
      if ((e as any)?.name === "AbortError") return handle;
      // Otros errores: se continúa con la descarga.
    }
  }

  // Descarga: camino universal (móvil, Safari, Firefox, iframe…).
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${project.meta.title || "proyecto"}.cdsgn`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return handle;
}
