import { useEffect, useRef } from 'react';

type AudioKit = {
  ctx: AudioContext;
  master: GainNode;
  ambient: GainNode;
  filter: BiquadFilterNode;
  oscillators: OscillatorNode[];
  lfo: OscillatorNode;
  lfoGain: GainNode;
  noise: AudioBuffer;
};

const BACKGROUND_MUSIC_SRC = '/background-music.mp3';

function createNoiseBuffer(ctx: AudioContext) {
  const length = Math.floor(ctx.sampleRate * 0.09);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    const fade = 1 - i / length;
    data[i] = (Math.random() * 2 - 1) * fade;
  }
  return buffer;
}

function createAudioKit(): AudioKit | null {
  if (typeof window === 'undefined' || !window.AudioContext) return null;

  const ctx = new window.AudioContext();
  const master = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  const ambient = ctx.createGain();
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  const noise = createNoiseBuffer(ctx);

  master.gain.value = 0.16;
  filter.type = 'lowpass';
  filter.frequency.value = 720;
  filter.Q.value = 0.42;
  ambient.gain.value = 0.066;

  ambient.connect(filter);
  filter.connect(master);
  master.connect(ctx.destination);

  lfo.type = 'sine';
  lfo.frequency.value = 0.035;
  lfoGain.gain.value = 0.022;
  lfo.connect(lfoGain);
  lfoGain.connect(ambient.gain);
  lfo.start();

  const oscillators = [73.42, 110, 146.83, 220].map((frequency, index) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = index === 1 ? 'triangle' : 'sine';
    osc.frequency.value = frequency;
    gain.gain.value = index === 0 ? 0.45 : 0.2;
    osc.connect(gain);
    gain.connect(ambient);
    osc.start();
    return osc;
  });

  return { ctx, master, ambient, filter, oscillators, lfo, lfoGain, noise };
}

export function InteractionEffects() {
  const kitRef = useRef<AudioKit | null>(null);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const lastTapRef = useRef(0);
  const musicTriedRef = useRef(false);

  useEffect(() => {
    const root = document.documentElement;
    let touchTimer = 0;

    function setPointer(x: number, y: number) {
      root.style.setProperty('--pointer-x', `${(x / window.innerWidth) * 100}%`);
      root.style.setProperty('--pointer-y', `${(y / window.innerHeight) * 100}%`);
      root.style.setProperty('--pointer-tilt-x', `${(x / window.innerWidth - 0.5) * 16}deg`);
      root.style.setProperty('--pointer-tilt-y', `${(y / window.innerHeight - 0.5) * -16}deg`);
    }

    function ensureAudio() {
      if (!kitRef.current) kitRef.current = createAudioKit();
      if (kitRef.current?.ctx.state === 'suspended') void kitRef.current.ctx.resume();
      return kitRef.current;
    }

    function isTypingTarget(target: EventTarget | null) {
      if (!(target instanceof HTMLElement)) return false;
      return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable;
    }

    async function startBackgroundMusic() {
      const audio = musicRef.current;
      if (!audio || (musicTriedRef.current && !audio.paused)) return;
      musicTriedRef.current = true;
      audio.volume = 0.12;
      audio.loop = true;
      try {
        await audio.play();
        const kit = ensureAudio();
        if (kit) kit.ambient.gain.setTargetAtTime(0.018, kit.ctx.currentTime, 0.8);
      } catch {
        musicTriedRef.current = false;
        const kit = ensureAudio();
        if (kit) kit.ambient.gain.setTargetAtTime(0.066, kit.ctx.currentTime, 0.8);
      }
    }

    function markTouch(x: number, y: number) {
      root.style.setProperty('--touch-x', `${(x / window.innerWidth) * 100}%`);
      root.style.setProperty('--touch-y', `${(y / window.innerHeight) * 100}%`);
      root.classList.add('fx-touching');
      window.clearTimeout(touchTimer);
      touchTimer = window.setTimeout(() => root.classList.remove('fx-touching'), 760);
    }

    function playKeyClick(soft = false) {
      const kit = ensureAudio();
      if (!kit) return;
      const now = kit.ctx.currentTime;
      if (now - lastTapRef.current < 0.018) return;
      lastTapRef.current = now;

      const noise = kit.ctx.createBufferSource();
      const noiseGain = kit.ctx.createGain();
      const noiseFilter = kit.ctx.createBiquadFilter();
      const thock = kit.ctx.createOscillator();
      const thockGain = kit.ctx.createGain();
      const snap = kit.ctx.createOscillator();
      const snapGain = kit.ctx.createGain();

      noise.buffer = kit.noise;
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.value = soft ? 920 : 1650;
      noiseFilter.Q.value = soft ? 2.6 : 5.8;
      noiseGain.gain.setValueAtTime(0.0001, now);
      noiseGain.gain.exponentialRampToValueAtTime(soft ? 0.06 : 0.13, now + 0.004);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + (soft ? 0.07 : 0.046));

      thock.type = 'triangle';
      thock.frequency.setValueAtTime(soft ? 138 : 164 + Math.random() * 18, now);
      thockGain.gain.setValueAtTime(0.0001, now);
      thockGain.gain.exponentialRampToValueAtTime(soft ? 0.04 : 0.072, now + 0.008);
      thockGain.gain.exponentialRampToValueAtTime(0.0001, now + (soft ? 0.12 : 0.082));

      snap.type = 'square';
      snap.frequency.setValueAtTime(soft ? 420 : 740 + Math.random() * 90, now);
      snapGain.gain.setValueAtTime(0.0001, now);
      snapGain.gain.exponentialRampToValueAtTime(soft ? 0.008 : 0.024, now + 0.003);
      snapGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.022);

      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(kit.master);
      thock.connect(thockGain);
      thockGain.connect(kit.master);
      snap.connect(snapGain);
      snapGain.connect(kit.master);

      noise.start(now);
      noise.stop(now + 0.09);
      thock.start(now);
      thock.stop(now + 0.13);
      snap.start(now);
      snap.stop(now + 0.03);
    }

    const onPointerMove = (event: PointerEvent) => setPointer(event.clientX, event.clientY);
    const onPointerDown = (event: PointerEvent) => {
      setPointer(event.clientX, event.clientY);
      markTouch(event.clientX, event.clientY);
      void startBackgroundMusic();
      playKeyClick(true);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      void startBackgroundMusic();
      if (isTypingTarget(event.target) && event.key.length === 1) return;
      if (!event.repeat) {
        root.classList.add('fx-keying');
        window.setTimeout(() => root.classList.remove('fx-keying'), 120);
        playKeyClick();
      }
    };
    const onInput = (event: Event) => {
      if (!isTypingTarget(event.target)) return;
      void startBackgroundMusic();
      root.classList.add('fx-keying');
      window.setTimeout(() => root.classList.remove('fx-keying'), 120);
      playKeyClick();
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('input', onInput, true);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('input', onInput, true);
      window.clearTimeout(touchTimer);
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

  return <audio ref={musicRef} src={BACKGROUND_MUSIC_SRC} preload="auto" loop aria-hidden />;
}
