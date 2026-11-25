/* Disposición determinista: el modelo decide el contenido, la app calcula las coordenadas */

import type { DiagramLayoutSpec } from "./diagramSkeleton";

export type LayoutItem = {
  type: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
};

export type LaneInfo = {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
};

export type LayoutAnchor = { x: number; y: number };

const HEADER_HEIGHT = 44;
const LANE_PADDING = 16;

const widthOf = (item: LayoutItem): number => Math.max(20, Number(item.width) || 180);
const heightOf = (item: LayoutItem): number => Math.max(20, Number(item.height) || 70);
const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

function columnize(items: LayoutItem[], columns: number, gap: number) {
  const groups: LayoutItem[][] = Array.from({ length: columns }, () => []);
  items.forEach((item, index) => groups[index % columns].push(item));
  const widths = groups.map((group) => Math.max(0, ...group.map(widthOf)));
  const heights = groups.map(
    (group) => group.reduce((sum, item) => sum + heightOf(item), 0) + gap * Math.max(0, group.length - 1),
  );
  return { groups, widths, heights };
}

/**
 * Coloca los elementos en `items` (muta x/y) según `spec` y devuelve los carriles
 * que la capa de aplicación debe dibujar en el tipo "swimlanes".
 */
export function applyLayout(
  items: LayoutItem[],
  spec: DiagramLayoutSpec,
  anchor: LayoutAnchor,
): LaneInfo[] {
  if (!items.length) return [];
  const gap = clamp(spec.spacing ?? 40, 0, 400);
  const count = items.length;
  const type = spec.type;

  if (type === "grid") {
    const columns = clamp(spec.columns ?? Math.ceil(Math.sqrt(count)), 1, 12);
    const maxWidth = Math.max(...items.map(widthOf));
    const maxHeight = Math.max(...items.map(heightOf));
    items.forEach((item, index) => {
      item.x = Math.round(anchor.x + (index % columns) * (maxWidth + gap) + (maxWidth - widthOf(item)) / 2);
      item.y = Math.round(
        anchor.y + Math.floor(index / columns) * (maxHeight + gap) + (maxHeight - heightOf(item)) / 2,
      );
    });
    return [];
  }

  if (type === "flow") {
    const columns = clamp(spec.columns ?? Math.min(4, count), 1, 12);
    const rows = Math.ceil(count / columns);
    const rowItems: LayoutItem[][] = Array.from({ length: rows }, () => []);
    items.forEach((item, index) => rowItems[Math.floor(index / columns)].push(item));
    const rowHeights = rowItems.map((row) => Math.max(0, ...row.map(heightOf)));
    const rowWidths = rowItems.map(
      (row) => row.reduce((sum, item) => sum + widthOf(item), 0) + gap * Math.max(0, row.length - 1),
    );
    const maxRowWidth = Math.max(...rowWidths);
    let y = anchor.y;
    rowItems.forEach((row, rowIndex) => {
      let x = anchor.x + (maxRowWidth - rowWidths[rowIndex]) / 2;
      for (const item of row) {
        item.x = Math.round(x);
        item.y = Math.round(y + (rowHeights[rowIndex] - heightOf(item)) / 2);
        x += widthOf(item) + gap;
      }
      y += rowHeights[rowIndex] + gap;
    });
    return [];
  }

  // "columns" y "swimlanes" comparten la repartición en columnas.
  const columns = clamp(spec.columns ?? count, 1, 12);
  const { groups, widths } = columnize(items, columns, gap);
  let x = anchor.x;
  const lanes: LaneInfo[] = [];

  groups.forEach((group, columnIndex) => {
    const laneWidth = widths[columnIndex] + LANE_PADDING * 2;
    if (type === "swimlanes") {
      let y = anchor.y + HEADER_HEIGHT + LANE_PADDING;
      for (const item of group) {
        item.x = Math.round(x + LANE_PADDING + (widths[columnIndex] - widthOf(item)) / 2);
        item.y = Math.round(y);
        y += heightOf(item) + gap;
      }
      const lastY = group.length ? y - gap : y;
      lanes.push({
        index: columnIndex,
        x: Math.round(x),
        y: Math.round(anchor.y),
        width: Math.round(laneWidth),
        height: Math.round(Math.max(HEADER_HEIGHT + LANE_PADDING * 2, lastY - anchor.y + LANE_PADDING)),
        label: spec.laneLabels?.[columnIndex] || `Carril ${columnIndex + 1}`,
      });
    } else {
      let y = anchor.y;
      for (const item of group) {
        item.x = Math.round(x + (widths[columnIndex] - widthOf(item)) / 2);
        item.y = Math.round(y);
        y += heightOf(item) + gap;
      }
    }
    x += laneWidth + gap;
  });

  return lanes;
}
