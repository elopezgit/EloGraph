import { useDocumentStore } from "../store/useDocumentStore";
import { openProjectFile, saveProjectFile } from "../lib/fileSystem";
import { saveAutosave } from "../lib/autosave";
import { exportToPdf, exportToPng, exportProjectToPdf } from "../lib/pdfExport";
import { importExcelFile } from "../lib/excelImport";
import { applyOpenedFile } from "../lib/openFile";

export function TopBar({ aiOpen, onToggleAi }: { aiOpen: boolean; onToggleAi: () => void }) {
  const project = useDocumentStore((s) => s.project);
  const fileHandle = useDocumentStore((s) => s.fileHandle);
  const dirty = useDocumentStore((s) => s.dirty);
  const setFileHandle = useDocumentStore((s) => s.setFileHandle);
  const initProject = useDocumentStore((s) => s.initProject);
  const setDirty = useDocumentStore((s) => s.setDirty);
  const getActiveTab = useDocumentStore((s) => s.getActiveTab);
  const excalidrawApis = useDocumentStore((s) => s.excalidrawApis);

  const activeTab = getActiveTab();
  const api = activeTab ? excalidrawApis[activeTab.id] : null;

  const handleNew = () => {
    if (dirty && !confirm("Hay cambios sin guardar. ¿Crear nuevo proyecto?")) return;
    initProject();
    setFileHandle(null);
  };

  const handleOpen = async () => {
    const res = await openProjectFile();
    if (!res) return;
    await applyOpenedFile(res);
  };

  const handleSave = async () => {
    const p = useDocumentStore.getState().project;
    const h = await saveProjectFile(p, fileHandle);
    setFileHandle(h);
    setDirty(false);
    await saveAutosave(p);
  };

  const handleExportPdf = async () => {
    if (!api) return alert("Canvas no disponible");
    const elements = api.getSceneElements();
    const appState = api.getAppState();
    const files = api.getFiles();
    await exportToPdf(elements, appState, files, project.meta.title);
  };

  const handleExportPng = async () => {
    if (!api) return alert("Canvas no disponible");
    const elements = api.getSceneElements();
    const appState = api.getAppState();
    const files = api.getFiles();
    await exportToPng(elements, appState, files, project.meta.title);
  };

  return (
    <header className="flex items-center gap-2 px-3 py-2 border-b bg-white shadow-sm z-10">
      <div className="font-bold text-lg text-blue-700 mr-2">elograph</div>
      <button onClick={handleNew} className="px-3 py-1.5 text-sm rounded hover:bg-gray-100">Nuevo</button>
      <button
        onClick={handleOpen}
        title="Abrir proyecto .cdsgn o lienzo de Excalidraw (.excalidraw)"
        className="px-3 py-1.5 text-sm rounded hover:bg-gray-100"
      >
        Abrir
      </button>
      <button onClick={handleSave} className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700">
        Guardar{dirty ? " •" : ""}
      </button>
      <div className="w-px h-6 bg-gray-300 mx-1" />
      <button onClick={handleExportPdf} className="px-3 py-1.5 text-sm rounded hover:bg-gray-100">Exportar PDF</button>
      <button onClick={() => exportProjectToPdf(project)} className="px-3 py-1.5 text-sm rounded hover:bg-gray-100">Exportar PDF (todas)</button>
      <button onClick={handleExportPng} className="px-3 py-1.5 text-sm rounded hover:bg-gray-100">Exportar PNG</button>
      <button
        onClick={onToggleAi}
        title="Interpretar el dibujo con IA y convertirlo en texto"
        className={`px-3 py-1.5 text-sm rounded ${aiOpen ? "bg-blue-600 text-white hover:bg-blue-700" : "hover:bg-gray-100"}`}
      >
        IA
      </button>
      <button
        onClick={() => {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = ".xlsx,.xls";
          input.onchange = async () => {
            const f = input.files?.[0];
            if (f) await importExcelFile(f);
          };
          input.click();
        }}
        className="px-3 py-1.5 text-sm rounded hover:bg-gray-100"
      >
        Importar Excel
      </button>
      <div className="flex-1" />
      <input
        value={project.meta.title}
        onChange={(e) =>
          useDocumentStore.setState((s) => ({
            project: { ...s.project, meta: { ...s.project.meta, title: e.target.value } },
            dirty: true,
          }))
        }
        className="border rounded px-2 py-1 text-sm w-48"
        placeholder="Título del proyecto"
      />
    </header>
  );
}