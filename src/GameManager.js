import * as THREE from 'three';
import { Level } from './Level.js';
import { Player } from './Player.js';
import { AudioManager } from './AudioManager.js';
import { AnomalyManager } from './AnomalyManager.js';
import { PostProcessing } from './PostProcessing.js';
import { SaveSystem } from './SaveSystem.js';

export class GameManager {
  constructor() {
    this.state = 'menu';
    this.night = 1;
    this.maxNights = 30;
    this.time = 0;
    this.anomalyIntensity = 0;
    this.anomalyPrompted = false;
    this.foundCorrect = false;
    this.clock = new THREE.Clock();
    this.initialized = false;
    this._promptTimeout = null;

    this._showStatus('Loading...');
    setTimeout(() => this._init(), 100);
  }

  _showStatus(msg) {
    const el = document.getElementById('blocker');
    if (el) el.innerHTML = `<h1 style="font-size:48px;letter-spacing:8px;margin-bottom:16px">Dream Loop</h1><p style="color:#888;font-size:14px;letter-spacing:2px">${msg}</p>`;
  }

  _init() {
    try {
      this._showStatus('Starting 3D engine...');
      this._initThree();
      this._showStatus('Building world...');
      this._initSystems();
      this._showStatus('Setting up...');
      this._loadGame();
      this.initialized = true;
      this._bindStaticUI();
      this._showMenu();
      this._animate();
      console.log('Dream Loop initialized');
    } catch (e) {
      console.error('Init error:', e);
      document.getElementById('blocker').innerHTML =
        '<h1 style="color:#e74c3c;font-size:36px">Failed to load</h1>' +
        '<p style="color:#e74c3c;font-size:14px;margin-top:12px">' +
        (e.message || String(e)) + '</p>' +
        '<p style="color:#666;font-size:12px;margin-top:20px">Press F12 and check Console tab for details</p>';
    }
  }

  _showMenu() {
    const blocker = document.getElementById('blocker');
    blocker.innerHTML =
      '<div id="menu">' +
        '<h1>Dream Loop</h1>' +
        '<p class="subtitle">A Psychological Horror Experience</p>' +
        '<button class="menu-btn" data-action="start">BEGIN</button>' +
        '<button class="menu-btn" data-action="settings">SETTINGS</button>' +
        '<p class="hint">WASD to move &middot; Mouse to look &middot; Shift to sprint &middot; F for flashlight</p>' +
      '</div>';
    blocker.querySelector('[data-action="start"]').onclick = () => {
      if (this.state === 'menu') {
        this.audio.resume();
        this._startNight(this.night);
      }
    };
    blocker.querySelector('[data-action="settings"]').onclick = () => this._showSettings(true);
  }

