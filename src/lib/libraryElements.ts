/* Prepara los elementos de una pieza de librería para insertarlos en el lienzo. */

const uid = () => Math.random().toString(36).slice(2, 10);

export function prepareLibraryElements(elements: any[]): any[] {
  const live = (elements || []).filter((el) => el && el.type && el.type !== "selection" && !el.isDeleted);
  if (!live.length) return [];

  const minX = Math.min(...live.map((el) => el.x ?? 0));
  const minY = Math.min(...live.map((el) => el.y ?? 0));

  const idMap = new Map<string, string>();
  for (const el of live) idMap.set(el.id, uid());

  return live.map((el) => {
    const copy: any = { ...el };
    copy.id = idMap.get(el.id) || uid();
    copy.x = (el.x ?? 0) - minX;
    copy.y = (el.y ?? 0) - minY;
    copy.seed = Math.floor(Math.random() * 1_000_000_000);
    copy.version = 1;
    copy.versionNonce = Math.floor(Math.random() * 1_000_000_000);
    copy.isDeleted = false;
    copy.groupIds = (el.groupIds || []).map((g: string) => idMap.get(g) || g);
    if (el.boundElements) {
      copy.boundElements = el.boundElements.map((b: any) => ({ ...b, id: idMap.get(b.id) || b.id }));
    }
    if (el.containerId) copy.containerId = idMap.get(el.containerId) || el.containerId;
    if (el.frameId) copy.frameId = idMap.get(el.frameId) || null;
    // Excalidraw recalcula el índice fractional al insertar en la escena.
    delete copy.index;
    return copy;
  });
}
