// "From a thought to a treasure" - the pinned scroll story.
// Pencil sketch (traced from the real 3D ring) -> watercolour -> blueprint ->
// the 3D ring is built: wireframe, wax, molten gold, stone set, polished.
// Every visual is a pure function of scroll progress p (0..1).

export const STORY_CFG = { style: 'solitaire', metal: 'yellow', karat: 18, stone: 'emerald', cut: 'emerald' };
export const STORY_POSE = { pitch: 0.46, yaw: -0.72 };

const clamp01 = v => Math.min(1, Math.max(0, v));
const seg = (p, a, b) => clamp01((p - a) / (b - a));
const ease = t => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;

// scroll -> build keyframes (each chapter gets a fair share of the scroll)
const BUILD_KEYS = [[0.5, 0], [0.585, 0.2], [0.665, 0.34], [0.78, 0.62], [0.875, 0.82], [0.975, 1]];
function buildAt(p) {
  if (p <= BUILD_KEYS[0][0]) return 0;
  for (let i = 1; i < BUILD_KEYS.length; i++) {
    const [p1, b1] = BUILD_KEYS[i], [p0, b0] = BUILD_KEYS[i - 1];
    if (p <= p1) return lerp(b0, b1, (p - p0) / (p1 - p0));
  }
  return 1;
}

export const CHAPTERS = [0, 0.22, 0.42, 0.585, 0.665, 0.78, 0.875]; // starts

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  parent?.appendChild(e);
  return e;
};

// deterministic noise for the hand-drawn wobble
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function wobble(pts, amp, seed) {
  const r = rng(seed);
  const a1 = r() * 6.28, a2 = r() * 6.28, f1 = 0.012 + r() * 0.01, f2 = 0.031 + r() * 0.02;
  let d = 0;
  return pts.map((p, i) => {
    if (i) d += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]);
    const o = (Math.sin(d * f1 + a1) + 0.5 * Math.sin(d * f2 + a2)) * amp;
    const q = pts[Math.min(pts.length - 1, i + 1)], pr = pts[Math.max(0, i - 1)];
    let nx = -(q[1] - pr[1]), ny = q[0] - pr[0];
    const l = Math.hypot(nx, ny) || 1;
    return [p[0] + (nx / l) * o, p[1] + (ny / l) * o];
  });
}

function pathD(pts) {
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) d += `L${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)}`;
  return d;
}
const polyLen = pts => { let l = 0; for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return l; };

function offsetLine(pts, off) {
  return pts.map((p, i) => {
    const q = pts[Math.min(pts.length - 1, i + 1)], pr = pts[Math.max(0, i - 1)];
    let nx = -(q[1] - pr[1]), ny = q[0] - pr[0];
    const l = Math.hypot(nx, ny) || 1;
    return [p[0] + (nx / l) * off, p[1] + (ny / l) * off];
  });
}

export class Making {
  constructor({ root, studio, isMobile, reduced }) {
    this.root = root; this.studio = studio; this.isMobile = isMobile; this.reduced = reduced;
    this.stage = root.querySelector('.mk-stage');
    this.glHost = root.querySelector('.mk-gl');
    this.svg = root.querySelector('.mk-svg');
    this.canvas = root.querySelector('.mk-paint');
    this.pencil = root.querySelector('.mk-pencil');
    this.brush = root.querySelector('.mk-brush');
    this.grid = root.querySelector('.mk-grid');
    this.chapters = [...root.querySelectorAll('.mk-chapter')];
    this.dots = [...root.querySelectorAll('.mk-rail i')];
    this.fill = root.querySelector('.mk-rail b');
    this.finale = root.querySelector('.mk-finale');
    this.p = -1;
    this.ready = false;
  }

  frameFor(w, h) {
    // ring sits in the upper part on phones (captions below), centre-right on desktop
    return w < 760 ? { cx: 0.5, cy: 0.4, fit: 0.66 } : { cx: 0.6, cy: 0.5, fit: 0.66 };
  }

