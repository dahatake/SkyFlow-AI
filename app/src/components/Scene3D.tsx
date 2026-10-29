import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useOps } from '../storage/store';
import { RISK_COLOR } from './ui';
import { AIRCRAFT, LIVERY, apronTexture, buildAircraft, buildGse, buildJetBridge, buildPier, buildTower, markSelectable, worldScale } from './models3d';
import { tr, useLang } from '../i18n';

const S = 0.5; // 2D->3D scale
const pos = (x: number, y: number) => new THREE.Vector3((x - 45) * S, 0, (y - 30) * S);
const GSE_SLOT: Record<string, [number, number]> = {
  'Baggage Tractor': [3.1, 0.2], 'Catering Truck': [3.1, 2.0], 'Fuel Truck': [-3.1, 2.4], 'Pushback Tug': [-3.1, -0.4],
};
const STATUS_COLOR: Record<string, string> = { Available: '#2ea043', Engaged: '#f26522', Unavailable: '#a4262c', Reserved: '#3a8dde', Unknown: '#8a8886' };

export function Scene3D() {
  const host = useRef<HTMLDivElement>(null);
  const { view, layers, selection, related, select, logDiag } = useOps();
  const { lang } = useLang();
  const api = useRef<{ fit(ids: THREE.Vector3[]): void; reset(): void; follow: boolean } | null>(null);
  const world = useRef<THREE.Group>(new THREE.Group());
  const labelsRef = useRef<HTMLDivElement>(null);
  const labelDefs = useRef<{ p: THREE.Vector3; t: string; id: string; hi: boolean; always?: boolean }[]>([]);
  const [follow, setFollow] = useState(false);
  const [err, setErr] = useState('');
  const selRef = useRef(select);
  selRef.current = select;

  useEffect(() => {
    const el = host.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch (e) {
      setErr(tr('WebGL is not available in this browser; use the 2D view.'));
      logDiag('render-error', `WebGL init failed: ${(e as Error).message}`);
      return;
    }
    renderer.setPixelRatio(Math.min(2, devicePixelRatio));
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x9cc3e6);
    scene.fog = new THREE.Fog(0x9cc3e6, 70, 160);
    const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
    const home = { p: new THREE.Vector3(0, 30, 40), t: new THREE.Vector3(0, 0, 4) };
    cam.position.copy(home.p);
    const ctl = new OrbitControls(cam, renderer.domElement);
    ctl.enableDamping = true;
    ctl.target.copy(home.t);
    renderer.domElement.tabIndex = 0;
    ctl.listenToKeyEvents(renderer.domElement);
    ctl.maxPolarAngle = Math.PI / 2.05;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x556070, 1.25));
    const dl = new THREE.DirectionalLight(0xffffff, 1.6);
    dl.position.set(25, 45, 15);
    scene.add(dl);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 90), new THREE.MeshStandardMaterial({ map: apronTexture(), roughness: 0.95 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.02, 6);
    scene.add(ground);
    scene.add(world.current);

    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let tween: { p: THREE.Vector3; t: THREE.Vector3 } | null = null;
    const goTo = (p: THREE.Vector3, t: THREE.Vector3) => {
      if (reduce) { cam.position.copy(p); ctl.target.copy(t); } else tween = { p, t };
    };
    const state = { follow: false };
    api.current = {
      get follow() { return state.follow; }, set follow(v) { state.follow = v; },
      reset: () => goTo(home.p.clone(), home.t.clone()),
      fit: (pts) => {
        if (!pts.length) return goTo(home.p.clone(), home.t.clone());
        const box = new THREE.Box3().setFromPoints(pts);
        const c = box.getCenter(new THREE.Vector3());
        const size = Math.max(10, box.getSize(new THREE.Vector3()).length());
        goTo(c.clone().add(new THREE.Vector3(0, size * 0.8, size * 0.8)), c);
      },
    };

    const ray = new THREE.Raycaster();
    const ptr = new THREE.Vector2();
    let down = { x: 0, y: 0 };
    renderer.domElement.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }));
    renderer.domElement.addEventListener('pointerup', (e) => {
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) return;
      const r = renderer.domElement.getBoundingClientRect();
      ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ptr, cam);
      const hit = ray.intersectObjects(world.current.children, true).find((h) => h.object.userData.sel);
      if (hit) selRef.current(hit.object.userData.sel);
    });

    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight || 420;
      renderer.setSize(w, h);
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    let raf = 0;
    const v = new THREE.Vector3();
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (tween) {
        cam.position.lerp(tween.p, 0.08);
        ctl.target.lerp(tween.t, 0.08);
        if (cam.position.distanceTo(tween.p) < 0.05) tween = null;
      } else if (state.follow && world.current.userData.followPos) {
        const fp = world.current.userData.followPos as THREE.Vector3;
        const d = fp.clone().sub(ctl.target);
        ctl.target.add(d.multiplyScalar(0.1));
        cam.position.add(d);
      }
      ctl.update();
      renderer.render(scene, cam);
      const lab = labelsRef.current;
      if (lab) {
        const dist = cam.position.distanceTo(ctl.target);
        const items = labelDefs.current.filter((l) => l.hi || l.always || dist < 26);
        while (lab.children.length > items.length) lab.lastChild!.remove();
        while (lab.children.length < items.length) lab.appendChild(document.createElement('span'));
        items.forEach((l, i) => {
          v.copy(l.p).project(cam);
          const n = lab.children[i] as HTMLElement;
          n.textContent = l.t;
          n.className = l.hi ? 'lab hi' : 'lab';
          n.style.transform = `translate(${((v.x + 1) / 2) * el.clientWidth}px, ${((1 - v.y) / 2) * el.clientHeight}px)`;
          n.style.display = v.z < 1 ? '' : 'none';
        });
      }
    };
    loop();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      ctl.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [logDiag]);

  // Rebuild entity models from the shared view (same data and risk semantics as the 2D map).
  useEffect(() => {
    const g = world.current;
    g.clear();
    const b = view.b;
    const labels: typeof labelDefs.current = [];
    const add = (o: THREE.Object3D, at: THREE.Vector3, sel?: { kind: string; id: string }) => {
      o.position.add(at);
      if (sel) markSelectable(o, sel);
      g.add(o);
      return o;
    };
    const mk = (geo: THREE.BufferGeometry, color: string, at: THREE.Vector3, opacity = 1) => {
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, transparent: opacity < 1, opacity }));
      m.position.copy(at);
      g.add(m);
      return m;
    };

    // Terminal piers, jet bridges and control tower (static context).
    ['A', 'B', 'C'].forEach((pier) => {
      const st = b.stands.filter((s) => s.pier === pier);
      const c = pos((st[0].x + st[st.length - 1].x) / 2, st[0].y);
      const pierObj = buildPier(46, 2.4, pier);
      add(pierObj, new THREE.Vector3(c.x, 0, c.z - 4.6));
      labels.push({ p: new THREE.Vector3(c.x - 21, 3.4, c.z - 4.6), t: tr('Changi · Pier {p}', { p: pier }), id: `pier-${pier}`, hi: false, always: true });
    });
    if (layers.stands) b.stands.forEach((s) => {
      const p = pos(s.x, s.y);
      const hi = related.has(s.id);
      mk(new THREE.BoxGeometry(5.6, 0.05, 6.4), hi ? '#4aa3ff' : '#4a5568', p.clone().add(new THREE.Vector3(0, 0.03, 1.6)), hi ? 0.7 : 0.35).userData.sel = { kind: 'stand', id: s.id };
      add(buildJetBridge(2.2), p.clone().add(new THREE.Vector3(0.9, 0, -3.8)));
      labels.push({ p: p.clone().add(new THREE.Vector3(0, 0.3, 4.6)), t: s.stand, id: s.id, hi: false });
    });
    const tower = buildTower();
    add(tower, new THREE.Vector3(-38, 0, -20));
    labels.push({ p: new THREE.Vector3(-38, 12.4, -20), t: tr('SIOC Control Tower'), id: 'tower', hi: false, always: true });

    const visible = new Set(view.flights.map((f) => f.id));
    let follow: THREE.Vector3 | undefined;
    if (layers.flights) {
      const byStand = new Map<string, string[]>();
      b.flights.filter((f) => visible.has(f.id)).sort((x, y) => x.sta - y.sta).forEach((f) => {
        const k = view.standOf(f);
        byStand.set(k, [...(byStand.get(k) ?? []), f.id]);
      });
      byStand.forEach((ids, standId) => {
        const s = b.stands.find((x) => x.id === standId)!;
        const p = pos(s.x, s.y);
        ids.forEach((fid, idx) => {
          const f = b.flights.find((x) => x.id === fid)!;
          const ta = b.turnarounds.find((t) => t.flightId === f.id)!;
          const risk = layers.sla ? view.turnRisk(ta.id) : 'Normal';
          const al = b.airlines.find((a) => a.id === f.airlineId)!;
          const sel = { kind: 'flight', id: f.id };
          const hi = related.has(f.id);
          const spec = AIRCRAFT[LIVERY[al.code]?.aircraft ?? 'A320'];
          if (idx === 0) {
            const ac = buildAircraft(al.code);
            add(ac, p.clone().add(new THREE.Vector3(0, 0, -1.2)), sel);
            const len = spec.length * worldScale;
            const beacon = mk(new THREE.SphereGeometry(0.34, 16, 12), RISK_COLOR[risk], p.clone().add(new THREE.Vector3(0, spec.tailH * worldScale + 1.9, -1.2 + len * 0.82)));
            beacon.userData.sel = sel;
            if (hi) mk(new THREE.RingGeometry(len * 0.55, len * 0.55 + 0.25, 40).rotateX(-Math.PI / 2), '#ffffff', p.clone().add(new THREE.Vector3(0, 0.1, -1.2 + len / 2)), 0.9);
            if (selection?.id === f.id) follow = p.clone().add(new THREE.Vector3(0, 1, len / 2));
            const moved = view.moved(f);
            labels.push({ p: p.clone().add(new THREE.Vector3(0, spec.tailH * worldScale + 2.6, -1.2 + len * 0.82)), t: `${f.flightNo} · ${spec.type.replace('Airbus ', '').replace('Boeing ', '')} · ${tr(risk)}${moved ? ` · ${tr('re-gated')}` : ''}`, id: f.id, hi });
            if (moved) {
              const from = b.stands.find((x) => x.id === f.standId)!;
              const fp = pos(from.x, from.y).setY(0.3);
              g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([fp, p.clone().setY(0.3)]), new THREE.LineBasicMaterial({ color: '#ffb900' })));
            }
          } else {
            const ghost = mk(new THREE.ConeGeometry(0.5, 1.1, 12).rotateX(Math.PI), RISK_COLOR[risk], p.clone().add(new THREE.Vector3(0, 6.6 + idx * 1.2, 1.4)), 0.75);
            ghost.userData.sel = sel;
            labels.push({ p: p.clone().add(new THREE.Vector3(0, 7.5 + idx * 1.2, 1.4)), t: tr('next: {no} · {risk}', { no: f.flightNo, risk: tr(risk) }), id: f.id, hi });
          }
        });
      });
    }
    if (layers.assets) b.assets.forEach((a) => {
      const s = b.stands.find((x) => x.id === a.standId)!;
      const st = view.assetState(a.id);
      const p = pos(s.x, s.y);
      const [dx, dz] = GSE_SLOT[a.type] ?? [3, 0];
      const veh = buildGse(a.type, STATUS_COLOR[st]);
      veh.rotation.y = 0;
      add(veh, p.clone().add(new THREE.Vector3(dx, 0, dz)), { kind: 'asset', id: a.id });
      const light = mk(new THREE.SphereGeometry(0.22, 10, 8), STATUS_COLOR[st], p.clone().add(new THREE.Vector3(dx, 1.5, dz)));
      light.userData.sel = { kind: 'asset', id: a.id };
      if (related.has(a.id) || st === 'Unavailable') labels.push({ p: p.clone().add(new THREE.Vector3(dx, 2.2, dz)), t: `${tr(a.type)} · ${tr(st)}`, id: a.id, hi: related.has(a.id) });
    });
    if (layers.weather) [...b.constraints, ...view.impact.constraints].forEach((c) => {
      const st = b.stands.filter((s) => s.pier === c.scope || s.id === c.scope);
      if (!st.length) return;
      const xs = st.map((s) => s.x), y = st[0].y;
      const w = (Math.max(...xs) - Math.min(...xs) + 12) * S;
      mk(new THREE.BoxGeometry(w, 5, 12 * S), '#8764b8', pos((Math.min(...xs) + Math.max(...xs)) / 2, y + 1).setY(2.5), 0.22);
    });
    if (layers.tasks) b.tasks.filter((t) => related.has(t.id)).forEach((t, i) => {
      const f = b.flights.find((x) => x.id === b.turnarounds.find((ta) => ta.id === t.turnaroundId)!.flightId)!;
      const s = b.stands.find((x) => x.id === view.standOf(f))!;
      const st = view.taskState(t.id);
      const m = mk(new THREE.SphereGeometry(0.28), st === 'Blocked' ? '#a4262c' : st === 'AtRisk' ? '#d83b01' : '#107c10', pos(s.x - 2, s.y + 2).add(new THREE.Vector3(i * 0.7 - 1.5, 9, 0)));
      m.userData.sel = { kind: 'task', id: t.id };
    });
    if (layers.relations && selection) {
      const pts = b.stands.filter((s) => related.has(s.id)).map((s) => pos(s.x, s.y).setY(8));
      if (pts.length > 1) g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#ffffff' })));
    }
    g.userData.followPos = follow;
    labelDefs.current = labels;
  }, [view, layers, related, selection, lang]);

  const fit = () => {
    const pts = view.b.stands.filter((s) => related.has(s.id)).map((s) => pos(s.x, s.y));
    api.current?.fit(pts);
  };

  return (
    <div className="viz3d">
      <div className="toolbar" role="toolbar" aria-label={tr('3D camera controls')}>
        <button onClick={() => api.current?.reset()}>{tr('Reset overview')}</button>
        <button onClick={fit} disabled={!selection}>{tr('Fit selected')}</button>
        <button onClick={fit} disabled={!selection}>{tr('Focus stand')}</button>
        <label><input type="checkbox" checked={follow} onChange={(e) => { setFollow(e.target.checked); if (api.current) api.current.follow = e.target.checked; }} /> {tr('Follow selected')}</label>
        <span className="muted">{tr('Drag to orbit · right-drag to pan · wheel to dolly · aircraft types and liveries follow each airline; ground vehicles are exaggerated for legibility')}</span>
      </div>
      {err && <p role="alert" className="muted">{err}</p>}
      <div className="canvas-host" ref={host} role="img" aria-label={tr('3D airport operational scene synchronised with the 2D map')}>
        <div className="labels" ref={labelsRef} aria-hidden="true" />
      </div>
    </div>
  );
}
