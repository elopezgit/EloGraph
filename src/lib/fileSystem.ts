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

const PICKER_TYPES = [
  {
    description: "Proyectos elograph y archivos de Excalidraw",
    accept: {
      "application/json": [".cdsgn", ".pdisg", ".excalidraw", ".excalidrawlib", ".json"],
    },
  },
];

export const INVALID_MESSAGE =
  "El archivo seleccionado no es un proyecto elograph (.cdsgn), un lienzo (.excalidraw) ni una librería (.excalidrawlib) válidos.";

function nameFrom(fileName: string): string {
  const base = fileName.replace(/\.(excalidrawlib|excalidraw|cdsgn|pdisg|json)$/i, "").trim();
  return base || "Importado";
}

export function parseOpenedFile(text: string, fileName: string, handle: any): OpenedFile | null {
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

export async function openProjectFile(): Promise<OpenedFile | null> {
  try {
    if ("showOpenFilePicker" in window) {
      const [handle] = await (window as any).showOpenFilePicker({ types: PICKER_TYPES, multiple: false });
      const file = await handle.getFile();
      const text = await file.text();
      const result = parseOpenedFile(text, file.name, handle);
      if (!result) alert(INVALID_MESSAGE);
      return result;
    }
  } catch (e) {
    if ((e as any)?.name === "AbortError") return null;
  }
  // fallback
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdisg,.cdsgn,.excalidraw,.excalidrawlib,.json,application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      const text = await file.text();
      const result = parseOpenedFile(text, file.name, null);
      if (!result) alert(INVALID_MESSAGE);
      resolve(result);
    };
    input.click();
  });
}

export async function saveProjectFile(project: Project, handle: any): Promise<any> {
  const data = JSON.stringify(project, null, 2);
  const blob = new Blob([data], { type: "application/json" });

  if (handle && "createWritable" in handle) {
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return handle;
  }

  if ("showSaveFilePicker" in window) {
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
    }
  }

  // fallback download
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${project.meta.title || "proyecto"}.cdsgn`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return handle;
}
