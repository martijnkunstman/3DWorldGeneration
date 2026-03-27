'use strict';

/**
 * Terrain — procedurally generates a blocky cave world.
 *
 * The cave is a 40×40 grid of 5-unit blocks.
 * Floor columns rise from y=0; ceiling columns hang from y=WH.
 * Both are quantised to block steps, giving a Minecraft-style look.
 *
 * Public API used by Player, DroneAI and Minimap:
 *   floorAt(wx, wz)  → top of floor surface at that world position
 *   ceilAt(wx, wz)   → bottom of ceiling surface at that world position
 */
class Terrain {
  constructor(scene, mats) {
    this.scene = scene;
    this.mats  = mats;
    this._G    = WORLD.CAVE_G;   // 40
    this._BS   = WORLD.CAVE_BS;  // 5

    // Two independent noise fields (different seeds)
    this._floorH = this._genHeights(17);   // floor top heights (y=0..MAX)
    this._ceilD  = this._genHeights(53);   // ceiling drop amounts (0..MAX from WH)

    this._offsets = Terrain._buildOffsets(3); // 7×7 ghost grid
    this._buildMeshes();
  }

  // ── Public ─────────────────────────────────────────────────────────────────

  /** Y coordinate of the top of the floor at world position (wx, wz). */
  floorAt(wx, wz) {
    return this._floorH[this._idx(wx, wz)];
  }

  /** Y coordinate of the bottom of the ceiling at world position (wx, wz). */
  ceilAt(wx, wz) {
    return WORLD.WH - this._ceilD[this._idx(wx, wz)];
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _idx(wx, wz) {
    const G  = this._G;
    const BS = this._BS;
    const gx = ((Math.floor((wx + WORLD.WW / 2) / BS) % G) + G) % G;
    const gz = ((Math.floor((wz + WORLD.WD / 2) / BS) % G) + G) % G;
    return gx * G + gz;
  }

  /**
   * Tileable layered-sine noise.
   * Using frequencies that are integer multiples of 2π/G guarantees
   * the field tiles seamlessly at the world boundary.
   */
  _noise(gx, gz, seed) {
    const f = Math.PI * 2 / this._G;
    const p = seed * 2.718281828;
    return (
      Math.sin(gx * f * 2 + p * 1.70) * Math.cos(gz * f * 3 + p * 0.90) * 0.40 +
      Math.sin(gx * f * 5 + p * 2.30) * Math.cos(gz * f * 4 + p * 1.40) * 0.28 +
      Math.sin(gx * f * 8 + p * 0.60) * Math.cos(gz * f * 7 + p * 2.10) * 0.18 +
      Math.cos(gx * f * 3 + p * 1.20) * Math.sin(gz * f * 6 + p * 3.10) * 0.14
    );
  }

  /** Generates a flat Float32Array of quantised block heights. */
  _genHeights(seed) {
    const G   = this._G;
    const BS  = this._BS;
    const MAX = 7; // max blocks high (= 35 world units)
    const h   = new Float32Array(G * G);
    for (let gx = 0; gx < G; gx++) {
      for (let gz = 0; gz < G; gz++) {
        const n = this._noise(gx, gz, seed) * 0.5 + 0.5; // [0, 1]
        h[gx * G + gz] = (1 + Math.round(n * (MAX - 1))) * BS; // 1..MAX blocks, always ≥1
      }
    }
    return h;
  }

  static _buildOffsets(radius) {
    const offsets = [];
    for (let dx = -radius; dx <= radius; dx++)
      for (let dz = -radius; dz <= radius; dz++)
        if (dx !== 0 || dz !== 0)
          offsets.push([dx * WORLD.WW, dz * WORLD.WD]);
    return offsets;
  }

  _buildMeshes() {
    this._buildLayer(this._floorH, false, this.mats.floor);
    this._buildLayer(this._ceilD,  true,  this.mats.ceil);
  }

  /**
   * Builds one merged block mesh for either the floor or ceiling.
   * @param {Float32Array} heights  - per-cell height values
   * @param {boolean}      isCeil   - if true, columns hang from y=WH downward
   * @param mat                     - Babylon material
   */
  _buildLayer(heights, isCeil, mat) {
    const G    = this._G;
    const BS   = this._BS;
    const scene = this.scene;
    const boxes = [];

    for (let gx = 0; gx < G; gx++) {
      for (let gz = 0; gz < G; gz++) {
        const h = heights[gx * G + gz];
        const cx = (gx - G / 2) * BS + BS / 2;
        const cz = (gz - G / 2) * BS + BS / 2;
        const cy = isCeil ? WORLD.WH - h / 2 : h / 2;

        const box = BABYLON.MeshBuilder.CreateBox('b', {
          width: BS, height: h, depth: BS,
        }, scene);
        box.position.set(cx, cy, cz);
        boxes.push(box);
      }
    }

    const merged = BABYLON.Mesh.MergeMeshes(boxes, true, true);
    merged.convertToFlatShadedMesh();
    merged.material = mat;

    // 3×3 ghost instances — merged mesh origin is already world centre
    for (const [ox, oz] of this._offsets) {
      const inst = merged.createInstance('ti');
      inst.position.set(ox, 0, oz);
    }
  }
}
