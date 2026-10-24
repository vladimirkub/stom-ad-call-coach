// Procedural call-center background (Web Audio): distant murmur, keyboard clicks and far-off phone rings.
// No audio files and no downloads. Client-only; must be started after a user gesture.
export type Ambience = { start(): void; stop(): void; setVolume(v: number): void; state(): string };

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export function createAmbience(): Ambience {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let timers: ReturnType<typeof setTimeout>[] = [];
  let volume = 0.4;

  // Brown-ish noise: smooth and low, a good base for room tone and babble.
  function noise(c: AudioContext, seconds: number) {
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * seconds), c.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      d[i] = last * 3.5;
    }
    return buf;
  }

  function loop(fn: () => void, min: number, max: number) {
    const tick = () => {
      if (!ctx) return;
      fn();
      timers.push(setTimeout(tick, rand(min, max)));
    };
    timers.push(setTimeout(tick, rand(min, max)));
  }

  function start() {
    if (ctx) return;
    const c = new AudioContext();
    ctx = c;
    void c.resume();
    master = c.createGain();
    master.gain.value = volume * 0.3;
    master.connect(c.destination);
    const base = noise(c, 6);

    // Room tone.
    const room = c.createBufferSource();
    room.buffer = base;
    room.loop = true;
    const roomLp = c.createBiquadFilter();
    roomLp.type = "lowpass";
    roomLp.frequency.value = 600;
    const roomGain = c.createGain();
    roomGain.gain.value = 0.55;
    room.connect(roomLp).connect(roomGain).connect(master);
    room.start();

    // Murmur of distant conversations: three voice-band layers with randomly fluctuating loudness.
    const layers = [450, 900, 1700].map((freq, i) => {
      const src = c.createBufferSource();
      src.buffer = base;
      src.loop = true;
      src.playbackRate.value = 1 + i * 0.07; // decorrelate the layers
      const bp = c.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = freq;
      bp.Q.value = 1.3;
      const g = c.createGain();
      g.gain.value = 0.4;
      src.connect(bp).connect(g).connect(master!);
      src.start(0, rand(0, 4));
      return g;
    });
    loop(() => layers.forEach((g) => g.gain.setTargetAtTime(rand(0.08, 1) * 0.9, c.currentTime, 0.12)), 140, 380);

    // Keyboard clicks.
    loop(() => {
      const len = Math.floor(c.sampleRate * 0.012);
      const buf = c.createBuffer(1, len, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
      const s = c.createBufferSource();
      s.buffer = buf;
      const hp = c.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 1800;
      const g = c.createGain();
      g.gain.value = rand(0.05, 0.22);
      s.connect(hp).connect(g).connect(master!);
      s.start();
    }, 120, 900);

    // Rare far-off phone ring (two bursts).
    loop(() => {
      const lp = c.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 1400;
      const g = c.createGain();
      g.gain.value = 0;
      lp.connect(g).connect(master!);
      const t0 = c.currentTime;
      for (const f of [440, 480]) {
        const o = c.createOscillator();
        o.frequency.value = f;
        o.connect(lp);
        o.start(t0);
        o.stop(t0 + 1.4);
      }
      for (const off of [0, 0.7]) {
        g.gain.setValueAtTime(0, t0 + off);
        g.gain.linearRampToValueAtTime(0.05, t0 + off + 0.03);
        g.gain.setValueAtTime(0.05, t0 + off + 0.4);
        g.gain.linearRampToValueAtTime(0, t0 + off + 0.45);
      }
    }, 12000, 32000);
  }

  function stop() {
    timers.forEach(clearTimeout);
    timers = [];
    const c = ctx;
    ctx = null;
    master = null;
    if (c) void c.close().catch(() => {});
  }

  return {
    start,
    stop,
    setVolume(v: number) {
      volume = Math.min(1, Math.max(0, v));
      if (master && ctx) master.gain.setTargetAtTime(volume * 0.3, ctx.currentTime, 0.1);
    },
    state: () => ctx?.state ?? "stopped",
  };
}
