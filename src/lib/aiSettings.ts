/* Configuración de IA compartida por el panel de análisis y el panel inverso */

import { AI_PRESETS, type AiSettings } from "./aiClient";

const STORAGE_KEY = "elograph.ai.settings.v1";

export const DEFAULT_AI_SETTINGS: AiSettings = {
  preset: AI_PRESETS[0].id,
  endpoint: AI_PRESETS[0].endpoint,
  model: AI_PRESETS[0].model,
  apiKey: "",
};

/** Modelos antiguos o no compatibles con /chat/completions que se migran al modelo por defecto */
const OBSOLETE_MODEL = /(-live|-tts|-image|embedding|imagen|veo|transcribe|-audio|^gemini-2\.5-)/i;

export function loadAiSettings(): AiSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = { ...DEFAULT_AI_SETTINGS, ...JSON.parse(raw) } as AiSettings;
      if (saved.preset === "gemini") {
        const model = saved.model.trim().replace(/^models\//, "");
        saved.model = !model || OBSOLETE_MODEL.test(model) ? DEFAULT_AI_SETTINGS.model : model;
      }
      return saved;
    }
  } catch {
    // configuración anterior no válida: se ignoran
  }
  return DEFAULT_AI_SETTINGS;
}

export function saveAiSettings(settings: AiSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // almacenamiento no disponible: la configuración solo dura la sesión
  }
}
