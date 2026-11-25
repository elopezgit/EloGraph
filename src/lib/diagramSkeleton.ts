/* Prompt y validación para generar diagramas Excalidraw desde Markdown */

export type DiagramShapeType = "rectangle" | "ellipse" | "diamond" | "text" | "arrow" | "line";

/** Referencia a un elemento: por id (preferido) o por su etiqueta visible. */
export type DiagramRef = { id?: string; label?: string };

/** Estilos admitidos por el esqueleto de Excalidraw. */
export type DiagramStyle = {
  backgroundColor?: string;
  strokeColor?: string;
  fillStyle?: "solid" | "hachure" | "cross-hatch" | "zigzag" | "dots" | "dashed" | "zigzag-line";
  strokeStyle?: "solid" | "dashed" | "dotted";
  strokeWidth?: 1 | 2 | 4;
  roughness?: 0 | 1 | 2;
  opacity?: number;
};

export type DiagramLabel = {
  text: string;
  fontSize?: number;
  fontFamily?: number;
  textAlign?: "left" | "center" | "right";
  verticalAlign?: "top" | "middle" | "bottom";
  strokeColor?: string;
};

export type DiagramSkeleton = DiagramStyle & {
  id?: string;
  type: DiagramShapeType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  label?: DiagramLabel;
  start?: DiagramRef;
  end?: DiagramRef;
  startArrowhead?: string | null;
  endArrowhead?: string | null;
};

export type DiagramSpec = { title: string; elements: DiagramSkeleton[] };

/** Operaciones de la sesión de edición (IA inversa). */
export type DiagramOperation =
  | { op: "add"; element: DiagramSkeleton }
  | { op: "update"; target: DiagramRef; patch: Partial<DiagramSkeleton> }
  | { op: "delete"; target: DiagramRef }
  | {
      op: "connect";
      from: DiagramRef;
      to: DiagramRef;
      label?: DiagramLabel;
      style?: DiagramStyle;
      startArrowhead?: string | null;
      endArrowhead?: string | null;
    };

export type DiagramLayoutSpec = {
  type: "columns" | "grid" | "swimlanes" | "flow";
  scope?: "new" | "all";
  columns?: number;
  rows?: number;
  spacing?: number;
  laneLabels?: string[];
};

export type DiagramEdit = {
  reply: string;
  operations: DiagramOperation[];
  layout?: DiagramLayoutSpec;
};

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

/* -------------------------------------------------------------------------- */
/* Sesión de edición (IA inversa). El código anterior se conserva sin cambios.  */
/* -------------------------------------------------------------------------- */

export const DIAGRAM_EDITOR_SYSTEM_PROMPT = `Eres un editor de diagramas Excalidraw que trabaja en una sesión por texto.
Responde SOLO con un objeto JSON válido, sin cercos de código (\`\`\`) ni explicaciones fuera del JSON.

Formato exacto:
{
  "reply": "Frase corta en español que confirma qué has hecho.",
  "operations": [
    { "op": "add", "element": { "id": "n3", "type": "ellipse", "x": 0, "y": 0, "width": 160, "height": 90, "backgroundColor": "#ffd8a8", "strokeColor": "#e03131", "fillStyle": "solid", "label": { "text": "Validar" } } },
    { "op": "update", "target": { "id": "n1" }, "patch": { "backgroundColor": "#1971c2", "strokeColor": "azul", "fontSize": 18 } },
    { "op": "delete", "target": { "label": "Fin" } },
    { "op": "connect", "from": { "id": "n2" }, "to": { "label": "Inicio" }, "label": { "text": "Repetir" }, "style": { "strokeStyle": "dashed" }, "endArrowhead": "arrow" }
  ],
  "layout": { "type": "columns", "scope": "new", "columns": 3, "spacing": 50, "laneLabels": ["Ventas", "Compras", "Stock"] }
}

Reglas:
- Recibes el historial de la sesión, el estado actual del lienzo en JSON (con ids, etiquetas, posiciones y estilos) y la última instrucción del usuario. El JSON del lienzo es la verdad: no asumas que el dibujo está vacío.
- Para MODIFICAR o BORRAR usa el "id" del lienzo. Si no sabes el id, usa "label" con el texto exacto de la etiqueta. Nunca inventes ids.
- Para CONECTAR usa "connect" con "from" y "to" (id o label). Los ids pueden ser de elementos ya existentes o de elementos nuevos creados en esta misma respuesta.
- Tipos: rectangle, ellipse, diamond, text, arrow, line. "ellipse" es el círculo/óvalo.
- Estilos disponibles en "add", "patch" y "style": backgroundColor, strokeColor, fillStyle (solid, hachure, cross-hatch, zigzag, dots, dashed), strokeStyle (solid, dashed, dotted), strokeWidth (1, 2, 4), roughness (0, 1, 2), opacity (10-100). En "label": text, fontSize, fontFamily, textAlign, verticalAlign, strokeColor.
- Colores: usa hexadecimal (#rrggbb) o nombres comunes en español o inglés (rojo/red, azul/blue, verde/green, amarillo/yellow, naranja/orange, morado/purple, rosa/pink, negro/black, blanco/white, gris/gray, cyan, transparent).
- Cuando el usuario pida columnas, calles, cuadrícula, carriles o flujo, DECLARA "layout" con type "columns", "grid", "swimlanes" o "flow". La aplicación calculará las coordenadas: pon x=0, y=0 en los elementos nuevos y NO intentes alinearlos a mano. "scope": "new" coloca solo los elementos nuevos; "scope": "all" reorganiza todo el lienzo.
- Usa literalmente el texto que escriba el usuario para las etiquetas; no añadas texto que no haya pedido.
- No vuelvas a crear elementos que ya existen salvo que el usuario lo pida explícitamente.
- Máximo 150 operaciones. Si algo no se puede hacer, explícalo en "reply" en lugar de inventar operaciones.`;

