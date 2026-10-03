import { loadScript } from '../../scripts/aem.js';
import { uploadPdf, track } from './lead-api.js';

/**
 * colour-quiz results — the source's two recommendations (primary and
 * complimentary shade pairs shown on a room render, plus a matching texture
 * or wallpaper) and its "Download (PDF)" print-out.
 *
 * Data comes from the recommendation API (lead-api.js) in the source's
 * response shape, or from the authored results sheet, converted to the
 * same shape (see fromSheet).
 *
 * PDF, as on the source: a hidden 1350px-wide print layout is rendered with
 * html2canvas 1.4.1 and paged into an A4 PDF with jsPDF 2.5.1 (both vendored
 * in /scripts/vendor, loaded only when a PDF is made). For API results the
 * PDF is made straight away and uploaded; its link goes to Salesforce.
 */

const VENDOR = '/scripts/vendor';
const SHADES = ['One', 'Two', 'Three', 'Four'];

// source svgOverlayMetaData geometry (viewBox 0 0 959.75 720.87): the
// primary wall, and the secondary wall per breakpoint / print
const DEFAULT_WALLS = {
  primary: {
    x: 0, y: 0, width: 600, height: 650,
  },
  large: {
    x: 453, y: 0, width: 400, height: 600,
  },
  medium: {
    x: 453, y: 0, width: 450, height: 600,
  },
  small: {
    x: 453, y: 0, width: 450, height: 600,
  },
  print: {
    x: 453, y: 0, width: 450, height: 600,
  },
};
const VIEWBOX = '0 0 959.75 720.87';
const SVG_NS = 'http://www.w3.org/2000/svg';

const DEFAULTS = {
  'primary label': 'Primary Shade',
  'complimentary label': 'Complimentary Shade',
  'texture title': 'Transform your space from drab to fab with our exquisite textures and wallpapers!',
  'texture title exterior': 'Transform your space from drab to fab with our exquisite textures!',
  'texture label': 'Texture that goes well with these recommendations',
  'wallpaper label': 'Wallpapers that goes well with these recommendations',
  'top coat label': 'Top coat:',
  'base coat label': 'Base coat:',
  'one liner 1': '1. Our colour experts have curated stunning colour combinations for your dream home, blending harmony and style to transform your space into a personal oasis.',
  'one liner 2': '2. Our colour experts have curated stunning colour combinations for your dream home, blending harmony and style to transform your space into a personal oasis.',
  'download label': 'Download (PDF)',
  'share label': 'Share on WhatsApp',
  'pdf name': 'Home_Colour_Guide.pdf',
};

const has = (v) => v !== undefined && v !== null && v !== '';
const label = (settings, key) => settings.get(key) || DEFAULTS[key];

/** Only the wall rectangles of the API's SVG (its markup is not inserted). */
function readWalls(svgText) {
  const walls = { ...DEFAULT_WALLS };
  if (!svgText) return walls;
  try {
    const svg = new DOMParser().parseFromString(svgText, 'image/svg+xml');
    svg.querySelectorAll('rect').forEach((rect) => {
      const cls = (rect.getAttribute('class') || '').trim().split(/\s+/);
      const geo = Object.fromEntries(['x', 'y', 'width', 'height'].map((a) => [a, Number(rect.getAttribute(a)) || 0]));
      if (cls.length === 1 && cls[0] === 'primary') walls.primary = geo;
      else if (cls.includes('secondary-large')) walls.large = geo;
      else if (cls.includes('secondary-medium')) walls.medium = geo;
      else if (cls.includes('secondary-small')) walls.small = geo;
      else if (cls.includes('secondary-pdf-medium')) walls.print = geo;
    });
  } catch (e) { /* keep the defaults */ }
  return walls;
}

const shade = (r, n) => ({
  name: r[`shade${n}EntityName`],
  code: r[`shade${n}EntityCode`],
  hex: r[`shade${n}HexCode`],
  url: r[`shade${n}PdpURL`],
});

/** recommendationDetails response -> view model (source field rules). */
export function fromApi(json) {
  return (json.coloursRecommended || []).slice(0, 2).map((r) => ({
    // source: a recommendation shows when any of these is set
    visible: !!(r.shadeOneHexCode || r.shadeTwoEntityCode
      || r.shadeThreeHexCode || r.shadeFourHexCode),
    description: r.colourFamilyDescription,
    image: r.imageURL,
    walls: readWalls(r.svgOverlayMetaData),
    combos: [
      [shade(r, SHADES[0]), shade(r, SHADES[1])],
      [shade(r, SHADES[2]), shade(r, SHADES[3])],
    ],
    texture: {
      url: r.texturePdpURL,
      name: r.textureEntityName,
      image: r.textureSwatchImage,
      code: r.textureEntityCode,
      topCoat: r.textureTopCoats,
      baseCoat: r.textureBaseCoats,
    },
    wallpaper: {
      url: r.wallpaperPdpURL,
      name: r.wallpaperEntityName,
      image: r.wallpaperSwatchImage,
      code: r.wallpaperEntityCode,
    },
  }));
}

