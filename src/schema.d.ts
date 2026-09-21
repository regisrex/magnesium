import type { BoardOp } from './BoardWriter.js';

export declare const BOARD_COMMANDS: BoardOp[];

export declare const BOARD_TOOL_SCHEMA: {
  type: 'object';
  properties: Record<string, unknown>;
  required: string[];
};

export interface BoardTool {
  name: string;
  description: string;
  input_schema: typeof BOARD_TOOL_SCHEMA;
}

export declare const BOARD_TOOL: BoardTool;

export interface BoardSystemPromptOptions { width?: number; height?: number }
export declare function boardSystemPrompt(opts?: BoardSystemPromptOptions): string;
