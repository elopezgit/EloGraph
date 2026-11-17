import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { useDocumentStore } from "../store/useDocumentStore";
import { useRef, useEffect } from "react";

export function Canvas() {
  const activeTab = useDocumentStore((s) => s.project.tabs.find((t) => t.id === s.project.activeTabId));
  const setExcalidrawApi = useDocumentStore((s) => s.setExcalidrawApi);
  const updateTabScene = useDocumentStore((s) => s.updateTabScene);
  const setDirty = useDocumentStore((s) => s.setDirty);

  const saveTimer = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  if (!activeTab) return null;

  const initialData = {
    elements: activeTab.scene.elements || [],
    appState: { ...(activeTab.scene.appState || {}), viewBackgroundColor: "#ffffff" },
    files: activeTab.scene.files || {},
  };

  return (
    <div className="excalidraw-wrapper" style={{ height: "100%" }}>
      <Excalidraw
        key={activeTab.id}
        excalidrawAPI={(api: any) => setExcalidrawApi(activeTab.id, api)}
        initialData={initialData}
        onChange={(elements: any, appState: any, files: any) => {
          if (saveTimer.current) clearTimeout(saveTimer.current);
          saveTimer.current = setTimeout(() => {
            updateTabScene(activeTab.id, { elements, appState, files });
            setDirty(true);
          }, 400);
        }}
        theme="light"
      />
    </div>
  );
}