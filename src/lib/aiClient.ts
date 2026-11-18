/* Cliente compatible con la API de chat de OpenAI (Gemini, OpenAI, OpenRouter, Ollama…) */

import type { AiScene } from "./aiScene";

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
    model: "gemini-2.5-flash",
    keyUrl: "https://aistudio.google.com/app/apikey",
    hint: "Clave gratuita en Google AI Studio. Modelos con visión: Gemini Flash.",
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

function authHeaders(settings: AiSettings): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (settings.apiKey.trim()) headers.Authorization = `Bearer ${settings.apiKey.trim()}`;
  return headers;
}

async function readError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return data?.error?.message || data?.message || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

/** Lista los modelos disponibles en el endpoint configurado */
export async function fetchModels(settings: AiSettings): Promise<string[]> {
  const res = await fetch(`${normalizeEndpoint(settings.endpoint)}/models`, {
    headers: authHeaders(settings),
  });
  if (!res.ok) throw new Error(await readError(res));
  const data = await res.json();
  const ids = Array.isArray(data?.data) ? data.data.map((m: any) => m?.id).filter(Boolean) : [];
  if (!ids.length) throw new Error("El endpoint no devolvió modelos");
  return ids.map(String);
}

/** Envía los lienzos al modelo y devuelve el texto interpretado */
export async function interpretDrawing(
  settings: AiSettings,
  scenes: AiScene[],
  prompt: string,
): Promise<string> {
  if (!settings.endpoint.trim()) throw new Error("Falta la URL del endpoint");
  if (!settings.model.trim()) throw new Error("Falta el nombre del modelo");

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

  const res = await fetch(`${normalizeEndpoint(settings.endpoint)}/chat/completions`, {
    method: "POST",
    headers: authHeaders(settings),
    body: JSON.stringify({
      model: settings.model.trim(),
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: parts },
      ],
      temperature: 0.2,
    }),
  });

  if (!res.ok) throw new Error(await readError(res));
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const text = content
      .filter((p: any) => p?.type === "text" && typeof p.text === "string")
      .map((p: any) => p.text)
      .join("\n");
    if (text) return text;
  }
  throw new Error("El modelo no devolvió texto");
}