/**
 * Results-sheet row (normalised keys) -> view model. Columns: shade 1…8
 * name / code / hex / link (1–4 = first recommendation, 5–8 = second),
 * optional description 1 / 2, image (room render, also image 1 / image 2)
 * and texture 1 / 2 name / image / link / code / top coat / base coat.
 */
export function fromSheet(row) {
  const v = (k) => (row[k] || '').trim();
  const hexOf = (h) => (/^#?[0-9a-f]{6}$/i.test(h) ? `#${h.replace('#', '')}` : '');
  const sheetShade = (n) => ({
    name: v(`shade${n}name`),
    code: v(`shade${n}code`),
    hex: hexOf(v(`shade${n}hex`)),
    url: v(`shade${n}link`),
  });
  return [1, 2].map((rec) => {
    const base = (rec - 1) * 4;
    const combos = [
      [sheetShade(base + 1), sheetShade(base + 2)],
      [sheetShade(base + 3), sheetShade(base + 4)],
    ];
    return {
      visible: combos.flat().some((s) => s.hex || s.code),
      description: v(`description${rec}`) || undefined,
      image: v(`image${rec}`) || v('image'),
      walls: { ...DEFAULT_WALLS },
      combos,
      texture: {
        url: v(`texture${rec}link`),
        name: v(`texture${rec}name`),
        image: v(`texture${rec}image`),
        code: v(`texture${rec}code`),
        topCoat: v(`texture${rec}topcoat`),
        baseCoat: v(`texture${rec}basecoat`),
      },
      wallpaper: {},
    };
  });
}

const el = (tag, className, textContent) => {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (textContent !== undefined) e.textContent = textContent;
  return e;
};

const arrow = () => {
  const a = el('span', 'colour-quiz-arrow');
  a.setAttribute('aria-hidden', 'true');
  return a;
};

const shadeOk = (s) => has(s.name) && has(s.code) && has(s.hex);

function buildCard(s) {
  const card = el(s.url ? 'a' : 'div', 'colour-quiz-card');
  if (s.url) card.href = s.url;
  const swatch = el('span', 'colour-quiz-card-swatch');
  swatch.style.backgroundColor = s.hex;
  card.append(swatch, el('span', 'colour-quiz-card-name', s.name), el('span', 'colour-quiz-card-code', s.code), arrow());
  return card;
}

/** Room render: wall rectangles in the shade colours behind the room cut-out. */
function buildRoom(image, walls, [a, b], print) {
  const room = el('div', 'colour-quiz-room');
  room.setAttribute('role', 'img');
  room.setAttribute('aria-label', `Room preview in ${[a, b].filter(shadeOk).map((s) => s.name).join(' and ')}`);
  // source: each wall takes its own shade; with one shade, both walls take it
  const first = shadeOk(a) ? a.hex : b.hex;
  const second = shadeOk(b) ? b.hex : a.hex;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', VIEWBOX);
  svg.setAttribute('aria-hidden', 'true');
  const variants = print ? ['print'] : ['large', 'medium', 'small'];
  [['primary', walls.primary, first], ...variants.map((k) => [`secondary-${k}`, walls[k], second])]
    .forEach(([kind, geo, fill]) => {
      const rect = document.createElementNS(SVG_NS, 'rect');
      Object.entries(geo).forEach(([attr, val]) => rect.setAttribute(attr, val));
      rect.setAttribute('class', `colour-quiz-wall-${kind}`);
      if (fill) rect.setAttribute('fill', fill);
      svg.append(rect);
    });
  const overlay = el('div', 'colour-quiz-room-image');
  overlay.style.backgroundImage = `url("${image}")`;
  room.append(svg, overlay);
  return room;
}

function buildCombo(rec, pair, alt, settings, print) {
  if (!pair.some(shadeOk)) return null;
  const combo = el('div', `colour-quiz-combo${alt ? ' colour-quiz-combo-alt' : ''}`);
  const shades = el('div', 'colour-quiz-combo-shades');
  pair.forEach((s, i) => {
    if (!shadeOk(s)) return;
    shades.append(
      el('p', `colour-quiz-combo-label${i ? ' colour-quiz-combo-label-second' : ''}`, label(settings, i ? 'complimentary label' : 'primary label')),
      buildCard(s),
    );
  });
  const room = rec.image ? buildRoom(rec.image, rec.walls, pair, print) : null;
  // second combination: room first (mobile reverses it, shades on top)
  if (alt) combo.append(...[room, shades].filter(Boolean));
  else combo.append(...[shades, room].filter(Boolean));
  return combo;
}

function buildExtra(item, kind, settings) {
  const isTexture = kind === 'texture';
  if (!(has(item.url) && has(item.image) && has(item.name))) return null;
  const box = el('a', `colour-quiz-extra colour-quiz-${kind}`);
  box.href = item.url;
  const pic = el('span', 'colour-quiz-extra-image');
  const img = el('img');
  img.src = item.image;
  img.alt = '';
  img.loading = 'lazy';
  pic.append(img);
  box.append(el('span', 'colour-quiz-extra-label', label(settings, isTexture ? 'texture label' : 'wallpaper label')), pic, el('span', 'colour-quiz-extra-name', item.name));
  if (isTexture) {
    box.append(arrow());
    [['topCoat', 'top coat label'], ['baseCoat', 'base coat label']].forEach(([k, l]) => {
      if (!has(item[k])) return;
      const line = el('span', 'colour-quiz-extra-coat', `${label(settings, l)} `);
      line.append(el('span', '', item[k]));
      box.append(line);
    });
  } else {
    box.append(el('span', 'colour-quiz-extra-code', item.code || ''));
  }
  return box;
}

/**
 * Recommendations markup (screen, or the print layout when `print`).
 * @returns {HTMLElement|null} null when nothing can be shown
 */
export function buildRecommendations(recs, { settings, requestType, print = false }) {
  const shown = recs.filter((r) => r.visible);
  if (!shown.length) return null;
  const wrap = el('div', 'colour-quiz-recs');
  recs.forEach((rec, i) => {
    if (!rec.visible) return;
    const box = el('div', 'colour-quiz-rec');
    box.append(el('p', 'colour-quiz-rec-title', has(rec.description) ? rec.description : label(settings, `one liner ${i + 1}`)));
    const body = el('div', 'colour-quiz-rec-body');
    const combos = el('div', 'colour-quiz-combos');
    rec.combos.forEach((pair, c) => {
      const combo = buildCombo(rec, pair, c === 1, settings, print);
      if (combo) combos.append(combo);
    });
    const extras = el('div', 'colour-quiz-extras');
    const items = [buildExtra(rec.texture, 'texture', settings), buildExtra(rec.wallpaper, 'wallpaper', settings)].filter(Boolean);
    if (items.length) {
      const title = requestType === 'Exterior' ? 'texture title exterior' : 'texture title';
      extras.append(el('p', 'colour-quiz-extras-title', label(settings, title).trim()), ...items);
    }
    body.append(combos, extras);
    box.append(body);
    wrap.append(box);
  });
  return wrap;
}

/* ---------- PDF ---------- */

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent || navigator.vendor || '') && !window.MSStream;

