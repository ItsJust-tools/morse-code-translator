'use client';

import React from 'react';
import type { ToolState } from '../types';
import { MIN_WPM, MAX_WPM } from '../types';

interface SidebarProps {
  state: ToolState;
  onChange: (state: ToolState) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ state, onChange }) => {
  const update = (patch: Partial<ToolState>) => onChange({ ...state, ...patch });

  return (
    <div className="p-4 space-y-6 text-sm overflow-y-auto h-full" data-testid="morse-sidebar">
      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Reference chart</h3>
        <label className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
            Show Morse chart
          </span>
          <input
            type="checkbox"
            checked={state.showChart}
            onChange={(e) => update({ showChart: e.target.checked })}
            className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
          />
        </label>
      </div>

      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Playback speed</h3>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
          Words per minute ({MIN_WPM}–{MAX_WPM})
          <input
            type="number"
            min={MIN_WPM}
            max={MAX_WPM}
            step={1}
            value={state.wpm}
            onChange={(e) => {
              const n = Math.round(Number(e.target.value));
              update({
                wpm: Number.isFinite(n) ? Math.min(MAX_WPM, Math.max(MIN_WPM, n)) : DEFAULT_WPM,
              });
            }}
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
        </label>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Dot duration = 60 / (WPM × 50) seconds (PARIS standard).
        </p>
      </div>

      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Notation</h3>
        <ul className="list-disc space-y-1 pl-4 text-xs text-gray-500 dark:text-gray-400">
          <li>Letters within a word are separated by a space.</li>
          <li>Words are separated by &quot; / &quot;.</li>
          <li>When decoding, &quot;|&quot; is also accepted as a word separator.</li>
          <li>Unknown symbols in Morse input are skipped.</li>
        </ul>
      </div>
    </div>
  );
};

const DEFAULT_WPM = 15;