  _bindStaticUI() {
    document.getElementById('resumeBtn').onclick = () => this._togglePause();
    document.getElementById('pauseSettingsBtn').onclick = () => this._showSettings(true);
    document.getElementById('settingsBackBtn').onclick = () => this._showSettings(false);
    document.getElementById('quitBtn').onclick = () => this._quitToMenu();
    document.getElementById('btn-found').onclick = () => this._submitAnomaly(true);
    document.getElementById('btn-nothing').onclick = () => this._submitAnomaly(false);
    document.getElementById('ending-restart').onclick = () => this._resetGame();

    document.getElementById('sensitivity').oninput = (e) => {
      if (this.player) this.player.setSensitivity(parseFloat(e.target.value));
    };
    document.getElementById('volume').oninput = (e) => {
      if (this.audio) this.audio.setVolume(parseFloat(e.target.value));
    };
    document.getElementById('bloom-toggle').onchange = (e) => {
      if (this.postProcessing) this.postProcessing.setBloom(e.target.checked);
    };

    document.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') {
        if (this.state === 'playing') this._togglePause();
        else if (this.state === 'paused') this._togglePause();
      }
    });

    const crosshair = document.createElement('div');
    crosshair.className = 'crosshair';
    document.body.appendChild(crosshair);
  }

  _initThree() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a1a);
    this.scene.fog = new THREE.FogExp2(0x0a0a1a, 0.018);

    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100);
    this.camera.position.set(0, 1.6, 0);
    this.scene.add(this.camera);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    document.body.prepend(this.renderer.domElement);

    const onResize = () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);
    this._cleanupFns = [() => window.removeEventListener('resize', onResize)];
  }

  _initSystems() {
    this.audio = new AudioManager();
    this.audio.init();
    this.level = new Level(this.scene, this.audio);
    this.level.build();
    this.player = new Player(this.camera, this.scene, this.audio);
    this.anomalyManager = new AnomalyManager(this.level, this.audio);
    try {
      this.postProcessing = new PostProcessing(this.renderer, this.scene, this.camera);
    } catch (e) {
      console.warn('Post-processing unavailable:', e.message);
      this.postProcessing = null;
    }
  }

  _loadGame() {
    const save = SaveSystem.load();
    if (save && save.night) {
      this.night = save.night;
    }
  }

  _saveGame() {
    SaveSystem.save({ night: this.night });
  }

  _startNight(night) {
    this.night = night;
    this.anomalyIntensity = 0;
    this.anomalyPrompted = false;
    this.foundCorrect = false;

    this.state = 'nightTransition';
    const trans = document.getElementById('night-transition');
    trans.style.display = 'flex';
    document.getElementById('night-text').textContent = 'NIGHT ' + night;
    document.getElementById('night-subtext').textContent = this._nightSubtext(night);
    document.getElementById('blocker').style.display = 'none';
    document.getElementById('ui-overlay').style.display = 'none';

    setTimeout(() => {
      trans.style.display = 'none';
      document.getElementById('ui-overlay').style.display = 'block';
      document.getElementById('night-display').textContent = 'NIGHT ' + this.night;
      this.state = 'playing';

      this.camera.position.set(0, 1.6, 2);
      this.camera.rotation.set(0, 0, 0);
      this.clock.getDelta();

      try { this.renderer.domElement.requestPointerLock(); } catch (e) { /* pointer lock may fail */ }

      const anomaly = this.anomalyManager.selectAnomaly(this.night);
      if (anomaly) this.anomalyManager.applyAnomaly(anomaly);
    }, 3000);
  }

  _nightSubtext(night) {
    if (night <= 5) return 'Something feels different...';
    if (night <= 10) return 'The apartment knows you...';
    if (night <= 15) return 'Reality is bending...';
    if (night <= 20) return 'Nothing is as it seems...';
    if (night <= 25) return 'The dream is breaking...';
    return 'Wake up...';
  }

  _togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      document.getElementById('pause-menu').style.display = 'flex';
      document.exitPointerLock();
    } else if (this.state === 'paused') {
      this.state = 'playing';
      document.getElementById('pause-menu').style.display = 'none';
      this.clock.getDelta();
      try { this.renderer.domElement.requestPointerLock(); } catch (e) { /* ignore */ }
    }
  }

  _showSettings(show) {
    const panel = document.getElementById('settings-panel');
    panel.style.display = show ? 'flex' : 'none';
    if (show) {
      document.getElementById('blocker').style.display = 'none';
      document.getElementById('pause-menu').style.display = 'none';
    } else {
      const blocker = document.getElementById('blocker');
      const pause = document.getElementById('pause-menu');
      if (this.state === 'menu' || this.state === '') {
        blocker.style.display = 'flex';
        pause.style.display = 'none';
      } else if (this.state === 'paused') {
        pause.style.display = 'flex';
        blocker.style.display = 'none';
      }
    }
  }

  _quitToMenu() {
    this.state = 'menu';
    document.getElementById('pause-menu').style.display = 'none';
    document.getElementById('ui-overlay').style.display = 'none';
    document.exitPointerLock();
    this._showMenu();
  }

  _resetGame() {
    this.night = 1;
    this.anomalyIntensity = 0;
    this.anomalyPrompted = false;
    this.foundCorrect = false;
    SaveSystem.clear();
    document.getElementById('ending-screen').style.display = 'none';
    this.state = 'menu';
    this._showMenu();
  }

  _submitAnomaly(found) {
    if (this.anomalyPrompted || this.state !== 'playing') return;
    this.anomalyPrompted = true;
    if (this._promptTimeout) { clearTimeout(this._promptTimeout); this._promptTimeout = null; }

    const hasAnomaly = this.anomalyManager.verifyCorrect();
    const correct = (found && hasAnomaly) || (!found && !hasAnomaly);
    this.foundCorrect = correct;

    const feedback = document.getElementById('anomaly-feedback');
    feedback.textContent = correct
      ? (hasAnomaly ? 'ANOMALY CONFIRMED' : 'ALL CLEAR')
      : (hasAnomaly ? 'YOU MISSED IT...' : 'FALSE ALARM...');
    feedback.className = correct ? 'show correct' : 'show incorrect';
    document.getElementById('anomaly-prompt').style.display = 'none';
    this.anomalyIntensity = correct ? 0.3 : 0.8;
    if (this.audio) {
      if (correct) this.audio.playAnomaly(true);
      else this.audio.playHeartbeat();
    }

    this.anomalyManager.revertAnomaly();

    setTimeout(() => {
      feedback.className = '';
      if (correct) {
        if (this.night >= this.maxNights) {
          this._showEnding();
        } else {
          this.night++;
          this._saveGame();
          this._startNight(this.night);
        }
      } else {
        this.anomalyPrompted = false;
        this.anomalyIntensity = 0;
        setTimeout(() => {
          const anomaly = this.anomalyManager.selectAnomaly(this.night);
          if (anomaly) this.anomalyManager.applyAnomaly(anomaly);
          this.camera.position.set(0, 1.6, 2);
        }, 1000);
      }
    }, 2500);
  }

  _showAnomalyPrompt() {
    const prompt = document.getElementById('anomaly-prompt');
    prompt.style.display = 'block';
    this._promptTimeout = setTimeout(() => {
      if (!this.anomalyPrompted && this.state === 'playing') {
        this._submitAnomaly(false);
      }
    }, 30000);
  }

  _showEnding() {
    this.state = 'ending';
    document.getElementById('ui-overlay').style.display = 'none';
    document.exitPointerLock();
    const ending = document.getElementById('ending-screen');
    ending.style.display = 'flex';
    ending.style.opacity = '0';
    document.getElementById('ending-text').textContent =
      'You have passed through the dream enough times to understand.\n' +
      'This apartment was never real. Every wall, every object, every night — ' +
      'all a reflection of a mind trying to make sense of the void.\n' +
      'The doors lead nowhere. The windows show no world. ' +
      'The only truth is that you are the dreamer.\n' +
      'And now, you are ready to wake up.';
    let op = 0;
    const fade = setInterval(() => {
      op += 0.02;
      ending.style.opacity = '' + op;
      if (op >= 1) clearInterval(fade);
    }, 50);
  }

  _animate() {
    requestAnimationFrame(this._animate.bind(this));
    try {
      const delta = Math.min(this.clock.getDelta(), 0.05);
      this.time += delta;
      if (this.state === 'playing') this._update(delta);
      this._render();
    } catch (e) {
      console.error('Frame error:', e);
    }
  }

  _update(delta) {
    const walls = this.level.getWalls();
    this.player.update(delta, walls);
    this.level.updateAnomalies(delta, this.time);
    if (this.camera.position.z < -4.5 && !this.anomalyPrompted && !this._promptTimeout) {
      this._showAnomalyPrompt();
    }
    this.anomalyIntensity *= 0.995;
    if (this.postProcessing) this.postProcessing.update(this.time, delta, this.anomalyIntensity);
  }

  _render() {
    if (this.postProcessing) {
      this.postProcessing.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  destroy() {
    if (this.audio) this.audio.destroy();
    if (this.postProcessing && this.postProcessing.composer) this.postProcessing.composer.dispose();
    if (this.renderer) this.renderer.dispose();
    if (this._cleanupFns) this._cleanupFns.forEach(fn => fn());
  }
}
