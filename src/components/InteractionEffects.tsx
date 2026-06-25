import { useEffect, useRef } from 'react';

type AudioKit = {
  ctx: AudioContext;
  master: GainNode;
  ambient: GainNode;
  filter: BiquadFilterNode;
  oscillators: OscillatorNode[];
  lfo: OscillatorNode;
  lfoGain: GainNode;
};

function createAudioKit(): AudioKit | null {
  if (typeof window === 'undefined' || !window.AudioContext) return null;

  const ctx = new window.AudioContext();
  const master = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  const ambient = ctx.createGain();
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();

  master.gain.value = 0.052;
  filter.type = 'lowpass';
  filter.frequency.value = 880;
  filter.Q.value = 0.42;
  ambient.gain.value = 0.075;

  ambient.connect(filter);
  filter.connect(master);
  master.connect(ctx.destination);

  lfo.type = 'sine';
  lfo.frequency.value = 0.035;
  lfoGain.gain.value = 0.022;
  lfo.connect(lfoGain);
  lfoGain.connect(ambient.gain);
  lfo.start();

  const oscillators = [82.41, 123.47, 164.81].map((frequency, index) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = index === 1 ? 'triangle' : 'sine';
    osc.frequency.value = frequency;
    gain.gain.value = index === 0 ? 0.5 : 0.28;
    osc.connect(gain);
    gain.connect(ambient);
    osc.start();
    return osc;
  });

  return { ctx, master, ambient, filter, oscillators, lfo, lfoGain };
}

export function InteractionEffects() {
  const kitRef = useRef<AudioKit | null>(null);
  const lastTapRef = useRef(0);

  useEffect(() => {
    const root = document.documentElement;

    function setPointer(x: number, y: number) {
      root.style.setProperty('--pointer-x', `${(x / window.innerWidth) * 100}%`);
      root.style.setProperty('--pointer-y', `${(y / window.innerHeight) * 100}%`);
    }

    function ensureAudio() {
      if (!kitRef.current) kitRef.current = createAudioKit();
      if (kitRef.current?.ctx.state === 'suspended') void kitRef.current.ctx.resume();
      return kitRef.current;
    }

    function playKeyClick(soft = false) {
      const kit = ensureAudio();
      if (!kit) return;
      const now = kit.ctx.currentTime;
      if (now - lastTapRef.current < 0.026) return;
      lastTapRef.current = now;

      const osc = kit.ctx.createOscillator();
      const gain = kit.ctx.createGain();
      const clickFilter = kit.ctx.createBiquadFilter();
      const base = soft ? 520 : 820;

      osc.type = soft ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(base + Math.random() * 180, now);
      clickFilter.type = 'bandpass';
      clickFilter.frequency.value = soft ? 760 : 1120;
      clickFilter.Q.value = 2.4;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(soft ? 0.018 : 0.034, now + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + (soft ? 0.09 : 0.058));

      osc.connect(clickFilter);
      clickFilter.connect(gain);
      gain.connect(kit.master);
      osc.start(now);
      osc.stop(now + 0.11);
    }

    const onPointerMove = (event: PointerEvent) => setPointer(event.clientX, event.clientY);
    const onPointerDown = (event: PointerEvent) => {
      setPointer(event.clientX, event.clientY);
      playKeyClick(true);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.repeat) playKeyClick();
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
      const kit = kitRef.current;
      kitRef.current = null;
      if (!kit) return;
      [...kit.oscillators, kit.lfo].forEach((osc) => {
        try {
          osc.stop();
        } catch {
          // Oscillators can already be stopped by the browser on teardown.
        }
      });
      void kit.ctx.close();
    };
  }, []);

  return null;
}
