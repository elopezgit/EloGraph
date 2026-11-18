import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { useDocumentStore } from "../store/useDocumentStore";
import { useRef, useEffect, type DragEvent } from "react";
import { clearPieceDrag, getPieceDrag } from "../lib/dragPiece";

export function Canvas() {
  const activeTab = useDocumentStore((s) => s.project.tabs.find((t) => t.id === s.project.activeTabId));
  const setExcalidrawApi = useDocumentStore((s) => s.setExcalidrawApi);
  const updateTabScene = useDocumentStore((s) => s.updateTabScene);
  const setDirty = useDocumentStore((s) => s.setDirty);

  const saveTimer = useRef<any>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  if (!activeTab) return null;

  const onDragOverCapture = (e: DragEvent<HTMLDivElement>) => {
    if (!getPieceDrag()) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  };

  const onDropCapture = (e: DragEvent<HTMLDivElement>) => {
    const payload = getPieceDrag();
    if (!payload) return;
    e.preventDefault();
    e.stopPropagation();
    clearPieceDrag();

    const api = useDocumentStore.getState().excalidrawApis[activeTab.id];
    let point: { x: number; y: number } | undefined;
    if (api) {
      const appState = api.getAppState() || {};
      const zoom = appState.zoom?.value ?? 1;
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (rect) {
        // Excalidraw calcula las coordenadas de escena con viewportCoordsToSceneCoords
        const offsetLeft = appState.offsetLeft ?? rect.left;
        const offsetTop = appState.offsetTop ?? rect.top;
        point = {
          x: (e.clientX - offsetLeft) / zoom - (appState.scrollX ?? 0),
          y: (e.clientY - offsetTop) / zoom - (appState.scrollY ?? 0),
        };
      }
    }
    payload.insert(point);
  };

  const initialData = {
    elements: activeTab.scene.elements || [],
    appState: { ...(activeTab.scene.appState || {}), viewBackgroundColor: "#ffffff" },
    files: activeTab.scene.files || {},
  };

  return (
    <div
      ref={wrapperRef}
      className="excalidraw-wrapper"
      style={{ height: "100%" }}
      onDragOverCapture={onDragOverCapture}
      onDropCapture={onDropCapture}
    >
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
