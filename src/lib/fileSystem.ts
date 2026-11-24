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

export interface SaveResult {
  /** false solo cuando el usuario cancela el selector de ubicación. */
  saved: boolean;
  /** Handle del archivo elegido; null en el modo descarga o si se canceló. */
  handle: any;
}

const SAVE_TYPES = [
  { description: "Proyecto elograph (.cdsgn)", accept: { "application/json": [".cdsgn"] } },
];

function projectFileName(project: Project): string {
  const base = (project.meta.title || "proyecto").replace(/[\\/:*?"<>|]/g, "_").trim() || "proyecto";
  return `${base}.cdsgn`;
}

function projectBlob(project: Project): Blob {
  return new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
}

async function writeToFile(handle: any, blob: Blob): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
}

function downloadProject(blob: Blob, project: Project): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = projectFileName(project);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Guarda sobre el archivo ya elegido. Si no hay uno, pide la ubicación. */
export async function saveProjectFile(project: Project, handle: any): Promise<SaveResult> {
  const blob = projectBlob(project);

  if (handle && typeof handle.createWritable === "function") {
    try {
      await writeToFile(handle, blob);
      return { saved: true, handle };
    } catch {
      // Si falla, se pide una ubicación nueva.
    }
  }

  return saveProjectFileAs(project, blob);
}

/** Pide ubicación y nombre, y guarda el proyecto en el formato propio .cdsgn. */
export async function saveProjectFileAs(project: Project, blob?: Blob): Promise<SaveResult> {
  const data = blob ?? projectBlob(project);

  if (typeof (window as any).showSaveFilePicker === "function") {
    try {
      const newHandle = await (window as any).showSaveFilePicker({
        id: "elograph-project",
        suggestedName: projectFileName(project),
        types: SAVE_TYPES,
      });
      try {
        await writeToFile(newHandle, data);
        return { saved: true, handle: newHandle };
      } catch {
        // Si no se puede escribir, se ofrece la descarga como último recurso.
      }
    } catch (e) {
      if ((e as any)?.name === "AbortError") return { saved: false, handle: null };
      // Otros errores: se continúa con la descarga.
    }
  }

  downloadProject(data, project);
  return { saved: true, handle: null };
}
