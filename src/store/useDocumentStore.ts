import { create } from "zustand";
import type { Project, TabData, Catalog } from "../types/document";
import type { LibraryItem } from "../lib/libraryUrl";
import { mergeProjectLibraries } from "../lib/fixedLibraries";

const uid = () => Math.random().toString(36).slice(2, 10);

const emptyScene = (): TabData["scene"] => ({
  elements: [],
  appState: { viewBackgroundColor: "#ffffff" },
  files: {},
});

const newProject = (title = "Sin título"): Project => ({
  format: "elograph",
  version: "1.0",
  meta: { title, created: new Date().toISOString(), modified: new Date().toISOString() },
  tabs: [{ id: uid(), name: "Página 1", scene: emptyScene() }],
  activeTabId: "",
  catalogs: [],
  libraryItems: [],
});

interface Store {
  project: Project;
  fileHandle: any;
  dirty: boolean;
  excalidrawApis: Record<string, any>;

  initProject: (p?: Project) => void;
  setFileHandle: (h: any) => void;
  setDirty: (d: boolean) => void;

  addTab: (options?: { name?: string; scene?: TabData["scene"] }) => void;
  removeTab: (id: string) => void;
  renameTab: (id: string, name: string) => void;
  setActiveTab: (id: string) => void;
  updateTabScene: (id: string, scene: TabData["scene"]) => void;
  setExcalidrawApi: (tabId: string, api: any) => void;
  flushActiveScene: (tabId?: string) => void;

  addCatalog: () => void;
  removeCatalog: (id: string) => void;
  updateCatalog: (id: string, patch: Partial<Catalog>) => void;
  addCatalogItem: (catalogId: string) => void;
  removeCatalogItem: (catalogId: string, index: number) => void;
  setProjectLibraryItems: (items: LibraryItem[]) => void;

  getActiveTab: () => TabData | undefined;
}

export const useDocumentStore = create<Store>((set, get) => {
  const initial = newProject();
  initial.activeTabId = initial.tabs[0].id;
  return {
    project: initial,
    fileHandle: null,
    dirty: false,
    excalidrawApis: {},

    initProject: (p) => {
      const proj = p ?? newProject();
      if (!proj.tabs?.length) proj.tabs = newProject().tabs;
      if (!proj.tabs.some((t) => t.id === proj.activeTabId)) {
        proj.activeTabId = proj.tabs[0]?.id ?? "";
      }
      if (!Array.isArray(proj.libraryItems)) proj.libraryItems = [];
      set({ project: proj, dirty: false });
      // Las librerías que venían en el archivo pasan a ser fijas también en este navegador.
      void mergeProjectLibraries(proj.libraryItems).catch(() => {});
    },

    setFileHandle: (h) => set({ fileHandle: h }),
    setDirty: (d) => set({ dirty: d }),

    addTab: (options) => {
      const { project } = get();
      const t: TabData = {
        id: uid(),
        name: options?.name || `Página ${project.tabs.length + 1}`,
        scene: options?.scene ?? emptyScene(),
      };
      set({
        project: { ...project, tabs: [...project.tabs, t], activeTabId: t.id, meta: { ...project.meta, modified: new Date().toISOString() } },
        dirty: true,
      });
    },

    removeTab: (id) => {
      const { project } = get();
      if (project.tabs.length <= 1) return;
      const tabs = project.tabs.filter((t) => t.id !== id);
      const activeTabId = project.activeTabId === id ? tabs[0].id : project.activeTabId;
      set({
        project: { ...project, tabs, activeTabId, meta: { ...project.meta, modified: new Date().toISOString() } },
        dirty: true,
      });
    },

    renameTab: (id, name) => {
      const { project } = get();
      set({
        project: {
          ...project,
          tabs: project.tabs.map((t) => (t.id === id ? { ...t, name } : t)),
          meta: { ...project.meta, modified: new Date().toISOString() },
        },
        dirty: true,
      });
    },

    setActiveTab: (id) => {
      const { project } = get();
      set({ project: { ...project, activeTabId: id } });
    },

    updateTabScene: (id, scene) => {
      const { project } = get();
      const cleanAppState = { ...(scene.appState || {}) };
      delete cleanAppState.collaborators;
      const cleanScene = { elements: scene.elements || [], appState: cleanAppState, files: scene.files || {} };
      set({
        project: {
          ...project,
          tabs: project.tabs.map((t) => (t.id === id ? { ...t, scene: cleanScene } : t)),
          meta: { ...project.meta, modified: new Date().toISOString() },
        },
        dirty: true,
      });
    },

    setExcalidrawApi: (tabId, api) => {
      set((s) => ({ excalidrawApis: { ...s.excalidrawApis, [tabId]: api } }));
    },

    /** Vuelca el lienzo activo al proyecto antes de guardar o cambiar de espacio. */
    flushActiveScene: (tabId?: string) => {
      const { project, excalidrawApis, updateTabScene } = get();
      const id = tabId || project.activeTabId;
      if (!id) return;
      const api = excalidrawApis[id];
      if (!api) return;
      const appState = { ...(api.getAppState() || {}) };
      delete appState.collaborators;
      updateTabScene(id, {
        elements: api.getSceneElements() || [],
        appState,
        files: api.getFiles() || {},
      });
    },

    addCatalog: () => {
      const { project } = get();
      const c: Catalog = { id: uid(), name: `Catálogo ${project.catalogs.length + 1}`, items: [] };
      set({
        project: { ...project, catalogs: [...project.catalogs, c], meta: { ...project.meta, modified: new Date().toISOString() } },
        dirty: true,
      });
    },

    removeCatalog: (id) => {
      const { project } = get();
      set({
        project: { ...project, catalogs: project.catalogs.filter((c) => c.id !== id), meta: { ...project.meta, modified: new Date().toISOString() } },
        dirty: true,
      });
    },

    updateCatalog: (id, patch) => {
      const { project } = get();
      set({
        project: {
          ...project,
          catalogs: project.catalogs.map((c) => (c.id === id ? { ...c, ...patch } : c)),
          meta: { ...project.meta, modified: new Date().toISOString() },
        },
        dirty: true,
      });
    },

    addCatalogItem: (catalogId) => {
      const { project } = get();
      set({
        project: {
          ...project,
          catalogs: project.catalogs.map((c) =>
            c.id === catalogId ? { ...c, items: [...c.items, { code: "", description: "" }] } : c
          ),
          meta: { ...project.meta, modified: new Date().toISOString() },
        },
        dirty: true,
      });
    },

    removeCatalogItem: (catalogId, index) => {
      const { project } = get();
      set({
        project: {
          ...project,
          catalogs: project.catalogs.map((c) =>
            c.id === catalogId ? { ...c, items: c.items.filter((_, i) => i !== index) } : c
          ),
          meta: { ...project.meta, modified: new Date().toISOString() },
        },
        dirty: true,
      });
    },

    setProjectLibraryItems: (items) => {
      const { project } = get();
      set({
        project: {
          ...project,
          libraryItems: items,
          meta: { ...project.meta, modified: new Date().toISOString() },
        },
        dirty: true,
      });
    },

    getActiveTab: () => {
      const { project } = get();
      return project.tabs.find((t) => t.id === project.activeTabId);
    },
  };
});