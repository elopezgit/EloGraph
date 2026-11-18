import { useDocumentStore } from "../store/useDocumentStore";
import { useEffect, useState, type DragEvent } from "react";
import {
  getBuiltinLoadErrors,
  listFixedLibraries,
  onLibrariesChanged,
  type BuiltinLoadError,
  type FixedLibrary,
} from "../lib/fixedLibraries";
import { integrateLibrary, unintegrateLibrary } from "../lib/libraryIntegration";
import { libraryItemPreview } from "../lib/libraryPreview";
import { prepareLibraryElements } from "../lib/libraryElements";
import { PieceThumb, PanelIcon } from "./PieceThumb";
import { DRAG_MIME, setPieceDrag, clearPieceDrag } from "../lib/dragPiece";
import {
  LIBRARY_SITE_URL,
  fetchLibraryItems,
  fetchRemoteCatalog,
  isDirectLibraryUrl,
  isLibrarySiteUrl,
  isValidLibraryUrl,
  libraryItemsFromData,
  type RemoteLibrary,
} from "../lib/libraryUrl";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function sceneCenter(appState: any) {
  const zoom = appState?.zoom?.value ?? 1;
  const sx = appState?.scrollX ?? 0;
  const sy = appState?.scrollY ?? 0;
  return { x: 400 / zoom - sx, y: 300 / zoom - sy };
}

function base(id: string, type: string, x: number, y: number, w: number, h: number, opts: any = {}) {
  return {
    id,
    type,
    x,
    y,
    width: w,
    height: h,
    angle: 0,
    strokeColor: opts.stroke ?? "#1e1e1e",
    backgroundColor: opts.fill ?? "transparent",
    fillStyle: "solid",
    strokeWidth: opts.sw ?? 2,
    strokeStyle: opts.dashed ? "dashed" : "solid",
    roughness: 0,
    opacity: 100,
    groupIds: opts.group ? [opts.group] : [],
    frameId: null,
    roundness: opts.rounded ? { type: 3 } : null,
    seed: Math.floor(Math.random() * 100000),
    version: 1,
    versionNonce: Math.floor(Math.random() * 100000),
    isDeleted: false,
    boundElements: opts.bound ?? null,
    updated: Date.now(),
    link: null,
    locked: false,
  };
}

function textBound(id: string, containerId: string, content: string, x: number, y: number, opts: any = {}) {
  return {
    id,
    type: "text",
    x,
    y,
    width: opts.width ?? 100,
    height: opts.height ?? 20,
    angle: 0,
    strokeColor: opts.color ?? "#1e1e1e",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 1,
    strokeStyle: "solid",
    roughness: 0,
    opacity: 100,
    groupIds: opts.group ? [opts.group] : [],
    frameId: null,
    roundness: null,
    seed: Math.floor(Math.random() * 100000),
    version: 1,
    versionNonce: Math.floor(Math.random() * 100000),
    isDeleted: false,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    text: content,
    fontSize: opts.fontSize ?? 16,
    fontFamily: 1,
    textAlign: opts.align ?? "left",
    verticalAlign: opts.valign ?? "top",
    containerId,
    originalText: content,
    autoResize: true,
    lineHeight: 1.25 as any,
  };
}

function lineEl(id: string, x: number, y: number, w: number, opts: any = {}) {
  return {
    ...base(id, "line", x, y, w, 0, { group: opts.group, stroke: opts.stroke ?? "#1e1e1e", sw: opts.sw ?? 1 }),
    points: [[0, 0], [w, 0]],
  };
}

