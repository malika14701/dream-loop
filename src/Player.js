import * as THREE from 'three';

export class Player {
  constructor(camera, scene, audioManager) {
    this.camera = camera;
    this.scene = scene;
    this.audio = audioManager;

    // Movement
    this.moveSpeed = 3.5;
    this.sprintMultiplier = 1.8;
    this.isSprinting = false;
    this.sprintStamina = 1;
    this.maxStamina = 1;
    this.velocity = new THREE.Vector3();
    this.direction = new THREE.Vector3();

    // Rotation
    this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this.camera.rotation.setFromEuler(this.euler);
    this.sensitivity = 1;

    // State
    this.height = 1.6;
    this.isGrounded = true;
    this.walkTimer = 0;
    this.walkCycle = 0;
    this.bobAmount = 0.03;
    this.bobSpeed = 8;
    this.headBob = 0;

    // Flashlight
    this.flashlight = this._createFlashlight();
    this.flashlightOn = true;

    // Keys
    this.keys = { w: false, a: false, s: false, d: false, shift: false };
    this._setupControls();

    // Position
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

    // Visual cone (subtle)
    const coneGeo = new THREE.ConeGeometry(1.5, 4, 16);
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xffeecc,
      transparent: true,
      opacity: 0.03,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.rotation.x = Math.PI / 2;
    cone.position.set(0, -0.3, -2.5);
    this.camera.add(cone);
    this._flashlightCone = cone;

    return light;
  }

  toggleFlashlight() {
    this.flashlightOn = !this.flashlightOn;
    this.flashlight.intensity = this.flashlightOn ? 1.5 : 0;
    if (this._flashlightCone) {
      this._flashlightCone.material.opacity = this.flashlightOn ? 0.03 : 0;
    }
  }

  _setupControls() {
    document.addEventListener('keydown', (e) => {
      switch (e.code) {
        case 'KeyW': this.keys.w = true; break;
        case 'KeyA': this.keys.a = true; break;
        case 'KeyS': this.keys.s = true; break;
        case 'KeyD': this.keys.d = true; break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.keys.shift = true;
          break;
        case 'KeyF': this.toggleFlashlight(); break;
        case 'Escape':
          // Handled by GameManager
          break;
      }
    });

    document.addEventListener('keyup', (e) => {
      switch (e.code) {
        case 'KeyW': this.keys.w = false; break;
        case 'KeyA': this.keys.a = false; break;
        case 'KeyS': this.keys.s = false; break;
        case 'KeyD': this.keys.d = false; break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.keys.shift = false;
          break;
      }
    });

    // Mouse look
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === null) return;
      this.euler.setFromQuaternion(this.camera.quaternion);
      this.euler.y -= e.movementX * 0.002 * this.sensitivity;
      this.euler.x -= e.movementY * 0.002 * this.sensitivity;
      this.euler.x = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, this.euler.x));
      this.camera.quaternion.setFromEuler(this.euler);
    });
  }

  setSensitivity(val) {
    this.sensitivity = val;
  }

  update(delta, walls) {
    // Sprint
    this.isSprinting = this.keys.shift && this.sprintStamina > 0;
    const speed = this.moveSpeed * (this.isSprinting ? this.sprintMultiplier : 1);

    if (this.isSprinting) {
      this.sprintStamina = Math.max(0, this.sprintStamina - delta * 0.3);
    } else {
      this.sprintStamina = Math.min(1, this.sprintStamina + delta * 0.15);
    }

    // Movement direction
    this.direction.set(0, 0, 0);
    if (this.keys.w) this.direction.z -= 1;
    if (this.keys.s) this.direction.z += 1;
    if (this.keys.a) this.direction.x -= 1;
    if (this.keys.d) this.direction.x += 1;

    if (this.direction.lengthSq() > 0) {
      this.direction.normalize();
      // Transform direction relative to camera
      const forward = new THREE.Vector3(0, 0, -1);
      forward.applyQuaternion(this.camera.quaternion);
      forward.y = 0;
      forward.normalize();

      const right = new THREE.Vector3(1, 0, 0);
      right.applyQuaternion(this.camera.quaternion);
      right.y = 0;
      right.normalize();

      const moveVec = new THREE.Vector3()
        .addScaledVector(forward, -this.direction.z)
        .addScaledVector(right, this.direction.x);

      if (moveVec.lengthSq() > 0) {
        moveVec.normalize();
        const newPos = this.camera.position.clone().add(moveVec.multiplyScalar(speed * delta));

        // Simple collision with walls
        let blocked = false;
        for (const wall of walls) {
          if (this._checkCollision(newPos, wall)) {
            blocked = true;
            break;
          }
        }

        if (!blocked) {
          this.camera.position.copy(newPos);
        } else {
          // Try sliding along X and Z separately
          const tryX = this.camera.position.clone();
          tryX.x += moveVec.x * speed * delta;
          let slideBlocked = false;
          for (const wall of walls) {
            if (this._checkCollision(tryX, wall)) { slideBlocked = true; break; }
          }
          if (!slideBlocked) this.camera.position.x = tryX.x;

          const tryZ = this.camera.position.clone();
          tryZ.z += moveVec.z * speed * delta;
          slideBlocked = false;
          for (const wall of walls) {
            if (this._checkCollision(tryZ, wall)) { slideBlocked = true; break; }
          }
          if (!slideBlocked) this.camera.position.z = tryZ.z;
        }

        // Head bob
        this.walkTimer += delta * this.bobSpeed * (this.isSprinting ? 1.5 : 1);
        this.headBob = Math.sin(this.walkTimer) * this.bobAmount * (this.isSprinting ? 1.8 : 1);
        this.camera.position.y = this.height + this.headBob;

        // Footsteps
        if (this.audio) {
          this.walkCycle += delta * (this.isSprinting ? 5 : 3.5);
          if (this.walkCycle > 1) {
            this.walkCycle = 0;
            this.audio.playFootstep(this.isSprinting);
          }
        }
      }
    } else {
      // Idle sway
      this.headBob *= 0.9;
      this.camera.position.y += (this.height - this.camera.position.y) * 0.1;
    }

    // Flashlight bobbing
    if (this.flashlight) {
      const bobOffset = this.headBob * 0.3;
      this.flashlight.position.y = -0.1 + bobOffset;
    }

    // Update walking state for audio
    if (this.audio) {
      this.audio.isWalking = this.keys.w || this.keys.s || this.keys.a || this.keys.d;
      this.audio.isSprinting = this.isSprinting;
    }
  }

  _checkCollision(pos, wall) {
    const margin = 0.3;
    const minX = wall.position.x - wall.geometry.parameters.width / 2 - margin;
    const maxX = wall.position.x + wall.geometry.parameters.width / 2 + margin;
    const minZ = wall.position.z - wall.geometry.parameters.depth / 2 - margin;
    const maxZ = wall.position.z + wall.geometry.parameters.depth / 2 + margin;

    return (
      pos.x >= minX && pos.x <= maxX &&
      pos.z >= minZ && pos.z <= maxZ &&
      pos.y >= wall.position.y - wall.geometry.parameters.height / 2 &&
      pos.y <= wall.position.y + wall.geometry.parameters.height / 2
    );
  }

  get position() {
    return this.camera.position;
  }

  get quaternion() {
    return this.camera.quaternion;
  }

  get direction() {
    const v = new THREE.Vector3(0, 0, -1);
    v.applyQuaternion(this.camera.quaternion);
    return v;
  }
}
