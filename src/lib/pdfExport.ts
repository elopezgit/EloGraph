import { jsPDF } from "jspdf";
import { svg2pdf } from "svg2pdf.js";
import type { Project } from "../types/document";
import { sceneToPngBlob } from "./excalidrawPng";

export async function exportToPdf(elements: any[], appState: any, files: any, title: string): Promise<void> {
  const { exportToSvg } = await import("@excalidraw/excalidraw");

  const svg = await exportToSvg({
    elements,
    appState: { ...appState, exportBackground: true },
    files,
    exportPadding: 16,
  });

  if (!svg.getAttribute("width")) svg.setAttribute("width", "1000");
  if (!svg.getAttribute("height")) svg.setAttribute("height", "800");

  const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  await svg2pdf(svg, pdf, {
    x: 20,
    y: 20,
    width: pageWidth - 40,
    height: pageHeight - 40,
  });

  pdf.save(`${title || "diagrama"}.pdf`);
}

export async function exportProjectToPdf(project: Project): Promise<void> {
  const { exportToSvg } = await import("@excalidraw/excalidraw");
  const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  let first = true;
  for (const tab of project.tabs) {
    const elements = tab.scene.elements || [];
    const appState = tab.scene.appState || {};
    const files = tab.scene.files || {};
    if (elements.length === 0) continue;

    const svg = await exportToSvg({
      elements,
      appState: { ...appState, exportBackground: true },
      files,
      exportPadding: 16,
    });
    if (!svg.getAttribute("width")) svg.setAttribute("width", "1000");
    if (!svg.getAttribute("height")) svg.setAttribute("height", "800");

    if (!first) pdf.addPage();
    first = false;

    pdf.setFontSize(14);
    pdf.text(tab.name, 20, 16);

    await svg2pdf(svg, pdf, {
      x: 20,
      y: 24,
      width: pageWidth - 40,
      height: pageHeight - 40,
    });
  }

  if (first) {
    // empty project
    pdf.text("Proyecto vacío", 20, 20);
  }

  pdf.save(`${project.meta.title || "proyecto"}.pdf`);
}

export async function exportToPng(elements: any[], appState: any, files: any, title: string): Promise<void> {
  const blob = await sceneToPngBlob({ elements, appState, files }, 4096);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title || "diagrama"}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}