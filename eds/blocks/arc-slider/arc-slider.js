import { createOptimizedPicture } from '../../scripts/aem.js';

/**
 * arc-slider — a start screen (banner + "Enter") that opens a lookbook
 * carousel: each slide has a full-width background, a coloured text panel
 * and an arch that previews the next slide. Moving on grows the next slide
 * out of the arch (source: Asian Paints Nilaya Arc "arcslider").
 *
 * Authored rows (first cell = keyword); see README in arc-slider.css:
 *   start | banner image(s) | button label
 *   label | carousel name (screen readers)
 *   slide | background image(s) | arch preview image | text art image(s)
 *         | heading + description | panel colour
 *   end   | arch image shown on the last slide
 * Image cells take ONE image (all sizes) or TWO: mobile first, desktop
 * second (the desktop one is used from 992px).
 */

const DESKTOP_MQ = '(min-width: 992px)';
const ZOOM_MS = 1500;
const FADE_MS = 800;

const icon = (d) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30" width="30" height="30" fill="none" aria-hidden="true" focusable="false"><path d="${d}" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICONS = {
  prev: icon('M13.3333 6.25L5 15M5 15L13.3333 23.75M5 15L25 15'),
  next: icon('M16.6667 6.25L25 15M25 15L16.6667 23.75M25 15L5 15'),
  refresh: icon('M23.9111 18.125C22.6386 22.1174 18.9942 25 14.697 25C9.34148 25 5 20.5228 5 15C5 9.47715 9.34148 5 14.697 5C17.8382 5 20.6306 6.54031 22.4027 8.92849M23.0967 10C22.8874 9.62692 22.6554 9.26908 22.4027 8.92849M22.4027 8.92849L20.1515 11.25H25V6.25L22.4027 8.92849ZM22.5758 10.8333L24.0909 8.75'),
  enter: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="17" height="20" aria-hidden="true" focusable="false"><path fill="currentColor" fill-rule="evenodd" d="M10.2563 4.13128C10.598 3.78957 11.152 3.78957 11.4937 4.13128L16.7437 9.38128C17.0854 9.72299 17.0854 10.277 16.7437 10.6187L11.4937 15.8687C11.152 16.2104 10.598 16.2104 10.2563 15.8687C9.91457 15.527 9.91457 14.973 10.2563 14.6313L14.0126 10.875L3.875 10.875C3.39175 10.875 3 10.4832 3 10C3 9.51675 3.39175 9.125 3.875 9.125H14.0126L10.2563 5.36872C9.91457 5.02701 9.91457 4.47299 10.2563 4.13128Z"/></svg>',
};

const text = (node) => (node?.textContent || '').replace(/\s+/g, ' ').trim();
const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function el(tag, className, attrs = {}) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
  return node;
}

/** Copy the authored intrinsic size so the browser reserves space (no CLS). */
function copySize(from, to) {
  const w = from.getAttribute('width');
  const h = from.getAttribute('height');
  if (w && h) {
    to.setAttribute('width', w);
    to.setAttribute('height', h);
  }
}

/**
 * Responsive picture from one or two authored images (mobile first, desktop
 * second). Desktop sources win from 992px.
 */
function picture(imgs, {
  alt = '', eager = false, desktopWidth = '2000', mobileWidth = '750',
} = {}) {
  const [mobile, desktop] = imgs;
  if (!mobile) return null;
  if (!desktop) {
    const pic = createOptimizedPicture(mobile.src, alt, eager, [
      { media: DESKTOP_MQ, width: desktopWidth }, { width: mobileWidth },
    ]);
    copySize(mobile, pic.querySelector('img'));
    return pic;
  }
  const pic = createOptimizedPicture(mobile.src, alt, eager, [{ width: mobileWidth }]);
  copySize(mobile, pic.querySelector('img'));
  // only its <source>s are used: build it lazy so its detached <img> never
  // downloads (a detached eager <img> fetches immediately, e.g. a 2000px
  // desktop PNG on phones, competing with the LCP image)
  const desk = createOptimizedPicture(desktop.src, alt, false, [{ width: desktopWidth }]);
  [...desk.querySelectorAll('source')].reverse().forEach((source) => {
    source.setAttribute('media', DESKTOP_MQ);
    copySize(desktop, source);
    pic.prepend(source);
  });
  return pic;
}

function readRows(block) {
  const config = {
    start: null, label: '', slides: [], end: null,
  };
  [...block.children].forEach((row) => {
    const cells = [...row.children];
    const kind = text(cells[0]).toLowerCase();
    const imgs = (i) => [...(cells[i]?.querySelectorAll('img') || [])];
    if (kind === 'start') {
      config.start = { imgs: imgs(1), label: text(cells[2]) || 'Enter' };
    } else if (kind === 'label') {
      config.label = text(cells[1]);
    } else if (kind === 'slide') {
      const colour = text(cells[5]);
      config.slides.push({
        bg: imgs(1),
        preview: imgs(2)[0] || null,
        art: imgs(3),
        copy: cells[4] || null,
        colour: colour && CSS.supports('color', colour) ? colour : '',
      });
    } else if (kind === 'end') {
      config.end = imgs(1)[0] || null;
    }
  });
  config.slides = config.slides.filter((s) => s.bg.length || s.art.length || text(s.copy));
  return config;
}

