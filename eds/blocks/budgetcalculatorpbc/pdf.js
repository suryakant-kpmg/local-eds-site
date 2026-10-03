/**
 * PDF export for the budgetcalculatorpbc block (pbc variant).
 *
 * Builds A4 pages (595 x 842 CSS px) listing every recommended system in rank
 * order (or only the clicked card, with "Systems | selected"), renders each
 * page with html2canvas and assembles them with jsPDF. Rendering page by page
 * keeps every canvas well inside iOS Safari's canvas size limit. All copy and
 * icons come from the block's "PDF" section.
 *
 * Delivery: desktop and Android download the file directly. iOS only allows
 * opening a generated file from a fresh tap, so there the same button turns
 * into "Open PDF" and opens the file in a new tab on the next tap.
 */
import { loadCSS, loadScript } from '../../scripts/aem.js';

const BLOCK_PATH = `${window.hlx.codeBasePath}/blocks/budgetcalculatorpbc`;
const VENDOR_PATH = `${window.hlx.codeBasePath}/scripts/vendor`;
// Product images are drawn into the PDF, so they must be CORS-readable. The
// static CDN serves the same DAM paths with Access-Control-Allow-Origin: *,
// while www.asianpaints.com only allows its own origin.
const IMAGE_CDN = 'https://static.asianpaints.com';
const PAGE = { width: 595, height: 842 };
const STEP_KEYS = ['stepOne', 'stepTwo', 'stepThree', 'stepFour'];

let libraries = null;
let busy = false;

