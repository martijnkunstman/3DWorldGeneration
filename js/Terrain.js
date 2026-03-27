'use strict';

// ── Static data ──────────────────────────────────────────────────────────────

const ISLAND_DEFS = [
  // Central cluster — small, varied
  { x:   0, z:   0, r:10, h:14, type:'grass' },
  { x:  18, z:  15, r: 6, h: 8, type:'grass' },
  { x: -16, z:  10, r: 5, h: 7, type:'rock'  },
  { x:  10, z: -20, r: 7, h: 9, type:'grass' },
  // Mid ring
  { x:  42, z:  22, r: 9, h:16, type:'grass' },
  { x: -38, z: -20, r: 8, h:14, type:'grass' },
  { x:  28, z: -42, r: 7, h:11, type:'rock'  },
  { x: -33, z:  40, r: 8, h:10, type:'grass' },
  { x:  52, z: -28, r: 6, h: 9, type:'rock'  },
  { x: -48, z:  14, r: 7, h:12, type:'grass' },
  { x:  14, z:  52, r: 5, h: 7, type:'snow'  },
  { x: -60, z: -42, r: 6, h: 8, type:'rock'  },
  { x:  35, z:  58, r: 7, h:10, type:'grass' },
  { x: -22, z: -55, r: 5, h: 7, type:'rock'  },
  // Outer ring
  { x:  72, z:  28, r: 5, h:44, type:'rock'  }, // tall spire — blocks
  { x: -68, z: -52, r: 6, h:50, type:'rock'  }, // tall spire — blocks
  { x:  58, z:  68, r: 8, h:20, type:'grass' },
  { x: -76, z:  22, r: 6, h:18, type:'rock'  },
  { x:  22, z:  78, r: 7, h:15, type:'grass' },
  { x:  78, z: -52, r: 5, h:38, type:'rock'  }, // blocks
  { x: -52, z:  72, r: 7, h:16, type:'grass' },
  { x: -88, z: -68, r: 4, h: 7, type:'rock'  },
  { x:  88, z:  62, r: 6, h:11, type:'grass' },
  { x: -28, z: -78, r: 5, h: 8, type:'snow'  },
  { x:  62, z: -78, r: 4, h: 9, type:'rock'  },
];

const CLOUD_DEFS = [
  { x: -58, z: -42, s:0.85 }, { x:  42, z:  30, s:0.72 },
  { x:  78, z: -54, s:1.05 }, { x: -22, z:  74, s:0.78 },
  { x: -82, z:  26, s:0.90 }, { x:  26, z: -82, s:0.65 },
  { x:  54, z:  62, s:0.85 }, { x: -46, z: -82, s:0.75 },
  { x:   2, z: -34, s:0.60 }, { x:  86, z:   6, s:0.92 },
  { x: -28, z:  48, s:0.80 }, { x:  68, z: -20, s:0.88 },
  { x:  10, z: -68, s:0.70 }, { x: -68, z:  -8, s:0.82 },
  { x:  48, z:  48, s:0.75 }, { x: -88, z:  58, s:0.65 },
  { x:  33, z: -43, s:0.95 }, { x: -43, z:  33, s:0.78 },
  { x:  73, z:  73, s:0.72 }, { x: -73, z: -73, s:0.88 },
];

// ── Class ────────────────────────────────────────────────────────────────────

/**
 * Terrain — builds and owns the world floor, water, islands and clouds.
 * Exposes `colliders` (for Player & DroneAI) and `islandDefs` (for Minimap).
 */
class Terrain {
  /**
   * @param {BABYLON.Scene}  scene
   * @param {object}         mats  — material map from World
   */
  constructor(scene, mats) {
    this.scene      = scene;
    this.mats       = mats;
    this.islandDefs = ISLAND_DEFS;

    // 5×5 ghost grid — pushes tile repeats to ±400 units, safely beyond fog
    this._offsets = Terrain._buildOffsets(2);

    this._buildFloorAndWater();
    this.colliders = this._buildIslands();
    this._buildClouds();
  }

  // ── Public ────────────────────────────────────────────────────────────────

  /** Animate the water surface. Call every frame with `performance.now()`. */
  updateWater(now) {
    this._water.position.y = WORLD.WATER_Y + Math.sin(now * 0.0006) * 0.35;
  }

