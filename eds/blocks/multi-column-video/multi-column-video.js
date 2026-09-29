/*
** Authoring format **
Row 1 (optional) - intro: eyebrow paragraph, heading, description
One row per video:
Col 1 - thumbnail image
Col 2 - video link (YouTube, Vimeo or .mp4/.webm)
Col 3 - title (heading or first paragraph) + description

Clicking a thumbnail plays the video in a dialog. Videos that cannot be
embedded fall back to a plain link.
*/

import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';
import {
  bindCarouselNavigationTracking,
  triggerCTAClickWithLinkAndTitle,
} from '../../scripts/analytics_1.js';

const DESKTOP = window.matchMedia('(width >= 992px)');
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)');
const URL_PATTERN = /^https?:\/\/\S+$/;
const ARROW_ICON = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function getVideoUrl(row) {
  const anchor = row.querySelector('a[href]');
  if (anchor) return anchor.href;
  const textCell = [...row.children].find((col) => URL_PATTERN.test(col.textContent.trim()));
  return textCell?.textContent.trim() || '';
}

/**
 * Resolves an authored video link to an embeddable source.
 * @returns {{ type: 'iframe'|'video', src: string }|null}
 */
function getEmbed(link) {
  let url;
  try {
    url = new URL(link, window.location.href);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, '');
  if (host === 'youtu.be' || host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
    const id = host === 'youtu.be'
      ? url.pathname.slice(1)
      : url.searchParams.get('v') || url.pathname.match(/\/(?:embed|shorts|live)\/([^/?]+)/)?.[1];
    if (!id) return null;
    return { type: 'iframe', src: `https://www.youtube.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0` };
  }
  if (host.endsWith('vimeo.com')) {
    const id = url.pathname.match(/\/(\d+)/)?.[1];
    if (!id) return null;
    return { type: 'iframe', src: `https://player.vimeo.com/video/${id}?autoplay=1` };
  }
  if (/\.(mp4|webm)$/i.test(url.pathname)) return { type: 'video', src: url.href };
  return null;
}

function optimizePicture(picture) {
  const img = picture.querySelector('img');
  if (!img) return picture;
  // media hosted elsewhere cannot be resized by the media bus
  if (new URL(img.src, window.location.href).origin !== window.location.origin) return picture;
  const optimized = createOptimizedPicture(img.src, img.alt, false, [
    { media: '(width >= 992px)', width: '650' },
    { width: '520' },
  ]);
  moveInstrumentation(img, optimized.querySelector('img'));
  return optimized;
}

function decorateIntro(row) {
  const intro = document.createElement('div');
  intro.className = 'multi-column-video-intro';
  moveInstrumentation(row, intro);
  [...row.children].forEach((col) => intro.append(...col.childNodes));

  const heading = intro.querySelector('h1, h2, h3, h4, h5, h6');
  if (heading) {
    heading.classList.add('multi-column-video-heading');
    let sibling = heading.previousElementSibling;
    while (sibling) {
      sibling.classList.add('multi-column-video-eyebrow');
      sibling = sibling.previousElementSibling;
    }
  }
  return intro;
}

function splitTitle(cols) {
  const nodes = cols.flatMap((col) => [...col.children]);
  if (!nodes.length) {
    // plain-text cell without paragraphs
    const text = cols.map((col) => col.textContent.trim()).find(Boolean);
    return text ? { titleText: text, rest: [] } : {};
  }
  const titleEl = nodes.find((el) => /^H[1-6]$/.test(el.tagName)) || nodes[0];
  return { titleText: titleEl.textContent.trim(), rest: nodes.filter((el) => el !== titleEl) };
}

function createDialog() {
  const dialog = document.createElement('dialog');
  dialog.className = 'multi-column-video-dialog';
  dialog.innerHTML = `
    <div class="multi-column-video-dialog-content">
      <button type="button" class="multi-column-video-dialog-close" aria-label="Close video"></button>
      <div class="multi-column-video-dialog-frame"></div>
    </div>`;
  const frame = dialog.querySelector('.multi-column-video-dialog-frame');
  dialog.querySelector('.multi-column-video-dialog-close').addEventListener('click', () => dialog.close());
  // clicks on the backdrop land on the dialog element itself
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
  // dropping the player stops playback
  dialog.addEventListener('close', () => {
    frame.textContent = '';
  });

  const open = (embed, title) => {
    let player;
    if (embed.type === 'iframe') {
      player = document.createElement('iframe');
      player.allow = 'autoplay; fullscreen; encrypted-media; picture-in-picture';
    } else {
      player = document.createElement('video');
      player.controls = true;
      player.autoplay = true;
      player.playsInline = true;
    }
    player.src = embed.src;
    player.title = title;
    frame.replaceChildren(player);
    dialog.setAttribute('aria-label', title);
    dialog.showModal();
  };
  return { dialog, open };
}

