'use strict';

/**
 * Minimap — renders a top-down cave map on a 2D canvas overlay.
 * Each grid cell is coloured by available passage height (floor→ceiling gap):
 * brighter = more open space, darker = narrow tunnel.
 */
class Minimap {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {Terrain} terrain
   */
  constructor(canvas, terrain) {
    this._canvas  = canvas;
    this._ctx     = canvas.getContext('2d');
    this._MM      = canvas.width;      // 360 px
    this._terrain = terrain;
    this._cellPx  = this._MM / WORLD.CAVE_G;  // px per grid cell
    this._mapImg  = this._prebakeMap();        // static cave image
  }

  /**
   * @param {DroneAI}         aiDrones
   * @param {BABYLON.Vector3} playerPos
   * @param {number}          playerYaw
   * @param {boolean}         flyMode
   * @param {number}          flyY
   */
  draw(aiDrones, playerPos, playerYaw, flyMode, flyY) {
    const { _ctx: ctx, _MM: MM } = this;

    // Cave heightmap (static — drawn once, reused each frame)
    ctx.drawImage(this._mapImg, 0, 0);

    // Drone dots
    for (const d of aiDrones.drones) {
      const [dmx, dmz] = this._toMM(
        wrapHalf(d.pos.x, WORLD.WW),
        wrapHalf(d.pos.z, WORLD.WD)
      );
      ctx.fillStyle = d.col.hex;
      ctx.beginPath();
      ctx.arc(dmx, dmz, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    // Player arrow
    const rawX = flyMode ? playerPos.x : 0;
    const rawZ = flyMode ? playerPos.z : 0;
    const px = wrapHalf(rawX, WORLD.WW);
    const pz = wrapHalf(rawZ, WORLD.WD);
    const [pmx, pmz] = this._toMM(px, pz);

    ctx.save();
    ctx.translate(pmx, pmz);
    ctx.rotate(Math.atan2(-Math.sin(playerYaw), -Math.cos(playerYaw)));
    ctx.fillStyle = flyMode ? '#ff3333' : '#ffcc00';
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.restore();

    // Label & coords
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = 'bold 9px monospace';
    ctx.fillText('MAP', 5, 13);

    if (flyMode) {
      ctx.font = '8px monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.fillText(
        `x:${Math.round(px)} z:${Math.round(pz)} y:${Math.round(flyY)}`,
        5, MM - 5
      );
    }
  }

  // ── Private ───────────────────────────────────────────────────────────────

  /**
   * Pre-renders the static cave map to an OffscreenCanvas (or regular canvas)
   * so it doesn't need to be redrawn every frame.
   */
  _prebakeMap() {
    const G   = WORLD.CAVE_G;
    const BS  = WORLD.CAVE_BS;
    const MM  = this._MM;
    const cpx = this._cellPx;

    const offscreen = (typeof OffscreenCanvas !== 'undefined')
      ? new OffscreenCanvas(MM, MM)
      : document.createElement('canvas');
    offscreen.width  = MM;
    offscreen.height = MM;
    const ctx = offscreen.getContext('2d');

    // Dark background
    ctx.fillStyle = '#050308';
    ctx.fillRect(0, 0, MM, MM);

    for (let gx = 0; gx < G; gx++) {
      for (let gz = 0; gz < G; gz++) {
        // Sample the centre of this cell
        const wx = (gx - G / 2) * BS + BS / 2;
        const wz = (gz - G / 2) * BS + BS / 2;

        const floorY = this._terrain.floorAt(wx, wz);
        const ceilY  = this._terrain.ceilAt(wx, wz);
        const gap    = Math.max(0, ceilY - floorY);
        const t      = gap / WORLD.WH;  // 0..1

        // Mirrored-X pixel position (matches the world→minimap transform)
        const mmx = MM - (gx + 1) * cpx;
        const mmz = gz * cpx;

        // Colour: narrow=dark blue-gray, open=bright blue
        const v = Math.round(t * 200 + 20);
        ctx.fillStyle = `rgb(${Math.round(v * 0.30)},${Math.round(v * 0.55)},${v})`;
        ctx.fillRect(mmx, mmz, cpx + 0.5, cpx + 0.5); // +0.5 avoids hairline gaps
      }
    }

    // Subtle grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 0.5;
    [0.25, 0.5, 0.75].forEach(f => {
      ctx.beginPath();
      ctx.moveTo(f * MM, 0); ctx.lineTo(f * MM, MM);
      ctx.moveTo(0, f * MM); ctx.lineTo(MM, f * MM);
      ctx.stroke();
    });

    return offscreen;
  }

  /** World position → minimap pixel, with mirrored X. */
  _toMM(wx, wz) {
    const MM = this._MM;
    return [
      MM - (wx + WORLD.WW / 2) / WORLD.WW * MM,
      (wz + WORLD.WD / 2) / WORLD.WD * MM,
    ];
  }
}