/** Wait for an image to be ready (bounded, so a slow image never blocks). */
async function ready(img, timeout = 1200) {
  if (!img || (img.complete && img.naturalWidth)) return;
  img.loading = 'eager';
  await Promise.race([
    new Promise((resolve) => {
      img.addEventListener('load', resolve, { once: true });
      img.addEventListener('error', resolve, { once: true });
    }),
    wait(timeout),
  ]);
}

export default function decorate(block) {
  const config = readRows(block);
  if (!config.slides.length) return;
  const firstSection = block.closest('.section') === document.querySelector('main .section');
  const total = config.slides.length;
  const label = config.label || 'Lookbook';

  /* --- start screen --- */
  let start = null;
  let enter = null;
  if (config.start) {
    start = el('div', 'arc-slider-start');
    const banner = picture(config.start.imgs, {
      alt: config.start.imgs[0]?.alt || '', eager: firstSection,
    });
    if (banner) start.append(banner);
    enter = el('button', 'arc-slider-enter', { type: 'button' });
    enter.append(config.start.label);
    enter.insertAdjacentHTML('beforeend', ICONS.enter);
    start.append(enter);
  }

  /* --- stage (carousel) --- */
  const stage = el('div', 'arc-slider-stage', {
    role: 'region', 'aria-roledescription': 'carousel', 'aria-label': label, tabindex: '-1',
  });
  const slidesWrap = el('div', 'arc-slider-slides');
  const slides = config.slides.map((s, i) => {
    const slide = el('div', 'arc-slider-slide', {
      role: 'group', 'aria-roledescription': 'slide', 'aria-label': `${i + 1} of ${total}`,
    });
    slide.hidden = true;
    const bg = el('div', 'arc-slider-bg');
    const bgPic = picture(s.bg, { alt: s.bg[0]?.alt || '', eager: !start && firstSection && i === 0 });
    if (bgPic) bg.append(bgPic);
    const panel = el('div', 'arc-slider-panel');
    if (s.colour) panel.style.setProperty('--arc-slider-panel-bg', s.colour);
    const content = el('div', 'arc-slider-content');
    if (s.art.length) {
      const art = picture(s.art, { desktopWidth: '1800' });
      art.classList.add('arc-slider-art');
      // text art is authored at 2x: show it at its natural (1x) size
      const img = art.querySelector('img');
      img.setAttribute('aria-hidden', 'true');
      const halve = () => {
        if (img.naturalWidth) img.style.width = `${img.naturalWidth / 2}px`;
      };
      img.addEventListener('load', halve);
      if (img.complete) halve();
      content.append(art);
    }
    if (s.copy) {
      const copy = el('div', `arc-slider-copy${s.art.length ? ' arc-slider-visually-hidden' : ''}`);
      copy.append(...s.copy.childNodes);
      content.append(copy);
    }
    panel.append(content);
    slide.append(bg, panel);
    slidesWrap.append(slide);
    return slide;
  });

  // arch: previews the next slide (or the "end" image on the last slide)
  const archWrap = el('div', 'arc-slider-arch-wrap');
  const arch = el('div', 'arc-slider-arch');
  const previews = config.slides.map((s) => {
    if (!s.preview) return null;
    const pic = picture([s.preview], { desktopWidth: '810', mobileWidth: '400' });
    arch.append(pic);
    return pic;
  });
  const endPic = config.end ? picture([config.end], { desktopWidth: '810', mobileWidth: '400' }) : null;
  if (endPic) arch.append(endPic);
  [...arch.querySelectorAll('img')].forEach((img) => { img.alt = ''; });

  const nav = el('div', 'arc-slider-nav');
  const prevBtn = el('button', 'arc-slider-prev', { type: 'button' });
  prevBtn.innerHTML = ICONS.prev;
  const nextBtn = el('button', 'arc-slider-next', { type: 'button' });
  nav.append(prevBtn, nextBtn);

  const dots = el('div', 'arc-slider-dots', { 'aria-hidden': 'true' });
  const dotEls = config.slides.map(() => {
    const dot = el('span');
    dots.append(dot);
    return dot;
  });
  archWrap.append(arch, nav, dots);

  const status = el('p', 'arc-slider-visually-hidden', { 'aria-live': 'polite' });
  stage.append(slidesWrap, archWrap, status);

  block.replaceChildren(...[start, stage].filter(Boolean));
  if (start) stage.hidden = true;

  /* --- state --- */
  let current = -1;
  let busy = false;

  const slideTitle = (i) => text(slides[i].querySelector('.arc-slider-copy :is(h1, h2, h3, h4, h5, h6, p)'));

  const preload = (i) => {
    const img = slides[i]?.querySelector('.arc-slider-bg img');
    if (img) img.loading = 'eager';
    const pic = previews[i + 1];
    if (pic) pic.querySelector('img').loading = 'eager';
  };

  const updateChrome = () => {
    const last = current === total - 1;
    // arch shows the next slide's preview; the "end" image on the last slide
    const showing = last ? endPic : previews[current + 1];
    [...arch.children].forEach((pic) => pic.classList.toggle('is-shown', pic === showing));
    showing?.querySelectorAll('img').forEach((img) => { img.loading = 'eager'; });
    nextBtn.innerHTML = last ? ICONS.refresh : ICONS.next;
    nextBtn.setAttribute('aria-label', last ? 'Start again' : 'Next slide');
    prevBtn.setAttribute('aria-label', current === 0 && start ? 'Back to start' : 'Previous slide');
    prevBtn.disabled = current === 0 && !start;
    dotEls.forEach((dot, i) => dot.classList.toggle('is-active', i === current));
    const title = slideTitle(current);
    status.textContent = `Slide ${current + 1} of ${total}${title ? `: ${title}` : ''}`;
    preload(current + 1);
  };

  const show = (i) => {
    slides.forEach((s, n) => {
      s.hidden = n !== i;
      s.classList.remove('is-entering', 'is-leaving');
    });
    current = i;
    updateChrome();
  };

  // the arch's box inside the stage, as a clip-path (the zoom start/end)
  const archClip = () => {
    const s = stage.getBoundingClientRect();
    const a = arch.getBoundingClientRect();
    const r = getComputedStyle(arch);
    const round = `${r.borderTopLeftRadius} ${r.borderTopRightRadius} ${r.borderBottomRightRadius} ${r.borderBottomLeftRadius}`;
    return `inset(${a.top - s.top}px ${s.right - a.right}px ${s.bottom - a.bottom}px ${a.left - s.left}px round ${round})`;
  };
  const FULL = 'inset(0px 0px 0px 0px round 0px 0px 0px 0px)';

  const go = async (target) => {
    if (busy || target === current || target < 0 || target >= total) return;
    const from = current;
    const forward = target > from;
    const incoming = slides[target];
    const outgoing = slides[from];
    if (reducedMotion() || from < 0) { show(target); return; }
    busy = true;
    incoming.hidden = false;
    await ready(incoming.querySelector('.arc-slider-bg img'));
    const panelIn = { duration: FADE_MS, easing: 'ease-in-out' };
    if (forward) {
      // next: the incoming slide grows out of the arch over the current one
      incoming.classList.add('is-entering');
      const clip = archClip();
      incoming.querySelector('.arc-slider-bg').animate([{ clipPath: clip }, { clipPath: FULL }], { duration: ZOOM_MS, easing: 'ease-in-out' });
      incoming.querySelector('.arc-slider-panel').animate([{ opacity: 0 }, { opacity: 1 }], panelIn);
      incoming.querySelector('.arc-slider-content').animate([{ opacity: 0 }, { opacity: 0, offset: 0.5 }, { opacity: 1 }], { duration: FADE_MS * 2 });
    } else {
      // previous: the current slide shrinks back into the arch
      outgoing.classList.add('is-leaving');
      outgoing.querySelector('.arc-slider-bg').animate([{ clipPath: FULL }, { clipPath: archClip() }], { duration: ZOOM_MS, easing: 'ease-in-out', fill: 'forwards' });
      outgoing.querySelector('.arc-slider-panel').animate([{ opacity: 1 }, { opacity: 0 }], { ...panelIn, fill: 'forwards' });
      incoming.querySelector('.arc-slider-content').animate([{ opacity: 0 }, { opacity: 0, offset: 0.5 }, { opacity: 1 }], { duration: FADE_MS * 2 });
    }
    current = target;
    updateChrome();
    await wait(ZOOM_MS);
    outgoing.getAnimations({ subtree: true }).forEach((a) => a.cancel());
    show(target);
    busy = false;
  };

  const open = () => {
    if (start) start.hidden = true;
    stage.hidden = false;
    show(0);
    nextBtn.focus();
  };

  const backToStart = () => {
    if (!start) { go(0); return; }
    stage.hidden = true;
    start.hidden = false;
    current = -1;
    enter.focus();
  };

  enter?.addEventListener('click', open);
  nextBtn.addEventListener('click', () => {
    if (current === total - 1) backToStart();
    else go(current + 1);
  });
  prevBtn.addEventListener('click', () => {
    if (current === 0) backToStart();
    else go(current - 1);
  });
  stage.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' && current < total - 1) { e.preventDefault(); go(current + 1); }
    if (e.key === 'ArrowLeft' && current > 0) { e.preventDefault(); go(current - 1); }
  });

  if (!start) show(0);
}
