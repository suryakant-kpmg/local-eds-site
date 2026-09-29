import { createOptimizedPicture } from '../../scripts/aem.js';

/**
 * colour-explorer — pick a shade from a swatch strip and preview it in place.
 *
 * Authoring model (see README in colour-explorer.css header). One row per
 * shade, columns:
 *   [ room image(s) | shade name | code | hex | link ]
 * The room image cell holds ONE image (all sizes) or TWO — first mobile, second
 * desktop (>=992px) — rendered as a responsive <picture>.
 * The swatch tile is pure CSS, painted from the hex (as on the live site).
 * Text-only rows (no image, no hex) are copy: before the first shade they form
 * the intro (heading + text), after the last shade the footer (text + CTA).
 *
 * Clicking a swatch never navigates: it swaps the preview image (as on the
 * source, there is no visible caption) and announces the shade to screen
 * readers through a visually hidden live region. The link column is kept in
 * the model for authors but is not rendered.
 */

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;
const DESKTOP_MEDIA = '(min-width: 992px)';
const DEFAULT_ROOM_SIZE = { w: 673, h: 560 };

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

const isShadeRow = (cells) => cells.some((c) => c.querySelector('img') || HEX.test(text(c)));

function parseShade(cells) {
  const [roomCell, nameCell, codeCell, hexCell] = cells;
  const name = text(nameCell);
  const code = text(codeCell);
  const [mobile, desktop] = roomCell ? [...roomCell.querySelectorAll('img')] : [];
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

/** Move a row's content into a copy container; lone links become CTA buttons. */
function buildCopy(rows, className) {
  const copy = document.createElement('div');
  copy.className = className;
  rows.forEach((cells) => cells.forEach((cell) => copy.append(...cell.childNodes)));
  copy.querySelectorAll('p a[href]').forEach((a) => {
    const p = a.closest('p');
    if (p.textContent.trim() !== a.textContent.trim()) return;
    p.className = 'colour-explorer-cta-wrapper';
    a.className = 'colour-explorer-cta';
  });
  return copy;
}

export default function decorate(block) {
  const rows = [...block.children].map((row) => [...row.children]);
  const firstShade = rows.findIndex(isShadeRow);
  if (firstShade < 0) return;
  let lastShade = rows.length - 1;
  while (!isShadeRow(rows[lastShade])) lastShade -= 1;

  const shades = rows.slice(firstShade, lastShade + 1).filter(isShadeRow).map(parseShade);
  const intro = firstShade > 0 ? buildCopy(rows.slice(0, firstShade), 'colour-explorer-intro') : null;
  const footer = lastShade < rows.length - 1
    ? buildCopy(rows.slice(lastShade + 1), 'colour-explorer-footer') : null;

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
