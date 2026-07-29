import * as THREE from 'three';

export class Player {
  constructor(camera, scene, audioManager) {
    this.camera = camera;
    this.scene = scene;
    this.audio = audioManager;

    this.moveSpeed = 3.5;
    this.sprintMultiplier = 1.8;
    this.isSprinting = false;
    this.sprintStamina = 1;
    this.velocity = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this._forward = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._moveVec = new THREE.Vector3();
    this._newPos = new THREE.Vector3();
    this._tryPos = new THREE.Vector3();

    this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this.camera.rotation.copy(this.euler);
    this.sensitivity = 1;

    this.height = 1.6;
    this.walkTimer = 0;
    this.walkCycle = 0;
    this.bobAmount = 0.03;
    this.bobSpeed = 8;
    this.headBob = 0;

    this.flashlight = this._createFlashlight();
    this.flashlightOn = true;

    this.keys = { w: false, a: false, s: false, d: false, shift: false };

    this._onKeyDown = (e) => this._handleKeyDown(e);
    this._onKeyUp = (e) => this._handleKeyUp(e);
    this._onMouseMove = (e) => this._handleMouseMove(e);

    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);
    document.addEventListener('mousemove', this._onMouseMove);

    this.camera.position.set(0, this.height, 0);
  }

  _createFlashlight() {
    const light = new THREE.SpotLight(0xffeedd, 1.5);
    light.angle = 0.4;
    light.penumbra = 0.5;
    light.decay = 1.5;
    light.distance = 20;
    light.target.position.set(0, -1, -5);
    light.add(light.target);
    light.position.set(0, -0.1, -0.3);
    this.camera.add(light);
    this.scene.add(light);

    const coneGeo = new THREE.ConeGeometry(1.5, 4, 16);
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xffeecc,
      transparent: true,
      opacity: 0.03,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this._flashlightCone = new THREE.Mesh(coneGeo, coneMat);
    this._flashlightCone.rotation.x = Math.PI / 2;
    this._flashlightCone.position.set(0, -0.3, -2.5);
    this.camera.add(this._flashlightCone);

    return light;
  }

  toggleFlashlight() {
    if (!this.flashlight) return;
    this.flashlightOn = !this.flashlightOn;
    this.flashlight.intensity = this.flashlightOn ? 1.5 : 0;
    if (this._flashlightCone) {
      this._flashlightCone.material.opacity = this.flashlightOn ? 0.03 : 0;
    }
  }

  _handleKeyDown(e) {
    switch (e.code) {
      case 'KeyW': this.keys.w = true; break;
      case 'KeyA': this.keys.a = true; break;
      case 'KeyS': this.keys.s = true; break;
      case 'KeyD': this.keys.d = true; break;
      case 'ShiftLeft': case 'ShiftRight': this.keys.shift = true; break;
      case 'KeyF': this.toggleFlashlight(); break;
    }
  }

  _handleKeyUp(e) {
    switch (e.code) {
      case 'KeyW': this.keys.w = false; break;
      case 'KeyA': this.keys.a = false; break;
      case 'KeyS': this.keys.s = false; break;
      case 'KeyD': this.keys.d = false; break;
      case 'ShiftLeft': case 'ShiftRight': this.keys.shift = false; break;
    }
  }

  _handleMouseMove(e) {
    if (document.pointerLockElement === null) return;
    this.euler.setFromQuaternion(this.camera.quaternion);
    this.euler.y -= e.movementX * 0.002 * this.sensitivity;
    this.euler.x -= e.movementY * 0.002 * this.sensitivity;
    this.euler.x = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, this.euler.x));
    this.camera.quaternion.setFromEuler(this.euler);
  }

  setSensitivity(val) { this.sensitivity = val; }

  update(delta, walls) {
    this.isSprinting = this.keys.shift && this.sprintStamina > 0;
    const speed = this.moveSpeed * (this.isSprinting ? this.sprintMultiplier : 1);

    if (this.isSprinting) {
      this.sprintStamina = Math.max(0, this.sprintStamina - delta * 0.3);
    } else {
      this.sprintStamina = Math.min(1, this.sprintStamina + delta * 0.15);
    }

    this.direction.set(0, 0, 0);
    if (this.keys.w) this.direction.z -= 1;
    if (this.keys.s) this.direction.z += 1;
    if (this.keys.a) this.direction.x -= 1;
    if (this.keys.d) this.direction.x += 1;

    if (this.direction.lengthSq() > 0) {
      this.direction.normalize();
      this._forward.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
      this._forward.y = 0;
      if (this._forward.lengthSq() > 0.001) this._forward.normalize();
      this._right.set(1, 0, 0).applyQuaternion(this.camera.quaternion);
      this._right.y = 0;
      if (this._right.lengthSq() > 0.001) this._right.normalize();

      this._moveVec.set(0, 0, 0)
        .addScaledVector(this._forward, -this.direction.z)
        .addScaledVector(this._right, this.direction.x);

      if (this._moveVec.lengthSq() > 0) {
        this._moveVec.normalize();
        const moveX = this._moveVec.x * speed * delta;
        const moveZ = this._moveVec.z * speed * delta;

        this._newPos.copy(this.camera.position);
        this._newPos.x += moveX;
        this._newPos.z += moveZ;

        if (!this._checkCollisionAny(this._newPos, walls)) {
          this.camera.position.copy(this._newPos);
        } else {
          this._tryPos.copy(this.camera.position);
          this._tryPos.x += moveX;
          if (!this._checkCollisionAny(this._tryPos, walls)) {
            this.camera.position.x = this._tryPos.x;
          }
          this._tryPos.copy(this.camera.position);
          this._tryPos.z += moveZ;
          if (!this._checkCollisionAny(this._tryPos, walls)) {
            this.camera.position.z = this._tryPos.z;
          }
        }

        this.walkTimer += delta * this.bobSpeed * (this.isSprinting ? 1.5 : 1);
        this.headBob = Math.sin(this.walkTimer) * this.bobAmount * (this.isSprinting ? 1.8 : 1);
        this.camera.position.y = this.height + this.headBob;

        if (this.audio) {
          this.walkCycle += delta * (this.isSprinting ? 5 : 3.5);
          if (this.walkCycle > 1) {
            this.walkCycle = 0;
            this.audio.playFootstep(this.isSprinting);
          }
        }
      }
    } else {
      this.headBob *= 0.9;
      this.camera.position.y += (this.height - this.camera.position.y) * 0.1;
    }

    if (this.flashlight) {
      this.flashlight.position.y = -0.1 + this.headBob * 0.3;
    }

    if (this.audio) {
      this.audio.isWalking = this.keys.w || this.keys.s || this.keys.a || this.keys.d;
      this.audio.isSprinting = this.isSprinting;
    }
  }

  _checkCollisionAny(pos, walls) {
    for (let i = 0, len = walls.length; i < len; i++) {
      if (this._aabbOverlap(pos, walls[i])) return true;
    }
    return false;
  }

  _aabbOverlap(pos, wall) {
    const margin = 0.3;
    const halfW = (wall.geometry.parameters.width || 1) / 2;
    const halfD = (wall.geometry.parameters.depth || 1) / 2;
    const halfH = (wall.geometry.parameters.height || 2.5) / 2;

    const minX = wall.position.x - halfW - margin;
    const maxX = wall.position.x + halfW + margin;
    const minZ = wall.position.z - halfD - margin;
    const maxZ = wall.position.z + halfD + margin;
    const minY = wall.position.y - halfH;
    const maxY = wall.position.y + halfH;

    return (
      pos.x >= minX && pos.x <= maxX &&
      pos.z >= minZ && pos.z <= maxZ &&
      pos.y >= minY && pos.y <= maxY
    );
  }

  get position() { return this.camera.position; }
  get quaternion() { return this.camera.quaternion; }
}