function loadLibraries() {
  if (!libraries) {
    libraries = Promise.all([
      loadScript(`${VENDOR_PATH}/jspdf.umd.min.js`),
      loadScript(`${VENDOR_PATH}/html2canvas-pro.min.js`),
      loadCSS(`${BLOCK_PATH}/pdf.css`),
    ]).catch((err) => {
      libraries = null;
      throw err;
    });
  }
  return libraries;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const copy = (cfg, key, fallback = '') => (cfg[key] && cfg[key].text) || fallback;
const cellImage = (cfg, key) => (cfg[key] ? cfg[key].cell.querySelector('img') : null);

function fill(template, values) {
  return template.replace(/\{(\w+)\}/g, (m, key) => (key in values ? values[key] : m));
}

// A DAM path (or www.asianpaints.com URL) on the CORS-enabled image CDN.
function cdnImage(path) {
  const clean = (path || '').trim();
  if (!clean) return '';
  const url = new URL(clean, IMAGE_CDN);
  if (url.hostname === 'www.asianpaints.com') url.hostname = new URL(IMAGE_CDN).hostname;
  return url.href;
}

// An image authored in DA is served from this site, so it is always readable.
const authored = (img) => (img ? new URL(img.getAttribute('src'), window.location.href).href : '');

function image(src, className) {
  const img = el('img', className);
  img.crossOrigin = 'anonymous';
  img.alt = '';
  if (src) img.src = src;
  return img;
}

function parseStep(raw) {
  if (!raw || !raw.trim()) return null;
  const parts = raw.split('|').map((p) => p.trim());
  const [, coats, name] = parts[0].match(/^(\d+)\s+(.*)$/) || [null, '', parts[0]];
  return {
    name, coats: Number(coats) || 0, image: cdnImage(parts[1]), quantity: (parts[6] || '').replace(/\s+/g, ' '),
  };
}

// Name, email and mobile from the lead form, whatever the fields are called.
function contact(lead) {
  const entries = Object.entries(lead || {});
  const find = (re) => (entries.find(([k]) => re.test(k)) || [])[1] || '';
  return { name: find(/name/), email: find(/email/), mobile: find(/mobile|phone/) };
}

function callLine(template, phone, className) {
  const line = el('p', className);
  const [before, after = ''] = template.split('{phone}');
  line.append(before, el('span', 'pbcpdf-phone', phone), after);
  return line;
}

function disclaimer(cfg) {
  const note = el('p', 'pbcpdf-disclaimer');
  note.append(el('span', 'pbcpdf-info-icon', 'i'), copy(cfg, 'disclaimer', 'Final price may vary according to condition of the wall and local labour rates.'));
  return note;
}

function newPage(variant) {
  const page = el('div', `pbcpdf-page pbcpdf-page-${variant}`);
  const content = el('div', 'pbcpdf-page-content');
  const footer = el('div', 'pbcpdf-page-footer');
  page.append(content, footer);
  return {
    page, content, footer, count: 0,
  };
}

/* ------------------------------------------------------- product pages */

function header(cfg, person) {
  const wrap = el('header', 'pbcpdf-header');
  const greeting = el('div', 'pbcpdf-greeting');
  const name = person.name || copy(cfg, 'default-name', 'Customer');
  greeting.append(
    el('p', 'pbcpdf-name', `${copy(cfg, 'greeting', 'Dear')} ${name},`),
    el('p', 'pbcpdf-intro', copy(cfg, 'header-text', 'Here are the best recommended solutions for you. Please review and reach out to us, for any questions.')),
  );
  const details = el('div', 'pbcpdf-contact');
  const logo = cellImage(cfg, 'logo');
  if (logo) details.append(image(authored(logo), 'pbcpdf-logo'));
  const line = (label, value) => {
    const p = el('p', 'pbcpdf-contact-line', `${label} `);
    p.append(el('strong', '', value));
    details.append(p);
  };
  if (person.mobile) line(copy(cfg, 'mobile-label', 'Mobile no:'), person.mobile);
  if (person.email) line(copy(cfg, 'email-label', 'Email:'), person.email);
  wrap.append(greeting, details);
  return wrap;
}

function productBox(system, area, cfg, labels, withBadge) {
  const box = el('section', 'pbcpdf-product');
  if (withBadge) box.append(el('span', 'pbcpdf-badge', copy(cfg, 'badge', 'Recommended Solution')));

  const cost = Number(system.bhpsCost) || 0;
  const perSqft = Number(system.totalCostPerSqFt) || 0;
  const paintArea = perSqft ? Math.round(cost / perSqft) : 0;
  const factor = area ? Number((paintArea / area).toFixed(2)) : 0;

  const main = el('div', 'pbcpdf-product-main');
  main.append(image(cdnImage(system.swatchImage), 'pbcpdf-packshot'));
  const info = el('div', 'pbcpdf-product-info');
  info.append(
    el('p', 'pbcpdf-product-name', system.entityName || system.title || ''),
    el('p', 'pbcpdf-product-subtitle', copy(cfg, 'product-subtitle', 'For best Painting solution')),
  );
  const rows = el('dl', 'pbcpdf-rows');
  const row = (label, value, mark) => {
    const dd = el('dd', '', value);
    if (mark) dd.append(el('span', 'pbcpdf-mark', '*'));
    rows.append(el('dt', '', label), dd);
  };
  row(copy(cfg, 'cost-label', 'Total cost'), `Rs.${cost.toFixed(2)}`, true);
  row(fill(labels.paintArea, { area, factor }), `${paintArea} sqft`);
  row(labels.perSqft, `Rs.${perSqft.toFixed(2)}`);
  info.append(rows);
  main.append(info);
  box.append(main);

  // How to apply: each step's product in application order, with coats,
  // layer type and the quantity to buy.
  const steps = STEP_KEYS.map((k) => parseStep(system[k])).filter(Boolean);
  if (steps.length) {
    const [coat, coats] = (cfg['coat-labels'] ? cfg['coat-labels'].cells.map((c) => c.textContent.trim()) : [])
      .concat(['COAT', 'COATS'].slice(cfg['coat-labels'] ? cfg['coat-labels'].cells.length : 0));
    const layers = ['PRIMER', 'PUTTY', 'TOP COAT'];
    if (cfg['layer-labels']) cfg['layer-labels'].cells.forEach((c, i) => { layers[i] = c.textContent.trim() || layers[i]; });
    const stepLabel = copy(cfg, 'step-label', 'STEP');
    const qtyLabel = copy(cfg, 'quantity-label', 'Quantity Required');

    box.append(el('p', 'pbcpdf-steps-title', copy(cfg, 'steps-title', 'How to apply & Quantity to purchase')));
    const list = el('ol', 'pbcpdf-steps');
    steps.forEach((step, i) => {
      let layer = layers[0];
      if (i === steps.length - 1) [, , layer] = layers;
      else if (/putty/i.test(step.name)) [, layer] = layers;
      const item = el('li', 'pbcpdf-step');
      item.append(
        el('p', 'pbcpdf-step-count', `${stepLabel} ${String(i + 1).padStart(2, '0')}`),
        el('p', 'pbcpdf-step-coat', `${step.coats} ${step.coats > 1 ? coats : coat} • ${layer}`),
        image(step.image, 'pbcpdf-step-image'),
        el('p', 'pbcpdf-step-name', step.name),
        el('p', 'pbcpdf-step-qty-label', qtyLabel),
        el('p', 'pbcpdf-step-qty', step.quantity),
      );
      list.append(item);
    });
    box.append(list);
  }
  return box;
}

/* ---------------------------------------------------------- info pages */

function infoPage(cfg) {
  const sections = [
    ['why-title', 'Why Choose us?', 'why-item'],
    ['how-title', 'How it works?', 'how-item'],
  ].filter(([, , items]) => cfg[items].length);
  if (!sections.length) return null;
  const page = newPage('info');
  sections.forEach(([titleKey, fallback, items]) => {
    const panel = el('section', 'pbcpdf-panel');
    panel.append(el('h2', 'pbcpdf-panel-title', copy(cfg, titleKey, fallback)));
    const grid = el('div', 'pbcpdf-features');
    cfg[items].forEach((item) => {
      const feature = el('div', 'pbcpdf-feature');
      if (item.icon) feature.append(image(authored(item.icon), 'pbcpdf-feature-icon'));
      const text = el('div', 'pbcpdf-feature-text');
      text.append(el('p', 'pbcpdf-feature-title', item.title));
      if (item.body) text.append(el('p', 'pbcpdf-feature-description', item.body.textContent.trim()));
      feature.append(text);
      grid.append(feature);
    });
    panel.append(grid);
    page.content.append(panel);
  });
  page.content.append(disclaimer(cfg));
  return page;
}

function plansPage(cfg, phone) {
  if (!cfg.plan.length) return null;
  const page = newPage('plans');
  page.content.append(el('h2', 'pbcpdf-plans-title', copy(cfg, 'plans-title', 'Choose a plan that best suits you')));
  const icons = [cellImage(cfg, 'included-icon'), cellImage(cfg, 'warranty-icon')];
  const grid = el('div', 'pbcpdf-plans');
  cfg.plan.forEach((plan, i) => {
    const card = el('section', `pbcpdf-plan pbcpdf-plan-${i + 1}`);
    const head = el('div', 'pbcpdf-plan-head');
    if (plan.icon) head.append(image(authored(plan.icon), 'pbcpdf-plan-icon'));
    head.append(el('p', 'pbcpdf-plan-name', plan.title));
    card.append(head);
    // The plan body alternates a heading paragraph ("Included", "Warranty")
    // with the list that belongs to it.
    let headings = 0;
    [...(plan.body ? plan.body.children : [])].forEach((node) => {
      if (node.tagName === 'UL' || node.tagName === 'OL') {
        const list = el('ul', 'pbcpdf-plan-list');
        node.querySelectorAll('li').forEach((li) => list.append(el('li', '', li.textContent.trim())));
        card.append(list);
      } else if (node.textContent.trim()) {
        const heading = el('p', 'pbcpdf-plan-heading');
        const icon = icons[Math.min(headings, icons.length - 1)];
        if (icon) heading.append(image(authored(icon), 'pbcpdf-plan-heading-icon'));
        heading.append(node.textContent.trim());
        card.append(heading);
        headings += 1;
      }
    });
    grid.append(card);
  });
  page.content.append(grid, disclaimer(cfg));
  page.footer.append(callLine(copy(cfg, 'plans-call-text', 'Call us on {phone} to book the plan'), phone, 'pbcpdf-call pbcpdf-call-plans'));
  return page;
}

/* ---------------------------------------------------------- assembling */

function buildPages({
  system, systems, area, config, labels, lead,
}) {
  const phone = copy(config, 'phone', '1800-266-2090');
  const rank = (s) => Number(s.systemRank) || 0;
  const ranked = [...systems].sort((a, b) => rank(a) - rank(b));
  // As in the existing AEM PDF, every recommended system is listed in rank
  // order (the badge marks the best one). "Systems | selected" limits the PDF
  // to the card whose Download PDF was clicked.
  const list = copy(config, 'systems', 'all').toLowerCase() === 'selected'
    ? [system]
    : ranked;

  // Two recommendations per page, the first page led by the greeting.
  const pages = [];
  let current = null;
  list.forEach((s, i) => {
    if (!current || current.count === 2) {
      current = newPage('products');
      if (!pages.length) current.content.append(header(config, contact(lead)));
      pages.push(current);
    }
    current.content.append(productBox(s, Number(area), config, labels, i === 0));
    current.count += 1;
  });
  pages.forEach((page, i) => {
    page.footer.append(disclaimer(config));
    if (i === pages.length - 1) {
      page.footer.append(el('hr', 'pbcpdf-rule'), callLine(copy(config, 'call-text', 'For painting needs call on {phone}'), phone, 'pbcpdf-call'));
    }
  });
  [infoPage(config), plansPage(config, phone)].forEach((page) => { if (page) pages.push(page); });
  return pages.map((p) => p.page);
}

const loaded = (img) => (img.complete ? Promise.resolve() : new Promise((resolve) => {
  img.addEventListener('load', resolve, { once: true });
  img.addEventListener('error', resolve, { once: true });
}));

async function renderPdf(pages) {
  const host = el('div', 'pbcpdf');
  host.setAttribute('aria-hidden', 'true');
  host.append(...pages);
  document.body.append(host);
  try {
    await Promise.all([...host.querySelectorAll('img')].map(loaded));
    if (document.fonts) {
      // The PDF typeface must be ready before the first page is drawn.
      await Promise.all(['400', '600', '700'].map((w) => document.fonts.load(`${w} 10px pbcpdf-manrope`)));
      await document.fonts.ready;
    }
    const PdfDocument = window.jspdf.jsPDF;
    const doc = new PdfDocument({ unit: 'pt', format: 'a4', compress: true });
    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();
    // Pages render one after another so only one canvas is alive at a time.
    await pages.reduce((prev, page, i) => prev.then(async () => {
      const canvas = await window.html2canvas(page, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#f3f3f3',
        logging: false,
        width: PAGE.width,
        height: PAGE.height,
        windowWidth: PAGE.width,
      });
      if (i) doc.addPage();
      doc.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, width, height, undefined, 'FAST');
      canvas.width = 0;
      canvas.height = 0;
    }), Promise.resolve());
    return doc.output('blob');
  } finally {
    host.remove();
  }
}

