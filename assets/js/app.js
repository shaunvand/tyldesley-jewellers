// Tyldesley Jewellers - page controller.
import { RingStudio, webglAvailable, STONES, METALS } from './ring3d.js';
import { Making, STORY_CFG } from './making.js';

const { gsap, ScrollTrigger, Lenis } = window;
gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
const isMobile = matchMedia('(pointer: coarse)').matches || innerWidth < 760;
const wide = () => innerWidth >= 960;
const wait = ms => new Promise(r => setTimeout(r, ms));
const WA = '27835787625';

// ------------------------------------------------------------ smooth scroll
let lenis = null;
if (!reduced && Lenis) {
  lenis = new Lenis({ lerp: 0.1, smoothWheel: true, syncTouch: false });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(t => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}
function scrollToTarget(target) {
  const off = -(($('.hdr')?.offsetHeight || 64) - 1);
  if (lenis) lenis.scrollTo(target, { offset: typeof target === 'number' ? 0 : off, duration: 1.5 });
  else if (typeof target === 'number') scrollTo({ top: target, behavior: reduced ? 'auto' : 'smooth' });
  else target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
}
document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const id = a.getAttribute('href');
  if (id === '#') return;
  const el = $(id);
  if (!el) return;
  e.preventDefault();
  closeMenu();
  scrollToTarget(id === '#top' ? 0 : el);
});

// ------------------------------------------------------------ 3D studio
let studio = null;
if (webglAvailable()) {
  try { studio = new RingStudio(); } catch (err) { console.warn('3D disabled:', err); studio = null; }
}
if (!studio) root.classList.add('no-gl');
if (studio) studio.applyBuild(0);

const userCfg = { ...STORY_CFG };
const hosts = { hero: $('.hero__gl'), story: $('.mk-gl'), config: $('.design__gl') };
const active = { hero: true, story: false, config: false };
let current = null;
let making = null;
const heroFrame = () => (wide() ? { cx: 0.71, cy: 0.52, fit: 0.78 } : { cx: 0.5, cy: 0.37, fit: 0.84 });
const configFrame = () => ({ cx: 0.5, cy: 0.5, fit: wide() ? 0.8 : 0.9 });

function direct() {
  if (!studio) return;
  const want = active.story && making ? 'story' : active.config ? 'config' : active.hero ? 'hero' : null;
  if (!want) { if (current !== 'story') studio.setVisible(false); making?.activate(false); current = null; if (!active.story) studio.setVisible(false); return; }
  if (want === current) return;
  current = want;
  if (want === 'story') { making.activate(true); return; }
  making?.activate(false);
  if (Object.keys(userCfg).some(k => userCfg[k] !== studio.cfg[k])) { Object.assign(studio.cfg, userCfg); studio.rebuild(); studio.popT = null; }
  if (want === 'config') studio.introT = null;          // the configurator always shows the finished ring
  if (studio.introT == null) studio.applyBuild(1);
  studio.storyYaw = 0;
  studio.interactive = true;
  studio.pitch = 0.46;
  studio.mount(hosts[want], want, want === 'hero' ? heroFrame() : configFrame());
  studio.setVisible(true);
}
addEventListener('resize', () => {
  if (!studio) return;
  if (current === 'hero') studio.setFrame(heroFrame());
  if (current === 'config') studio.setFrame(configFrame());
});

// ------------------------------------------------------------ loader
const loader = $('.loader');
const bar = $('.loader__bar i');
let loadP = 0;
const setLoad = v => { loadP = Math.max(loadP, v); if (bar) bar.style.transform = `scaleX(${loadP})`; };
setLoad(0.15);
let seen = false;
try { seen = sessionStorage.getItem('tyl-seen') === '1'; sessionStorage.setItem('tyl-seen', '1'); } catch { /* private mode */ }
const firstFrame = new Promise(res => {
  if (!studio) return res();
  let n = 0;
  studio.onFrame = () => { if (++n === 3) { studio.onFrame = null; res(); } };
});
const fonts = document.fonts ? document.fonts.ready : Promise.resolve();
active.hero = true; direct();
Promise.race([
  Promise.all([fonts.then(() => setLoad(0.55)), firstFrame.then(() => setLoad(0.9)), wait(seen ? 300 : 1500)]),
  wait(4500),
]).then(async () => {
  setLoad(1);
  await wait(380);
  loader?.classList.add('is-done');
  root.classList.add('is-loaded');
  studio?.playIntro(isMobile ? 3.3 : 3.8);
  setTimeout(() => loader?.remove(), 1500);
  setTimeout(() => ScrollTrigger.refresh(), 60);
  startIdleWork();
});

