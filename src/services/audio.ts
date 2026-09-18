// Procedural Web Audio Synthesizer (zero external audio files needed)

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;
let rumbleSrc: { s: AudioBufferSourceNode; g: GainNode } | null = null;
let isMuted = false;
let lastSquelchTime = 0;

export function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new AudioCtxClass();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = isMuted ? 0 : 0.5;
    masterGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function setMuted(muted: boolean): void {
  isMuted = muted;
  if (masterGain && audioCtx) {
    masterGain.gain.value = muted ? 0 : 0.5;
  }
  if (muted) {
    stopRumble();
  }
}

export function getIsMuted(): boolean {
  return isMuted;
}

export function tone(
  freq: number,
  dur: number,
  type: OscillatorType = 'sine',
  vol = 0.2,
  slide = 0
): void {
  if (isMuted) return;
  try {
    const ctx = getAudioContext();
    if (!masterGain) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    }

    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    osc.connect(gain);
    gain.connect(masterGain);

    osc.start(t);
    osc.stop(t + dur + 0.02);
  } catch {
    // Ignore audio playback errors
  }
}

function getNoiseBuf(): AudioBuffer {
  const ctx = getAudioContext();
  if (!noiseBuffer) {
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate | 0, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  }
  return noiseBuffer;
}

export function noiseS(
  dur = 0.15,
  freq = 1200,
  vol = 0.15,
  type: BiquadFilterType = 'lowpass'
): void {
  if (isMuted) return;
  try {
    const ctx = getAudioContext();
    if (!masterGain) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = getNoiseBuf();

    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);

    src.start(t, Math.random() * 0.5, dur + 0.05);
  } catch {
    // Ignore audio playback errors
  }
}

export function startRumble(): void {
  if (isMuted || rumbleSrc) return;
  try {
    const ctx = getAudioContext();
    if (!masterGain) return;
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let v = 0;
    for (let i = 0; i < len; i++) {
      v = v * 0.98 + (Math.random() * 2 - 1) * 0.05;
      d[i] = v * 3;
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 110;

    const gain = ctx.createGain();
    gain.gain.value = 0.25;

    src.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);

    src.start();
    rumbleSrc = { s: src, g: gain };
  } catch {
    // Ignore audio playback errors
  }
}

export function stopRumble(): void {
  if (rumbleSrc && audioCtx) {
    try {
      const s = rumbleSrc.s;
      rumbleSrc.g.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.3);
      setTimeout(() => {
        try {
          s.stop();
        } catch {
          // Ignore
        }
      }, 400);
    } catch {
      // Ignore
    }
    rumbleSrc = null;
  }
}

export const SND = {
  roll(): void {
    noiseS(0.1, 420, 0.06);
  },
  whoosh(): void {
    noiseS(0.35, 900, 0.16, 'bandpass');
  },
  thud(): void {
    tone(95, 0.16, 'sine', 0.3, -45);
    noiseS(0.06, 300, 0.1);
  },
  squelch(currentTime = 0): void {
    if (currentTime - lastSquelchTime < 0.09) return;
    lastSquelchTime = currentTime;
    tone(150 + Math.random() * 90, 0.07, 'sine', 0.06, -70);
    if (Math.random() < 0.4) {
      noiseS(0.05, 700, 0.05);
    }
  },
  tick(): void {
    tone(1500 + Math.random() * 1500, 0.03, 'triangle', 0.035);
  },
  crackle(): void {
    noiseS(0.03, 2000 + Math.random() * 2500, 0.03, 'bandpass');
  },
  swish(): void {
    noiseS(0.16, 1600, 0.14, 'highpass');
  },
  ding(): void {
    tone(1318, 0.5, 'sine', 0.16);
    tone(1976, 0.4, 'sine', 0.06);
  },
  deny(): void {
    tone(180, 0.12, 'square', 0.05, -40);
  },
  pop(): void {
    tone(650 + Math.random() * 300, 0.07, 'sine', 0.16, 180);
    noiseS(0.04, 1800, 0.06, 'highpass');
  },
  coin(): void {
    tone(987.77, 0.08, 'sine', 0.15); // B5
    setTimeout(() => tone(1318.51, 0.28, 'sine', 0.18), 70); // E6
  },
  levelUp(): void {
    const notes = [440, 554, 659, 880];
    notes.forEach((f, i) => {
      setTimeout(() => tone(f, 0.12, 'triangle', 0.12), i * 60);
    });
  },
  flame(): void {
    noiseS(0.25, 450, 0.14, 'bandpass');
    tone(70, 0.2, 'sawtooth', 0.08, -25);
  },
  stamp(): void {
    tone(85, 0.18, 'sine', 0.35, -40);
    noiseS(0.08, 500, 0.18);
    setTimeout(() => tone(1567.98, 0.25, 'triangle', 0.12), 40);
  },
  gameStart(): void {
    noiseS(0.2, 800, 0.1, 'bandpass');
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5]; // C5, E5, G5, C6, E6
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        tone(freq, 0.18, 'triangle', 0.14);
      }, idx * 70);
    });
  },
  win(): void {
    [523, 659, 784, 1047].forEach((f, i) =>
      setTimeout(() => tone(f, 0.25, 'triangle', 0.14), i * 110)
    );
  }
};

export function vib(pattern: number | number[]): void {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignore
    }
  }
}
