/* Lee el lienzo activo para que la IA inversa pueda interpretar y editar el dibujo existente */

import { blobToBase64, sceneToPngBlob } from "./excalidrawPng";

export type CanvasBounds = { minX: number; minY: number; maxX: number; maxY: number };

export type CanvasElementInfo = {
  id: string;
  type: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  backgroundColor?: string;
  strokeColor?: string;
  fillStyle?: string;
  strokeStyle?: string;
  strokeWidth?: number;
  roughness?: number;
  opacity?: number;
  fontSize?: number;
  startBinding?: string | null;
  endBinding?: string | null;
  startLabel?: string;
  endLabel?: string;
  startArrowhead?: string | null;
  endArrowhead?: string | null;
};

export type CanvasContext = {
  summary: string;
  image?: string;
  elements: CanvasElementInfo[];
  bounds: CanvasBounds | null;
};

/** Texto visible de un elemento, incluido el texto enlazado a un contenedor. */
function textOf(el: any, byId: Map<string, any>): string {
  const parts: string[] = [];
  if (Array.isArray(el?.boundElements)) {
    for (const bound of el.boundElements) {
      if (bound?.type === "text") {
        const text = byId.get(bound.id)?.text;
        if (typeof text === "string" && text.trim()) parts.push(text.trim());
      }
    }
  }
  if (typeof el?.text === "string" && el.text.trim() && !parts.includes(el.text.trim())) {
    parts.push(el.text.trim());
  }
  return parts.join(" ").slice(0, 500);
}

function boundsOf(elements: any[]): CanvasBounds | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const el of elements) {
    if (el.type === "arrow" || el.type === "line" || el.isDeleted) continue;
    const x = Number(el.x) || 0;
    const y = Number(el.y) || 0;
    const w = Number(el.width) || 0;
    const h = Number(el.height) || 0;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  }
  return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : null;
}

const optionalString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value : undefined;

const optionalNumber = (value: unknown): number | undefined =>
  Number.isFinite(Number(value)) ? Number(value) : undefined;

/**
 * Construye la descripción del lienzo que se envía al modelo. La imagen es opcional:
 * si falla la exportación se continúa solo con el JSON estructurado.
 */
export async function buildCanvasContext(
  api: any,
  options: { includeImage?: boolean; maxImageSide?: number } = {},
): Promise<CanvasContext> {
  const rawElements: any[] = (api?.getSceneElements?.() || []).filter(
    (el: any) => el && !el.isDeleted,
  );
  const byId = new Map<string, any>(rawElements.map((el) => [el.id, el]));
  const labelById = new Map<string, string>(rawElements.map((el) => [el.id, textOf(el, byId) || el.type]));

  const elements: CanvasElementInfo[] = rawElements.slice(0, 120).map((el) => {
    const info: CanvasElementInfo = {
      id: String(el.id),
      type: String(el.type),
      text: textOf(el, byId),
      x: Math.round(Number(el.x) || 0),
      y: Math.round(Number(el.y) || 0),
      width: Math.round(Number(el.width) || 0),
      height: Math.round(Number(el.height) || 0),
    };
    const backgroundColor = optionalString(el.backgroundColor);
    const strokeColor = optionalString(el.strokeColor);
    const fillStyle = optionalString(el.fillStyle);
    const strokeStyle = optionalString(el.strokeStyle);
    const strokeWidth = optionalNumber(el.strokeWidth);
    const roughness = optionalNumber(el.roughness);
    const opacity = optionalNumber(el.opacity);
    const fontSize = optionalNumber(el.fontSize);
    if (backgroundColor) info.backgroundColor = backgroundColor;
    if (strokeColor) info.strokeColor = strokeColor;
    if (fillStyle) info.fillStyle = fillStyle;
    if (strokeStyle) info.strokeStyle = strokeStyle;
    if (strokeWidth !== undefined) info.strokeWidth = strokeWidth;
    if (roughness !== undefined) info.roughness = roughness;
    if (opacity !== undefined) info.opacity = opacity;
    if (fontSize !== undefined) info.fontSize = fontSize;

    if (el.type === "arrow" || el.type === "line") {
      const startId = el.startBinding?.elementId ?? null;
      const endId = el.endBinding?.elementId ?? null;
      info.startBinding = startId;
      info.endBinding = endId;
      if (startId) info.startLabel = labelById.get(startId) || startId;
      if (endId) info.endLabel = labelById.get(endId) || endId;
      if (el.startArrowhead) info.startArrowhead = el.startArrowhead;
      if (el.endArrowhead) info.endArrowhead = el.endArrowhead;
    }
    return info;
  });

  const bounds = boundsOf(rawElements);
  const summaryObj: Record<string, unknown> = {
    total: rawElements.length,
    limites: bounds,
    elementos: elements,
  };
  if (rawElements.length > elements.length) {
    summaryObj.aviso = `Se muestran solo los primeros ${elements.length} elementos de ${rawElements.length}.`;
  }
  const summary = JSON.stringify(summaryObj, null, 2);

  let image: string | undefined;
  if (options.includeImage && rawElements.length) {
    try {
      const appState = api?.getAppState?.() || {};
      const files = api?.getFiles?.() || {};
      const blob = await sceneToPngBlob(
        { elements: rawElements, appState, files },
        options.maxImageSide ?? 1024,
      );
      image = await blobToBase64(blob);
    } catch {
      image = undefined;
    }
  }

  return { summary, image, elements, bounds };
}
