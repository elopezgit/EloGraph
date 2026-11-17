import type { Project } from "../types/document";

export async function openProjectFile(): Promise<{ project: Project; handle: any } | null> {
  try {
    if ("showOpenFilePicker" in window) {
      const [handle] = await (window as any).showOpenFilePicker({
        types: [{ description: "CensysDesigne", accept: { "application/json": [".cdsgn", ".pdisg", ".json"] } }],
        multiple: false,
      });
      const file = await handle.getFile();
      const text = await file.text();
      const project = JSON.parse(text) as Project;
      return { project, handle };
    }
  } catch (e) {
    if ((e as any)?.name === "AbortError") return null;
  }
  // fallback
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdisg,.json,application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      const text = await file.text();
      try {
        resolve({ project: JSON.parse(text) as Project, handle: null });
      } catch {
        resolve(null);
      }
    };
    input.click();
  });
}

export async function saveProjectFile(project: Project, handle: any): Promise<any> {
  const data = JSON.stringify(project, null, 2);
  const blob = new Blob([data], { type: "application/json" });

  if (handle && "createWritable" in handle) {
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return handle;
  }

  if ("showSaveFilePicker" in window) {
    try {
      const newHandle = await (window as any).showSaveFilePicker({
        suggestedName: `${project.meta.title || "proyecto"}.cdsgn`,
        types: [{ description: "CensysDesigne", accept: { "application/json": [".cdsgn", ".pdisg"] } }],
      });
      const writable = await newHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      return newHandle;
    } catch (e) {
      if ((e as any)?.name === "AbortError") return handle;
    }
  }

  // fallback download
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${project.meta.title || "proyecto"}.cdsgn`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return handle;
}