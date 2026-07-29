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
    this.transitionTimer = 0;
    this.clock = new THREE.Clock();
    this.initialized = false;

    this._status('Initializing...');
    setTimeout(() => this._init(), 100);
  }

  _status(msg) {
    const el = document.getElementById('blocker');
    if (el) el.innerHTML = `<h1>Dream Loop</h1><p style="color:#888;font-size:14px;letter-spacing:2px">${msg}</p>`;
  }

  _init() {
    try {
      this._status('Starting 3D engine...');
      this._initThree();
      this._status('Building world...');
      this._initSystems();
      this._status('Setting up controls...');
      this._setupUI();
      this._status('Checking save...');
      this._loadGame();
      this.initialized = true;
      this._status('Ready');
      this._animate();
      console.log('Dream Loop initialized successfully');
      document.getElementById('blocker').innerHTML = this._menuHTML();
    } catch (e) {
      console.error('Failed to initialize Dream Loop:', e);
      document.getElementById('blocker').innerHTML =
        '<h1 style="color:#e74c3c">Failed to load</h1>' +
        '<p style="color:#e74c3c;font-size:14px">' + (e.message || String(e)) + '</p>' +
        '<p style="color:#666;font-size:12px;margin-top:20px">Check browser console for details (F12)</p>';
    }
  }

  _menuHTML() {
    return '<div id="info">' +
      '<h1>Dream Loop</h1>' +
      '<p class="subtitle">A Psychological Horror Experience</p>' +
      '<button id="startBtn">BEGIN</button>' +
      '<button id="settingsBtn">SETTINGS</button>' +
      '<p class="hint">WASD to move. Mouse to look. Shift to sprint. F to toggle flashlight.</p>' +
    '</div>';
  }

  _initThree() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a1a);
    this.scene.fog = new THREE.FogExp2(0x0a0a1a, 0.018);

    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100);
    this.camera.position.set(0, 1.6, 0);
    this.scene.add(this.camera);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    document.body.prepend(this.renderer.domElement);

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
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

  _setupUI() {
    const $ = id => document.getElementById(id);

    const bind = (id, fn) => {
      const el = $(id);
      if (el) el.addEventListener('click', fn);
      else console.warn('UI element not found:', id);
    };

    bind('startBtn', () => {
      if (this.state === 'menu') {
        this.audio.resume();
        this._startNight(this.night);
      }
    });
    bind('settingsBtn', () => this._showSettings(true));
    bind('pauseSettingsBtn', () => this._showSettings(true));
    bind('settingsBackBtn', () => this._showSettings(false));
    bind('resumeBtn', () => this._togglePause());
    bind('quitBtn', () => this._quitToMenu());
    bind('btn-found', () => this._submitAnomaly(true));
    bind('btn-nothing', () => this._submitAnomaly(false));
    bind('ending-restart', () => this._resetGame());

    const sens = $('sensitivity');
    if (sens) sens.addEventListener('input', e => this.player?.setSensitivity(parseFloat(e.target.value)));
    const vol = $('volume');
    if (vol) vol.addEventListener('input', e => this.audio?.setVolume(parseFloat(e.target.value)));
    const bloom = $('bloom-toggle');
    if (bloom) bloom.addEventListener('change', e => this.postProcessing?.setBloom(e.target.checked));

    document.addEventListener('keydown', e => {
      if (e.code === 'Escape') {
        if (this.state === 'playing') this._togglePause();
        else if (this.state === 'paused') this._togglePause();
      }
    });

    const crosshair = document.createElement('div');
    crosshair.className = 'crosshair';
    document.body.appendChild(crosshair);
  }

  _showSettings(show) {
    document.getElementById('settings-panel').style.display = show ? 'flex' : 'none';
    if (show) {
      document.getElementById('blocker').style.display = 'none';
      document.getElementById('pause-menu').style.display = 'none';
    } else {
      if (this.state === 'menu') document.getElementById('blocker').style.display = 'flex';
      else if (this.state === 'paused') document.getElementById('pause-menu').style.display = 'flex';
    }
  }

  _togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      document.getElementById('pause-menu').style.display = 'flex';
      document.exitPointerLock();
    } else if (this.state === 'paused') {
      this.state = 'playing';
      document.getElementById('pause-menu').style.display = 'none';
      this.renderer.domElement.requestPointerLock();
      this.clock.getDelta();
    }
  }

  _quitToMenu() {
    this.state = 'menu';
    document.getElementById('pause-menu').style.display = 'none';
    document.getElementById('blocker').style.display = 'flex';
    document.getElementById('ui-overlay').style.display = 'none';
    document.exitPointerLock();
  }

  _loadGame() {
    const save = SaveSystem.load();
    if (save?.night) {
      this.night = save.night;
      document.getElementById('night-display').textContent = `NIGHT ${this.night}`;
    }
  }

  _saveGame() { SaveSystem.save({ night: this.night }); }

  _resetGame() {
    this.night = 1;
    this.anomalyIntensity = 0;
    this.anomalyPrompted = false;
    this.foundCorrect = false;
    SaveSystem.clear();
    document.getElementById('ending-screen').style.display = 'none';
    document.getElementById('blocker').style.display = 'flex';
    this.state = 'menu';
    setTimeout(() => this._startNight(1), 500);
  }

  _startNight(night) {
    this.night = night;
    this.anomalyIntensity = 0;
    this.anomalyPrompted = false;
    this.foundCorrect = false;

    this.state = 'nightTransition';
    const trans = document.getElementById('night-transition');
    trans.style.display = 'flex';
    document.getElementById('night-text').textContent = `NIGHT ${night}`;
    document.getElementById('night-subtext').textContent = this._getNightSubtext(night);
    document.getElementById('blocker').style.display = 'none';
    document.getElementById('ui-overlay').style.display = 'none';

    setTimeout(() => {
      trans.style.display = 'none';
      document.getElementById('ui-overlay').style.display = 'block';
      document.getElementById('night-display').textContent = `NIGHT ${this.night}`;
      this.state = 'playing';
      try { this.renderer.domElement.requestPointerLock(); } catch {}

      const anomaly = this.anomalyManager.selectAnomaly(this.night);
      this.anomalyManager.applyAnomaly(anomaly);

      this.camera.position.set(0, 1.6, 2);
      this.camera.rotation.set(0, 0, 0);
      this.clock.getDelta();
    }, 3000);
  }

  _getNightSubtext(night) {
    if (night <= 5) return 'Something feels different...';
    if (night <= 10) return 'The apartment knows you...';
    if (night <= 15) return 'Reality is bending...';
    if (night <= 20) return 'Nothing is as it seems...';
    if (night <= 25) return 'The dream is breaking...';
    return 'Wake up...';
  }

  _submitAnomaly(found) {
    if (this.anomalyPrompted || this.state !== 'playing') return;
    this.anomalyPrompted = true;

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
    if (this.audio) { if (correct) this.audio.playAnomaly(true); else this.audio.playHeartbeat(); }

    this.anomalyManager.revertAnomaly();

    setTimeout(() => {
      feedback.className = '';
      if (correct) {
        if (this.night >= this.maxNights) { this._showEnding(); }
        else { this.night++; this._saveGame(); this._startNight(this.night); }
      } else {
        this.anomalyPrompted = false;
        this.anomalyIntensity = 0;
        setTimeout(() => {
          const anomaly = this.anomalyManager.selectAnomaly(this.night);
          this.anomalyManager.applyAnomaly(anomaly);
          this.camera.position.set(0, 1.6, 2);
        }, 1000);
      }
    }, 2500);
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
    const fade = setInterval(() => { op += 0.02; ending.style.opacity = op; if (op >= 1) clearInterval(fade); }, 50);
  }

  _animate() {
    requestAnimationFrame(() => this._animate());
    try {
      const delta = Math.min(this.clock.getDelta(), 0.05);
      this.time += delta;
      if (this.state === 'playing') this._update(delta);
      this._render();
    } catch (e) { console.error('Frame error:', e); }
  }

  _update(delta) {
    const walls = this.level.getWalls();
    this.player.update(delta, walls);
    this.level.updateAnomalies(delta, this.time);
    if (this.camera.position.z < -4.5 && !this.anomalyPrompted) this._showAnomalyPrompt();
    this.anomalyIntensity *= 0.995;
    this.postProcessing?.update(this.time, delta, this.anomalyIntensity);
  }

  _showAnomalyPrompt() {
    document.getElementById('anomaly-prompt').style.display = 'block';
    setTimeout(() => {
      if (!this.anomalyPrompted && this.state === 'playing') this._submitAnomaly(false);
    }, 30000);
  }

  _render() {
    if (this.postProcessing) {
      this.postProcessing.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  destroy() {
    this.audio?.destroy();
    this.postProcessing?.composer?.dispose();
    this.renderer?.dispose();
  }
}
