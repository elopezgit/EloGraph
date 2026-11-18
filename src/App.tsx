import { useEffect, useState, type DragEvent } from "react";
import { TopBar } from "./components/TopBar";
import { TabBar } from "./components/TabBar";
import { Canvas } from "./components/Canvas";
import { SidePanel } from "./components/SidePanel";
import { AiPanel } from "./components/AiPanel";
import { ReverseAiPanel } from "./components/ReverseAiPanel";
import { WorkspaceManager } from "./components/WorkspaceManager";
import { Login } from "./components/Login";
import { isAuthenticated, logout } from "./lib/auth";
import { useWorkspaces } from "./hooks/useWorkspaces";
import { useDocumentStore } from "./store/useDocumentStore";
import { saveProjectFile } from "./lib/fileSystem";
import { openDroppedFile } from "./lib/openFile";

export default function App() {
  const project = useDocumentStore((s) => s.project);
  const [aiOpen, setAiOpen] = useState(false);
  const [reverseAiOpen, setReverseAiOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [authenticated, setAuthenticated] = useState(() => isAuthenticated());
  const wsManager = useWorkspaces();
  const { ready: wsReady, activeId: wsActiveId, autoSave: wsAutoSave, saveCurrent: wsSaveCurrent } = wsManager;

  const notify = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice((current) => (current === message ? "" : current)), 6000);
  };

  useEffect(() => {
    if (!wsReady || !wsActiveId || !wsAutoSave) return;
    const id = setInterval(() => { void wsSaveCurrent(); }, 5000);
    return () => clearInterval(id);
  }, [wsReady, wsActiveId, wsAutoSave, wsSaveCurrent]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!wsAutoSave && useDocumentStore.getState().dirty) {
        e.preventDefault();
        e.returnValue = "";
        return;
      }
      void wsSaveCurrent();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [wsAutoSave, wsSaveCurrent]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        const st = useDocumentStore.getState();
        saveProjectFile(st.project, st.fileHandle).then((h) => {
          st.setFileHandle(h);
          st.setDirty(false);
          void wsSaveCurrent();
        }).catch(() => {});
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [wsSaveCurrent]);

  const onDragOver = (e: DragEvent) => {
    if (Array.from(e.dataTransfer.types).includes("Files")) e.preventDefault();
  };

  const onDrop = (e: DragEvent) => {
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    e.preventDefault();
    void openDroppedFile(file)
      .then(notify)
      .catch((err: any) => notify("No se pudo abrir el archivo: " + ((err as any)?.message || "error desconocido")));
  };

  if (!authenticated) {
    return <Login onSuccess={() => setAuthenticated(true)} />;
  }

  return (
    <div className="flex flex-col h-full" onDragOver={onDragOver} onDrop={onDrop}>
      <TopBar
        aiOpen={aiOpen}
        onToggleAi={() => setAiOpen((v) => !v)}
        reverseAiOpen={reverseAiOpen}
        onToggleReverseAi={() => setReverseAiOpen((v) => !v)}
        onOpenWorkspaces={() => setWorkspaceOpen(true)}
        workspaceName={wsManager.active?.name ?? "Mi espacio"}
        onLogout={() => { logout(); setAuthenticated(false); }}
      />
      <TabBar />
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 min-w-0">
          <Canvas />
        </div>
        <SidePanel />
      </div>
      <AiPanel open={aiOpen} onClose={() => setAiOpen(false)} />
      <ReverseAiPanel open={reverseAiOpen} onClose={() => setReverseAiOpen(false)} />
      <WorkspaceManager open={workspaceOpen} onClose={() => setWorkspaceOpen(false)} manager={wsManager} notify={notify} />
      {notice && (
        <div
          role="status"
          className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 max-w-lg px-3 py-2 rounded shadow bg-blue-700 text-white text-xs"
        >
          {notice}
        </div>
      )}
      <footer className="text-xs text-gray-400 px-3 py-1 border-t">
        {project.tabs.length} pestaña(s) · {project.catalogs.length} catálogo(s) · {wsManager.active?.name ?? "Mi espacio"}
      </footer>
    </div>
  );
}
