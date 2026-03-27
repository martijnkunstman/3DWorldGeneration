'use strict';

// ── Bootstrap ─────────────────────────────────────────────────────────────────
// Load order guaranteed by <script> tags in index.html:
//   constants → utils → World → Terrain → Player → DroneAI → Minimap → main

!function () {
  const canvas = document.getElementById('c');

  const world   = new World(canvas);
  const terrain = new Terrain(world.scene, world.mats);
  const player  = new Player(world.scene, canvas, terrain.colliders);
  const drones  = new DroneAI(world.scene, terrain.colliders);
  const minimap = new Minimap(
    document.getElementById('mm'),
    terrain.islandDefs,
    terrain.colliders
  );

  let prev = performance.now();

  world.start(() => {
    const now = performance.now();
    const dt  = Math.min((now - prev) / 1000, 0.05);
    prev = now;

    terrain.updateWater(now);
    player.update(dt);
    drones.update(dt);
    world.scene.render();
    minimap.draw(drones, player.position, player.flyYaw, player.flyMode, player.flyY);
  });
}();
