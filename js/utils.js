'use strict';

/** Wrap v into [-size/2, +size/2) on a torus of circumference `size`. */
function wrapHalf(v, size) {
  const h = size * 0.5;
  return ((v + h) % size + size) % size - h;
}

/** Shortest signed displacement from b to a on a torus. */
function toroidDiff(a, b, size) {
  return wrapHalf(a - b, size);
}

/** Seeded, deterministic PRNG — returns a zero-arg function → [0, 1). */
function mkRng(seed) {
  let s = seed | 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}