// ------------------------------------------------------------ header + menu + dock
const hdr = $('.hdr');
const dock = $('.dock');
let lastY = 0;
function onScroll(y) {
  const dir = y > lastY ? 1 : -1;
  lastY = y;
  hdr.classList.toggle('is-scrolled', y > 30);
  if (!root.classList.contains('menu-open')) hdr.classList.toggle('is-hidden', dir > 0 && y > innerHeight * 0.9);
  dock?.classList.toggle('is-on', y > innerHeight * 0.75 && !root.classList.contains('menu-open'));
}
if (lenis) lenis.on('scroll', ({ scroll }) => onScroll(scroll));
else addEventListener('scroll', () => onScroll(scrollY), { passive: true });

const menuBtn = $('.hdr__menu');
const menu = $('#menu');
$$('.menu__links a').forEach((a, i) => a.style.setProperty('--i', i));
function openMenu() {
  root.classList.add('menu-open'); menuBtn.setAttribute('aria-expanded', 'true'); menu.setAttribute('aria-hidden', 'false');
  hdr.classList.remove('is-hidden'); lenis?.stop(); document.body.classList.add('is-locked'); dock?.classList.remove('is-on');
}
function closeMenu() {
  if (!root.classList.contains('menu-open')) return;
  root.classList.remove('menu-open'); menuBtn.setAttribute('aria-expanded', 'false'); menu.setAttribute('aria-hidden', 'true');
  lenis?.start(); document.body.classList.remove('is-locked');
}
menuBtn?.addEventListener('click', () => (root.classList.contains('menu-open') ? closeMenu() : openMenu()));
addEventListener('keydown', e => { if (e.key === 'Escape') { closeMenu(); closeLB(); } });

// header colour follows the section underneath it (triggers created at the end, after every pin)
const setTone = t => { if (hdr.dataset.tone !== t) hdr.dataset.tone = t; };

// ------------------------------------------------------------ text splitting + reveals
function splitWords(el, cls = 'w') {
  let i = 0;
  const out = [];
  const walk = (node, inEm) => {
    [...node.childNodes].forEach(n => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
          const w = document.createElement('span');
          w.className = cls;
          const s = document.createElement('span');
          s.textContent = part;
          s.style.setProperty('--i', i++);
          if (inEm) s.classList.add('g');
          w.appendChild(s); frag.appendChild(w); out.push(w);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && n.tagName !== 'BR') walk(n, inEm || n.tagName === 'EM');
    });
  };
  walk(el, false);
  return out;
}
$$('.split').forEach(el => splitWords(el));

const io = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('is-in');
    io.unobserve(e.target);
  });
}, { rootMargin: '0px 0px -8% 0px', threshold: 0.1 });
$$('.reveal-up, .clip-reveal, .split, .timeline, .bd').forEach(el => { if (!el.closest('.hero')) io.observe(el); });
$$('.timeline li').forEach((li, i) => li.style.setProperty('--i', i));
$$('.bd').forEach((b, i) => b.style.setProperty('--d', i % 6));

