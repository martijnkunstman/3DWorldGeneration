'use strict';

const WORLD = Object.freeze({
  WW:      200,   // world width  (X)
  WD:      200,   // world depth  (Z)
  WH:      100,   // world height (Y) — half of WW
  WATER_Y: 14,    // water surface Y
  CLOUD_Y: 91,    // WH - 9
  FLY_MIN: 20,    // WATER_Y + 6 — lowest drone altitude
  FLY_MAX: 85,    // CLOUD_Y - 6 — highest drone altitude
  FOG_D:   0.009, // EXP2 fog density; at 400 units visibility < 0.01 %
  SKY:     [0.52, 0.80, 0.98], // sky / fog RGB — must be identical
});
