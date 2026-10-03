import { createOptimizedPicture } from '../../scripts/aem.js';

/**
 * colour-explorer — pick a shade from a swatch strip and preview it in place.
 *
 * Authoring format (DA table):
 *
 * | colour-explorer                                                            |
 * | Title           | Popular Shades                                           |
 * | Sub title       | Choose a Colour to see How it Looks on the Wall!         |
 * | Note            | Didn't find the right shade for your home? ...           |
 * | CTA             | [VIEW ALL COLOURS](/colour-catalogue)                    |
 * | Open in new tab | false                                                    |
 * | Desktop image   | Mobile image   | Name        | Code | Hex                |
 * | <image>         | <image>        | Sun Screen  | 7868 | #F7F2DA            |
 * | <image>         | <image>        | Intense ... | 7166 | #8A7FC0            |
 * | ...one row per shade...                                                    |
 *
 * - Title -> heading, Sub title -> intro text (above the swatches).
 * - Note + CTA -> footer (below the swatches). "Open in new tab" = true opens
 *   the CTA in a new tab.
 * - The "Desktop image | Mobile image | Name | Code | Hex" label row is optional and
 *   is skipped.
 * - Desktop image is used at >=992px, Mobile image below; if only one is
 *   authored it is used for all sizes.
 * - Hex is mandatory: the swatch tile is pure CSS, painted from it
 *   (e.g. #F7F2DA or F7F2DA).
 *
 * Clicking a swatch never navigates: it swaps the preview image (as on the
 * source, there is no visible caption) and announces the shade to screen
 * readers through a visually hidden live region.
 */

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;
const DESKTOP_MEDIA = '(min-width: 992px)';
const DEFAULT_ROOM_SIZE = { w: 673, h: 560 };
const CONFIG_KEYS = {
  title: 'title',
  'sub title': 'subtitle',
  subtitle: 'subtitle',
  note: 'note',
  cta: 'cta',
  'open in new tab': 'newTab',
};

const text = (cell) => (cell?.textContent || '').trim();

/** Intrinsic size from an authored image's attributes, else the default. */
function sizeOf(img) {
  const w = parseInt(img.getAttribute('width'), 10);
  const h = parseInt(img.getAttribute('height'), 10);
  return w && h ? { w, h } : DEFAULT_ROOM_SIZE;
}

/**
 * Room picture. Two images -> mobile <img> plus desktop <source>s at >=992px;
 * one image -> a single picture for all sizes. Each carries its intrinsic size
 * so the browser reserves space for whichever source wins (no CLS).
 */
function buildRoomPicture({ mobile, desktop, roomAlt }, eager) {
  if (!mobile) return null;
  const pic = createOptimizedPicture(mobile.src, roomAlt, eager, desktop
    ? [{ width: '750' }]
    : [{ media: DESKTOP_MEDIA, width: '1000' }, { width: '750' }]);
  const img = pic.querySelector('img');
  const m = sizeOf(mobile);
  img.width = m.w;
  img.height = m.h;
  if (desktop) {
    const d = sizeOf(desktop);
    const desk = createOptimizedPicture(desktop.src, roomAlt, eager, [{ width: '1000' }]);
    [...desk.querySelectorAll('source')].reverse().forEach((source) => {
      source.setAttribute('media', DESKTOP_MEDIA);
      source.setAttribute('width', d.w);
      source.setAttribute('height', d.h);
      pic.prepend(source);
    });
  }
  return pic;
}

function toHex(value) {
  const m = HEX.exec(value || '');
  if (!m) return '';
  const v = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  return `#${v.toLowerCase()}`;
}

const isShadeRow = (cells) => cells.some((c) => c.querySelector('img'));

function parseShade(cells) {
  const [desktopCell, mobileCell, nameCell, codeCell, hexCell] = cells;
  const name = text(nameCell);
  const code = text(codeCell);
  const desktopImg = desktopCell?.querySelector('img');
  const mobileImg = mobileCell?.querySelector('img');
  // buildRoomPicture uses the mobile image as base and swaps desktop in
  const mobile = mobileImg || desktopImg;
  const desktop = mobileImg && desktopImg ? desktopImg : null;
  const authoredAlt = mobile?.getAttribute('alt') || desktop?.getAttribute('alt');
  return {
    name,
    code,
    hex: toHex(text(hexCell)),
    mobile,
    desktop,
    roomAlt: authoredAlt || `Room wall painted in ${name}${code ? ` (${code})` : ''}`,
  };
}

/** Label/value rows (Title, Sub title, Note, CTA, Open in new tab). */
function readConfig(rows) {
  const config = {};
  rows.forEach((cells) => {
    if (cells.length < 2) return;
    const key = CONFIG_KEYS[text(cells[0]).toLowerCase()];
    if (key) [, config[key]] = cells;
  });
  return config;
}

