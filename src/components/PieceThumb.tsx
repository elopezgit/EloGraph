import type { ReactNode } from "react";

/* Helpers para construir las miniaturas de las piezas */
const S = {
  stroke: "#1e1e1e",
  strokeWidth: 1.6,
  strokeLinejoin: "round" as const,
  strokeLinecap: "round" as const,
};

function box(x: number, y: number, w: number, h: number, fill: string, rx = 2) {
  return <rect x={x} y={y} width={w} height={h} rx={rx} fill={fill} {...S} />;
}

function label(x: number, y: number, text: string, size = 7.5, anchor: "start" | "middle" | "end" = "start") {
  return (
    <text x={x} y={y} fontSize={size} textAnchor={anchor} fill="#1e1e1e" fontFamily="Inter, system-ui, sans-serif">
      {text}
    </text>
  );
}

function line(x1: number, y1: number, x2: number, y2: number, dash?: string, sw = 1.4) {
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#1e1e1e" strokeWidth={sw} strokeDasharray={dash} strokeLinecap="round" />;
}

function poly(points: string, fill: string, sw = 1.6) {
  return <polygon points={points} fill={fill} {...S} strokeWidth={sw} />;
}

const headRight = (cx: number, cy: number, fill = "#1e1e1e") => poly(`${cx},${cy} ${cx - 9},${cy - 5} ${cx - 9},${cy + 5}`, fill, 1);

const threeBox = (headFill: string, head1: string, head2: string, a: string, b: string) => (
  <>
    {box(24, 8, 72, 22, headFill)}
    {line(24, 30, 96, 30)}
    {box(24, 30, 72, 18, "#ffffff")}
    {line(24, 48, 96, 48)}
    {box(24, 48, 72, 18, "#ffffff")}
    {label(28, 19, head1, 6.2)}
    {label(28, 27, head2, 7.6)}
    {label(28, 43, a, 7)}
    {label(28, 61, b, 7)}
  </>
);

const twoBox = (headFill: string, head1: string, head2: string, body: string) => (
  <>
    {box(24, 16, 72, 22, headFill)}
    {box(24, 38, 72, 24, "#ffffff")}
    {label(28, 26, head1, 6.2)}
    {label(28, 33, head2, 7.6)}
    {label(28, 54, body, 7)}
  </>
);

const arrowLine = (dash: string | undefined, startHead: ReactNode, endHead: ReactNode) => (
  <>
    {startHead}
    {line(24, 40, 98, 40, dash, 1.6)}
    {endHead}
  </>
);

