/* Prompt y validación para generar diagramas Excalidraw desde Markdown */

export type DiagramSkeleton = {
  id?: string;
  type: "rectangle" | "ellipse" | "diamond" | "text" | "arrow" | "line";
  x: number;
  y: number;
  width?: number;
  height?: number;
  label?: { text: string; fontSize?: number };
  start?: { id: string };
  end?: { id: string };
};

export type DiagramSpec = { title: string; elements: DiagramSkeleton[] };

export const DIAGRAM_SYSTEM_PROMPT = `Eres un asistente que convierte texto Markdown en un diagrama dibujable en Excalidraw.
Responde SOLO con un objeto JSON válido, sin cercos de código (\`\`\`) ni explicaciones, con esta forma exacta:
{
  "title": "Nombre corto del diagrama",
  "elements": [
    { "id": "n1", "type": "rectangle", "x": 80, "y": 80, "width": 180, "height": 70, "label": { "text": "Inicio" } },
    { "id": "n2", "type": "diamond", "x": 80, "y": 240, "width": 180, "height": 90, "label": { "text": "¿Válido?" } },
    { "id": "a1", "type": "arrow", "x": 170, "y": 150, "start": { "id": "n1" }, "end": { "id": "n2" }, "label": { "text": "Sí" } }
  ]
}

Reglas:
- Usa literalmente el texto del Markdown para las etiquetas; no inventes información.
- Tipos permitidos: rectangle, ellipse, diamond, text, arrow, line.
- Cada nodo necesita id único, x, y, width y height. Las flechas necesitan start.id y end.id que coincidan con ids de nodos existentes.
- Coloca los nodos en una rejilla: separación horizontal de 260 y vertical de 180. Usa coordenadas positivas.
- Máximo 80 elementos. Si el Markdown es largo, resume agrupando pasos.
- No incluyas colores, estilos, rotaciones ni ningún campo distinto a los mostrados.`;

const ALLOWED_TYPES = new Set(["rectangle", "ellipse", "diamond", "text", "arrow", "line"]);

const num = (v: any, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : fallback;
};

/** Extrae y valida el JSON devuelto por el modelo. */
export function parseDiagramSpec(text: string): DiagramSpec {
  let raw = (text || "").trim();
  raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  const first = raw.search(/[[{]/);
  const last = Math.max(raw.lastIndexOf("}"), raw.lastIndexOf("]"));
  if (first < 0 || last <= first) {
    throw new Error("El modelo no devolvió un diagrama en formato JSON.");
  }

  let parsed: any;
  try {
    parsed = JSON.parse(raw.slice(first, last + 1));
  } catch {
    throw new Error("El modelo devolvió un JSON no válido. Inténtalo de nuevo.");
  }

  const data = Array.isArray(parsed) ? { elements: parsed } : parsed;
  if (!Array.isArray(data?.elements)) {
    throw new Error("El modelo no devolvió la lista de elementos del diagrama.");
  }

  const elements: DiagramSkeleton[] = [];
  const seen = new Set<string>();

  for (const [index, item] of data.elements.entries()) {
    if (!item || !ALLOWED_TYPES.has(item.type)) continue;
    const x = num(item.x, 0);
    const y = num(item.y, 0);
    const id = typeof item.id === "string" && item.id.trim() ? item.id.trim() : `e${index}`;
    if (seen.has(id)) continue;
    seen.add(id);

    const el: DiagramSkeleton = { id, type: item.type, x, y };
    if (item.type !== "arrow" && item.type !== "line" && item.type !== "text") {
      el.width = Math.max(40, num(item.width, 180));
      el.height = Math.max(30, num(item.height, 70));
    }
    const labelText = typeof item.label?.text === "string" ? item.label.text.slice(0, 200) : "";
    if (labelText) el.label = { text: labelText, fontSize: Math.max(10, Math.min(28, num(item.label?.fontSize, 16))) };
    if (item.type === "arrow" || item.type === "line") {
      if (typeof item.start?.id !== "string" || typeof item.end?.id !== "string") continue;
      el.start = { id: item.start.id };
      el.end = { id: item.end.id };
    }
    elements.push(el);
    if (elements.length >= 100) break;
  }

  // Descarta flechas cuyos extremos no existen para no generar uniones rotas.
  const ids = new Set(elements.map((e) => e.id));
  const valid = elements.filter((e) => !e.start || (ids.has(e.start.id) && ids.has(e.end!.id)));
  if (!valid.length) throw new Error("El modelo no generó elementos válidos para el diagrama.");

  const title = typeof data.title === "string" ? data.title.slice(0, 80) : "Diagrama IA";
  return { title, elements: valid };
}
