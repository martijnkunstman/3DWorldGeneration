!function () {
  "use strict";

  // ═══════════════════════════════════════════════════════════════════════════
  //  WORLD CONSTANTS
  // ═══════════════════════════════════════════════════════════════════════════
  const WW      = 200;          // world width  (X)
  const WD      = 200;          // world depth  (Z)
  const WH      = 100;          // world height (Y) — half of WW
  const WATER_Y  = 14;          // water surface Y
  const CLOUD_Y  = WH - 9;     // 91 — cloud layer
  const FLY_MIN  = WATER_Y + 6; // 20 — lowest drone altitude
  const FLY_MAX  = CLOUD_Y - 6; // 85 — highest drone altitude
  let   flyY     = WH * 0.5;   // 50 — current drone altitude (mutable)

  // Sky / fog colour — must be IDENTICAL so distant voids blend to sky
  const SKY = [0.52, 0.80, 0.98];

  // Fog: EXP2 — 5×5 ghost world pushes repeats to 400 units; fog hides them there.
  // Formula: vis = e^(-(FOG_D * dist)^2)
  // At dist 400: e^(-(0.009*400)^2) = e^(-12.96) ≈ 0%   ← repeats invisible ✓
  // At dist 200: e^(-(0.009*200)^2) = e^(-3.24)  ≈ 4%   ← heavy haze ✓
  // At dist 100: e^(-(0.009*100)^2) = e^(-0.81)  ≈ 44%  ← clear/scenic ✓
  const FOG_D = 0.009;

  // ═══════════════════════════════════════════════════════════════════════════
  //  ENGINE / SCENE
  // ═══════════════════════════════════════════════════════════════════════════
  const canvas = document.getElementById('c');
  const engine = new BABYLON.Engine(canvas, true);
  const scene  = new BABYLON.Scene(engine);

  scene.clearColor = new BABYLON.Color4(...SKY, 1);
  scene.fogMode    = BABYLON.Scene.FOGMODE_EXP2;
  scene.fogDensity = FOG_D;
  scene.fogColor   = new BABYLON.Color3(...SKY);  // ← exact match = seamless horizon

  // ═══════════════════════════════════════════════════════════════════════════
  //  LIGHTING
  // ═══════════════════════════════════════════════════════════════════════════
  const hemi = new BABYLON.HemisphericLight('hemi', new BABYLON.Vector3(0,1,0), scene);
  hemi.intensity   = 0.72;
  hemi.diffuse     = new BABYLON.Color3(1.00, 0.95, 0.85);
  hemi.groundColor = new BABYLON.Color3(0.18, 0.32, 0.52);
  hemi.specular    = BABYLON.Color3.Black();

  const sun = new BABYLON.DirectionalLight('sun', new BABYLON.Vector3(-1,-2,-0.6).normalize(), scene);
  sun.intensity = 0.55;
  sun.diffuse   = new BABYLON.Color3(1.0, 0.90, 0.70);

  // ═══════════════════════════════════════════════════════════════════════════
  //  MATERIALS
  // ═══════════════════════════════════════════════════════════════════════════
  function stdMat(name, r, g, b, specR, specG, specB) {
    const m = new BABYLON.StandardMaterial(name, scene);
    m.diffuseColor  = new BABYLON.Color3(r, g, b);
    m.specularColor = specR != null
      ? new BABYLON.Color3(specR, specG, specB)
      : BABYLON.Color3.Black();
    return m;
  }

  const mWater = stdMat('water', 0.04, 0.34, 0.74, 0.35, 0.48, 0.70);
  mWater.alpha = 0.86;
  const mFloor = stdMat('floor', 0.08, 0.16, 0.36);
  const mSand  = stdMat('sand',  0.84, 0.72, 0.46);
  const mGrass = stdMat('grass', 0.20, 0.60, 0.16);
  const mRock  = stdMat('rock',  0.46, 0.42, 0.36);
  const mSnow  = stdMat('snow',  0.90, 0.93, 0.98);
  const mCloud = stdMat('cloud', 0.97, 0.97, 1.00);
  mCloud.emissiveColor = new BABYLON.Color3(0.82, 0.86, 0.90);

  // ═══════════════════════════════════════════════════════════════════════════
  //  FLOOR & WATER  (5× wide — covers ghost tiles with generous margin)
  // ═══════════════════════════════════════════════════════════════════════════
  const gFloor = BABYLON.MeshBuilder.CreateGround('floor',
    { width: WW * 5, height: WD * 5 }, scene);
  gFloor.material   = mFloor;
  gFloor.isPickable = false;

  const gWater = BABYLON.MeshBuilder.CreateGround('water',
    { width: WW * 5, height: WD * 5 }, scene);
  gWater.position.y = WATER_Y;
  gWater.material   = mWater;
  gWater.isPickable = false;

  // ═══════════════════════════════════════════════════════════════════════════
  //  3×3 GHOST WORLD — neighbour tile offsets
  // ═══════════════════════════════════════════════════════════════════════════
  // The source mesh occupies the centre tile (offset 0,0).
  // 8 InstancedMesh copies fill the surrounding 8 tiles.
  // Together they form a seamless toroidal world:
  //   • Any island/cloud is always rendered within WW/2 of the player.
  //   • The fog (EXP2) makes the tile boundary invisible before it's reached.
  // 5×5 ghost world: repeats start at ±WW=200 but extend to ±2×WW=400.
  // Fog kills visibility at 400 units, so doubled islands are never seen.
  const NEIGHBOUR_OFFSETS = [];
  for (let dx = -2; dx <= 2; dx++)
    for (let dz = -2; dz <= 2; dz++)
      if (dx !== 0 || dz !== 0)
        NEIGHBOUR_OFFSETS.push([dx * WW, dz * WD]);

  // ═══════════════════════════════════════════════════════════════════════════
  //  ISLAND DEFINITIONS
  //  h    = island height above WATER_Y
  //  topY = WATER_Y + h  (checked at runtime against current flyY)
  // ═══════════════════════════════════════════════════════════════════════════
  const ISLAND_DEFS = [
    { x:   0, z:   0, r: 36, h: 18, type: 'grass' }, // big central — low, no block
    { x: -56, z: -40, r: 22, h: 16, type: 'grass' },
    { x:  60, z:  24, r: 26, h: 38, type: 'grass' }, // BLOCKS
    { x: -70, z:  56, r: 18, h: 14, type: 'rock'  },
    { x:  24, z: -68, r: 16, h: 12, type: 'grass' },
    { x:  76, z: -52, r: 20, h: 72, type: 'rock'  }, // TALL SPIRE — BLOCKS
    { x: -24, z:  76, r: 20, h: 36, type: 'grass' }, // BLOCKS
    { x: -82, z: -76, r: 16, h: 48, type: 'rock'  }, // BLOCKS
    { x:  82, z:  70, r: 24, h: 22, type: 'grass' },
    { x:  10, z:  56, r: 14, h:  8, type: 'snow'  },
    { x: -44, z:  16, r: 14, h: 42, type: 'rock'  }, // BLOCKS
    { x:  50, z: -82, r: 12, h: 10, type: 'rock'  },
    { x: -82, z:  18, r: 14, h: 20, type: 'grass' },
    { x:  34, z:  82, r: 18, h: 24, type: 'rock'  },
  ];

  // All islands — topY is checked at runtime against the current flyY
  const COLLIDERS = ISLAND_DEFS.map(d => ({
    x: d.x, z: d.z, r: d.r * 0.76, topY: WATER_Y + d.h,
  }));

  function makeIsland(def) {
    const tess  = def.type === 'rock' ? 5 : 7;
    const bodyH = WATER_Y + def.h;
    const topH  = 4.0;

    const topMat = def.type === 'grass' ? mGrass
                 : def.type === 'snow'  ? mSnow
                 : mRock;

    // Body
    const body = BABYLON.MeshBuilder.CreateCylinder('ib', {
      height:         bodyH,
      diameterTop:    def.r * 1.70,
      diameterBottom: def.r * 0.72,
      tessellation:   tess,
    }, scene);
    body.position.set(def.x, bodyH * 0.5, def.z);
    body.material = (def.type === 'rock') ? mRock : mSand;
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

    // Ghost copies for 8 neighbour tiles
    for (const [ox, oz] of NEIGHBOUR_OFFSETS) {
      const bi = body.createInstance('bi');
      bi.position.set(def.x + ox, body.position.y, def.z + oz);
      const ci = cap.createInstance('ci');
      ci.position.set(def.x + ox, cap.position.y, def.z + oz);
    }
  }

  ISLAND_DEFS.forEach(makeIsland);

  // ═══════════════════════════════════════════════════════════════════════════
  //  CLOUDS
  // ═══════════════════════════════════════════════════════════════════════════
  const CLOUD_DEFS = [
    { x: -60, z: -44, s: 2.2 }, { x:  44, z:  32, s: 1.8 },
    { x:  80, z: -56, s: 2.6 }, { x: -24, z:  76, s: 2.0 },
    { x: -84, z:  28, s: 2.4 }, { x:  28, z: -84, s: 1.6 },
    { x:  56, z:  64, s: 2.2 }, { x: -48, z: -84, s: 1.9 },
    { x:   4, z: -36, s: 1.5 }, { x:  88, z:   8, s: 2.3 },
    { x: -30, z:  50, s: 2.0 }, { x:  70, z: -22, s: 2.1 },
  ];

  function mkRng(seed) {
    let s = seed | 0;
    return () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 0x100000000;
    };
  }

  function makeCloud(def, idx) {
    const rng   = mkRng(idx * 7919 + 13);
    const blobs = [];
    const count = 5 + Math.floor(rng() * 3);
    for (let i = 0; i < count; i++) {
      const r  = (6 + rng() * 7) * def.s * 0.5;
      const sp = BABYLON.MeshBuilder.CreateSphere('cs', { diameter: r * 2, segments: 3 }, scene);
      sp.position.set(
        def.x + (rng() - 0.5) * 28 * def.s * 0.5,
        CLOUD_Y + (rng() - 0.5) * 8,
        def.z + (rng() - 0.5) * 20 * def.s * 0.5
      );
      sp.material = mCloud;
      blobs.push(sp);
    }
    // MergeMeshes bakes all world positions → resulting mesh origin = (0,0,0)
    const cloud = BABYLON.Mesh.MergeMeshes(blobs, true, true, undefined, false, true);
    cloud.convertToFlatShadedMesh();
    cloud.material = mCloud;

    // Ghost copies — offset from merged mesh's origin (0,0,0)
    for (const [ox, oz] of NEIGHBOUR_OFFSETS) {
      const ci = cloud.createInstance('cld');
      ci.position.set(ox, 0, oz);
    }
  }

  CLOUD_DEFS.forEach(makeCloud);

  // ═══════════════════════════════════════════════════════════════════════════
  //  AI DRONES
  // ═══════════════════════════════════════════════════════════════════════════
  const DRONE_PALETTE = [
    { r:1.00, g:0.45, b:0.10, hex:'#ff7218' }, // orange
    { r:0.10, g:0.85, b:0.90, hex:'#19d9e6' }, // cyan
    { r:0.30, g:0.95, b:0.20, hex:'#4df233' }, // lime
    { r:1.00, g:0.30, b:0.60, hex:'#ff4d99' }, // pink
    { r:1.00, g:0.90, b:0.10, hex:'#ffe619' }, // yellow
  ];

  function buildDroneMesh(col) {
    const mat = new BABYLON.StandardMaterial('drm', scene);
    mat.diffuseColor  = new BABYLON.Color3(col.r, col.g, col.b);
    mat.emissiveColor = new BABYLON.Color3(col.r * 0.5, col.g * 0.5, col.b * 0.5);
    mat.specularColor = BABYLON.Color3.Black();

    const root = new BABYLON.TransformNode('drRoot', scene);

    function part(mesh) {
      mesh.parent   = root;
      mesh.material = mat;
      mesh.convertToFlatShadedMesh();
    }

    // Flat square body
    part(BABYLON.MeshBuilder.CreateBox('drB', { width:2.6, height:0.85, depth:2.6 }, scene));

    // X-config arms
    const a1 = BABYLON.MeshBuilder.CreateBox('drA1', { width:9.2, height:0.35, depth:0.70 }, scene);
    a1.rotation.y = Math.PI / 4;  part(a1);
    const a2 = BABYLON.MeshBuilder.CreateBox('drA2', { width:9.2, height:0.35, depth:0.70 }, scene);
    a2.rotation.y = -Math.PI / 4; part(a2);

    // Motor pods at each arm tip (9.2/2 × sin45° ≈ 3.25)
    const mr = 3.25;
    for (const [x, z] of [[-mr,-mr],[mr,-mr],[-mr,mr],[mr,mr]]) {
      const m = BABYLON.MeshBuilder.CreateCylinder('drM',
        { diameter:1.9, height:0.5, tessellation:6 }, scene);
      m.position.set(x, 0.15, z);
      part(m);
    }

    return root;
  }

  // Spawn 5 drones, evenly spread around the world
  const AI_DRONES = DRONE_PALETTE.map((col, i) => {
    const angle = (i / DRONE_PALETTE.length) * Math.PI * 2;
    const dist  = 20 + i * 14;
    return {
      pos:          { x: Math.cos(angle) * dist,
                      y: FLY_MIN + 8 + Math.random() * (FLY_MAX - FLY_MIN - 16),
                      z: Math.sin(angle) * dist },
      yaw:          angle,
      speed:        15 + Math.random() * 10,   // units/s
      targetYaw:    angle + 0.5,
      targetY:      FLY_MIN + 8 + Math.random() * (FLY_MAX - FLY_MIN - 16),
      waypointTimer: i * 1.3,                   // stagger initial changes
      col,
      mesh:         buildDroneMesh(col),
    };
  });

  function updateDrones(dt) {
    for (const d of AI_DRONES) {

      // ── Pick a new waypoint periodically ────────────────────────────────
      d.waypointTimer -= dt;
      if (d.waypointTimer <= 0) {
        // Vary heading by ±144° max; vary altitude across full flyable range
        d.targetYaw     = d.yaw + (Math.random() - 0.5) * Math.PI * 1.6;
        d.targetY       = FLY_MIN + 8 + Math.random() * (FLY_MAX - FLY_MIN - 16);
        d.waypointTimer = 3 + Math.random() * 5;
      }

      // ── Look-ahead obstacle avoidance ────────────────────────────────────
      const LOOK = 40;
      const lx = d.pos.x + Math.sin(d.yaw) * LOOK;
      const lz = d.pos.z + Math.cos(d.yaw) * LOOK;

      for (const c of COLLIDERS) {
        if (c.topY < d.pos.y - 5) continue;           // island below drone
        const adx = toroidDiff(lx, c.x, WW);
        const adz = toroidDiff(lz, c.z, WD);
        if (adx * adx + adz * adz < (c.r + 12) * (c.r + 12)) {
          // Determine which side the obstacle is on and turn away
          const toObsX   = toroidDiff(c.x, d.pos.x, WW);
          const toObsZ   = toroidDiff(c.z, d.pos.z, WD);
          const relAngle = wrapHalf(Math.atan2(toObsX, toObsZ) - d.yaw, Math.PI * 2);
          d.targetYaw    = d.yaw + (relAngle > 0 ? -Math.PI * 0.75 : Math.PI * 0.75);
          // Also try a vertical escape
          const escapeUp = (c.topY - d.pos.y > 0);
          d.targetY      = escapeUp
            ? Math.min(FLY_MAX - 5, d.pos.y + 15)
            : Math.max(FLY_MIN + 5, d.pos.y - 15);
          d.waypointTimer = 2.5;
          break;
        }
      }

      // ── Smooth yaw rotation ──────────────────────────────────────────────
      const yawErr = wrapHalf(d.targetYaw - d.yaw, Math.PI * 2);
      d.yaw += Math.sign(yawErr) * Math.min(Math.abs(yawErr), 1.8 * dt);

      // ── Smooth altitude ──────────────────────────────────────────────────
      const yErr = d.targetY - d.pos.y;
      d.pos.y    = Math.max(FLY_MIN, Math.min(FLY_MAX,
                     d.pos.y + Math.sign(yErr) * Math.min(Math.abs(yErr), 14 * dt)));

      // ── Horizontal movement ──────────────────────────────────────────────
      d.pos.x += Math.sin(d.yaw) * d.speed * dt;
      d.pos.z += Math.cos(d.yaw) * d.speed * dt;

      // ── Toroidal wrap ────────────────────────────────────────────────────
      d.pos.x = wrapHalf(d.pos.x, WW);
      d.pos.z = wrapHalf(d.pos.z, WD);

      // ── Update mesh: heading + banking into turns + nose pitch ───────────
      const bank  = Math.max(-0.45, Math.min(0.45, -yawErr * 0.35));
      const pitch = Math.max(-0.28, Math.min(0.28, -yErr   * 0.012));
      d.mesh.position.set(d.pos.x, d.pos.y, d.pos.z);
      d.mesh.rotation.set(pitch, d.yaw, bank);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  CAMERAS
  // ═══════════════════════════════════════════════════════════════════════════
  let flyMode = false;

  // Preview: auto-rotating ArcRotateCamera looking at world from outside
  const arcCam = new BABYLON.ArcRotateCamera(
    'arc', -Math.PI / 2, Math.PI / 3.2, WW * 1.35,
    new BABYLON.Vector3(0, WH * 0.42, 0), scene
  );
  arcCam.lowerRadiusLimit = WW * 0.55;
  arcCam.upperRadiusLimit = WW * 3.0;
  arcCam.minZ = 1;
  arcCam.maxZ = WW * 8;
  arcCam.attachControl(canvas, false);

  // Fly: FreeCamera — height controlled by W/S, locked to flyY each frame
  const flyCam = new BABYLON.FreeCamera('fly', new BABYLON.Vector3(10, flyY, 10), scene);
  flyCam.minZ = 0.5;
  flyCam.maxZ = WW * 6;   // extended for wider view
  flyCam.setTarget(new BABYLON.Vector3(30, flyY, 10));

  scene.activeCamera = arcCam;

  // ═══════════════════════════════════════════════════════════════════════════
  //  INPUT
  // ═══════════════════════════════════════════════════════════════════════════
  const keys = {};
  window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'Space') toggleMode();
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyW','KeyS'].includes(e.code))
      e.preventDefault();
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; });

  let flyYaw    = 0;
  let mouseDX   = 0;
  let mouseLook = false;

  window.addEventListener('mousemove', e => {
    if (flyMode && mouseLook) mouseDX += e.movementX * 0.0025;
  });
  canvas.addEventListener('click', () => {
    if (flyMode) canvas.requestPointerLock
      ? canvas.requestPointerLock().then(() => { mouseLook = true; }).catch(() => {})
      : (mouseLook = true);
  });
  document.addEventListener('pointerlockchange', () => {
    mouseLook = document.pointerLockElement === canvas;
  });

  function toggleMode() {
    flyMode = !flyMode;
    document.getElementById('modeLabel').textContent = flyMode ? 'FLY' : 'PREVIEW';
    document.getElementById('hud').innerHTML = flyMode
      ? '↑↓ Move &nbsp; ←→ Turn &nbsp; W/S Height &nbsp; Click → mouse look &nbsp; SPACE: preview'
      : 'SPACE: Fly mode &nbsp;|&nbsp; Mouse drag: orbit &nbsp;|&nbsp; Scroll: zoom';

    if (flyMode) {
      arcCam.detachControl();
      scene.activeCamera = flyCam;
    } else {
      if (document.pointerLockElement) document.exitPointerLock();
      mouseLook = false;
      scene.activeCamera = arcCam;
      arcCam.attachControl(canvas, false);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  TOROIDAL HELPERS
  // ═══════════════════════════════════════════════════════════════════════════
  // Wrap v into [-size/2, +size/2)
  function wrapHalf(v, size) {
    const h = size * 0.5;
    return ((v + h) % size + size) % size - h;
  }
  // Shortest signed displacement from b to a on a torus
  function toroidDiff(a, b, size) { return wrapHalf(a - b, size); }

  // ═══════════════════════════════════════════════════════════════════════════
  //  MINIMAP
  // ═══════════════════════════════════════════════════════════════════════════
  const mmCanvas = document.getElementById('mm');
  const mmCtx    = mmCanvas.getContext('2d');
  const MM       = 360; // pixel size

  // World [-WW/2 … +WW/2] → minimap [0 … MM]
  function toMM(wx, wz) {
    return [
      MM - (wx + WW / 2) / WW * MM,   // mirrored X
      (wz + WD / 2) / WD * MM,
    ];
  }

  // Set of blocking island coordinates for quick lookup
  const colliderSet = new Set(COLLIDERS.map(c => `${c.x},${c.z}`));

  function drawMinimap() {
    const ctx = mmCtx;
    ctx.clearRect(0, 0, MM, MM);

    // Ocean background
    ctx.fillStyle = '#07285a';
    ctx.fillRect(0, 0, MM, MM);

    // Subtle grid lines at quarter-marks
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 1;
    [0.25, 0.5, 0.75].forEach(f => {
      ctx.beginPath();
      ctx.moveTo(f * MM, 0); ctx.lineTo(f * MM, MM);
      ctx.moveTo(0, f * MM); ctx.lineTo(MM, f * MM);
      ctx.stroke();
    });

    // Islands
    const scaleR = MM / WW;
    for (const def of ISLAND_DEFS) {
      const [mx, mz] = toMM(def.x, def.z);
      const r  = Math.max(2.5, def.r * scaleR * 0.45);
      const blocking = colliderSet.has(`${def.x},${def.z}`);

      ctx.fillStyle = def.type === 'grass' ? '#1d8a14'
                    : def.type === 'snow'  ? '#b8c8d8'
                    : '#6a5c4a';
      ctx.beginPath();
      ctx.arc(mx, mz, r, 0, Math.PI * 2);
      ctx.fill();

      if (blocking) {
        // Red ring = obstacle at fly height
        ctx.strokeStyle = 'rgba(255,60,60,0.80)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // AI drone dots
    for (const d of AI_DRONES) {
      const [dmx, dmz] = toMM(wrapHalf(d.pos.x, WW), wrapHalf(d.pos.z, WD));
      ctx.fillStyle = d.col.hex;
      ctx.beginPath();
      ctx.arc(dmx, dmz, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    // Player arrow (always shown, even in preview)
    const rawX = flyMode ? flyCam.position.x : 0;
    const rawZ = flyMode ? flyCam.position.z : 0;
    const px = wrapHalf(rawX, WW);
    const pz = wrapHalf(rawZ, WD);
    const [pmx, pmz] = toMM(px, pz);

    ctx.save();
    ctx.translate(pmx, pmz);
    // flyYaw is a world-space angle where 0 = +Z (south on minimap).
    // Canvas Y is flipped vs world Z, so convert to canvas-clockwise-from-up:
    //   atan2(-sin(yaw), -cos(yaw))  (X also mirrored)
    ctx.rotate(Math.atan2(-Math.sin(flyYaw), -Math.cos(flyYaw)));

    // Arrow body
    ctx.fillStyle = flyMode ? '#ff3333' : '#ffcc00';
    ctx.beginPath();
    ctx.moveTo(0, -8);    // nose
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

  // ═══════════════════════════════════════════════════════════════════════════
  //  RENDER LOOP
  // ═══════════════════════════════════════════════════════════════════════════
  const SPEED = 36;   // units / second  (world is 2× bigger)
  const TURN  = 2.0;  // radians / second

  let prev = performance.now();

  engine.runRenderLoop(() => {
    const now = performance.now();
    const dt  = Math.min((now - prev) / 1000, 0.05);
    prev = now;

    // Gentle water shimmer
    gWater.position.y = WATER_Y + Math.sin(now * 0.0006) * 0.35;

    if (!flyMode) {
      arcCam.alpha += dt * 0.26;
    } else {
      // ── Turn ──────────────────────────────────────────────────────────────
      if (keys['ArrowLeft'])  flyYaw -= TURN * dt;
      if (keys['ArrowRight']) flyYaw += TURN * dt;
      flyYaw += mouseDX; mouseDX = 0;

      // ── Height (W = up, S = down) ─────────────────────────────────────────
      const VSPEED = 20;
      if (keys['KeyW']) flyY = Math.min(FLY_MAX, flyY + VSPEED * dt);
      if (keys['KeyS']) flyY = Math.max(FLY_MIN, flyY - VSPEED * dt);

      // ── Horizontal move ───────────────────────────────────────────────────
      const sinY = Math.sin(flyYaw);
      const cosY = Math.cos(flyYaw);
      let nx = flyCam.position.x;
      let nz = flyCam.position.z;
      if (keys['ArrowUp'])   { nx += sinY * SPEED * dt; nz += cosY * SPEED * dt; }
      if (keys['ArrowDown']) { nx -= sinY * SPEED * dt; nz -= cosY * SPEED * dt; }

      // ── Collision — only islands whose top reaches current altitude ────────
      let blocked = false;
      for (const c of COLLIDERS) {
        if (c.topY < flyY - 4) continue;
        const dx = toroidDiff(nx, c.x, WW);
        const dz = toroidDiff(nz, c.z, WD);
        if (dx * dx + dz * dz < c.r * c.r) { blocked = true; break; }
      }
      if (!blocked) {
        flyCam.position.x = nx;
        flyCam.position.z = nz;
      }
      flyCam.position.y = flyY;

      // ── Wrap-around teleport (seamless — ghost tiles are already rendered) ─
      flyCam.position.x = wrapHalf(flyCam.position.x, WW);
      flyCam.position.z = wrapHalf(flyCam.position.z, WD);

      // ── Camera direction ──────────────────────────────────────────────────
      flyCam.setTarget(new BABYLON.Vector3(
        flyCam.position.x + sinY * 20,
        flyY,
        flyCam.position.z + cosY * 20
      ));
    }

    updateDrones(dt);
    scene.render();
    drawMinimap();
  });

  window.addEventListener('resize', () => engine.resize());
}();
