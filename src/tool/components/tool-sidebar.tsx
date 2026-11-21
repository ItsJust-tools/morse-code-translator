'use client';

import { Sidebar } from './Sidebar';
import type { ToolState } from '../types';

interface ToolSidebarProps {
  state: ToolState;
  fontSize?: number;
  onFontSizeChange?: (delta: number) => void;
}

export function ToolSidebar({ state, fontSize, onFontSizeChange }: ToolSidebarProps) {
  return (
    <div className="converter-sidebar">
      <Sidebar state={state} onChange={() => undefined} />
      <div className="sidebar-section px-4">
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Font size</h3>
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            aria-label="Decrease font size"
            onClick={() => onFontSizeChange?.(-2)}
            className="rounded border border-gray-300 px-2 dark:border-gray-700"
          >
            A-
          </button>
          <span className="font-mono">{fontSize ?? 16}px</span>
          <button
            type="button"
            aria-label="Increase font size"
            onClick={() => onFontSizeChange?.(2)}
            className="rounded border border-gray-300 px-2 dark:border-gray-700"
          >
            A+
          </button>
        </div>
      </div>
    </div>
  );
}
