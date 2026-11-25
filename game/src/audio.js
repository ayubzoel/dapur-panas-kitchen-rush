// audio.js — Hot Kitchen Rush
// Tiny synthesised sound effects with the Web Audio API. No audio files,
// no network: every sound is an oscillator (and a little noise) shaped in
// code. Audio starts only after the first user gesture.

export function createAudio() {
  const audio = {
    ctx: null,
    muted: false,
    ensure() {
      if (!this.ctx) {
        try {
          const AC = window.AudioContext || window.webkitAudioContext;
          this.ctx = new AC();
        } catch (e) {
          this.ctx = null;
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    },
    tone(freq, dur, type, vol, when, slideTo) {
      if (this.muted) return;
      const ctx = this.ensure();
      if (!ctx) return;
      const t0 = ctx.currentTime + (when || 0);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(vol || 0.12, t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    },
    noise(dur, vol, when) {
      if (this.muted) return;
      const ctx = this.ensure();
      if (!ctx) return;
      const t0 = ctx.currentTime + (when || 0);
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const gain = ctx.createGain();
      gain.gain.value = vol || 0.08;
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 1200;
      src.connect(filter).connect(gain).connect(ctx.destination);
      src.start(t0);
    },
    play(name) {
      if (this.muted) return;
      switch (name) {
        case 'pickup':
          this.tone(520, 0.07, 'triangle', 0.1);
          break;
        case 'chop':
          this.noise(0.08, 0.12);
          this.tone(220, 0.08, 'square', 0.05);
          break;
        case 'cook':
          this.tone(660, 0.12, 'sine', 0.1);
          this.tone(880, 0.14, 'sine', 0.1, 0.1);
          break;
        case 'serve':
          this.tone(523, 0.1, 'triangle', 0.12);
          this.tone(659, 0.1, 'triangle', 0.12, 0.09);
          this.tone(784, 0.18, 'triangle', 0.12, 0.18);
          break;
        case 'ding':
          this.tone(1046, 0.16, 'sine', 0.09);
          this.tone(1318, 0.2, 'sine', 0.07, 0.12);
          break;
        case 'error':
          this.tone(180, 0.18, 'sawtooth', 0.08, 0, 120);
          break;
        case 'expire':
          this.tone(330, 0.15, 'square', 0.07, 0, 220);
          this.tone(220, 0.2, 'square', 0.07, 0.14, 160);
          break;
        case 'wash':
          this.noise(0.15, 0.06);
          this.tone(740, 0.1, 'sine', 0.07, 0.05);
          break;
        case 'trash':
          this.noise(0.12, 0.1);
          break;
        case 'burn':
          this.tone(140, 0.25, 'sawtooth', 0.09, 0, 90);
          break;
        case 'dash':
          this.noise(0.1, 0.05);
          break;
        case 'over':
          this.tone(392, 0.16, 'triangle', 0.1);
          this.tone(523, 0.16, 'triangle', 0.1, 0.15);
          this.tone(659, 0.3, 'triangle', 0.1, 0.3);
          break;
        default:
          break;
      }
    },
    drain(events) {
      for (const e of events) this.play(e);
      events.length = 0;
    },
  };
  return audio;
}
