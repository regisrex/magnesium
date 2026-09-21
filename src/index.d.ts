export { default as ChalkBoard } from './ChalkBoard.js';
export type { ChalkBoardProps, ChalkBoardHandle, ChalkBoardMode } from './ChalkBoard.js';

export { default as BoardWriter } from './BoardWriter.js';
export type {
  BoardOp, BoardCommand, BoardState, BoardRegion, FreeSpot, BoardName,
  BoardWriterOptions, WriteOptions, MathOptions, FindFreeOptions
} from './BoardWriter.js';

export { default as useChalkBoard } from './useChalkBoard.js';
export type { UseChalkBoardResult } from './useChalkBoard.js';

export { BOARD_TOOL, BOARD_TOOL_SCHEMA, BOARD_COMMANDS, boardSystemPrompt } from './schema.js';
export type { BoardTool, BoardSystemPromptOptions } from './schema.js';
