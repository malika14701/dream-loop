import * as THREE from 'three';
import { Level } from './Level.js';
import { Player } from './Player.js';
import { AudioManager } from './AudioManager.js';
import { AnomalyManager } from './AnomalyManager.js';
import { PostProcessing } from './PostProcessing.js';
import { SaveSystem } from './SaveSystem.js';

/**
 * Core game manager - orchestrates all systems.
 */
export class GameManager {
  constructor() {
    this.state = 'menu'; // menu | playing | paused | nightTransition | ending
    this.night = 1;
    this.maxNights = 30;
    this.time = 0;
    this.anomalyIntensity = 0; // 0-1, for post-processing effects
    this.anomalyPrompted = false;
    this.foundCorrect = false;
    this.transitionTimer = 0;
    this.clock = new THREE.Clock();

    // Systems (initialized later)
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.level = null;
    this.player = null;
    this.audio = null;
    this.anomalyManager = null;
    this.postProcessing = null;

    this._initThree();
    this._initSystems();
    this._setupUI();

    // Load save
    this._loadGame();

    this._animate();
  }

  _initThree() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a1a);
    this.scene.fog = new THREE.FogExp2(0x0a0a1a, 0.015);

    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100);
    this.camera.position.set(0, 1.6, 0);

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

    this.postProcessing = new PostProcessing(this.renderer, this.scene, this.camera);
  }

  _setupUI() {
    // Start button
    document.getElementById('startBtn').addEventListener('click', () => {
      if (this.state === 'menu') {
        this.audio.resume();
        this._startNight(this.night);
      }
    });

    // Settings buttons
    document.getElementById('settingsBtn').addEventListener('click', () => this._showSettings(true));
    document.getElementById('pauseSettingsBtn').addEventListener('click', () => this._showSettings(true));
    document.getElementById('settingsBackBtn').addEventListener('click', () => this._showSettings(false));

    // Pause menu buttons
    document.getElementById('resumeBtn').addEventListener('click', () => this._togglePause());
    document.getElementById('quitBtn').addEventListener('click', () => this._quitToMenu());

    // Anomaly buttons
    document.getElementById('btn-found').addEventListener('click', () => this._submitAnomaly(true));
    document.getElementById('btn-nothing').addEventListener('click', () => this._submitAnomaly(false));

    // Settings controls
    document.getElementById('sensitivity').addEventListener('input', (e) => {
      this.player.setSensitivity(parseFloat(e.target.value));
    });
    document.getElementById('volume').addEventListener('input', (e) => {
      this.audio.setVolume(parseFloat(e.target.value));
    });
    document.getElementById('bloom-toggle').addEventListener('change', (e) => {
      this.postProcessing.setBloom(e.target.checked);
    });

    // Ending restart
    document.getElementById('ending-restart').addEventListener('click', () => {
      this._resetGame();
    });

    // Escape key for pause
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') {
        if (this.state === 'playing') this._togglePause();
        else if (this.state === 'paused') this._togglePause();
      }
    });

    // Crosshair
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
      if (this.state === 'menu') {
        document.getElementById('blocker').style.display = 'flex';
      } else if (this.state === 'paused') {
        document.getElementById('pause-menu').style.display = 'flex';
      }
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
      this.clock.getDelta(); // Reset delta
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
    if (save && save.night) {
      this.night = save.night;
      document.getElementById('night-display').textContent = `NIGHT ${this.night}`;
    }
  }

  _saveGame() {
    SaveSystem.save({ night: this.night });
  }

  _resetGame() {
    this.night = 1;
    this.anomalyIntensity = 0;
    this.anomalyPrompted = false;
    this.foundCorrect = false;
    SaveSystem.clear();
    document.getElementById('ending-screen').style.display = 'none';
    document.getElementById('blocker').style.display = 'flex';
    this.state = 'menu';
    this._startNight(1);
  }

  _startNight(night) {
    this.night = night;
    this.anomalyIntensity = 0;
    this.anomalyPrompted = false;
    this.foundCorrect = false;

    // Night transition screen
    this.state = 'nightTransition';
    this.transitionTimer = 0;
    const trans = document.getElementById('night-transition');
    trans.style.display = 'flex';
    document.getElementById('night-text').textContent = `NIGHT ${night}`;
    document.getElementById('night-subtext').textContent = this._getNightSubtext(night);
    document.getElementById('blocker').style.display = 'none';
    document.getElementById('ui-overlay').style.display = 'none';

    // After brief delay, start
    setTimeout(() => {
      trans.style.display = 'none';
      document.getElementById('ui-overlay').style.display = 'block';
      document.getElementById('night-display').textContent = `NIGHT ${this.night}`;
      this.state = 'playing';
      this.renderer.domElement.requestPointerLock();

      // Select and apply anomaly
      const anomaly = this.anomalyManager.selectAnomaly(this.night);
      this.anomalyManager.applyAnomaly(anomaly);

      // Set initial position
      this.camera.position.set(0, 1.6, 2);

      this.clock.getDelta(); // Reset clock
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

    if (this.audio) {
      if (correct) this.audio.playAnomaly(true);
      else this.audio.playHeartbeat();
    }

    // Reset anomaly
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
        // Night resets - same night, new anomaly position
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
    document.getElementById('ending-text').textContent =
      'You have passed through the dream enough times to understand.\n\n' +
      'This apartment was never real. Every wall, every object, every night — ' +
      'all a reflection of a mind trying to make sense of the void.\n\n' +
      'The doors lead nowhere. The windows show no world. ' +
      'The only truth is that you are the dreamer.\n\n' +
      'And now, you are ready to wake up.';

    // Fade in
    ending.style.opacity = '0';
    let op = 0;
    const fade = setInterval(() => {
      op += 0.02;
      ending.style.opacity = op;
      if (op >= 1) clearInterval(fade);
    }, 50);
  }

  _animate() {
    requestAnimationFrame(() => this._animate());

    const delta = Math.min(this.clock.getDelta(), 0.05);
    this.time += delta;

    if (this.state === 'playing') {
      this._update(delta);
    }

    this._render();
  }

  _update(delta) {
    const walls = this.level.getWalls();
    this.player.update(delta, walls);

    // Update level anomalies
    this.level.updateAnomalies(delta, this.time);

    // Check if player is near entrance (z < -4.5)
    if (this.camera.position.z < -4.5 && !this.anomalyPrompted) {
      this._showAnomalyPrompt();
    }

    // Decrease anomaly intensity
    this.anomalyIntensity *= 0.995;

    // Post-processing update
    this.postProcessing.update(this.time, delta, this.anomalyIntensity);
  }

  _showAnomalyPrompt() {
    document.getElementById('anomaly-prompt').style.display = 'block';
    // Auto-hide after 30 seconds, count as "found nothing"
    setTimeout(() => {
      if (!this.anomalyPrompted && this.state === 'playing') {
        this._submitAnomaly(false);
      }
    }, 30000);
  }

  _render() {
    // Update flashlight cone direction
    this.renderer.render(this.scene, this.camera);
    if (this.postProcessing) {
      this.postProcessing.render();
    }
  }

  destroy() {
    if (this.audio) this.audio.destroy();
    if (this.postProcessing && this.postProcessing.composer) {
      this.postProcessing.composer.dispose();
    }
    this.renderer.dispose();
  }
}
