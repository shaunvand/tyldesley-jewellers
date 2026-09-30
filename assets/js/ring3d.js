// Tyldesley Jewellers - procedural 3D ring studio.
// One WebGL renderer, one ring. The canvas is moved between the hero, the
// "making of" stage and the configurator; each mode frames the ring itself.
// Everything that animates with scroll is a pure function of a progress value,
// so scrubbing backwards and forwards always lands on the same frame.
import * as THREE from 'three';

// ---------------------------------------------------------------- catalogue
export const METALS = {
  yellow:   { name: 'Yellow gold',     color: '#f3c46f', rough: 0.13, karats: [9, 14, 18] },
  white:    { name: 'White gold',      color: '#e6e5e1', rough: 0.12, karats: [9, 14, 18] },
  rose:     { name: 'Rose gold',       color: '#eeab8e', rough: 0.13, karats: [9, 14, 18] },
  platinum: { name: 'Platinum',        color: '#d3d8de', rough: 0.15, karats: ['PT950'] },
  silver:   { name: 'Sterling silver', color: '#f2f2f2', rough: 0.10, karats: ['925'] },
};

export const STONES = {
  diamond:    { name: 'Diamond',    color: '#ffffff', ior: 2.42, disp: 0.055, body: 0.0 },
  emerald:    { name: 'Emerald',    color: '#0fa865', ior: 1.58, disp: 0.012, body: 0.9 },
  sapphire:   { name: 'Sapphire',   color: '#2150e0', ior: 1.77, disp: 0.016, body: 0.9 },
  ruby:       { name: 'Ruby',       color: '#e3134b', ior: 1.77, disp: 0.016, body: 0.9 },
  tanzanite:  { name: 'Tanzanite',  color: '#5b48e6', ior: 1.69, disp: 0.020, body: 0.85 },
  aquamarine: { name: 'Aquamarine', color: '#78d7ef', ior: 1.58, disp: 0.012, body: 0.6 },
  amethyst:   { name: 'Amethyst',   color: '#a04fdc', ior: 1.54, disp: 0.012, body: 0.8 },
  morganite:  { name: 'Morganite',  color: '#f6a596', ior: 1.59, disp: 0.012, body: 0.6 },
  tourmaline: { name: 'Tourmaline', color: '#e4508c', ior: 1.63, disp: 0.015, body: 0.8 },
  citrine:    { name: 'Citrine',    color: '#f5a21c', ior: 1.55, disp: 0.012, body: 0.75 },
  topaz:      { name: 'Blue topaz', color: '#4db4f2', ior: 1.62, disp: 0.013, body: 0.65 },
  garnet:     { name: 'Garnet',     color: '#9b0f2b', ior: 1.79, disp: 0.020, body: 0.95 },
  peridot:    { name: 'Peridot',    color: '#93cc36', ior: 1.66, disp: 0.018, body: 0.75 },
  opal:       { name: 'Opal',       special: 'opal' },
  pearl:      { name: 'Pearl',      special: 'pearl' },
};

export const CUTS = {
  round:    { name: 'Round',    style: 'brilliant' },
  oval:     { name: 'Oval',     style: 'brilliant' },
  cushion:  { name: 'Cushion',  style: 'brilliant' },
  princess: { name: 'Princess', style: 'brilliant' },
  emerald:  { name: 'Emerald',  style: 'step' },
  pear:     { name: 'Pear',     style: 'brilliant' },
  marquise: { name: 'Marquise', style: 'brilliant' },
  baguette: { name: 'Baguette', style: 'step' },
};

export const SETTINGS = {
  solitaire: { name: 'Solitaire' },
  trilogy:   { name: 'Trilogy' },
  halo:      { name: 'Halo' },
  cluster:   { name: 'Cluster' },
};

// Outline of a cut at the girdle, in the gem's XZ plane. Width runs along X
// (max |x| = 1), length along Z (along the finger).
export function cutOutline(cut) {
  const pts = [];
  const push = (x, z) => pts.push([x, z]);
  switch (cut) {
    case 'round': {
      for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; push(Math.cos(a), Math.sin(a)); }
      break;
    }
    case 'oval': {
      for (let i = 0; i < 20; i++) { const a = (i / 20) * Math.PI * 2; push(Math.cos(a), 1.36 * Math.sin(a)); }
      break;
    }
    case 'cushion': {
      const e = 2 / 3.6;
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2 + Math.PI / 24, c = Math.cos(a), s = Math.sin(a);
        push(Math.sign(c) * Math.abs(c) ** e, 1.08 * Math.sign(s) * Math.abs(s) ** e);
      }
      break;
    }
    case 'princess': {
      const q = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
      q.forEach(([x, z]) => push(x * 0.9, z * 0.9));
      break;
    }
    case 'emerald': {
      const L = 1.38, c = 0.3;
      [[1, L - c], [1 - c, L], [-(1 - c), L], [-1, L - c], [-1, -(L - c)], [-(1 - c), -L], [1 - c, -L], [1, -(L - c)]]
        .forEach(([x, z]) => push(x, z));
      break;
    }
    case 'baguette': {
      const L = 2.1;
      [[1, L], [-1, L], [-1, -L], [1, -L]].forEach(([x, z]) => push(x * 0.7, z * 0.7));
      break;
    }
    case 'pear': {
      const raw = [];
      for (let i = 0; i < 24; i++) {
        const t = (i / 24) * Math.PI * 2;
        raw.push([Math.sin(t) * Math.abs(Math.sin(t / 2)) ** 0.9, Math.cos(t)]);
      }
      const mx = Math.max(...raw.map(p => Math.abs(p[0])));
      raw.forEach(([x, z]) => push(x / mx, z * 1.45 - 0.25));
      break;
    }
    case 'marquise': {
      for (let i = 0; i < 24; i++) {
        const t = (i / 24) * Math.PI * 2;
        push(Math.sin(t) * Math.abs(Math.sin(t)) ** 0.45, 1.85 * Math.cos(t));
      }
      break;
    }
    default: return cutOutline('round');
  }
  return pts;
}

// Facet rings, top to bottom: { s: [sx, sz], y, mid }  (mid = ring sits on edge midpoints)
function cutRings(cut) {
  const st = CUTS[cut]?.style || 'brilliant';
  if (st === 'step') {
    const hc = 0.36, hp = 0.9;
    return {
      table: 'fan',
      rings: [
        { s: [0.66, 0.74], y: hc },
        { s: [0.8, 0.85], y: hc * 0.68 },
        { s: [0.92, 0.94], y: hc * 0.34 },
        { s: [1, 1], y: 0.02 },
        { s: [1, 1], y: -0.02 },
        { s: [0.74, 0.8], y: -hp * 0.34 },
        { s: [0.46, 0.6], y: -hp * 0.68 },
        { s: [0.06, 0.34], y: -hp },
      ],
      culet: [0, -hp - 0.02, 0],
    };
  }
  const hc = cut === 'princess' ? 0.26 : 0.34;
  const hp = cut === 'princess' ? 1.0 : 0.86;
  return {
    table: 'fan',
    rings: [
      { s: [0.56, 0.56], y: hc },
      { s: [0.8, 0.8], y: hc * 0.52, mid: true },
      { s: [1, 1], y: 0.018 },
      { s: [1, 1], y: -0.018 },
      { s: [0.5, 0.5], y: -hp * 0.5, mid: true },
    ],
    culet: [0, -hp, 0],
  };
}

function ringPoints(outline, r) {
  const n = outline.length, out = [];
  for (let i = 0; i < n; i++) {
    let [x, z] = outline[i];
    if (r.mid) { const [x2, z2] = outline[(i + 1) % n]; x = (x + x2) / 2; z = (z + z2) / 2; }
    out.push(new THREE.Vector3(x * r.s[0], r.y, z * r.s[1]));
  }
  return out;
}