let libs;
const loadLibs = () => {
  libs = libs || Promise.all([
    loadScript(`${VENDOR}/html2canvas.min.js`),
    loadScript(`${VENDOR}/jspdf.umd.min.js`),
  ]);
  return libs;
};

/**
 * Print layout (source .pdfHTML): logo, results heading, recommendations;
 * laid out off-screen and rendered at the source's 1350px window width.
 */
function buildPrint(block, {
  heading, recs, settings, requestType,
}) {
  const print = el('div', 'colour-quiz-print');
  print.setAttribute('aria-hidden', 'true');
  const top = el('div', 'colour-quiz-print-top');
  const logo = settings.img('pdf logo');
  if (logo) {
    const img = el('img', 'colour-quiz-print-logo');
    img.src = logo.currentSrc || logo.src;
    img.alt = '';
    top.append(img);
  }
  const header = el('div', 'colour-quiz-results-header colour-quiz-print-header');
  const h2 = el('h2');
  h2.innerHTML = heading.innerHTML;
  header.append(h2);
  top.append(header);
  const body = buildRecommendations(recs, { settings, requestType, print: true });
  const parts = body ? [...body.children] : [];
  // iOS renders two canvases: logo + header + first recommendation, then the second
  const part1 = el('div', 'colour-quiz-print-part');
  part1.append(top, ...parts.slice(0, 1));
  const part2 = parts[1] ? el('div', 'colour-quiz-print-part') : null;
  if (part2) part2.append(parts[1]);
  if (body) {
    body.replaceChildren(...[part1, part2].filter(Boolean));
    print.append(body);
  } else print.append(part1);
  block.append(print);
  return { print, part1, part2 };
}

/**
 * The page requires Trusted Types; its default policy (scripts.js) lives in
 * the top window only. html2canvas copies the page into a new iframe and
 * starts it with document.write('<!DOCTYPE html><html></html>'), which that
 * iframe would block. While a render runs, the iframe gets a policy that
 * lets exactly that empty document through.
 */
