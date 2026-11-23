import {
  MIN_WPM,
  MAX_WPM,
  type MorseSchedule,
  type ScheduleElement,
  type ToolState,
} from './types';

/** International Morse code: letters, digits, and common punctuation. */
export const MORSE_ALPHABET: Record<string, string> = {
  A: '.-',
  B: '-...',
  C: '-.-.',
  D: '-..',
  E: '.',
  F: '..-.',
  G: '--.',
  H: '....',
  I: '..',
  J: '.---',
  K: '-.-',
  L: '.-..',
  M: '--',
  N: '-.',
  O: '---',
  P: '.--.',
  Q: '--.-',
  R: '.-.',
  S: '...',
  T: '-',
  U: '..-',
  V: '...-',
  W: '.--',
  X: '-..-',
  Y: '-.--',
  Z: '--..',
  '0': '-----',
  '1': '.----',
  '2': '..---',
  '3': '...--',
  '4': '....-',
  '5': '.....',
  '6': '-....',
  '7': '--...',
  '8': '---..',
  '9': '----.',
  '.': '.-.-.-',
  ',': '--..--',
  '?': '..--..',
  "'": '.----.',
  '!': '-.-.--',
  '/': '-..-.',
  '(': '-.--.',
  ')': '-.--.-',
  '&': '.-...',
  ':': '---...',
  ';': '-.-.-.',
  '=': '-...-',
  '+': '.-.-.',
  '-': '-....-',
  _: '..--.-',
  '"': '.-..-.',
  $: '...-..-',
  '@': '.--.-.',
};

export const REVERSE_MORSE_ALPHABET: Record<string, string> = (() => {
  const reversed: Record<string, string> = {};
  for (const [char, code] of Object.entries(MORSE_ALPHABET)) {
    if (!(code in reversed)) reversed[code] = char;
  }
  return reversed;
})();

/** Placeholder for a space inside a Morse letter group when decoding. */
export const WORD_SEPARATOR = '|';

export interface TranslationResult {
  output: string;
  /** Characters in the input that could not be translated (text-to-morse only). */
  unsupported: string[];
}

/**
 * Translate plain text to Morse code.
 * - Letters/digits/punctuation per the international Morse standard.
 * - Letters within a word are separated by a single space.
 * - Words are separated by " / ".
 * - Unsupported characters are collected in `unsupported` and skipped.
 * - Case-insensitive; whitespace runs collapse to a single word separator.
 */
export function textToMorse(input: string): TranslationResult {
  const unsupported: string[] = [];
  const seenUnsupported = new Set<string>();
  const words: string[] = [];
  let currentWord: string[] = [];

  const pushCurrentWord = () => {
    if (currentWord.length > 0) {
      words.push(currentWord.join(' '));
      currentWord = [];
    }
  };

  for (const char of input.toUpperCase()) {
    if (/\s/.test(char)) {
      pushCurrentWord();
      continue;
    }
    const code = MORSE_ALPHABET[char];
    if (code === undefined) {
      if (!seenUnsupported.has(char)) {
        seenUnsupported.add(char);
        unsupported.push(char);
      }
      continue;
    }
    currentWord.push(code);
  }
  pushCurrentWord();

  return { output: words.join(' / '), unsupported };
}

/**
 * Translate Morse code to plain text.
 * - Letter separators: single spaces or "/".
 * - Word separators: "/" or "|".
 * - Empty tokens and unknown symbols are tolerated (skipped) so malformed
 *   sequences never break decoding.
 */
export function morseToText(input: string): TranslationResult {
  const normalized = input.replace(/\|/g, '/').trim();
  if (!normalized) return { output: '', unsupported: [] };

  const words = normalized.split('/');
  const decodedWords: string[] = [];

  for (const word of words) {
    const letters = word.split(/\s+/).filter((l) => l.length > 0);
    if (letters.length === 0) continue;
    const decoded = letters.map((letter) => REVERSE_MORSE_ALPHABET[letter] ?? '').join('');
    decodedWords.push(decoded);
  }

  return { output: decodedWords.join(' '), unsupported: [] };
}

/** Translate state input according to the active direction. */
export function translate(
  input: string,
  direction: 'text-to-morse' | 'morse-to-text'
): TranslationResult {
  return direction === 'text-to-morse' ? textToMorse(input) : morseToText(input);
}

/**
 * Round-trip helper: text -> Morse -> text. Lossless for supported characters
 * because each encoded word is re-decoded with single spaces between words.
 */
export function roundTripSupported(input: string): boolean {
  const { output } = textToMorse(input);
  if (output === '') return true;
  return morseToText(output).output === input.toUpperCase().trim().replace(/\s+/g, ' ');
}

/**
 * Dot duration in seconds from the PARIS standard:
 * a "word" of 50 units should be sent `wpm` times per minute.
 */
export function dotDurationSeconds(wpm: number): number {
  const safeWpm = clampWpm(wpm);
  return 60 / (safeWpm * 50);
}

export function clampWpm(wpm: number): number {
  if (!Number.isFinite(wpm)) return 15;
  return Math.min(MAX_WPM, Math.max(MIN_WPM, Math.round(wpm)));
}

/**
 * Build an on/off playback schedule for Morse text (dots, dashes, spaces).
 * Handles the empty input case, so schedules are always well-formed.
 */
export function buildMorseSchedule(morse: string, wpm: number): MorseSchedule {
  const unit = dotDurationSeconds(wpm);
  const elements: ScheduleElement[] = [];

  const words = morse
    .split('/')
    .map((w) => w.trim())
    .filter((w) => w.length > 0);

  words.forEach((word, wordIndex) => {
    const letters = word.split(/\s+/).filter((l) => l.length > 0);
    letters.forEach((letter, letterIndex) => {
      if (letterIndex > 0) elements.push({ on: false, seconds: unit * 3 }); // letter gap
      for (const symbol of letter) {
        if (symbol === '.') {
          elements.push({ on: true, seconds: unit });
        } else if (symbol === '-') {
          elements.push({ on: true, seconds: unit * 3 });
        } else {
          continue; // unknown symbol: skip
        }
        elements.push({ on: false, seconds: unit }); // intra-letter gap
      }
    });
    if (wordIndex < words.length - 1) elements.push({ on: false, seconds: unit * 7 }); // word gap
  });

  // Remove a trailing off-element so playback ends exactly with the signal.
  if (elements.length > 0) {
    const last = elements[elements.length - 1];
    if (last && !last.on) elements.pop();
  }

  const totalSeconds = elements.reduce((sum, el) => sum + el.seconds, 0);
  const lastElement = elements[elements.length - 1];
  return { elements, totalSeconds, endsOn: lastElement ? lastElement.on : false };
}

/** Serialize tool state. */
export function serializeState(state: ToolState): string {
  return JSON.stringify(state);
}

export function defaultState(): ToolState {
  return {
    input: 'Hello world',
    direction: 'text-to-morse',
    wpm: 15,
    showChart: true,
  };
}
