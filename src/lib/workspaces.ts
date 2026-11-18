/* Espacios de trabajo: conjuntos de pestañas guardados en el navegador */

import type { Project, TabScene } from "../types/document";
import { loadAutosave, openAppDb, saveAutosave } from "./autosave";
import { readOpenedFile, saveProjectFile, type OpenedFile } from "./fileSystem";

export type Workspace = {
  id: string;
  name: string;
  project: Project;
  modified: string;
  fileHandle?: any;
};

const STORE = "workspaces";
const ACTIVE_KEY = "elograph.activeWorkspace";
const AUTOSAVE_KEY = "elograph.autosave.enabled";

const uid = () => Math.random().toString(36).slice(2, 10);
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

export function getActiveWorkspaceId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

export function setActiveWorkspaceId(id: string): void {
  try {
    localStorage.setItem(ACTIVE_KEY, id);
  } catch {
    // almacenamiento no disponible
  }
}

export function getAutoSave(): boolean {
  try {
    return localStorage.getItem(AUTOSAVE_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setAutoSave(enabled: boolean): void {
  try {
    localStorage.setItem(AUTOSAVE_KEY, enabled ? "1" : "0");
  } catch {
    // almacenamiento no disponible
  }
}

export async function listWorkspaces(): Promise<Workspace[]> {
  const d = await openAppDb();
  const all = (await d.getAll(STORE)) as Workspace[];
  return all.sort((a, b) => b.modified.localeCompare(a.modified));
}

export async function getWorkspace(id: string): Promise<Workspace | undefined> {
  const d = await openAppDb();
  return d.get(STORE, id);
}

export async function putWorkspace(ws: Workspace): Promise<Workspace> {
  const saved: Workspace = { ...ws, modified: new Date().toISOString() };
  const d = await openAppDb();
  try {
    await d.put(STORE, saved);
  } catch {
    // FileSystemHandle no es clonable en algún navegador: se guarda sin él
    await d.put(STORE, { ...saved, fileHandle: undefined });
    return { ...saved, fileHandle: undefined };
  }
  return saved;
}

export async function removeWorkspace(id: string): Promise<void> {
  const d = await openAppDb();
  await d.delete(STORE, id);
}

export function blankProject(name: string): Project {
  const now = new Date().toISOString();
  const tabId = uid();
  return {
    format: "elograph",
    version: "1.0",
    meta: { title: name, created: now, modified: now },
    tabs: [{ id: tabId, name: "Página 1", scene: { elements: [], appState: { viewBackgroundColor: "#ffffff" }, files: {} } }],
    activeTabId: tabId,
    catalogs: [],
    libraryItems: [],
  };
}

export function projectFromScene(name: string, scene: TabScene): Project {
  const p = blankProject(name);
  p.tabs[0].scene = clone(scene);
  return p;
}

export async function createWorkspace(name: string, project?: Project, fileHandle?: any): Promise<Workspace> {
  return putWorkspace({
    id: uid(),
    name: name.trim() || "Sin nombre",
    project: project ? clone(project) : blankProject(name.trim() || "Mi espacio"),
    fileHandle,
    modified: new Date().toISOString(),
  });
}

/** Crea el primer espacio migrando el autoguardado anterior, si lo hay. */
export async function ensureWorkspaces(): Promise<Workspace[]> {
  let list = await listWorkspaces();
  if (list.length) return list;
  const saved = await loadAutosave();
  const ws = await createWorkspace("Mi espacio", saved ?? undefined);
  list = [ws];
  return list;
}

export async function importWorkspaceFile(file: File): Promise<Workspace> {
  const res: OpenedFile | null = await readOpenedFile(file);
  if (!res) throw new Error("Archivo no válido. Usa un proyecto .cdsgn, un lienzo .excalidraw o una librería.");
  const fallback = file.name.replace(/\.[^.]+$/, "");
  if (res.kind === "project") {
    return createWorkspace(res.project.meta.title || fallback, res.project);
  }
  if (res.kind === "scene") {
    return createWorkspace(res.name || fallback, projectFromScene(res.name || fallback, res.scene));
  }
  throw new Error("Ese archivo es una librería, no un espacio de trabajo.");
}

export async function exportWorkspace(ws: Workspace): Promise<void> {
  await saveProjectFile(ws.project, null);
}

/** Guarda el proyecto actual en el espacio indicado y en el autoguardado. */
export async function persistWorkspace(ws: Workspace, project: Project, fileHandle: any): Promise<Workspace> {
  const saved = await putWorkspace({ ...ws, project: clone(project), fileHandle });
  await saveAutosave(project);
  return saved;
}