function allowCloneDocument() {
  const { body } = document;
  const append = body.appendChild;
  body.appendChild = function appendChild(node) {
    const added = append.call(this, node);
    if (node instanceof HTMLIFrameElement && node.classList.contains('html2canvas-container')) {
      try {
        node.contentWindow?.trustedTypes?.createPolicy('default', {
          createHTML: (s) => (/^(<!DOCTYPE [a-z]+>)?<html><\/html>$/i.test(s) ? s : ''),
        });
      } catch (e) { /* no Trusted Types here */ }
    }
    return added;
  };
  return () => {
    body.appendChild = append;
    document.querySelectorAll('iframe.html2canvas-container').forEach((f) => f.remove());
  };
}

async function renderPdf(block, data) {
  await loadLibs();
  const { print, part1, part2 } = buildPrint(block, data);
  const restore = allowCloneDocument();
  const { html2canvas } = window;
  const { jsPDF: JsPdf } = window.jspdf;
  // the print layout sits off-screen; in html2canvas' copy of the page it is
  // moved into view and page zoom/transforms are reset (as the source does)
  const opts = (extra) => ({
    width: 1350,
    windowWidth: 1350,
    ...extra,
    onclone: (doc) => {
      doc.body.style.zoom = '1';
      doc.body.style.transform = 'none';
      doc.body.style.transformOrigin = '0 0';
      const copy = doc.querySelector('.colour-quiz-print');
      if (!copy) return;
      copy.classList.add('colour-quiz-print-active');
      // html2canvas draws inline SVG at its width/height attributes (300x150
      // when unset): give the wall overlays their laid-out size
      copy.querySelectorAll('.colour-quiz-room svg').forEach((svg) => {
        const { width, height } = svg.getBoundingClientRect();
        svg.setAttribute('width', Math.round(width));
        svg.setAttribute('height', Math.round(height));
      });
    },
  });
  try {
    await Promise.all([...print.querySelectorAll('img')].map((img) => (img.complete ? null : img.decode().catch(() => null))));
    let pdf;
    if (isIOS()) {
      pdf = new JsPdf('p', 'mm', [210, 295]);
      const canvases = await Promise.all([part1, part2].filter(Boolean)
        .map((part) => html2canvas(part, opts({ useCORS: true, allowTaint: true }))));
      canvases.forEach((canvas, i) => {
        if (i) pdf.addPage();
        pdf.addImage(canvas.toDataURL('image/jpeg'), 'JPEG', 0, 10, 210, 295);
      });
    } else {
      const canvas = await html2canvas(print, opts());
      const img = canvas.toDataURL('image/jpeg');
      const height = (210 * canvas.height) / canvas.width;
      if (!Number.isFinite(height) || height <= 0) throw new Error('empty print render');
      let left = Math.min(height, 295 * 20);
      let y = 10;
      pdf = new JsPdf('p', 'mm');
      pdf.addImage(img, 'JPEG', 0, y, 210, height);
      left -= 295;
      // source paging: each further page shows the image moved up by one A4 height
      while (left >= 0) {
        y = left - height;
        if (part2) pdf.addPage();
        pdf.addImage(img, 'JPEG', 0, y, 210, height);
        left -= 295;
      }
    }
    return pdf;
  } finally {
    restore();
    print.remove();
  }
}

/**
 * PDF state for one results view; the source rebuilds it whenever the
 * answers change.
 */
export function pdfController(block, settings) {
  let token = 0;
  let current = null; // { token, promise }
  let data = null;

  const make = () => {
    if (!current || current.token !== token) {
      const mine = token;
      const promise = renderPdf(block, data).then((pdf) => (mine === token ? pdf : null));
      current = { token: mine, promise };
    }
    return current.promise;
  };

  return {
    /** New results shown: forget the old PDF. */
    reset(next) {
      token += 1;
      current = null;
      data = next;
    },
    /** Make + upload (API results); resolves with the uploaded link ('' if none). */
    async upload() {
      const url = settings.get('pdf upload');
      if (!url || !data) return '';
      const pdf = await make();
      if (!pdf) return '';
      const b64 = pdf.output('datauristring').replace('data:application/pdf;filename=generated.pdf;base64,', '');
      return uploadPdf(url, b64);
    },
    /** "Download (PDF)". */
    async download() {
      if (!data) return;
      const pdf = await make();
      if (!pdf) return;
      const name = label(settings, 'pdf name');
      pdf.save(name);
      track('download_form_pdf', { pdfName: name, title: name });
    },
  };
}

/** WhatsApp share text (source sharetool: og title + description + page link). */
export function whatsappHref() {
  const meta = (p) => document.querySelector(`meta[property="${p}"]`)?.content?.trim() || '';
  const title = meta('og:title');
  const desc = meta('og:description').replace(/&/g, 'and').replace(/%/g, 'percentage');
  const link = (meta('og:url') || window.location.href).replace('/content/ap/en/home', '');
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(`${title} ${desc} ${link}`)}`;
}