// hero copy drifts away as you scroll
if (!reduced) {
  gsap.to('.hero__copy', { yPercent: -18, opacity: 0, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom 20%', scrub: true } });
  gsap.to('.hero__caption', { opacity: 0, ease: 'none', scrollTrigger: { trigger: '.hero', start: '20% top', end: '60% top', scrub: true } });
}
ScrollTrigger.create({ trigger: '.hero', start: 'top bottom', end: 'bottom top', onToggle: s => { active.hero = s.isActive; direct(); } });

// ------------------------------------------------------------ marquee
const track = $('.marquee__track');
if (track && !reduced) {
  let x = 0, on = false;
  new IntersectionObserver(([e]) => { on = e.isIntersecting; }).observe(track);
  gsap.ticker.add((t, dt) => {
    if (!on) return;
    const v = lenis ? Math.min(60, Math.abs(lenis.velocity)) : 0;
    x -= (42 + v * 9) * (dt / 1000);
    const half = track.scrollWidth / 2;
    if (-x >= half) x += half;
    track.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
  });
}

// ------------------------------------------------------------ statement + counters
const statement = $('[data-words]');
if (statement) {
  const words = splitWords(statement, 'wd');
  if (!reduced) {
    words.forEach(w => (w.style.opacity = '0.14'));
    ScrollTrigger.create({
      trigger: statement, start: 'top 82%', end: 'bottom 42%',
      onUpdate: s => {
        const n = words.length;
        words.forEach((w, i) => { const k = Math.min(1, Math.max(0, s.progress * n * 1.08 - i)); w.style.opacity = (0.14 + 0.86 * k).toFixed(3); });
      },
    });
  }
}
$$('[data-count]').forEach(el => {
  const n = +el.dataset.count;
  if (reduced) return;
  el.textContent = '0';
  ScrollTrigger.create({
    trigger: el, start: 'top 88%', once: true,
    onEnter: () => { const o = { v: 0 }; gsap.to(o, { v: n, duration: 1.8, ease: 'power3.out', onUpdate: () => (el.textContent = Math.round(o.v)) }); },
  });
});

// ------------------------------------------------------------ the making (pinned story)
const makingSec = $('#making');
if (studio && !reduced) {
  making = new Making({ root: makingSec, studio, isMobile, reduced });
  let target = 0, smooth = 0;
  const storyST = ScrollTrigger.create({
    trigger: '.mk-stage', start: 'top top',
    end: () => '+=' + Math.round(innerHeight * (wide() ? 8.5 : 7.5)),
    pin: true,
    onUpdate: s => { target = s.progress; },
    onToggle: s => {
      active.story = s.isActive;
      if (s.isActive && !making.ready) making.prepare();
      direct();
    },
  });
  gsap.ticker.add(() => {
    if (!making.ready) return;
    const d = target - smooth;
    if (Math.abs(d) > 0.00002) { smooth = window.__tyl?.snap ? target : smooth + d * (isMobile ? 0.22 : 0.14); making.update(smooth); }
    if (active.story) setTone(smooth >= 0.42 ? 'dark' : 'light');
    dock?.classList.toggle('is-story', active.story);
  });
  window.__tylStory = storyST;
  let rw = innerWidth, rh = innerHeight, rT;
  addEventListener('resize', () => {
    clearTimeout(rT);
    rT = setTimeout(() => {
      if (Math.abs(innerWidth - rw) < 2 && Math.abs(innerHeight - rh) < 120) return;   // ignore mobile toolbar jitter
      rw = innerWidth; rh = innerHeight;
      if (making.ready) { making.prepare(); if (active.story) { making.activate(true); } }
    }, 350);
  });
} else {
  makingSec.classList.add('is-static');
  $('.mk-chapter')?.classList.add('is-on');
}

let idleStarted = false;
function startIdleWork() {
  if (idleStarted) return; idleStarted = true;
  const job = () => { if (making && !making.ready) making.prepare(); };
  const later = () => ('requestIdleCallback' in window ? requestIdleCallback(job, { timeout: 3000 }) : setTimeout(job, 600));
  setTimeout(later, isMobile ? 4200 : 4600);   // after the hero intro has played
}

// ------------------------------------------------------------ configurator
const form = $('.design__panel');
const karatBox = $('.karats');
const summaryText = $('.design__summary-text');
const sendWA = $('#send-wa');
const sendMail = $('#send-mail');
const CUT_WORD = { round: 'round', oval: 'oval', cushion: 'cushion-cut', princess: 'princess-cut', emerald: 'emerald-cut', pear: 'pear-shaped', marquise: 'marquise', baguette: 'baguette-cut' };
function metalPhrase() {
  const m = userCfg.metal;
  if (m === 'platinum') return 'platinum';
  if (m === 'silver') return 'sterling silver';
  return `${userCfg.karat}k ${METALS[m].name.toLowerCase()}`;
}
function describe() {
  const st = STONES[userCfg.stone];
  const stone = st.name.toLowerCase();
  const cut = st.special ? '' : CUT_WORD[userCfg.cut] + ' ';
  const core = `${cut}${stone}`;
  const art = w => (/^[aeiou]/i.test(w) ? 'an' : 'a');
  switch (userCfg.style) {
    case 'trilogy': return `A trilogy ring: ${art(core)} ${core} between two diamonds, in ${metalPhrase()}`;
    case 'halo': return `${art(core) === 'an' ? 'An' : 'A'} ${core} with a diamond halo, in ${metalPhrase()}`;
    case 'cluster': return `A cluster ring: ${art(core)} ${core} ringed with diamonds, in ${metalPhrase()}`;
    default: return `A solitaire ${core} in ${metalPhrase()}`;
  }
}
function renderKarats() {
  const ks = METALS[userCfg.metal].karats;
  if (!ks.map(String).includes(String(userCfg.karat))) userCfg.karat = ks.includes(18) ? 18 : ks[0];
  karatBox.innerHTML = ks.map(k => {
    const label = typeof k === 'number' ? `${k}k` : k === 'PT950' ? 'Platinum 950' : 'Sterling 925';
    return `<label class="chip"><input type="radio" name="karat" value="${k}"${String(k) === String(userCfg.karat) ? ' checked' : ''}><span>${label}</span></label>`;
  }).join('');
}
function updateSummary() {
  const text = describe();
  const msg = `Hi Caitlin! I designed a ring on your website: ${text}. Could we set up a consultation?`;
  sendWA.href = `https://wa.me/${WA}?text=${encodeURIComponent(msg)}`;
  sendMail.href = `mailto:caitlin@tyldesleyjewellers.com?subject=${encodeURIComponent('My ring idea')}&body=${encodeURIComponent(msg)}`;
  if (summaryText.textContent === text) return;
  summaryText.classList.add('is-swap');
  setTimeout(() => { summaryText.textContent = text; summaryText.classList.remove('is-swap'); }, 180);
}
function applyCfg() {
  const sp = STONES[userCfg.stone]?.special;
  $$('input[name="cut"]', form).forEach(i => (i.disabled = !!sp));
  $('.opt__note', form).hidden = !sp;
  updateSummary();
  if (studio && current === 'config') studio.setConfig({ ...userCfg });
}
form?.addEventListener('change', e => {
  const t = e.target;
  if (t.name === 'birth') {
    if (!t.value) return;
    userCfg.stone = t.value;
    $$('input[name="stone"]', form).forEach(i => (i.checked = i.value === t.value));
    applyCfg();
    return;
  }
  if (!(t.name in userCfg)) return;
  userCfg[t.name] = t.name === 'karat' && /^\d+$/.test(t.value) ? +t.value : t.value;
  if (t.name === 'metal') renderKarats();
  if (t.name === 'stone') $('select[name="birth"]', form).value = '';
  applyCfg();
});
if (form) { renderKarats(); updateSummary(); }
ScrollTrigger.create({ trigger: '#design', start: 'top 80%', end: 'bottom 20%', onToggle: s => { active.config = s.isActive; direct(); } });

// ------------------------------------------------------------ collections
const coll = $('.collections__track');
const mm = gsap.matchMedia();
mm.add('(min-width: 960px)', () => {
  if (reduced || !coll) return;
  const dist = () => Math.max(0, coll.scrollWidth - innerWidth);
  gsap.to(coll, {
    x: () => -dist(), ease: 'none',
    scrollTrigger: { trigger: '.collections__pin', start: 'top top', end: () => '+=' + dist(), pin: true, scrub: 0.7, invalidateOnRefresh: true },
  });
});
if (!reduced) {
  gsap.from('.ccard', { y: 60, opacity: 0, duration: 1.2, ease: 'power3.out', stagger: 0.08, scrollTrigger: { trigger: '.collections__track', start: 'top 88%', once: true } });
}
$$('.ccard').forEach(card => {
  const open = () => {
    const items = JSON.parse(card.dataset.gallery).map(g => ({ src: `assets/img/${g.k}-1200.webp`, title: g.t, alt: g.a }));
    openLB(items, 0, card.dataset.title);
  };
  card.addEventListener('click', open);
  card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
});

// ------------------------------------------------------------ buy a design
const buy = $('.buy');
const bdItems = $$('.bd').map(b => {
  const made = b.classList.contains('bd--photo');
  const code = b.dataset.code, when = b.dataset.when;
  const msg = made
    ? `Hi Caitlin, I love design ${code} from your Buy Design range. Could you make something similar for me?`
    : `Hi Caitlin, I'd love to buy design ${code} from your Buy Design range. Could you tell me more?`;
  return {
    src: `assets/img/${b.dataset.k}-1000.webp`, title: `${code} · ${when}${made ? ' · Made' : ''}`, alt: b.querySelector('img').alt,
    cta: `https://wa.me/${WA}?text=${encodeURIComponent(msg)}`, ctaText: made ? 'Ask about a similar piece' : 'Claim this design',
  };
});
$$('.bd').forEach((b, i) => b.addEventListener('click', () => openLB(bdItems, i)));
$('[data-more]')?.addEventListener('click', () => {
  buy.classList.add('is-all');
  requestAnimationFrame(() => ScrollTrigger.refresh());
});

// ------------------------------------------------------------ lightbox
const lb = $('.lb');
const lbImg = $('.lb__fig img');
const lbTitle = $('.lb__title');
const lbCount = $('.lb__count');
const lbCta = $('.lb__cta');
let lbItems = [], lbI = 0, lbLast = null;
function showLB() {
  const it = lbItems[lbI];
  lbImg.classList.add('is-swap');
  const pre = new Image();
  pre.src = it.src;
  const done = () => { lbImg.src = it.src; lbImg.alt = it.alt || it.title; requestAnimationFrame(() => lbImg.classList.remove('is-swap')); };
  (pre.decode ? pre.decode() : Promise.resolve()).then(done, done);
  lbTitle.textContent = it.title;
  lbCount.textContent = `${lbI + 1} / ${lbItems.length}`;
  if (it.cta) { lbCta.hidden = false; lbCta.href = it.cta; lbCta.querySelector('span').textContent = it.ctaText; } else lbCta.hidden = true;
}
function openLB(items, i) {
  lbItems = items; lbI = i; lbLast = document.activeElement;
  lb.hidden = false;
  requestAnimationFrame(() => lb.classList.add('is-on'));
  document.body.classList.add('is-locked'); lenis?.stop();
  showLB();
  $('.lb__close').focus({ preventScroll: true });
}
function closeLB() {
  if (lb.hidden) return;
  lb.classList.remove('is-on');
  setTimeout(() => { lb.hidden = true; lbImg.removeAttribute('src'); }, 400);
  document.body.classList.remove('is-locked'); lenis?.start();
  lbLast?.focus?.({ preventScroll: true });
}
const stepLB = d => { lbI = (lbI + d + lbItems.length) % lbItems.length; showLB(); };
$('.lb__close').addEventListener('click', closeLB);
$('.lb__prev').addEventListener('click', () => stepLB(-1));
$('.lb__next').addEventListener('click', () => stepLB(1));
lb.addEventListener('click', e => { if (e.target === lb) closeLB(); });
addEventListener('keydown', e => { if (lb.hidden) return; if (e.key === 'ArrowRight') stepLB(1); if (e.key === 'ArrowLeft') stepLB(-1); });
let lbX = null;
lb.addEventListener('pointerdown', e => { lbX = e.clientX; });
lb.addEventListener('pointerup', e => { if (lbX == null) return; const dx = e.clientX - lbX; lbX = null; if (Math.abs(dx) > 45) stepLB(dx < 0 ? 1 : -1); });

// ------------------------------------------------------------ remakes: before / after
const ba = $('[data-ba]');
if (ba) {
  const handle = $('.ba__handle', ba);
  let pos = 50, drag = false;
  const setPos = v => { pos = Math.max(0, Math.min(100, v)); ba.style.setProperty('--pos', pos + '%'); handle.setAttribute('aria-valuenow', Math.round(pos)); };
  const fromEvent = e => { const r = ba.getBoundingClientRect(); setPos(((e.clientX - r.left) / r.width) * 100); };
  ba.addEventListener('pointerdown', e => { drag = true; ba.setPointerCapture(e.pointerId); fromEvent(e); });
  ba.addEventListener('pointermove', e => { if (drag) fromEvent(e); });
  ba.addEventListener('pointerup', () => (drag = false));
  ba.addEventListener('pointercancel', () => (drag = false));
  handle.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') setPos(pos - 5); if (e.key === 'ArrowRight') setPos(pos + 5); });
  const sweep = () => { if (reduced) return setPos(50); const o = { v: 88 }; gsap.fromTo(o, { v: 88 }, { v: 50, duration: 1.8, ease: 'power3.inOut', onUpdate: () => setPos(o.v) }); };
  $$('.remakes__tabs button').forEach(btn => btn.addEventListener('click', () => {
    const i = btn.dataset.i;
    $$('.remakes__tabs button').forEach(b => { const on = b === btn; b.classList.toggle('is-on', on); b.setAttribute('aria-selected', on); });
    $$('.ba__pair', ba).forEach(p => p.classList.toggle('is-on', p.dataset.i === i));
    sweep();
  }));
  setPos(88);
  ScrollTrigger.create({ trigger: ba, start: 'top 75%', once: true, onEnter: sweep });
}

// ------------------------------------------------------------ engraving
const engInput = $('.engrave__try input');
const engText = $('.engrave__text');
const engPath = $('.engrave__text textPath');
const spark = $('.engrave__spark');
let engTimer = null;
const engMono = $('.engrave__mono');
function engrave(text) {
  clearTimeout(engTimer);
  const initial = (text.match(/[A-Za-z0-9]/) || ['T'])[0].toUpperCase();
  if (engMono) engMono.textContent = initial;
  if (reduced) { engPath.textContent = text; return; }
  let i = 0;
  const step = () => {
    engPath.textContent = text.slice(0, i);
    const n = engPath.textContent.length;
    if (n) {
      try { const p = engText.getEndPositionOfChar(n - 1); spark.setAttribute('cx', p.x); spark.setAttribute('cy', p.y - 8); spark.style.opacity = 1; } catch { /* layout not ready */ }
    }
    i++;
    if (i <= text.length) engTimer = setTimeout(step, 75);
    else engTimer = setTimeout(() => (spark.style.opacity = 0), 250);
  };
  step();
}
if (engInput) {
  let t;
  engInput.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => engrave(engInput.value.trim() || 'Always & forever'), 280); });
  $$('.seg button').forEach(b => b.addEventListener('click', () => {
    $$('.seg button').forEach(x => x.classList.toggle('is-on', x === b));
    engText.classList.toggle('is-hand', b.dataset.style === 'hand');
    engrave(engInput.value.trim() || 'Always & forever');
  }));
  ScrollTrigger.create({ trigger: '.engrave__band', start: 'top 75%', once: true, onEnter: () => engrave(engInput.value) });
}

