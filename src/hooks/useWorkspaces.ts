import { useCallback, useEffect, useRef, useState } from "react";
import {
  createWorkspace,
  ensureWorkspaces,
  exportWorkspace,
  getActiveWorkspaceId,
  getAutoSave,
  getWorkspace,
  importWorkspaceFile,
  listWorkspaces,
  persistWorkspace,
  putWorkspace,
  removeWorkspace,
  setActiveWorkspaceId,
  setAutoSave,
  type Workspace,
} from "../lib/workspaces";
import { useDocumentStore } from "../store/useDocumentStore";

export function useWorkspaces() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeId, setActiveIdState] = useState<string | null>(null);
  const [autoSave, setAutoSaveState] = useState(getAutoSave());
  const [ready, setReady] = useState(false);
  const loadedIdRef = useRef<string | null>(null);

  const initProject = useDocumentStore((s) => s.initProject);
  const setFileHandle = useDocumentStore((s) => s.setFileHandle);
  const setDirty = useDocumentStore((s) => s.setDirty);

  useEffect(() => {
    void (async () => {
      const list = await ensureWorkspaces();
      setWorkspaces(list);
      let id = getActiveWorkspaceId();
      if (!id || !list.some((w) => w.id === id)) id = list[0]?.id ?? null;
      if (id) {
        setActiveIdState(id);
        setActiveWorkspaceId(id);
      }
      setReady(true);
    })();
  }, []);

  const loadInto = useCallback(
    (id: string, source?: Workspace[]) => {
      const ws = (source ?? workspaces).find((w) => w.id === id);
      if (!ws) return;
      loadedIdRef.current = id;
      initProject(JSON.parse(JSON.stringify(ws.project)));
      setFileHandle(ws.fileHandle ?? null);
      setActiveIdState(id);
      setActiveWorkspaceId(id);
      setDirty(false);
    },
    [workspaces, initProject, setFileHandle, setDirty],
  );

  useEffect(() => {
    if (!ready || !activeId || loadedIdRef.current === activeId) return;
    loadInto(activeId);
  }, [ready, activeId, loadInto]);

  const saveCurrent = useCallback(async () => {
    if (!activeId) return;
    useDocumentStore.getState().flushActiveScene();
    const st = useDocumentStore.getState();
    const current = workspaces.find((w) => w.id === activeId);
    if (!current) return;
    const saved = await persistWorkspace(current, st.project, st.fileHandle);
    setWorkspaces((prev) =>
      [saved, ...prev.filter((w) => w.id !== saved.id)].sort((a, b) => b.modified.localeCompare(a.modified)),
    );
    setDirty(false);
  }, [activeId, workspaces, setDirty]);

  const switchTo = useCallback(
    async (id: string, discard = false) => {
      if (id === activeId) return;
      if (!discard) await saveCurrent();
      const list = await listWorkspaces();
      setWorkspaces(list);
      loadInto(id, list);
    },
    [activeId, saveCurrent, loadInto],
  );

  const createNew = useCallback(
    async (name: string) => {
      await saveCurrent();
      const ws = await createWorkspace(name);
      const list = await listWorkspaces();
      setWorkspaces(list);
      loadInto(ws.id, list);
    },
    [saveCurrent, loadInto],
  );

  const duplicate = useCallback(
    async (id: string) => {
      const src = workspaces.find((w) => w.id === id);
      if (!src) return;
      await createWorkspace(`${src.name} (copia)`, src.project);
      setWorkspaces(await listWorkspaces());
    },
    [workspaces],
  );

  const rename = useCallback(async (id: string, name: string) => {
    const ws = await getWorkspace(id);
    if (!ws) return;
    const saved = await putWorkspace({ ...ws, name: name.trim() || ws.name });
    setWorkspaces((prev) => prev.map((w) => (w.id === saved.id ? saved : w)));
  }, []);

  const remove = useCallback(
    async (id: string) => {
      if (workspaces.length <= 1) throw new Error("No se puede eliminar el único espacio de trabajo.");
      await removeWorkspace(id);
      const list = await listWorkspaces();
      setWorkspaces(list);
      if (id === activeId && list.length) {
        loadedIdRef.current = null;
        loadInto(list[0].id, list);
      }
    },
    [workspaces.length, activeId, loadInto],
  );

  const importFile = useCallback(async (file: File) => {
    const ws = await importWorkspaceFile(file);
    setWorkspaces(await listWorkspaces());
    return ws;
  }, []);

  const exportWs = useCallback(
    async (id: string) => {
      if (id === activeId) await saveCurrent();
      const ws = (await getWorkspace(id)) ?? workspaces.find((w) => w.id === id);
      if (ws) await exportWorkspace(ws);
    },
    [activeId, saveCurrent, workspaces],
  );

  const toggleAutoSave = useCallback((enabled: boolean) => {
    setAutoSave(enabled);
    setAutoSaveState(enabled);
  }, []);

  return {
    workspaces,
    activeId,
    active: workspaces.find((w) => w.id === activeId),
    autoSave,
    ready,
    saveCurrent,
    switchTo,
    createNew,
    duplicate,
    rename,
    remove,
    importFile,
    exportWs,
    toggleAutoSave,
  };
}
