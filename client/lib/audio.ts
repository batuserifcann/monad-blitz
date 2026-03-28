/**
 * Web Audio API synthesized sound effects for Tank Blitz.
 * No external audio files needed – all sounds are generated procedurally.
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

/* ── Shoot: short "pew" ──────────────────────────────────────────── */
export function playShoot(): void {
  try {
    const c = getCtx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, c.currentTime + 0.08);
    gain.gain.setValueAtTime(0.18, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.1);
    osc.connect(gain).connect(c.destination);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + 0.1);
  } catch {}
}

/* ── Hit: low "thud" ─────────────────────────────────────────────── */
export function playHit(): void {
  try {
    const c = getCtx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(60, c.currentTime + 0.15);
    gain.gain.setValueAtTime(0.25, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.15);
    osc.connect(gain).connect(c.destination);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + 0.15);
  } catch {}
}

/* ── Kill: noise-burst "explosion" ───────────────────────────────── */
export function playKill(): void {
  try {
    const c = getCtx();
    const len = c.sampleRate * 0.4;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
    const src = c.createBufferSource();
    src.buffer = buf;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.3, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.4);
    src.connect(gain).connect(c.destination);
    src.start(c.currentTime);
  } catch {}
}

/* ── Game start: ascending tone "battle horn" ────────────────────── */
export function playGameStart(): void {
  try {
    const c = getCtx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(300, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, c.currentTime + 0.3);
    gain.gain.setValueAtTime(0.15, c.currentTime);
    gain.gain.setValueAtTime(0.15, c.currentTime + 0.25);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.4);
    osc.connect(gain).connect(c.destination);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + 0.4);
  } catch {}
}

/* ── Victory: ascending arpeggio C-E-G-C ─────────────────────────── */
export function playVictory(): void {
  try {
    const c = getCtx();
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    const dur = 0.18;
    notes.forEach((freq, i) => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t0 = c.currentTime + i * dur;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.18, t0 + 0.02);
      gain.gain.setValueAtTime(0.18, t0 + dur - 0.04);
      gain.gain.linearRampToValueAtTime(0.001, t0 + dur + 0.12);
      osc.connect(gain).connect(c.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.12);
    });
  } catch {}
}
