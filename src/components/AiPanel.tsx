import { useEffect, useState, type ReactNode } from "react";
import { useDocumentStore } from "../store/useDocumentStore";
import { AI_PRESETS, PROMPT_PRESETS, fetchModels, interpretDrawing, type AiSettings } from "../lib/aiClient";
import { buildAiScenes } from "../lib/aiScene";

const STORAGE_KEY = "elograph.ai.settings.v1";

const DEFAULT_SETTINGS: AiSettings = {
  preset: AI_PRESETS[0].id,
  endpoint: AI_PRESETS[0].endpoint,
  model: AI_PRESETS[0].model,
  apiKey: "",
};

/** Modelos antiguos o no compatibles con /chat/completions que se migran al modelo por defecto */
const OBSOLETE_MODEL = /(-live|-tts|-image|embedding|imagen|veo|transcribe|-audio|^gemini-2\.5-)/i;

function loadSettings(): AiSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } as AiSettings;
      if (saved.preset === "gemini") {
        const model = saved.model.trim().replace(/^models\//, "");
        saved.model = !model || OBSOLETE_MODEL.test(model) ? DEFAULT_SETTINGS.model : model;
      }
      return saved;
    }
  } catch {
    // configuración anterior no válida: se ignoran
  }
  return DEFAULT_SETTINGS;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function errorMessage(err: unknown): string {
  return (err as any)?.message || "Error desconocido";
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{children}</h3>;
}

