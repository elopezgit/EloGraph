/* Aplica al proyecto el resultado de abrir un archivo (selector o arrastrar). */

import { useDocumentStore } from "../store/useDocumentStore";
import { INVALID_MESSAGE, parseOpenedFile, type OpenedFile } from "./fileSystem";
import { integrateLibrary } from "./libraryIntegration";

export async function applyOpenedFile(res: OpenedFile): Promise<void> {
  const store = useDocumentStore.getState();
  if (res.kind === "project") {
    store.initProject(res.project);
    store.setFileHandle(res.handle);
    return;
  }
  if (res.kind === "library") {
    try {
      const api = Object.values(store.excalidrawApis)[0];
      await integrateLibrary({ name: res.name, items: res.items, api });
      alert(`«${res.name}» integrada como librería fija (${res.items.length} pieza(s)).`);
    } catch (err) {
      alert("No se pudo integrar la librería: " + ((err as any)?.message || "error desconocido"));
    }
    return;
  }
  store.addTab({ name: res.name, scene: res.scene });
}

/** Abre un archivo soltado sobre la ventana. */
export async function openDroppedFile(file: File): Promise<void> {
  const text = await file.text();
  const res = parseOpenedFile(text, file.name, null);
  if (!res) {
    alert(INVALID_MESSAGE);
    return;
  }
  await applyOpenedFile(res);
}
