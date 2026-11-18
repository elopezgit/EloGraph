/* Cliente compatible con la API de chat de OpenAI (Gemini, OpenAI, OpenRouter, Ollama…) */

import type { AiScene } from "./aiScene";
import { DIAGRAM_SYSTEM_PROMPT, parseDiagramSpec, type DiagramSpec } from "./diagramSkeleton";

export type AiSettings = {
  preset: string;
  endpoint: string;
  model: string;
  apiKey: string;
};

export type AiPreset = {
  id: string;
  name: string;
  endpoint: string;
  model: string;
  keyUrl?: string;
  hint: string;
};

export const AI_PRESETS: AiPreset[] = [
  {
    id: "gemini",
    name: "Google Gemini",
    endpoint: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-3.5-flash-lite",
    keyUrl: "https://aistudio.google.com/app/apikey",
    hint: "Clave gratuita en Google AI Studio. Usa un modelo Flash/Pro con visión; los modelos Live, TTS o de imagen no sirven aquí.",
  },
  {
    id: "openai",
    name: "OpenAI",
    endpoint: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    keyUrl: "https://platform.openai.com/api-keys",
    hint: "Requiere cuenta con saldo. Recomendado: gpt-4o-mini.",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    endpoint: "https://openrouter.ai/api/v1",
    model: "openai/gpt-4o-mini",
    keyUrl: "https://openrouter.ai/keys",
    hint: "Unión de muchos modelos; hay opciones gratuitas con visión.",
  },
  {
    id: "ollama",
    name: "Ollama (local)",
    endpoint: "http://localhost:11434/v1",
    model: "qwen2.5vl:7b",
    hint: "Sin clave ni coste. Necesitas Ollama corriendo con un modelo de visión.",
  },
];

export const PROMPT_PRESETS = [
  {
    id: "proceso",
    label: "Descripción de proceso",
    text: "Describe el proceso representado en el dibujo, respetando el orden de las flechas.",
  },
  {
    id: "pasos",
    label: "Pasos numerados",
    text: "Extrae únicamente los pasos del proceso, numerados en orden de ejecución.",
  },
  {
    id: "pseudocodigo",
    label: "Pseudocódigo",
    text: "Convierte el diagrama en pseudocódigo claro, usando las condiciones de las decisiones.",
  },
  {
    id: "entidades",
    label: "Entidades y relaciones",
    text: "Extrae las entidades, sus atributos y las relaciones entre ellas.",
  },
];

const SYSTEM_PROMPT = `Eres un analista de sistemas que interpreta diagramas dibujados a mano o en Excalidraw.
Responde siempre en español. Usa literalmente el texto de las etiquetas del dibujo; no inventes información que no aparezca.
Si algo resulta ambiguo, explícalo en la sección de Observaciones en lugar de suponerlo.
Devuelve Markdown con exactamente estas secciones, en este orden:

## Resumen
Un párrafo breve con el propósito del diagrama.

## Pasos del proceso
1. Primer paso
2. Segundo paso
...

## Actores
- Actor o participante

## Decisiones y condiciones
- Condición y ramas resultantes

## Observaciones
- Puntos dudosos o detalles relevantes`;

function normalizeEndpoint(endpoint: string): string {
  return endpoint.trim().replace(/\/+$/, "");
}

/** Acepta IDs con o sin el prefijo "models/" que devuelve el catálogo de Google */
function normalizeModel(model: string): string {
  return model.trim().replace(/^models\//, "");
}

/** Modelos que aparecen en /models pero no funcionan con /chat/completions */
const NON_CHAT_MODEL = /(-live|-tts|-image|embedding|imagen|veo|transcribe|-audio)/i;

const RETRY_DELAYS_MS = [1000, 2000, 4000];
const GEMINI_FALLBACK_MODELS = ["gemini-3.5-flash-lite", "gemini-3.6-flash"];

type ApiError = Error & { status?: number };

function apiError(message: string, status: number): ApiError {
  const error = new Error(message) as ApiError;
  error.status = status;
  return error;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function authHeaders(settings: AiSettings): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (settings.apiKey.trim()) headers.Authorization = `Bearer ${settings.apiKey.trim()}`;
  return headers;
}

async function readError(res: Response): Promise<string> {
  let text = "";
  try {
    text = (await res.text()).trim();
  } catch {
    return `HTTP ${res.status}`;
  }
  if (text) {
    try {
      const data = JSON.parse(text);
      const message = data?.error?.message || data?.message;
      if (typeof message === "string" && message.trim()) return message.trim();
    } catch {
      // la respuesta no es JSON: se muestra tal cual, acortada
    }
    return `HTTP ${res.status}: ${text.slice(0, 300)}`;
  }
  return `HTTP ${res.status}`;
}

/** Lista los modelos disponibles en el endpoint configurado */
export async function fetchModels(settings: AiSettings): Promise<string[]> {
  const res = await fetch(`${normalizeEndpoint(settings.endpoint)}/models`, {
    headers: authHeaders(settings),
  });
  if (!res.ok) throw new Error(await readError(res));
  const data = await res.json();
  const ids = Array.isArray(data?.data)
    ? data.data
        .map((m: any) => (typeof m?.id === "string" ? normalizeModel(m.id) : ""))
        .filter((id: string) => id && !NON_CHAT_MODEL.test(id))
    : [];
  if (!ids.length) throw new Error("El endpoint no devolvió modelos compatibles con chat");
  return ids;
}

function extractContent(data: any): string {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === "string" && content.trim()) return content;
  if (Array.isArray(content)) {
    const text = content
      .filter((p: any) => p?.type === "text" && typeof p.text === "string")
      .map((p: any) => p.text)
      .join("\n");
    if (text) return text;
  }
  throw new Error("El modelo no devolvió texto");
}

