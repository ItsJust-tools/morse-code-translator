import { describe, it, expect } from 'vitest';
import {
  MORSE_ALPHABET,
  REVERSE_MORSE_ALPHABET,
  textToMorse,
  morseToText,
  translate,
  roundTripSupported,
  buildMorseSchedule,
  dotDurationSeconds,
  clampWpm,
} from '@/tool/morse';
import { DEFAULT_STATE, MAX_WPM, MIN_WPM, type ToolState } from '@/tool/types';
import { morseTranslatorTool } from '@/tool/tool-definition';

describe('textToMorse', () => {
  it('translates "hello world" per the international standard', () => {
    expect(textToMorse('hello world').output).toBe('.... . .-.. .-.. --- / .-- --- .-. .-.. -..');
  });

  it('translates letters case-insensitively', () => {
    expect(textToMorse('SOS').output).toBe('... --- ...');
    expect(textToMorse('sos').output).toBe('... --- ...');
  });

  it('translates digits', () => {
    expect(textToMorse('0123456789').output).toBe(
      '----- .---- ..--- ...-- ....- ..... -.... --... ---.. ----.'
    );
  });

  it('translates common punctuation', () => {
    expect(textToMorse('.').output).toBe(MORSE_ALPHABET['.']);
    expect(textToMorse(',').output).toBe(MORSE_ALPHABET[',']);
    expect(textToMorse('?').output).toBe(MORSE_ALPHABET['?']);
    expect(textToMorse('!').output).toBe(MORSE_ALPHABET['!']);
    expect(textToMorse('@').output).toBe(MORSE_ALPHABET['@']);
  });

  it('collapses whitespace runs into single word separators', () => {
    expect(textToMorse('a\n  \t b').output).toBe('.- / -...');
  });

  it('reports unsupported characters and skips them', () => {
    const result = textToMorse('hi~there');
    expect(result.unsupported).toEqual(['~']);
    expect(result.output).toBe('.... .. - .... . .-. .');
  });

  it('deduplicates unsupported characters and never breaks on them', () => {
    expect(textToMorse('^#^#').unsupported).toEqual(['^', '#']);
  });

  it('returns empty output for empty input', () => {
    expect(textToMorse('')).toEqual({ output: '', unsupported: [] });
    expect(textToMorse('   ').output).toBe('');
  });
});

describe('morseToText', () => {
  it('decodes standard "hello world" Morse', () => {
    expect(morseToText('.... . .-.. .-.. --- / .-- --- .-. .-.. -..').output).toBe('HELLO WORLD');
  });

  it('accepts "|" as word separator notation', () => {
    expect(morseToText('.... .. | - .... . .-. .').output).toBe('HI THERE');
  });

  it('mixes "/" and "|" separators tolerantly', () => {
    expect(morseToText('... --- / ... | ...').output).toBe('SO S S');
    expect(morseToText('... | --- | ...').output).toBe('S O S');
  });

  it('skips unknown symbols without failing', () => {
    expect(morseToText('.....-? ...').output).toBe('S');
    expect(morseToText('####### ...').output).toBe('S');
  });

  it('ignores empty tokens and extra separators', () => {
    expect(morseToText('  / / .... .. / ').output).toBe('HI');
  });

  it('returns empty output for empty input', () => {
    expect(morseToText('')).toEqual({ output: '', unsupported: [] });
    expect(morseToText('   /  ').output).toBe('');
  });

  it('decoding is the exact inverse of encoding for supported chars', () => {
    const allChars = Object.keys(MORSE_ALPHABET).join('');
    const encoded = textToMorse(allChars).output;
    // Every char is encoded as a distinct word here since none are separators
    const decoded = morseToText(encoded).output;
    expect(decoded.split(' ').join('')).toBe(allChars);
  });
});

describe('round trip', () => {
  it('is lossless for supported characters', () => {
    expect(roundTripSupported('hello world')).toBe(true);
    expect(roundTripSupported('SOS 911')).toBe(true);
    expect(roundTripSupported("What?! It's C.R.U.D., no?")).toBe(true);
  });

  it('reports lossy when unsupported characters present', () => {
    expect(roundTripSupported('héllo')).toBe(false);
  });

  it('handles empty strings', () => {
    expect(roundTripSupported('')).toBe(true);
  });
});

describe('translate direction dispatch', () => {
  it('dispatches text-to-morse', () => {
    expect(translate('E', 'text-to-morse').output).toBe('.');
  });

  it('dispatches morse-to-text', () => {
    expect(translate('.', 'morse-to-text').output).toBe('E');
  });
});

