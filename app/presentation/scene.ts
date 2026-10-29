import * as THREE from 'three';

/** Stylised Changi-like airport used as the living backdrop of the presentation decks. */

export type Fx = 'storm' | 'delays' | 'conflicts' | 'resolve' | 'flow' | 'layers' | 'whatif' | 'gse';
export const FX: Fx[] = ['storm', 'delays', 'conflicts', 'resolve', 'flow', 'layers', 'whatif', 'gse'];
export type CamSpec = { tx: number; ty: number; tz: number; dist: number; phi: number; theta: number; fov: number; orbit: number };
export type Mode = 'auto' | '2d' | '3d';

const DEG = Math.PI / 180;
const C = { green: 0x30d158, amber: 0xff9f0a, red: 0xff453a, blue: 0x2997ff, purple: 0xbf5af2, teal: 0x40c8e0, pink: 0xff375f, grey: 0x8e8e93 };
const TERMS = [-75, -25, 25, 75];
const TOWER = new THREE.Vector3(0, 0, 52);
const TOWER_TOP = new THREE.Vector3(0, 30, 52);

function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.25, 'rgba(255,255,255,.6)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

type Stand = {
  x: number; z: number; rot: number; t: number; occupied: boolean; delayed: boolean; conflict: boolean;
  base: THREE.Color; ring?: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
};
type Label = { el: HTMLDivElement; pos: THREE.Vector3; vis: () => number };

export const PRESETS: Record<string, CamSpec> = {
  hero: { tx: 0, ty: 0, tz: 0, dist: 250, phi: 60, theta: 35, fov: 40, orbit: 2.5 },
  wide: { tx: 0, ty: 0, tz: 0, dist: 360, phi: 50, theta: -35, fov: 38, orbit: 2 },
  top: { tx: 0, ty: 0, tz: 0, dist: 1050, phi: 0.5, theta: 0, fov: 13, orbit: 0 },
  pier: { tx: -25, ty: 0, tz: -16, dist: 80, phi: 60, theta: 30, fov: 40, orbit: 1.5 },
  stand: { tx: -25, ty: 0, tz: -18, dist: 42, phi: 58, theta: -35, fov: 38, orbit: 1.2 },
  tower: { tx: 0, ty: 16, tz: 52, dist: 100, phi: 74, theta: 200, fov: 42, orbit: 2 },
  layers: { tx: 0, ty: 50, tz: 0, dist: 360, phi: 76, theta: 25, fov: 36, orbit: 1.5 },
  low: { tx: 0, ty: 3, tz: 70, dist: 75, phi: 84, theta: 100, fov: 50, orbit: 2 },
  storm: { tx: -25, ty: 0, tz: -12, dist: 130, phi: 55, theta: -20, fov: 45, orbit: 1 },
};