async function requestText(
  settings: AiSettings,
  model: string,
  parts: any[],
  onStatus?: (message: string) => void,
  systemPrompt: string = SYSTEM_PROMPT,
): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${normalizeEndpoint(settings.endpoint)}/chat/completions`, {
        method: "POST",
        headers: authHeaders(settings),
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: parts },
          ],
          temperature: 0.2,
        }),
      });
    } catch (err) {
      throw apiError("No se pudo conectar con el proveedor: " + ((err as any)?.message || String(err)), 0);
    }

    if (res.ok) return extractContent(await res.json());

    const detail = await readError(res);
    if ((res.status === 429 || res.status === 503) && attempt < RETRY_DELAYS_MS.length) {
      onStatus?.(`Servidor saturado, reintentando (${attempt + 1}/${RETRY_DELAYS_MS.length})…`);
      await wait(RETRY_DELAYS_MS[attempt]);
      continue;
    }
    if (res.status === 404) {
      throw apiError(
        `Modelo o endpoint no encontrado (404): ${detail}. Comprueba el modelo (por ejemplo gemini-3.5-flash-lite) y la URL base.`,
        404,
      );
    }
    throw apiError(detail, res.status);
  }
}

/** Envía los lienzos al modelo y devuelve el texto interpretado */
export async function interpretDrawing(
  settings: AiSettings,
  scenes: AiScene[],
  prompt: string,
  onStatus?: (message: string) => void,
): Promise<string> {
  if (!settings.endpoint.trim()) throw new Error("Falta la URL del endpoint");
  const model = normalizeModel(settings.model);
  if (!model) throw new Error("Falta el nombre del modelo");

  const parts: any[] = [
    {
      type: "text",
      text: `${prompt.trim() || "Interpreta el diagrama."}\n\nAnaliza la imagen y la descripción estructurada de cada lienzo.`,
    },
  ];

  for (const scene of scenes) {
    parts.push({
      type: "text",
      text: `\n--- Lienzo: ${scene.tab} ---\nElementos y conexiones (JSON):\n${JSON.stringify(
        { nodos: scene.nodes, flechas: scene.arrows },
        null,
        2,
      )}`,
    });
    parts.push({
      type: "image_url",
      image_url: { url: `data:image/png;base64,${scene.image}` },
    });
  }

  const candidates =
    settings.preset === "gemini"
      ? [model, ...GEMINI_FALLBACK_MODELS.filter((m) => m !== model)]
      : [model];

  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      return await requestText(settings, candidate, parts, onStatus);
    } catch (err) {
      const status = (err as ApiError)?.status;
      if (candidate !== model || (status !== 429 && status !== 503)) throw err;
      lastError = err;
      onStatus?.("Modelo saturado, probando un modelo alternativo…");
    }
  }
  throw lastError;
}

/** Convierte Markdown en una definición de diagrama (camino inverso del asistente IA) */
export async function markdownToSkeleton(
  settings: AiSettings,
  markdown: string,
  instruction: string,
  onStatus?: (message: string) => void,
): Promise<DiagramSpec> {
  if (!markdown.trim()) throw new Error("Pega o carga un Markdown para generar el diagrama.");
  if (!settings.endpoint.trim()) throw new Error("Falta la URL del endpoint");
  const model = normalizeModel(settings.model);
  if (!model) throw new Error("Falta el nombre del modelo");

  const parts = [
    {
      type: "text",
      text: `Instrucción: ${instruction.trim() || "Genera el diagrama descrito."}\n\nMarkdown de entrada:\n${markdown.slice(0, 60000)}`,
    },
  ];
  const text = await requestText(settings, model, parts, onStatus, DIAGRAM_SYSTEM_PROMPT);
  return parseDiagramSpec(text);
}
