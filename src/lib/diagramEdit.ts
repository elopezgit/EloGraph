/* Aplica las operaciones de la sesión IA al lienzo de Excalidraw */

import { bumpVersion, convertToExcalidrawElements } from "@excalidraw/excalidraw";
import type { CanvasBounds } from "./diagramContext";
import { applyLayout, type LaneInfo, type LayoutItem } from "./diagramLayout";
import type { DiagramEdit, DiagramRef, DiagramSkeleton } from "./diagramSkeleton";

type AnyEl = Record<string, any>;

export type ApplyOptions = {
  api: any | null;
  mode: "new" | "active";
  addTab: (options: {
    name?: string;
    scene: { elements: any[]; appState: Record<string, unknown>; files: Record<string, unknown> };
  }) => void;
  bounds: CanvasBounds | null;
  tabName?: string;
};

export type ApplySummary = {
  added: number;
  updated: number;
  deleted: number;
  connected: number;
  warnings: string[];
};

const SHAPES = new Set(["rectangle", "ellipse", "diamond"]);
const LAYOUTABLE = new Set(["rectangle", "ellipse", "diamond", "text"]);
const STYLE_KEYS = [
  "backgroundColor",
  "strokeColor",
  "fillStyle",
  "strokeStyle",
  "strokeWidth",
  "roughness",
  "opacity",
  "startArrowhead",
  "endArrowhead",
] as const;
const GEOM_KEYS = ["x", "y", "width", "height"] as const;

const normalize = (value: string): string =>
  value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function visibleLabel(el: AnyEl, byId: Map<string, AnyEl>): string {
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
  return parts.join(" ").trim();
}

function buildMaps(elements: AnyEl[]): {
  byId: Map<string, AnyEl>;
  byLabel: Map<string, AnyEl>;
} {
  const byId = new Map<string, AnyEl>(elements.map((el) => [String(el.id), el]));
  const byLabel = new Map<string, AnyEl>();
  for (const el of elements) {
    const label = visibleLabel(el, byId);
    if (label && !byLabel.has(normalize(label))) byLabel.set(normalize(label), el);
  }
  return { byId, byLabel };
}

function refText(ref: DiagramRef): string {
  return ref.id ? `id "${ref.id}"` : `etiqueta "${ref.label ?? ""}"`;
}

function resolveRef(
  ref: DiagramRef,
  byId: Map<string, AnyEl>,
  byLabel: Map<string, AnyEl>,
): AnyEl | undefined {
  if (ref.id && byId.has(ref.id)) return byId.get(ref.id);
  if (ref.label) return byLabel.get(normalize(ref.label));
  return undefined;
}

function boundTextIds(el: AnyEl): string[] {
  if (!Array.isArray(el?.boundElements)) return [];
  return el.boundElements
    .filter((bound: any) => bound?.type === "text" && typeof bound.id === "string")
    .map((bound: any) => bound.id as string);
}

function addBoundRef(el: AnyEl, id: string, type: string): void {
  const list: AnyEl[] = Array.isArray(el?.boundElements) ? [...el.boundElements] : [];
  if (!list.some((bound) => bound?.id === id)) list.push({ id, type });
  el.boundElements = list;
  Object.assign(el, bumpVersion(el as any));
}

function centerOf(el: AnyEl): { x: number; y: number } {
  return {
    x: (Number(el.x) || 0) + (Number(el.width) || 0) / 2,
    y: (Number(el.y) || 0) + (Number(el.height) || 0) / 2,
  };
}

function placeArrow(arrow: AnyEl, from: AnyEl, to: AnyEl, map?: Map<string, AnyEl>): void {
  const a = centerOf(from);
  const b = centerOf(to);
  arrow.x = a.x;
  arrow.y = a.y;
  arrow.points = [
    [0, 0],
    [b.x - a.x, b.y - a.y],
  ];
  arrow.width = Math.abs(b.x - a.x);
  arrow.height = Math.abs(b.y - a.y);
  arrow.startBinding = { elementId: from.id, focus: 0, gap: 8 };
  arrow.endBinding = { elementId: to.id, focus: 0, gap: 8 };
  Object.assign(arrow, bumpVersion(arrow as any));

  // La etiqueta enlazada se recoloca con la flecha.
  const textId = boundTextIds(arrow)[0];
  const text = textId ? map?.get(textId) : undefined;
  if (text) {
    text.x = (a.x + b.x) / 2 - (Number(text.width) || 0) / 2;
    text.y = (a.y + b.y) / 2 - (Number(text.height) || 0) / 2;
    Object.assign(text, bumpVersion(text as any));
  }
}

