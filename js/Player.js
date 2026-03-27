'use strict';

/**
 * Player — manages both cameras (preview arc-rotate and first-person fly),
 * keyboard/mouse input, toroidal movement and cave floor/ceiling collision.
 */
class Player {
  /**
   * @param {BABYLON.Scene} scene
   * @param {HTMLCanvasElement} canvas
   * @param {Terrain} terrain
   */
  constructor(scene, canvas, terrain) {
    this.scene   = scene;
    this.canvas  = canvas;
    this.terrain = terrain;

    this.flyMode = false;
    this.flyY    = WORLD.WH * 0.5;
    this.flyYaw  = 0;

    this._keys      = {};
    this._mouseDX   = 0;
    this._mouseLook = false;

    this._arcCam = this._createArcCam();
    this._flyCam = this._createFlyCam();

    scene.activeCamera = this._arcCam;
    this._bindInput();
  }

  // ── Public ────────────────────────────────────────────────────────────────

  update(dt) {
    if (!this.flyMode) {
      this._arcCam.alpha += dt * 0.26;
      return;
    }
    this._updateFly(dt);
  }

  toggleMode() {
    this.flyMode = !this.flyMode;

    document.getElementById('modeLabel').textContent = this.flyMode ? 'FLY' : 'PREVIEW';
    document.getElementById('hud').innerHTML = this.flyMode
      ? '↑↓ Move &nbsp; ←→ Turn &nbsp; W/S Height &nbsp; Click → mouse look &nbsp; SPACE: preview'
      : 'SPACE: Fly mode &nbsp;|&nbsp; Mouse drag: orbit &nbsp;|&nbsp; Scroll: zoom';

    if (this.flyMode) {
      this._arcCam.detachControl();
      this.scene.activeCamera = this._flyCam;
    } else {
      if (document.pointerLockElement) document.exitPointerLock();
      this._mouseLook = false;
      this.scene.activeCamera = this._arcCam;
      this._arcCam.attachControl(this.canvas, false);
    }
  }

  get position() { return this._flyCam.position; }

  // ── Private ───────────────────────────────────────────────────────────────

  _createArcCam() {
    // Place the preview cam inside the cave at mid-height
    const cam = new BABYLON.ArcRotateCamera(
      'arc', -Math.PI / 2, Math.PI / 3.5, WORLD.WW * 0.35,
      new BABYLON.Vector3(0, WORLD.WH * 0.5, 0), this.scene
    );
    cam.lowerRadiusLimit = WORLD.WW * 0.05;
    cam.upperRadiusLimit = WORLD.WW * 0.9;
    cam.minZ = 0.5;
    cam.maxZ = WORLD.WW * 7;
    cam.attachControl(this.canvas, false);
    return cam;
  }

  _createFlyCam() {
    const cam = new BABYLON.FreeCamera(
      'fly', new BABYLON.Vector3(10, this.flyY, 10), this.scene);
    cam.minZ = 0.5;
    cam.maxZ = WORLD.WW * 7;
    cam.setTarget(new BABYLON.Vector3(30, this.flyY, 10));
    return cam;
  }

  _bindInput() {
    const CONSUME = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyW','KeyS'];

    window.addEventListener('keydown', e => {
      this._keys[e.code] = true;
      if (e.code === 'Space') this.toggleMode();
      if (CONSUME.includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', e => { this._keys[e.code] = false; });

    window.addEventListener('mousemove', e => {
      if (this.flyMode && this._mouseLook)
        this._mouseDX += e.movementX * 0.0025;
    });

    this.canvas.addEventListener('click', () => {
      if (!this.flyMode) return;
      (this.canvas.requestPointerLock
        ? this.canvas.requestPointerLock().then(() => { this._mouseLook = true; }).catch(() => {})
        : (this._mouseLook = true));
    });

    document.addEventListener('pointerlockchange', () => {
      this._mouseLook = document.pointerLockElement === this.canvas;
    });
  }

  _updateFly(dt) {
    const SPEED  = 36;
    const TURN   = 2.0;
    const VSPEED = 20;
    const k = this._keys;

    // ── Height (W = up, S = down) ──────────────────────────────────────────
    if (k['KeyW']) this.flyY = Math.min(WORLD.FLY_MAX, this.flyY + VSPEED * dt);
    if (k['KeyS']) this.flyY = Math.max(WORLD.FLY_MIN, this.flyY - VSPEED * dt);

    // ── Yaw (arrow keys + mouse) ──────────────────────────────────────────
    if (k['ArrowLeft'])  this.flyYaw -= TURN * dt;
    if (k['ArrowRight']) this.flyYaw += TURN * dt;
    this.flyYaw   += this._mouseDX;
    this._mouseDX  = 0;

    // ── Horizontal movement ───────────────────────────────────────────────
    const sinY = Math.sin(this.flyYaw);
    const cosY = Math.cos(this.flyYaw);
    let nx = this._flyCam.position.x;
    let nz = this._flyCam.position.z;
    if (k['ArrowUp'])   { nx += sinY * SPEED * dt; nz += cosY * SPEED * dt; }
    if (k['ArrowDown']) { nx -= sinY * SPEED * dt; nz -= cosY * SPEED * dt; }

    this._flyCam.position.x = nx;
    this._flyCam.position.z = nz;

    // ── Cave collision — clamp altitude between floor and ceiling ─────────
    const floorY = this.terrain.floorAt(nx, nz);
    const ceilY  = this.terrain.ceilAt(nx, nz);
    const margin = 2.5;
    this.flyY = Math.max(floorY + margin, Math.min(ceilY - margin, this.flyY));

    this._flyCam.position.y = this.flyY;

    // ── Toroidal wrap ─────────────────────────────────────────────────────
    this._flyCam.position.x = wrapHalf(this._flyCam.position.x, WORLD.WW);
    this._flyCam.position.z = wrapHalf(this._flyCam.position.z, WORLD.WD);

    // ── Camera look direction ─────────────────────────────────────────────
    this._flyCam.setTarget(new BABYLON.Vector3(
      this._flyCam.position.x + sinY * 20,
      this.flyY,
      this._flyCam.position.z + cosY * 20
    ));
  }
}
