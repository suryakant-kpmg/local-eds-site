/*
 * Video Switcher
 * One large muted autoplay video with a strip of thumbnails that switch between videos.
 * Advances to the next video when the current one ends.
 *
 * Authoring: one row per slide, one column per field (read by position):
 *   | title | subtitle | image | desktop video link | mobile video link |
 * The image is the thumbnail and the video poster. The mobile video (below 992px) is optional and
 * falls back to the desktop one; a slide with only a mobile video uses it everywhere. Rows without
 * any video are skipped. Plain-text URLs work as well as links.
 * Older content with everything in one cell (image, desktop link, optional mobile link, heading,
 * description) is still read, by content type.
 *
 * Playback: autoplays (muted, inline) when the block scrolls into view, pauses while it is
 * out of view. There is no play/pause button.
 */
import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation , } from '../../scripts/scripts.js';
import { trackEvent , pushAdobeCtaClickEvent } from '../../scripts/analytics_1.js';  

const DESKTOP = window.matchMedia('(min-width: 992px)');
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)');
const VIDEO_EXT = /\.(mp4|webm|ogv|mov|m4v)$/i;
const SVG_NS = 'http://www.w3.org/2000/svg';
// straight arrows, as on the source's round prev/next buttons
const ICONS = {
  prev: 'M19 12H5M11 6l-6 6 6 6',
  next: 'M5 12h14M13 6l6 6-6 6',
};

let instances = 0;

function createIcon(name) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', `video-switcher-icon-${name}`);
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', ICONS[name]);
  svg.append(path);
  return svg;
}

function createButton(className, label, icon) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.setAttribute('aria-label', label);
  button.append(createIcon(icon));
  return button;
}

function posterUrl(img, width) {
  if (!img) return '';
  const url = new URL(img.src, window.location.href);
  url.searchParams.set('width', width);
  url.searchParams.set('format', 'webply');
  url.searchParams.set('optimize', 'medium');
  return url.href;
}

const COLUMNS = ['title', 'subtitle', 'image', 'desktop', 'mobile'];

// a video URL from a column: its link, or a URL typed as plain text. A full video URL in the text
// wins over the href, since content syncs can rewrite the href to a site-relative path that 404s
function videoUrl(cell) {
  const text = cell?.textContent.trim() || '';
  const href = cell?.querySelector('a[href]')?.href || text;
  try {
    if (/^https?:\/\/\S+$/i.test(text) && VIDEO_EXT.test(new URL(text).pathname)) return new URL(text).href;
    return href ? new URL(href, window.location.href).href : '';
  } catch (e) {
    return '';
  }
}

/**
 * Reads one row in the column layout: | title | subtitle | image | desktop | mobile |.
 * @param {Element} row The authored row
 */
function parseColumns(row) {
  const cells = Object.fromEntries(COLUMNS.map((name, i) => [name, row.children[i]]));
  const desktop = videoUrl(cells.desktop) || videoUrl(cells.mobile);
  if (!desktop) return null;

  const caption = document.createElement('div');
  caption.className = 'video-switcher-caption';
  moveInstrumentation(row, caption);

  const titleText = cells.title?.textContent.trim() || '';
  if (titleText) {
    const title = document.createElement('h3');
    title.className = 'video-switcher-title';
    title.textContent = titleText;
    moveInstrumentation(cells.title, title);
    caption.append(title);
  }
  if (cells.subtitle?.textContent.trim()) {
    if (cells.subtitle.children.length) caption.append(...cells.subtitle.children);
    else {
      const p = document.createElement('p');
      p.textContent = cells.subtitle.textContent.trim();
      caption.append(p);
    }
  }

  const img = cells.image?.querySelector('img') || null;
  return {
    caption,
    img,
    label: titleText || img?.alt || '',
    desktop,
    mobile: videoUrl(cells.mobile) || desktop,
  };
}

/**
 * Reads one authored row into an item. Rows without any video are skipped.
 * @param {Element} row The authored row
 */
function parseItem(row) {
  // the column layout; rows with fewer cells are the older one-cell content
  if (row.children.length >= 4) return parseColumns(row);

  const links = [...row.querySelectorAll('a[href]')];
  const videoLinks = links.filter((a) => VIDEO_EXT.test(new URL(a.href).pathname));
  const [desktop, mobile] = videoLinks.length ? videoLinks : links;
  if (!desktop) return null;

  const img = row.querySelector('picture img');
  const caption = document.createElement('div');
  caption.className = 'video-switcher-caption';
  moveInstrumentation(row, caption);

  [...row.children].forEach((cell) => {
    if (!cell.children.length && cell.textContent.trim()) {
      const p = document.createElement('p');
      p.textContent = cell.textContent.trim();
      caption.append(p);
      return;
    }
    [...cell.children].forEach((el) => {
      const isMedia = el.matches('picture') || el.querySelector('picture');
      const isVideoLink = [desktop, mobile].some((a) => a && el.contains(a));
      if (!isMedia && !isVideoLink && el.textContent.trim()) caption.append(el);
    });
  });

  const title = caption.querySelector('h1, h2, h3, h4, h5, h6') || caption.firstElementChild;
  title?.classList.add('video-switcher-title');

  return {
    caption,
    img,
    label: title?.textContent.trim() || img?.alt || '',
    desktop: desktop.href,
    mobile: mobile?.href || desktop.href,
  };
}

