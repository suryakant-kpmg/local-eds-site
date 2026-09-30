/*
** Authoring format **
Row 1 - intro: heading (italic words get the brand gradient), description, CTA link
One row per shade:
Col 1 - desktop image
Col 2 - mobile image (optional)
Col 3 - swatch colour (hex, e.g. #FCDAB7)
Col 4 - shade name
Col 5 - shade code (e.g. #7986)

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
const COLOUR_PATTERN = /^(#?[0-9a-f]{6}|#[0-9a-f]{3}|(rgb|hsl)a?\(.+\))$/i;

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
  moveInstrumentation(row, intro);
  [...row.children].forEach((col) => intro.append(...col.childNodes));

  const heading = intro.querySelector('h1, h2, h3, h4, h5, h6');
  heading?.classList.add('popular-shades-details-heading');
  heading?.querySelectorAll('em').forEach((em) => em.classList.add('popular-shades-details-gradient'));

  // the CTA is laid out separately so it can sit below the swatches on mobile
  const link = [...intro.querySelectorAll('a[href]')].pop();
  let cta = null;
  if (link) {
    cta = document.createElement('p');
    cta.className = 'popular-shades-details-cta';
    link.className = '';
    const wrapper = link.closest('p');
    cta.append(link);
    if (wrapper && !wrapper.textContent.trim()) wrapper.remove();
    link.insertAdjacentHTML('beforeend', '<span class="popular-shades-details-cta-arrow" aria-hidden="true"></span>');
    link.addEventListener('click', () => {
      triggerCTAClickWithLinkAndTitle(link.href, link.textContent.trim(), heading?.textContent.trim() || '');
    });
  }
  return { intro, cta, title: heading?.textContent.trim() || '' };
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
  const shadeRows = rows.filter((row) => row.querySelector('img'));
  const introRow = rows.find((row) => !shadeRows.includes(row));
  const { intro, cta, title } = introRow ? decorateIntro(introRow) : {};
  const shades = shadeRows.map(readShade);

  const media = document.createElement('div');
  media.className = 'popular-shades-details-media';
  const firstImg = shades[0]?.desktopImg;
  const firstMobile = shades[0]?.mobileImg || firstImg;
  // reserve the image area before any picture loads
  if (firstImg?.width && firstImg?.height) media.style.setProperty('--psd-desktop-ratio', `${firstImg.width} / ${firstImg.height}`);
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

  // auto-rotation (WCAG 2.2.2: visible pause control, pauses on hover/focus)
  const autoplay = shades.length > 1 && !block.classList.contains('no-autoplay');
  if (autoplay) {
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'popular-shades-details-toggle';
    shadesWrap.append(toggle);

    let stopped = REDUCED_MOTION.matches;
    let visible = false;
    let hovered = false;
    let timer;
    const setLabel = () => {
      toggle.setAttribute('aria-label', stopped ? 'Play shade rotation' : 'Pause shade rotation');
      toggle.classList.toggle('is-paused', stopped);
    };
    const schedule = () => {
      clearTimeout(timer);
      if (stopped || !visible || hovered || document.hidden) return;
      timer = setTimeout(() => {
        select((active + 1) % shades.length);
        schedule();
      }, AUTOPLAY_DELAY);
    };
    toggle.addEventListener('click', () => {
      stopped = !stopped;
      setLabel();
      schedule();
    });
    block.addEventListener('pointerenter', () => { hovered = true; schedule(); });
    block.addEventListener('pointerleave', () => { hovered = false; schedule(); });
    block.addEventListener('focusin', () => { hovered = true; schedule(); });
    block.addEventListener('focusout', (e) => {
      if (!block.contains(e.relatedTarget)) { hovered = false; schedule(); }
    });
    document.addEventListener('visibilitychange', schedule);
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      schedule();
    }, { threshold: 0.3 }).observe(block);
    // choosing a shade ends the rotation
    list.addEventListener('click', () => {
      stopped = true;
      setLabel();
      schedule();
    });
    setLabel();
  }

  buttons.forEach((button, i) => button.addEventListener('click', () => {
    select(i);
    trackShadeClick(shades[i], title);
  }));

  block.replaceChildren(...[intro, media, shadesWrap, cta].filter(Boolean));
  select(0, { scroll: false });
}
