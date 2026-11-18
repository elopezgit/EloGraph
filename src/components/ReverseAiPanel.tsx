/* IA inversa: convierte un Markdown en un diagrama editable de Excalidraw */

import { useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { useDocumentStore } from "../store/useDocumentStore";
import { AI_PRESETS, fetchModels, markdownToSkeleton, type AiSettings } from "../lib/aiClient";
import { loadAiSettings, saveAiSettings } from "../lib/aiSettings";

const INSTRUCTIONS = [
  { id: "flujo", label: "Diagrama de flujo", text: "Convierte los pasos en un diagrama de flujo con inicio, decisiones y fin." },
  { id: "clase", label: "Diagrama de clases", text: "Representa las clases, sus atributos y sus relaciones del Markdown." },
  { id: "er", label: "Entidades y relaciones", text: "Crea un diagrama de entidades-relaciones con las entidades y sus cardinalidades." },
  { id: "casos", label: "Casos de uso", text: "Dibuja actores y casos de uso con sus relaciones." },
];

function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{children}</h3>;
}

export function ReverseAiPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const getActiveTab = useDocumentStore((s) => s.getActiveTab);
  const excalidrawApis = useDocumentStore((s) => s.excalidrawApis);
  const addTab = useDocumentStore((s) => s.addTab);
  const activeTab = getActiveTab();
  const api = activeTab ? excalidrawApis[activeTab.id] : null;

  const [settings, setSettings] = useState<AiSettings>(loadAiSettings);
  const [markdown, setMarkdown] = useState("");
  const [instruction, setInstruction] = useState(INSTRUCTIONS[0].text);
  const [target, setTarget] = useState<"new" | "active">("new");
  const [models, setModels] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const inputCls =
    "w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none";
  const labelCls = "mb-1 block text-xs font-medium text-gray-600";
  const btnCls = "rounded border border-gray-300 px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50";

  const applyPreset = (id: string) => {
    const preset = AI_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setSettings((s) => ({ ...s, preset: id, endpoint: preset.endpoint, model: preset.model }));
    setModels([]);
    saveAiSettings({ ...settings, preset: id, endpoint: preset.endpoint, model: preset.model });
  };

  const loadModels = async () => {
    setStatus("");
    setLoading(true);
    try {
      const list = await fetchModels(settings);
      setModels(list);
      setStatus(`Modelos disponibles: ${list.length}`);
    } catch (err) {
      setError("Error al listar modelos: " + ((err as any)?.message || "desconocido"));
    } finally {
      setLoading(false);
    }
  };

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setMarkdown(await file.text());
      setStatus(`Archivo "${file.name}" cargado`);
      setError("");
    } catch {
      setError("No se pudo leer el archivo.");
    }
  };

  const generate = async () => {
    setError("");
    setStatus("");
    if (settings.preset !== "ollama" && !settings.apiKey.trim()) {
      setError("Introduce tu clave de API para continuar.");
      return;
    }
    if (!markdown.trim()) {
      setError("Pega o carga un Markdown primero.");
      return;
    }
    setLoading(true);
    try {
      setStatus("Generando diagrama…");
      const spec = await markdownToSkeleton(settings, markdown, instruction, setStatus);
      saveAiSettings(settings);

      const { convertToExcalidrawElements } = await import("@excalidraw/excalidraw");
      const elements = convertToExcalidrawElements(spec.elements as any, { regenerateIds: false }) as any[];
      if (!elements.length) throw new Error("No se pudieron crear los elementos del diagrama.");

      let targetX = 40;
      let targetY = 40;
      const appState = api?.getAppState() || {};
      if (target === "active") {
        const zoom = appState.zoom?.value ?? 1;
        targetX = 40 / zoom - (appState.scrollX ?? 0);
        targetY = 40 / zoom - (appState.scrollY ?? 0);
      }
      const minX = Math.min(...elements.map((e) => e.x));
      const minY = Math.min(...elements.map((e) => e.y));
      const placed = elements.map((e) => ({ ...e, x: e.x - minX + targetX, y: e.y - minY + targetY }));

      if (target === "new" || !api) {
        addTab({
          name: spec.title || "Diagrama IA",
          scene: { elements: placed, appState: { viewBackgroundColor: "#ffffff" }, files: {} },
        });
      } else {
        api.updateScene({ elements: [...(api.getSceneElements() || []), ...placed] });
      }
      setStatus(`Diagrama generado: ${placed.length} elementos`);
    } catch (err) {
      setError("Error: " + ((err as any)?.message || "desconocido"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <aside className="fixed right-0 top-0 z-50 flex h-full w-[430px] max-w-full flex-col border-l border-gray-200 bg-white shadow-2xl">
      <header className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <div>
          <div className="font-semibold text-blue-700">IA inversa</div>
          <div className="text-xs text-gray-500">Markdown → diagrama editable</div>
        </div>
        <button onClick={onClose} title="Cerrar" className="rounded px-2 py-1 text-gray-500 hover:bg-gray-100">✕</button>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        <section>
          <SectionTitle>1. Configuración IA (compartida)</SectionTitle>
          <select className={inputCls} value={settings.preset} onChange={(e) => applyPreset(e.target.value)}>
            {AI_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Modelo</label>
              <input className={`${inputCls} font-mono text-xs`} value={settings.model}
                onChange={(e) => setSettings((s) => ({ ...s, model: e.target.value }))} spellCheck={false} />
            </div>
            <div className="flex items-end">
              <button className={`${btnCls} w-full`} onClick={() => void loadModels()} disabled={loading}>Ver modelos</button>
            </div>
          </div>
          {models.length > 0 && (
            <select className={`${inputCls} mt-2 text-xs`} value={settings.model}
              onChange={(e) => setSettings((s) => ({ ...s, model: e.target.value }))}>
              {!models.includes(settings.model) && <option value={settings.model}>{settings.model}</option>}
              {models.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          )}
          <div className="mt-2">
            <label className={labelCls}>Clave de API</label>
            <input type="password" className={`${inputCls} font-mono text-xs`} value={settings.apiKey}
              onChange={(e) => setSettings((s) => ({ ...s, apiKey: e.target.value }))}
              placeholder={settings.preset === "ollama" ? "No necesaria" : "sk-… / AIza…"} spellCheck={false} />
          </div>
        </section>

        <section>
          <SectionTitle>2. Markdown de entrada</SectionTitle>
          <textarea
            className={`${inputCls} h-48 resize-y font-mono text-xs`}
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            placeholder="# Proceso&#10;1. Inicio&#10;2. Validar datos..."
          />
          <div className="mt-2 flex items-center gap-2">
            <button className={btnCls} onClick={() => fileRef.current?.click()}>Cargar .md</button>
            <input ref={fileRef} type="file" accept=".md,.markdown,.txt" className="hidden" onChange={(e) => void handleFile(e)} />
            <span className="text-[11px] text-gray-500">También puedes pegar el texto directamente.</span>
          </div>
        </section>

        <section>
          <SectionTitle>3. Generación</SectionTitle>
          <label className={labelCls}>Tipo de diagrama</label>
          <select className={inputCls} value={INSTRUCTIONS.find((i) => i.text === instruction)?.id ?? "flujo"}
            onChange={(e) => {
              const item = INSTRUCTIONS.find((i) => i.id === e.target.value);
              if (item) setInstruction(item.text);
            }}>
            {INSTRUCTIONS.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
          </select>
          <div className="mt-2">
            <label className={labelCls}>Insertar en</label>
            <select className={inputCls} value={target} onChange={(e) => setTarget(e.target.value as "new" | "active")}>
              <option value="new">Nueva pestaña</option>
              <option value="active">Pestaña activa</option>
            </select>
          </div>
          <button
            className="mt-3 w-full rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            onClick={() => void generate()}
            disabled={loading}
          >
            {loading ? "Generando…" : "Generar diagrama"}
          </button>
          {error && <p role="alert" className="mt-2 rounded bg-red-50 p-2 text-xs text-red-700">{error}</p>}
          {status && !error && <p className="mt-2 rounded bg-green-50 p-2 text-xs text-green-700">{status}</p>}
        </section>
      </div>
    </aside>
  );
}
