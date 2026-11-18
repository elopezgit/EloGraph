import { useRef, useState, type ChangeEvent } from "react";
import { useDocumentStore } from "../store/useDocumentStore";
import { INVALID_MESSAGE, OPEN_ACCEPT, readOpenedFile, saveProjectFile } from "../lib/fileSystem";
import { saveAutosave } from "../lib/autosave";
import { exportToPdf, exportToPng, exportProjectToPdf } from "../lib/pdfExport";
import { importExcelFile } from "../lib/excelImport";
import { applyOpenedFile, openRemoteFile } from "../lib/openFile";

export function TopBar({
  aiOpen,
  onToggleAi,
  reverseAiOpen,
  onToggleReverseAi,
  onOpenWorkspaces,
  workspaceName,
  onLogout,
}: {
  aiOpen: boolean;
  onToggleAi: () => void;
  reverseAiOpen: boolean;
  onToggleReverseAi: () => void;
  onOpenWorkspaces: () => void;
  workspaceName: string;
  onLogout: () => void;
}) {
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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);
  const [urlOpen, setUrlOpen] = useState(false);
  const [remoteUrl, setRemoteUrl] = useState("");

  const notify = (message: string) => {
    setStatus(message);
    window.setTimeout(() => setStatus((current) => (current === message ? "" : current)), 6000);
  };

  const handleNew = () => {
    if (dirty) {
      setConfirmNew(true);
      return;
    }
    initProject();
    setFileHandle(null);
    notify("Proyecto nuevo creado");
  };

  const confirmNewProject = () => {
    setConfirmNew(false);
    initProject();
    setFileHandle(null);
    notify("Proyecto nuevo creado");
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const res = await readOpenedFile(file);
      if (!res) {
        notify(INVALID_MESSAGE);
        return;
      }
      notify(await applyOpenedFile(res));
    } catch (err) {
      notify("No se pudo abrir el archivo: " + ((err as any)?.message || "error desconocido"));
    } finally {
      setBusy(false);
    }
  };

  const handleRemoteOpen = async () => {
    if (!remoteUrl.trim()) {
      notify("Pega una URL para continuar");
      return;
    }
    setBusy(true);
    notify("Descargando archivo…");
    try {
      notify(await openRemoteFile(remoteUrl));
      setUrlOpen(false);
      setRemoteUrl("");
    } catch (err) {
      notify("No se pudo abrir la URL: " + ((err as any)?.message || "error desconocido"));
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    const p = useDocumentStore.getState().project;
    const h = await saveProjectFile(p, fileHandle);
    setFileHandle(h);
    setDirty(false);
    await saveAutosave(p);
    notify("Proyecto guardado");
  };

  const handleExportPdf = async () => {
    if (!api) return notify("Canvas no disponible");
    try {
      await exportToPdf(api.getSceneElements(), api.getAppState(), api.getFiles(), project.meta.title);
    } catch (err) {
      notify("No se pudo exportar el PDF: " + ((err as any)?.message || "error desconocido"));
    }
  };

  const handleExportProjectPdf = async () => {
    try {
      await exportProjectToPdf(project);
    } catch (err) {
      notify("No se pudo exportar el PDF: " + ((err as any)?.message || "error desconocido"));
    }
  };

  const handleExportPng = async () => {
    if (!api) return notify("Canvas no disponible");
    try {
      await exportToPng(api.getSceneElements(), api.getAppState(), api.getFiles(), project.meta.title);
      notify("PNG exportado");
    } catch (err) {
      notify("No se pudo exportar el PNG: " + ((err as any)?.message || "error desconocido"));
    }
  };

  return (
    <div>
      <header className="flex items-center gap-2 px-3 py-2 border-b bg-white shadow-sm z-10">
        <div className="font-bold text-lg text-blue-700 mr-2">elograph</div>
        <button
          onClick={onOpenWorkspaces}
          title="Gestionar espacios de trabajo"
          className="px-3 py-1.5 text-sm rounded border border-blue-200 text-blue-700 hover:bg-blue-50"
        >
          Espacios: {workspaceName}
        </button>
        <button onClick={onLogout} title="Cerrar sesión" className="px-2 py-1.5 text-xs rounded text-gray-600 hover:bg-gray-100">
          Salir
        </button>
        <button onClick={handleNew} className="px-3 py-1.5 text-sm rounded hover:bg-gray-100">Nuevo</button>
        <input
          ref={fileInputRef}
          type="file"
          accept={OPEN_ACCEPT}
          onChange={handleFileChange}
          style={{ display: "none" }}
          aria-hidden="true"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          title="Abrir proyecto .cdsgn, lienzo .excalidraw o librería .excalidrawlib"
          className="px-3 py-1.5 text-sm rounded hover:bg-gray-100 disabled:opacity-60"
        >
          Abrir
        </button>
        <button
          onClick={() => setUrlOpen((v) => !v)}
          title="Abrir un archivo desde una URL"
          className="px-3 py-1.5 text-sm rounded hover:bg-gray-100"
        >
          Abrir URL
        </button>
        <button onClick={handleSave} className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700">
          Guardar{dirty ? " •" : ""}
        </button>
        <div className="w-px h-6 bg-gray-300 mx-1" />
        <button onClick={handleExportPdf} className="px-3 py-1.5 text-sm rounded hover:bg-gray-100">Exportar PDF</button>
        <button onClick={() => void handleExportProjectPdf()} className="px-3 py-1.5 text-sm rounded hover:bg-gray-100">Exportar PDF (todas)</button>
        <button onClick={handleExportPng} className="px-3 py-1.5 text-sm rounded hover:bg-gray-100">Exportar PNG</button>
        <button
          onClick={onToggleAi}
          title="Interpretar el dibujo con IA y convertirlo en texto"
          className={`px-3 py-1.5 text-sm rounded ${aiOpen ? "bg-blue-600 text-white hover:bg-blue-700" : "hover:bg-gray-100"}`}
        >
          IA
        </button>
        <button
          onClick={onToggleReverseAi}
          title="Convertir un Markdown en diagrama mediante IA"
          className={`px-3 py-1.5 text-sm rounded ${reverseAiOpen ? "bg-blue-600 text-white hover:bg-blue-700" : "hover:bg-gray-100"}`}
        >
          IA inversa
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

      {status && (
        <div className="px-3 py-1 text-xs bg-blue-50 text-blue-800 border-b" role="status">
          {status}
        </div>
      )}

      {confirmNew && (
        <div className="px-3 py-1.5 text-xs bg-amber-50 text-amber-900 border-b flex items-center gap-3">
          <span>Hay cambios sin guardar. ¿Crear un proyecto nuevo?</span>
          <button className="underline font-semibold" onClick={confirmNewProject}>Descartar cambios</button>
          <button className="underline" onClick={() => setConfirmNew(false)}>Cancelar</button>
        </div>
      )}

      {urlOpen && (
        <div className="px-3 py-1.5 text-xs bg-gray-50 border-b flex items-center gap-2">
          <input
            className="border rounded px-2 py-1 flex-1 text-xs"
            value={remoteUrl}
            onChange={(e) => setRemoteUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void handleRemoteOpen(); }}
            placeholder="https://…/proyecto.cdsgn (o .excalidraw)"
            spellCheck={false}
          />
          <button className="px-2 py-1 rounded bg-blue-600 text-white disabled:opacity-60" disabled={busy} onClick={() => void handleRemoteOpen()}>
            Abrir
          </button>
          <button className="px-2 py-1 rounded hover:bg-gray-200" onClick={() => setUrlOpen(false)}>Cancelar</button>
        </div>
      )}
    </div>
  );
}
