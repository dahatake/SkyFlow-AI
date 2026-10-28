import * as THREE from 'three';

/** Real-world aircraft dimensions in metres (approximate public figures). Models are built procedurally. */
export interface AircraftSpec { type: string; length: number; span: number; fuselageR: number; tailH: number; engines: 2 | 4; sweepDeg: number; enginePos: number[] }

export const AIRCRAFT: Record<string, AircraftSpec> = {
  'A350-900': { type: 'Airbus A350-900', length: 66.8, span: 64.8, fuselageR: 3.0, tailH: 17.1, engines: 2, sweepDeg: 32, enginePos: [0.3] },
  'A380-800': { type: 'Airbus A380-800', length: 72.7, span: 79.8, fuselageR: 4.3, tailH: 24.1, engines: 4, sweepDeg: 33.5, enginePos: [0.22, 0.5] },
  '777-300ER': { type: 'Boeing 777-300ER', length: 73.9, span: 64.8, fuselageR: 3.1, tailH: 18.5, engines: 2, sweepDeg: 31.6, enginePos: [0.3] },
  '787-9': { type: 'Boeing 787-9', length: 62.8, span: 60.1, fuselageR: 2.9, tailH: 17.0, engines: 2, sweepDeg: 32.2, enginePos: [0.3] },
  'A320': { type: 'Airbus A320', length: 37.6, span: 35.8, fuselageR: 2.0, tailH: 11.8, engines: 2, sweepDeg: 25, enginePos: [0.32] },
};

export interface Livery { name: string; tail: string; accent: string; belly: string }
export const LIVERY: Record<string, Livery & { aircraft: string }> = {
  SQ: { name: 'Singapore Airlines', tail: '#1a2d63', accent: '#f0a30a', belly: '#c9ced6', aircraft: 'A350-900' },
  TR: { name: 'Scoot', tail: '#ffd100', accent: '#111111', belly: '#e7e7e7', aircraft: '787-9' },
  EK: { name: 'Emirates', tail: '#d71920', accent: '#b8975a', belly: '#d9d9d9', aircraft: '777-300ER' },
  QF: { name: 'Qantas', tail: '#e0001b', accent: '#ffffff', belly: '#d9d9d9', aircraft: 'A380-800' },
};

const M = 0.07; // world units per metre
const mat = (color: string, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.15, side: THREE.DoubleSide, ...o });

export function markSelectable(g: THREE.Object3D, sel: { kind: string; id: string }) {
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.userData.sel = sel; });
}