const thumbs: Record<string, () => ReactNode> = {
  /* ---- Herramientas ---- */
  selection: () => <path d="M34 18 L34 62 L46 50 L55 68 L64 64 L55 46 L72 46 Z" fill="#ffffff" {...S} />,
  rectangle: () => box(22, 24, 76, 34, "#ffffff"),
  diamond: () => poly("60,14 102,40 60,66 18,40", "#ffffff"),
  ellipse: () => <ellipse cx={60} cy={40} rx={42} ry={26} fill="#ffffff" {...S} />,
  line: () => line(18, 58, 102, 22, undefined, 2),
  freedraw: () => <path d="M22 54 Q34 20 46 44 T72 40 Q84 38 98 24" fill="none" {...S} strokeWidth={2} />,
  text: () => label(60, 58, "T", 44, "middle"),
  eraser: () => (
    <>
      {poly("28,56 56,24 94,44 66,64", "#ffffff")}
      {line(28, 56, 66, 64)}
    </>
  ),
  frame: () => (
    <>
      {line(24, 30, 24, 20)}{line(24, 20, 36, 20)}
      {line(84, 20, 96, 20)}{line(96, 20, 96, 30)}
      {line(96, 50, 96, 60)}{line(96, 60, 84, 60)}
      {line(36, 60, 24, 60)}{line(24, 60, 24, 50)}
    </>
  ),
  hand: () => (
    <path
      d="M40 52 V32 a5 5 0 0 1 10 0 v14 -22 a5 5 0 0 1 10 0 v22 -18 a5 5 0 0 1 10 0 v20 -12 a5 5 0 0 1 10 0 v18 c0 12 -8 18 -18 18 h-8 c-8 0 -12 -4 -16 -10 l-8 -12 a5 5 0 0 1 8 -6 z"
      fill="#ffffff"
      {...S}
    />
  ),

  /* ---- UML estructural ---- */
  class: () => threeBox("#eef4ff", "", "ClassName", "- attr: type", "+ method()"),
  abstractClass: () => threeBox("#eef4ff", "\u00ABabstract\u00BB", "AbstractClass", "- attr: type", "+ method()"),
  interface: () => twoBox("#f3e8ff", "\u00ABinterface\u00BB", "IService", "+ doSomething()"),
  enum: () => twoBox("#fff7e6", "\u00ABenumeration\u00BB", "Status", "ACTIVE / INACTIVE"),
  package: () => (
    <>
      {box(32, 12, 28, 12, "#f1f5f9")}
      {box(18, 24, 84, 44, "#f8fafc")}
      {label(24, 48, "PackageName", 8)}
    </>
  ),
  component: () => (
    <>
      {box(32, 20, 56, 38, "#e0f2fe", 5)}
      {line(32, 28, 25, 28)}
      {line(32, 46, 25, 46)}
      {line(25, 28, 25, 46)}
      {line(88, 28, 95, 28)}
      {line(88, 46, 95, 46)}
      {line(95, 28, 95, 46)}
      {label(60, 37, "\u00ABcomponent\u00BB", 6)}
      {label(60, 48, "Component", 7.4, "middle")}
    </>
  ),
  node: () => (
    <>
      {box(26, 20, 62, 44, "#fef3c7")}
      {box(26, 20, 62, 11, "#fde68a")}
      {label(57, 46, "\u00ABdevice\u00BB", 6, "middle")}
      {label(57, 57, "Node", 8, "middle")}
    </>
  ),
  object: () => (
    <>
      {box(24, 24, 72, 32, "#ffffff")}
      {label(28, 39, "obj: Class", 8)}
      {label(28, 51, "attr = value", 7)}
    </>
  ),

  /* ---- UML comportamiento ---- */
  useCase: () => (
    <>
      <ellipse cx={60} cy={40} rx={40} ry={19} fill="#eef4ff" {...S} />
      {label(60, 44, "Caso de uso", 7.6, "middle")}
    </>
  ),
  actor: () => (
    <>
      <circle cx={60} cy={17} r={6} fill="#fff7e6" {...S} />
      {line(60, 23, 60, 45)}
      {line(45, 31, 75, 31)}
      {line(60, 45, 48, 62)}
      {line(60, 45, 72, 62)}
      {label(60, 74, "Actor", 6.8, "middle")}
    </>
  ),
  system: () => (
    <>
      <rect x={18} y={14} width={84} height={54} fill="transparent" {...S} strokeDasharray="5 3" />
      {label(24, 25, "Sistema", 7.5)}
    </>
  ),
  lifeline: () => (
    <>
      {box(38, 8, 44, 18, "#eef4ff")}
      {line(60, 26, 60, 72, "4 3")}
      {label(60, 20, "Objeto", 7.4, "middle")}
    </>
  ),
  activation: () => box(52, 8, 16, 64, "#bfdbfe", 1),
  fragment: () => (
    <>
      <rect x={22} y={16} width={76} height={48} fill="transparent" {...S} strokeDasharray="5 3" />
      {label(26, 26, "alt", 7.5)}
      {line(22, 31, 98, 31)}
    </>
  ),

  /* ---- Base de datos ---- */
  table: () => (
    <>
      {box(22, 10, 76, 18, "#e8f5e9")}
      {box(22, 28, 76, 42, "#ffffff")}
      {line(22, 42, 98, 42)}
      {line(22, 56, 98, 56)}
      {label(26, 23, "table_name", 8)}
      {label(26, 38, "PK id : int", 7)}
      {label(26, 52, "FK other_id", 7)}
      {label(26, 66, "name : varchar", 7)}
    </>
  ),
  entity: () => (
    <>
      {box(30, 24, 60, 32, "#e8f5e9")}
      {label(60, 44, "Entidad", 8, "middle")}
    </>
  ),
  weakEntity: () => (
    <>
      {box(26, 18, 68, 44, "#e8f5e9", 1)}
      {box(31, 23, 58, 34, "#e8f5e9", 1)}
      {label(60, 43, "Entidad", 7.4, "middle")}
      {label(60, 52, "d\u00E9bil", 7, "middle")}
    </>
  ),
  relationship: () => (
    <>
      {poly("60,12 102,40 60,68 18,40", "#fff7e6")}
      {label(60, 44, "relaci\u00F3n", 7.4, "middle")}
    </>
  ),
  attribute: () => (
    <>
      <ellipse cx={60} cy={40} rx={34} ry={16} fill="#ffffff" {...S} />
      {label(60, 44, "atributo", 7.4, "middle")}
    </>
  ),
  keyAttribute: () => (
    <>
      <ellipse cx={60} cy={40} rx={34} ry={16} fill="#ffffff" {...S} />
      {label(60, 39, "id", 7.6, "middle")}
      {line(48, 43, 72, 43)}
    </>
  ),
  view: () => (
    <>
      {box(24, 24, 72, 34, "#e0f2fe")}
      {poly("82,24 96,38 82,38", "#ffffff")}
      {label(28, 38, "\u00ABview\u00BB", 6.2)}
      {label(28, 51, "view_name", 7.4)}
    </>
  ),

  /* ---- Procesos / BPMN ---- */
  task: () => (
    <>
      {box(26, 22, 68, 38, "#e6f7ff", 7)}
      {label(60, 45, "Tarea", 8, "middle")}
    </>
  ),
  subprocess: () => (
    <>
      {box(24, 22, 64, 38, "#e6f7ff", 7)}
      {box(74, 47, 14, 12, "#ffffff", 1)}
      {line(81, 50, 81, 56)}
      {line(78, 53, 84, 53)}
      {label(52, 44, "Subproceso", 7, "middle")}
    </>
  ),
  startEvent: () => <circle cx={60} cy={40} r={17} fill="#dcfce7" stroke="#1e1e1e" strokeWidth={2.4} />,
  endEvent: () => <circle cx={60} cy={40} r={17} fill="#fee2e2" stroke="#1e1e1e" strokeWidth={4} />,
  intermediateEvent: () => (
    <>
      <circle cx={60} cy={40} r={17} fill="#ffffff" stroke="#1e1e1e" strokeWidth={2} />
      <circle cx={60} cy={40} r={12} fill="none" stroke="#1e1e1e" strokeWidth={1.4} />
    </>
  ),
  gatewayXor: () => (
    <>
      {poly("60,14 98,40 60,66 22,40", "#fff7e6")}
      {line(50, 30, 70, 50)}
      {line(70, 30, 50, 50)}
    </>
  ),
  gatewayPar: () => (
    <>
      {poly("60,14 98,40 60,66 22,40", "#fff7e6")}
      {line(60, 27, 60, 53)}
      {line(47, 40, 73, 40)}
    </>
  ),
  pool: () => (
    <>
      {box(18, 18, 84, 46, "#f1f5f9")}
      {box(18, 18, 18, 46, "#e2e8f0", 0)}
      {label(43, 44, "Pool", 8)}
    </>
  ),

  /* ---- Flechas y relaciones ---- */
  arrow: () => arrowLine(undefined, null, headRight(98, 40)),
  composition: () => arrowLine(undefined, poly("20,40 28,34 36,40 28,46", "#1e1e1e", 1), headRight(98, 40)),
  aggregation: () => arrowLine(undefined, poly("20,40 28,34 36,40 28,46", "#ffffff", 1.4), headRight(98, 40)),
  inheritance: () => arrowLine(undefined, null, poly("98,40 87,33 87,47", "#ffffff", 1.6)),
  realization: () => arrowLine("5 3", null, poly("98,40 87,33 87,47", "#ffffff", 1.6)),
  dependency: () => arrowLine("5 3", null, headRight(98, 40)),

  /* ---- General ---- */
  comment: () => (
    <>
      {box(22, 18, 76, 44, "#fffbe6")}
      {poly("84,18 98,32 84,32", "#ffffff")}
      {label(27, 44, "Comentario", 7.4)}
    </>
  ),
  note: () => (
    <>
      {box(22, 18, 76, 44, "#fffbe6")}
      {poly("84,18 98,32 84,32", "#ffffff")}
      {label(27, 44, "Nota", 7.6)}
    </>
  ),
  image: () => (
    <>
      {box(26, 16, 68, 48, "#ffffff")}
      <circle cx={80} cy={28} r={4} fill="#fbbf24" stroke="#1e1e1e" strokeWidth={1} />
      {poly("30,58 48,38 62,52 74,40 90,58", "#dbeafe", 1)}
    </>
  ),
};

export function PieceThumb({ kind }: { kind: string }) {
  return (
    <svg viewBox="0 0 120 80" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      {(thumbs[kind] ?? thumbs.class)()}
    </svg>
  );
}

type IconName = "search" | "chevron" | "close" | "plus" | "trash" | "import" | "export";

const paths: Record<IconName, ReactNode> = {
  search: <><circle cx="11" cy="11" r="6.5" /><line x1="16" y1="16" x2="21" y2="21" /></>,
  chevron: <polyline points="6 9 12 15 18 9" />,
  close: <><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></>,
  plus: <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>,
  trash: <><polyline points="4 7 20 7" /><path d="M9 7V4h6v3m-8 0 1 13h8l1-13" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></>,
  import: <><path d="M12 3v12m0 0-4-4m4 4 4-4" /><path d="M4 17v3h16v-3" /></>,
  export: <><path d="M12 15V3m0 0L8 7m4-4 4 4" /><path d="M4 17v3h16v-3" /></>,
};

export function PanelIcon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}