// ------------------------------------------------------------ testimonials
const quotes = $$('.quote');
const qDots = $('.quotes__dots');
if (quotes.length) {
  let qi = 0, qT = null, qVisible = false;
  qDots.innerHTML = quotes.map(() => '<i></i>').join('');
  const dots = $$('i', qDots);
  const show = i => {
    qi = (i + quotes.length) % quotes.length;
    quotes.forEach((q, k) => q.classList.toggle('is-on', k === qi));
    dots.forEach((d, k) => { d.classList.remove('is-on'); if (k === qi) { void d.offsetWidth; d.classList.add('is-on'); } });
    clearTimeout(qT);
    if (qVisible && !reduced) qT = setTimeout(() => show(qi + 1), 7000);
  };
  $('[data-prev]').addEventListener('click', () => show(qi - 1));
  $('[data-next]').addEventListener('click', () => show(qi + 1));
  new IntersectionObserver(([e]) => { qVisible = e.isIntersecting; show(qi); }).observe($('.quotes'));
  let qx = null;
  $('.quotes').addEventListener('pointerdown', e => (qx = e.clientX));
  $('.quotes').addEventListener('pointerup', e => { if (qx == null) return; const dx = e.clientX - qx; qx = null; if (Math.abs(dx) > 50) show(qi + (dx < 0 ? 1 : -1)); });
}

