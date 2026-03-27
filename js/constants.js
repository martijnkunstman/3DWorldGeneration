'use strict';

const WORLD = Object.freeze({
  WW:      200,   // world width  (X)
  WD:      200,   // world depth  (Z)
  WH:      100,   // world height (Y)
  CAVE_G:  40,    // grid divisions — 40×40 cells of 5×5 units
  CAVE_BS: 5,     // block size in world units
  FLY_MIN: 10,    // absolute minimum altitude (terrain pushes player up further)
  FLY_MAX: 90,    // absolute maximum altitude (terrain pushes player down further)
  FOG_D:   0.003, // EXP2 density — at 600 units visibility < 1 %
  SKY:     [0.04, 0.03, 0.06],  // dark cave void colour
});
