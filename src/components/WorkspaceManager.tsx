import { useRef, useState, type ChangeEvent } from "react";
import { useDocumentStore } from "../store/useDocumentStore";
import type { useWorkspaces } from "../hooks/useWorkspaces";

type Props = {
  open: boolean;
  onClose: () => void;
  manager: ReturnType<typeof useWorkspaces>;
  notify: (message: string) => void;
};

const fmtDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return "—";
  }
};

export function WorkspaceManager({ open, onClose, manager, notify }: Props) {
  const [newName, setNewName] = useState("");
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [pendingSwitch, setPendingSwitch] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const run = async (fn: () => Promise<void>, ok?: string) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      if (ok) notify(ok);
    } catch (err) {
      setError((err as any)?.message || "No se pudo completar la acción.");
    } finally {
      setBusy(false);
    }
  };

  const requestSwitch = (id: string) => {
    if (id === manager.activeId) return;
    if (!manager.autoSave && useDocumentStore.getState().dirty) {
      setPendingSwitch(id);
      return;
    }
    void run(() => manager.switchTo(id), "Espacio activado");
  };

  const handleImport = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    void run(async () => {
      const ws = await manager.importFile(file);
      await manager.switchTo(ws.id);
      notify(`Espacio "${ws.name}" importado`);
    });
  };

  const btn = "rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[88vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b px-5 py-3">
          <div>
            <h2 className="font-semibold text-blue-700">Espacios de trabajo</h2>
            <p className="text-xs text-gray-500">Cada espacio guarda su propio conjunto de pestañas</p>
          </div>
          <button onClick={onClose} className="rounded px-2 py-1 text-gray-500 hover:bg-gray-100">✕</button>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 p-3">
            <input
              className="min-w-[160px] flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm"
              placeholder="Nombre del nuevo espacio"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newName.trim()) {
                  void run(async () => {
                    await manager.createNew(newName.trim());
                    setNewName("");
                  }, "Espacio creado");
                }
              }}
            />
            <button
              className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              disabled={busy || !newName.trim()}
              onClick={() => void run(async () => {
                await manager.createNew(newName.trim());
                setNewName("");
              }, "Espacio creado")}
            >
              Nuevo espacio
            </button>
            <button className={btn} disabled={busy} onClick={() => fileRef.current?.click()}>Importar .cdsgn</button>
            <input ref={fileRef} type="file" accept=".cdsgn,.pdisg,.excalidraw,.json" className="hidden" onChange={handleImport} />
            <button className={btn} disabled={busy} onClick={() => void run(() => manager.saveCurrent(), "Espacio guardado")}>
              Guardar ahora
            </button>
            <label className="ml-auto flex items-center gap-2 text-xs text-gray-700">
              <input
                type="checkbox"
                checked={manager.autoSave}
                onChange={(e) => manager.toggleAutoSave(e.target.checked)}
              />
              Guardado automático
            </label>
          </div>

          {pendingSwitch && (
            <div className="rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
              <p className="mb-2">Hay cambios sin guardar en el espacio actual.</p>
              <div className="flex gap-2">
                <button className="rounded bg-amber-700 px-2 py-1 text-white" onClick={() => {
                  const id = pendingSwitch;
                  setPendingSwitch(null);
                  void run(async () => { await manager.saveCurrent(); await manager.switchTo(id, true); }, "Cambios guardados");
                }}>Guardar y cambiar</button>
                <button className={btn} onClick={() => {
                  const id = pendingSwitch;
                  setPendingSwitch(null);
                  void run(() => manager.switchTo(id, true), "Espacio activado");
                }}>Descartar cambios</button>
                <button className={btn} onClick={() => setPendingSwitch(null)}>Cancelar</button>
              </div>
            </div>
          )}

          {error && <p role="alert" className="rounded bg-red-50 p-2 text-xs text-red-700">{error}</p>}

          <div className="space-y-2">
            {manager.workspaces.map((ws) => {
              const active = ws.id === manager.activeId;
              return (
                <div
                  key={ws.id}
                  className={`rounded-lg border p-3 ${active ? "border-blue-400 bg-blue-50" : "border-gray-200"}`}
                >
                  {renameId === ws.id ? (
                    <div className="flex gap-2">
                      <input
                        className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            void run(async () => { await manager.rename(ws.id, renameValue); setRenameId(null); });
                          }
                        }}
                      />
                      <button className={btn} onClick={() => {
                        void run(async () => { await manager.rename(ws.id, renameValue); setRenameId(null); });
                      }}>Aceptar</button>
                      <button className={btn} onClick={() => setRenameId(null)}>Cancelar</button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        className="font-medium text-sm text-blue-700 hover:underline disabled:no-underline"
                        disabled={active || busy}
                        onClick={() => requestSwitch(ws.id)}
                        title="Activar este espacio"
                      >
                        {ws.name} {active && <span className="ml-1 text-xs text-green-700">(activo)</span>}
                      </button>
                      <span className="text-[11px] text-gray-500">
                        {ws.project.tabs.length} pestaña(s) · {fmtDate(ws.modified)}
                      </span>
                      <div className="ml-auto flex flex-wrap gap-1">
                        <button className={btn} disabled={busy} onClick={() => {
                          setRenameId(ws.id);
                          setRenameValue(ws.name);
                        }}>Renombrar</button>
                        <button className={btn} disabled={busy} onClick={() => void run(() => manager.duplicate(ws.id))}>Duplicar</button>
                        <button className={btn} disabled={busy} onClick={() => void run(() => manager.exportWs(ws.id))}>Exportar</button>
                        <button
                          className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                          disabled={busy || manager.workspaces.length <= 1}
                          onClick={() => setDeleteId(ws.id)}
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  )}

                  {deleteId === ws.id && (
                    <div className="mt-2 rounded bg-red-50 p-2 text-xs text-red-800">
                      ¿Eliminar el espacio "{ws.name}"?
                      <div className="mt-2 flex gap-2">
                        <button className="rounded bg-red-600 px-2 py-1 text-white" onClick={() => {
                          const id = deleteId;
                          setDeleteId(null);
                          void run(() => manager.remove(id), "Espacio eliminado");
                        }}>Eliminar</button>
                        <button className={btn} onClick={() => setDeleteId(null)}>Cancelar</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <footer className="border-t px-5 py-2 text-[11px] text-gray-500">
          El guardado automático se aplica al espacio activo cada 5 segundos. Si lo desactivas, usa "Guardar ahora".
        </footer>
      </div>
    </div>
  );
}