export function AiPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const project = useDocumentStore((s) => s.project);
  const excalidrawApis = useDocumentStore((s) => s.excalidrawApis);
  const getActiveTab = useDocumentStore((s) => s.getActiveTab);
  const activeTab = getActiveTab();
  const api = activeTab ? excalidrawApis[activeTab.id] : null;

  const [settings, setSettings] = useState<AiSettings>(loadSettings);
  const [scope, setScope] = useState<"active" | "all">("active");
  const [promptId, setPromptId] = useState(PROMPT_PRESETS[0].id);
  const [prompt, setPrompt] = useState(PROMPT_PRESETS[0].text);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState<string[]>([]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // almacenamiento no disponible: la configuración solo dura la sesión
    }
  }, [settings]);

  const inputCls =
    "w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none";
  const labelCls = "mb-1 block text-xs font-medium text-gray-600";
  const btnCls = "rounded border border-gray-300 px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50";

  const applyPreset = (id: string) => {
    const preset = AI_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setSettings((s) => ({ ...s, preset: id, endpoint: preset.endpoint, model: preset.model }));
    setModels([]);
    setStatus("");
  };

  const handleLoadModels = async () => {
    setStatus("");
    setLoading(true);
    try {
      const list = await fetchModels(settings);
      setModels(list);
      setStatus(`Modelos disponibles: ${list.length}`);
    } catch (err) {
      setStatus("Error al listar modelos: " + errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    setError("");
    setResult("");
    setStatus("");
    if (settings.preset !== "ollama" && !settings.apiKey.trim()) {
      setError("Introduce tu clave de API para continuar.");
      return;
    }
    const tabs =
      scope === "active"
        ? activeTab
          ? [{ name: activeTab.name, scene: activeTab.scene }]
          : []
        : project.tabs.map((t) => ({ name: t.name, scene: t.scene }));
    if (!tabs.length) {
      setError("No hay ningún lienzo disponible.");
      return;
    }
    setLoading(true);
    try {
      let scenes: Awaited<ReturnType<typeof buildAiScenes>>;
      try {
        scenes = await buildAiScenes(tabs);
      } catch (err) {
        throw new Error("No se pudo generar la imagen del dibujo: " + errorMessage(err));
      }
      const text = await interpretDrawing(settings, scenes, prompt, setStatus);
      setResult(text);
      setStatus("Análisis completado");
    } catch (err) {
      setError("Error: " + errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(result);
      setStatus("Resultado copiado al portapapeles");
      setError("");
    } catch {
      setError("No se pudo copiar el resultado");
    }
  };

  const handleInsert = () => {
    if (!api) {
      setError("Canvas no disponible");
      return;
    }
    try {
      const appState = api.getAppState() || {};
      const zoom = appState.zoom?.value ?? 1;
      const lines = result.split("\n").length;
      const el = {
        id: uid(),
        type: "text",
        x: 40 / zoom - (appState.scrollX ?? 0),
        y: 40 / zoom - (appState.scrollY ?? 0),
        width: 500,
        height: Math.max(40, lines * 20),
        angle: 0,
        strokeColor: "#1e1e1e",
        backgroundColor: "transparent",
        fillStyle: "solid",
        strokeWidth: 1,
        strokeStyle: "solid",
        roughness: 0,
        opacity: 100,
        groupIds: [],
        frameId: null,
        roundness: null,
        seed: Math.floor(Math.random() * 100000),
        version: 1,
        versionNonce: Math.floor(Math.random() * 100000),
        isDeleted: false,
        boundElements: null,
        updated: Date.now(),
        link: null,
        locked: false,
        text: result,
        fontSize: 14,
        fontFamily: 1,
        textAlign: "left",
        verticalAlign: "top",
        autoResize: true,
        lineHeight: 1.25,
      };
      api.updateScene({
        elements: [...(api.getSceneElements() || []), el],
        appState: { ...appState, selectedElementIds: { [el.id]: true } },
      });
      setStatus("Texto insertado en el lienzo");
      setError("");
    } catch (err) {
      setError("Error al insertar: " + errorMessage(err));
    }
  };

  const handleDownload = () => {
    const blob = new Blob([result], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.meta.title || "diagrama"}-analisis.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!open) return null;

  const preset = AI_PRESETS.find((p) => p.id === settings.preset);

  return (
    <aside className="fixed right-0 top-0 z-50 flex h-full w-[430px] max-w-full flex-col border-l border-gray-200 bg-white shadow-2xl">
      <header className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <div>
          <div className="font-semibold text-blue-700">Asistente IA</div>
          <div className="text-xs text-gray-500">Convierte tu dibujo en texto</div>
        </div>
        <button onClick={onClose} title="Cerrar" className="rounded px-2 py-1 text-gray-500 hover:bg-gray-100">
          ✕
        </button>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        <section>
          <SectionTitle>1. Proveedor</SectionTitle>
          <select
            className={inputCls}
            value={settings.preset}
            onChange={(e) => applyPreset(e.target.value)}
          >
            {AI_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {preset && <p className="mt-1 text-[11px] leading-snug text-gray-500">{preset.hint}</p>}
          <div className="mt-3">
            <label className={labelCls}>URL base del endpoint</label>
            <input
              className={`${inputCls} font-mono text-xs`}
              value={settings.endpoint}
              onChange={(e) => setSettings((s) => ({ ...s, endpoint: e.target.value }))}
              spellCheck={false}
            />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Modelo</label>
              <input
                className={`${inputCls} font-mono text-xs`}
                value={settings.model}
                onChange={(e) => setSettings((s) => ({ ...s, model: e.target.value }))}
                spellCheck={false}
              />
            </div>
            <div className="flex items-end">
              <button className={`${btnCls} w-full`} onClick={() => void handleLoadModels()} disabled={loading}>
                Ver modelos
              </button>
            </div>
          </div>
          {models.length > 0 && (
            <select
              className={`${inputCls} mt-2 text-xs`}
              value={settings.model}
              onChange={(e) => setSettings((s) => ({ ...s, model: e.target.value }))}
            >
              {!models.includes(settings.model) && <option value={settings.model}>{settings.model}</option>}
              {models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          )}
          <div className="mt-2">
            <label className={labelCls}>Clave de API</label>
            <input
              type="password"
              className={`${inputCls} font-mono text-xs`}
              value={settings.apiKey}
              onChange={(e) => setSettings((s) => ({ ...s, apiKey: e.target.value }))}
              placeholder={settings.preset === "ollama" ? "No necesaria" : "sk-… / AIza…"}
              spellCheck={false}
            />
            <p className="mt-1 text-[11px] leading-snug text-amber-700">
              La clave se guarda únicamente en este navegador (localStorage). No la uses en un equipo compartido.
            </p>
            {preset?.keyUrl && (
              <a className="mt-1 inline-block text-xs text-blue-600 underline" href={preset.keyUrl} target="_blank" rel="noreferrer">
                Obtener clave
              </a>
            )}
          </div>
        </section>

        <section>
          <SectionTitle>2. Alcance</SectionTitle>
          <select
            className={inputCls}
            value={scope}
            onChange={(e) => setScope(e.target.value as "active" | "all")}
          >
            <option value="active">Pestaña activa ({activeTab?.name ?? "—"})</option>
            <option value="all">Todo el proyecto ({project.tabs.length} pestañas)</option>
          </select>
        </section>

        <section>
          <SectionTitle>3. Instrucción</SectionTitle>
          <select
            className={inputCls}
            value={promptId}
            onChange={(e) => {
              setPromptId(e.target.value);
              const p = PROMPT_PRESETS.find((x) => x.id === e.target.value);
              if (p) setPrompt(p.text);
            }}
          >
            {PROMPT_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <textarea
            className={`${inputCls} mt-2 h-20 resize-y text-xs`}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="¿Qué quieres que haga con el dibujo?"
          />
        </section>

        <button
          className="w-full rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          onClick={() => void handleAnalyze()}
          disabled={loading}
        >
          {loading ? "Analizando…" : "Analizar dibujo"}
        </button>

        {error && <p className="rounded bg-red-50 p-2 text-xs text-red-700">{error}</p>}
        {status && !error && <p className="rounded bg-green-50 p-2 text-xs text-green-700">{status}</p>}

        <section>
          <SectionTitle>4. Resultado</SectionTitle>
          <div className="min-h-[180px] whitespace-pre-wrap rounded border border-gray-200 bg-gray-50 p-3 font-mono text-xs leading-relaxed text-gray-800">
            {result || <span className="text-gray-400">El texto aparecerá aquí…</span>}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button className={btnCls} onClick={() => void handleCopy()} disabled={!result}>
              Copiar
            </button>
            <button className={btnCls} onClick={handleInsert} disabled={!result}>
              Insertar en el lienzo
            </button>
            <button className={btnCls} onClick={handleDownload} disabled={!result}>
              Descargar .md
            </button>
          </div>
        </section>
      </div>
    </aside>
  );
}
