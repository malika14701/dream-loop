import * as THREE from 'three';

// Each anomaly is a function (level, nightNumber) => { apply, revert, description }
// apply() modifies the level
// revert() restores it
// description is a hint for debug

export class AnomalyManager {
  constructor(level, audioManager) {
    this.level = level;
    this.audio = audioManager;
    this.currentAnomaly = null;
    this.anomalyHistory = [];
    this.allAnomalies = this._registerAll();
  }

  _registerAll() {
    return [
      // Night 1-5: Simple visual changes
      this._movedChair(),
      this._flickeringLights(),
      this._tvOn(),
      this._pictureChanged(),
      this._deadPlant(),
      this._windowGone(),
      this._clockBackwards(),
      this._bloodStain(),

      // Night 6-10: Sound anomalies
      this._mirrorDelay(),
      this._strangeWhisper(),
      this._doorCreak(),

      // Night 11-15: Moving objects
      this._floatingObject(),
      this._movedToy(),
      this._swingingLamp(),
      this._extraDoor(),

      // Night 16-20: Reality distortion
      this._wallsDarker(),
      this._longerCorridor(),
      this._shadowStanding(),
      this._missingFurniture(),
      this._furnitureDuplicated(),

      // Night 21+: Combinations
      this._outsideWorldChange(),
      this._impossibleRoom(),
    ];
  }

  // Select anomaly for a given night
  selectAnomaly(nightNumber) {
    const available = this.allAnomalies.filter(a => {
      const min = a.minNight || 1;
      const max = a.maxNight || 99;
      return nightNumber >= min && nightNumber <= max;
    });

    // Filter out recently used anomalies
    const recent = this.anomalyHistory.slice(-3);
    const filtered = available.filter(a => !recent.includes(a.id));

    const pool = filtered.length > 0 ? filtered : available;
    const anomaly = pool[Math.floor(Math.random() * pool.length)];

    // Higher nights may combine 2 anomalies
    if (nightNumber >= 21 && Math.random() < 0.3) {
      const second = pool.filter(a => a.id !== anomaly.id);
      if (second.length > 0) {
        const a2 = second[Math.floor(Math.random() * second.length)];
        return [anomaly, a2];
      }
    }

    return anomaly;
  }

  applyAnomaly(anomaly) {
    if (Array.isArray(anomaly)) {
      anomaly.forEach(a => {
        a.apply(this.level);
        this.anomalyHistory.push(a.id);
      });
      this.currentAnomaly = anomaly;
      return anomaly.map(a => a.id);
    }
    anomaly.apply(this.level);
    this.anomalyHistory.push(anomaly.id);
    this.currentAnomaly = anomaly;
    return anomaly.id;
  }

  revertAnomaly() {
    if (Array.isArray(this.currentAnomaly)) {
      this.currentAnomaly.forEach(a => {
        if (a.revert) a.revert(this.level);
      });
    } else if (this.currentAnomaly && this.currentAnomaly.revert) {
      this.currentAnomaly.revert(this.level);
    }
    this.currentAnomaly = null;
  }

  verifyCorrect() {
    return this.currentAnomaly !== null;
  }

  // ----- ANOMALY DEFINITIONS -----

  _createAnomaly(id, minNight, maxNight, apply, revert, desc) {
    return { id, minNight, maxNight, apply, revert, description: desc };
  }

  _movedChair() {
    return this._createAnomaly('moved_chair', 1, 5, (level) => {
      const chair = level.objects.chair;
      if (chair) chair.position.x += 0.5;
    }, (level) => {
      const chair = level.objects.chair;
      if (chair) chair.position.x -= 0.5;
    }, 'Chair has moved');
  }

  _flickeringLights() {
    return this._createAnomaly('flickering', 1, 5, (level) => {
      level.anomalyState.flickering = true;
      level.anomalyState.flickerTimer = 0;
    }, (level) => {
      level.anomalyState.flickering = false;
    }, 'Lights flickering');
  }

  _tvOn() {
    return this._createAnomaly('tv_on', 1, 5, (level) => {
      const tv = level.objects.tv;
      if (tv) {
        tv.material.emissive = new THREE.Color(0x4488ff);
        tv.material.emissiveIntensity = 0.3;
        level.anomalyState.tvOn = true;
      }
    }, (level) => {
      const tv = level.objects.tv;
      if (tv) {
        tv.material.emissive = new THREE.Color(0x000000);
        tv.material.emissiveIntensity = 0;
        level.anomalyState.tvOn = false;
      }
    }, 'TV turned on');
  }

  _pictureChanged() {
    return this._createAnomaly('picture_changed', 1, 5, (level) => {
      const pic = level.objects.picture;
      if (pic) {
        level.anomalyState.picColor = pic.material.color.getHex();
        pic.material.color.setHex(0x222222);
      }
    }, (level) => {
      const pic = level.objects.picture;
      if (pic && level.anomalyState.picColor) {
        pic.material.color.setHex(level.anomalyState.picColor);
      }
    }, 'Picture changed');
  }

  _deadPlant() {
    return this._createAnomaly('dead_plant', 1, 5, (level) => {
      const plant = level.objects.plant;
      if (plant) {
        level.anomalyState.plantColor = plant.material.color.getHex();
        plant.material.color.setHex(0x3a2a1a);
      }
    }, (level) => {
      const plant = level.objects.plant;
      if (plant && level.anomalyState.plantColor) {
        plant.material.color.setHex(level.anomalyState.plantColor);
      }
    }, 'Plant became dead');
  }

