/* Aplica al proyecto el resultado de abrir un archivo (selector, arrastre o URL). */

import { useDocumentStore } from "../store/useDocumentStore";
import { INVALID_MESSAGE, parseOpenedFile, type OpenedFile } from "./fileSystem";
import { integrateLibrary } from "./libraryIntegration";

export async function applyOpenedFile(res: OpenedFile): Promise<string> {
  const store = useDocumentStore.getState();
  if (res.kind === "project") {
    store.initProject(res.project);
    store.setFileHandle(res.handle);
    return `Proyecto «${res.project.meta.title || "sin título"}» abierto`;
  }
  if (res.kind === "library") {
    try {
      const api = Object.values(store.excalidrawApis)[0];
      await integrateLibrary({ name: res.name, items: res.items, api });
      return `«${res.name}» integrada como librería fija (${res.items.length} pieza(s))`;
    } catch (err) {
      return "No se pudo integrar la librería: " + ((err as any)?.message || "error desconocido");
    }
  }
  store.addTab({ name: res.name, scene: res.scene });
  return `Lienzo «${res.name}» añadido como pestaña`;
}

/** Abre un archivo soltado sobre la ventana. */
export async function openDroppedFile(file: File): Promise<string> {
  const text = await file.text();
  const res = parseOpenedFile(text, file.name, null);
  if (!res) return INVALID_MESSAGE;
  return applyOpenedFile(res);
}

/** Abre un archivo alojado en la nube mediante su URL. */
export async function openRemoteFile(rawUrl: string): Promise<string> {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return "URL no válida";
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return "Solo se admiten URLs http/https";
  }

  let text: string;
  try {
    const response = await fetch(url.toString());
    if (!response.ok) return `No se pudo descargar el archivo (${response.status})`;
    text = await response.text();
  } catch (err) {
    return "No se pudo descargar: " + ((err as any)?.message || "error de red o CORS");
  }

  let name = "archivo";
  try {
    name = decodeURIComponent(url.pathname.split("/").pop() || "archivo");
  } catch {
    // Se mantiene el nombre por defecto.
  }
  const res = parseOpenedFile(text, name, null);
  if (!res) return INVALID_MESSAGE;
  return applyOpenedFile(res);
}
