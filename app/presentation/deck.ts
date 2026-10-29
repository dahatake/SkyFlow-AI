import { localise } from './i18n';
import { createScene, FX, type Fx, type Mode } from './scene';

localise();

const slides = Array.from(document.querySelectorAll<HTMLElement>('.slide'));
const bar = document.getElementById('bar')!;
const count = document.getElementById('count')!;
const act = document.getElementById('act')!;
const modeBtns = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-mode]'));
const stage = createScene(document.getElementById('scene') as HTMLCanvasElement, document.getElementById('labels')!, document.getElementById('flash'));

slides.forEach((s) => s.querySelectorAll<HTMLElement>('.reveal').forEach((el, i) => el.style.setProperty('--i', String(i))));

let idx = -1;
function go(i: number) {
  const n = Math.max(0, Math.min(slides.length - 1, i));
  if (n === idx) return;
  idx = n;
  slides.forEach((s, k) => {
    s.classList.toggle('active', k === n);
    s.classList.toggle('past', k < n);
    s.inert = k !== n;
    s.setAttribute('aria-hidden', String(k !== n));
  });
  const s = slides[n];
  const fx = (s.dataset.fx ?? '').split(/\s+/).filter((f): f is Fx => (FX as string[]).includes(f));
  const narrow = window.innerWidth <= 1000;
  const frame: [number, number] = narrow ? [0, 0.18]
    : s.classList.contains('layout-left') ? [0.2, 0]
    : s.classList.contains('layout-right') ? [-0.2, 0]
    : s.classList.contains('layout-wide') ? [0, 0.24] : [0, 0];
  stage.setShot(s.dataset.cam ?? 'hero', fx, s.dataset.labels !== 'off', frame);
  bar.style.width = `${((n + 1) / slides.length) * 100}%`;
  count.textContent = `${String(n + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`;
  act.textContent = s.dataset.act ?? '';
  history.replaceState(null, '', `#${n + 1}`);
  const content = s.querySelector<HTMLElement>('.content');
  if (content) content.scrollTop = 0;
}

function setMode(m: Mode) {
  stage.setMode(m);
  modeBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
}
modeBtns.forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode as Mode)));

document.getElementById('prev')!.addEventListener('click', () => go(idx - 1));
document.getElementById('next')!.addEventListener('click', () => go(idx + 1));
document.getElementById('fs')?.addEventListener('click', () => {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen().catch(() => undefined);
});

window.addEventListener('keydown', (e) => {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  const tag = (e.target as HTMLElement).tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  const k = e.key;
  if (k === 'ArrowRight' || k === 'ArrowDown' || k === 'PageDown' || (k === ' ' && tag !== 'BUTTON' && tag !== 'A')) { e.preventDefault(); go(idx + 1); }
  else if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'PageUp') { e.preventDefault(); go(idx - 1); }
  else if (k === 'Home') go(0);
  else if (k === 'End') go(slides.length - 1);
  else if (k === '2') setMode('2d');
  else if (k === '3') setMode('3d');
  else if (k === '0' || k === 'a') setMode('auto');
  else if (k === 'f') document.getElementById('fs')?.click();
});

let wheelLock = 0;
let wheelAcc = 0;
window.addEventListener('wheel', (e) => {
  const sc = (e.target as HTMLElement).closest?.<HTMLElement>('.content');
  if (sc && sc.scrollHeight > sc.clientHeight + 2) {
    const atTop = sc.scrollTop <= 0;
    const atBottom = sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 2;
    if ((e.deltaY > 0 && !atBottom) || (e.deltaY < 0 && !atTop)) return;
  }
  e.preventDefault();
  const now = performance.now();
  if (now < wheelLock) return;
  wheelAcc += e.deltaY;
  if (Math.abs(wheelAcc) > 40) { go(idx + Math.sign(wheelAcc)); wheelAcc = 0; wheelLock = now + 900; }
}, { passive: false });

let touch: { x: number; y: number } | null = null;
window.addEventListener('touchstart', (e) => { touch = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }, { passive: true });
window.addEventListener('touchend', (e) => {
  if (!touch) return;
  const dx = e.changedTouches[0].clientX - touch.x, dy = e.changedTouches[0].clientY - touch.y;
  touch = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 60) return;
  const d = Math.abs(dx) > Math.abs(dy) ? dx : dy;
  go(idx + (d < 0 ? 1 : -1));
}, { passive: true });

const start = Number.parseInt(location.hash.slice(1), 10);
go(Number.isFinite(start) ? start - 1 : 0);
