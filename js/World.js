'use strict';

/**
 * World — owns the Babylon engine, scene, cave lighting and shared materials.
 */
class World {
  constructor(canvas) {
    this.canvas = canvas;
    this.engine = new BABYLON.Engine(canvas, true);
    this.scene  = this._initScene();
    this.mats   = this._initMaterials();
    window.addEventListener('resize', () => this.engine.resize());
  }

  start(loopFn) {
    this.engine.runRenderLoop(loopFn);
  }

  _initScene() {
    const scene = new BABYLON.Scene(this.engine);

    scene.clearColor = new BABYLON.Color4(...WORLD.SKY, 1);
    scene.fogMode    = BABYLON.Scene.FOGMODE_EXP2;
    scene.fogDensity = WORLD.FOG_D;
    scene.fogColor   = new BABYLON.Color3(...WORLD.SKY);

    // Dim hemisphere — cave has almost no sky light
    const hemi = new BABYLON.HemisphericLight('hemi', new BABYLON.Vector3(0, 1, 0), scene);
    hemi.intensity   = 0.55;
    hemi.diffuse     = new BABYLON.Color3(0.90, 0.80, 0.65);  // warm torch-like
    hemi.groundColor = new BABYLON.Color3(0.08, 0.10, 0.18);  // cold shadow fill
    hemi.specular    = BABYLON.Color3.Black();

    // Weak directional light (simulates a distant ambient source)
    const sun = new BABYLON.DirectionalLight(
      'sun', new BABYLON.Vector3(-1, -1.5, -0.5).normalize(), scene);
    sun.intensity = 0.30;
    sun.diffuse   = new BABYLON.Color3(0.70, 0.60, 0.50);

    return scene;
  }

  _initMaterials() {
    const scene = this.scene;
    const std = (name, r, g, b) => {
      const m = new BABYLON.StandardMaterial(name, scene);
      m.diffuseColor  = new BABYLON.Color3(r, g, b);
      m.specularColor = BABYLON.Color3.Black();
      return m;
    };

    return {
      floor: std('floor', 0.42, 0.36, 0.28),  // warm sandstone rock
      ceil:  std('ceil',  0.24, 0.22, 0.30),  // cool dark stone
    };
  }
}