/* ------------------------------------------------------------ delivery */

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function save(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = el('a');
  link.href = url;
  link.download = fileName;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// iOS only opens or shares a generated file from a fresh tap, so a finished
// PDF waits on its button ("Open PDF") until the user taps it again.
const readyPdfs = new WeakMap();

function openReady(button, ui) {
  const { url, file } = readyPdfs.get(button);
  readyPdfs.delete(button);
  ui.reset();
  const tab = window.open(url, '_blank');
  if (!tab) {
    // Popups blocked: fall back to the share sheet, else this tab.
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: file.name }).catch(() => {});
    } else {
      window.location.assign(url);
    }
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// Pending timers that hide a card's PDF error message, by message element.
const errorTimers = new WeakMap();

// The Download PDF button reflects progress: a spinner next to its icon while
// the PDF is prepared, an inline message if it fails (hidden again after a few
// seconds), and on iOS a ready state.
function buttonState(button, cfg) {
  const row = button.closest('.budgetcalculatorpbc-pdf');
  const label = button.querySelector('.budgetcalculatorpbc-pdf-label');
  const error = row.querySelector('.budgetcalculatorpbc-pdf-error');
  const status = row.querySelector('[aria-live]');
  if (!button.dataset.label) button.dataset.label = label.textContent;
  const announce = (message) => { status.textContent = message; };
  const clearError = () => {
    clearTimeout(errorTimers.get(error));
    errorTimers.delete(error);
    if (error.textContent && status.textContent === error.textContent) announce('');
    error.textContent = '';
  };
  return {
    loading() {
      clearError();
      button.classList.add('is-loading');
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      announce(copy(cfg, 'loading-text', 'Generating your PDF…'));
    },
    idle() {
      button.classList.remove('is-loading');
      button.disabled = false;
      button.removeAttribute('aria-busy');
      // Clear the loading announcement unless a ready/error message replaced it.
      if (status.textContent === copy(cfg, 'loading-text', 'Generating your PDF…')) announce('');
    },
    ready() {
      label.textContent = copy(cfg, 'open-text', 'Open PDF');
      button.classList.add('is-ready');
      announce(copy(cfg, 'ready-text', 'Your PDF is ready'));
    },
    reset() {
      label.textContent = button.dataset.label;
      button.classList.remove('is-ready');
      announce('');
    },
    failed() {
      const message = copy(cfg, 'error-text', 'Sorry, we couldn’t create the PDF. Please try again.');
      clearError();
      error.textContent = message;
      announce(message);
      const seconds = Number(copy(cfg, 'error-duration', '5'));
      errorTimers.set(error, setTimeout(clearError, (seconds > 0 ? seconds : 5) * 1000));
    },
  };
}

export default async function downloadPdf(options) {
  const { button, config } = options;
  const ui = buttonState(button, config);
  if (readyPdfs.has(button)) {
    openReady(button, ui);
    return;
  }
  if (busy) return;
  busy = true;
  ui.loading();
  try {
    await loadLibraries();
    const blob = await renderPdf(buildPages(options));
    const name = copy(config, 'file-name', 'Asian-Paints-Painting-Quotation.pdf');
    const fileName = /\.pdf$/i.test(name) ? name : `${name}.pdf`;
    if (isIOS()) {
      const file = new File([blob], fileName, { type: 'application/pdf' });
      readyPdfs.set(button, { url: URL.createObjectURL(blob), file });
      ui.ready();
    } else {
      save(blob, fileName);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('budgetcalculatorpbc: PDF generation failed', err);
    ui.failed();
  } finally {
    busy = false;
    ui.idle();
  }
}