const NAME_MAP: Record<string, string> = {
  rojo: "#e03131", red: "#e03131",
  azul: "#1971c2", blue: "#1971c2",
  verde: "#2f9e44", green: "#2f9e44",
  amarillo: "#fcc419", yellow: "#fcc419",
  naranja: "#f76707", orange: "#f76707",
  morado: "#7048e8", purpura: "#7048e8", purple: "#7048e8",
  rosa: "#e64980", pink: "#e64980",
  negro: "#1e1e1e", black: "#1e1e1e",
  blanco: "#ffffff", white: "#ffffff",
  gris: "#868e96", gray: "#868e96", grey: "#868e96",
  cyan: "#1098ad", turquesa: "#1098ad",
  marron: "#8f5b36", brown: "#8f5b36",
};

const FILL_STYLES = new Set(["solid", "hachure", "cross-hatch", "zigzag", "dots", "dashed", "zigzag-line"]);
const STROKE_STYLES = new Set(["solid", "dashed", "dotted"]);
const ARROWHEADS = new Set(["arrow", "bar", "dot", "circle", "triangle", "diamond", "crowfoot_one", "crowfoot_many", "crowfoot_one_or_many"]);
const LAYOUT_TYPES = new Set(["columns", "grid", "swimlanes", "flow"]);

const normalizeWord = (value: string): string =>
  value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function cleanColor(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const raw = value.trim();
  if (!raw) return undefined;
  if (/^(transparent|none)$/i.test(raw)) return "transparent";
  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(raw)) return raw;
  return NAME_MAP[normalizeWord(raw)];
}

function cleanNum(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
}

function cleanStyle(item: any): DiagramStyle {
  const style: DiagramStyle = {};
  const bg = cleanColor(item?.backgroundColor);
  const stroke = cleanColor(item?.strokeColor);
  if (bg) style.backgroundColor = bg;
  if (stroke) style.strokeColor = stroke;
  if (FILL_STYLES.has(item?.fillStyle)) style.fillStyle = item.fillStyle;
  if (STROKE_STYLES.has(item?.strokeStyle)) style.strokeStyle = item.strokeStyle;
  if ([1, 2, 4].includes(Number(item?.strokeWidth))) style.strokeWidth = Number(item.strokeWidth) as 1 | 2 | 4;
  if ([0, 1, 2].includes(Number(item?.roughness))) style.roughness = Number(item.roughness) as 0 | 1 | 2;
  if (item?.opacity !== undefined) style.opacity = cleanNum(item.opacity, 100, 10, 100);
  return style;
}

