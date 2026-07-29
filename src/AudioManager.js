export class AudioManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.volume = 0.7;
    this.footstepTimer = 0;
    this.isWalking = false;
    this.isSprinting = false;
  }

  init() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.volume;
    this.masterGain.connect(this.ctx.destination);
    this.createAmbience();
  }

  setVolume(v) {
    this.volume = v;
    if (this.masterGain) this.masterGain.gain.value = v;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  // Procedural noise
  _noise(duration, freq, type, vol) {
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

  _whiteNoise(duration, vol) {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const source = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    source.buffer = buffer;
    gain.gain.setValueAtTime(vol || 0.02, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    source.connect(gain);
    gain.connect(this.masterGain);
    source.start();
  }

  // Ambience
  createAmbience() {
    if (!this.ctx) return;
    // Low hum
    this._noise(999, 80, 'sine', 0.02);
    // Wind-like noise
    const windInterval = setInterval(() => {
      if (!this.ctx) { clearInterval(windInterval); return; }
      this._whiteNoise(2 + Math.random() * 3, 0.01 + Math.random() * 0.02);
    }, 5000);
    this._windInterval = windInterval;
  }

  // Footsteps
  playFootstep(sprinting) {
    if (!this.ctx) return;
    const vol = sprinting ? 0.08 : 0.04;
    const freq = sprinting ? 180 : 120;
    this._noise(0.08, freq, 'sine', vol);
    this._noise(0.04, freq * 0.5, 'triangle', vol * 0.5);
  }

  // Door
  playDoor() {
    if (!this.ctx) return;
    this._noise(0.3, 400, 'sine', 0.04);
    this._noise(0.5, 200, 'sine', 0.03);
  }

  // Anomaly sound
  playAnomaly(subtle) {
    if (!this.ctx) return;
    if (subtle) {
      this._noise(0.2, 800, 'sine', 0.02);
    } else {
      this._noise(0.3, 300, 'sawtooth', 0.06);
      this._noise(0.5, 150, 'sine', 0.04);
    }
  }

  // Heartbeat for tension
  playHeartbeat() {
    if (!this.ctx) return;
    this._noise(0.12, 40, 'sine', 0.06);
    setTimeout(() => this._noise(0.12, 40, 'sine', 0.06), 200);
  }

  // Whisper
  playWhisper() {
    if (!this.ctx) return;
    this._whiteNoise(1.5, 0.015);
    // Filtered noise for whisper effect
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

  // Rain ambience
  playRain(intensity) {
    if (!this.ctx) return;
    this._whiteNoise(999, 0.02 * intensity);
  }

  destroy() {
    if (this._windInterval) clearInterval(this._windInterval);
    if (this.ctx) this.ctx.close();
  }
}
