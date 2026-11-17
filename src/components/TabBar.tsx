import { useDocumentStore } from "../store/useDocumentStore";

export function TabBar() {
  const project = useDocumentStore((s) => s.project);
  const addTab = useDocumentStore((s) => s.addTab);
  const removeTab = useDocumentStore((s) => s.removeTab);
  const renameTab = useDocumentStore((s) => s.renameTab);
  const setActiveTab = useDocumentStore((s) => s.setActiveTab);
  const updateTabScene = useDocumentStore((s) => s.updateTabScene);
  const excalidrawApis = useDocumentStore((s) => s.excalidrawApis);

  const selectTab = (id: string) => {
    if (id === project.activeTabId) return;
    // save current canvas before switching
    const curApi = excalidrawApis[project.activeTabId];
    if (curApi) {
      const appState = { ...(curApi.getAppState() || {}) };
      delete appState.collaborators;
      updateTabScene(project.activeTabId, {
        elements: curApi.getSceneElements() || [],
        appState,
        files: curApi.getFiles() || {},
      });
    }
    setActiveTab(id);
  };

  return (
    <div className="flex items-center gap-1 px-2 py-1 border-b bg-gray-50 overflow-x-auto">
      {project.tabs.map((t) => (
        <div
          key={t.id}
          className={`group flex items-center gap-1 px-3 py-1 rounded-t text-sm cursor-pointer border ${
            project.activeTabId === t.id ? "bg-white border-b-white font-medium" : "bg-gray-100 border-transparent hover:bg-gray-200"
          }`}
          onClick={() => selectTab(t.id)}
        >
          <input
            value={t.name}
            onChange={(e) => renameTab(t.id, e.target.value)}
            onFocus={() => selectTab(t.id)}
            className="bg-transparent outline-none w-24"
            onClick={(e) => e.stopPropagation()}
          />
          {project.tabs.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeTab(t.id);
              }}
              className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100"
            >
              ×
            </button>
          )}
        </div>
      ))}
      <button onClick={addTab} className="px-2 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded">+ Pestaña</button>
    </div>
  );
}