describe('buildMorseSchedule', () => {
  it('computes dot duration from WPM (PARIS standard)', () => {
    // 15 WPM => 60/(15*50) = 0.08s
    expect(dotDurationSeconds(15)).toBeCloseTo(0.08, 6);
    expect(dotDurationSeconds(20)).toBeCloseTo(0.06, 6);
  });

  it('clamps WPM within 5..40', () => {
    expect(clampWpm(0)).toBe(MIN_WPM);
    expect(clampWpm(100)).toBe(MAX_WPM);
    expect(clampWpm(-5)).toBe(MIN_WPM);
    expect(clampWpm(NaN)).toBe(15);
    expect(clampWpm(12.4)).toBe(12);
  });

  it('builds alternating on/off elements with correct timing at 15 WPM', () => {
    const unit = dotDurationSeconds(15); // 0.08s
    const schedule = buildMorseSchedule('.- ..', 15);
    // elements: ON(dot)=1u, OFF(intra)=1u, ON(dash)=3u, OFF(intra)=1u, OFF(letter gap)=3u,
    // ON(dot)=1u, OFF(intra)=1u, ON(dot)=1u
    expect(schedule.elements).toHaveLength(8);
    const durations = schedule.elements.map((el) => el.seconds);
    expect(durations.slice(0, 4)).toEqual([unit, unit, unit * 3, unit]);
    // letter gap of 3 units then dot
    expect(durations[4]).toBeCloseTo(unit * 3, 9);
    const onCount = schedule.elements.filter((el) => el.on).length;
    expect(onCount).toBe(4);
  });

  it('word separator produces 7-unit gap', () => {
    const unit = dotDurationSeconds(10);
    const schedule = buildMorseSchedule('.. ../.. ..', 10);
    const gaps = schedule.elements.filter((el) => !el.on && el.seconds > unit * 3.5);
    expect(gaps).toHaveLength(1);
    expect(gaps[0] && gaps[0].seconds).toBeCloseTo(unit * 7, 9);
  });

  it('last element of a non-empty schedule is always "on"', () => {
    const schedule = buildMorseSchedule('.- / -...', 20);
    const last = schedule.elements[schedule.elements.length - 1];
    expect(last?.on).toBe(true);
    expect(schedule.endsOn).toBe(true);
  });

  it('empty input produces an empty schedule without errors', () => {
    expect(buildMorseSchedule('', 15)).toEqual({ elements: [], totalSeconds: 0, endsOn: false });
    expect(buildMorseSchedule('   /  / ', 15).elements).toHaveLength(0);
  });

  it('skips malformed symbols in the schedule but keeps valid ones', () => {
    const schedule = buildMorseSchedule('.x-', 15);
    const on = schedule.elements.filter((el) => el.on);
    expect(on).toHaveLength(2); // dot and dash only
  });

  it('totalSeconds equals the sum of element durations', () => {
    const schedule = buildMorseSchedule('.... . .-.. .-.. --- / .-- --- .-. .-.. -..', 15);
    const sum = schedule.elements.reduce((acc, el) => acc + el.seconds, 0);
    expect(schedule.totalSeconds).toBeCloseTo(sum, 9);
    expect(schedule.totalSeconds).toBeGreaterThan(0);
  });
});

describe('tool state serialize/deserialize', () => {
  it('round-trips state through serialize/deserialize', () => {
    const state: ToolState = {
      input: 'SOS',
      direction: 'text-to-morse',
      wpm: 20,
      showChart: false,
    };
    const deserialized = morseTranslatorTool.deserialize(
      JSON.parse(morseTranslatorTool.serialize(state))
    );
    expect(deserialized).toEqual({ success: true, data: state });
  });

  it('rejects non-object payloads', () => {
    expect(morseTranslatorTool.deserialize('nope')).toEqual({
      success: false,
      error: 'Invalid data format: expected Morse translator state object',
    });
    expect(morseTranslatorTool.deserialize(null)).toMatchObject({ success: false });
  });

  it('rejects payloads missing input', () => {
    expect(morseTranslatorTool.deserialize({ direction: 'morse-to-text' })).toEqual({
      success: false,
      error: 'Invalid data format: expected { input: string, ... }',
    });
  });

  it('applies defaults and clamps for partial payloads', () => {
    const wpmMax = morseTranslatorTool.deserialize({ input: 'hi', wpm: 999 });
    expect(wpmMax.success && wpmMax.data).toEqual({
      input: 'hi',
      direction: DEFAULT_STATE.direction,
      wpm: MAX_WPM,
      showChart: DEFAULT_STATE.showChart,
    });
    const wpmMin = morseTranslatorTool.deserialize({ input: 'hi', wpm: 1 });
    expect(wpmMin.success && wpmMin.data?.wpm).toBe(MIN_WPM);
    const bogusDir = morseTranslatorTool.deserialize({ input: 'hi', direction: 'bogus' });
    expect(bogusDir.success && bogusDir.data?.direction).toBe('text-to-morse');
    const showChart = morseTranslatorTool.deserialize({ input: 'hi', showChart: true });
    expect(showChart.success && showChart.data?.showChart).toBe(true);
  });

  it('exposes initial state and identity', () => {
    expect(morseTranslatorTool.initialState).toEqual(DEFAULT_STATE);
    expect(morseTranslatorTool.id).toBe('tool-1795255487');
    expect(morseTranslatorTool.version).toBe('1.0.0');
  });
});

describe('edge cases', () => {
  it('very long input does not break translation', () => {
    const longText = 'abc '.repeat(2000);
    const encoded = textToMorse(longText);
    expect(encoded.unsupported).toHaveLength(0);
    const decoded = morseToText(encoded.output).output;
    expect(decoded.split(' ').join('')).toBe('ABC'.repeat(2000));

    const longMorse = '.- -... -.-. / '.repeat(2000);
    expect(morseToText(longMorse).output.split(' ').join('')).toBe('ABC'.repeat(2000));
  });

  it('empty input yields empty results in both directions', () => {
    expect(textToMorse('').output).toBe('');
    expect(morseToText('').output).toBe('');
  });

  it('malformed morse never throws', () => {
    expect(() => morseToText('...---...')).not.toThrow();
    expect(() => morseToText('-- -- --')).not.toThrow();
  });

  it('reverse alphabet is consistent', () => {
    const aCode: string = MORSE_ALPHABET['A'] ?? '';
    expect(REVERSE_MORSE_ALPHABET[aCode]).toBe('A');
    expect(REVERSE_MORSE_ALPHABET['...---...']).toBeUndefined();
  });
});
