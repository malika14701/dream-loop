export class AudioManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.volume = 0.7;
    this.isWalking = false;
    this.isSprinting = false;
    this._windInterval = null;
    this._humOsc = null;
    this._humGain = null;
    this._rainInterval = null;
  }

  init() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.ctx.destination);
      this._createAmbience();
    } catch (e) {
      console.warn('Audio unavailable:', e.message);
      this.ctx = null;
    }
  }

  setVolume(v) {
    this.volume = v;
    if (this.masterGain) this.masterGain.gain.value = v;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  _osc(duration, freq, type, vol) {
    if (!this.ctx) return null;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol || 0.1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(this.ctx.currentTime);
    osc.stop(this.ctx.currentTime + duration);
    return { osc, gain };
  }

  _noiseBuf(duration, vol) {
    if (!this.ctx) return null;
    const sampleRate = this.ctx.sampleRate;
    const len = Math.min(sampleRate * duration, sampleRate * 10);
    const buffer = this.ctx.createBuffer(1, len, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const source = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    source.buffer = buffer;
    gain.gain.setValueAtTime(vol || 0.02, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + Math.min(duration, 10));
    source.connect(gain);
    gain.connect(this.masterGain);
    source.start();
    return source;
  }

  _createAmbience() {
    if (!this.ctx) return;
    this._humOsc = this.ctx.createOscillator();
    this._humGain = this.ctx.createGain();
    this._humOsc.type = 'sine';
    this._humOsc.frequency.value = 80;
    this._humGain.gain.value = 0.02;
    this._humOsc.connect(this._humGain);
    this._humGain.connect(this.masterGain);
    this._humOsc.start();

    this._windInterval = setInterval(() => {
      if (!this.ctx) { clearInterval(this._windInterval); return; }
      this._noiseBuf(2 + Math.random() * 3, 0.01 + Math.random() * 0.02);
    }, 5000);
  }

  playFootstep(sprinting) {
    if (!this.ctx) return;
    const vol = sprinting ? 0.08 : 0.04;
    const freq = sprinting ? 180 : 120;
    this._osc(0.08, freq, 'sine', vol);
    this._osc(0.04, freq * 0.5, 'triangle', vol * 0.5);
  }

  playDoor() {
    if (!this.ctx) return;
    this._osc(0.3, 400, 'sine', 0.04);
    this._osc(0.5, 200, 'sine', 0.03);
  }

  playAnomaly(subtle) {
    if (!this.ctx) return;
    if (subtle) {
      this._osc(0.2, 800, 'sine', 0.02);
    } else {
      this._osc(0.3, 300, 'sawtooth', 0.06);
      this._osc(0.5, 150, 'sine', 0.04);
    }
  }

  playHeartbeat() {
    if (!this.ctx) return;
    this._osc(0.12, 40, 'sine', 0.06);
    setTimeout(() => this._osc(0.12, 40, 'sine', 0.06), 200);
  }

  playWhisper() {
    if (!this.ctx) return;
    this._noiseBuf(1.5, 0.015);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1500 + Math.random() * 1000;
    filter.Q.value = 0.5;
    osc.type = 'sawtooth';
    osc.frequency.value = 60 + Math.random() * 40;
    gain.gain.setValueAtTime(0.015, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 2);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 2);
  }

  playRain(intensity) {
    if (!this.ctx) return;
    if (this._rainInterval) clearInterval(this._rainInterval);
    this._rainInterval = setInterval(() => {
      if (!this.ctx) { clearInterval(this._rainInterval); return; }
      this._noiseBuf(0.5, 0.02 * intensity);
    }, 800);
  }

  stopRain() {
    if (this._rainInterval) { clearInterval(this._rainInterval); this._rainInterval = null; }
  }

  destroy() {
    if (this._windInterval) { clearInterval(this._windInterval); this._windInterval = null; }
    if (this._rainInterval) { clearInterval(this._rainInterval); this._rainInterval = null; }
    if (this._humOsc) { try { this._humOsc.stop(); } catch (e) { /* ignore */ } }
    if (this.ctx) { this.ctx.close(); this.ctx = null; }
  }
}