// Faceted gem, flat normals, unit width (|x| <= 1).
export function gemGeometry(cut) {
  const outline = cutOutline(cut);
  const spec = cutRings(cut);
  const rings = spec.rings.map(r => ({ ...r, pts: ringPoints(outline, r) }));
  const n = outline.length;
  const tris = [];
  const top = rings[0];
  const c0 = new THREE.Vector3(0, top.y, 0);
  for (let i = 0; i < n; i++) tris.push([c0, top.pts[(i + 1) % n], top.pts[i]]);
  for (let k = 0; k < rings.length - 1; k++) {
    const A = rings[k], B = rings[k + 1];
    for (let i = 0; i < n; i++) {
      const a0 = A.pts[i], a1 = A.pts[(i + 1) % n], b0 = B.pts[i], b1 = B.pts[(i + 1) % n];
      if (!A.mid && B.mid) { tris.push([a0, a1, b0]); tris.push([B.pts[(i - 1 + n) % n], a0, b0]); }
      else if (A.mid && !B.mid) { tris.push([a0, b1, b0]); tris.push([a0, a1, b1]); }
      else { tris.push([a0, a1, b1]); tris.push([a0, b1, b0]); }
    }
  }
  const last = rings[rings.length - 1];
  const cul = new THREE.Vector3(...spec.culet);
  for (let i = 0; i < n; i++) tris.push([last.pts[i], last.pts[(i + 1) % n], cul]);

  const pos = [], nor = [];
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), nn = new THREE.Vector3(), cen = new THREE.Vector3();
  for (let [a, b, c] of tris) {
    e1.subVectors(b, a); e2.subVectors(c, a); nn.crossVectors(e1, e2);
    if (nn.lengthSq() < 1e-10) continue;
    nn.normalize();
    cen.copy(a).add(b).add(c).multiplyScalar(1 / 3);
    if (nn.dot(cen) < 0) { [b, c] = [c, b]; nn.negate(); }
    for (const v of [a, b, c]) { pos.push(v.x, v.y, v.z); nor.push(nn.x, nn.y, nn.z); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.userData = { outline, rings: rings.map(r => r.pts), culet: cul, crown: spec.rings[0].y };
  return g;
}

// Smooth cabochon (opal).
function cabochonGeometry(outline) {
  const segs = 14, n = outline.length, pos = [], idx = [];
  for (let j = 0; j <= segs; j++) {
    const t = j / segs, s = Math.cos(t * Math.PI / 2), y = Math.sin(t * Math.PI / 2) * 0.55;
    for (let i = 0; i < n; i++) pos.push(outline[i][0] * s, y, outline[i][1] * s);
  }
  for (let j = 0; j < segs; j++) for (let i = 0; i < n; i++) {
    const a = j * n + i, b = j * n + (i + 1) % n, c = (j + 1) * n + i, d = (j + 1) * n + (i + 1) % n;
    idx.push(a, c, b, b, c, d);
  }
  const base = pos.length / 3; pos.push(0, -0.02, 0);
  for (let i = 0; i < n; i++) idx.push(base, i, (i + 1) % n);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

// ------------------------------------------------------------------ shaders
const GEM_VERT = /* glsl */`
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  varying vec3 vBounce;
  vec3 hash3(vec3 p) {
    p = fract(p * vec3(443.897, 441.423, 437.195));
    p += dot(p, p.yxz + 19.19);
    return fract((p.xxy + p.yzz) * p.zyx) * 2.0 - 1.0;
  }
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    mat3 m = mat3(modelMatrix);
    vWorldNormal = normalize(m * normal);
    // per-facet "pavilion" normal, fixed to the stone so sparkle moves with it
    vec3 nb = normalize(-normal * 0.55 + hash3(floor(normal * 97.0) + 3.1) * 0.9);
    vBounce = normalize(m * nb);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;

const GEM_FRAG = /* glsl */`
  uniform samplerCube uEnv;
  uniform vec3 uColor;
  uniform float uIor;
  uniform float uDisp;
  uniform float uBody;
  uniform float uOpacity;
  uniform float uBright;
  uniform mat3 uEnvRot;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  varying vec3 vBounce;

  vec3 env(vec3 d) { return textureCube(uEnv, uEnvRot * d).rgb; }
  vec3 inner(vec3 V, vec3 N, vec3 Nb, float ior) {
    vec3 t = refract(V, N, 1.0 / ior);
    if (dot(t, t) < 1e-4) t = reflect(V, N);
    return reflect(t, Nb);            // one bounce off a pavilion facet
  }
  void main() {
    vec3 N = normalize(vWorldNormal);
    if (!gl_FrontFacing) N = -N;
    vec3 V = normalize(vWorldPos - cameraPosition);
    float cosi = clamp(dot(-V, N), 0.0, 1.0);
    float F0 = pow((uIor - 1.0) / (uIor + 1.0), 2.0);
    float fres = F0 + (1.0 - F0) * pow(1.0 - cosi, 5.0);
    vec3 Nb = normalize(vBounce);
    vec3 dR = inner(V, N, Nb, uIor * (1.0 - uDisp));
    vec3 dG = inner(V, N, Nb, uIor);
    vec3 dB = inner(V, N, Nb, uIor * (1.0 + uDisp));
    vec3 ins = vec3(env(dR).r, env(dG).g, env(dB).b) + vec3(0.2);
    float L = dot(ins, vec3(0.299, 0.587, 0.114));
    float Lc = 1.0 - exp(-L * 0.85);                 // soft saturation keeps the hue
    vec3 tinted = uColor * (0.12 + 1.3 * Lc);
    vec3 col = mix(ins * 1.15, tinted, uBody) + vec3(pow(Lc, 6.0) * 0.06 * uBody);
    vec3 refl = env(reflect(V, N));
    refl = mix(refl, min(refl, vec3(1.1)), uBody);   // coloured stones: less white glare
    col = mix(col, refl, clamp(fres * (1.1 - 0.55 * uBody), 0.0, 1.0)) * uBright;
    gl_FragColor = vec4(col, uOpacity);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

const DUST_VERT = /* glsl */`
  attribute float aPhase;
  attribute float aSize;
  uniform float uTime;
  uniform float uPx;
  uniform float uAlpha;
  varying float vA;
  void main() {
    vec3 p = position;
    p.y += sin(uTime * 0.25 + aPhase * 6.28) * 0.18;
    p.x += cos(uTime * 0.18 + aPhase * 3.1) * 0.12;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float tw = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(uTime * (1.2 + aPhase * 2.5) + aPhase * 40.0), 3.0);
    vA = tw * uAlpha;
    gl_PointSize = aSize * uPx * tw * (6.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }`;

const DUST_FRAG = /* glsl */`
  uniform vec3 uColor;
  varying float vA;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float core = smoothstep(0.5, 0.0, d);
    float cross = max(0.0, 1.0 - abs(c.x) * 14.0) * max(0.0, 1.0 - abs(c.y) * 2.2)
                + max(0.0, 1.0 - abs(c.y) * 14.0) * max(0.0, 1.0 - abs(c.x) * 2.2);
    float a = (pow(core, 3.0) + cross * 0.5) * vA;
    gl_FragColor = vec4(uColor * a, a);
  }`;

const SPARK_VERT = /* glsl */`
  attribute vec3 aVel;
  attribute float aBirth;
  attribute float aLife;
  attribute float aSeed;
  uniform float uT;
  uniform float uPx;
  uniform float uOn;
  varying float vHeat;
  varying float vA;
  void main() {
    float age = uT - aBirth;
    float alive = step(0.0, age) * step(age, aLife) * uOn;
    float k = clamp(age / aLife, 0.0, 1.0);
    vec3 p = position + aVel * age + vec3(0.0, -2.6, 0.0) * age * age;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vHeat = 1.0 - k;
    vA = alive * (1.0 - k * k);
    gl_PointSize = alive * (4.0 + aSeed * 7.0) * uPx * (1.0 - k * 0.6) * (7.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }`;

const SPARK_FRAG = /* glsl */`
  varying float vHeat;
  varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d) * vA;
    vec3 hot = mix(vec3(1.0, 0.25, 0.05), vec3(1.0, 0.92, 0.6), vHeat);
    gl_FragColor = vec4(hot * a * 1.6, a);
  }`;

// --------------------------------------------------------------- helpers
const clamp01 = v => Math.min(1, Math.max(0, v));
const seg = (p, a, b) => clamp01((p - a) / (b - a));
const ease = t => t * t * (3 - 2 * t);
const easeOut = t => 1 - (1 - t) ** 3;
const easeOutBack = t => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2; };
const lerp = (a, b, t) => a + (b - a) * t;

function starTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.12, 'rgba(255,250,235,0.9)');
  g.addColorStop(0.4, 'rgba(255,235,200,0.12)'); g.addColorStop(1, 'rgba(255,235,200,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  x.globalCompositeOperation = 'lighter';
  for (const [w, h, a] of [[128, 3, 0.9], [3, 128, 0.9]]) {
    const lg = x.createLinearGradient(64 - w / 2, 64 - h / 2, 64 + w / 2, 64 + h / 2);
    lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.5, `rgba(255,255,255,${a})`); lg.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = lg; x.fillRect(64 - w / 2, 64 - h / 2, w, h);
  }
  x.save(); x.translate(64, 64); x.rotate(Math.PI / 4); x.globalAlpha = 0.35;
  x.fillStyle = '#fff'; x.fillRect(-40, -1, 80, 2); x.fillRect(-1, -40, 2, 80); x.restore();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function buildEnvScene() {
  const s = new THREE.Scene();
  s.background = new THREE.Color(0x020202);
  const box = (w, h, k, col = 0xffffff) =>
    new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(k), side: THREE.DoubleSide }));
  const add = (m, x, y, z) => { m.position.set(x, y, z); m.lookAt(0, 0, 0); s.add(m); return m; };
  add(box(8, 6, 4.2), 0, 8, 1);                    // top softbox
  add(box(1.4, 10, 7.5), -7.5, 1, 2);              // left strip
  add(box(1.2, 10, 6.5), 7.5, 1.5, -1.5);          // right strip
  add(box(10, 1.2, 5.5), 0, 2.5, -8);              // back strip
  add(box(7, 2.6, 2.2, 0xffd49a), 0, -2, 8);       // warm front card
  add(box(2.6, 2.6, 4.0, 0xfff3de), 5, 4, 6);      // key
  add(box(9, 7, 0.9, 0xf4efe8), -8, 3, -5);        // big soft fill panels
  add(box(9, 7, 0.8, 0xf4efe8), 8, 2, 5);
  for (let i = 0; i < 22; i++) {                   // pin-point sparkles
    const a = (i / 22) * Math.PI * 2 + (i % 3) * 0.3;
    add(box(0.34, 0.34, 18), Math.cos(a) * 7, 2.5 + Math.sin(i * 1.93) * 3.6, Math.sin(a) * 7);
  }
  const floor = box(24, 24, 0.35, 0xfff0dc); floor.position.set(0, -7, 0); floor.rotation.x = -Math.PI / 2; s.add(floor);
  return s;
}

