import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { useDocumentStore } from "../store/useDocumentStore";
import { useRef, useEffect, useMemo, useState, type DragEvent } from "react";
import { clearPieceDrag, getPieceDrag } from "../lib/dragPiece";
import {
  getAllLibraryItems,
  getStoredLibraries,
  onLibrariesChanged,
  saveFixedLibrary,
} from "../lib/fixedLibraries";
import type { LibraryItem } from "../lib/libraryUrl";
import { normalizeForExcalidraw } from "../lib/excalidrawLibrary";

export function Canvas() {
  const activeTab = useDocumentStore((s) => s.project.tabs.find((t) => t.id === s.project.activeTabId));
  const setExcalidrawApi = useDocumentStore((s) => s.setExcalidrawApi);
  const excalidrawApis = useDocumentStore((s) => s.excalidrawApis);
  const updateTabScene = useDocumentStore((s) => s.updateTabScene);
  const setDirty = useDocumentStore((s) => s.setDirty);

  const api = activeTab ? excalidrawApis[activeTab.id] : null;
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const normalizedLibraryItems = useMemo(() => normalizeForExcalidraw(libraryItems), [libraryItems]);
  const injectedIds = useRef("");
  const suppressChange = useRef(false);

  const saveTimer = useRef<any>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  // Carga las librerías fijas (incluidas + integradas) y se actualiza si cambian.
  useEffect(() => {
    let alive = true;
    const load = () => {
      getAllLibraryItems()
        .then((items) => { if (alive) setLibraryItems(items); })
        .catch(() => {});
    };
    load();
    const off = onLibrariesChanged(load);
    return () => { alive = false; off(); };
  }, []);

  // Las inyecta en el lienzo sin borrar las que el usuario ya tuviera.
  useEffect(() => {
    if (!activeTab || !api || !normalizedLibraryItems.length) return;
    const key = `${activeTab.id}|${normalizedLibraryItems.map((i: any) => i.id).join(",")}`;
    if (injectedIds.current === key) return;
    injectedIds.current = key;
    suppressChange.current = true;
    Promise.resolve(
      api.updateLibrary({
        libraryItems: normalizedLibraryItems,
        merge: true,
        defaultStatus: "published",
        openLibraryMenu: false,
      })
    )
      .catch(() => {})
      .finally(() => { window.setTimeout(() => { suppressChange.current = false; }, 100); });
  }, [api, normalizedLibraryItems, activeTab]);

  // Captura también las librerías que el usuario agregue desde el panel de Excalidraw.
  const onLibraryChange = async (items: readonly any[]) => {
    if (suppressChange.current) return;
    try {
      const known = new Set(libraryItems.map((i) => i.id));
      const added = items
        .filter((i) => i && i.id && !known.has(i.id))
        .map((i: any) => ({ ...i })) as LibraryItem[];
      if (!added.length) return;

      const stored = await getStoredLibraries();
      const previous = stored.find((l) => l.id === "ui-added")?.items || [];
      await saveFixedLibrary({
        id: "ui-added",
        name: "Agregadas desde Excalidraw",
        items: [...previous, ...added],
      });

      setLibraryItems((prev) => {
        const seen = new Set(prev.map((i) => i.id));
        return [...prev, ...added.filter((i) => !seen.has(i.id))];
      });

      const store = useDocumentStore.getState();
      const seen = new Set((store.project.libraryItems || []).map((i) => i.id));
      const news = added.filter((i) => !seen.has(i.id));
      if (news.length) store.setProjectLibraryItems([...(store.project.libraryItems || []), ...news]);
    } catch (err) {
      console.error("No se pudo guardar la librería agregada", err);
    }
  };

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

    const apiDrop = useDocumentStore.getState().excalidrawApis[activeTab.id];
    let point: { x: number; y: number } | undefined;
    if (apiDrop) {
      const appState = apiDrop.getAppState() || {};
      const zoom = appState.zoom?.value ?? 1;
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (rect) {
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
    libraryItems: normalizedLibraryItems,
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
        excalidrawAPI={(exApi: any) => setExcalidrawApi(activeTab.id, exApi)}
        initialData={initialData}
        onLibraryChange={onLibraryChange}
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
