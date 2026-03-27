'use strict';

/**
 * Minimap — renders the 2D overhead map overlay onto a <canvas> element.
 * Shows ocean, grid, islands, AI drone dots and the player arrow.
 */
class Minimap {
  /**
   * @param {HTMLCanvasElement} canvas  — the #mm element
   * @param {{ x,z,r,type }[]} islandDefs
   * @param {{ x,z,r,topY }[]} colliders
   */
  constructor(canvas, islandDefs, colliders) {
    this._canvas     = canvas;
    this._ctx        = canvas.getContext('2d');
    this._MM         = canvas.width;          // pixel size (360)
    this._islandDefs = islandDefs;
    this._colliderSet = new Set(colliders.map(c => `${c.x},${c.z}`));
  }

  /**
   * Redraw the minimap.
   * @param {DroneAI}          aiDrones
   * @param {BABYLON.Vector3}  playerPos   — fly camera world position
   * @param {number}           playerYaw   — fly heading in radians
   * @param {boolean}          flyMode
   * @param {number}           flyY        — current player altitude
   */
  draw(aiDrones, playerPos, playerYaw, flyMode, flyY) {
    const { _ctx: ctx, _MM: MM } = this;

    ctx.clearRect(0, 0, MM, MM);

    // Ocean background
    ctx.fillStyle = '#07285a';
    ctx.fillRect(0, 0, MM, MM);

    // Subtle grid at quarter-marks
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 1;
    [0.25, 0.5, 0.75].forEach(f => {
      ctx.beginPath();
      ctx.moveTo(f * MM, 0); ctx.lineTo(f * MM, MM);
      ctx.moveTo(0, f * MM); ctx.lineTo(MM, f * MM);
      ctx.stroke();
    });

    // Islands
    const scaleR = MM / WORLD.WW;
    for (const def of this._islandDefs) {
      const [mx, mz] = this._toMM(def.x, def.z);
      const r        = Math.max(2.5, def.r * scaleR * 0.45);

      ctx.fillStyle = def.type === 'grass' ? '#1d8a14'
                    : def.type === 'snow'  ? '#b8c8d8'
                    : '#6a5c4a';
      ctx.beginPath();
      ctx.arc(mx, mz, r, 0, Math.PI * 2);
      ctx.fill();

      if (this._colliderSet.has(`${def.x},${def.z}`)) {
        // Red ring = obstacle (can block at some altitude)
        ctx.strokeStyle = 'rgba(255,60,60,0.80)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // AI drone dots
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
    // flyYaw: 0 = +Z (south on minimap).
    // Canvas Y flipped vs world Z, X also mirrored → atan2(-sin, -cos)
    ctx.rotate(Math.atan2(-Math.sin(playerYaw), -Math.cos(playerYaw)));

    ctx.fillStyle = flyMode ? '#ff3333' : '#ffcc00';
    ctx.beginPath();
    ctx.moveTo(0, -8);   // nose
    ctx.lineTo(5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.restore();

    // Label & coordinates
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

  /** World [-WW/2 … +WW/2] → minimap pixel [0 … MM] with mirrored X. */
  _toMM(wx, wz) {
    const MM = this._MM;
    return [
      MM - (wx + WORLD.WW / 2) / WORLD.WW * MM,   // mirrored X
      (wz + WORLD.WD / 2) / WORLD.WD * MM,
    ];
  }
}
