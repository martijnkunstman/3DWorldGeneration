'use strict';

const DRONE_PALETTE = [
  { r:1.00, g:0.45, b:0.10, hex:'#ff7218' }, // orange
  { r:0.10, g:0.85, b:0.90, hex:'#19d9e6' }, // cyan
  { r:0.30, g:0.95, b:0.20, hex:'#4df233' }, // lime
  { r:1.00, g:0.30, b:0.60, hex:'#ff4d99' }, // pink
  { r:1.00, g:0.90, b:0.10, hex:'#ffe619' }, // yellow
];

// 3×3 ghost offsets — drones move fast so 3×3 is enough
const DRONE_GHOST_OFFSETS = [];
for (let dx = -1; dx <= 1; dx++)
  for (let dz = -1; dz <= 1; dz++)
    if (dx !== 0 || dz !== 0)
      DRONE_GHOST_OFFSETS.push([dx * WORLD.WW, dz * WORLD.WD]);

/**
 * DroneAI — 5 AI drones flying through the cave with waypoint steering,
 * smooth banking/pitch, and cave floor/ceiling collision.
 */
class DroneAI {
  /**
   * @param {BABYLON.Scene} scene
   * @param {Terrain} terrain
   */
  constructor(scene, terrain) {
    this.scene   = scene;
    this.terrain = terrain;
    this._drones = this._spawnDrones();
  }

  get drones() { return this._drones; }

  update(dt) {
    for (const d of this._drones) this._stepDrone(d, dt);
  }

  // ── Private ───────────────────────────────────────────────────────────────

  _buildMesh(col) {
    const mat = new BABYLON.StandardMaterial('drm', this.scene);
    mat.diffuseColor  = new BABYLON.Color3(col.r, col.g, col.b);
    mat.emissiveColor = new BABYLON.Color3(col.r * 0.5, col.g * 0.5, col.b * 0.5);
    mat.specularColor = BABYLON.Color3.Black();

    const body = BABYLON.MeshBuilder.CreateBox('drB',
      { width:1.8, height:0.60, depth:1.8 }, this.scene);

    const a1 = BABYLON.MeshBuilder.CreateBox('drA1',
      { width:5.6, height:0.24, depth:0.46 }, this.scene);
    a1.rotation.y = Math.PI / 4;

    const a2 = BABYLON.MeshBuilder.CreateBox('drA2',
      { width:5.6, height:0.24, depth:0.46 }, this.scene);
    a2.rotation.y = -Math.PI / 4;

    const mr = 1.98;
    const motors = [[-mr,-mr],[mr,-mr],[-mr,mr],[mr,mr]].map(([x, z]) => {
      const m = BABYLON.MeshBuilder.CreateCylinder('drM',
        { diameter:1.1, height:0.38, tessellation:6 }, this.scene);
      m.position.set(x, 0.12, z);
      return m;
    });

    const mesh = BABYLON.Mesh.MergeMeshes(
      [body, a1, a2, ...motors], true, true, undefined, false, true);
    mesh.convertToFlatShadedMesh();
    mesh.material = mat;

    const ghosts = DRONE_GHOST_OFFSETS.map(() => mesh.createInstance('dg'));
    return { mesh, ghosts };
  }

  _midY() {
    return WORLD.WH * 0.5 + (Math.random() - 0.5) * 20;
  }

  _spawnDrones() {
    return DRONE_PALETTE.map((col, i) => {
      const angle    = (i / DRONE_PALETTE.length) * Math.PI * 2;
      const dist     = 20 + i * 14;
      const meshData = this._buildMesh(col);
      return {
        pos:           { x: Math.cos(angle) * dist, y: this._midY(), z: Math.sin(angle) * dist },
        yaw:           angle,
        speed:         15 + Math.random() * 10,
        targetYaw:     angle + 0.5,
        targetY:       this._midY(),
        waypointTimer: i * 1.3,
        col,
        meshData,
      };
    });
  }

  _stepDrone(d, dt) {
    // ── New waypoint periodically ──────────────────────────────────────────
    d.waypointTimer -= dt;
    if (d.waypointTimer <= 0) {
      d.targetYaw     = d.yaw + (Math.random() - 0.5) * Math.PI * 1.6;
      d.targetY       = this._midY();
      d.waypointTimer = 3 + Math.random() * 5;
    }

    // ── Smooth yaw ─────────────────────────────────────────────────────────
    const yawErr = wrapHalf(d.targetYaw - d.yaw, Math.PI * 2);
    d.yaw += Math.sign(yawErr) * Math.min(Math.abs(yawErr), 1.8 * dt);

    // ── Move forward ───────────────────────────────────────────────────────
    d.pos.x += Math.sin(d.yaw) * d.speed * dt;
    d.pos.z += Math.cos(d.yaw) * d.speed * dt;

    // ── Toroidal wrap ──────────────────────────────────────────────────────
    d.pos.x = wrapHalf(d.pos.x, WORLD.WW);
    d.pos.z = wrapHalf(d.pos.z, WORLD.WD);

    // ── Smooth altitude toward target ──────────────────────────────────────
    const yErr = d.targetY - d.pos.y;
    d.pos.y += Math.sign(yErr) * Math.min(Math.abs(yErr), 14 * dt);

    // ── Cave collision — clamp between floor and ceiling ───────────────────
    const floorY = this.terrain.floorAt(d.pos.x, d.pos.z);
    const ceilY  = this.terrain.ceilAt(d.pos.x, d.pos.z);
    const margin = 4;
    if (d.pos.y < floorY + margin) {
      d.pos.y   = floorY + margin;
      d.targetY = floorY + margin + 10;
    }
    if (d.pos.y > ceilY - margin) {
      d.pos.y   = ceilY - margin;
      d.targetY = ceilY - margin - 10;
    }

    // ── Visual banking / pitch ─────────────────────────────────────────────
    const bank  = Math.max(-0.45, Math.min(0.45, -yawErr * 0.35));
    const pitch = Math.max(-0.28, Math.min(0.28, -yErr   * 0.012));

    const { mesh, ghosts } = d.meshData;
    mesh.position.set(d.pos.x, d.pos.y, d.pos.z);
    mesh.rotation.set(pitch, d.yaw, bank);

    for (let i = 0; i < ghosts.length; i++) {
      ghosts[i].position.set(
        d.pos.x + DRONE_GHOST_OFFSETS[i][0],
        d.pos.y,
        d.pos.z + DRONE_GHOST_OFFSETS[i][1]
      );
      ghosts[i].rotation.set(pitch, d.yaw, bank);
    }
  }
}