function buildIntro({ title, subtitle }) {
  if (!text(title) && !text(subtitle)) return null;
  const intro = document.createElement('div');
  intro.className = 'colour-explorer-intro';
  if (text(title)) {
    const h2 = document.createElement('h2');
    h2.textContent = text(title);
    intro.append(h2);
  }
  if (text(subtitle)) {
    const p = document.createElement('p');
    p.textContent = text(subtitle);
    intro.append(p);
  }
  return intro;
}

function buildFooter({ note, cta, newTab }) {
  const link = cta?.querySelector('a[href]');
  if (!text(note) && !link) return null;
  const footer = document.createElement('div');
  footer.className = 'colour-explorer-footer';
  if (text(note)) {
    const p = document.createElement('p');
    p.textContent = text(note);
    footer.append(p);
  }
  if (link) {
    const p = document.createElement('p');
    p.className = 'colour-explorer-cta-wrapper';
    const a = document.createElement('a');
    a.className = 'colour-explorer-cta';
    a.href = link.getAttribute('href');
    a.textContent = text(link);
    if (text(newTab).toLowerCase() === 'true') {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    }
    p.append(a);
    footer.append(p);
  }
  return footer;
}

export default function decorate(block) {
  const rows = [...block.children].map((row) => [...row.children]);
  const shades = rows.filter(isShadeRow).map(parseShade);
  if (!shades.length) return;

  const config = readConfig(rows.filter((cells) => !isShadeRow(cells)));
  const intro = buildIntro(config);
  const footer = buildFooter(config);

  // the first image is only eager when this block opens the page
  const firstSection = block.closest('.section') === document.querySelector('main .section');

  // --- preview: room image only (matches the source) ---
  const preview = document.createElement('div');
  preview.className = 'colour-explorer-preview';
  const media = document.createElement('div');
  media.className = 'colour-explorer-preview-media';
  // visually hidden: tells screen-reader users which shade is now previewed
  const status = document.createElement('p');
  status.className = 'colour-explorer-status';
  status.setAttribute('aria-live', 'polite');
  preview.append(media, status);

  const pictures = new Map();
  const pictureFor = (shade, eager) => {
    if (!pictures.has(shade)) pictures.set(shade, buildRoomPicture(shade, eager));
    return pictures.get(shade);
  };

  // --- swatch strip ---
  const list = document.createElement('ul');
  list.className = 'colour-explorer-swatches';
  list.setAttribute('aria-label', 'Shades');
  const buttons = shades.map((shade) => {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'colour-explorer-swatch';
    if (shade.hex) button.style.setProperty('--colour-explorer-swatch', shade.hex);

    const chip = document.createElement('span');
    chip.className = 'colour-explorer-chip';
    chip.setAttribute('aria-hidden', 'true');

    const name = document.createElement('span');
    name.className = 'colour-explorer-swatch-name';
    name.textContent = shade.name;
    const code = document.createElement('span');
    code.className = 'colour-explorer-swatch-code';
    code.textContent = shade.code;
    button.append(chip, name, code);

    // warm the room image on intent so the swap feels instant: fetch the same
    // source the <picture> will pick for the current viewport
    const warm = () => {
      const pic = pictureFor(shade, true);
      if (!pic) return;
      const source = [...pic.querySelectorAll('source')]
        .find((s) => !s.media || window.matchMedia(s.media).matches);
      new Image().src = source ? source.srcset : pic.querySelector('img').src;
    };
    button.addEventListener('pointerenter', warm, { once: true });
    button.addEventListener('focus', warm, { once: true });

    li.append(button);
    list.append(li);
    return button;
  });

  const select = (index, initial = false) => {
    const shade = shades[index];
    buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(i === index)));

    const pic = pictureFor(shade, initial ? firstSection : true);
    media.replaceChildren(...(pic ? [pic] : []));

    status.textContent = `Showing ${shade.name}${shade.code ? ` ${shade.code}` : ''}`;
  };

  buttons.forEach((button, i) => button.addEventListener('click', () => select(i)));

  // arrow keys move focus through the strip (Enter/Space select, natively)
  list.addEventListener('keydown', (e) => {
    const current = buttons.indexOf(document.activeElement);
    if (current < 0) return;
    const rowsInStrip = getComputedStyle(list).gridTemplateRows.split(' ').length || 1;
    const step = {
      ArrowDown: 1, ArrowUp: -1, ArrowRight: rowsInStrip, ArrowLeft: -rowsInStrip,
    }[e.key];
    let next;
    if (step) next = Math.min(Math.max(current + step, 0), buttons.length - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = buttons.length - 1;
    else return;
    e.preventDefault();
    buttons[next].focus();
    buttons[next].scrollIntoView({ block: 'nearest', inline: 'nearest' });
  });

  // populate before attaching so the live region doesn't announce on load
  select(0, true);
  block.replaceChildren(...[intro, preview, list, footer].filter(Boolean));
}
