import * as THREE from 'three';

/**
 * Builds the apartment level procedurally.
 * Rooms: bedroom, hallway, bathroom, kitchen, living room, entrance.
 */
export class Level {
  constructor(scene, audioManager) {
    this.scene = scene;
    this.audio = audioManager;
    this.objects = {};
    this.wallMeshes = [];
    this.anomalyState = {};
  }

  build() {
    this._createFloor();
    this._createWalls();
    this._createCeiling();
    this._createFurniture();
    this._createLighting();
    this._createWindows();
    this._createOutside();
    this._createBloodMesh();
    this._createExtraDoor();
    this._createShadowFigure();
    this._createDuplicateFurniture();
  }

  getWalls() {
    return this.wallMeshes;
  }

  // ---- ROOM LAYOUT ----
  // All coordinates are in meters. Y is up.
  // Rooms arranged around a central hallway.

  _addWall(x, z, w, h, d, color, rotationY) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshStandardMaterial({
      color: color || 0xcccccc,
      roughness: 0.9,
      metalness: 0,
      transparent: true,
      opacity: 1,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, h / 2, z);
    if (rotationY) mesh.rotation.y = rotationY;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.wallMeshes.push(mesh);
    return mesh;
  }

  _addFloorTile(x, z, w, d, color) {
    const geo = new THREE.BoxGeometry(w, 0.1, d);
    const mat = new THREE.MeshStandardMaterial({
      color: color || 0x8a7a6a,
      roughness: 0.8,
      metalness: 0.1,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 0, z);
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    return mesh;
  }

  _addCeilingTile(x, z, w, d, color) {
    const geo = new THREE.BoxGeometry(w, 0.05, d);
    const mat = new THREE.MeshStandardMaterial({
      color: color || 0xe8e0d0,
      roughness: 0.9,
      metalness: 0,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 2.6, z);
    this.scene.add(mesh);
    return mesh;
  }

  _createFloor() {
    // Hallway
    this._addFloorTile(0, 0, 2.4, 6, 0x7a6a5a);
    // Living room (right)
    this._addFloorTile(2.6, -2, 4, 5, 0x8a7a6a);
    // Kitchen (left front)
    this._addFloorTile(-2.6, -2, 3.5, 4, 0x7a7a6a);
    // Bedroom (left back)
    this._addFloorTile(-2.6, 3, 3.5, 4, 0x8a7a7a);
    // Bathroom (back)
    this._addFloorTile(0, 5, 2.4, 3, 0x9a8a8a);
    // Entrance (front)
    this._addFloorTile(0, -4.5, 2.4, 2, 0x6a5a4a);
  }

  _createCeiling() {
    this._addCeilingTile(0, 0, 10, 10);
  }

  _createWalls() {
    const wh = 2.5; // wall height
    const wt = 0.1; // wall thickness

    // Outer walls
    // Front wall (z = -5.5)
    this._addWall(0, -5.5, 10, wh, wt, 0xc0c0c0);
    // Back wall (z = 6.5)
    this._addWall(0, 6.5, 10, wh, wt, 0xc0c0c0);
    // Left wall (x = -5)
    this._addWall(-5, 0.5, wt, wh, 12, 0xc0c0c0);
    // Right wall (x = 5)
    this._addWall(5, 0.5, wt, wh, 12, 0xc0c0c0);

    // Interior walls
    // Hallway left wall
    this._addWall(-1.2, 0, wt, wh, 12, 0xb8b8b8);
    // Hallway right wall
    this._addWall(1.2, 0, wt, wh, 12, 0xb8b8b8);
    // Living room back wall
    this._addWall(3.5, -4.5, 3, wh, wt, 0xb0b0b0);
    // Kitchen-bedroom divider
    this._addWall(0, 1, 2.4, wh, wt, 0xb0b0b0);
    // Bathroom wall
    this._addWall(0, 4, 2.4, wh, wt, 0xb0b0b0);

    // Door openings (boxes removed from wall positions)
    // We'll use invisible trigger zones instead

    // Entrance door frame
    this._addWall(0, -4.7, 1, wh, wt, 0x8B4513);
  }

  _createFurniture() {
    // === TABLE (living room) ===
    const tableMat = new THREE.MeshStandardMaterial({ color: 0x5a3a2a, roughness: 0.7, metalness: 0.2 });
    const tableTop = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.8), tableMat);
    tableTop.position.set(3, 0.7, -2.5);
    tableTop.castShadow = true; tableTop.receiveShadow = true;
    this.scene.add(tableTop);
    this.objects.table = tableTop;

    // Table legs
    for (let x of [-0.5, 0.5]) {
      for (let z of [-0.35, 0.35]) {
        const leg = new THREE.Mesh(
          new THREE.CylinderGeometry(0.03, 0.03, 0.65),
          new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.8 })
        );
        leg.position.set(3 + x, 0.35, -2.5 + z);
        this.scene.add(leg);
      }
    }

    // === CHAIR ===
    const chairMat = new THREE.MeshStandardMaterial({ color: 0x6a4a3a, roughness: 0.8 });
    const chair = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), chairMat);
    chair.position.set(2.5, 0.25, -2.2);
    chair.castShadow = true;
    this.scene.add(chair);
    // Chair back
    const chairBack = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.5, 0.05), chairMat);
    chairBack.position.set(2.5, 0.65, -2.45);
    this.scene.add(chairBack);
    // Chair legs
    for (let x of [-0.15, 0.15]) {
      for (let z of [-0.15, 0.15]) {
        const leg = new THREE.Mesh(
          new THREE.CylinderGeometry(0.02, 0.02, 0.4),
          new THREE.MeshStandardMaterial({ color: 0x3a2a1a })
        );
        leg.position.set(2.5 + x, 0.2, -2.2 + z);
        this.scene.add(leg);
      }
    }
    this.objects.chair = chair;

    // === TV ===
    const tvMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3, metalness: 0.5 });
    const tv = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.08), tvMat);
    tv.position.set(4.2, 0.8, -4);
    tv.castShadow = true;
    this.scene.add(tv);
    // TV screen (emissive)
    const screenMat = new THREE.MeshStandardMaterial({
      color: 0x000000,
      emissive: 0x000000,
      emissiveIntensity: 0,
      roughness: 0.2,
      metalness: 0.8,
    });
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.01), screenMat);
    screen.position.set(4.2, 0.8, -3.95);
    this.scene.add(screen);
    this.objects.tv = screen;

    // TV stand
    const stand = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.4, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 })
    );
    stand.position.set(4.2, 0.2, -4);
    this.scene.add(stand);

    // === PICTURE FRAME ===
    const picMat = new THREE.MeshStandardMaterial({ color: 0x6688aa, roughness: 0.4, metalness: 0.2 });
    const pic = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.03), picMat);
    pic.position.set(-0.5, 1.4, 6.45);
    this.scene.add(pic);
    // Frame
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x8B6914, roughness: 0.5, metalness: 0.3 });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.34, 0.02), frameMat);
    frame.position.set(-0.5, 1.4, 6.43);
    this.scene.add(frame);
    this.objects.picture = pic;

    // === PLANT ===
    const potMat = new THREE.MeshStandardMaterial({ color: 0x8a5a3a, roughness: 0.9 });
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.25), potMat);
    pot.position.set(3.5, 0.15, -3.5);
    this.scene.add(pot);
    const plantMat = new THREE.MeshStandardMaterial({ color: 0x4a8a3a, roughness: 0.8 });
    const plant = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), plantMat);
    plant.position.set(3.5, 0.4, -3.5);
    plant.scale.y = 1.5;
    this.scene.add(plant);
    this.objects.plant = plant;

    // === BED (bedroom) ===
    const bedMat = new THREE.MeshStandardMaterial({ color: 0x4a6a8a, roughness: 0.7 });
    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.3, 1.8), bedMat);
    bed.position.set(-2.5, 0.15, 4);
    bed.castShadow = true;
    this.scene.add(bed);
    // Pillow
    const pillowMat = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.9 });
    const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.4), pillowMat);
    pillow.position.set(-2.5, 0.4, 4.7);
    this.scene.add(pillow);

    // === CLOCK ===
    const clockMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.4, metalness: 0.6 });
    const clock = new THREE.Mesh(new THREE.CircleGeometry(0.12, 16), clockMat);
    clock.position.set(3, 1.6, 6.45);
    this.scene.add(clock);
    this.objects.clock = clock;

    // === TOY (kids room area) ===
    const toyMat = new THREE.MeshStandardMaterial({ color: 0xe74c3c, roughness: 0.7 });
    const toy = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.15), toyMat);
    toy.position.set(-3.5, 0.15, 3);
    this.scene.add(toy);
    this.objects.toy = toy;

    // === SOFA (living room) ===
    const sofaMat = new THREE.MeshStandardMaterial({ color: 0x4a5a6a, roughness: 0.8 });
    const sofa = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.8, 0.7), sofaMat);
    sofa.position.set(3.5, 0.4, -1);
    sofa.castShadow = true;
    this.scene.add(sofa);

    // === KITCHEN COUNTER ===
    const counterMat = new THREE.MeshStandardMaterial({ color: 0x6a7a5a, roughness: 0.7 });
    const counter = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.85, 0.6), counterMat);
    counter.position.set(-3.5, 0.45, -2);
    counter.castShadow = true;
    this.scene.add(counter);

    // === ENTRANCE DOOR ===
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x5a3a2a, roughness: 0.8 });
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.1, 0.05), doorMat);
    door.position.set(0, 1.05, -4.7);
    this.scene.add(door);
    this.objects.door = door;
  }

  _createLighting() {
    // Ambient light (dim for atmosphere)
    const ambient = new THREE.AmbientLight(0x222244, 0.4);
    this.scene.add(ambient);
    this.objects.ambientLight = ambient;

    // Main overhead light
    const mainLight = new THREE.DirectionalLight(0xffeedd, 0.6);
    mainLight.position.set(0, 3, 0);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 1024;
    mainLight.shadow.mapSize.height = 1024;
    this.scene.add(mainLight);
    this.objects.mainLight = mainLight;

    // Secondary fill light
    const fill = new THREE.DirectionalLight(0x8888ff, 0.2);
    fill.position.set(-2, 1, -3);
    this.scene.add(fill);

    // Point lights in rooms
    const roomLightConfigs = [
      { pos: [2.5, 2.2, -2.5], color: 0xffeedd },
      { pos: [-2.5, 2.2, 4], color: 0xffeedd },
      { pos: [0, 2.2, 5.5], color: 0xffeedd },
      { pos: [-3, 2.2, -2], color: 0xffeedd },
    ];

    const roomLightObjects = [];
    roomLightConfigs.forEach(r => {
      const light = new THREE.PointLight(r.color, 0.3, 5);
      light.position.set(r.pos[0], r.pos[1], r.pos[2]);
      light.castShadow = false;
      this.scene.add(light);
      roomLightObjects.push(light);
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.04, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffffee })
      );
      bulb.position.copy(light.position);
      this.scene.add(bulb);
    });

    this.objects.roomLights = roomLightObjects;
  }

  _createWindows() {
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x88ccff,
      transparent: true,
      opacity: 0.15,
      roughness: 0.1,
      metalness: 0,
      envMapIntensity: 0.5,
      side: THREE.DoubleSide,
    });

    const windowPositions = [
      { x: 5, z: -2, w: 1.5, h: 1 },   // living room right
      { x: 5, z: 0.5, w: 1.5, h: 1 },  // living room right
      { x: -5, z: 4, w: 1, h: 1 },      // bedroom left
    ];

    this.objects.window = [];

    windowPositions.forEach(w => {
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(w.w, w.h), glassMat);
      glass.position.set(w.x, 1.4, w.z);
      glass.rotation.y = w.x > 0 ? -Math.PI / 2 : Math.PI / 2;
      this.scene.add(glass);
      this.objects.window.push(glass);

      // Frame
      const frameMat = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.6 });
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(w.w + 0.1, 0.05, 0.05),
        frameMat
      );
      frame.position.set(w.x, 1.4 + w.h / 2 + 0.05, w.z);
      this.scene.add(frame);
    });
  }

  _createOutside() {
    // Simple skybox
    const skyMat = new THREE.MeshBasicMaterial({
      color: 0x0a0a1a,
      side: THREE.BackSide,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(50, 16, 16), skyMat);
    this.scene.add(sky);
    this.objects.sky = sky;

    // Rain particles (thin layer)
    const rainCount = 2000;
    const rainGeo = new THREE.BufferGeometry();
    const rainPos = new Float32Array(rainCount * 3);
    for (let i = 0; i < rainCount * 3; i++) {
      rainPos[i] = (Math.random() - 0.5) * 40;
      if (i % 3 === 1) rainPos[i] = Math.random() * 10; // y
    }
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
    const rainMat = new THREE.PointsMaterial({
      color: 0x446688,
      size: 0.03,
      transparent: true,
      opacity: 0.3,
    });
    const rain = new THREE.Points(rainGeo, rainMat);
    rain.position.set(0, 0, 0);
    this.scene.add(rain);
    this.objects.rain = rain;
  }

  _createBloodMesh() {
    const bloodMat = new THREE.MeshBasicMaterial({
      color: 0x440000,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
    });
    const blood = new THREE.Mesh(new THREE.CircleGeometry(0.15, 12), bloodMat);
    blood.rotation.x = -Math.PI / 2;
    blood.position.set(2.5, 0.01, -2.5);
    blood.visible = false;
    this.scene.add(blood);
    this.anomalyState.bloodMesh = blood;
  }

  _createExtraDoor() {
    const doorMat = new THREE.MeshStandardMaterial({
      color: 0x111122,
      roughness: 0.5,
      metalness: 0.3,
      transparent: true,
      opacity: 0.7,
    });
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2, 0.05), doorMat);
    door.position.set(4, 1, 6.45);
    door.visible = false;
    this.scene.add(door);
    this.objects.extraDoor = [door];

    // Glow around extra door
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x4444ff,
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide,
    });
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 2.2), glowMat);
    glow.position.set(4, 1, 6.44);
    glow.visible = false;
    this.scene.add(glow);
    this.objects.extraDoor.push(glow);
  }

  _createShadowFigure() {
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
    });
    const figure = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 1.6), shadowMat);
    figure.position.set(-3.5, 0.8, 6.44);
    figure.visible = false;
    this.scene.add(figure);
    this.objects.shadowFigure = [figure];
  }

  _createDuplicateFurniture() {
    const dupeMat = new THREE.MeshStandardMaterial({
      color: 0x444444,
      roughness: 0.6,
      transparent: true,
      opacity: 0.5,
    });
    const dupe = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.6), dupeMat);
    dupe.position.set(3.2, 0.4, -0.5);
    dupe.visible = false;
    this.scene.add(dupe);
    this.objects.duplicateFurniture = dupe;
  }

  // ---- ANOMALY UPDATES (called per frame when active) ----
  updateAnomalies(delta, time) {
    // Flickering lights
    if (this.anomalyState.flickering) {
      this.anomalyState.flickerTimer += delta;
      const flicker = Math.sin(this.anomalyState.flickerTimer * 30) > 0.7 ? 0.1 : 1;
      if (this.objects.mainLight) {
        this.objects.mainLight.intensity = 0.6 * flicker;
      }
    }

    // TV on
    if (this.anomalyState.tvOn) {
      const flicker = Math.sin(time * 50) * 0.5 + 0.5;
      if (this.objects.tv) {
        this.objects.tv.material.emissiveIntensity = 0.1 + flicker * 0.3;
      }
    }

    // Clock backwards
    if (this.anomalyState.clockReverse && this.objects.clock) {
      this.objects.clock.rotation.z += delta * 2;
    }

    // Floating object
    if (this.anomalyState.floatingObject) {
      this.anomalyState.floatOffset += delta;
      const obj = this.objects.toy;
      if (obj) {
        obj.position.y = 0.15 + Math.sin(this.anomalyState.floatOffset * 1.5) * 0.25;
        obj.rotation.x += delta * 0.5;
        obj.rotation.z += delta * 0.3;
      }
    }

    // Swinging lamp
    if (this.anomalyState.lampSwing) {
      const lights = this.objects.roomLights;
      if (lights && lights.length > 0) {
        const lampIndex = Math.floor(time / 5) % lights.length;
        const light = lights[lampIndex];
        light.position.x += Math.sin(time * 3) * delta * 0.3;
      }
    }

    // Longer corridor
    if (this.anomalyState.corridorLong) {
      // Simulate by changing wall positions slightly
      // (Simplified - just moves hallway walls)
    }

    // Darker walls
    if (this.anomalyState.darkWalls > 0) {
      const target = 0.3 + Math.sin(time * 0.5) * 0.1;
      this.wallMeshes.forEach(w => {
        if (w.material.color) {
          const c = w.material.color;
          c.r += (target - c.r) * 0.01;
          c.g += (target - c.g) * 0.01;
          c.b += (target - c.b) * 0.01;
        }
      });
    }

    // Outside changed
    if (this.anomalyState.outsideChanged) {
      if (this.objects.sky) {
        this.objects.sky.material.color.setHSL(0, 0, 0.01 + Math.sin(time * 0.1) * 0.01);
      }
    }

    // Impossible room
    if (this.anomalyState.impossibleRoom) {
      this.anomalyState.gravityShift += delta * 0.05;
      // Visual distortion: rotate walls slightly
      this.wallMeshes.forEach((w, i) => {
        if (i % 3 === 0) {
          w.rotation.z = Math.sin(time * 0.3 + i) * 0.02;
        }
      });
    }

    // Duplicate furniture
    if (this.anomalyState.duplicateVisible) {
      if (this.objects.duplicateFurniture) {
        this.objects.duplicateFurniture.visible = true;
      }
    } else {
      if (this.objects.duplicateFurniture) {
        this.objects.duplicateFurniture.visible = false;
      }
    }

    // Rain movement
    if (this.objects.rain) {
      const positions = this.objects.rain.geometry.attributes.position.array;
      for (let i = 1; i < positions.length; i += 3) {
        positions[i] -= delta * 2;
        if (positions[i] < -0.5) positions[i] = 9.5;
        positions[i - 1] += Math.sin(time + i) * delta * 0.1;
      }
      this.objects.rain.geometry.attributes.position.needsUpdate = true;
    }

    // Mirror delay (visual effect - slight camera distortion when looking at mirror position)
    // Handled via post-processing in GameManager
  }
}