function styleFrom(el: AnyEl): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of STYLE_KEYS) {
    if (el?.[key] !== undefined && el[key] !== null) out[key] = el[key];
  }
  return out;
}

function labelFrom(el: AnyEl, byId: Map<string, AnyEl>): AnyEl | undefined {
  const text = visibleLabel(el, byId);
  const textEl = byId.get(boundTextIds(el)[0] ?? "");
  if (!text) return undefined;
  return {
    text,
    fontSize: textEl?.fontSize ?? 16,
    fontFamily: textEl?.fontFamily,
    textAlign: textEl?.textAlign,
    verticalAlign: textEl?.verticalAlign,
  };
}

function replaceShape(el: AnyEl, patch: Partial<DiagramSkeleton>, all: AnyEl[]): AnyEl[] {
  const { byId } = buildMaps(all);
  const skeleton: AnyEl = {
    id: el.id,
    type: patch.type,
    x: patch.x ?? el.x,
    y: patch.y ?? el.y,
    width: patch.width ?? el.width,
    height: patch.height ?? el.height,
    ...styleFrom(el),
    ...styleFrom(patch as AnyEl),
  };
  const label = patch.label ?? labelFrom(el, byId);
  if (label) {
    skeleton.label = { ...label };
    if (patch.label?.fontSize !== undefined) skeleton.label.fontSize = patch.label.fontSize;
    if (patch.label?.fontFamily !== undefined) skeleton.label.fontFamily = patch.label.fontFamily;
    if (patch.label?.textAlign !== undefined) skeleton.label.textAlign = patch.label.textAlign;
    if (patch.label?.verticalAlign !== undefined) skeleton.label.verticalAlign = patch.label.verticalAlign;
    if (patch.label?.strokeColor !== undefined) skeleton.label.strokeColor = patch.label.strokeColor;
  }
  return convertToExcalidrawElements([skeleton as any], { regenerateIds: false }) as AnyEl[];
}

/** Mide un texto usando el motor de Excalidraw para no dejar un tamaño obsoleto. */
function measureTextElement(text: string, fontSize: number): AnyEl {
  const converted = convertToExcalidrawElements(
    [{ type: "text", text, fontSize, x: 0, y: 0 } as any],
    { regenerateIds: false },
  ) as AnyEl[];
  return converted[0] ?? { width: Math.max(20, text.length * fontSize * 0.6), height: fontSize * 1.25 };
}

