'use strict';

/**
 * World — owns the Babylon engine, scene, global lighting and shared materials.
 * Call `world.start(loopFn)` to begin the render loop.
 */
class World {
  constructor(canvas) {
    this.canvas = canvas;
    this.engine = new BABYLON.Engine(canvas, true);
    this.scene  = this._initScene();
    this.mats   = this._initMaterials();
    window.addEventListener('resize', () => this.engine.resize());
  }

  // ── Public ────────────────────────────────────────────────────────────────

  /** Begin the render loop with the provided callback. */
  start(loopFn) {
    this.engine.runRenderLoop(loopFn);
  }

  // ── Private ───────────────────────────────────────────────────────────────

  _initScene() {
    const scene = new BABYLON.Scene(this.engine);

    // Sky & fog — colour must be identical so the horizon blends seamlessly
    scene.clearColor = new BABYLON.Color4(...WORLD.SKY, 1);
    scene.fogMode    = BABYLON.Scene.FOGMODE_EXP2;
    scene.fogDensity = WORLD.FOG_D;
    scene.fogColor   = new BABYLON.Color3(...WORLD.SKY);

    // Hemisphere (ambient fill)
    const hemi = new BABYLON.HemisphericLight('hemi', new BABYLON.Vector3(0, 1, 0), scene);
    hemi.intensity   = 0.72;
    hemi.diffuse     = new BABYLON.Color3(1.00, 0.95, 0.85);
    hemi.groundColor = new BABYLON.Color3(0.18, 0.32, 0.52);
    hemi.specular    = BABYLON.Color3.Black();

    // Directional sun
    const sun = new BABYLON.DirectionalLight(
      'sun', new BABYLON.Vector3(-1, -2, -0.6).normalize(), scene);
    sun.intensity = 0.55;
    sun.diffuse   = new BABYLON.Color3(1.0, 0.90, 0.70);

    return scene;
  }

  _initMaterials() {
    const scene = this.scene;

    /** Helper — standard flat material, no specular unless provided. */
    const std = (name, r, g, b, sr, sg, sb) => {
      const m = new BABYLON.StandardMaterial(name, scene);
      m.diffuseColor  = new BABYLON.Color3(r, g, b);
      m.specularColor = (sr != null)
        ? new BABYLON.Color3(sr, sg, sb)
        : BABYLON.Color3.Black();
      return m;
    };

    const water = std('water', 0.04, 0.34, 0.74, 0.35, 0.48, 0.70);
    water.alpha = 0.86;

    const cloud = std('cloud', 0.97, 0.97, 1.00);
    cloud.emissiveColor = new BABYLON.Color3(0.82, 0.86, 0.90);

    return {
      water,
      cloud,
      floor: std('floor', 0.08, 0.16, 0.36),
      sand:  std('sand',  0.84, 0.72, 0.46),
      grass: std('grass', 0.20, 0.60, 0.16),
      rock:  std('rock',  0.46, 0.42, 0.36),
      snow:  std('snow',  0.90, 0.93, 0.98),
    };
  }
}