  // Build the drawing for the current stage size. Called at idle time and on resize.
  prepare() {
    const w = this.stage.clientWidth, h = this.stage.clientHeight;
    if (!w || !h) return;
    this.w = w; this.h = h;
    const frame = this.frameFor(w, h);
    this.frame = frame;
    const proj = this.studio.project({ w, h, frame, cfg: STORY_CFG, ...STORY_POSE });
    this.proj = proj;
    this._buildSvg(proj);
    this._buildPaint(proj);
    this.ready = true;
    const p = this.p; this.p = -1; this.update(Math.max(0, p));
  }

  // ------------------------------------------------------------- pencil
  _buildSvg(proj) {
    const { w, h } = this;
    const svg = this.svg;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.innerHTML = '';
    const defs = el('defs', {}, svg);
    const mk = el('marker', { id: 'mk-arrow', viewBox: '0 0 10 10', refX: '5', refY: '5', markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse' }, defs);
    el('path', { d: 'M0 1 L9 5 L0 9', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.4' }, mk);

    const gSketch = el('g', { class: 'mk-sketch' }, svg);
    const gBlue = el('g', { class: 'mk-blue' }, svg);
    this.gSketch = gSketch; this.gBlue = gBlue;

    const all = [];
    for (const s of proj.strokes) {
      const xs = s.pts.map(p => p[0]), ys = s.pts.map(p => p[1]);
      all.push(Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys));
    }
    const metal = proj.regions.metal, gem = proj.regions.gem;
    const bb = tris => {
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const t of tris) for (const [x, y] of t.p) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      return { x0, x1, y0, y1 };
    };
    const rb = bb(metal), gb = bb(gem);
    this.rb = rb; this.gb = gb;
    const gc = proj.anchors.gem;
    const pxPerUnit = proj.anchors.gemW / (2 * 0.46);

    // construction guides first (her sketches always start with a faint cross)
    const strokes = [];
    const guideH = [[w * 0.06, gc[1]], [w * 0.94, gc[1]]];
    const guideV = [[gc[0], Math.max(8, gb.y0 - 70)], [gc[0], Math.min(h - 8, rb.y1 + 60)]];
    strokes.push({ pts: guideH, cls: 'guide', w: 0.8 });
    strokes.push({ pts: guideV, cls: 'guide', w: 0.8 });

    const order = { band: 0, head: 1, claw: 2, gem: 3, facet: 4 };
    const sorted = proj.strokes.map((s, i) => ({ ...s, i })).sort((a, b) => (order[a.kind] - order[b.kind]) || a.i - b.i);
    let seed = 7;
    for (const s of sorted) {
      const pts = s.pts.map(p => [p[0], p[1]]);
      if (pts.length < 2 || polyLen(pts) < 3) continue;
      if (s.kind === 'claw') {
        const r = Math.max(1.6, (s.r || 0.034) * pxPerUnit);
        strokes.push({ pts: wobble(offsetLine(pts, r), 0.5, seed++), cls: 'claw', w: 1.1 });
        strokes.push({ pts: wobble(offsetLine(pts, -r), 0.5, seed++), cls: 'claw', w: 1.1 });
        continue;
      }
      const cls = s.kind === 'facet' ? 'facet' : s.kind === 'gem' ? 'gem' : 'band';
      const wv = s.kind === 'band' ? 1.1 : 0.5;
      strokes.push({ pts: wobble(pts, wv, seed++), cls, w: s.kind === 'band' ? 1.5 : s.kind === 'facet' ? 0.8 : 1.25 });
      if (s.kind === 'band' && polyLen(pts) > 60) strokes.push({ pts: wobble(pts, 1.6, seed++ * 3), cls: 'band ghost', w: 0.8 });
    }

    // a little hatching on the shadow side of the band
    const hatch = [];
    const shadow = metal.filter(t => t.shade < 0.35).slice(0, 400);
    const r2 = rng(99);
    for (let k = 0; k < Math.min(26, shadow.length); k++) {
      const t = shadow[Math.floor(r2() * shadow.length)];
      const cx = (t.p[0][0] + t.p[1][0] + t.p[2][0]) / 3, cy = (t.p[0][1] + t.p[1][1] + t.p[2][1]) / 3;
      const L = 7 + r2() * 7;
      hatch.push({ pts: [[cx - L * 0.5, cy + L * 0.5], [cx + L * 0.5, cy - L * 0.5]], cls: 'hatch', w: 0.7 });
    }
    strokes.push(...hatch);

    let total = 0;
    this.strokes = strokes.map(s => {
      const d = pathD(s.pts), len = polyLen(s.pts);
      const path = el('path', { d, class: `mk-s ${s.cls}`, 'stroke-width': s.w }, gSketch);
      path.style.strokeDasharray = `${len + 1} ${len + 1}`;
      path.style.strokeDashoffset = `${len + 1}`;
      const o = { path, len, start: total, drawn: -1, pts: s.pts };
      total += len * (s.cls === 'guide' ? 0.35 : s.cls.includes('ghost') ? 0.4 : 1);
      o.end = total;
      return o;
    });
    this.totalLen = total;

    // stone swatches + handwriting, like the dots at the foot of her paintings
    const sy = Math.min(h - 40, rb.y1 + (this.w < 760 ? 34 : 46));
    const sx = gc[0];
    const sr = this.w < 760 ? 9 : 11;
    const sw = [['#1f47b8', 'Sapphire'], ['#0f8f58', 'Emerald'], ['#c21845', 'Ruby']];
    this.swatches = sw.map(([c], i) => {
      const g = el('g', { class: 'mk-swatch', transform: `translate(${sx + (i - 1) * sr * 3.6} ${sy})` }, gSketch);
      el('circle', { r: sr, fill: c, class: 'mk-swatch-dot' }, g);
      el('circle', { r: sr * 0.42, cx: -sr * 0.3, cy: -sr * 0.32, fill: 'rgba(255,255,255,0.55)' }, g);
      return g;
    });
    const circ = [];
    for (let i = 0; i <= 40; i++) { const a = (i / 40) * Math.PI * 2.15 - 0.4; circ.push([sx + Math.cos(a) * sr * 1.75, sy + Math.sin(a) * sr * 1.55]); }
    const cpts = wobble(circ, 0.8, 5);
    this.choice = { path: el('path', { d: pathD(cpts), class: 'mk-s choice', 'stroke-width': 1.3 }, gSketch), len: polyLen(cpts), pts: cpts };
    this.choice.path.style.strokeDasharray = `${this.choice.len + 1} ${this.choice.len + 1}`;
    this.note = el('text', { x: sx + sr * 2.4, y: sy + sr * 3.4, class: 'mk-note' }, gSketch);
    this.note.textContent = 'Emerald!';

    // blueprint layer
    const dim = (x1, y1, x2, y2, label, lx, ly, anchor = 'middle') => {
      const g = el('g', { class: 'mk-dim' }, gBlue);
      const l = el('path', { d: `M${x1} ${y1} L${x2} ${y2}`, 'marker-start': 'url(#mk-arrow)', 'marker-end': 'url(#mk-arrow)' }, g);
      const len = Math.hypot(x2 - x1, y2 - y1);
      l.style.strokeDasharray = `${len} ${len}`; l.style.strokeDashoffset = `${len}`;
      const t = el('text', { x: lx, y: ly, 'text-anchor': anchor }, g);
      t.textContent = label;
      return { g, l, len, t };
    };
    const ext = (x1, y1, x2, y2) => el('path', { d: `M${x1} ${y1} L${x2} ${y2}`, class: 'mk-ext' }, gBlue);
    const small = this.w < 760;
    const dy = rb.y1 + (small ? 22 : 30);
    ext(rb.x0, rb.y1 - 20, rb.x0, dy + 6); ext(rb.x1, rb.y1 - 20, rb.x1, dy + 6);
    const gy = gb.y0 - (small ? 16 : 22);
    ext(gb.x0, gb.y0 + 6, gb.x0, gy - 6); ext(gb.x1, gb.y0 + 6, gb.x1, gy - 6);
    const vx = Math.min(w - (small ? 30 : 60), Math.max(rb.x1, gb.x1) + (small ? 18 : 34));
    ext(gb.x1 + 4, gb.y0, vx + 6, gb.y0);
    ext(rb.x1 - 6, proj.anchors.top[1], vx + 6, proj.anchors.top[1]);
    this.dims = [
      dim(rb.x0, dy, rb.x1, dy, 'Ø 17.3 mm · ring size N', (rb.x0 + rb.x1) / 2, dy + (small ? 15 : 18)),
      dim(gb.x0, gy, gb.x1, gy, '7 × 5 mm emerald cut · 1.0 ct', (gb.x0 + gb.x1) / 2, gy - 9),
    ];
    if (!small) this.dims.push(dim(vx, gb.y0, vx, proj.anchors.top[1], '5.4 mm', vx - 6, (gb.y0 + proj.anchors.top[1]) / 2 + 4, 'end'));
    // callouts with leader lines
    const call = (x, y, tx, ty, lines, anchor) => {
      const g = el('g', { class: 'mk-call' }, gBlue);
      el('circle', { cx: x, cy: y, r: 2.4 }, g);
      const l = el('path', { d: `M${x} ${y} L${tx} ${ty}` }, g);
      const len = Math.hypot(tx - x, ty - y);
      l.style.strokeDasharray = `${len} ${len}`; l.style.strokeDashoffset = `${len}`;
      const t = el('text', { x: tx + (anchor === 'end' ? -6 : 6), y: ty - 4, 'text-anchor': anchor }, g);
      lines.forEach((s, i) => { const ts = el('tspan', { x: tx + (anchor === 'end' ? -6 : 6), dy: i ? 14 : 0 }, t); ts.textContent = s; });
      return { g, l, len, t };
    };
    const bandPt = metal.reduce((a, t) => (t.p[0][0] < a[0] ? t.p[0] : a), [1e9, 0]);
    const lx = small ? Math.max(12, bandPt[0] - 24) : Math.max(24, bandPt[0] - 90);
    this.calls = small
      ? [call(bandPt[0] + 3, bandPt[1], 16, Math.max(92, gy - 44), ['18k yellow gold', '4 claws · set by hand'], 'start')]
      : [
        call(bandPt[0] + 3, bandPt[1], lx, bandPt[1] - 70, ['18k yellow gold', '2.2 mm comfort band'], 'end'),
        call(gb.x0 + 4, (gb.y0 + gb.y1) / 2, Math.max(24, gb.x0 - 70), gb.y0 - 40, ['4 claws · set by hand'], 'end'),
      ];
  }

  // ---------------------------------------------------------- watercolour
  _buildPaint(proj) {
    const dpr = Math.min(2, devicePixelRatio || 1);
    const { w, h } = this;
    const c = this.canvas;
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    c.style.width = w + 'px'; c.style.height = h + 'px';
    this.dpr = dpr;
    const mkCanvas = () => { const k = document.createElement('canvas'); k.width = c.width; k.height = c.height; return k; };

    const paintRegion = (tris, palette, seed) => {
      const k = mkCanvas(), x = k.getContext('2d');
      x.scale(dpr, dpr);
      x.lineJoin = 'round';
      for (const t of tris) {
        const s = Math.pow(t.shade, 0.8);
        const col = palette(s, t);
        x.fillStyle = col; x.strokeStyle = col; x.lineWidth = 1.2;
        x.beginPath(); x.moveTo(...t.p[0]); x.lineTo(...t.p[1]); x.lineTo(...t.p[2]); x.closePath();
        x.fill(); x.stroke();
      }
      // pigment blooms + granulation, kept inside the wash
      const r = rng(seed);
      x.globalCompositeOperation = 'source-atop';
      const bb = tris.reduce((a, t) => { for (const [px, py] of t.p) { a[0] = Math.min(a[0], px); a[1] = Math.max(a[1], px); a[2] = Math.min(a[2], py); a[3] = Math.max(a[3], py); } return a; }, [1e9, -1e9, 1e9, -1e9]);
      for (let i = 0; i < 26; i++) {
        const gx = lerp(bb[0], bb[1], r()), gy = lerp(bb[2], bb[3], r()), gr = 10 + r() * 46;
        const g = x.createRadialGradient(gx, gy, 0, gx, gy, gr);
        const dark = r() < 0.5;
        g.addColorStop(0, dark ? 'rgba(90,50,10,0.18)' : 'rgba(255,248,230,0.22)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = g; x.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
      }
      for (let i = 0; i < 900; i++) {
        x.fillStyle = `rgba(60,35,10,${0.05 + r() * 0.08})`;
        x.fillRect(lerp(bb[0], bb[1], r()), lerp(bb[2], bb[3], r()), 1, 1);
      }
      x.globalCompositeOperation = 'source-over';
      // soften: blur a copy underneath, keep a crisp-ish wet edge on top
      const out = mkCanvas(), o = out.getContext('2d');
      o.filter = 'blur(2.2px)'; o.globalAlpha = 0.9; o.drawImage(k, 0, 0);
      o.filter = 'none'; o.globalAlpha = 0.55; o.drawImage(k, 0, 0);
      return { canvas: out, bb };
    };
    const gold = s => {
      const a = [236, 196, 110], b = [142, 88, 28], hi = [251, 238, 205];
      const m = s > 0.82 ? [lerp(a[0], hi[0], (s - 0.82) / 0.18), lerp(a[1], hi[1], (s - 0.82) / 0.18), lerp(a[2], hi[2], (s - 0.82) / 0.18)]
        : [lerp(b[0], a[0], s / 0.82), lerp(b[1], a[1], s / 0.82), lerp(b[2], a[2], s / 0.82)];
      return `rgba(${m[0] | 0},${m[1] | 0},${m[2] | 0},0.62)`;
    };
    const green = (s, t) => {
      const up = t.n[1] > 0.6;
      const a = [120, 205, 160], b = [8, 88, 55];
      const k = up ? 0.35 + s * 0.65 : s * 0.8;
      return `rgba(${lerp(b[0], a[0], k) | 0},${lerp(b[1], a[1], k) | 0},${lerp(b[2], a[2], k) | 0},0.78)`;
    };
    this.metalPaint = paintRegion(proj.regions.metal, gold, 11);
    this.gemPaint = paintRegion(proj.regions.gem, green, 23);

    // brush path: zigzag sweeps over each wash
    const sweep = (bb, rows, rad) => {
      const pts = [];
      for (let i = 0; i < rows; i++) {
        const y = lerp(bb[2], bb[3], (i + 0.5) / rows);
        const a = i % 2 ? [bb[1] + rad * 0.3, bb[0] - rad * 0.3] : [bb[0] - rad * 0.3, bb[1] + rad * 0.3];
        const n = Math.max(2, Math.ceil(Math.abs(a[1] - a[0]) / (rad * 0.4)));
        for (let j = 0; j <= n; j++) pts.push([lerp(a[0], a[1], j / n), y + Math.sin(j * 0.9 + i) * rad * 0.18]);
      }
      return pts;
    };
    const mb = this.metalPaint.bb, gbb = this.gemPaint.bb;
    const rad = Math.max(14, (mb[3] - mb[2]) / 9);
    this.dabsMetal = sweep(mb, Math.ceil((mb[3] - mb[2]) / (rad * 1.1)), rad).map(p => [...p, rad]);
    const grad = Math.max(8, (gbb[3] - gbb[2]) / 3);
    this.dabsGem = sweep(gbb, Math.ceil((gbb[3] - gbb[2]) / (grad * 1.1)) + 1, grad).map(p => [...p, grad]);

    // soft, ragged brush sprite
    const b = document.createElement('canvas'); b.width = b.height = 64;
    const bx = b.getContext('2d');
    const r = rng(3);
    for (let i = 0; i < 16; i++) {
      const g = bx.createRadialGradient(32 + (r() - 0.5) * 14, 32 + (r() - 0.5) * 14, 0, 32, 32, 22 + r() * 10);
      g.addColorStop(0, 'rgba(0,0,0,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      bx.fillStyle = g; bx.fillRect(0, 0, 64, 64);
    }
    this.brushSprite = b;
    this.maskM = mkCanvas(); this.maskG = mkCanvas(); this.tmp = mkCanvas();
    this.lastPaint = [-1, -1];
  }

  _drawPaint(pm, pg) {
    if (Math.abs(pm - this.lastPaint[0]) < 0.002 && Math.abs(pg - this.lastPaint[1]) < 0.002) return;
    this.lastPaint = [pm, pg];
    const dpr = this.dpr, W = this.canvas.width, H = this.canvas.height;
    const ctx = this.canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    const layer = (paint, mask, dabs, p) => {
      if (p <= 0) return null;
      const m = mask.getContext('2d');
      m.clearRect(0, 0, W, H);
      const n = Math.floor(dabs.length * p);
      for (let i = 0; i < n; i++) {
        const [x, y, r] = dabs[i];
        m.drawImage(this.brushSprite, (x - r) * dpr, (y - r) * dpr, r * 2 * dpr, r * 2 * dpr);
        m.drawImage(this.brushSprite, (x - r * 0.8) * dpr, (y - r * 0.8) * dpr, r * 1.6 * dpr, r * 1.6 * dpr);
      }
      if (p >= 1) { m.fillStyle = '#000'; m.fillRect(0, 0, W, H); }
      const t = this.tmp.getContext('2d');
      t.globalCompositeOperation = 'source-over';
      t.clearRect(0, 0, W, H);
      t.drawImage(paint.canvas, 0, 0);
      t.globalCompositeOperation = 'destination-in';
      t.drawImage(mask, 0, 0);
      t.globalCompositeOperation = 'source-over';
      ctx.drawImage(this.tmp, 0, 0);
      return n ? dabs[Math.max(0, n - 1)] : null;
    };
    const a = layer(this.metalPaint, this.maskM, this.dabsMetal, pm);
    const b = layer(this.gemPaint, this.maskG, this.dabsGem, pg);
    this.brushAt = pg > 0 && pg < 1 ? b : pm > 0 && pm < 1 ? a : null;
  }

  // --------------------------------------------------------------- frame
  update(p) {
    if (!this.ready) { this.p = p; return; }
    if (Math.abs(p - this.p) < 1e-5) return;
    this.p = p;
    const { studio } = this;
    if (this.active && studio.introT != null) studio.introT = null;   // the hero intro must not fight the scroll

    // pencil drawing
    const drawP = seg(p, 0.02, 0.215);
    const drawn = drawP * this.totalLen;
    let tip = null;
    for (const s of this.strokes) {
      const f = clamp01((drawn - s.start) / (s.end - s.start || 1));
      if (f !== s.drawn) {
        s.drawn = f;
        s.path.style.strokeDashoffset = `${(s.len + 1) * (1 - f)}`;
      }
      if (f > 0 && f < 1) tip = { s, f };
    }
    // swatches, choice circle, note
    const sw = seg(p, 0.355, 0.39);
    this.swatches.forEach((g, i) => {
      const k = ease(clamp01(sw * 3 - i));
      g.style.opacity = k; g.firstChild.setAttribute('r', (this.w < 760 ? 9 : 11) * (0.4 + 0.6 * k));
    });
    const cp = seg(p, 0.39, 0.41);
    this.choice.path.style.strokeDashoffset = `${(this.choice.len + 1) * (1 - cp)}`;
    this.note.style.clipPath = `inset(0 ${100 - seg(p, 0.405, 0.42) * 100}% 0 0)`;
    this.note.style.webkitClipPath = this.note.style.clipPath;

    let pencilPt = null;
    if (tip) {
      const len = tip.s.len * tip.f;
      pencilPt = tip.s.path.getPointAtLength(Math.min(len, tip.s.path.getTotalLength()));
    } else if (cp > 0 && cp < 1) {
      pencilPt = this.choice.path.getPointAtLength(this.choice.len * cp);
    }
    const showPencil = pencilPt && (drawP < 1 || (cp > 0 && cp < 1));
    this.pencil.style.opacity = showPencil ? 1 : 0;
    if (pencilPt) this.pencil.style.transform = `translate(${pencilPt.x}px, ${pencilPt.y}px)`;

    // watercolour
    const pm = ease(seg(p, 0.225, 0.325)), pg = ease(seg(p, 0.315, 0.365));
    this._drawPaint(pm, pg);
    const showBrush = !!this.brushAt && ((pm > 0 && pm < 1) || (pg > 0 && pg < 1));
    this.brush.style.opacity = showBrush ? 1 : 0;
    if (this.brushAt) this.brush.style.transform = `translate(${this.brushAt[0]}px, ${this.brushAt[1]}px)`;

    // paper -> drafting table
    const dark = p >= 0.42;
    if (this.stage.dataset.tone !== (dark ? 'dark' : 'paper')) this.stage.dataset.tone = dark ? 'dark' : 'paper';
    const blue = seg(p, 0.43, 0.5);
    this.grid.style.opacity = (ease(seg(p, 0.425, 0.47)) * (1 - seg(p, 0.6, 0.66))).toFixed(3);
    this.dims.forEach((d, i) => {
      const k = ease(clamp01(blue * 1.6 - i * 0.25));
      d.l.style.strokeDashoffset = `${d.len * (1 - k)}`;
      d.t.style.opacity = seg(k, 0.6, 1);
    });
    this.calls.forEach((c, i) => {
      const k = ease(clamp01(blue * 1.5 - 0.3 - i * 0.2));
      c.l.style.strokeDashoffset = `${c.len * (1 - k)}`;
      c.t.style.opacity = seg(k, 0.7, 1); c.g.style.opacity = k > 0 ? 1 : 0;
    });

    // hand-over to 3D: the drawing fades as the wireframe draws on top of it
    const svgOut = seg(p, 0.535, 0.6);
    this.svg.style.opacity = (1 - svgOut).toFixed(3);
    this.gBlue.style.opacity = (1 - seg(p, 0.55, 0.6)).toFixed(3);
    const paintO = (1 - 0.82 * seg(p, 0.42, 0.47)) * (1 - seg(p, 0.52, 0.57));
    this.canvas.style.opacity = paintO.toFixed(3);
    const glIn = seg(p, 0.495, 0.525);
    this.glHost.style.opacity = glIn.toFixed(3);
    if (this.active) {
      studio.setVisible(glIn > 0);
      studio.applyBuild(buildAt(p));
      studio.storyYaw = ease(seg(p, 0.585, 1)) * Math.PI * 2;
    }

    // chapters + rail
    let ch = 0;
    for (let i = 0; i < CHAPTERS.length; i++) if (p >= CHAPTERS[i]) ch = i;
    if (ch !== this.ch) {
      this.ch = ch;
      this.chapters.forEach((c, i) => c.classList.toggle('is-on', i === ch));
      this.dots.forEach((d, i) => d.classList.toggle('is-on', i <= ch));
    }
    if (this.fill) this.fill.style.transform = `scaleY(${p.toFixed(4)})`;
    this.finale?.classList.toggle('is-on', p > 0.955);
  }

  activate(on) {
    this.active = on;
    if (on) {
      this.studio.interactive = false;
      this.studio.spin = 0; this.studio.vel = 0;
      this.studio.pitch = STORY_POSE.pitch; this.studio.yaw = STORY_POSE.yaw;
      if (Object.keys(STORY_CFG).some(k => STORY_CFG[k] !== this.studio.cfg[k])) {
        Object.assign(this.studio.cfg, STORY_CFG); this.studio.rebuild(); this.studio.popT = null;
      }
      this.studio.mount(this.glHost, 'story', this.frame || this.frameFor(this.stage.clientWidth, this.stage.clientHeight));
      const p = this.p; this.p = -1; this.update(Math.max(0, p));
    }
  }
}
