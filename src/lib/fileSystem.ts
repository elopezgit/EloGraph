import type { Project, TabScene } from "../types/document";
import { excalidrawToTabScene, isElographProject, isExcalidrawScene } from "./excalidrawImport";

export type OpenedFile =
  | { kind: "project"; project: Project; handle: any }
  | { kind: "scene"; name: string; scene: TabScene; handle: any };

const PICKER_TYPES = [
  {
    description: "Proyectos elograph y lienzos Excalidraw",
    accept: { "application/json": [".cdsgn", ".pdisg", ".excalidraw", ".json"] },
  },
];

const INVALID_MESSAGE =
  "El archivo seleccionado no es un proyecto elograph (.cdsgn) ni un lienzo de Excalidraw (.excalidraw) válido.";

function nameFrom(fileName: string): string {
  const base = fileName.replace(/\.(excalidraw|cdsgn|pdisg|json)$/i, "").trim();
  return base || "Lienzo importado";
}

function parseOpenedFile(text: string, fileName: string, handle: any): OpenedFile | null {
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (isElographProject(data)) {
    return { kind: "project", project: data as Project, handle };
  }
  if (isExcalidrawScene(data)) {
    return { kind: "scene", name: nameFrom(fileName), scene: excalidrawToTabScene(data), handle };
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
    input.accept = ".pdisg,.cdsgn,.excalidraw,.json,application/json";
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
