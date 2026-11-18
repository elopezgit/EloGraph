/* Carga de librerías (lienzos reutilizables) desde la web de Excalidraw */

export const LIBRARY_SITE_URL =
  "https://libraries.excalidraw.com/?target=_excalidraw&referrer=https%3A%2F%2Fexcalidraw.com%2F&useHash=true&token=CeROs7apyMlP-zuNVOQpH&theme=light&version=2&sort=default";

const SITE_ORIGIN = "https://libraries.excalidraw.com";
const CATALOG_URL = `${SITE_ORIGIN}/libraries.json`;

export type RemoteLibrary = {
  id: string;
  name: string;
  description: string;
  preview?: string;
  url: string;
};

export type LibraryItem = {
  id: string;
  name?: string;
  status: "published" | "unpublished";
  elements: any[];
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function safeUrl(input: string): URL | null {
  try {
    const url = new URL(input.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

export function isLibrarySiteUrl(input: string): boolean {
  const url = safeUrl(input);
  return !!url && /(^|\.)libraries\.excalidraw\.com$/i.test(url.hostname);
}

export function isDirectLibraryUrl(input: string): boolean {
  const url = safeUrl(input);
  if (!url) return false;
  return /\.excalidrawlib($|\?)/i.test(url.pathname) || /\.json($|\?)/i.test(url.pathname);
}

export function isValidLibraryUrl(input: string): boolean {
  return !!safeUrl(input);
}

/** Descarga el catálogo público de librerías de libraries.excalidraw.com */
export async function fetchRemoteCatalog(): Promise<RemoteLibrary[]> {
  const res = await fetch(CATALOG_URL);
  if (!res.ok) throw new Error(`No se pudo leer el catálogo (${res.status})`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error("Catálogo inválido");
  return data
    .filter((lib: any) => lib && lib.source)
    .map((lib: any) => ({
      id: String(lib.id || lib.source),
      name: String(lib.name || lib.source),
      description: String(lib.description || ""),
      preview: lib.preview ? `${SITE_ORIGIN}/libraries/${lib.preview}` : undefined,
      url: new URL(`libraries/${lib.source}`, SITE_ORIGIN).toString(),
    }));
}

/** Convierte el JSON de una librería en elementos utilizables por Excalidraw */
export async function fetchLibraryItems(url: string): Promise<LibraryItem[]> {
  const parsed = safeUrl(url);
  if (!parsed) throw new Error("URL no válida");
  const res = await fetch(parsed.toString());
  if (!res.ok) throw new Error(`No se pudo descargar la librería (${res.status})`);
  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new Error("El archivo no contiene JSON válido");
  }

  let raw: any[] = [];
  if (Array.isArray(data)) {
    raw = data;
  } else if (Array.isArray(data?.libraryItems)) {
    raw = data.libraryItems;
  } else if (Array.isArray(data?.items)) {
    raw = data.items;
  } else if (Array.isArray(data?.library)) {
    // Formato antiguo (v1): library es un array de arrays de elementos
    raw = data.library.map((elements: any) => ({ elements }));
  }

  const items = raw
    .map((item: any, index: number) => {
      const elements: any[] = Array.isArray(item?.elements) ? item.elements : [];
      if (!elements.length) return null;
      const firstText = elements.find((el: any) => el?.type === "text" && el?.text);
      return {
        id: String(item.id || uid()),
        name: String(item.name || firstText?.text?.slice(0, 40) || `Pieza ${index + 1}`),
        status: (item.status === "unpublished" ? "unpublished" : "published") as
          | "published"
          | "unpublished",
        elements: elements.filter((el: any) => el && el.type).map((el: any) => ({ ...el })),
      } as LibraryItem;
    })
    .filter((item: LibraryItem | null): item is LibraryItem => !!item);

  if (!items.length) throw new Error("La librería no contiene elementos dibujables");
  return items;
}