  _windowGone() {
    return this._createAnomaly('window_gone', 2, 8, (level) => {
      level.objects.window.forEach(w => { if (w) w.visible = false; });
    }, (level) => {
      level.objects.window.forEach(w => { if (w) w.visible = true; });
    }, 'Window disappeared');
  }

  _clockBackwards() {
    return this._createAnomaly('clock_backwards', 2, 8, (level) => {
      level.anomalyState.clockReverse = true;
    }, (level) => {
      level.anomalyState.clockReverse = false;
    }, 'Clock running backwards');
  }

  _bloodStain() {
    return this._createAnomaly('blood_stain', 3, 8, (level) => {
      if (level.anomalyState.bloodMesh) {
        level.anomalyState.bloodMesh.visible = true;
      }
    }, (level) => {
      if (level.anomalyState.bloodMesh) {
        level.anomalyState.bloodMesh.visible = false;
      }
    }, 'Blood-like stain appears');
  }

  _mirrorDelay() {
    return this._createAnomaly('mirror_delay', 6, 12, (level) => {
      level.anomalyState.mirrorDelay = true;
    }, (level) => {
      level.anomalyState.mirrorDelay = false;
    }, 'Mirror reflection delayed');
  }

  _strangeWhisper() {
    return this._createAnomaly('whisper', 6, 15, (level) => {
      if (this.audio) this.audio.playWhisper();
    }, null, 'Strange whisper');
  }

  _doorCreak() {
    return this._createAnomaly('door_creak', 6, 15, (level) => {
      if (this.audio) this.audio.playDoor();
    }, null, 'Door creak');
  }

  _floatingObject() {
    return this._createAnomaly('floating', 11, 20, (level) => {
      level.anomalyState.floatingObject = true;
      level.anomalyState.floatOffset = 0;
    }, (level) => {
      level.anomalyState.floatingObject = false;
    }, 'Object floating');
  }

  _movedToy() {
    return this._createAnomaly('moved_toy', 11, 20, (level) => {
      const toy = level.objects.toy;
      if (toy) {
        level.anomalyState.toyPos = toy.position.clone();
        toy.position.y += 0.3;
      }
    }, (level) => {
      const toy = level.objects.toy;
      if (toy && level.anomalyState.toyPos) {
        toy.position.copy(level.anomalyState.toyPos);
      }
    }, 'Toy changed position');
  }

  _swingingLamp() {
    return this._createAnomaly('swinging_lamp', 11, 20, (level) => {
      level.anomalyState.lampSwing = true;
    }, (level) => {
      level.anomalyState.lampSwing = false;
    }, 'Ceiling lamp swinging');
  }

  _extraDoor() {
    return this._createAnomaly('extra_door', 13, 20, (level) => {
      level.objects.extraDoor.forEach(d => { if (d) d.visible = true; });
    }, (level) => {
      level.objects.extraDoor.forEach(d => { if (d) d.visible = false; });
    }, 'Extra door appears');
  }

  _wallsDarker() {
    return this._createAnomaly('walls_darker', 16, 25, (level) => {
      level.anomalyState.darkWalls = 1;
    }, (level) => {
      level.anomalyState.darkWalls = 0;
    }, 'Walls become darker');
  }

  _longerCorridor() {
    return this._createAnomaly('longer_corridor', 16, 25, (level) => {
      level.anomalyState.corridorLong = true;
    }, (level) => {
      level.anomalyState.corridorLong = false;
    }, 'Corridor becomes longer');
  }

  _shadowStanding() {
    return this._createAnomaly('shadow', 16, 25, (level) => {
      level.objects.shadowFigure.forEach(s => { if (s) s.visible = true; });
    }, (level) => {
      level.objects.shadowFigure.forEach(s => { if (s) s.visible = false; });
    }, 'Shadow standing still');
  }

  _missingFurniture() {
    return this._createAnomaly('missing_furniture', 16, 30, (level) => {
      const table = level.objects.table;
      if (table) {
        level.anomalyState.tablePos = table.position.clone();
        table.position.y = -10;
      }
    }, (level) => {
      const table = level.objects.table;
      if (table && level.anomalyState.tablePos) {
        table.position.copy(level.anomalyState.tablePos);
      }
    }, 'Furniture missing');
  }

  _furnitureDuplicated() {
    return this._createAnomaly('duplicated', 18, 30, (level) => {
      level.anomalyState.duplicateVisible = true;
    }, (level) => {
      level.anomalyState.duplicateVisible = false;
    }, 'Furniture duplicated');
  }

  _outsideWorldChange() {
    return this._createAnomaly('outside_changed', 21, 99, (level) => {
      level.anomalyState.outsideChanged = true;
    }, (level) => {
      level.anomalyState.outsideChanged = false;
    }, 'Outside world changed');
  }

  _impossibleRoom() {
    return this._createAnomaly('impossible_room', 25, 99, (level) => {
      level.anomalyState.impossibleRoom = true;
      level.anomalyState.gravityShift = 0;
    }, (level) => {
      level.anomalyState.impossibleRoom = false;
      level.anomalyState.gravityShift = 0;
    }, 'Impossible room');
  }
}
