'use client';

import React from 'react';
import { translate, buildMorseSchedule, dotDurationSeconds } from '../morse';
import { useMorsePlayback } from '../hooks/use-morse-playback';
import type { Direction, ToolState } from '../types';
import { MORSE_ALPHABET } from '../morse';

interface CanvasProps {
  state: ToolState;
  onChange: (state: ToolState) => void;
}

export const Canvas: React.FC<CanvasProps> = ({ state, onChange }) => {
  const update = (patch: Partial<ToolState>) => onChange({ ...state, ...patch });
  const result = React.useMemo(() => translate(state.input, state.direction), [state.input, state.direction]);
  const { playing, signalOn, play, stop } = useMorsePlayback(
    state.direction === 'text-to-morse' ? result.output : state.input,
    state.wpm
  );

  const direction: Direction = state.direction;
  const isTextToMorse = direction === 'text-to-morse';
  const outputValue = isTextToMorse ? result.output : result.output;

  const swapDirection = () => {
    const nextDirection: Direction = isTextToMorse ? 'morse-to-text' : 'text-to-morse';
    // Carry the output over as the new input so the swap feels continuous.
    update({ direction: nextDirection, input: outputValue });
  };

  const schedule = React.useMemo(
    () => buildMorseSchedule(isTextToMorse ? result.output : state.input, state.wpm),
    [isTextToMorse, result.output, state.input, state.wpm]
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(outputValue);
    } catch {
      /* clipboard unavailable */
    }
  };

  const share = async () => {
    const text = outputValue;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Morse Code Translator', text });
        return;
      }
    } catch {
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full" data-testid="morse-canvas">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={swapDirection}
          aria-label="Swap translation direction"
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
        >
          ⇄ {isTextToMorse ? 'Text → Morse' : 'Morse → Text'}
        </button>
        <span className="text-xs text-gray-500 dark:text-gray-400">Real-time translation</span>
      </div>

      <div>
        <label htmlFor="morse-input" className="text-xs font-medium uppercase tracking-wider text-gray-700 dark:text-gray-300">
          {isTextToMorse ? 'Plain text' : 'Morse code'}
        </label>
        <textarea
          id="morse-input"
          value={state.input}
          onChange={(e) => update({ input: e.target.value })}
          placeholder={isTextToMorse ? 'Type text to translate…' : 'Type Morse code (e.g. .... .. / -.-.)'}
          rows={4}
          className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-mono text-gray-900 dark:text-gray-100"
        />
      </div>

      <div>
        <span className="text-xs font-medium uppercase tracking-wider text-gray-700 dark:text-gray-300">
          {isTextToMorse ? 'Morse code' : 'Plain text'}
        </span>
        <div className="mt-1 flex items-start gap-2">
          <output
            data-testid="morse-output"
            className="flex-1 min-h-[64px] break-all rounded-md border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-3 py-2 font-mono text-sm text-gray-900 dark:text-gray-100"
          >
            {outputValue || '—'}
          </output>
          <div className="flex flex-col gap-1">
            <button type="button" onClick={copy} className="copy-btn text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Copy output">
              Copy
            </button>
            <button type="button" onClick={share} className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Share output">
              Share
            </button>
          </div>
        </div>
        {isTextToMorse && result.unsupported.length > 0 && (
          <p role="alert" className="mt-1 text-xs text-amber-600 dark:text-amber-400" data-testid="unsupported-chars">
            Unsupported characters skipped: {result.unsupported.join(' ')}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={playing ? stop : play}
          aria-pressed={playing}
          className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900"
          data-testid="play-button"
        >
          {playing ? '■ Stop' : '▶ Play Morse'}
        </button>
        <label className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300">
          WPM
          <input
            type="range"
            min={5}
            max={40}
            value={state.wpm}
            onChange={(e) => update({ wpm: Number(e.target.value) })}
            aria-label="Playback speed in words per minute"
            data-testid="wpm-slider"
          />
          <span data-testid="wpm-value">{state.wpm} WPM</span>
        </label>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Dot: {dotDurationSeconds(state.wpm).toFixed(3)}s · Duration: {schedule.totalSeconds.toFixed(2)}s
        </span>
        <div
          aria-label="Signal light"
          data-testid="signal-light"
          className={`ml-auto h-8 w-8 rounded-full border-2 transition-colors ${
            signalOn ? 'bg-amber-400 border-amber-500 shadow-[0_0_12px_rgba(251,191,36,0.8)]' : 'bg-gray-200 border-gray-300 dark:bg-gray-700 dark:border-gray-600'
          }`}
        />
      </div>

      {state.showChart && (
        <div data-testid="morse-chart">
          <h3 className="mb-2 text-sm font-medium text-gray-900 dark:text-gray-100">Morse reference chart</h3>
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-4 lg:grid-cols-6">
            {Object.entries(MORSE_ALPHABET).map(([char, code]) => (
              <div
                key={char}
                className="flex items-center justify-between rounded border border-gray-200 dark:border-gray-800 px-2 py-1 font-mono text-xs text-gray-900 dark:text-gray-100"
              >
                <span className="font-bold">{char}</span>
                <span className="text-gray-600 dark:text-gray-400">{code}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Letters are separated by a space; words by &quot; / &quot;. When decoding, &quot;|&quot; is also accepted as a word separator.
          </p>
        </div>
      )}
    </div>
  );
};