export function createScene(canvas: HTMLCanvasElement, labelRoot: HTMLElement, flashEl: HTMLElement | null) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  const BG = new THREE.Color(0x02040a);
  const STORM_BG = new THREE.Color(0x0b1224);
  scene.background = BG.clone();
  const fog = new THREE.FogExp2(0x02040a, 0.002);
  scene.fog = fog;
  const camera = new THREE.PerspectiveCamera(40, 1, 1, 6000);
  const hemi = new THREE.HemisphereLight(0xb5d3ff, 0x1a2333, 1.3);
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(120, 200, 80);
  scene.add(hemi, sun);
  const glow = glowTexture();
  const rand = rng(42);
  const additive = (color: number, opacity = 0) =>
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });

  // Ground, aprons, runways, taxiways
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1000), new THREE.MeshStandardMaterial({ color: 0x0d1420, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  const grid = new THREE.GridHelper(700, 70, 0x24344d, 0x152033);
  grid.position.y = 0.02;
  scene.add(grid);
  const apronMat = new THREE.MeshStandardMaterial({ color: 0x1a2536, roughness: 0.9 });
  TERMS.forEach((cx) => {
    const a = new THREE.Mesh(new THREE.PlaneGeometry(40, 84), apronMat);
    a.rotation.x = -Math.PI / 2;
    a.position.set(cx, 0.04, 0);
    scene.add(a);
  });
  const stripMat = new THREE.MeshStandardMaterial({ color: 0x232c3d, roughness: 0.8 });
  const dashGeo = new THREE.BoxGeometry(2.4, 0.04, 0.3);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xdfe6f2 });
  const lightPos: number[] = [];
  for (const z of [-70, 70]) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(260, 8), stripMat);
    r.rotation.x = -Math.PI / 2;
    r.position.set(0, 0.06, z);
    scene.add(r);
    const dashes = new THREE.InstancedMesh(dashGeo, dashMat, 40);
    const m = new THREE.Object3D();
    for (let i = 0; i < 40; i++) { m.position.set(-120 + i * 6.2, 0.1, z); m.updateMatrix(); dashes.setMatrixAt(i, m.matrix); }
    scene.add(dashes);
    for (let x = -130; x <= 130; x += 4) lightPos.push(x, 0.4, z - 4.2, x, 0.4, z + 4.2);
  }
  for (const z of [-50, 50]) {
    const tw = new THREE.Mesh(new THREE.PlaneGeometry(230, 3), stripMat);
    tw.rotation.x = -Math.PI / 2;
    tw.position.set(0, 0.05, z);
    scene.add(tw);
    for (let x = -112; x <= 112; x += 3) lightPos.push(x, 0.3, z);
  }
  const lightGeo = new THREE.BufferGeometry();
  lightGeo.setAttribute('position', new THREE.Float32BufferAttribute(lightPos, 3));
  scene.add(new THREE.Points(lightGeo, new THREE.PointsMaterial({ color: 0xffc66b, size: 1.4, map: glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));

  // Terminals and piers
  const termMat = new THREE.MeshStandardMaterial({ color: 0x1c2738, roughness: 0.5, metalness: 0.3, emissive: 0x12305c, emissiveIntensity: 0.9 });
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x4aa3ff, transparent: true, opacity: 0.7 });
  const box = (w: number, h: number, d: number, x: number, z: number) => {
    const g = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(g, termMat);
    mesh.position.set(x, h / 2, z);
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(g), edgeMat);
    e.position.copy(mesh.position);
    scene.add(mesh, e);
  };
  TERMS.forEach((cx) => { box(34, 7, 12, cx, 0); box(3, 3, 30, cx, -21); box(3, 3, 30, cx, 21); });

  // Stands and aircraft
  const stands: Stand[] = [];
  TERMS.forEach((cx, t) => {
    for (const dir of [-1, 1]) for (const side of [-1, 1]) for (const k of [0, 1, 2]) {
      stands.push({ x: cx + side * 7, z: dir * (10 + k * 8.5), rot: side > 0 ? -Math.PI / 2 : Math.PI / 2, t, occupied: t === 1 || rand() < 0.8, delayed: false, conflict: false, base: new THREE.Color(C.green) });
    }
  });
  const occupied = stands.filter((s) => s.occupied);
  const order = occupied.map((s) => ({ s, k: (s.t === 1 ? 0 : s.t === 0 ? 1 : 2) + rand() * 0.9 })).sort((a, b) => a.k - b.k);
  order.slice(0, 12).forEach(({ s }) => (s.delayed = true));
  stands.filter((s) => s.delayed && s.t === 1 && s.z < 0).slice(0, 4).forEach((s) => (s.conflict = true));
  occupied.forEach((s) => { if (!s.delayed && rand() < 0.15) s.base.set(C.amber); });

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xe9edf4, roughness: 0.4, metalness: 0.25 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x2997ff, roughness: 0.5, emissive: 0x0a3a80, emissiveIntensity: 0.5 });
  const fus = new THREE.CylinderGeometry(0.55, 0.45, 7, 12).rotateX(Math.PI / 2);
  const nose = new THREE.SphereGeometry(0.55, 12, 8).translate(0, 0, 3.5);
  const wing = new THREE.BoxGeometry(7.4, 0.12, 1.3).translate(0, -0.1, 0.3);
  const stab = new THREE.BoxGeometry(2.8, 0.1, 0.7).translate(0, 0.2, -3.1);
  const fin = new THREE.BoxGeometry(0.12, 1.6, 1.1).translate(0, 0.9, -3);
  const ringGeo = new THREE.RingGeometry(4.2, 5.1, 48);
  for (const s of occupied) {
    const g = new THREE.Group();
    [fus, nose, wing, stab].forEach((geo) => { const m = new THREE.Mesh(geo, bodyMat); m.position.y = 1.1; g.add(m); });
    const f = new THREE.Mesh(fin, tailMat); f.position.y = 1.1; g.add(f);
    g.position.set(s.x, 0, s.z);
    g.rotation.y = s.rot;
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: s.base, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(s.x, 0.12, s.z);
    s.ring = ring;
    scene.add(g, ring);
  }
  const conflicts = stands.filter((s) => s.conflict);
  const focus = conflicts[0] ?? stands[0];
  PRESETS.stand = { ...PRESETS.stand, tx: focus.x, tz: focus.z };

  const beamGeo = new THREE.CylinderGeometry(1.6, 1.6, 44, 24, 1, true).translate(0, 22, 0);
  const beams = conflicts.map((s) => {
    const b = new THREE.Mesh(beamGeo, additive(C.red));
    b.position.set(s.x, 0, s.z);
    scene.add(b);
    return b;
  });

  // Control tower
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.9, 24, 16), new THREE.MeshStandardMaterial({ color: 0x2a3446, roughness: 0.6 }));
  shaft.position.set(TOWER.x, 12, TOWER.z);
  const cab = new THREE.Mesh(new THREE.CylinderGeometry(4, 3, 3.6, 24), new THREE.MeshStandardMaterial({ color: 0x0b2a33, emissive: C.teal, emissiveIntensity: 1.3 }));
  cab.position.set(TOWER.x, 25.8, TOWER.z);
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 0.6, 24), new THREE.MeshStandardMaterial({ color: 0x2a3446 }));
  roof.position.set(TOWER.x, 27.9, TOWER.z);
  const beacon = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: C.teal, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  beacon.position.copy(TOWER_TOP);
  beacon.scale.setScalar(22);
  scene.add(shaft, cab, roof, beacon);

  // GSE vehicles circulating around each terminal
  const GSE_N = 72;
  const gse = new THREE.InstancedMesh(new THREE.BoxGeometry(1.3, 0.7, 0.9), new THREE.MeshStandardMaterial({ color: 0xffb340, emissive: 0xff9f0a, emissiveIntensity: 0.5 }), GSE_N);
  const gseState = Array.from({ length: GSE_N }, (_, i) => ({ t: i % 4, u: rand(), v: 0.012 + rand() * 0.02 }));
  scene.add(gse);
  const dummy = new THREE.Object3D();
  const perim = (cx: number, u: number, out: THREE.Object3D) => {
    const hx = 12.5, hz = 39;
    let d = (u % 1) * 4 * (hx + hz);
    const legs: [number, number, number, number][] = [[-hx, -hz, 1, 0], [hx, -hz, 0, 1], [hx, hz, -1, 0], [-hx, hz, 0, -1]];
    for (const [x0, z0, dx, dz] of legs) {
      const len = dx ? 2 * hx : 2 * hz;
      if (d <= len) { out.position.set(cx + x0 + dx * d, 0.45, z0 + dz * d); out.rotation.y = Math.atan2(dx, dz); return; }
      d -= len;
    }
  };

  // Shared particle-flow helper (data streams, owner routing)
  function makeFlow(curves: THREE.Curve<THREE.Vector3>[], colors: number[], per: number, size: number) {
    const group = new THREE.Group();
    const lineMats = curves.map((c, i) => {
      const mat = new THREE.LineBasicMaterial({ color: colors[i % colors.length], transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(c.getPoints(60)), mat));
      return mat;
    });
    const n = curves.length * per;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const tmp = new THREE.Color();
    for (let i = 0; i < n; i++) { tmp.set(colors[Math.floor(i / per) % colors.length]); col.set([tmp.r, tmp.g, tmp.b], i * 3); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({ size, map: glow, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    group.add(new THREE.Points(geo, mat));
    scene.add(group);
    const p = new THREE.Vector3();
    return (time: number, lvl: number) => {
      group.visible = lvl > 0.01;
      if (!group.visible) return;
      lineMats.forEach((m) => (m.opacity = 0.35 * lvl));
      mat.opacity = lvl;
      for (let i = 0; i < n; i++) {
        curves[Math.floor(i / per)].getPoint((time * 0.18 + (i % per) / per) % 1, p);
        pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
      }
      geo.attributes.position.needsUpdate = true;
    };
  }
  const arc = (a: THREE.Vector3, b: THREE.Vector3, h: number) =>
    new THREE.QuadraticBezierCurve3(a, new THREE.Vector3((a.x + b.x) / 2, Math.max(a.y, b.y) + h, (a.z + b.z) / 2), b);

  // Data sources streaming into one platform ("surround, not replace")
  const SOURCES = ['GroundStar', 'G-Ops · Mosaic · DSM', 'CAG turnaround events', 'iFleet · GSE', 'BRS baggage', 'Weather · airline SLAs'];
  const srcColors = [C.blue, C.purple, C.teal, C.amber, C.pink, C.green];
  const srcPos = SOURCES.map((_, i) => { const a = (i / SOURCES.length) * Math.PI * 2 + 0.3; return new THREE.Vector3(Math.cos(a) * 150, 0, Math.sin(a) * 105); });
  const pillarGeo = new THREE.CylinderGeometry(2.2, 2.2, 20, 20, 1, true).translate(0, 10, 0);
  const pillars = srcPos.map((p, i) => { const m = new THREE.Mesh(pillarGeo, additive(srcColors[i])); m.position.copy(p); scene.add(m); return m; });
  const flowSources = makeFlow(srcPos.map((p) => arc(p.clone().setY(20), TOWER_TOP, 60)), srcColors, 26, 3.2);
  const flowOwners = makeFlow(conflicts.map((s) => arc(new THREE.Vector3(s.x, 3, s.z), TOWER_TOP, 30)), [C.green], 14, 2.6);

  // Architecture layers floating over the airport
  const LAYERS: [string, number][] = [['Sources', C.grey], ['Ingest · Eventstreams · Data Factory', C.teal], ['Microsoft Fabric · OneLake · Eventhouse · Activator', C.blue], ['Experiences · Power BI · Teams · Copilot', C.purple], ['Users · Executives · SIOC · BU Ops · Ramp', 0x64d2ff]];
  const layerMats = LAYERS.map(([, color], i) => {
    const g = new THREE.PlaneGeometry(270, 180);
    const m = additive(color);
    const mesh = new THREE.Mesh(g, m);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 22 + i * 20;
    const em = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0 });
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(g), em);
    edge.rotation.x = -Math.PI / 2;
    edge.position.y = mesh.position.y;
    scene.add(mesh, edge);
    return [m, em] as const;
  });
  const upN = 160;
  const upPos = new Float32Array(upN * 3);
  const upSeed = Array.from({ length: upN }, () => [rand() * 250 - 125, rand() * 160 - 80, rand()]);
  const upGeo = new THREE.BufferGeometry();
  upGeo.setAttribute('position', new THREE.BufferAttribute(upPos, 3));
  const upMat = new THREE.PointsMaterial({ size: 2.4, map: glow, color: 0x8fd0ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const upPts = new THREE.Points(upGeo, upMat);
  scene.add(upPts);

  // What-if: scenario overlay beside the untouched baseline
  const whatGeo = new THREE.PlaneGeometry(130, 180);
  const whatMat = additive(C.amber);
  const what = new THREE.Mesh(whatGeo, whatMat);
  what.rotation.x = -Math.PI / 2;
  what.position.set(-65, 0.3, 0);
  const whatEdgeMat = new THREE.LineBasicMaterial({ color: C.amber, transparent: true, opacity: 0 });
  const whatEdge = new THREE.LineSegments(new THREE.EdgesGeometry(whatGeo), whatEdgeMat);
  whatEdge.rotation.x = -Math.PI / 2;
  whatEdge.position.copy(what.position);
  scene.add(what, whatEdge);

  // Storm: rain streaks and lightning
  const RAIN = 2600;
  const rain = new Float32Array(RAIN * 6);
  for (let i = 0; i < RAIN; i++) {
    const x = rand() * 320 - 160, y = rand() * 140, z = rand() * 240 - 120;
    rain.set([x, y, z, x + 0.4, y + 3, z], i * 6);
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rain, 3));
  const rainMat = new THREE.LineBasicMaterial({ color: 0xa9c1ff, transparent: true, opacity: 0, depthWrite: false });
  const rainLines = new THREE.LineSegments(rainGeo, rainMat);
  scene.add(rainLines);

  // Labels projected from 3D positions into the DOM
  const level: Record<Fx, number> = { storm: 0, delays: 0, conflicts: 0, resolve: 0, flow: 0, layers: 0, whatif: 0, gse: 0 };
  const goalFx: Record<Fx, number> = { ...level };
  let labelMaster = 1;
  let labelGoal = 1;
  const shift = { x: 0, y: 0, gx: 0, gy: 0 };
  const labels: Label[] = [];
  const label = (text: string, pos: THREE.Vector3, vis: () => number, cls = '') => {
    const el = document.createElement('div');
    el.className = `lbl ${cls}`;
    el.textContent = text;
    labelRoot.appendChild(el);
    labels.push({ el, pos, vis });
  };
  TERMS.forEach((cx, i) => label(`T${i + 1}`, new THREE.Vector3(cx, 11, 0), () => 1 - Math.max(level.layers, level.flow * 0.8)));
  label('Control tower', TOWER_TOP.clone().setY(34), () => 1 - Math.max(level.layers, level.flow), 'teal');
  label('Microsoft Fabric · OneLake', TOWER_TOP.clone().setY(38), () => level.flow, 'blue big');
  SOURCES.forEach((s, i) => label(s, srcPos[i].clone().setY(26), () => level.flow));
  LAYERS.forEach(([s], i) => label(s, new THREE.Vector3(-135, 22 + i * 20, 90), () => level.layers, 'big'));
  conflicts.forEach((s, i) => label(`Gate conflict ${i + 1}`, new THREE.Vector3(s.x, 12, s.z), () => level.conflicts * (1 - level.resolve), 'red'));
  conflicts.forEach((s) => label('Owner assigned · Teams ✓', new THREE.Vector3(s.x, 12, s.z), () => level.resolve, 'green'));
  label('Baseline · untouched', new THREE.Vector3(65, 4, 0), () => level.whatif, 'big');
  label('Scenario · simulated', new THREE.Vector3(-65, 4, 0), () => level.whatif, 'amber big');

  // Camera rig
  let mode: Mode = 'auto';
  let goal: CamSpec = PRESETS.hero;
  const cur: CamSpec = { ...PRESETS.hero, dist: 2200, phi: 8, theta: -60 };
  let orbitAcc = 0, userTheta = 0, userPhi = 0, dragging = false;
  const is2D = () => mode === '2d' || (mode === 'auto' && goal.phi < 2);
  const effective = (): CamSpec => {
    if (mode === '2d') {
      if (goal.phi < 2) return goal;
      const dist = Math.max(260, (goal.dist * Math.tan((goal.fov * DEG) / 2)) / Math.tan(6.5 * DEG));
      return { ...goal, ty: 0, phi: 0.5, theta: 0, fov: 13, dist, orbit: 0 };
    }
    if (mode === '3d' && goal.phi < 2) return { ...PRESETS.hero, tx: goal.tx, tz: goal.tz };
    return goal;
  };

  canvas.addEventListener('pointerdown', (e) => { dragging = true; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointerup', () => (dragging = false));
  canvas.addEventListener('pointercancel', () => (dragging = false));
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging || is2D()) return;
    userTheta -= e.movementX * 0.25;
    userPhi = Math.max(-50, Math.min(25, userPhi - e.movementY * 0.2));
  });

  const resize = () => {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize);
  resize();

  const red = new THREE.Color(C.red), green = new THREE.Color(C.green), amber = new THREE.Color(C.amber), tmpC = new THREE.Color();
  const target = new THREE.Vector3();
  const v = new THREE.Vector3();
  let flash = 0;
  let last = performance.now();
  let time = 0;

  function frame(now: number) {
    const dt = Math.min(0.2, Math.max(0, (now - last) / 1000));
    last = now;
    time += dt;
    const kf = 1 - Math.exp(-dt * (reduce ? 8 : 2.2));
    FX.forEach((f) => (level[f] += (goalFx[f] - level[f]) * kf));
    labelMaster += (labelGoal - labelMaster) * kf;
    shift.x += (shift.gx - shift.x) * kf;
    shift.y += (shift.gy - shift.y) * kf;

    // Camera tween: log-space dolly plus FOV change produces a dolly-zoom between 2D and 3D.
    const e = effective();
    const k = 1 - Math.exp(-dt * (reduce ? 6 : 1.5));
    if (!dragging && !reduce) orbitAcc += e.orbit * dt;
    const flat = is2D();
    const thGoal = flat ? e.theta : e.theta + orbitAcc + userTheta;
    const dTh = ((((thGoal - cur.theta) % 360) + 540) % 360) - 180;
    cur.theta += dTh * k;
    cur.phi += (Math.max(0.5, Math.min(88, e.phi + (flat ? 0 : userPhi))) - cur.phi) * k;
    cur.dist = Math.exp(Math.log(cur.dist) + (Math.log(e.dist) - Math.log(cur.dist)) * k);
    cur.fov += (e.fov - cur.fov) * k;
    cur.tx += (e.tx - cur.tx) * k; cur.ty += (e.ty - cur.ty) * k; cur.tz += (e.tz - cur.tz) * k;
    target.set(cur.tx, cur.ty, cur.tz);
    const ph = cur.phi * DEG, th = cur.theta * DEG;
    camera.position.set(target.x + cur.dist * Math.sin(ph) * Math.sin(th), target.y + cur.dist * Math.cos(ph), target.z + cur.dist * Math.sin(ph) * Math.cos(th));
    camera.fov = cur.fov;
    // Re-frame the scene away from the slide copy (positive x moves it right, positive y moves it up).
    const vw = window.innerWidth, vh = window.innerHeight;
    camera.setViewOffset(vw, vh, -shift.x * vw, shift.y * vh, vw, vh);
    camera.updateProjectionMatrix();
    camera.lookAt(target);
    fog.density = (0.45 + level.storm * 0.35) / Math.max(cur.dist, 60);

    // Storm
    rainLines.visible = level.storm > 0.01;
    rainMat.opacity = 0.45 * level.storm;
    if (rainLines.visible && !reduce) {
      for (let i = 0; i < RAIN; i++) {
        let y = rain[i * 6 + 1] - 110 * dt;
        if (y < 0) y += 140;
        rain[i * 6 + 1] = y; rain[i * 6 + 4] = y + 3;
      }
      rainGeo.attributes.position.needsUpdate = true;
    }
    if (!reduce && level.storm > 0.6 && Math.random() < dt * 0.4) flash = 1;
    flash *= Math.exp(-dt * 7);
    hemi.intensity = 1.3 - 0.45 * level.storm + flash * 3.5;
    sun.intensity = 1.6 * (1 - 0.6 * level.storm);
    (scene.background as THREE.Color).copy(BG).lerp(STORM_BG, Math.min(1, level.storm * 0.6 + flash * 0.4));
    if (flashEl) flashEl.style.opacity = String(flash * 0.35);

    // Aircraft status rings
    for (const s of stands) {
      if (!s.ring) continue;
      tmpC.copy(s.base);
      if (s.delayed) {
        tmpC.lerp(amber, level.whatif).lerp(red, level.delays).lerp(green, level.resolve);
        s.ring.scale.setScalar(1 + 0.14 * Math.sin(time * 4 + s.x) * Math.max(level.delays, level.whatif) * (1 - level.resolve));
      }
      s.ring.material.color.copy(tmpC);
    }
    const beamLvl = Math.max(level.conflicts, level.resolve);
    beams.forEach((b, i) => {
      b.visible = beamLvl > 0.01;
      b.material.color.copy(red).lerp(green, level.resolve);
      b.material.opacity = (0.4 + 0.18 * Math.sin(time * 5 + i)) * level.conflicts * (1 - level.resolve) + 0.22 * level.resolve;
      b.scale.y = 0.15 + 0.85 * beamLvl;
    });
    beacon.material.opacity = 0.7 + 0.3 * Math.sin(time * 2.5);

    // GSE
    const gseScale = 1 + level.gse * 0.8;
    gseState.forEach((g, i) => {
      if (!reduce) g.u += g.v * dt;
      perim(TERMS[g.t], g.u, dummy);
      dummy.scale.setScalar(gseScale);
      dummy.updateMatrix();
      gse.setMatrixAt(i, dummy.matrix);
    });
    gse.instanceMatrix.needsUpdate = true;

    // Flows and layers
    flowSources(time, level.flow);
    flowOwners(time, level.resolve);
    pillars.forEach((p) => { p.visible = level.flow > 0.01; p.material.opacity = 0.5 * level.flow; });
    layerMats.forEach(([m, em], i) => { m.opacity = 0.07 * level.layers * (i === 2 ? 1.8 : 1); em.opacity = 0.75 * level.layers; });
    upPts.visible = level.layers > 0.01;
    upMat.opacity = level.layers;
    if (upPts.visible) {
      upSeed.forEach(([x, z, o], i) => upPos.set([x, ((time * 0.12 + o) % 1) * 100 + 10, z], i * 3));
      upGeo.attributes.position.needsUpdate = true;
    }
    whatMat.opacity = 0.1 * level.whatif;
    whatEdgeMat.opacity = 0.8 * level.whatif;

    renderer.render(scene, camera);

    // Labels
    const w = window.innerWidth, h = window.innerHeight;
    for (const l of labels) {
      const o = l.vis() * labelMaster;
      if (o < 0.02) { l.el.style.opacity = '0'; continue; }
      v.copy(l.pos).project(camera);
      if (v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) { l.el.style.opacity = '0'; continue; }
      l.el.style.opacity = String(Math.min(1, o));
      l.el.style.transform = `translate(${(v.x * 0.5 + 0.5) * w}px, ${(-v.y * 0.5 + 0.5) * h}px) translate(-50%, -100%)`;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return {
    setShot(cam: string, fx: Fx[], showLabels = true, frame: [number, number] = [0, 0]) {
      shift.gx = frame[0];
      shift.gy = frame[1];
      goal = PRESETS[cam] ?? PRESETS.hero;
      FX.forEach((f) => (goalFx[f] = fx.includes(f) ? 1 : 0));
      labelGoal = showLabels ? 1 : 0;
      userTheta = 0;
      userPhi = 0;
    },
    setMode(m: Mode) { mode = m; },
  };
}
