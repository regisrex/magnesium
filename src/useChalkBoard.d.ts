import type { RefObject } from 'react';
import type { BoardCommand, BoardState } from './BoardWriter.js';
import type { ChalkBoardHandle } from './ChalkBoard.js';

export interface UseChalkBoardResult {
  ref: RefObject<ChalkBoardHandle>;
  exec(commands: BoardCommand[] | { commands: BoardCommand[] }): Promise<void>;
  run(script: string): Promise<void>;
  state(): BoardState | undefined;
  snapshot(type?: string, quality?: number): string | undefined;
  clear(): Promise<void> | undefined;
  busy: boolean;
}

export default function useChalkBoard(): UseChalkBoardResult;
