import { useEffect, useState, type DragEvent } from "react";
import { TopBar } from "./components/TopBar";
import { TabBar } from "./components/TabBar";
import { Canvas } from "./components/Canvas";
import { SidePanel } from "./components/SidePanel";
import { AiPanel } from "./components/AiPanel";
import { useDocumentStore } from "./store/useDocumentStore";
import { loadAutosave, saveAutosave } from "./lib/autosave";
import { saveProjectFile } from "./lib/fileSystem";
import { openDroppedFile } from "./lib/openFile";

export default function App() {
  const project = useDocumentStore((s) => s.project);
  const initProject = useDocumentStore((s) => s.initProject);
  const setDirty = useDocumentStore((s) => s.setDirty);
  const [aiOpen, setAiOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const saved = await loadAutosave();
      if (saved) {
        initProject(saved);
        setDirty(false);
      }
    })();
  }, [initProject, setDirty]);

  useEffect(() => {
    const id = setInterval(() => {
      saveAutosave(useDocumentStore.getState().project).catch(() => {});
    }, 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const handler = () => {
      saveAutosave(useDocumentStore.getState().project).catch(() => {});
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        const st = useDocumentStore.getState();
        saveProjectFile(st.project, st.fileHandle).then((h) => {
          st.setFileHandle(h);
          st.setDirty(false);
        }).catch(() => {});
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const onDragOver = (e: DragEvent) => {
    if (Array.from(e.dataTransfer.types).includes("Files")) e.preventDefault();
  };

  const onDrop = (e: DragEvent) => {
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    e.preventDefault();
    void openDroppedFile(file).catch(() => {});
  };

  return (
    <div className="flex flex-col h-full" onDragOver={onDragOver} onDrop={onDrop}>
      <TopBar aiOpen={aiOpen} onToggleAi={() => setAiOpen((v) => !v)} />
      <TabBar />
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 min-w-0">
          <Canvas />
        </div>
        <SidePanel />
      </div>
      <AiPanel open={aiOpen} onClose={() => setAiOpen(false)} />
      <footer className="text-xs text-gray-400 px-3 py-1 border-t">
        {project.tabs.length} pestaña(s) · {project.catalogs.length} catálogo(s)
      </footer>
    </div>
  );
}