/*
** Authoring format **
Row 1 - intro: heading (italic words get the brand gradient), description
Settings rows (optional, two cells: name | value):
  CTA label          | View Catalogue
  CTA link           | https://www.asianpaints.com/catalogue/colour-catalogue.html
  CTA target         | Same tab (default) or New tab
  Autoplay           | Yes (default) or No
  Autoplay interval  | 3000 (milliseconds, or "3s")
One row per shade:
Col 1 - desktop image
Col 2 - mobile image (optional)
Col 3 - swatch colour (hex, e.g. #FCDAB7)
Col 4 - shade name
Col 5 - shade code (e.g. #7986)

Without a "CTA link" row, the last link in the intro becomes the CTA.
Options: add "no-autoplay" to the block name to disable auto-rotation.
*/

import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';
import {
  getDigitalData,
  pushAdobeProductTitleClick,
  trackEvent,
  triggerCTAClickWithLinkAndTitle,
} from '../../scripts/analytics_1.js';

const DESKTOP_MEDIA = '(width >= 992px)';
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)');
const AUTOPLAY_DELAY = 3000;
const MIN_AUTOPLAY_DELAY = 1000;
const COLOUR_PATTERN = /^(#?[0-9a-f]{6}|#[0-9a-f]{3}|(rgb|hsl)a?\(.+\))$/i;

// settings-row names authors may use, mapped to config keys
const SETTINGS = {
  'cta label': 'ctaLabel',
  'cta text': 'ctaLabel',
  'button label': 'ctaLabel',
  'cta link': 'ctaLink',
  'cta url': 'ctaLink',
  'button link': 'ctaLink',
  'cta target': 'ctaTarget',
  'open link in': 'ctaTarget',
  autoplay: 'autoplay',
  autoswitch: 'autoplay',
  'autoplay interval': 'interval',
  'autoplay timeout': 'interval',
  interval: 'interval',
};

const settingKey = (row) => {
  const cols = [...row.children];
  if (cols.length !== 2 || row.querySelector('img')) return null;
  return SETTINGS[cols[0].textContent.trim().toLowerCase().replace(/\s+/g, ' ')] || null;
};

/**
 * Reads the optional name | value settings rows.
 */
function readSettings(rows) {
  const config = {};
  rows.forEach((row) => {
    const key = settingKey(row);
    const valueCol = row.children[1];
    const text = valueCol.textContent.trim();
    if (key === 'ctaLink') {
      config.ctaLink = valueCol.querySelector('a[href]')?.getAttribute('href') || text;
    } else if (key === 'ctaTarget') {
      config.newTab = /^(_blank|new( tab| window)?|yes|true)$/i.test(text);
    } else if (key === 'autoplay') {
      config.autoplay = !/^(no|false|off|0)$/i.test(text);
    } else if (key === 'interval') {
      const value = parseFloat(text);
      if (value > 0) config.interval = /s$/i.test(text) && !/ms$/i.test(text) ? value * 1000 : value;
    } else if (key) {
      config[key] = text;
    }
  });
  return config;
}

function toColour(text) {
  const value = /^[0-9a-f]{6}$/i.test(text) ? `#${text}` : text;
  return CSS.supports('color', value) ? value : '';
}

function isSameOrigin(img) {
  return new URL(img.src, window.location.href).origin === window.location.origin;
}

/**
 * Builds one art-directed picture from the authored desktop and mobile images.
 */
function buildPicture(desktopImg, mobileImg, alt) {
  const fallbackImg = mobileImg || desktopImg;
  if (!isSameOrigin(fallbackImg)) {
    // media hosted elsewhere cannot be resized by the media bus
    const picture = document.createElement('picture');
    if (mobileImg && desktopImg) {
      const source = document.createElement('source');
      source.media = DESKTOP_MEDIA;
      source.srcset = desktopImg.src;
      picture.append(source);
    }
    const img = document.createElement('img');
    img.src = fallbackImg.src;
    img.alt = alt;
    img.loading = 'lazy';
    picture.append(img);
    return picture;
  }

  const picture = createOptimizedPicture(fallbackImg.src, alt, false, [{ width: mobileImg ? '750' : '1600' }]);
  if (mobileImg && desktopImg) {
    const desktop = createOptimizedPicture(desktopImg.src, alt, false, [{ media: DESKTOP_MEDIA, width: '1600' }]);
    picture.prepend(...desktop.querySelectorAll('source[media]'));
  }
  moveInstrumentation(fallbackImg, picture.querySelector('img'));
  return picture;
}

function readShade(row, index) {
  const cols = [...row.children];
  const imageCols = cols.filter((col) => col.querySelector('img'));
  const textCols = cols.filter((col) => !col.querySelector('img'))
    .map((col) => col.textContent.trim());
  const colourIndex = textCols.findIndex((text) => COLOUR_PATTERN.test(text));
  const colour = colourIndex >= 0 ? toColour(textCols[colourIndex]) : '';
  const [name = `Shade ${index + 1}`, code = ''] = textCols.filter((_, i) => i !== colourIndex);
  const [desktopImg, mobileImg] = imageCols.map((col) => col.querySelector('img'));
  return {
    row, desktopImg, mobileImg, colour, name, code,
  };
}

function decorateIntro(row) {
  const intro = document.createElement('div');
  intro.className = 'popular-shades-details-intro';
  if (row) {
    moveInstrumentation(row, intro);
    [...row.children].forEach((col) => intro.append(...col.childNodes));
  }

  const heading = intro.querySelector('h1, h2, h3, h4, h5, h6');
  heading?.classList.add('popular-shades-details-heading');
  heading?.querySelectorAll('em').forEach((em) => em.classList.add('popular-shades-details-gradient'));
  return { intro, title: heading?.textContent.trim() || '' };
}

/**
 * Builds the pill CTA from the settings rows, falling back to the last link in the intro.
 * It is laid out separately from the intro so it can sit below the swatches on mobile.
 */
function buildCta(intro, config, title) {
  let link = [...intro.querySelectorAll('a[href]')].pop();
  if (config.ctaLink) {
    const label = config.ctaLabel || link?.textContent.trim() || 'Learn more';
    link = document.createElement('a');
    link.href = config.ctaLink;
    link.textContent = label;
  } else if (link && config.ctaLabel) {
    link.textContent = config.ctaLabel;
  }
  if (!link) return null;

  const wrapper = link.closest('p');
  const cta = document.createElement('p');
  cta.className = 'popular-shades-details-cta';
  link.className = '';
  cta.append(link);
  if (wrapper && !wrapper.textContent.trim()) wrapper.remove();
  if (config.newTab) {
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', `${link.textContent.trim()} (opens in a new tab)`);
  }
  link.insertAdjacentHTML('beforeend', '<span class="popular-shades-details-cta-arrow" aria-hidden="true"></span>');
  link.addEventListener('click', () => {
    triggerCTAClickWithLinkAndTitle(link.href, link.textContent.trim(), title);
  });
  return cta;
}

function trackShadeClick(shade, title) {
  // matches the popular-shades block: productName carries name and code
  const productName = [shade.name, shade.code].filter(Boolean).join(' ');
  const dd = getDigitalData();
  dd.title = title;
  dd.data = { productName, productSKU: shade.code };
  trackEvent('natural_wood_shade_click', { title, productName, productSKU: shade.code });
  pushAdobeProductTitleClick({
    productName: shade.name, productSku: shade.code, title, event: 'natural_wood_shade_click',
  });
}

export default function decorate(block) {
  const rows = [...block.children];
  const settingRows = rows.filter(settingKey);
  const shadeRows = rows.filter((row) => row.querySelector('img'));
  const introRow = rows.find((row) => !shadeRows.includes(row) && !settingRows.includes(row));
  const config = readSettings(settingRows);
  const { intro, title } = decorateIntro(introRow);
  const cta = buildCta(intro, config, title);
  const shades = shadeRows.map(readShade);

  const media = document.createElement('div');
  media.className = 'popular-shades-details-media';
  // reserve the mobile image area before any picture loads (desktop uses a fixed frame)
  const firstMobile = shades[0]?.mobileImg || shades[0]?.desktopImg;
  if (firstMobile?.width && firstMobile?.height) media.style.setProperty('--psd-mobile-ratio', `${firstMobile.width} / ${firstMobile.height}`);

  const list = document.createElement('ul');
  list.className = 'popular-shades-details-swatches';
  list.setAttribute('aria-label', title ? `${title}: choose a shade` : 'Choose a shade');

  const pictures = [];
  const buttons = [];
  shades.forEach((shade) => {
    const alt = shade.desktopImg?.alt || `House exterior painted in ${shade.name}`;
    const picture = buildPicture(shade.desktopImg, shade.mobileImg, alt);
    picture.classList.add('popular-shades-details-picture');
    media.append(picture);
    pictures.push(picture);

    const item = document.createElement('li');
    moveInstrumentation(shade.row, item);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'popular-shades-details-swatch';
    button.setAttribute('aria-label', [shade.name, shade.code].filter(Boolean).join(' '));
    button.innerHTML = `<span class="popular-shades-details-chip" aria-hidden="true"></span>
      <span class="popular-shades-details-name" aria-hidden="true"></span>
      <span class="popular-shades-details-code" aria-hidden="true"></span>`;
    if (shade.colour) button.querySelector('.popular-shades-details-chip').style.setProperty('--psd-swatch', shade.colour);
    button.querySelector('.popular-shades-details-name').textContent = shade.name;
    button.querySelector('.popular-shades-details-code').textContent = shade.code;
    button.title = shade.name;
    item.append(button);
    list.append(item);
    buttons.push(button);
  });

  let active = -1;
  const select = (index, { scroll = true } = {}) => {
    if (index === active || !shades[index]) return;
    active = index;
    pictures.forEach((picture, i) => {
      picture.classList.toggle('is-active', i === index);
      // only the shown house is exposed to assistive tech
      const img = picture.querySelector('img');
      if (i === index) img.removeAttribute('aria-hidden');
      else img.setAttribute('aria-hidden', 'true');
    });
    buttons.forEach((button, i) => button.setAttribute('aria-pressed', i === index ? 'true' : 'false'));
    // keep the active swatch visible in the scrollable row without moving the page
    const item = list.children[index];
    if (scroll && list.scrollWidth > list.clientWidth) {
      const left = item.offsetLeft - (list.clientWidth - item.offsetWidth) / 2;
      list.scrollTo({ left, behavior: REDUCED_MOTION.matches ? 'auto' : 'smooth' });
    }
  };

  const shadesWrap = document.createElement('div');
  shadesWrap.className = 'popular-shades-details-shades';
  shadesWrap.append(list);

  // auto-rotation as on the source: loops continuously and carries on from a clicked shade;
  // only idles while the block is off screen or the tab is hidden
  let schedule = () => {};
  const autoplay = config.autoplay !== false && !block.classList.contains('no-autoplay');
  const delay = Math.max(config.interval || AUTOPLAY_DELAY, MIN_AUTOPLAY_DELAY);
  if (shades.length > 1 && autoplay) {
    let visible = false;
    let timer;
    schedule = () => {
      clearTimeout(timer);
      if (!visible || document.hidden) return;
      timer = setTimeout(() => {
        select((active + 1) % shades.length);
        schedule();
      }, delay);
    };
    document.addEventListener('visibilitychange', schedule);
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      schedule();
    }).observe(block);
  }

  buttons.forEach((button, i) => button.addEventListener('click', () => {
    select(i);
    schedule();
    trackShadeClick(shades[i], title);
  }));

  block.replaceChildren(...[intro, media, shadesWrap, cta].filter(Boolean));
  select(0, { scroll: false });
}
