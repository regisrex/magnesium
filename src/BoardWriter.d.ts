export type BoardOp =
  | 'at' | 'move' | 'mark' | 'back' | 'wrap' | 'write' | 'math' | 'label'
  | 'line' | 'arrow' | 'box' | 'triangle' | 'polygon' | 'circle' | 'arc' | 'angle' | 'dot'
  | 'underline' | 'pause' | 'clear' | 'color' | 'size';

export interface BoardCommand {
  op: BoardOp;
  x?: number; y?: number;
  x1?: number; y1?: number; x2?: number; y2?: number;
  w?: number; h?: number;
  cx?: number; cy?: number; r?: number;
  a1?: number; a2?: number;
  points?: [number, number][];
  text?: string; tex?: string; name?: string;
  color?: string; size?: number; ms?: number;
}

export interface BoardRegion { x: number; y: number; w: number; h: number; freePercent: number }

export interface FreeSpot { x: number; y: number }

export interface BoardState {
  width: number; height: number;
  pen: { x: number; y: number; size: number; color: string; wrapRight: number };
  marks: Record<string, { x: number; y: number }>;
  usedPercent: number;
  regions: BoardRegion[];
  largeFreeSpot: FreeSpot | null;
  mediumFreeSpot: FreeSpot | null;
}

export type BoardName = 'green' | 'black' | 'plain' | string;

export interface BoardWriterOptions {
  font?: string;
  size?: number;
  color?: string;
  speed?: number;
  margin?: number;
  measure?: HTMLElement;
  chalk?: boolean;
  avoid?: boolean;
  cell?: number;
  board?: BoardName;
}

export interface WriteOptions { newline?: boolean; color?: string; size?: number }
export interface MathOptions { newline?: boolean; color?: string; size?: number }
export interface FindFreeOptions { step?: number; margin?: number }

export default class BoardWriter {
  static CHALK: Record<string, string>;
  static BOARDS: Record<string, string>;

  constructor(canvas: HTMLCanvasElement, opts?: BoardWriterOptions);

  c: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  font: string;
  pen: { size: number; color: string };
  speed: number;
  margin: number;
  chalk: boolean;
  avoid: boolean;
  cell: number;
  cols: number;
  rows: number;
  occ: Uint8Array;
  marks: Record<string, { x: number; y: number; left: number; right: number; size: number }>;
  stopped: boolean;
  board: BoardName;
  x: number; y: number; left: number; right: number;
  tip: { x: number; y: number };
  last: { x1: number; y: number; x2: number } | null;

  isFree(x: number, y: number, w: number, h: number): boolean;
  findFree(w: number, h: number, opts?: FindFreeOptions): FreeSpot | null;

  setBoard(name: BoardName): void;
  clear(): void;
  color(v: string): void;
  size(v: number): void;
  at(x: number, y: number): void;
  wrap(x2: number): void;
  stop(): void;
  pause(ms: number): Promise<void>;
  newline(extra?: number): void;

  move(x: number, y: number): Promise<void>;
  mark(name?: string): void;
  back(name?: string): Promise<void>;
  label(x: number, y: number, text: string): Promise<void>;

  write(text: string, opts?: WriteOptions): Promise<void>;
  math(tex: string, opts?: MathOptions): Promise<void>;

  strokeTo(x1: number, y1: number, x2: number, y2: number, width?: number): void;
  line(x1: number, y1: number, x2: number, y2: number, opts?: { width?: number }): Promise<void>;
  polygon(...coords: number[]): Promise<void>;
  triangle(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): Promise<void>;
  box(x: number, y: number, w: number, h: number): Promise<void>;
  circle(cx: number, cy: number, r: number): Promise<void>;
  arc(cx: number, cy: number, r: number, a1: number, a2: number): Promise<void>;
  angle(x: number, y: number, r: number, a1: number, a2: number, text?: string): Promise<void>;
  arrow(x1: number, y1: number, x2: number, y2: number): Promise<void>;
  dot(x: number, y: number): Promise<void>;
  underline(): Promise<void>;

  run(script: string): Promise<void>;
  exec(cmds: BoardCommand[]): Promise<void>;

  static loadMathJax(src?: string): Promise<void>;
  static loadFont(family?: string): Promise<void>;

  snapshot(type?: string, quality?: number): string;
  state(): BoardState;
}