export default function decorate(block) {
  const items = [...block.children].map(parseItem).filter(Boolean);
  if (!items.length) return;

  instances += 1;
  const id = `video-switcher-${instances}`;
  const multiple = items.length > 1;
  const state = {
    index: 0,
    activated: false,
    inView: false,
  };

  const media = document.createElement('div');
  media.className = 'video-switcher-media';
  const video = document.createElement('video');
  video.className = 'video-switcher-video';
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.preload = 'none';
  video.disablePictureInPicture = true;
  video.setAttribute('aria-hidden', 'true');
  media.append(video);

  const controls = document.createElement('div');
  controls.className = 'video-switcher-controls';

  const captions = document.createElement('div');
  captions.className = 'video-switcher-captions';
  captions.id = `${id}-panel`;
  captions.append(...items.map(({ caption }) => caption));

  const tabs = document.createElement('div');
  tabs.className = 'video-switcher-tabs';
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'Videos');

  items.forEach((item, i) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.id = `${id}-tab-${i}`;
    tab.className = 'video-switcher-tab';
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', captions.id);
    tab.setAttribute('aria-label', item.label || `Video ${i + 1}`);
    if (item.img) {
      // thumbnails sit below the fold: lazy, sized for 2x of the largest (120px) state
      const picture = createOptimizedPicture(item.img.src, '', false, [{ width: '240' }]);
      moveInstrumentation(item.img, picture.querySelector('img'));
      tab.append(picture);
    }
    tabs.append(tab);
    item.tab = tab;
  });

  const play = () => {
    if (!state.activated || !state.inView) return;
    video.play()?.catch(() => {});
  };

  const setSource = (keepTime = false) => {
    const item = items[state.index];
    const src = DESKTOP.matches ? item.desktop : item.mobile;
    video.poster = posterUrl(item.img, DESKTOP.matches ? '1600' : '750');
    if (!state.activated || video.getAttribute('src') === src) return;
    const time = keepTime ? video.currentTime : 0;
    video.src = src;
    if (time) video.addEventListener('loadedmetadata', () => { video.currentTime = time; }, { once: true });
    video.load();
  };

  const select = (index, { focus = false } = {}) => {
    state.index = (index + items.length) % items.length;
    items.forEach(({ tab, caption }, i) => {
      const active = i === state.index;
      tab.setAttribute('aria-selected', active);
      tab.tabIndex = active ? 0 : -1;
      caption.hidden = !active;
    });
    if (multiple) captions.setAttribute('aria-labelledby', items[state.index].tab.id);
    if (focus) items[state.index].tab.focus();
    setSource();
    if (!REDUCED_MOTION.matches) {
      video.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 600, easing: 'ease' });
    }
    play();
  };

  if (multiple) {
    captions.setAttribute('role', 'tabpanel');
    captions.tabIndex = 0;
    const prev = createButton('video-switcher-prev', 'Previous video', 'prev');
    const next = createButton('video-switcher-next', 'Next video', 'next');
    prev.addEventListener('click', () => select(state.index - 1));
    next.addEventListener('click', () => select(state.index + 1));
    controls.prepend(prev);
    controls.append(next);

    items.forEach(({ tab }, index) => {
      tab.addEventListener('click', () => {
        const cta = tab.getAttribute('aria-label') || '';
        const parentTitle = block.closest('.section')?.querySelector('h1, h2, h3, h4, h5, h6')?.textContent.trim() || '';
        trackEvent('custom_cta_click', { cta_: cta, parentTitle });
        pushAdobeCtaClickEvent({ cta, parentTitle, event: 'custom_cta_click' });
        select(index);
      });
    });
    tabs.addEventListener('keydown', (e) => {
      const moves = {
        ArrowLeft: state.index - 1,
        ArrowRight: state.index + 1,
        Home: 0,
        End: items.length - 1,
      };
      if (!(e.key in moves)) return;
      e.preventDefault();
      select(moves[e.key], { focus: true });
    });
    video.addEventListener('ended', () => select(state.index + 1));
  } else {
    video.loop = true;
  }

  DESKTOP.addEventListener('change', () => {
    setSource(true);
    play();
  });

  // defer the (heavy) video download until the block is in view,
  // and pause while it is scrolled out of view
  new IntersectionObserver(([entry]) => {
    state.inView = entry.isIntersecting;
    if (!state.inView) {
      video.pause();
      return;
    }
    if (!state.activated) {
      state.activated = true;
      setSource();
    }
    play();
  }, { threshold: 0.25 }).observe(media);

  block.replaceChildren(media, controls, captions);
  if (multiple) block.append(tabs);
  select(0);
}
