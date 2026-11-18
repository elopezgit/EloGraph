/* Exportación PNG del lienzo de Excalidraw con tamaño limitado y errores claros */

export type PngSource = {
  elements: any[];
  appState: any;
  files: any;
};

type PngOptions = {
  padding?: number;
  darkMode?: boolean;
};

const PNG_MIME = "image/png";

/**
 * Genera un blob PNG del lienzo sin superar los límites de tamaño del navegador.
 * `maxSide` fija el lado mayor máximo de la imagen resultante.
 */
export async function sceneToPngBlob(source: PngSource, maxSide: number, options: PngOptions = {}): Promise<Blob> {
  const elements = (source.elements || []).filter((el: any) => el && !el.isDeleted);
  if (!elements.length) throw new Error("No hay elementos en el lienzo para exportar.");

  const { exportToBlob } = await import("@excalidraw/excalidraw");

  const appState: Record<string, any> = {
    ...(source.appState || {}),
    exportBackground: true,
    exportWithDarkMode: options.darkMode ?? false,
    // Un exportScale guardado en el proyecto puede generar canvas gigantes
    // y hacer que canvas.toBlob() devuelva null ("couldn't export to blob").
    exportScale: 1,
  };

  const blob = await exportToBlob({
    elements,
    appState,
    files: source.files || {},
    mimeType: PNG_MIME,
    exportPadding: options.padding ?? 16,
    maxWidthOrHeight: Math.max(1, Math.floor(maxSide)),
  });

  if (!blob || blob.size === 0) throw new Error("No se pudo generar la imagen del dibujo.");
  return blob;
}

/** Convierte un blob a base64 puro (sin el prefijo data:image/png;base64,) */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const data = reader.result;
      const base64 = typeof data === "string" ? (data.split(",")[1] ?? "") : "";
      if (!base64) {
        reject(new Error("No se pudo leer la imagen generada."));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("No se pudo leer la imagen generada."));
    reader.readAsDataURL(blob);
  });
}
