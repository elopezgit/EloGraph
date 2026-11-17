import * as XLSX from "xlsx";
import { useDocumentStore } from "../store/useDocumentStore";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export async function importExcelFile(file: File): Promise<void> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const store = useDocumentStore.getState();

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as any[][];
    // collect candidate field names from first column (skip header-ish first row)
    const fields: string[] = [];
    const start = rows.length > 1 && typeof rows[0]?.[0] === "string" && /atributo|campo|column/i.test(String(rows[0][0])) ? 1 : 0;
    for (let i = start; i < Math.min(rows.length, 12); i++) {
      const v = rows[i]?.[0];
      if (v !== undefined && v !== null && String(v).trim() !== "") {
        fields.push(String(v).trim());
      }
    }
    if (fields.length === 0) {
      // fallback: use first row cells
      const first = rows.find((r) => r.some((c) => c !== ""));
      if (first) fields.push(...first.slice(0, 8).map((c) => String(c).trim()).filter(Boolean));
    }
    const fieldText = fields.slice(0, 10).join("\n") || "(sin campos)";

    const g = uid();
    const r1 = uid(), r2 = uid(), t1 = uid(), t2 = uid();
    const scene = {
      elements: [
        {
          id: r1, type: "rectangle", x: 0, y: 0, width: 220, height: 30, angle: 0,
          strokeColor: "#1e1e1e", backgroundColor: "#e8f5e9", fillStyle: "solid", strokeWidth: 2, strokeStyle: "solid", roughness: 0, opacity: 100,
          groupIds: [g], frameId: null, roundness: null, seed: 1, version: 1, versionNonce: 1, isDeleted: false, boundElements: [{ id: t1, type: "text" }], updated: Date.now(), link: null, locked: false,
        },
        {
          id: r2, type: "rectangle", x: 0, y: 30, width: 220, height: Math.max(40, fields.length * 16 + 8), angle: 0,
          strokeColor: "#1e1e1e", backgroundColor: "#ffffff", fillStyle: "solid", strokeWidth: 2, strokeStyle: "solid", roughness: 0, opacity: 100,
          groupIds: [g], frameId: null, roundness: null, seed: 2, version: 1, versionNonce: 2, isDeleted: false, boundElements: [{ id: t2, type: "text" }], updated: Date.now(), link: null, locked: false,
        },
        {
          id: t1, type: "text", x: 8, y: 6, width: 200, height: 20, angle: 0,
          strokeColor: "#1e1e1e", backgroundColor: "transparent", fillStyle: "solid", strokeWidth: 1, strokeStyle: "solid", roughness: 0, opacity: 100,
          groupIds: [g], frameId: null, roundness: null, seed: 3, version: 1, versionNonce: 3, isDeleted: false, boundElements: null, updated: Date.now(), link: null, locked: false,
          text: sheetName, fontSize: 15, fontFamily: 1, textAlign: "left", verticalAlign: "top", containerId: r1, originalText: sheetName, autoResize: true, lineHeight: 1.25 as any,
        },
        {
          id: t2, type: "text", x: 8, y: 34, width: 200, height: 100, angle: 0,
          strokeColor: "#1e1e1e", backgroundColor: "transparent", fillStyle: "solid", strokeWidth: 1, strokeStyle: "solid", roughness: 0, opacity: 100,
          groupIds: [g], frameId: null, roundness: null, seed: 4, version: 1, versionNonce: 4, isDeleted: false, boundElements: null, updated: Date.now(), link: null, locked: false,
          text: fieldText, fontSize: 12, fontFamily: 1, textAlign: "left", verticalAlign: "top", containerId: r2, originalText: fieldText, autoResize: true, lineHeight: 1.25 as any,
        },
      ],
      appState: { viewBackgroundColor: "#ffffff" },
      files: {},
    };

    const tabId = uid();
    store.project.tabs.push({ id: tabId, name: sheetName, scene });
    store.project.activeTabId = tabId;
  }
  store.setDirty(true);
  store.initProject({ ...store.project });
}