function decorateItem(row, index, openVideo, sectionTitle) {
  const cols = [...row.children];
  const pictureCol = cols.find((col) => col.querySelector('picture'));
  const videoUrl = getVideoUrl(row);
  const textCols = cols.filter((col) => col !== pictureCol
    && !col.querySelector('a[href]') && !URL_PATTERN.test(col.textContent.trim()));
  const { titleText = '', rest = [] } = splitTitle(textCols);
  const label = titleText || `Video ${index + 1}`;

  const item = document.createElement('li');
  item.className = 'multi-column-video-item';
  moveInstrumentation(row, item);

  const embed = videoUrl ? getEmbed(videoUrl) : null;
  let media;
  if (embed) {
    media = document.createElement('button');
    media.type = 'button';
    media.setAttribute('aria-label', `Play video: ${label}`);
    media.addEventListener('click', () => {
      triggerCTAClickWithLinkAndTitle(videoUrl, label, sectionTitle);
      openVideo(embed, label);
    });
  } else if (videoUrl) {
    media = document.createElement('a');
    media.href = videoUrl;
    media.target = '_blank';
    media.rel = 'noopener noreferrer';
    media.setAttribute('aria-label', `Watch video: ${label} (opens in a new tab)`);
  } else {
    media = document.createElement('div');
  }
  media.classList.add('multi-column-video-media');
  const picture = pictureCol?.querySelector('picture');
  if (picture) media.append(optimizePicture(picture));
  if (videoUrl) media.insertAdjacentHTML('beforeend', '<span class="multi-column-video-play" aria-hidden="true"></span>');
  item.append(media);

  const body = document.createElement('div');
  body.className = 'multi-column-video-body';
  if (titleText) {
    const title = document.createElement('h3');
    title.className = 'multi-column-video-title';
    title.textContent = titleText;
    body.append(title);
  }
  rest.forEach((el) => {
    el.classList.add('multi-column-video-description');
    body.append(el);
  });
  item.append(body);
  return item;
}

function setupNavigation(block, track) {
  const items = [...track.children];
  const controls = document.createElement('div');
  controls.className = 'multi-column-video-controls';
  controls.innerHTML = `
    <button type="button" class="multi-column-video-prev" aria-label="Previous">${ARROW_ICON}</button>
    <button type="button" class="multi-column-video-next" aria-label="Next">${ARROW_ICON}</button>`;
  const [prev, next] = controls.querySelectorAll('button');

  const dots = document.createElement('div');
  dots.className = 'multi-column-video-dots';
  items.forEach((item, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.setAttribute('aria-label', `Show video ${i + 1} of ${items.length}`);
    dot.addEventListener('click', () => {
      track.scrollTo({ left: item.offsetLeft - items[0].offsetLeft, behavior: REDUCED_MOTION.matches ? 'auto' : 'smooth' });
    });
    dots.append(dot);
  });

  const step = () => (items[1] ? items[1].offsetLeft - items[0].offsetLeft : track.clientWidth);
  const scrollByStep = (dir) => track.scrollBy({ left: dir * step(), behavior: REDUCED_MOTION.matches ? 'auto' : 'smooth' });
  prev.addEventListener('click', () => scrollByStep(-1));
  next.addEventListener('click', () => scrollByStep(1));

  let frame;
  const update = () => {
    frame = null;
    const max = track.scrollWidth - track.clientWidth;
    prev.disabled = track.scrollLeft <= 1;
    next.disabled = track.scrollLeft >= max - 1;
    const active = Math.min(items.length - 1, Math.round(track.scrollLeft / step()));
    [...dots.children].forEach((dot, i) => {
      if (i === active) dot.setAttribute('aria-current', 'true');
      else dot.removeAttribute('aria-current');
    });
    controls.hidden = max <= 1;
    dots.hidden = max <= 1;
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };
  track.addEventListener('scroll', schedule, { passive: true });
  new ResizeObserver(schedule).observe(track);
  DESKTOP.addEventListener('change', schedule);
  update();

  block.append(controls, dots);
}

export default function decorate(block) {
  const rows = [...block.children];
  const introRows = rows.filter((row) => !row.querySelector('picture') && !getVideoUrl(row));
  const itemRows = rows.filter((row) => !introRows.includes(row));

  const intro = introRows.length ? decorateIntro(introRows[0]) : null;
  introRows.slice(1).forEach((row) => {
    [...row.children].forEach((col) => intro.append(...col.childNodes));
  });
  const sectionTitle = intro?.querySelector('.multi-column-video-heading')?.textContent.trim() || '';

  const { dialog, open } = createDialog();
  const track = document.createElement('ul');
  track.className = 'multi-column-video-track';
  track.setAttribute('aria-label', sectionTitle ? `${sectionTitle} videos` : 'Videos');
  itemRows.forEach((row, i) => track.append(decorateItem(row, i, open, sectionTitle)));

  block.replaceChildren();
  if (intro) block.append(intro);

  const carousel = document.createElement('div');
  carousel.className = 'multi-column-video-carousel';
  carousel.append(track);
  block.append(carousel, dialog);
  if (track.children.length) setupNavigation(carousel, track);
  bindCarouselNavigationTracking(carousel, sectionTitle);
}