// ------------------------------------------------------------ shop filter
$$('.shop__filters button').forEach(btn => btn.addEventListener('click', () => {
  const f = btn.dataset.filter;
  $$('.shop__filters button').forEach(b => b.classList.toggle('is-on', b === btn));
  const cards = $$('.pcard');
  cards.forEach(c => c.classList.toggle('is-hidden', f !== 'all' && c.dataset.cat !== f));
  if (!reduced) gsap.fromTo(cards.filter(c => !c.classList.contains('is-hidden')), { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out', stagger: 0.04, clearProps: 'transform' });
  requestAnimationFrame(() => ScrollTrigger.refresh());
}));

// ------------------------------------------------------------ contact gold dust
const dustC = $('.contact__dust');
if (dustC && !reduced) {
  const ctx = dustC.getContext('2d');
  let W = 0, H = 0, parts = [], on = false;
  const size = () => {
    const d = Math.min(2, devicePixelRatio || 1);
    W = dustC.clientWidth; H = dustC.clientHeight;
    dustC.width = W * d; dustC.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0);
    parts = Array.from({ length: isMobile ? 46 : 90 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: 0.4 + Math.random() * 1.8, s: 8 + Math.random() * 26, p: Math.random() * 6.28 }));
  };
  new IntersectionObserver(([e]) => { on = e.isIntersecting; if (on && !W) size(); }).observe(dustC);
  addEventListener('resize', () => { if (W) size(); });
  gsap.ticker.add((t, dt) => {
    if (!on || !W) return;
    ctx.clearRect(0, 0, W, H);
    for (const q of parts) {
      q.y -= q.s * dt / 1000; q.x += Math.sin(t * 0.6 + q.p) * 0.15;
      if (q.y < -10) { q.y = H + 10; q.x = Math.random() * W; }
      const a = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(t * 2 + q.p * 3));
      ctx.fillStyle = `rgba(235,206,170,${a.toFixed(3)})`;
      ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, 6.283); ctx.fill();
    }
  });
}