/** Airliner pointing towards -Z (nose to the terminal pier). Origin at the nose-wheel contact point. */
export function buildAircraft(code: string): THREE.Group {
  const lv = LIVERY[code] ?? LIVERY.SQ;
  const s = AIRCRAFT[lv.aircraft];
  const g = new THREE.Group();
  const L = s.length, r = s.fuselageR;

  // Fuselage: lathe profile with a rounded nose and tapering tail cone.
  const pts: THREE.Vector2[] = [];
  const N = 40;
  for (let i = 0; i <= N; i++) {
    const t = i / N; // 0 tail -> 1 nose
    let rad = r;
    if (t < 0.18) rad = r * (0.12 + 0.88 * Math.pow(t / 0.18, 0.7));
    else if (t > 0.93) rad = r * Math.sqrt(Math.max(0, 1 - Math.pow((t - 0.93) / 0.07, 2))) + 0.02;
    pts.push(new THREE.Vector2(rad, t * L));
  }
  const fuse = new THREE.Mesh(new THREE.LatheGeometry(pts, 24).rotateX(-Math.PI / 2), mat('#f4f6f8'));
  fuse.position.set(0, r + 2.2, L); // tail at +L, nose at 0 after rotation (y -> -z)
  g.add(fuse);
  const cheat = new THREE.Mesh(new THREE.BoxGeometry(r * 2.03, 0.35, L * 0.6), mat(lv.accent));
  cheat.position.set(0, r + 2.2 + r * 0.12, L * 0.5);
  cheat.scale.x = 1;
  g.add(cheat);
  const cockpit = new THREE.Mesh(new THREE.BoxGeometry(r * 1.2, r * 0.35, 1.6), mat('#1b2635'));
  cockpit.position.set(0, r + 2.2 + r * 0.38, r * 0.9 + 1.2);
  g.add(cockpit);

  // Swept wings (mirrored) as extruded polygons.
  const half = s.span / 2;
  const root = L * 0.2, tipChord = root * 0.28, sweep = Math.tan((s.sweepDeg * Math.PI) / 180) * half;
  const shape = new THREE.Shape();
  shape.moveTo(0, 0); shape.lineTo(half, sweep); shape.lineTo(half, sweep + tipChord); shape.lineTo(0, root); shape.lineTo(0, 0);
  const wingGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.45, bevelEnabled: false }).rotateX(Math.PI / 2);
  const wingZ = L * 0.40;
  [1, -1].forEach((sgn) => {
    const w = new THREE.Mesh(wingGeo, mat('#e9edf1'));
    w.scale.x = sgn;
    w.position.set(0, 2.2 + r * 0.45, wingZ);
    g.add(w);
    // winglet / wing tip accent
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.4, tipChord), mat(lv.tail));
    tip.position.set(sgn * (half - 0.2), 2.2 + r * 0.45 + 1.2, wingZ + sweep + tipChord / 2);
    g.add(tip);
    // engines
    s.enginePos.forEach((f) => {
      const x = sgn * half * f;
      const z = wingZ + sweep * f - 1.2;
      const eng = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.62, r * 0.55, r * 2.1, 16).rotateX(Math.PI / 2), mat('#cfd5dc'));
      eng.position.set(x, 2.2 + r * 0.25, z);
      g.add(eng);
      const inlet = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.5, r * 0.5, 0.2, 16).rotateX(Math.PI / 2), mat('#30363d'));
      inlet.position.set(x, 2.2 + r * 0.25, z - r * 1.05);
      g.add(inlet);
    });
  });

  // Tail fin in airline colour plus horizontal stabilisers.
  const fin = new THREE.Shape();
  fin.moveTo(0, 0); fin.lineTo(s.tailH * 0.55, s.tailH); fin.lineTo(s.tailH * 0.55 + L * 0.07, s.tailH); fin.lineTo(L * 0.14, 0); fin.lineTo(0, 0);
  const finMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(fin, { depth: 0.5, bevelEnabled: false }).rotateY(-Math.PI / 2).translate(0.25, 0, 0), mat(lv.tail));
  finMesh.position.set(0, r + 2.2 + r * 0.6, L - L * 0.14 - 0.6);
  finMesh.rotation.y = 0;
  g.add(finMesh);
  const stab = new THREE.Shape();
  const sh = s.span * 0.19;
  stab.moveTo(0, 0); stab.lineTo(sh, sh * 0.55); stab.lineTo(sh, sh * 0.55 + 2.4); stab.lineTo(0, L * 0.07); stab.lineTo(0, 0);
  [1, -1].forEach((sgn) => {
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(stab, { depth: 0.3, bevelEnabled: false }).rotateX(Math.PI / 2), mat('#e9edf1'));
    m.scale.x = sgn;
    m.position.set(0, r + 2.2 + 0.4, L - L * 0.13 - 0.4);
    g.add(m);
  });
  // nose and main gear
  [[0, r * 0.9, 1.5], [-3.2, 0, 2.4], [3.2, 0, 2.4]].forEach(([x, , z], i) => {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.8, 12).rotateZ(Math.PI / 2), mat('#222'));
    wheel.position.set(x, 1.1, i === 0 ? r : wingZ + 4 + z);
    g.add(wheel);
  });
  g.scale.setScalar(M);
  g.position.z = 0; // nose at origin; caller offsets
  g.userData.lengthWorld = L * M;
  g.userData.spec = s;
  return g;
}

