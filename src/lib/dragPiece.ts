/* Estado compartido para arrastrar piezas de la biblioteca al lienzo */
export type PieceDragPayload = {
  label: string;
  insert: (point?: { x: number; y: number }) => void;
};

let current: PieceDragPayload | null = null;

export const DRAG_MIME = "application/x-elograph-piece";

export function setPieceDrag(payload: PieceDragPayload) {
  current = payload;
}

export function getPieceDrag() {
  return current;
}

export function clearPieceDrag() {
  current = null;
}
