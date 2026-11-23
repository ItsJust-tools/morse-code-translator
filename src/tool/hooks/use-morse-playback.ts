'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { buildMorseSchedule } from '../morse';

interface UseAudioPlaybackResult {
  playing: boolean;
  signalOn: boolean;
  play: () => void;
  stop: () => void;
}

/** Hook that plays Morse audio (Web Audio) and exposes the active on-state for the light. */
export function useMorsePlayback(morse: string, wpm: number): UseAudioPlaybackResult {
  const [playing, setPlaying] = useState(false);
  const [signalOn, setSignalOn] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const timeoutsRef = useRef<number[]>([]);

  const stop = useCallback(() => {
    for (const id of timeoutsRef.current) window.clearTimeout(id);
    timeoutsRef.current = [];
    if (oscRef.current) {
      try {
        oscRef.current.stop();
      } catch {
        /* ignore */
      }
      oscRef.current = null;
    }
    gainRef.current = null;
    if (ctxRef.current) {
      const ctx = ctxRef.current;
      ctxRef.current = null;
      void ctx.close().catch(() => undefined);
    }
    setPlaying(false);
    setSignalOn(false);
  }, []);

  useEffect(() => stop, [stop]);

  const play = useCallback(() => {
    stop();
    const schedule = buildMorseSchedule(morse, wpm);
    if (schedule.elements.length === 0) return;

    if (typeof window === 'undefined') return;
    const AudioCtor: typeof AudioContext | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;
    const ctx = new AudioCtor();
    ctxRef.current = ctx;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 600;
    osc.type = 'sine';
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    oscRef.current = osc;
    gainRef.current = gain;
    setPlaying(true);

    const start = ctx.currentTime;
    let acc = 0;
    schedule.elements.forEach((el) => {
      const at = start + acc;
      if (el.on) {
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(0.5, at + 0.005);
        gain.gain.setValueAtTime(0.5, at + el.seconds);
        gain.gain.linearRampToValueAtTime(0, at + el.seconds + 0.005);
        const delayMs = Math.round(acc * 1000);
        timeoutsRef.current.push(window.setTimeout(() => setSignalOn(true), delayMs));
        timeoutsRef.current.push(
          window.setTimeout(() => setSignalOn(false), delayMs + Math.round(el.seconds * 1000))
        );
      }
      acc += el.seconds;
    });
    timeoutsRef.current.push(
      window.setTimeout(() => stop(), Math.round(schedule.totalSeconds * 1000) + 50)
    );
  }, [morse, wpm, stop]);

  return { playing, signalOn, play, stop };
}