// ------------------------------------------------------------ cursor + magnetic buttons (desktop)
if (finePointer && !reduced) {
  const cur = $('.cursor');
  const qx = gsap.quickTo(cur, 'x', { duration: 0.35, ease: 'power3' });
  const qy = gsap.quickTo(cur, 'y', { duration: 0.35, ease: 'power3' });
  addEventListener('pointermove', e => { qx(e.clientX); qy(e.clientY); cur.classList.add('is-on'); }, { passive: true });
  document.addEventListener('pointerover', e => cur.classList.toggle('is-link', !!e.target.closest('a, button, .ccard, .bd, .chip, [data-ba], .gl-host')));
  $$('.magnetic').forEach(b => {
    b.addEventListener('pointermove', e => {
      const r = b.getBoundingClientRect();
      gsap.to(b, { x: (e.clientX - r.left - r.width / 2) * 0.22, y: (e.clientY - r.top - r.height / 2) * 0.3, duration: 0.4, ease: 'power3' });
    });
    b.addEventListener('pointerleave', () => gsap.to(b, { x: 0, y: 0, duration: 0.8, ease: 'elastic.out(1, .4)' }));
  });
}

$$('main > section[data-tone], .ftr').forEach(sec => {
  ScrollTrigger.create({
    trigger: sec, start: 'top top+=40', end: 'bottom top+=40',
    onToggle: s => { if (s.isActive && sec.id !== 'making') setTone(sec.dataset.tone); },
  });
});
// the dock steps aside where the contact buttons already are
ScrollTrigger.create({ trigger: '#contact', start: 'top 70%', end: 'max', onToggle: s => dock?.classList.toggle('is-away', s.isActive) });
ScrollTrigger.sort();
ScrollTrigger.refresh();

// one refresh once everything (images included) has loaded - never per image
addEventListener('load', () => ScrollTrigger.refresh());
window.__tyl = { studio, making, userCfg };