  // ── Private ───────────────────────────────────────────────────────────────

  static _buildOffsets(radius) {
    const offsets = [];
    for (let dx = -radius; dx <= radius; dx++)
      for (let dz = -radius; dz <= radius; dz++)
        if (dx !== 0 || dz !== 0)
          offsets.push([dx * WORLD.WW, dz * WORLD.WD]);
    return offsets;
  }

  _buildFloorAndWater() {
    const { scene, mats } = this;
    const sz = WORLD.WW * 5; // 5× covers all ghost tiles + margins

    const gFloor = BABYLON.MeshBuilder.CreateGround('floor', { width: sz, height: sz }, scene);
    gFloor.material   = mats.floor;
    gFloor.isPickable = false;

    this._water = BABYLON.MeshBuilder.CreateGround('water', { width: sz, height: sz }, scene);
    this._water.position.y = WORLD.WATER_Y;
    this._water.material   = mats.water;
    this._water.isPickable = false;
  }

  _buildIslands() {
    const { scene, mats, _offsets } = this;
    const colliders = [];

    for (const def of ISLAND_DEFS) {
      const tess  = def.type === 'rock' ? 5 : 7;
      const bodyH = WORLD.WATER_Y + def.h;
      const topH  = 4.0;
      const topMat = def.type === 'grass' ? mats.grass
                   : def.type === 'snow'  ? mats.snow
                   : mats.rock;

      // Body cylinder
      const body = BABYLON.MeshBuilder.CreateCylinder('ib', {
        height:         bodyH,
        diameterTop:    def.r * 1.70,
        diameterBottom: def.r * 0.72,
        tessellation:   tess,
      }, scene);
      body.position.set(def.x, bodyH * 0.5, def.z);
      body.material = def.type === 'rock' ? mats.rock : mats.sand;
      body.convertToFlatShadedMesh();

      // Top cap
      const cap = BABYLON.MeshBuilder.CreateCylinder('ic', {
        height:         topH,
        diameterTop:    def.r * 1.50,
        diameterBottom: def.r * 1.72,
        tessellation:   tess,
      }, scene);
      cap.position.set(def.x, bodyH + topH * 0.5, def.z);
      cap.material = topMat;
      cap.convertToFlatShadedMesh();

      // Ghost instances for all surrounding tiles
      for (const [ox, oz] of _offsets) {
        const bi = body.createInstance('bi');
        bi.position.set(def.x + ox, body.position.y, def.z + oz);
        const ci = cap.createInstance('ci');
        ci.position.set(def.x + ox, cap.position.y, def.z + oz);
      }

      // Collider — topY checked at runtime against current drone altitude
      colliders.push({ x: def.x, z: def.z, r: def.r * 0.76, topY: WORLD.WATER_Y + def.h });
    }

    return colliders;
  }

  _buildClouds() {
    const { scene, mats, _offsets } = this;

    CLOUD_DEFS.forEach((def, idx) => {
      const rng   = mkRng(idx * 7919 + 13);
      const blobs = [];
      const count = 5 + Math.floor(rng() * 3);

      for (let i = 0; i < count; i++) {
        const r  = (6 + rng() * 7) * def.s * 0.5;
        const sp = BABYLON.MeshBuilder.CreateSphere('cs', { diameter: r * 2, segments: 3 }, scene);
        sp.position.set(
          def.x + (rng() - 0.5) * 28 * def.s * 0.5,
          WORLD.CLOUD_Y + (rng() - 0.5) * 8,
          def.z + (rng() - 0.5) * 20 * def.s * 0.5
        );
        sp.material = mats.cloud;
        blobs.push(sp);
      }

      // MergeMeshes bakes world positions → merged mesh origin = (0,0,0)
      const cloud = BABYLON.Mesh.MergeMeshes(blobs, true, true, undefined, false, true);
      cloud.convertToFlatShadedMesh();
      cloud.material = mats.cloud;

      // Ghost instances offset from origin
      for (const [ox, oz] of _offsets) {
        const ci = cloud.createInstance('cld');
        ci.position.set(ox, 0, oz);
      }
    });
  }
}
