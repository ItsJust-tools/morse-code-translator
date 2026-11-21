'use client';

import React from 'react';
import type { Direction, ToolState } from '../types';

interface ToolbarProps {
  state: ToolState;
  onChange: (state: ToolState) => void;
  onClear: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ state, onChange, onClear }) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center gap-1" role="group" aria-label="Translation direction">
        {(
          [
            { value: 'text-to-morse', label: 'Text → Morse' },
            { value: 'morse-to-text', label: 'Morse → Text' },
          ] as { value: Direction; label: string }[]
        ).map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => onChange({ ...state, direction: value })}
            aria-pressed={state.direction === value}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              state.direction === value
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onClear}
          className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          Clear
        </button>
      </div>
    </div>
  );
};