// ------------------------------------------------------------ ring studio
export class RingStudio {
  constructor(opts = {}) {
    this.onFrame = opts.onFrame || null;
    this.isMobile = matchMedia('(pointer: coarse)').matches || innerWidth < 760;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.cfg = { style: 'solitaire', metal: 'yellow', karat: 18, stone: 'emerald', cut: 'emerald' };
    this.mode = 'hero';
    this.build = 1;           // 0..1 build progress (wire -> wax -> cast -> set -> polish)
    this.storyVisible3D = 1;  // canvas visibility inside the story
    this.frame = { cx: 0.5, cy: 0.5, fit: 0.6 };
    this.yaw = -0.72; this.pitch = 0.46; this.spin = 0; this.vel = 0;
    this.autoRotate = !this.reduced;
    this.running = false; this.visible = true;
    this._last = performance.now();
    this.time = 0;
    this.glints = [];

    const canvas = document.createElement('canvas');
    canvas.className = 'ring-canvas';
    this.canvas = canvas;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.localClippingEnabled = true;
    this.pxCap = this.isMobile ? 1.75 : 2;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, this.pxCap));
    this.renderer = renderer;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
    this.camera.position.set(0, 0, 8);

    const envScene = buildEnvScene();
    const pm = new THREE.PMREMGenerator(renderer);
    this.envRT = pm.fromScene(envScene, 0.03);
    this.scene.environment = this.envRT.texture;
    this.cubeRT = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType });
    this.cubeCam = new THREE.CubeCamera(0.1, 60, this.cubeRT);
    this.cubeCam.update(renderer, envScene);
    pm.dispose();

    this.key = new THREE.DirectionalLight(0xfff1dd, 0.0);
    this.key.position.set(3, 4, 5);
    this.scene.add(this.key);

    this.clipMetal = new THREE.Plane(new THREE.Vector3(0, -1, 0), 100);
    this.clipWax = new THREE.Plane(new THREE.Vector3(0, 1, 0), 100);

    this.metalMat = new THREE.MeshStandardMaterial({ metalness: 1, roughness: 0.13, envMapIntensity: 1.25, clippingPlanes: [this.clipMetal] });
    this.metalMat.envMapRotation = new THREE.Euler();
    this.waxMat = new THREE.MeshStandardMaterial({ color: '#2c7a5a', metalness: 0, roughness: 0.42, envMapIntensity: 0.9, clippingPlanes: [this.clipWax], transparent: true, opacity: 1 });
    this.envRot = new THREE.Matrix3();
    this.gemUniforms = () => ({
      uEnv: { value: this.cubeRT.texture }, uColor: { value: new THREE.Color('#ffffff') },
      uIor: { value: 2.4 }, uDisp: { value: 0.04 }, uBody: { value: 0 }, uOpacity: { value: 1 },
      uBright: { value: 1.25 }, uEnvRot: { value: this.envRot },
    });

    this.pivot = new THREE.Group();      // yaw/pitch
    this.ring = new THREE.Group();       // centred ring
    this.pivot.add(this.ring);
    this.scene.add(this.pivot);

    this.starTex = starTexture();
    this._buildDust();
    this._buildSparks();
    this._buildGlints();
    this.rebuild();

    this._bindPointer();
    this._ro = new ResizeObserver(() => this.resize());
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this._last = performance.now(); });
  }

  // ---------------------------------------------------------- geometry
  rebuild() {
    const old = this.ring.children.filter(o => o !== this.sparks);
    old.forEach(o => { this.ring.remove(o); o.traverse?.(m => { m.geometry?.dispose?.(); }); });

    const { style, cut, stone } = this.cfg;
    const special = STONES[stone]?.special;
    const R_IN = 1.0;
    this.R_IN = R_IN;
    const heavy = style === 'cluster' || style === 'halo';

    // --- band: rounded-rect cross-section swept round the finger, tapering to the head
    const nPhi = this.isMobile ? 128 : 176, nT = 32;
    const ex = 2 / 3.4;
    const thick = f => 0.13 + 0.07 * f;
    const width = f => 0.25 + (heavy ? 0.12 : 0.09) * f;
    const topF = phi => Math.max(0, Math.cos(phi - Math.PI / 2)) ** 3;
    const bandPt = (phi, t, out) => {
      const f = topF(phi), T = thick(f), W = width(f);
      const c = Math.cos(t), s = Math.sin(t);
      const x = Math.sign(c) * Math.abs(c) ** ex, y = Math.sign(s) * Math.abs(s) ** ex;
      const r = R_IN + T / 2 + x * T / 2 - (x < 0 ? 0.004 * (1 - Math.abs(y)) : 0);
      out.set(r * Math.cos(phi), r * Math.sin(phi), y * W / 2);
      return out;
    };
    this.bandPt = bandPt;
    const pos = [], idx = [], v = new THREE.Vector3();
    for (let i = 0; i <= nPhi; i++) {
      const phi = (i / nPhi) * Math.PI * 2;
      for (let j = 0; j <= nT; j++) { bandPt(phi, (j / nT) * Math.PI * 2, v); pos.push(v.x, v.y, v.z); }
    }
    for (let i = 0; i < nPhi; i++) for (let j = 0; j < nT; j++) {
      const a = i * (nT + 1) + j, b = (i + 1) * (nT + 1) + j;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const bandGeo = new THREE.BufferGeometry();
    bandGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    bandGeo.setIndex(idx); bandGeo.computeVertexNormals();
    this.bandTopY = R_IN + thick(1);

    const metalParts = [bandGeo];
    const wire = [];            // line segments for the CAD wireframe, in draw order
    const sketch = [];          // 3D polylines for the pencil drawing, in draw order

    // band polylines (rims at the rounded corners + a few cross sections)
    for (const t of [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4]) {
      const line = [];
      for (let i = 0; i <= 120; i++) line.push(bandPt((i / 120) * Math.PI * 2 + Math.PI / 2, t, new THREE.Vector3()));
      sketch.push({ pts: line, kind: 'band' });
      wire.push(line);
    }
    for (let k = 0; k < 24; k++) {
      const phi = (k / 24) * Math.PI * 2 + Math.PI / 2, line = [];
      for (let j = 0; j <= 20; j++) line.push(bandPt(phi, (j / 20) * Math.PI * 2, new THREE.Vector3()));
      wire.push(line);
    }

    // --- head
    const gemParts = [];
    const addGem = (geo, size, pos3, rotZ = 0, stoneKey = stone) => {
      gemParts.push({ geo, size, pos: pos3, rotZ, stoneKey });
    };
    const clawParts = [];
    const headY = this.bandTopY;
    const centreSize = special === 'pearl' ? 0.4 : style === 'cluster' ? 0.3 : style === 'halo' ? 0.36 : 0.46;
    const seat = special === 'pearl' ? 0.3 : style === 'halo' ? 0.26 : 0.28;
    const gemCentre = new THREE.Vector3(0, headY + seat, 0);
    this.gemCentre = gemCentre.clone();

    const outline = cutOutline(special ? 'oval' : cut);
    const tubeAlong = (pts, r, closed = false, segs = 48) => {
      const curve = new THREE.CatmullRomCurve3(pts, closed, 'catmullrom', 0.5);
      return { geo: new THREE.TubeGeometry(curve, segs, r, 8, closed), curve };
    };

    // claws: pivot at the base so they can open and close
    const makeClaw = (px, pz, size, centre, r, rotZ = 0) => {
      const base = new THREE.Vector3(px * size * 0.5, -seat + 0.06, pz * size * 0.5);
      const bw = width(1) / 2 - 0.04;
      base.z = Math.max(-bw, Math.min(bw, base.z));
      const pts = [
        base.clone(),
        new THREE.Vector3(px * size * 0.95, -seat * 0.45, pz * size * 0.95),
        new THREE.Vector3(px * size * 1.07, -0.05, pz * size * 1.07),
        new THREE.Vector3(px * size * 1.03, 0.08, pz * size * 1.03),
        new THREE.Vector3(px * size * 0.9, 0.135, pz * size * 0.9),
      ];
      const { geo, curve } = tubeAlong(pts, r, false, 28);
      const tip = new THREE.SphereGeometry(r * 1.25, 12, 10); tip.translate(pts[4].x, pts[4].y, pts[4].z);
      clawParts.push({ geo, tip, base, centre, rotZ, radial: new THREE.Vector3(px, 0, pz).normalize() });
      sketch.push({ pts: curve.getPoints(24).map(p => this._toRing(p, centre, rotZ)), kind: 'claw', r });
      wire.push(curve.getPoints(18).map(p => this._toRing(p, centre, rotZ)));
    };
    const clawDirs = n => {
      const dirs = [];
      for (let i = 0; i < n; i++) {
        const a = (n === 4 ? Math.PI / 4 : Math.PI / 2) + (i / n) * Math.PI * 2;
        dirs.push([Math.cos(a), Math.sin(a)]);
      }
      return dirs;
    };
    const outlineHit = (ol, dx, dz) => {        // point on outline in direction (dx, dz)
      let best = ol[0], bd = -1e9;
      for (const p of ol) { const d = (p[0] * dx + p[1] * dz) / Math.hypot(p[0], p[1]); if (d > bd) { bd = d; best = p; } }
      return best;
    };

    const setStone = (cutKey, size, centre, rotZ = 0, withClaws = true, stoneKey = stone, clawR = 0.034) => {
      const sp = STONES[stoneKey]?.special;
      let geo;
      if (sp === 'pearl') geo = new THREE.SphereGeometry(1, 48, 32);
      else if (sp === 'opal') geo = cabochonGeometry(cutOutline('oval'));
      else geo = gemGeometry(cutKey);
      addGem(geo, size, centre, rotZ, stoneKey);
      const ol = cutOutline(sp ? 'oval' : cutKey);
      // sketch: girdle, table, crown facets
      const toR = p => this._toRing(p.clone().multiplyScalar(size), centre, rotZ);
      if (!sp && geo.userData.rings) {
        const rings = geo.userData.rings;
        const girdle = rings[CUTS[cutKey].style === 'step' ? 3 : 2];
        sketch.push({ pts: [...girdle, girdle[0]].map(toR), kind: 'gem' });
        sketch.push({ pts: [...rings[0], rings[0][0]].map(toR), kind: 'gem' });
        rings[0].forEach((p, i) => sketch.push({ pts: [toR(p), toR(rings[1][i])], kind: 'facet' }));
        if (CUTS[cutKey].style === 'step') sketch.push({ pts: [...rings[1], rings[1][0]].map(toR), kind: 'facet' });
        const e = new THREE.EdgesGeometry(geo, 1);
        const a = e.attributes.position;
        for (let i = 0; i < a.count; i += 2) {
          wire.push([toR(new THREE.Vector3().fromBufferAttribute(a, i)), toR(new THREE.Vector3().fromBufferAttribute(a, i + 1))]);
        }
        e.dispose();
      } else {
        const ring = []; for (let i = 0; i <= 48; i++) { const a = (i / 48) * Math.PI * 2; ring.push(new THREE.Vector3(Math.cos(a), 0, Math.sin(a) * (sp === 'pearl' ? 1 : 1.36))); }
        sketch.push({ pts: ring.map(toR), kind: 'gem' });
        wire.push(ring.map(toR));
      }
      if (sp === 'pearl') {                     // cup + peg instead of claws
        const cup = new THREE.CylinderGeometry(size * 0.46, size * 0.2, seat * 0.9, 32, 1, true);
        cup.translate(0, -size * 0.55, 0);
        clawParts.push({ geo: cup, tip: null, base: new THREE.Vector3(0, -seat, 0), centre, rotZ, radial: new THREE.Vector3(1, 0, 0), rigid: true });
        return;
      }
      if (sp === 'opal') {                      // bezel collar
        const col = ol.map(([x, z]) => new THREE.Vector3(x * size * 1.04, 0.02, z * size * 1.04));
        const { geo: bz } = tubeAlong(col, 0.045, true, 72);
        clawParts.push({ geo: bz, tip: null, base: new THREE.Vector3(0, -seat, 0), centre, rotZ, radial: new THREE.Vector3(1, 0, 0), rigid: true });
        const col2 = ol.map(([x, z]) => new THREE.Vector3(x * size * 0.8, -seat * 0.6, z * size * 0.8));
        clawParts.push({ geo: tubeAlong(col2, 0.035, true, 64).geo, tip: null, base: new THREE.Vector3(0, -seat, 0), centre, rotZ, radial: new THREE.Vector3(1, 0, 0), rigid: true });
        return;
      }
      if (!withClaws) return;
      const n = cutKey === 'pear' ? 3 : cutKey === 'marquise' ? 4 : 4;
      const dirs = cutKey === 'pear'
        ? [[0, 1], [Math.cos(-2.2), Math.sin(-2.2)], [Math.cos(-0.94), Math.sin(-0.94)]]
        : cutKey === 'marquise' ? [[0, 1], [0, -1], [1, 0.12], [-1, -0.12]]
        : clawDirs(n);
      for (const [dx, dz] of dirs) {
        const [px, pz] = outlineHit(ol, dx, dz);
        makeClaw(px, pz, size, centre, clawR, rotZ);
      }
      // gallery rails under the stone
      for (const [k, yy, rr] of [[0.72, -0.12, 0.02], [0.46, -seat * 0.62, 0.018]]) {
        const rail = ol.map(([x, z]) => new THREE.Vector3(x * size * k, yy, z * size * k));
        const { geo: rg, curve } = tubeAlong(rail, rr, true, 64);
        clawParts.push({ geo: rg, tip: null, base: new THREE.Vector3(0, -seat, 0), centre, rotZ, radial: new THREE.Vector3(1, 0, 0), rigid: true });
        wire.push(curve.getPoints(40).map(p => this._toRing(p, centre, rotZ)));
        if (k > 0.7) sketch.push({ pts: curve.getPoints(40).map(p => this._toRing(p, centre, rotZ)), kind: 'head' });
      }
    };

    if (style === 'solitaire') {
      setStone(special ? 'oval' : cut, centreSize, gemCentre);
    } else if (style === 'trilogy') {
      setStone(special ? 'oval' : cut, centreSize * 0.92, gemCentre);
      for (const side of [-1, 1]) {
        const phi = Math.PI / 2 - side * 0.36;
        const rr = this.bandTopY - 0.03 + seat * 0.62;
        const c = new THREE.Vector3(Math.cos(phi) * rr, Math.sin(phi) * rr, 0);
        const sideCut = special ? 'oval' : (cut === 'emerald' || cut === 'baguette' ? 'baguette' : cut === 'marquise' || cut === 'pear' ? 'pear' : cut);
        const sideStone = special ? 'diamond' : stone === 'diamond' ? 'diamond' : 'diamond';
        setStone(sideCut === 'pear' ? 'pear' : sideCut, centreSize * (sideCut === 'baguette' ? 0.34 : 0.56), c, phi - Math.PI / 2, true, sideStone, 0.024);
      }
    } else if (style === 'halo') {
      setStone(special ? 'oval' : cut, centreSize, gemCentre);
      const ol = cutOutline(special ? 'oval' : cut);
      const path = []; const N = ol.length;
      for (let i = 0; i < 64; i++) {             // resample outline, push outwards
        const t = (i / 64) * N, i0 = Math.floor(t) % N, i1 = (i0 + 1) % N, f = t - Math.floor(t);
        const x = lerp(ol[i0][0], ol[i1][0], f), z = lerp(ol[i0][1], ol[i1][1], f);
        const l = Math.hypot(x, z);
        path.push([x * centreSize + (x / l) * 0.13, z * centreSize + (z / l) * 0.13]);
      }
      let per = 0; for (let i = 0; i < path.length; i++) { const a = path[i], b = path[(i + 1) % path.length]; per += Math.hypot(a[0] - b[0], a[1] - b[1]); }
      const count = Math.max(12, Math.round(per / 0.14));
      const small = gemGeometry('round');
      for (let k = 0; k < count; k++) {
        const t = (k / count) * path.length, i0 = Math.floor(t) % path.length, i1 = (i0 + 1) % path.length, f = t - Math.floor(t);
        const x = lerp(path[i0][0], path[i1][0], f), z = lerp(path[i0][1], path[i1][1], f);
        addGem(small, 0.066, new THREE.Vector3(gemCentre.x + x, gemCentre.y - 0.03, gemCentre.z + z), 0, 'diamond');
      }
      const rail = path.map(([x, z]) => new THREE.Vector3(x, -0.09, z));
      const { geo: rg, curve } = tubeAlong(rail, 0.05, true, 96);
      clawParts.push({ geo: rg, tip: null, base: new THREE.Vector3(0, -seat, 0), centre: gemCentre, rotZ: 0, radial: new THREE.Vector3(1, 0, 0), rigid: true });
      sketch.push({ pts: curve.getPoints(64).map(p => this._toRing(p, gemCentre, 0)), kind: 'head' });
      wire.push(curve.getPoints(64).map(p => this._toRing(p, gemCentre, 0)));
    } else if (style === 'cluster') {
      setStone(special ? 'oval' : cut, centreSize, gemCentre);
      const petals = 8, rad = centreSize * 1.45 + 0.13;
      const small = gemGeometry('round');
      const ring = [];
      for (let k = 0; k < petals; k++) {
        const a = (k / petals) * Math.PI * 2 + Math.PI / 8;
        const x = Math.cos(a) * rad, z = Math.sin(a) * rad * 1.05;
        addGem(small, 0.12, new THREE.Vector3(gemCentre.x + x, gemCentre.y - 0.06, gemCentre.z + z), 0, 'diamond');
        ring.push(new THREE.Vector3(x, -0.14, z));
        const cr = []; for (let i = 0; i <= 24; i++) { const b = (i / 24) * Math.PI * 2; cr.push(new THREE.Vector3(x + Math.cos(b) * 0.12, -0.06, z + Math.sin(b) * 0.12)); }
        sketch.push({ pts: cr.map(p => this._toRing(p, gemCentre, 0)), kind: 'gem' });
      }
      const { geo: rg, curve } = tubeAlong(ring, 0.07, true, 96);
      clawParts.push({ geo: rg, tip: null, base: new THREE.Vector3(0, -seat, 0), centre: gemCentre, rotZ: 0, radial: new THREE.Vector3(1, 0, 0), rigid: true });
      wire.push(curve.getPoints(64).map(p => this._toRing(p, gemCentre, 0)));
    }

    // --- assemble meshes (metal twins in wax for the casting phase)
    this.metalGroup = new THREE.Group();
    this.waxGroup = new THREE.Group();
    this.clawPivots = [];
    const addMetal = (geo, parent = null) => {
      const m = new THREE.Mesh(geo, this.metalMat);
      const w = new THREE.Mesh(geo, this.waxMat);
      (parent?.metal || this.metalGroup).add(m);
      (parent?.wax || this.waxGroup).add(w);
    };
    addMetal(bandGeo);
    for (const c of clawParts) {
      const pm = new THREE.Group(), pw = new THREE.Group();
      const holder = new THREE.Group(), holderW = new THREE.Group();
      holder.position.copy(c.centre); holder.rotation.z = c.rotZ;
      holderW.position.copy(c.centre); holderW.rotation.z = c.rotZ;
      pm.position.copy(c.base); pw.position.copy(c.base);
      const g = c.geo.clone(); g.translate(-c.base.x, -c.base.y, -c.base.z);
      const parts = [g];
      if (c.tip) { const t = c.tip.clone(); t.translate(-c.base.x, -c.base.y, -c.base.z); parts.push(t); }
      parts.forEach(p => { pm.add(new THREE.Mesh(p, this.metalMat)); pw.add(new THREE.Mesh(p, this.waxMat)); });
      holder.add(pm); holderW.add(pw);
      this.metalGroup.add(holder); this.waxGroup.add(holderW);
      if (!c.rigid) this.clawPivots.push({ pm, pw, axis: new THREE.Vector3(-c.radial.z, 0, c.radial.x) });
    }
    this.ring.add(this.metalGroup, this.waxGroup);

    // gems
    this.gemGroup = new THREE.Group();
    this.gemMeshes = [];
    for (const g of gemParts) {
      const sp = STONES[g.stoneKey]?.special;
      let mat;
      if (sp === 'pearl') {
        mat = new THREE.MeshPhysicalMaterial({ color: '#f5efe4', roughness: 0.16, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, iridescence: 0.55, iridescenceIOR: 1.5, iridescenceThicknessRange: [150, 520], sheen: 0.6, sheenColor: new THREE.Color('#ffe7f2'), envMapIntensity: 1.1, transparent: true });
      } else if (sp === 'opal') {
        mat = new THREE.MeshPhysicalMaterial({ color: '#dfeef5', roughness: 0.12, metalness: 0, clearcoat: 1, iridescence: 1, iridescenceIOR: 2.0, iridescenceThicknessRange: [200, 900], transmission: 0, envMapIntensity: 1.2, transparent: true });
      } else {
        const st = STONES[g.stoneKey] || STONES.diamond;
        const u = this.gemUniforms();
        u.uColor.value.set(st.color); u.uIor.value = st.ior; u.uDisp.value = st.disp; u.uBody.value = st.body;
        u.uBright.value = st.body > 0 ? 1.12 : 1.45;
        mat = new THREE.ShaderMaterial({ uniforms: u, vertexShader: GEM_VERT, fragmentShader: GEM_FRAG, transparent: true });
      }
      const mesh = new THREE.Mesh(g.geo, mat);
      mesh.scale.setScalar(g.size);
      if (sp === 'pearl') mesh.scale.set(g.size, g.size, g.size);
      const holder = new THREE.Group();
      holder.position.copy(g.pos); holder.rotation.z = g.rotZ;
      holder.add(mesh);
      holder.userData.home = g.pos.clone();
      this.gemGroup.add(holder);
      this.gemMeshes.push({ holder, mesh, mat, size: g.size, main: this.gemMeshes.length === 0 });
    }
    this.ring.add(this.gemGroup);

    // wireframe (draw-on with dashes)
    const wpos = [];
    for (const line of wire) for (let i = 0; i < line.length - 1; i++) {
      const a = line[i], b = line[i + 1]; wpos.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
    const wg = new THREE.BufferGeometry();
    wg.setAttribute('position', new THREE.Float32BufferAttribute(wpos, 3));
    this.wireMat = new THREE.LineDashedMaterial({ color: '#f3dcb4', dashSize: 0, gapSize: 1e6, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    this.wire = new THREE.LineSegments(wg, this.wireMat);
    this.wire.computeLineDistances();
    const ld = wg.attributes.lineDistance;
    this.wireLen = ld.getX(ld.count - 1);
    this.ring.add(this.wire);

    this.sketchLines = sketch;

    // low-res band twin: occluder for hidden lines + shapes for the watercolour
    const pp = [], pi = [], nP = 72, nQ = 14;
    for (let i = 0; i <= nP; i++) {
      const phi = (i / nP) * Math.PI * 2;
      for (let j = 0; j <= nQ; j++) { bandPt(phi, (j / nQ) * Math.PI * 2, v); pp.push(v.x, v.y, v.z); }
    }
    for (let i = 0; i < nP; i++) for (let j = 0; j < nQ; j++) {
      const a = i * (nQ + 1) + j, b = (i + 1) * (nQ + 1) + j;
      pi.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const proxyGeo = new THREE.BufferGeometry();
    proxyGeo.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3));
    proxyGeo.setIndex(pi); proxyGeo.computeVertexNormals();
    this.bandProxy = new THREE.Mesh(proxyGeo, new THREE.MeshBasicMaterial());
    this.bandProxy.visible = false;
    this.ring.add(this.bandProxy);

    // centre the ring (bbox incl. head) at the pivot
    const savedRot = this.pivot.rotation.clone();
    this.pivot.rotation.set(0, 0, 0);
    this.ring.position.set(0, 0, 0);
    this.pivot.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.metalGroup);
    this.gemMeshes.forEach(g => box.expandByObject(g.mesh));
    const cen = box.getCenter(new THREE.Vector3());
    this.ring.position.set(-cen.x, -cen.y, -cen.z);
    this.pivot.rotation.copy(savedRot);
    this.pivot.updateMatrixWorld(true);
    this.radius = box.getSize(new THREE.Vector3()).length() / 2;
    this.yMin = box.min.y - cen.y; this.yMax = box.max.y - cen.y;
    if (this.sparks && this.sparks.parent !== this.ring) this.ring.add(this.sparks);

    // glint anchor points on the main stone (crown vertices)
    this.glintAnchors = [];
    const main = this.gemMeshes[0];
    if (main && main.mesh.geometry.userData.rings) {
      const r = main.mesh.geometry.userData.rings;
      [...r[0], ...r[1]].forEach(p => this.glintAnchors.push({ mesh: main.mesh, p: p.clone() }));
    } else if (main) {
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; this.glintAnchors.push({ mesh: main.mesh, p: new THREE.Vector3(Math.cos(a) * 0.7, 0.55, Math.sin(a) * 0.7) }); }
    }
    this.gemMeshes.slice(1, 12).forEach(g => this.glintAnchors.push({ mesh: g.mesh, p: new THREE.Vector3(0, 0.35, 0) }));

    this._applyMetal(true);
    this.applyBuild(this.build);
    this.resize();
  }

  _toRing(p, centre, rotZ) {
    const v = p.clone();
    if (rotZ) v.applyAxisAngle(new THREE.Vector3(0, 0, 1), rotZ);
    return v.add(centre);
  }

  _applyMetal(instant = false) {
    const m = METALS[this.cfg.metal] || METALS.yellow;
    const col = new THREE.Color(m.color);
    if (this.cfg.metal === 'yellow' || this.cfg.metal === 'rose') {
      const k = this.cfg.karat === 9 ? 0.35 : this.cfg.karat === 14 ? 0.15 : 0;
      col.lerp(new THREE.Color('#e9dcc2'), k);
    }
    this.metalTarget = { color: col, rough: m.rough };
    if (instant || !this.metalCurrent) this.metalCurrent = { color: col.clone(), rough: m.rough };
  }

  setConfig(patch) {
    const prev = { ...this.cfg };
    Object.assign(this.cfg, patch);
    const geomChanged = prev.style !== this.cfg.style || prev.cut !== this.cfg.cut || prev.stone !== this.cfg.stone;
    if (geomChanged) {
      this.rebuild();
      this.popT = 0;                              // pop-in animation for the new stone
      this.burst(10);
    }
    this._applyMetal(false);
    this.kick();
  }

  // ---------------------------------------------------------- particles
  _buildDust() {
    const n = this.isMobile ? 70 : 130, p = new Float32Array(n * 3), ph = new Float32Array(n), sz = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const r = 1.6 + Math.random() * 2.6, a = Math.random() * Math.PI * 2;
      p[i * 3] = Math.cos(a) * r; p[i * 3 + 1] = (Math.random() - 0.5) * 3.6; p[i * 3 + 2] = Math.sin(a) * r - 0.5;
      ph[i] = Math.random(); sz[i] = 4 + Math.random() * 9;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    g.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
    g.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
    this.dustMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uPx: { value: 1 }, uAlpha: { value: 0.9 }, uColor: { value: new THREE.Color('#f0d7a8') } },
      vertexShader: DUST_VERT, fragmentShader: DUST_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.dust = new THREE.Points(g, this.dustMat);
    this.dust.frustumCulled = false;
    this.scene.add(this.dust);
  }

  _buildSparks() {
    const n = this.isMobile ? 160 : 260;
    const p = new Float32Array(n * 3), v = new Float32Array(n * 3), b = new Float32Array(n), l = new Float32Array(n), s = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = 1.0 + Math.random() * 0.2;
      p[i * 3] = Math.cos(a) * r; p[i * 3 + 1] = Math.sin(a) * r; p[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
      const out = new THREE.Vector3(Math.cos(a), Math.sin(a) + 0.8, (Math.random() - 0.5)).normalize().multiplyScalar(0.8 + Math.random() * 2.2);
      v[i * 3] = out.x; v[i * 3 + 1] = out.y + 1.2; v[i * 3 + 2] = out.z;
      b[i] = Math.random() * 1.6; l[i] = 0.35 + Math.random() * 0.6; s[i] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    g.setAttribute('aVel', new THREE.BufferAttribute(v, 3));
    g.setAttribute('aBirth', new THREE.BufferAttribute(b, 1));
    g.setAttribute('aLife', new THREE.BufferAttribute(l, 1));
    g.setAttribute('aSeed', new THREE.BufferAttribute(s, 1));
    this.sparkMat = new THREE.ShaderMaterial({
      uniforms: { uT: { value: -1 }, uPx: { value: 1 }, uOn: { value: 0 } },
      vertexShader: SPARK_VERT, fragmentShader: SPARK_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.sparks = new THREE.Points(g, this.sparkMat);
    this.sparks.frustumCulled = false;
  }

  _buildGlints() {
    this.glintGroup = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.starTex, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, opacity: 0 }));
      s.scale.setScalar(0.001);
      this.glintGroup.add(s);
      this.glints.push({ s, t: 1, life: 0.6, anchor: null, size: 0.4 });
    }
    this.scene.add(this.glintGroup);
  }

  burst(n = 3) { this.glintBurst = (this.glintBurst || 0) + n; }

  // --------------------------------------------------------- build state
  // b: 0..0.2 wire draw | 0.2..0.35 wax | 0.35..0.62 cast (pour + cool) | 0.62..0.82 set | 0.82..1 polish
  applyBuild(b) {
    this.build = b;
    const wireIn = seg(b, 0.0, 0.2), waxIn = seg(b, 0.16, 0.3);
    const pour = seg(b, 0.36, 0.52), cool = seg(b, 0.5, 0.64);
    const drop = seg(b, 0.64, 0.78), close = seg(b, 0.76, 0.82);
    const polish = seg(b, 0.82, 1.0);

    // wireframe draws on, then fades as wax takes over
    this.wireMat.dashSize = this.wireLen * ease(wireIn) + 0.0001;
    this.wireMat.opacity = 0.95 * (1 - seg(b, 0.24, 0.36));
    this.wire.visible = this.wireMat.opacity > 0.01 && wireIn > 0;

    // wax model grows in, then molten metal rises through it (world-up clip)
    const yLo = -this.radius - 0.1, yHi = this.radius + 0.1;
    const level = lerp(yLo, yHi, ease(pour));
    const done = b >= 0.53;
    this.clipMetal.constant = done ? 100 : (pour > 0 ? level : -100);
    this.clipWax.constant = pour > 0 ? -level : 100;
    this.waxMat.opacity = waxIn;
    this.waxGroup.visible = waxIn > 0.001 && !done;
    this.metalGroup.visible = pour > 0 || b >= 0.53;

    // heat: glowing while pouring, cools to gold
    const heat = pour > 0 ? (1 - ease(cool)) : 0;
    this.heat = heat;
    this.metalMat.emissive.setRGB(1.0, 0.1 + 0.22 * heat * heat, 0.0);
    this.metalMat.emissiveIntensity = heat * 0.95;
    this.castRough = lerp(0.4, this.metalTarget?.rough ?? 0.13, ease(polish));
    this.polishAmt = polish;

    // sparks while pouring
    this.sparkMat.uniforms.uOn.value = pour > 0 && cool < 1 ? 1 : 0;
    this.sparkMat.uniforms.uT.value = (pour + cool) * 1.4;

    // stone drops into the claws, claws close
    const dropT = easeOutBack(drop);
    for (const g of this.gemMeshes) {
      const home = g.holder.userData.home;
      g.holder.position.set(home.x, home.y + (1 - dropT) * 1.6, home.z);
      g.holder.visible = drop > 0;
      g.mesh.rotation.y = (1 - dropT) * 1.2;
      const o = ease(seg(drop, 0, 0.35));
      if (g.mat.uniforms) g.mat.uniforms.uOpacity.value = o; else g.mat.opacity = o;
    }
    const open = (1 - ease(close)) * 0.22;
    for (const c of this.clawPivots) {
      c.pm.quaternion.setFromAxisAngle(c.axis, -open);
      c.pw.quaternion.copy(c.pm.quaternion);
    }
    if (b >= 0.999 && !this._landed) { this._landed = true; this.burst(4); }
    if (b < 0.9) this._landed = false;
  }

  // ------------------------------------------------------------- framing
  mount(host, mode, frame) {
    if (this.host !== host) {
      this._ro.disconnect();
      host.appendChild(this.canvas);
      this.host = host;
      this._ro.observe(host);
    }
    if (mode) this.mode = mode;
    if (frame) this.frame = { ...this.frame, ...frame };
    this.resize();
  }

  setFrame(frame) { this.frame = { ...this.frame, ...frame }; this._frameCamera(); }

  resize() {
    if (!this.host) return;
    const w = Math.max(1, this.host.clientWidth), h = Math.max(1, this.host.clientHeight);
    this.w = w; this.h = h;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, this.pxCap));
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = w + 'px'; this.canvas.style.height = h + 'px';
    const px = this.renderer.getPixelRatio();
    this.dustMat.uniforms.uPx.value = px;
    this.sparkMat.uniforms.uPx.value = px;
    this._frameCamera();
    this.kick();
  }

  _frameCamera() {
    if (!this.w) return;
    const { w, h } = this, cam = this.camera;
    cam.aspect = w / h;
    const f = this.frame.fit, r = this.radius || 1.5;
    const tanH = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const d = (r * 2 * h) / (2 * tanH * f * Math.min(w, h));
    cam.position.set(0, 0, d);
    cam.near = Math.max(0.05, d - 6); cam.far = d + 30;
    cam.lookAt(0, 0, 0);
    cam.setViewOffset(w, h, (0.5 - this.frame.cx) * w, (0.5 - this.frame.cy) * h, w, h);
    cam.updateProjectionMatrix();
  }

  // ------------------------------------------------------------- pointer
  _bindPointer() {
    let down = false, lx = 0, ly = 0, moved = 0;
    const c = this.canvas;
    c.style.touchAction = 'pan-y';
    c.addEventListener('pointerdown', e => {
      if (!this.interactive) return;
      down = true; lx = e.clientX; ly = e.clientY; moved = 0; this.vel = 0; this.lastInteract = performance.now();
    });
    addEventListener('pointermove', e => {
      if (!down) return;
      const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY; moved += Math.abs(dx);
      this.spin += dx * 0.009; this.vel = dx * 0.009;
      if (e.pointerType !== 'touch') this.pitch = Math.max(-0.2, Math.min(0.9, this.pitch + dy * 0.004));
      this.lastInteract = performance.now(); this.kick();
    }, { passive: true });
    const up = () => { if (down && moved > 4) this.burst(2); down = false; };
    addEventListener('pointerup', up); addEventListener('pointercancel', up);
    c.addEventListener('dblclick', () => this.burst(6));
  }

  // ---------------------------------------------------------- projection
  // Screen-space polylines of the ring for the pencil drawing (hidden lines removed),
  // plus painted regions. Uses the current camera + pose.
  sketchProjection() {
    this.scene.updateMatrixWorld(true);
    this.camera.updateMatrixWorld(true);
    const cam = this.camera, w = this.w, h = this.h;
    const ringM = this.ring.matrixWorld;
    const tmp = new THREE.Vector3();
    const toScreen = p => { tmp.copy(p).applyMatrix4(ringM).project(cam); return [(tmp.x * 0.5 + 0.5) * w, (-tmp.y * 0.5 + 0.5) * h, tmp.z]; };

    // hidden lines: render a packed depth buffer once, then compare each sample point
    const hideList = [this.wire, this.waxGroup, this.dust, this.glintGroup, this.sparks].filter(Boolean);
    const hidePrev = hideList.map(o => o.visible);
    hideList.forEach(o => (o.visible = false));
    const wasVisible = [this.metalGroup.visible, this.gemGroup.visible, ...this.gemMeshes.map(g => g.holder.visible)];
    this.metalGroup.visible = true; this.gemGroup.visible = true; this.gemMeshes.forEach(g => (g.holder.visible = true));
    const savedPos = this.gemMeshes.map(g => g.holder.position.clone());
    this.gemMeshes.forEach(g => g.holder.position.copy(g.holder.userData.home));
    const clipSaved = [this.clipMetal.constant, this.clipWax.constant];
    this.clipMetal.constant = 100;
    this.scene.updateMatrixWorld(true);
    const dw = Math.max(1, Math.round(w)), dh = Math.max(1, Math.round(h));
    const rt = new THREE.WebGLRenderTarget(dw, dh, { depthBuffer: true });
    const depthMat = new THREE.ShaderMaterial({
      vertexShader: 'void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'void main(){ float v = floor(gl_FragCoord.z * 16777215.0); gl_FragColor = vec4(floor(v / 65536.0) / 255.0, mod(floor(v / 256.0), 256.0) / 255.0, mod(v, 256.0) / 255.0, 1.0); }',
    });
    const r = this.renderer, prevTarget = r.getRenderTarget(), prevClear = r.getClearColor(new THREE.Color()), prevAlpha = r.getClearAlpha();
    const prevPR = r.getPixelRatio();
    this.scene.overrideMaterial = depthMat;
    r.setRenderTarget(rt); r.setClearColor(0xffffff, 1); r.clear(); r.render(this.scene, cam);
    const buf = new Uint8Array(dw * dh * 4);
    r.readRenderTargetPixels(rt, 0, 0, dw, dh, buf);
    this.scene.overrideMaterial = null;
    r.setRenderTarget(prevTarget); r.setClearColor(prevClear, prevAlpha); r.setPixelRatio(prevPR);
    rt.dispose(); depthMat.dispose();
    const camPos = cam.getWorldPosition(new THREE.Vector3());
    const zAt = (x, y) => {
      if (x < 0 || y < 0 || x >= dw || y >= dh) return 1;
      const i = ((dh - 1 - y) * dw + x) * 4;
      return (buf[i] * 65536 + buf[i + 1] * 256 + buf[i + 2]) / 16777215;
    };
    const pv = new THREE.Vector3();
    const visibleAt = p => {
      pv.copy(p).applyMatrix4(ringM).project(cam);
      const x = Math.round((pv.x * 0.5 + 0.5) * dw), y = Math.round((-pv.y * 0.5 + 0.5) * dh);
      const z = pv.z * 0.5 + 0.5;
      let zmax = 0;
      for (let oy = -2; oy <= 2; oy++) for (let ox = -2; ox <= 2; ox++) zmax = Math.max(zmax, zAt(x + ox, y + oy));
      return z <= zmax + 0.0009;
    };

    const strokes = [];
    for (const s of this.sketchLines) {
      let run = [];
      const flush = () => { if (run.length > 1) strokes.push({ kind: s.kind, pts: run }); run = []; };
      for (const p of s.pts) {
        if (visibleAt(p)) run.push(toScreen(p)); else flush();
      }
      flush();
    }

    // painted regions: front-facing triangles of the band + stone crowns
    const band = this.bandProxy;
    const regions = { metal: [], gem: [] };
    const addTris = (geo, matrix, list, isGem) => {
      const pos = geo.attributes.position, index = geo.index;
      const nrm = geo.attributes.normal;
      const cnt = index ? index.count : pos.count;
      const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3(), mid = new THREE.Vector3(), view = new THREE.Vector3();
      const nm2 = new THREE.Matrix3().getNormalMatrix(matrix);
      for (let i = 0; i < cnt; i += 3) {
        const ia = index ? index.getX(i) : i, ib = index ? index.getX(i + 1) : i + 1, ic = index ? index.getX(i + 2) : i + 2;
        a.fromBufferAttribute(pos, ia).applyMatrix4(matrix); b.fromBufferAttribute(pos, ib).applyMatrix4(matrix); c.fromBufferAttribute(pos, ic).applyMatrix4(matrix);
        n.fromBufferAttribute(nrm, ia).applyMatrix3(nm2).normalize();
        mid.copy(a).add(b).add(c).multiplyScalar(1 / 3);
        view.subVectors(mid, camPos).normalize();
        const facing = -view.dot(n);
        if (facing <= 0) continue;
        const pa = a.clone().project(cam), pb = b.clone().project(cam), pc = c.clone().project(cam);
        const S = v => [(v.x * 0.5 + 0.5) * w, (-v.y * 0.5 + 0.5) * h];
        list.push({ p: [S(pa), S(pb), S(pc)], shade: facing, n: [n.x, n.y, n.z], z: (pa.z + pb.z + pc.z) / 3 });
      }
    };
    addTris(band.geometry, band.matrixWorld, regions.metal, false);
    this.metalGroup.children.slice(1).forEach(holder => holder.traverse(o => { if (o.isMesh) addTris(o.geometry, o.matrixWorld, regions.metal, false); }));
    this.gemMeshes.forEach(g => addTris(g.mesh.geometry, g.mesh.matrixWorld, regions.gem, true));
    regions.metal.sort((p, q) => q.z - p.z); regions.gem.sort((p, q) => q.z - p.z);

    // restore
    hideList.forEach((o, i) => (o.visible = hidePrev[i]));
    this.clipMetal.constant = clipSaved[0]; this.clipWax.constant = clipSaved[1];
    this.gemMeshes.forEach((g, i) => g.holder.position.copy(savedPos[i]));
    this.metalGroup.visible = wasVisible[0]; this.gemGroup.visible = wasVisible[1];
    this.gemMeshes.forEach((g, i) => (g.holder.visible = wasVisible[2 + i]));

    const gc = toScreen(this.gemCentre);
    const ringC = toScreen(new THREE.Vector3(0, 0, 0));
    const top = toScreen(new THREE.Vector3(0, this.bandTopY, 0));
    const bottom = toScreen(new THREE.Vector3(0, -this.R_IN - 0.13, 0));
    const left = toScreen(new THREE.Vector3(-this.R_IN - 0.13, 0, 0));
    const right = toScreen(new THREE.Vector3(this.R_IN + 0.13, 0, 0));
    const main = this.gemMeshes[0];
    let gemW = 0;
    if (main) {
      const sL = toScreen(new THREE.Vector3(-main.size, 0, 0).add(this.gemCentre));
      const sR = toScreen(new THREE.Vector3(main.size, 0, 0).add(this.gemCentre));
      gemW = Math.hypot(sR[0] - sL[0], sR[1] - sL[1]);
    }
    return { strokes, regions, anchors: { gem: gc, centre: ringC, top, bottom, left, right, gemW }, w, h };
  }

  // Project the ring for a host of a given size without moving the canvas.
  // Used to pre-compute the pencil drawing while the canvas lives elsewhere.
  project({ w, h, frame, cfg, pitch, yaw }) {
    const saved = { frame: this.frame, spin: this.spin, storyYaw: this.storyYaw, pitch: this.pitch, yaw: this.yaw, cfg: { ...this.cfg }, build: this.build };
    let rebuilt = false;
    if (cfg && Object.keys(cfg).some(k => cfg[k] !== this.cfg[k])) { Object.assign(this.cfg, cfg); this.rebuild(); rebuilt = true; }
    const sw = this.w, sh = this.h;
    this.w = w; this.h = h; this.frame = { ...this.frame, ...frame };
    this.spin = 0; this.storyYaw = 0; this.pitch = pitch ?? this.pitch; this.yaw = yaw ?? this.yaw;
    this.pivot.rotation.set(this.pitch, this.yaw, 0, 'XYZ');
    this._frameCamera();
    const res = this.sketchProjection();
    Object.assign(this, { frame: saved.frame, spin: saved.spin, storyYaw: saved.storyYaw, pitch: saved.pitch, yaw: saved.yaw });
    this.w = sw; this.h = sh;
    if (rebuilt) { this.cfg = saved.cfg; this.rebuild(); }
    this._frameCamera();
    this.applyBuild(saved.build);
    return res;
  }

  // --------------------------------------------------------------- loop
  setVisible(v) { this.visible = v; if (v) this.kick(); }
  kick() { if (!this.running && this.visible && this.host) { this.running = true; this._last = performance.now(); requestAnimationFrame(this._tick); } }
  _tick = () => {
    if (!this.visible || !this.host) { this.running = false; return; }
    const now = performance.now(); const dt = Math.min(0.05, (now - this._last) / 1000); this._last = now;
    this.time += dt;
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
    this.onFrame?.(dt);
    requestAnimationFrame(this._tick);
  };

  update(dt) {
    // intro animation (hero) runs the build on the clock
    if (this.introT != null) {
      this.introT += dt;
      const b = clamp01(this.introT / this.introDur);
      this.applyBuild(b);
      if (b >= 1) this.introT = null;
    }
    // rotation
    const idle = performance.now() - (this.lastInteract || 0) > 2200;
    if (this.interactive) {
      this.spin += this.vel; this.vel *= 0.94;
      if (this.autoRotate && idle) this.spin += dt * 0.28;
    }
    const storyYaw = this.storyYaw ?? 0;
    this.pivot.rotation.set(this.pitch, this.yaw + this.spin + storyYaw, 0, 'XYZ');

    // metal colour + finish ease towards the target
    if (this.metalTarget) {
      const k = 1 - Math.exp(-dt * 6);
      this.metalCurrent.color.lerp(this.metalTarget.color, k);
      this.metalCurrent.rough = lerp(this.metalCurrent.rough, this.metalTarget.rough, k);
    }
    const hot = this.heat || 0;
    const base = this.metalCurrent.color.clone();
    if (hot > 0) base.lerp(new THREE.Color('#2a0d04'), hot * 0.95);
    this.metalMat.color.copy(base);
    this.metalMat.roughness = this.build < 1 ? Math.max(this.castRough, 0.08) : this.metalCurrent.rough;

    // polish: moving reflections
    const sweep = (this.polishAmt || 0) > 0 && this.build < 1 ? Math.sin(this.polishAmt * Math.PI) : 0;
    this.metalMat.envMapRotation.y = this.time * 0.05 + (this.polishAmt || 0) * 3.2;
    this.envRot.setFromMatrix4(new THREE.Matrix4().makeRotationY(-(this.time * 0.05 + (this.polishAmt || 0) * 3.2)));
    this.key.intensity = 1.2 * sweep;

    // pop-in after a config change
    if (this.popT != null) {
      this.popT += dt;
      const k = clamp01(this.popT / 0.7);
      const s = easeOutBack(k);
      this.gemMeshes.forEach(g => g.mesh.scale.setScalar(g.size * Math.max(0.001, s)));
      if (k >= 1) this.popT = null;
    }

    // dust + glints
    this.dustMat.uniforms.uTime.value = this.time;
    const finished = this.build >= 0.86;
    this.dustMat.uniforms.uAlpha.value = lerp(this.dustMat.uniforms.uAlpha.value, finished ? 0.9 : 0.25, 0.05);
    this._updateGlints(dt, finished);
  }

  _updateGlints(dt, on) {
    const cam = this.camera;
    let want = on && !this.reduced ? (Math.random() < dt * 2.4 ? 1 : 0) + (this.glintBurst || 0) : 0;
    this.glintBurst = 0;
    for (const g of this.glints) {
      if (g.t < 1) {
        g.t += dt / g.life;
        const k = Math.sin(Math.min(1, g.t) * Math.PI);
        g.anchor.mesh.updateWorldMatrix(true, false);
        const p = g.anchor.p.clone().applyMatrix4(g.anchor.mesh.matrixWorld);
        const toCam = cam.position.clone().sub(p).normalize().multiplyScalar(0.08);
        g.s.position.copy(p.add(toCam));
        g.s.scale.setScalar(g.size * k);
        g.s.material.opacity = k;
        g.s.material.rotation = g.rot + g.t * 0.6;
      } else if (want > 0 && this.glintAnchors.length) {
        want--;
        g.t = 0; g.life = 0.45 + Math.random() * 0.5; g.size = 0.22 + Math.random() * 0.42; g.rot = Math.random() * 0.5;
        g.anchor = this.glintAnchors[(Math.random() * this.glintAnchors.length) | 0];
      } else { g.s.material.opacity = 0; g.s.scale.setScalar(0.001); }
    }
  }

  playIntro(duration = 3.6) {
    if (this.reduced) { this.applyBuild(1); return; }
    this.introDur = duration; this.introT = 0; this.applyBuild(0); this.kick();
  }
}

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch { return false; }
}