function cleanLabel(value: any): DiagramLabel | undefined {
  const text = typeof value?.text === "string" ? value.text.trim().slice(0, 500) : "";
  if (!text) return undefined;
  const label: DiagramLabel = { text };
  if (value.fontSize !== undefined) label.fontSize = cleanNum(value.fontSize, 16, 10, 64);
  if ([1, 2, 3, 4, 5, 6, 7, 8].includes(Number(value.fontFamily))) label.fontFamily = Number(value.fontFamily);
  if (["left", "center", "right"].includes(value.textAlign)) label.textAlign = value.textAlign;
  if (["top", "middle", "bottom"].includes(value.verticalAlign)) label.verticalAlign = value.verticalAlign;
  const stroke = cleanColor(value.strokeColor);
  if (stroke && stroke !== "transparent") label.strokeColor = stroke;
  return label;
}

function labelSource(item: any): any {
  if (item?.label && typeof item.label === "object") return item.label;
  if (item?.label !== undefined || item?.text !== undefined) {
    return { text: typeof item.label === "string" ? item.label : item.text };
  }
  return undefined;
}

function cleanRef(value: any): DiagramRef | undefined {
  if (typeof value === "string" && value.trim()) return { id: value.trim() };
  if (!value || typeof value !== "object") return undefined;
  const id = typeof value.id === "string" && value.id.trim() ? value.id.trim() : undefined;
  const label = typeof value.label === "string" && value.label.trim() ? value.label.trim().slice(0, 200) : undefined;
  return id || label ? { id, label } : undefined;
}

function cleanArrowhead(value: any): string | null | undefined {
  if (value === null || value === "none") return null;
  if (typeof value === "string" && ARROWHEADS.has(value)) return value;
  return undefined;
}

function cleanSkeleton(item: any, index: number, usedIds: Set<string>): DiagramSkeleton | null {
  if (!item || !ALLOWED_TYPES.has(item.type)) return null;
  const rawId = typeof item.id === "string" ? item.id.trim() : "";
  const id = rawId && !usedIds.has(rawId) ? rawId : `ai${index}_${Math.random().toString(36).slice(2, 8)}`;
  usedIds.add(id);

  const element: DiagramSkeleton = {
    id,
    type: item.type,
    x: cleanNum(item.x, 0, -100000, 100000),
    y: cleanNum(item.y, 0, -100000, 100000),
    ...cleanStyle(item),
  };
  if (item.type !== "arrow" && item.type !== "line" && item.type !== "text") {
    element.width = cleanNum(item.width, 180, 20, 2000);
    element.height = cleanNum(item.height, 70, 20, 2000);
  } else if (item.width !== undefined || item.height !== undefined) {
    element.width = cleanNum(item.width, 120, 1, 4000);
    element.height = cleanNum(item.height, 0, 0, 4000);
  }
  const label = cleanLabel(labelSource(item));
  if (label) element.label = label;
  const start = cleanRef(item.start ?? item.from);
  const end = cleanRef(item.end ?? item.to);
  if (start) element.start = start;
  if (end) element.end = end;
  const startArrowhead = cleanArrowhead(item.startArrowhead);
  const endArrowhead = cleanArrowhead(item.endArrowhead);
  if (startArrowhead !== undefined) element.startArrowhead = startArrowhead;
  if (endArrowhead !== undefined) element.endArrowhead = endArrowhead;
  return element;
}

function cleanPatch(value: any): Partial<DiagramSkeleton> {
  const patch: Partial<DiagramSkeleton> = cleanStyle(value);
  if (value?.x !== undefined) patch.x = cleanNum(value.x, 0, -100000, 100000);
  if (value?.y !== undefined) patch.y = cleanNum(value.y, 0, -100000, 100000);
  if (value?.width !== undefined) patch.width = cleanNum(value.width, 180, 20, 4000);
  if (value?.height !== undefined) patch.height = cleanNum(value.height, 70, 20, 4000);
  if (value?.type && ALLOWED_TYPES.has(value.type)) patch.type = value.type;
  const label = cleanLabel(labelSource(value));
  if (label) patch.label = label;
  const startArrowhead = cleanArrowhead(value?.startArrowhead);
  const endArrowhead = cleanArrowhead(value?.endArrowhead);
  if (startArrowhead !== undefined) patch.startArrowhead = startArrowhead;
  if (endArrowhead !== undefined) patch.endArrowhead = endArrowhead;
  return patch;
}

