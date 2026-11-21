export type Direction = 'text-to-morse' | 'morse-to-text';

export interface ToolState {
  /** The raw user input: plain text or Morse code depending on `direction`. */
  input: string;
  /** Which translation direction is active. */
  direction: Direction;
  /** Playback speed in words-per-minute (PARIS standard). */
  wpm: number;
  /** Whether the Morse reference chart is shown. */
  showChart: boolean;
}

export const MIN_WPM = 5;
export const MAX_WPM = 40;

export const DEFAULT_STATE: ToolState = {
  input: 'Hello world',
  direction: 'text-to-morse',
  wpm: 15,
  showChart: true,
};

/** One on/off element of a playback schedule, in seconds. */
export interface ScheduleElement {
  /** True when the tone/signal light is on for this element. */
  on: boolean;
  /** Duration of this element in seconds. */
  seconds: number;
}

export interface MorseSchedule {
  elements: ScheduleElement[];
  /** Total playback duration in seconds. */
  totalSeconds: number;
  /** True when the signal is on at the end of playback. */
  endsOn: boolean;
}