export function SidePanel() {
  const project = useDocumentStore((s) => s.project);
  const activeTab = useDocumentStore((s) => s.getActiveTab());
  const excalidrawApis = useDocumentStore((s) => s.excalidrawApis);
  const addCatalog = useDocumentStore((s) => s.addCatalog);
  const removeCatalog = useDocumentStore((s) => s.removeCatalog);
  const updateCatalog = useDocumentStore((s) => s.updateCatalog);
  const addCatalogItem = useDocumentStore((s) => s.addCatalogItem);
  const removeCatalogItem = useDocumentStore((s) => s.removeCatalogItem);

  const api = activeTab ? excalidrawApis[activeTab.id] : null;
  const [panelOpen, setPanelOpen] = useState(true);
  const [searchOpen, setSearchOpen] = useState(true);
  const [search, setSearch] = useState("");
  const [openCats, setOpenCats] = useState<Record<string, boolean>>({
    "UML Estructural": true,
    "UML Comportamiento": false,
    "Base de Datos": false,
    "Procesos / BPMN": false,
    "Flechas y relaciones": false,
    "General": false,
    "Plantillas": false,
    "Biblioteca": false,
    "Integradas": true,
    "Catálogos": false,
  });
  const [libraryUrl, setLibraryUrl] = useState("");
  const [remoteLibs, setRemoteLibs] = useState<RemoteLibrary[] | null>(null);
  const [remoteSearch, setRemoteSearch] = useState("");
  const [libraryStatus, setLibraryStatus] = useState("");
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [fixedLibs, setFixedLibs] = useState<FixedLibrary[]>([]);
  const [expandedLibs, setExpandedLibs] = useState<Record<string, boolean>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [builtinErrors, setBuiltinErrors] = useState<BuiltinLoadError[]>([]);

  const toggleLib = (lib: FixedLibrary) => {
    const next = !expandedLibs[lib.id];
    setExpandedLibs((s) => ({ ...s, [lib.id]: next }));
    if (next) {
      void Promise.all(lib.items.map((item) => libraryItemPreview(item))).then((list) => {
        setPreviews((prev) => {
          const merged = { ...prev };
          lib.items.forEach((item, i) => { merged[item.id] = list[i]; });
          return merged;
        });
      });
    }
  };

  const openExcalidrawLibrary = () => {
    if (!api) { setLibraryStatus("Canvas no disponible"); return; }
    void api.updateLibrary({ libraryItems: [], merge: true, openLibraryMenu: true });
  };

  const insertLibraryItem = (item: any, pt?: { x: number; y: number }) => {
    insertAt(prepareLibraryElements(item.elements), [], pt);
  };

  const refreshFixedLibs = () => {
    void listFixedLibraries()
      .then((libs) => {
        setFixedLibs(libs);
        setBuiltinErrors(getBuiltinLoadErrors());
      })
      .catch(() => {});
  };

  useEffect(() => {
    refreshFixedLibs();
    const off = onLibrariesChanged(refreshFixedLibs);
    return off;
  }, []);

  const insertAt = (elements: any[], selectedIds: string[], pt?: { x: number; y: number }) => {
    if (!api) { setLibraryStatus("Canvas no disponible"); return; }
    try {
      const existing = api.getSceneElements() || [];
      const appState = api.getAppState() || {};
      const center = pt ?? sceneCenter(appState);
      const offsetEls = elements.map((e) => ({ ...e, x: (e.x || 0) + center.x, y: (e.y || 0) + center.y }));
      const selected: Record<string, true> = {};
      selectedIds.forEach((id) => (selected[id] = true));
      api.updateScene({
        elements: [...existing, ...offsetEls],
        appState: { ...appState, selectedElementIds: selected },
      });
    } catch (err) {
      console.error("insert error", err);
      setLibraryStatus("Error al insertar: " + ((err as any)?.message || ""));
    }
  };

  // helper to wrap insert with drop support
  const mkInsert = (fn: (pt?: { x: number; y: number }) => { els: any[]; sel: string[] }) => {
    return (pt?: { x: number; y: number }) => {
      const { els, sel } = fn(pt);
      insertAt(els, sel, pt);
    };
  };

  // ---------- UML Estructural ----------

  const insClass = mkInsert(() => {
    const g = uid();
    const r1 = uid(), r2 = uid(), r3 = uid(), t1 = uid(), t2 = uid(), t3 = uid();
    return {
      els: [
        base(r1, "rectangle", 0, 0, 200, 30, { group: g, fill: "#eef4ff", bound: [{ id: t1, type: "text" }] }),
        base(r2, "rectangle", 0, 30, 200, 42, { group: g, fill: "#ffffff", bound: [{ id: t2, type: "text" }] }),
        base(r3, "rectangle", 0, 72, 200, 42, { group: g, fill: "#ffffff", bound: [{ id: t3, type: "text" }] }),
        textBound(t1, r1, "ClassName", 8, 6, { group: g, fontSize: 15 }),
        textBound(t2, r2, "- attr: type", 8, 34, { group: g, fontSize: 12 }),
        textBound(t3, r3, "+ method()", 8, 76, { group: g, fontSize: 12 }),
      ],
      sel: [r1],
    };
  });

  const insAbstractClass = mkInsert(() => {
    const g = uid();
    const r1 = uid(), r2 = uid(), r3 = uid(), t1 = uid(), t2 = uid(), t3 = uid();
    return {
      els: [
        base(r1, "rectangle", 0, 0, 200, 30, { group: g, fill: "#eef4ff", bound: [{ id: t1, type: "text" }] }),
        base(r2, "rectangle", 0, 30, 200, 42, { group: g, fill: "#ffffff", bound: [{ id: t2, type: "text" }] }),
        base(r3, "rectangle", 0, 72, 200, 42, { group: g, fill: "#ffffff", bound: [{ id: t3, type: "text" }] }),
        textBound(t1, r1, "<<abstract>>\nAbstractClass", 8, 2, { group: g, fontSize: 14 }),
        textBound(t2, r2, "- attr: type", 8, 34, { group: g, fontSize: 12 }),
        textBound(t3, r3, "+ method()", 8, 76, { group: g, fontSize: 12 }),
      ],
      sel: [r1],
    };
  });

  const insInterface = mkInsert(() => {
    const g = uid();
    const r1 = uid(), r2 = uid(), t1 = uid(), t2 = uid();
    return {
      els: [
        base(r1, "rectangle", 0, 0, 200, 30, { group: g, fill: "#f3e8ff", bound: [{ id: t1, type: "text" }] }),
        base(r2, "rectangle", 0, 30, 200, 50, { group: g, fill: "#ffffff", bound: [{ id: t2, type: "text" }] }),
        textBound(t1, r1, "<<interface>>\nIService", 8, 2, { group: g, fontSize: 14 }),
        textBound(t2, r2, "+ doSomething()", 8, 34, { group: g, fontSize: 12 }),
      ],
      sel: [r1],
    };
  });

  const insEnum = mkInsert(() => {
    const g = uid();
    const r1 = uid(), r2 = uid(), t1 = uid(), t2 = uid();
    return {
      els: [
        base(r1, "rectangle", 0, 0, 180, 30, { group: g, fill: "#fff7e6", bound: [{ id: t1, type: "text" }] }),
        base(r2, "rectangle", 0, 30, 180, 50, { group: g, fill: "#ffffff", bound: [{ id: t2, type: "text" }] }),
        textBound(t1, r1, "<<enumeration>>\nStatus", 8, 2, { group: g, fontSize: 14 }),
        textBound(t2, r2, "ACTIVE\nINACTIVE", 8, 34, { group: g, fontSize: 12 }),
      ],
      sel: [r1],
    };
  });

  const insPackage = mkInsert(() => {
    const g = uid();
    const p = uid(), b = uid(), t = uid();
    return {
      els: [
        base(p, "rectangle", 0, 0, 60, 20, { group: g, fill: "#f1f5f9", sw: 2 }),
        base(b, "rectangle", 0, 20, 200, 120, { group: g, fill: "#f8fafc", bound: [{ id: t, type: "text" }] }),
        textBound(t, b, "PackageName", 8, 24, { group: g, fontSize: 14 }),
      ],
      sel: [b],
    };
  });

  const insComponent = mkInsert(() => {
    const g = uid();
    const r = uid(), t = uid();
    return {
      els: [
        base(r, "rectangle", 0, 0, 160, 60, { group: g, fill: "#e0f2fe", rounded: true, bound: [{ id: t, type: "text" }] }),
        textBound(t, r, "<<component>>\nComponent", 8, 8, { group: g, fontSize: 13, align: "center" }),
      ],
      sel: [r],
    };
  });

  const insNode = mkInsert(() => {
    const g = uid();
    const r = uid(), t = uid();
    return {
      els: [
        base(r, "rectangle", 0, 0, 150, 90, { group: g, fill: "#fef3c7" }),
        base(uid(), "rectangle", 0, 0, 150, 20, { group: g, fill: "#fde68a" }),
        textBound(t, r, "<<device>>\nNode", 8, 24, { group: g, fontSize: 13 }),
      ],
      sel: [r],
    };
  });

  const insObject = mkInsert(() => {
    const g = uid();
    const r = uid(), t = uid();
    return {
      els: [
        base(r, "rectangle", 0, 0, 180, 60, { group: g, fill: "#ffffff", bound: [{ id: t, type: "text" }] }),
        textBound(t, r, "obj: Class\nattr = value", 8, 8, { group: g, fontSize: 13 }),
      ],
      sel: [r],
    };
  });

  // ---------- UML Comportamiento ----------

  const insUseCase = mkInsert(() => {
    const g = uid();
    const e = uid(), t = uid();
    return {
      els: [
        base(e, "ellipse", 0, 0, 160, 70, { group: g, fill: "#eef4ff", bound: [{ id: t, type: "text" }] }),
        textBound(t, e, "Caso de uso", 20, 22, { group: g, fontSize: 13, align: "center" }),
      ],
      sel: [e],
    };
  });

  const insActor = mkInsert(() => {
    const g = uid();
    const head = uid();
    const b1 = uid(), b2 = uid(), b3 = uid(), b4 = uid();
    const t = uid();
    return {
      els: [
        base(head, "ellipse", 60, 0, 40, 40, { group: g, fill: "#fff7e6" }),
        { ...base(b1, "line", 80, 40, 0, 60, { group: g }), points: [[0, 0], [0, 60]] },
        { ...base(b2, "line", 50, 60, 60, 0, { group: g }), points: [[0, 0], [60, 0]] },
        { ...base(b3, "line", 80, 100, -25, 40, { group: g }), points: [[0, 0], [-25, 40]] },
        { ...base(b4, "line", 80, 100, 25, 40, { group: g }), points: [[0, 0], [25, 40]] },
        textBound(t, head, "Actor", 55, 145, { group: g, fontSize: 13 }),
      ],
      sel: [head],
    };
  });

  const insSystem = mkInsert(() => {
    const g = uid();
    const r = uid(), t = uid();
    return {
      els: [
        base(r, "rectangle", 0, 0, 260, 200, { group: g, fill: "transparent", sw: 2, dashed: true }),
        textBound(t, r, "Sistema", 8, 4, { group: g, fontSize: 13 }),
      ],
      sel: [r],
    };
  });

  const insLifeline = mkInsert(() => {
    const g = uid();
    const r = uid(), l = uid(), t = uid();
    return {
      els: [
        base(r, "rectangle", 0, 0, 120, 40, { group: g, fill: "#eef4ff", bound: [{ id: t, type: "text" }] }),
        { ...base(l, "line", 60, 40, 0, 160, { group: g, stroke: "#94a3b8", sw: 1, dashed: true }), points: [[0, 0], [0, 160]] },
        textBound(t, r, "Objeto", 8, 10, { group: g, fontSize: 13, align: "center" }),
      ],
      sel: [r],
    };
  });

  const insActivation = mkInsert(() => {
    const g = uid();
    const r = uid();
    return {
      els: [base(r, "rectangle", 0, 0, 16, 80, { group: g, fill: "#bfdbfe", sw: 1 })],
      sel: [r],
    };
  });

  const insFragment = mkInsert(() => {
    const g = uid();
    const r = uid(), t = uid();
    return {
      els: [
        base(r, "rectangle", 0, 0, 220, 120, { group: g, fill: "transparent", sw: 1, dashed: true }),
        textBound(t, r, "alt", 4, 2, { group: g, fontSize: 12 }),
        lineEl(uid(), 0, 20, 220, { group: g, stroke: "#94a3b8", sw: 1 }),
      ],
      sel: [r],
    };
  });

  // ---------- Base de Datos ----------

  const insTable = mkInsert(() => {
    const g = uid();
    const r1 = uid(), r2 = uid(), t1 = uid(), t2 = uid();
    return {
      els: [
        base(r1, "rectangle", 0, 0, 220, 30, { group: g, fill: "#e8f5e9", bound: [{ id: t1, type: "text" }] }),
        base(r2, "rectangle", 0, 30, 220, 80, { group: g, fill: "#ffffff", bound: [{ id: t2, type: "text" }] }),
        textBound(t1, r1, "table_name", 8, 6, { group: g, fontSize: 14 }),
        textBound(t2, r2, "PK id : int\nFK other_id : int\nname : varchar", 8, 34, { group: g, fontSize: 12 }),
      ],
      sel: [r1],
    };
  });

  const insEntity = mkInsert(() => {
    const g = uid();
    const r = uid(), t = uid();
    return {
      els: [
        base(r, "rectangle", 0, 0, 140, 60, { group: g, fill: "#e8f5e9", bound: [{ id: t, type: "text" }] }),
        textBound(t, r, "Entidad", 8, 8, { group: g, fontSize: 14, align: "center" }),
      ],
      sel: [r],
    };
  });

  const insWeakEntity = mkInsert(() => {
    const g = uid();
    const r1 = uid(), r2 = uid(), t = uid();
    return {
      els: [
        base(r1, "rectangle", 0, 0, 150, 70, { group: g, fill: "#e8f5e9", sw: 1 }),
        base(r2, "rectangle", 6, 6, 138, 58, { group: g, fill: "#e8f5e9", sw: 2, bound: [{ id: t, type: "text" }] }),
        textBound(t, r2, "Entidad débil", 12, 14, { group: g, fontSize: 13, align: "center" }),
      ],
      sel: [r2],
    };
  });

  const insRelationship = mkInsert(() => {
    const g = uid();
    const d = uid(), t = uid();
    return {
      els: [
        base(d, "diamond", 0, 0, 100, 60, { group: g, fill: "#fff7e6", bound: [{ id: t, type: "text" }] }),
        textBound(t, d, "relación", 20, 20, { group: g, fontSize: 12, align: "center" }),
      ],
      sel: [d],
    };
  });

  const insAttribute = mkInsert(() => {
    const g = uid();
    const e = uid(), t = uid();
    return {
      els: [
        base(e, "ellipse", 0, 0, 110, 40, { group: g, fill: "#ffffff", bound: [{ id: t, type: "text" }] }),
        textBound(t, e, "atributo", 14, 10, { group: g, fontSize: 12, align: "center" }),
      ],
      sel: [e],
    };
  });

  const insKeyAttribute = mkInsert(() => {
    const g = uid();
    const e = uid(), t = uid();
    return {
      els: [
        base(e, "ellipse", 0, 0, 110, 40, { group: g, fill: "#ffffff", bound: [{ id: t, type: "text" }] }),
        { ...base(uid(), "line", 14, 28, 82, 0, { group: g, stroke: "#1e1e1e", sw: 1 }), points: [[0, 0], [82, 0]] },
        textBound(t, e, "id", 40, 10, { group: g, fontSize: 12, align: "center" }),
      ],
      sel: [e],
    };
  });

  const insView = mkInsert(() => {
    const g = uid();
    const r = uid(), t = uid();
    return {
      els: [
        base(r, "rectangle", 0, 0, 180, 50, { group: g, fill: "#e0f2fe", bound: [{ id: t, type: "text" }] }),
        textBound(t, r, "<<view>>\nview_name", 8, 6, { group: g, fontSize: 13 }),
      ],
      sel: [r],
    };
  });

  // ---------- Procesos / BPMN ----------

  const insTask = mkInsert(() => {
    const g = uid();
    const r = uid(), t = uid();
    return {
      els: [
        base(r, "rectangle", 0, 0, 150, 60, { group: g, fill: "#e6f7ff", rounded: true, bound: [{ id: t, type: "text" }] }),
        textBound(t, r, "Tarea", 10, 18, { group: g, fontSize: 13, align: "center" }),
      ],
      sel: [r],
    };
  });

  const insSubprocess = mkInsert(() => {
    const g = uid();
    const r = uid(), t = uid();
    return {
      els: [
        base(r, "rectangle", 0, 0, 150, 60, { group: g, fill: "#e6f7ff", rounded: true, bound: [{ id: t, type: "text" }] }),
        base(uid(), "rectangle", 120, 42, 16, 12, { group: g, fill: "#ffffff", sw: 1 }),
        textBound(t, r, "Subproceso", 10, 18, { group: g, fontSize: 13, align: "center" }),
      ],
      sel: [r],
    };
  });

  const insStartEvent = mkInsert(() => {
    const g = uid();
    const e = uid();
    return { els: [base(e, "ellipse", 0, 0, 40, 40, { group: g, fill: "#dcfce7", sw: 2 })], sel: [e] };
  });

  const insEndEvent = mkInsert(() => {
    const g = uid();
    const e = uid();
    return { els: [base(e, "ellipse", 0, 0, 40, 40, { group: g, fill: "#fee2e2", sw: 4 })], sel: [e] };
  });

  const insIntermediateEvent = mkInsert(() => {
    const g = uid();
    const e1 = uid(), e2 = uid();
    return {
      els: [
        base(e1, "ellipse", 0, 0, 40, 40, { group: g, fill: "#ffffff", sw: 2 }),
        base(e2, "ellipse", 4, 4, 32, 32, { group: g, fill: "#ffffff", sw: 1 }),
      ],
      sel: [e1],
    };
  });

  const insGatewayXor = mkInsert(() => {
    const g = uid();
    const d = uid();
    return {
      els: [
        base(d, "diamond", 0, 0, 50, 50, { group: g, fill: "#fff7e6", bound: null }),
        { ...base(uid(), "line", 12, 12, 26, 26, { group: g, stroke: "#1e1e1e", sw: 2 }), points: [[0, 0], [26, 26]] },
        { ...base(uid(), "line", 12, 38, 26, -26, { group: g, stroke: "#1e1e1e", sw: 2 }), points: [[0, 0], [26, -26]] },
      ],
      sel: [d],
    };
  });

  const insGatewayPar = mkInsert(() => {
    const g = uid();
    const d = uid();
    return {
      els: [
        base(d, "diamond", 0, 0, 50, 50, { group: g, fill: "#fff7e6" }),
        { ...base(uid(), "line", 25, 8, 0, 34, { group: g, stroke: "#1e1e1e", sw: 2 }), points: [[0, 0], [0, 34]] },
        { ...base(uid(), "line", 8, 25, 34, 0, { group: g, stroke: "#1e1e1e", sw: 2 }), points: [[0, 0], [34, 0]] },
      ],
      sel: [d],
    };
  });

  const insPool = mkInsert(() => {
    const g = uid();
    const r = uid(), t = uid();
    return {
      els: [
        base(r, "rectangle", 0, 0, 300, 120, { group: g, fill: "#f1f5f9", sw: 2 }),
        base(uid(), "rectangle", 0, 0, 30, 120, { group: g, fill: "#e2e8f0", sw: 1 }),
        textBound(t, r, "Pool", 4, 4, { group: g, fontSize: 12 }),
      ],
      sel: [r],
    };
  });

  // ---------- General / Flechas ----------

  const mkArrow = (opts: any) => mkInsert(() => {
    const g = uid();
    const a = uid();
    return {
      els: [
        {
          ...base(a, "arrow", 0, 0, 120, 0, { group: g, stroke: opts.stroke ?? "#1e1e1e", dashed: opts.dashed }),
          points: [[0, 0], [120, 0]],
          lastCommittedPoint: null,
          startBinding: null,
          endBinding: null,
          startArrowhead: opts.startHead ?? null,
          endArrowhead: opts.endHead ?? "arrow",
        },
      ],
      sel: [a],
    };
  });

  const insArrow = mkArrow({});
  const insComposition = mkArrow({ startHead: "diamond", stroke: "#1e1e1e" });
  const insAggregation = mkArrow({ startHead: "diamond", stroke: "#1e1e1e", dashed: false });
  const insInheritance = mkArrow({ endHead: "triangle", stroke: "#1e1e1e" });
  const insRealization = mkArrow({ endHead: "triangle", stroke: "#1e1e1e", dashed: true });
  const insDependency = mkArrow({ endHead: "arrow", stroke: "#1e1e1e", dashed: true });
  const insComment = mkInsert(() => {
    const g = uid();
    const r = uid(), t = uid();
    return {
      els: [
        base(r, "rectangle", 0, 0, 180, 70, { group: g, fill: "#fffbe6", bound: [{ id: t, type: "text" }] }),
        textBound(t, r, "Comentario", 10, 10, { group: g, fontSize: 13 }),
      ],
      sel: [r],
    };
  });
  const insNote = insComment;

  // ---------- Plantillas ----------

  const templateClass = () => {
    const g = uid();
    const els: any[] = [];
    const makeClass = (ox: number, oy: number, name: string) => {
      const r1 = uid(), r2 = uid(), r3 = uid(), t1 = uid(), t2 = uid(), t3 = uid();
      els.push(
        base(r1, "rectangle", ox, oy, 180, 28, { group: g, fill: "#eef4ff", bound: [{ id: t1, type: "text" }] }),
        base(r2, "rectangle", ox, oy + 28, 180, 36, { group: g, fill: "#ffffff", bound: [{ id: t2, type: "text" }] }),
        base(r3, "rectangle", ox, oy + 64, 180, 36, { group: g, fill: "#ffffff", bound: [{ id: t3, type: "text" }] }),
        textBound(t1, r1, name, ox + 8, oy + 4, { group: g, fontSize: 14 }),
        textBound(t2, r2, "- id: int", ox + 8, oy + 32, { group: g, fontSize: 12 }),
        textBound(t3, r3, "+ getId()", ox + 8, oy + 68, { group: g, fontSize: 12 }),
      );
    };
    makeClass(0, 0, "Persona");
    makeClass(260, 0, "Direccion");
    const a = uid();
    els.push({
      ...base(a, "arrow", 180, 30, 80, 0, { group: g, stroke: "#1e1e1e" }),
      points: [[0, 0], [80, 0]],
      lastCommittedPoint: null, startBinding: null, endBinding: null, startArrowhead: null, endArrowhead: "arrow",
    });
    insertAt(els, [], undefined);
  };

  const templateEr = () => {
    const g = uid();
    const els: any[] = [];
    const makeTable = (ox: number, oy: number, name: string, fields: string) => {
      const r1 = uid(), r2 = uid(), t1 = uid(), t2 = uid();
      els.push(
        base(r1, "rectangle", ox, oy, 200, 28, { group: g, fill: "#e8f5e9", bound: [{ id: t1, type: "text" }] }),
        base(r2, "rectangle", ox, oy + 28, 200, 60, { group: g, fill: "#ffffff", bound: [{ id: t2, type: "text" }] }),
        textBound(t1, r1, name, ox + 8, oy + 4, { group: g, fontSize: 14 }),
        textBound(t2, r2, fields, ox + 8, oy + 32, { group: g, fontSize: 12 }),
      );
    };
    makeTable(0, 0, "cliente", "PK id\nnombre\nemail");
    makeTable(280, 0, "pedido", "PK id\nFK cliente_id\nfecha");
    const a = uid();
    els.push({
      ...base(a, "arrow", 200, 40, 80, 0, { group: g, stroke: "#1e1e1e" }),
      points: [[0, 0], [80, 0]],
      lastCommittedPoint: null, startBinding: null, endBinding: null, startArrowhead: null, endArrowhead: "arrow",
    });
    insertAt(els, [], undefined);
  };

  const templateUseCase = () => {
    const g = uid();
    const els: any[] = [];
    const sys = uid();
    els.push(base(sys, "rectangle", 120, 0, 260, 220, { group: g, fill: "transparent", sw: 2, dashed: true }));
    els.push(textBound(uid(), sys, "Sistema", 128, 4, { group: g, fontSize: 13 }));
    // use cases
    const uc1 = uid(), uc2 = uid(), t1 = uid(), t2 = uid();
    els.push(
      base(uc1, "ellipse", 170, 40, 160, 60, { group: g, fill: "#eef4ff", bound: [{ id: t1, type: "text" }] }),
      textBound(t1, uc1, "Login", 200, 60, { group: g, fontSize: 13, align: "center" }),
      base(uc2, "ellipse", 170, 130, 160, 60, { group: g, fill: "#eef4ff", bound: [{ id: t2, type: "text" }] }),
      textBound(t2, uc2, "Consultar", 180, 150, { group: g, fontSize: 13, align: "center" }),
    );
    // actor
    const head = uid();
    els.push(base(head, "ellipse", 20, 90, 40, 40, { group: g, fill: "#fff7e6" }));
    insertAt(els, [], undefined);
  };

  const templateSequence = () => {
    const g = uid();
    const els: any[] = [];
    const makeLifeline = (ox: number, name: string) => {
      const r = uid(), l = uid(), t = uid();
      els.push(
        base(r, "rectangle", ox, 0, 120, 40, { group: g, fill: "#eef4ff", bound: [{ id: t, type: "text" }] }),
        { ...base(l, "line", ox + 60, 40, 0, 160, { group: g, stroke: "#94a3b8", sw: 1, dashed: true }), points: [[0, 0], [0, 160]] },
        textBound(t, r, name, ox + 8, 10, { group: g, fontSize: 13, align: "center" }),
      );
    };
    makeLifeline(0, "Cliente");
    makeLifeline(180, "Sistema");
    const a = uid();
    els.push({
      ...base(a, "arrow", 60, 20, 180, 0, { group: g, stroke: "#1e1e1e" }),
      points: [[0, 0], [180, 0]],
      lastCommittedPoint: null, startBinding: null, endBinding: null, startArrowhead: null, endArrowhead: "arrow",
    });
    insertAt(els, [], undefined);
  };

  const templateBpmn = () => {
    const g = uid();
    const els: any[] = [];
    const start = uid();
    els.push(base(start, "ellipse", 0, 40, 40, 40, { group: g, fill: "#dcfce7", sw: 2 }));
    const t1 = uid(), tt1 = uid();
    els.push(base(t1, "rectangle", 80, 30, 120, 60, { group: g, fill: "#e6f7ff", rounded: true, bound: [{ id: tt1, type: "text" }] }));
    els.push(textBound(tt1, t1, "Tarea", 90, 48, { group: g, fontSize: 13, align: "center" }));
    const gw = uid();
    els.push(base(gw, "diamond", 240, 30, 60, 60, { group: g, fill: "#fff7e6" }));
    const end = uid();
    els.push(base(end, "ellipse", 340, 40, 40, 40, { group: g, fill: "#fee2e2", sw: 4 }));
    // arrows
    const a1 = uid(), a2 = uid(), a3 = uid();
    els.push(
      { ...base(a1, "arrow", 40, 60, 40, 0, { group: g }), points: [[0, 0], [40, 0]], lastCommittedPoint: null, startBinding: null, endBinding: null, startArrowhead: null, endArrowhead: "arrow" },
      { ...base(a2, "arrow", 200, 60, 40, 0, { group: g }), points: [[0, 0], [40, 0]], lastCommittedPoint: null, startBinding: null, endBinding: null, startArrowhead: null, endArrowhead: "arrow" },
      { ...base(a3, "arrow", 300, 60, 40, 0, { group: g }), points: [[0, 0], [40, 0]], lastCommittedPoint: null, startBinding: null, endBinding: null, startArrowhead: null, endArrowhead: "arrow" },
    );
    insertAt(els, [], undefined);
  };

  // ---------- Biblioteca ----------

  const exportLibrary = () => {
    if (!api) return;
    const els = api.getSceneElements();
    const appState = api.getAppState();
    const selected = appState.selectedElementIds || {};
    const chosen = els.filter((e: any) => selected[e.id]);
    if (chosen.length === 0) { setLibraryStatus("Selecciona elementos primero"); return; }
    const blob = new Blob([JSON.stringify({ type: "excalidrawlib", version: 2, source: "elograph", libraryItems: [{ id: uid(), status: "published", elements: chosen }] }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "elograph-library.excalidrawlib";
    a.click();
    URL.revokeObjectURL(url);
  };

  const importLibrary = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".excalidrawlib,.json";
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      const text = await f.text();
      try {
        const data = JSON.parse(text.replace(/^\uFEFF/, ""));
        const items = libraryItemsFromData(data);
        if (!items.length) { setLibraryStatus("Sin elementos en la librería"); return; }
        await integrateLibrary({ name: f.name.replace(/\.(excalidrawlib|json)$/i, ""), items, api });
        refreshFixedLibs();
        setLibraryStatus(`«${f.name}» integrada como librería fija (${items.length} pieza(s))`);
      } catch (err) {
        setLibraryStatus("Archivo inválido: " + ((err as any)?.message || ""));
      }
    };
    input.click();
  };

  const addRemoteLibrary = async (url: string, name: string) => {
    setLibraryLoading(true);
    setLibraryStatus("Descargando e integrando librería…");
    try {
      const items = await fetchLibraryItems(url);
      await integrateLibrary({ name, items, sourceUrl: url, api });
      refreshFixedLibs();
      setLibraryStatus(`«${name}» integrada y fijada (${items.length} pieza(s))`);
    } catch (err) {
      setLibraryStatus("Error: " + ((err as any)?.message || "No se pudo importar"));
    } finally {
      setLibraryLoading(false);
    }
  };

  const loadLibraryFromUrl = async () => {
    const value = libraryUrl.trim();
    if (!value) {
      setLibraryStatus("Pega una URL de librería para continuar");
      return;
    }
    if (!isValidLibraryUrl(value)) {
      setLibraryStatus("URL no válida");
      return;
    }
    if (isDirectLibraryUrl(value)) {
      await addRemoteLibrary(value, "Librería externa");
      return;
    }
    if (isLibrarySiteUrl(value)) {
      setLibraryLoading(true);
      setLibraryStatus("Cargando catálogo de Excalidraw…");
      try {
        const list = await fetchRemoteCatalog();
        setRemoteLibs(list);
        setLibraryStatus(`Catálogo listo (${list.length} librerías). Elige una para agregarla.`);
      } catch (err) {
        setLibraryStatus("Error: " + ((err as any)?.message || "No se pudo leer el catálogo"));
      } finally {
        setLibraryLoading(false);
      }
      return;
    }
    // Otros enlaces: se intenta descargar directamente como librería
    await addRemoteLibrary(value, "Librería externa");
  };

  const filteredRemoteLibs = remoteLibs?.filter((lib) =>
    `${lib.name} ${lib.description}`.toLowerCase().includes(remoteSearch.toLowerCase())
  );

  const insertImageFromFile = () => {
    if (!api) { setLibraryStatus("Canvas no disponible"); return; }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataURL = reader.result as string;
        const img = new Image();
        img.onload = () => {
          const fileId = uid();
          try {
            api.addFiles([
              {
                id: fileId,
                mimeType: file.type || "image/png",
                dataURL: dataURL as any,
                created: Date.now(),
                lastRetrieved: Date.now(),
              } as any,
            ]);
          } catch (e) {
            console.error(e);
          }
          const maxW = 400;
          const w = Math.min(img.width, maxW);
          const h = (img.height * w) / img.width;
          const el = {
            id: uid(),
            type: "image",
            x: 0,
            y: 0,
            width: w,
            height: h,
            angle: 0,
            strokeColor: "transparent",
            backgroundColor: "transparent",
            fillStyle: "solid",
            strokeWidth: 1,
            strokeStyle: "solid",
            roughness: 0,
            opacity: 100,
            groupIds: [],
            frameId: null,
            index: null,
            roundness: null,
            seed: Math.floor(Math.random() * 100000),
            version: 1,
            versionNonce: Math.floor(Math.random() * 100000),
            isDeleted: false,
            boundElements: null,
            updated: Date.now(),
            link: null,
            locked: false,
            fileId,
            status: "saved",
            scale: [1, 1],
          };
          const existing = api.getSceneElements() || [];
          const appState = api.getAppState() || {};
          const center = sceneCenter(appState);
          api.updateScene({
            elements: [...existing, { ...el, x: el.x + center.x, y: el.y + center.y }],
            appState,
          });
        };
        img.src = dataURL;
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  // ---------- Categorías ----------

  type ShapeItem = { name: string; icon: string; fn: (pt?: { x: number; y: number }) => void };
  type Category = { name: string; items: ShapeItem[] };

  const categories: Category[] = [
    {
      name: "Imagen",
      items: [{ name: "Insertar imagen", icon: "🖼", fn: insertImageFromFile }],
    },
    {
      name: "UML Estructural",
      items: [
        { name: "Clase", icon: "▭", fn: insClass },
        { name: "Clase abstracta", icon: "▭", fn: insAbstractClass },
        { name: "Interfaz", icon: "▭", fn: insInterface },
        { name: "Enumeración", icon: "▭", fn: insEnum },
        { name: "Paquete", icon: "📁", fn: insPackage },
        { name: "Componente", icon: "🧩", fn: insComponent },
        { name: "Nodo", icon: "🖥", fn: insNode },
        { name: "Objeto", icon: "▭", fn: insObject },
      ],
    },
    {
      name: "UML Comportamiento",
      items: [
        { name: "Caso de uso", icon: "⬭", fn: insUseCase },
        { name: "Actor", icon: "🧍", fn: insActor },
        { name: "Sistema", icon: "▭", fn: insSystem },
        { name: "Lifeline", icon: "▭", fn: insLifeline },
        { name: "Activación", icon: "▬", fn: insActivation },
        { name: "Fragmento", icon: "▭", fn: insFragment },
      ],
    },
    {
      name: "Base de Datos",
      items: [
        { name: "Tabla", icon: "▭", fn: insTable },
        { name: "Entidad", icon: "▭", fn: insEntity },
        { name: "Entidad débil", icon: "▭", fn: insWeakEntity },
        { name: "Relación", icon: "◇", fn: insRelationship },
        { name: "Atributo", icon: "⬭", fn: insAttribute },
        { name: "Atributo clave", icon: "⬭", fn: insKeyAttribute },
        { name: "Vista", icon: "▭", fn: insView },
      ],
    },
    {
      name: "Procesos / BPMN",
      items: [
        { name: "Tarea", icon: "▭", fn: insTask },
        { name: "Subproceso", icon: "▭", fn: insSubprocess },
        { name: "Evento inicio", icon: "○", fn: insStartEvent },
        { name: "Evento fin", icon: "●", fn: insEndEvent },
        { name: "Evento intermedio", icon: "◎", fn: insIntermediateEvent },
        { name: "Gateway XOR", icon: "◇", fn: insGatewayXor },
        { name: "Gateway AND", icon: "◇", fn: insGatewayPar },
        { name: "Pool", icon: "▭", fn: insPool },
      ],
    },
    {
      name: "Flechas y relaciones",
      items: [
        { name: "Asociación", icon: "→", fn: insArrow },
        { name: "Composición", icon: "◆→", fn: insComposition },
        { name: "Agregación", icon: "◇→", fn: insAggregation },
        { name: "Herencia", icon: "△→", fn: insInheritance },
        { name: "Realización", icon: "△- -", fn: insRealization },
        { name: "Dependencia", icon: "- - >", fn: insDependency },
      ],
    },
    {
      name: "General",
      items: [
        { name: "Comentario", icon: "▭", fn: insComment },
        { name: "Nota", icon: "▭", fn: insNote },
      ],
    },
  ];

  // Each category item name maps to the thumbnail shown in the library grid.
  const thumbFor: Record<string, string> = {
    "Selección": "selection",
    "Rectángulo": "rectangle",
    "Diamante": "diamond",
    "Elipse": "ellipse",
    "Flecha": "arrow",
    "Línea": "line",
    "Freedraw": "freedraw",
    "Texto": "text",
    "Imagen": "image",
    "Eraser": "eraser",
    "Frame": "frame",
    "Mano": "hand",
    "Insertar imagen": "image",
    "Clase": "class",
    "Clase abstracta": "abstractClass",
    "Interfaz": "interface",
    "Enumeración": "enum",
    "Paquete": "package",
    "Componente": "component",
    "Nodo": "node",
    "Objeto": "object",
    "Caso de uso": "useCase",
    "Actor": "actor",
    "Sistema": "system",
    "Lifeline": "lifeline",
    "Activación": "activation",
    "Fragmento": "fragment",
    "Tabla": "table",
    "Entidad": "entity",
    "Entidad débil": "weakEntity",
    "Relación": "relationship",
    "Atributo": "attribute",
    "Atributo clave": "keyAttribute",
    "Vista": "view",
    "Tarea": "task",
    "Subproceso": "subprocess",
    "Evento inicio": "startEvent",
    "Evento fin": "endEvent",
    "Evento intermedio": "intermediateEvent",
    "Gateway XOR": "gatewayXor",
    "Gateway AND": "gatewayPar",
    "Pool": "pool",
    "Asociación": "arrow",
    "Composición": "composition",
    "Agregación": "aggregation",
    "Herencia": "inheritance",
    "Realización": "realization",
    "Dependencia": "dependency",
    "Comentario": "comment",
    "Nota": "note",
  };

  const filtered = categories
    .map((c) => ({
      ...c,
      items: c.items.filter((it) => it.name.toLowerCase().includes(search.toLowerCase())),
    }))
    .filter((c) => c.items.length > 0);

  const toggleCat = (name: string) => setOpenCats((s) => ({ ...s, [name]: !s[name] }));

  const onDragStart = (e: DragEvent<HTMLButtonElement>, item: ShapeItem) => {
    setPieceDrag({ label: item.name, insert: item.fn });
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData(DRAG_MIME, item.name);
  };
  const onDragEnd = () => clearPieceDrag();

  const templates = [
    { name: "Diagrama de clases", fn: templateClass },
    { name: "Modelo ER", fn: templateEr },
    { name: "Casos de uso", fn: templateUseCase },
    { name: "Secuencia", fn: templateSequence },
    { name: "Proceso BPMN", fn: templateBpmn },
  ];

  const section = (name: string, count?: number) => (
    <button className="lib-section-head" onClick={() => toggleCat(name)}>
      <span className={`lib-chevron ${openCats[name] ? "is-open" : ""}`}>
        <PanelIcon name="chevron" size={14} />
      </span>
      <span className="lib-section-name">{name}</span>
      {count !== undefined && <span className="lib-count">{count}</span>}
    </button>
  );

  return (
    <aside className={`lib-panel ${panelOpen ? "" : "lib-panel--collapsed"}`} onDragEnd={onDragEnd}>
      <header className="lib-header">
        {panelOpen && <span className="lib-title">Biblioteca</span>}
        <div className="lib-header-actions">
          <button className="lib-icon-btn" title="Buscar" onClick={() => setSearchOpen((v) => !v)}>
            <PanelIcon name="search" size={16} />
          </button>
          <button
            className="lib-icon-btn"
            title={panelOpen ? "Ocultar panel" : "Mostrar panel"}
            onClick={() => setPanelOpen((v) => !v)}
          >
            <PanelIcon name="close" size={16} />
          </button>
        </div>
      </header>

      {panelOpen && (
        <div className="lib-body">
          {searchOpen && (
            <div className="lib-search">
              <PanelIcon name="search" size={15} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar pieza..."
                aria-label="Buscar pieza"
              />
              {search && (
                <button className="lib-search-clear" title="Limpiar" onClick={() => setSearch("")}>
                  <PanelIcon name="close" size={13} />
                </button>
              )}
            </div>
          )}

          <div className="lib-scroll">
            {filtered.map((cat) => (
              <section className="lib-section" key={cat.name}>
                {section(cat.name, cat.items.length)}
                {openCats[cat.name] && (
                  <div className="lib-grid">
                    {cat.items.map((it) => (
                      <button
                        key={it.name}
                        className="lib-tile"
                        onClick={() => it.fn()}
                        draggable
                        onDragStart={(e) => onDragStart(e, it)}
                        onDragEnd={onDragEnd}
                        title={it.name}
                      >
                        <PieceThumb kind={thumbFor[it.name] ?? "class"} />
                        <span className="lib-tile-plus"><PanelIcon name="plus" size={12} /></span>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            ))}
            {filtered.length === 0 && <p className="lib-empty">No se encontraron piezas.</p>}

            {!search && (
              <>
                <section className="lib-section lib-section--extra">
                  {section("Plantillas", templates.length)}
                  {openCats["Plantillas"] && (
                    <div className="lib-list">
                      {templates.map((t) => (
                        <button key={t.name} className="lib-list-item" onClick={t.fn}>
                          <span className="lib-list-dot" />
                          <span className="lib-list-label">{t.name}</span>
                          <PanelIcon name="plus" size={13} />
                        </button>
                      ))}
                    </div>
                  )}
                </section>

                <section className="lib-section lib-section--extra">
                  {section("Biblioteca")}
                  {openCats["Biblioteca"] && (
                    <>
                      <button
                        className="lib-integrate-btn"
                        disabled={libraryLoading}
                        onClick={async () => {
                          setLibraryLoading(true);
                          setLibraryStatus("Cargando catálogo de Excalidraw…");
                          try {
                            const list = await fetchRemoteCatalog();
                            setRemoteLibs(list);
                            setLibraryStatus(`Catálogo listo (${list.length} librerías). Elige una para integrarla.`);
                          } catch (err) {
                            setLibraryStatus("Error: " + ((err as any)?.message || "No se pudo leer el catálogo"));
                          } finally {
                            setLibraryLoading(false);
                          }
                        }}
                      >
                        <PanelIcon name="plus" size={15} /> Integrar librería online
                      </button>

                      <button className="lib-action lib-action--wide" onClick={openExcalidrawLibrary}>
                        Ver biblioteca de Excalidraw
                      </button>

                      <div className="lib-two">
                        <button className="lib-action" onClick={exportLibrary}>
                          <PanelIcon name="export" size={14} /> Exportar
                        </button>
                        <button className="lib-action" onClick={importLibrary}>
                          <PanelIcon name="import" size={14} /> Importar
                        </button>
                      </div>

                      <div className="lib-url-box">
                        <label className="lib-url-label" htmlFor="lib-url-input">
                          Integrar desde URL (.excalidrawlib)
                        </label>
                        <div className="lib-url-row">
                          <input
                            id="lib-url-input"
                            className="lib-input"
                            value={libraryUrl}
                            onChange={(e) => setLibraryUrl(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") void loadLibraryFromUrl();
                            }}
                            placeholder={LIBRARY_SITE_URL}
                            spellCheck={false}
                          />
                          <button
                            className="lib-url-btn"
                            onClick={() => void loadLibraryFromUrl()}
                            disabled={libraryLoading}
                            title="Cargar librería desde URL"
                          >
                            <PanelIcon name="plus" size={14} />
                          </button>
                        </div>
                        {libraryStatus && <p className="lib-url-status">{libraryStatus}</p>}

                        {remoteLibs && (
                          <div className="lib-remote">
                            <input
                              className="lib-input"
                              value={remoteSearch}
                              onChange={(e) => setRemoteSearch(e.target.value)}
                              placeholder="Buscar librería…"
                              aria-label="Buscar librería remota"
                            />
                            <div className="lib-remote-list">
                              {(filteredRemoteLibs || []).map((lib) => (
                                <button
                                  key={lib.id}
                                  className="lib-remote-item"
                                  onClick={() => void addRemoteLibrary(lib.url, lib.name)}
                                  disabled={libraryLoading}
                                  title={lib.description || lib.name}
                                >
                                  {lib.preview && (
                                    <img className="lib-remote-img" src={lib.preview} alt="" loading="lazy" />
                                  )}
                                  <span className="lib-list-label">{lib.name}</span>
                                  <PanelIcon name="plus" size={13} />
                                </button>
                              ))}
                              {filteredRemoteLibs?.length === 0 && (
                                <p className="lib-empty">Sin coincidencias.</p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </section>

                <section className="lib-section lib-section--extra">
                  {section("Integradas", fixedLibs.length)}
                  {openCats["Integradas"] && (
                    <div className="lib-fixed-list">
                      {fixedLibs.map((lib) => (
                        <div key={lib.id} className="lib-fixed">
                          <div className="lib-fixed-head">
                            <button className="lib-fixed-toggle" onClick={() => toggleLib(lib)}>
                              <span className={`lib-chevron ${expandedLibs[lib.id] ? "is-open" : ""}`}>
                                <PanelIcon name="chevron" size={14} />
                              </span>
                              <span className="lib-list-label">{lib.name}</span>
                              <span className="lib-count">{lib.items.length}</span>
                            </button>
                            {lib.builtin ? (
                              <span className="lib-fixed-badge" title="Incluida en la aplicación">Fija</span>
                            ) : (
                              <button
                                className="lib-mini-btn"
                                title="Quitar librería integrada"
                                onClick={() => {
                                  void unintegrateLibrary(lib.id, api).then(() => {
                                    refreshFixedLibs();
                                    setLibraryStatus(`«${lib.name}» quitada`);
                                  });
                                }}
                              >
                                <PanelIcon name="trash" size={12} />
                              </button>
                            )}
                          </div>
                          {expandedLibs[lib.id] && (
                            <div className="lib-preview-grid">
                              {lib.items.map((item, idx) => (
                                <button
                                  key={`${item.id}-${idx}`}
                                  className="lib-preview-tile"
                                  onClick={() => insertLibraryItem(item)}
                                  draggable
                                  onDragStart={(e) => {
                                    setPieceDrag({
                                      label: item.name || "Pieza",
                                      insert: (pt) => insertLibraryItem(item, pt),
                                    });
                                    e.dataTransfer.effectAllowed = "copy";
                                    e.dataTransfer.setData(DRAG_MIME, item.name || "Pieza");
                                  }}
                                  onDragEnd={clearPieceDrag}
                                  title={`Insertar ${item.name || "pieza"}`}
                                >
                                  {previews[item.id] ? (
                                    <img src={previews[item.id]} alt="" draggable={false} />
                                  ) : (
                                    <span className="lib-preview-loading">···</span>
                                  )}
                                  <span className="lib-tile-plus"><PanelIcon name="plus" size={12} /></span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                      {builtinErrors.map((err) => (
                        <p key={err.name} className="lib-url-status" title={err.message}>
                          No se pudo cargar «{err.name}». Revisa la conexión o el despliegue.
                        </p>
                      ))}
                      {fixedLibs.length === 0 && <p className="lib-empty">Sin librerías integradas.</p>}
                    </div>
                  )}
                </section>

                <section className="lib-section lib-section--extra">
                  <div className="lib-section-head-row">
                    {section("Catálogos", project.catalogs.length)}
                    <button
                      className="lib-section-add"
                      title="Nuevo catálogo"
                      onClick={addCatalog}
                    >
                      <PanelIcon name="plus" size={13} />
                    </button>
                  </div>
                  {openCats["Catálogos"] && (
                    <div className="lib-catalogs">
                      {project.catalogs.map((c) => (
                        <div key={c.id} className="lib-catalog">
                          <div className="lib-catalog-head">
                            <input
                              value={c.name}
                              onChange={(e) => updateCatalog(c.id, { name: e.target.value })}
                              className="lib-input"
                              aria-label="Nombre del catálogo"
                            />
                            <button className="lib-mini-btn" title="Eliminar catálogo" onClick={() => removeCatalog(c.id)}>
                              <PanelIcon name="trash" size={13} />
                            </button>
                          </div>
                          <div className="lib-catalog-items">
                            {c.items.map((it, idx) => (
                              <div key={idx} className="lib-catalog-row">
                                <input
                                  value={it.code}
                                  onChange={(e) => {
                                    const items = [...c.items];
                                    items[idx] = { ...items[idx], code: e.target.value };
                                    updateCatalog(c.id, { items });
                                  }}
                                  placeholder="código"
                                  className="lib-input lib-input--code"
                                  aria-label="Código"
                                />
                                <input
                                  value={it.description}
                                  onChange={(e) => {
                                    const items = [...c.items];
                                    items[idx] = { ...items[idx], description: e.target.value };
                                    updateCatalog(c.id, { items });
                                  }}
                                  placeholder="descripción"
                                  className="lib-input"
                                  aria-label="Descripción"
                                />
                                <button className="lib-mini-btn" title="Eliminar item" onClick={() => removeCatalogItem(c.id, idx)}>
                                  <PanelIcon name="trash" size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                          <button className="lib-add-item" onClick={() => addCatalogItem(c.id)}>+ Item</button>
                        </div>
                      ))}
                      {project.catalogs.length === 0 && <p className="lib-empty">Sin catálogos. Crea uno.</p>}
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}