import type { Tool, DeserializeResult } from '@itsjust/core';
import toolConfig from './tool.config';
import {
  DEFAULT_STATE,
  MIN_WPM,
  MAX_WPM,
  type Direction,
  type ToolState,
} from './types';

function clampInteger(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isInteger(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function isDirection(value: unknown): value is Direction {
  return value === 'text-to-morse' || value === 'morse-to-text';
}

export const morseTranslatorTool: Tool<ToolState> = {
  id: toolConfig.id,
  name: toolConfig.name,
  version: toolConfig.version,
  config: toolConfig as unknown as Tool['config'],
  initialState: { ...DEFAULT_STATE },
  serialize: (state) => JSON.stringify(state),
  deserialize: (data): DeserializeResult<ToolState> => {
    if (typeof data !== 'object' || data === null) {
      return { success: false, error: 'Invalid data format: expected Morse translator state object' };
    }
    const v = data as Partial<ToolState>;

    if (typeof v.input !== 'string') {
      return { success: false, error: 'Invalid data format: expected { input: string, ... }' };
    }
    const direction: Direction = isDirection(v.direction) ? v.direction : DEFAULT_STATE.direction;
    const wpm =
      typeof v.wpm === 'number' && Number.isInteger(v.wpm)
        ? clampInteger(v.wpm, MIN_WPM, MAX_WPM, DEFAULT_STATE.wpm)
        : DEFAULT_STATE.wpm;
    const showChart = typeof v.showChart === 'boolean' ? v.showChart : DEFAULT_STATE.showChart;

    return {
      success: true,
      data: {
        input: v.input,
        direction,
        wpm,
        showChart,
      },
    };
  },
  exporters: [
    { format: 'png', loader: () => import('./exporters/png') },
    { format: 'jpeg', loader: () => import('./exporters/jpeg') },
    { format: 'webp', loader: () => import('./exporters/webp') },
    { format: 'pdf', loader: () => import('./exporters/pdf') },
  ],
};

export type ToolDefinition = typeof morseTranslatorTool;