export async function applyDiagramEdit(edit: DiagramEdit, options: ApplyOptions): Promise<ApplySummary> {
  const result: ApplySummary = { added: 0, updated: 0, deleted: 0, connected: 0, warnings: [] };
  const { api, mode, bounds } = options;
  const source: AnyEl[] =
    mode === "active" && api
      ? ((api.getSceneElements?.() || []) as AnyEl[]).filter((el) => el && !el.isDeleted)
      : [];

  let elements: AnyEl[] = source.map((el) => ({ ...el }));
  let maps = buildMaps(elements);
  const changedIds = new Set<string>();

  // 1. Borrar elementos (y el texto/flechas que dependen de ellos).
  const deletedIds = new Set<string>();
  for (const op of edit.operations) {
    if (op.op !== "delete") continue;
    const target = resolveRef(op.target, maps.byId, maps.byLabel);
    if (!target) {
      result.warnings.push(`No encontré el elemento para borrar: ${refText(op.target)}`);
      continue;
    }
    deletedIds.add(String(target.id));
  }
  if (deletedIds.size) {
    const removeIds = new Set<string>(deletedIds);
    for (const el of elements) {
      const startId = el.startBinding?.elementId;
      const endId = el.endBinding?.elementId;
      const depends = deletedIds.has(String(el.id)) || (startId && deletedIds.has(startId)) || (endId && deletedIds.has(endId));
      if (depends) for (const id of boundTextIds(el)) removeIds.add(id);
    }
    elements = elements.filter((el) => !removeIds.has(String(el.id)));
    for (const el of elements) {
      if (Array.isArray(el.boundElements)) {
        el.boundElements = el.boundElements.filter((bound: any) => bound && !removeIds.has(bound.id));
      }
    }
    result.deleted = deletedIds.size;
    maps = buildMaps(elements);
  }

  // 2. Modificar elementos existentes (estilos, tamaño, etiqueta o tipo).
  for (const op of edit.operations) {
    if (op.op !== "update") continue;
    const target = resolveRef(op.target, maps.byId, maps.byLabel);
    if (!target) {
      result.warnings.push(`No encontré el elemento para modificar: ${refText(op.target)}`);
      continue;
    }
    const targetId = String(target.id);
    const patch = op.patch as AnyEl;
    const replacing =
      !!patch.type &&
      patch.type !== target.type &&
      SHAPES.has(patch.type) &&
      SHAPES.has(target.type);

    if (replacing) {
      const oldTextIds = boundTextIds(target);
      const converted = replaceShape(target, op.patch, elements).filter(Boolean);
      elements = elements.filter((el) => el.id !== target.id && !oldTextIds.includes(String(el.id)));
      elements.push(...converted);
      changedIds.add(targetId);
    } else {
      const index = elements.findIndex((el) => el.id === target.id);
      if (index < 0) continue;
      let next: AnyEl = { ...elements[index] };
      for (const key of STYLE_KEYS) if (patch[key] !== undefined) next[key] = patch[key];
      for (const key of GEOM_KEYS) if (patch[key] !== undefined) next[key] = patch[key];
      if (patch.type && patch.type === next.type) next.type = patch.type;
      next = { ...bumpVersion(next as any) };
      elements[index] = next;

      if (patch.label) {
        const labelText = String(patch.label.text ?? "");
        const textIds = boundTextIds(next);
        if (textIds.length) {
          for (const id of textIds) {
            const textIndex = elements.findIndex((el) => el.id === id);
            if (textIndex < 0) continue;
            const oldText = elements[textIndex];
            const metrics = measureTextElement(labelText, patch.label.fontSize ?? oldText.fontSize ?? 16);
            elements[textIndex] = {
              ...bumpVersion(oldText as any),
              text: labelText,
              width: metrics.width,
              height: metrics.height,
              fontSize: patch.label.fontSize ?? oldText.fontSize,
              fontFamily: patch.label.fontFamily ?? oldText.fontFamily,
            };
          }
        } else if (labelText) {
          const metrics = measureTextElement(labelText, patch.label.fontSize ?? 16);
          const point = centerOf(next);
          elements.push({
            ...metrics,
            id: `ai_label_${Math.random().toString(36).slice(2, 9)}`,
            type: "text",
            x: point.x - metrics.width / 2,
            y: point.y - metrics.height / 2,
            text: labelText,
            fontSize: patch.label.fontSize ?? 16,
            isDeleted: false,
            version: 1,
            versionNonce: Math.floor(Math.random() * 2 ** 31),
          });
        }
        changedIds.add(targetId);
      }
    }
    result.updated++;
    maps = buildMaps(elements);
  }

  // 3. Crear elementos nuevos. Las flechas se enlazan después de aplicar el layout.
  const newSkeletons: AnyEl[] = [];
  const arrowOps: Array<{
    skeleton: AnyEl;
    from?: DiagramRef;
    to?: DiagramRef;
    created?: AnyEl;
  }> = [];
  const usedIds = new Set(maps.byId.keys());

  for (const op of edit.operations) {
    if (op.op !== "add") continue;
    const skeleton: AnyEl = { ...(op.element as AnyEl) };
    let id = String(skeleton.id || `ai_${Math.random().toString(36).slice(2, 9)}`);
    if (usedIds.has(id)) id = `ai_${Math.random().toString(36).slice(2, 9)}`;
    usedIds.add(id);
    skeleton.id = id;
    const from = skeleton.start ?? skeleton.from;
    const to = skeleton.end ?? skeleton.to;
    delete skeleton.start;
    delete skeleton.end;
    delete skeleton.from;
    delete skeleton.to;
    if (skeleton.type === "arrow" || skeleton.type === "line") {
      arrowOps.push({ skeleton: { ...skeleton, x: 0, y: 0 }, from, to });
    } else {
      newSkeletons.push({ ...skeleton, x: 0, y: 0 });
    }
    result.added++;
  }

  for (const op of edit.operations) {
    if (op.op !== "connect") continue;
    if (!op.from || !op.to) continue;
    const skeleton: AnyEl = {
      type: "arrow",
      x: 0,
      y: 0,
      width: 120,
      height: 0,
      ...styleFrom(op.style ?? {}),
      ...styleFrom(op as AnyEl),
    };
    if (op.label) skeleton.label = { ...op.label };
    arrowOps.push({ skeleton, from: op.from, to: op.to });
    result.connected++;
  }

  const newConverted = newSkeletons.length
    ? (convertToExcalidrawElements(newSkeletons as any, { regenerateIds: false }) as AnyEl[])
    : [];
  const newArrows: AnyEl[] = [];
  for (const item of arrowOps) {
    const converted = convertToExcalidrawElements([item.skeleton as any], { regenerateIds: false }) as AnyEl[];
    const arrow = converted.find((el) => el.type === "arrow" || el.type === "line");
    if (!arrow) continue;
    item.created = arrow;
    newArrows.push(...converted);
  }

  // 4. Layout: solo rejilla/elementos nuevos, o todo el lienzo si se pidió scope "all".
  const spec = edit.layout;
  let laneDecorations: AnyEl[] = [];
  if (spec) {
    const scopeAll = spec.scope === "all";
    const pool = scopeAll ? elements : newConverted;
    const targets: LayoutItem[] = pool.filter(
      (el) => LAYOUTABLE.has(el.type) && !el.containerId && !el.isDeleted,
    ) as LayoutItem[];
    const gap = spec.spacing ?? 40;
    const anchor = scopeAll
      ? { x: bounds?.minX ?? 60, y: bounds?.minY ?? 60 }
      : mode === "active"
        ? { x: bounds?.minX ?? 60, y: bounds ? bounds.maxY + gap + 60 : 60 }
        : { x: 60, y: 60 };
    const positionsBefore = targets.map((item) => `${item.x},${item.y}`);
    const lanes: LaneInfo[] = applyLayout(targets, spec, anchor);
    targets.forEach((item, index) => {
      if (`${item.x},${item.y}` !== positionsBefore[index]) {
        Object.assign(item, bumpVersion(item as any));
      }
    });
    if (scopeAll) changedIds.clear();
    for (const item of targets) {
      if ("id" in item) changedIds.add(String((item as AnyEl).id));
    }

    if (lanes.length) {
      const laneSkeletons: AnyEl[] = [];
      lanes.forEach((lane, index) => {
        laneSkeletons.push({
          id: `ai_lane_${Date.now().toString(36)}_${index}`,
          type: "rectangle",
          x: lane.x,
          y: lane.y,
          width: lane.width,
          height: lane.height,
          backgroundColor: "#f8f9fa",
          strokeColor: "#adb5bd",
          strokeStyle: "dashed",
          fillStyle: "solid",
          roughness: 0,
        });
        laneSkeletons.push({
          type: "text",
          x: lane.x + 16,
          y: lane.y + 12,
          text: lane.label,
          fontSize: 16,
          strokeColor: "#495057",
        });
      });
      laneDecorations = convertToExcalidrawElements(laneSkeletons as any, { regenerateIds: false }) as AnyEl[];
    }
  }

  // 5. Enlazar flechas contra el estado final (incluye elementos recién creados).
  const finalElements: AnyEl[] = [
    ...laneDecorations,
    ...elements,
    ...newConverted,
    ...newArrows,
  ];
  const finalMaps = buildMaps(finalElements);
  const finalMap = finalMaps.byId;

  arrowOps.forEach((item) => {
    const created = item.created;
    if (!created) return;
    const from = resolveRef(item.from ?? {}, finalMap, finalMaps.byLabel);
    const to = resolveRef(item.to ?? {}, finalMap, finalMaps.byLabel);
    if (!from || !to) {
      result.warnings.push(
        `No pude conectar una flecha: ${item.from ? refText(item.from) : "origen desconocido"} → ${
          item.to ? refText(item.to) : "destino desconocido"
        }`,
      );
      return;
    }
    placeArrow(created, from, to, finalMap);
    addBoundRef(from, String(created.id), "arrow");
    addBoundRef(to, String(created.id), "arrow");
  });

  // Las flechas antiguas unidas a elementos movidos también se recolocan.
  for (const el of finalElements) {
    if (el.type !== "arrow" && el.type !== "line") continue;
    const startId = el.startBinding?.elementId;
    const endId = el.endBinding?.elementId;
    if (!startId || !endId || (!changedIds.has(startId) && !changedIds.has(endId))) continue;
    const from = finalMap.get(startId);
    const to = finalMap.get(endId);
    if (from && to) placeArrow(el, from, to, finalMap);
  }

  if (mode === "new" || !api) {
    options.addTab({
      name: options.tabName || "Diagrama IA (sesión)",
      scene: { elements: finalElements, appState: { viewBackgroundColor: "#ffffff" }, files: {} },
    });
  } else {
    api.updateScene({ elements: finalElements });
  }

  return result;
}