function cleanLayout(value: any): DiagramLayoutSpec | undefined {
  if (!value || typeof value !== "object" || !LAYOUT_TYPES.has(value.type)) return undefined;
  const layout: DiagramLayoutSpec = { type: value.type, scope: value.scope === "all" ? "all" : "new" };
  if (value.columns !== undefined) layout.columns = cleanNum(value.columns, 3, 1, 12);
  if (value.rows !== undefined) layout.rows = cleanNum(value.rows, 2, 1, 12);
  if (value.spacing !== undefined) layout.spacing = cleanNum(value.spacing, 40, 0, 400);
  if (Array.isArray(value.laneLabels)) {
    layout.laneLabels = value.laneLabels
      .filter((s: unknown): s is string => typeof s === "string" && !!s.trim())
      .map((s: string) => s.trim().slice(0, 80))
      .slice(0, 12);
  }
  return layout;
}

/** Parsea la respuesta del editor de sesión. Acepta también el formato clásico como respaldo. */
export function parseDiagramEdit(text: string): DiagramEdit {
  let raw = (text || "").trim();
  raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  const first = raw.search(/[[{]/);
  const last = Math.max(raw.lastIndexOf("}"), raw.lastIndexOf("]"));
  if (first < 0 || last <= first) throw new Error("El modelo no devolvió un JSON de operaciones.");
  let parsed: any;
  try {
    parsed = JSON.parse(raw.slice(first, last + 1));
  } catch {
    throw new Error("El modelo devolvió un JSON no válido. Inténtalo de nuevo.");
  }

  const reply = typeof parsed?.reply === "string" ? parsed.reply.trim().slice(0, 600) : "";
  const layout = cleanLayout(parsed?.layout);
  const operations: DiagramOperation[] = [];
  const usedIds = new Set<string>();
  const rawOps: any[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.operations)
      ? parsed.operations
      : [];

  // Respaldo: si el modelo responde con el formato clásico, lo convertimos a operaciones "add".
  if (!rawOps.length && Array.isArray(parsed?.elements)) {
    for (const item of parsed.elements) {
      if (operations.length >= 150) break;
      const element = cleanSkeleton(item, operations.length, usedIds);
      if (element) operations.push({ op: "add", element });
    }
  }

  for (const item of rawOps) {
    if (operations.length >= 150) break;
    if (!item || typeof item !== "object") continue;
    const op = String(item.op ?? item.action ?? "").toLowerCase();
    if (op === "add" || op === "create" || op === "draw") {
      const element = cleanSkeleton(item.element ?? item, operations.length, usedIds);
      if (element) operations.push({ op: "add", element });
    } else if (op === "update" || op === "modify" || op === "change" || op === "restyle") {
      const target = cleanRef(item.target ?? (item.id || item.label ? { id: item.id, label: item.label } : undefined));
      if (!target) continue;
      const patch = cleanPatch(item.patch ?? item);
      if (Object.keys(patch).length) operations.push({ op: "update", target, patch });
    } else if (op === "delete" || op === "remove" || op === "erase") {
      const target = cleanRef(item.target ?? (item.id || item.label ? { id: item.id, label: item.label } : undefined));
      if (target) operations.push({ op: "delete", target });
    } else if (op === "connect" || op === "link" || op === "arrow") {
      const from = cleanRef(item.from ?? item.start);
      const to = cleanRef(item.to ?? item.end);
      if (!from || !to) continue;
      const operation: Extract<DiagramOperation, { op: "connect" }> = { op: "connect", from, to };
      const label = cleanLabel(labelSource(item));
      if (label) operation.label = label;
      const style = cleanStyle(item.style ?? item);
      if (Object.keys(style).length) operation.style = style;
      const startArrowhead = cleanArrowhead(item.startArrowhead);
      const endArrowhead = cleanArrowhead(item.endArrowhead);
      if (startArrowhead !== undefined) operation.startArrowhead = startArrowhead;
      if (endArrowhead !== undefined) operation.endArrowhead = endArrowhead;
      operations.push(operation);
    }
  }

  if (!operations.length && !layout) throw new Error("El modelo no devolvió operaciones válidas para el diagrama.");
  return { reply, operations, layout };
}
