import * as React from 'react';
import type BoardWriter from './BoardWriter.js';
import type { BoardCommand, BoardState, FindFreeOptions, FreeSpot } from './BoardWriter.js';

export type ChalkBoardMode = 'none' | 'place' | 'draw';

export interface ChalkBoardProps {
  width?: number;
  height?: number;
  board?: 'green' | 'black' | 'plain' | string;
  chalk?: boolean;
  avoid?: boolean;
  size?: number;
  color?: string;
  speed?: number;
  font?: string;
  loadFont?: boolean;
  loadMathJax?: boolean;
  showPen?: boolean;
  showOccupancy?: boolean;
  mode?: ChalkBoardMode;
  onReady?: (handle: ChalkBoardHandle) => void;
  onIdle?: () => void;
  onError?: (e: unknown) => void;
  className?: string;
  style?: React.CSSProperties;
}

export interface ChalkBoardHandle {
  readonly board: BoardWriter;
  exec(commands: BoardCommand[] | { commands: BoardCommand[] }): Promise<void>;
  run(script: string): Promise<void>;
  clear(): Promise<void>;
  stop(): void;
  state(): BoardState;
  snapshot(type?: string, quality?: number): string;
  isFree(x: number, y: number, w: number, h: number): boolean;
  findFree(w: number, h: number, opts?: FindFreeOptions): FreeSpot | null;
  busy(): boolean;
}

declare const ChalkBoard: React.ForwardRefExoticComponent<
  ChalkBoardProps & React.RefAttributes<ChalkBoardHandle>
>;

export default ChalkBoard;
