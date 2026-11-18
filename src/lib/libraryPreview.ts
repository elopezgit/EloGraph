/* Miniaturas SVG de las piezas de una librería. Usa el renderizador de Excalidraw
   y, si falla, un renderizador sencillo de respaldo. */

import { exportToSvg } from "@excalidraw/excalidraw";
import type { LibraryItem } from "./libraryUrl";

const cache = new Map<string, string>();

function esc(value: any): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Dibujo básico de las formas más habituales, como alternativa al exportador. */
export function fallbackPreviewSvg(elements: any[]): string {
  const live = (elements || []).filter((el) => el && el.type && el.type !== "selection" && !el.isDeleted);
  if (!live.length) return "";

  const xs: number[] = [];
  const ys: number[] = [];
  for (const el of live) {
    xs.push(el.x ?? 0, (el.x ?? 0) + (el.width ?? 0));
    ys.push(el.y ?? 0, (el.y ?? 0) + (el.height ?? 0));
    for (const p of el.points || []) {
      xs.push((el.x ?? 0) + (p[0] ?? 0));
      ys.push((el.y ?? 0) + (p[1] ?? 0));
    }
  }
  const pad = 6;
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  const w = Math.max(1, Math.max(...xs) - minX + pad);
  const h = Math.max(1, Math.max(...ys) - minY + pad);

  const parts: string[] = [];
  const ordered = [...live.filter((el) => el.type !== "text"), ...live.filter((el) => el.type === "text")];

  for (const el of ordered) {
    const x = (el.x ?? 0) - minX;
    const y = (el.y ?? 0) - minY;
    const ew = Math.max(1, el.width ?? 0);
    const eh = Math.max(1, el.height ?? 0);
    const stroke = el.strokeColor && el.strokeColor !== "transparent" ? el.strokeColor : "#1e1e1e";
    const fill = el.backgroundColor && el.backgroundColor !== "transparent" ? el.backgroundColor : "none";
    const sw = el.strokeWidth ?? 1;
    const op = (el.opacity ?? 100) / 100;
    const common = `fill="${esc(fill)}" stroke="${esc(stroke)}" stroke-width="${sw}" opacity="${op}"`;
    const rot = el.angle ? ` transform="rotate(${(el.angle * 180) / Math.PI} ${x + ew / 2} ${y + eh / 2})"` : "";

    switch (el.type) {
      case "rectangle":
        parts.push(`<rect x="${x}" y="${y}" width="${ew}" height="${eh}" rx="${el.roundness ? 8 : 0}" ${common}${rot}/>`);
        break;
      case "ellipse":
        parts.push(`<ellipse cx="${x + ew / 2}" cy="${y + eh / 2}" rx="${ew / 2}" ry="${eh / 2}" ${common}${rot}/>`);
        break;
      case "diamond":
        parts.push(
          `<polygon points="${x + ew / 2},${y} ${x + ew},${y + eh / 2} ${x + ew / 2},${y + eh} ${x},${y + eh / 2}" ${common}${rot}/>`
        );
        break;
      case "line":
      case "arrow":
      case "freedraw": {
        const pts = el.points || [[0, 0], [ew, eh]];
        const str = pts.map((p: number[]) => `${x + (p[0] ?? 0)},${y + (p[1] ?? 0)}`).join(" ");
        parts.push(`<polyline points="${str}" fill="none" stroke="${esc(stroke)}" stroke-width="${sw}"${rot}/>`);
        if (el.type === "arrow" && pts.length >= 2) {
          const a = pts[pts.length - 2];
          const b = pts[pts.length - 1];
          const ax = x + (a[0] ?? 0);
          const ay = y + (a[1] ?? 0);
          const bx = x + (b[0] ?? 0);
          const by = y + (b[1] ?? 0);
          const ang = Math.atan2(by - ay, bx - ax);
          const s = 8;
          const p1 = `${bx},${by}`;
          const p2 = `${bx - s * Math.cos(ang - 0.5)},${by - s * Math.sin(ang - 0.5)}`;
          const p3 = `${bx - s * Math.cos(ang + 0.5)},${by - s * Math.sin(ang + 0.5)}`;
          parts.push(`<polygon points="${p1} ${p2} ${p3}" fill="${esc(stroke)}"${rot}/>`);
        }
        break;
      }
      case "text": {
        const size = el.fontSize ?? 16;
        const lines = String(el.text ?? "").split("\n");
        const anchor = el.textAlign === "center" ? "middle" : el.textAlign === "right" ? "end" : "start";
        const tx = el.textAlign === "center" ? x + ew / 2 : el.textAlign === "right" ? x + ew : x;
        lines.forEach((line, i) => {
          parts.push(
            `<text x="${tx}" y="${y + size * (i + 0.85)}" font-size="${size}" fill="${esc(stroke)}" text-anchor="${anchor}" font-family="sans-serif">${esc(line)}</text>`
          );
        });
        break;
      }
      default:
        break;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${parts.join("")}</svg>`;
}

async function fromExcalidraw(elements: any[]): Promise<string> {
  const svg = await exportToSvg({
    elements: elements as any,
    appState: {
      exportBackground: false,
      viewBackgroundColor: "transparent",
      exportWithDarkMode: false,
      exportScale: 1,
    } as any,
    files: {} as any,
  });
  const width = Number(svg.getAttribute("width")) || 0;
  const height = Number(svg.getAttribute("height")) || 0;
  if (width <= 0 || height <= 0) return "";
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.outerHTML)}`;
}

export async function libraryItemPreview(item: LibraryItem): Promise<string> {
  const cached = cache.get(item.id);
  if (cached !== undefined) return cached;

  const elements = (item.elements || []).filter(
    (el: any) => el && el.type && el.type !== "selection" && !el.isDeleted
  );
  let preview = "";
  if (elements.length) {
    try {
      preview = await fromExcalidraw(elements);
    } catch (err) {
      console.error("No se pudo generar la miniatura con Excalidraw", err);
    }
    if (!preview) {
      preview = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(fallbackPreviewSvg(elements))}`;
    }
  }
  cache.set(item.id, preview);
  return preview;
}
