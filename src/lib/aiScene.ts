/* Prepara el contenido del lienzo para que un modelo de visión lo interprete */

import type { TabScene } from "../types/document";

export type SceneNode = {
  id: string;
  type: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SceneArrow = {
  from: string | null;
  to: string | null;
  label: string;
};

export type AiScene = {
  tab: string;
  image: string; // PNG en base64, sin el prefijo data:
  nodes: SceneNode[];
  arrows: SceneArrow[];
};

export type AiTab = { name: string; scene: TabScene };

const MAX_IMAGE_SIDE = 1600;

function textOf(el: any, byId: Map<string, any>): string {
  const parts: string[] = [];
  const bound = el?.boundElements;
  if (Array.isArray(bound)) {
    for (const b of bound) {
      if (b?.type === "text") {
        const t = byId.get(b.id)?.text;
        if (typeof t === "string" && t.trim()) parts.push(t.trim());
      }
    }
  }
  if (typeof el?.text === "string" && el.text.trim() && !parts.includes(el.text.trim())) {
    parts.push(el.text.trim());
  }
  return parts.join(" ");
}

function buildGraph(elements: any[]) {
  const byId = new Map<string, any>(elements.map((el: any) => [el.id, el]));
  const nodes: SceneNode[] = [];
  const rawArrows: Array<{ from: string | null; to: string | null; label: string }> = [];

  for (const el of elements) {
    if (el.type === "arrow" || el.type === "line") {
      rawArrows.push({
        from: el.startBinding?.elementId ?? null,
        to: el.endBinding?.elementId ?? null,
        label: textOf(el, byId),
      });
      continue;
    }
    nodes.push({
      id: el.id,
      type: el.type,
      text: textOf(el, byId),
      x: Math.round(el.x || 0),
      y: Math.round(el.y || 0),
      width: Math.round(el.width || 0),
      height: Math.round(el.height || 0),
    });
  }

  // Las uniones se resuelven a etiquetas legibles para el modelo
  const labelById = new Map(nodes.map((n) => [n.id, n.text || n.type]));
  const arrows = rawArrows.map((a) => ({
    from: a.from ? labelById.get(a.from) ?? a.from : null,
    to: a.to ? labelById.get(a.to) ?? a.to : null,
    label: a.label,
  }));

  return { nodes, arrows };
}

async function renderPng(scene: TabScene, elements: any[]): Promise<string> {
  const { exportToBlob } = await import("@excalidraw/excalidraw");
  const blob = await exportToBlob({
    elements,
    appState: { ...(scene.appState || {}), exportBackground: true, exportWithDarkMode: false },
    files: scene.files || {},
    mimeType: "image/png",
    exportPadding: 16,
  });

  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo preparar la imagen del lienzo");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return (canvas.toDataURL("image/png").split(",")[1] ?? "");
}

/** Convierte una o varias pestañas en imágenes + descripción estructurada */
export async function buildAiScenes(tabs: AiTab[]): Promise<AiScene[]> {
  const result: AiScene[] = [];
  for (const tab of tabs) {
    const elements = (tab.scene?.elements || []).filter((el: any) => el && !el.isDeleted);
    if (!elements.length) continue;
    const image = await renderPng(tab.scene, elements);
    result.push({ tab: tab.name, image, ...buildGraph(elements) });
  }
  if (!result.length) throw new Error("No hay dibujos para analizar. Dibuja algo primero.");
  return result;
}
