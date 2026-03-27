'use strict';

!function () {
  const canvas = document.getElementById('c');

  const world   = new World(canvas);
  const terrain = new Terrain(world.scene, world.mats);
  const player  = new Player(world.scene, canvas, terrain);
  const drones  = new DroneAI(world.scene, terrain);
  const minimap = new Minimap(document.getElementById('mm'), terrain);

  let prev = performance.now();

  world.start(() => {
    const now = performance.now();
    const dt  = Math.min((now - prev) / 1000, 0.05);
    prev = now;

    player.update(dt);
    drones.update(dt);
    world.scene.render();
    minimap.draw(drones, player.position, player.flyYaw, player.flyMode, player.flyY);
  });
}();