/** Ground support equipment built from primitives, deliberately exaggerated in size for legibility. */
export function buildGse(type: string, accent = '#f26522'): THREE.Group {
  const g = new THREE.Group();
  const wheel = (x: number, z: number, r = 0.45) => {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.4, 10).rotateZ(Math.PI / 2), mat('#1c1c1c'));
    w.position.set(x, r, z);
    g.add(w);
  };
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, c: string) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c));
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };
  if (type === 'Baggage Tractor') {
    box(1.3, 0.8, 2, 0, 0.8, 0, accent);
    box(1.2, 0.7, 0.9, 0, 1.55, -0.4, '#2b3a4d');
    [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]].forEach(([x, z]) => wheel(x, z));
    [2.6, 5.2].forEach((z) => { box(1.6, 0.2, 2.2, 0, 0.7, z, '#8a949e'); box(1.5, 0.6, 2.0, 0, 1.1, z, '#c3862b'); wheel(-0.8, z + 0.7, 0.3); wheel(0.8, z + 0.7, 0.3); });
  } else if (type === 'Fuel Truck') {
    box(1.5, 0.7, 6.5, 0, 0.8, 1, '#444b54');
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 4.6, 18).rotateX(Math.PI / 2), mat('#e8eaed'));
    tank.position.set(0, 1.9, 1.5);
    g.add(tank);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.97, 0.97, 0.5, 18).rotateX(Math.PI / 2), mat('#c8102e'));
    band.position.set(0, 1.9, 1.5);
    g.add(band);
    box(1.4, 1.3, 1.2, 0, 1.4, -1.9, accent);
    [-2, 0.5, 3].forEach((z) => { wheel(-0.8, z, 0.5); wheel(0.8, z, 0.5); });
  } else if (type === 'Catering Truck') {
    box(1.6, 0.6, 6, 0, 0.7, 0, '#59636e');
    box(2.1, 2.3, 3.8, 0, 2.2, 0.9, '#e6e9ec');
    box(2.12, 0.4, 3.8, 0, 3.4, 0.9, accent);
    box(1.5, 1.2, 1.3, 0, 1.4, -2.3, '#2b3a4d');
    [-2, 2].forEach((z) => { wheel(-0.9, z, 0.5); wheel(0.9, z, 0.5); });
  } else {
    // Pushback tug
    box(1.7, 0.7, 4, 0, 0.7, 0, '#4b5560');
    box(1.4, 0.8, 1.6, 0, 1.4, 0.2, accent);
    box(1.5, 0.2, 0.6, 0, 0.6, -2.3, '#222');
    [[-0.9, -1.4], [0.9, -1.4], [-0.9, 1.4], [0.9, 1.4]].forEach(([x, z]) => wheel(x, z, 0.55));
  }
  g.scale.setScalar(M * 3.2);
  return g;
}

/** Terminal pier with glass facade, roof plant and jet bridges. */
export function buildPier(width: number, depth: number, name: string): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(width, 2.4, depth), mat('#8b97a6'));
  body.position.y = 1.2;
  g.add(body);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(width + 0.05, 1.3, depth + 0.05), mat('#6fb6e8', { transparent: true, opacity: 0.55, metalness: 0.6, roughness: 0.15 }));
  glass.position.y = 1.35;
  g.add(glass);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(width + 0.4, 0.25, depth + 0.4), mat('#e5e8ec'));
  roof.position.y = 2.5;
  g.add(roof);
  g.userData.name = name;
  return g;
}

export function buildJetBridge(len: number): THREE.Group {
  const g = new THREE.Group();
  const tube = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.6, len), mat('#c7ced6'));
  tube.position.set(0, 1.35, len / 2);
  g.add(tube);
  const cab = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.7, 12), mat('#9aa5b1'));
  cab.position.set(0, 1.3, len);
  g.add(cab);
  return g;
}

export function buildTower(): THREE.Group {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1, 9, 16), mat('#d9dde2'));
  shaft.position.y = 4.5;
  g.add(shaft);
  const cab = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.4, 1.6, 16), mat('#6fb6e8', { transparent: true, opacity: 0.75, metalness: 0.5 }));
  cab.position.y = 9.8;
  g.add(cab);
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 0.2, 16), mat('#e5e8ec'));
  roof.position.y = 10.7;
  g.add(roof);
  return g;
}

export function apronTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const x = c.getContext('2d')!;
  x.fillStyle = '#2f3947';
  x.fillRect(0, 0, 512, 512);
  x.strokeStyle = '#3b4658';
  x.lineWidth = 2;
  for (let i = 0; i < 512; i += 64) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 512); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(512, i); x.stroke(); }
  x.strokeStyle = '#d9b100';
  x.lineWidth = 5;
  x.setLineDash([24, 14]);
  x.beginPath(); x.moveTo(0, 256); x.lineTo(512, 256); x.stroke();
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 3);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export const worldScale = M;
