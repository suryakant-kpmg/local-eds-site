import { createOptimizedPicture } from '../../scripts/aem.js';

/**
 * product-range — two product panels (source: Asian Paints Nilaya Arc
 * "rangeofproducts"). Desktop: the panels overlap; hovering or focusing one
 * widens it and shows its price. Mobile: stacked composite images with the
 * price and a "Product Details" link.
 *
 * Authored rows (first cell = keyword); see README in product-range.css:
 *   product | name | mobile image | desktop background | desktop packshot
 *           | link | price | price note
 *   note    | footnote text
 */

const ARROW = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="17" height="17" aria-hidden="true" focusable="false"><path fill="currentColor" fill-rule="evenodd" d="M10.2563 4.13128C10.598 3.78957 11.152 3.78957 11.4937 4.13128L16.7437 9.38128C17.0854 9.72299 17.0854 10.277 16.7437 10.6187L11.4937 15.8687C11.152 16.2104 10.598 16.2104 10.2563 15.8687C9.91457 15.527 9.91457 14.973 10.2563 14.6313L14.0126 10.875L3.875 10.875C3.39175 10.875 3 10.4832 3 10C3 9.51675 3.39175 9.125 3.875 9.125H14.0126L10.2563 5.36872C9.91457 5.02701 9.91457 4.47299 10.2563 4.13128Z"/></svg>';

const text = (node) => (node?.textContent || '').replace(/\s+/g, ' ').trim();

function el(tag, className, attrs = {}) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
  return node;
}

function picture(img, width, className) {
  const pic = createOptimizedPicture(img.src, img.alt || '', false, [{ width }]);
  const w = img.getAttribute('width');
  const h = img.getAttribute('height');
  if (w && h) {
    pic.querySelector('img').setAttribute('width', w);
    pic.querySelector('img').setAttribute('height', h);
  }
  pic.classList.add(className);
  return pic;
}

/** Optimized (webp) URL for a CSS background, sized like createOptimizedPicture. */
function bgUrl(img, width) {
  const u = new URL(img.src, window.location.href);
  return `url("${u.pathname}?width=${width}&format=webply&optimize=medium")`;
}

/** "₹1125.00" -> MRP, currency and amount parts (styled separately, as on the source). */
function priceLine(value) {
  const p = el('p', 'product-range-mrp');
  const m = value.match(/^(?:MRP\s*)?([^\d\s]*)\s*([\d.,]+)$/i);
  if (!m) {
    p.textContent = value;
    return p;
  }
  p.append('MRP ');
  if (m[1]) p.append(Object.assign(el('span', 'product-range-currency'), { textContent: m[1] }));
  p.append(Object.assign(el('strong', 'product-range-amount'), { textContent: m[2] }));
  return p;
}

/** Trailing "*" in the price note is styled red, as on the source. */
function noteLine(value) {
  const p = el('p', 'product-range-mrp-note');
  const m = value.match(/^(.*?)(\*+)$/);
  if (!m) {
    p.textContent = value;
    return p;
  }
  p.append(m[1], Object.assign(el('span', 'product-range-star', { 'aria-hidden': 'true' }), { textContent: m[2] }));
  return p;
}

function readRows(block) {
  const config = { products: [], note: '' };
  [...block.children].forEach((row) => {
    const cells = [...row.children];
    const kind = text(cells[0]).toLowerCase();
    const img = (i) => cells[i]?.querySelector('img') || null;
    if (kind === 'product') {
      config.products.push({
        name: text(cells[1]),
        mobile: img(2),
        background: img(3),
        packshot: img(4),
        link: cells[5]?.querySelector('a[href]') || null,
        price: text(cells[6]),
        priceNote: text(cells[7]),
      });
    } else if (kind === 'note') {
      config.note = text(cells[1]);
    }
  });
  config.products = config.products.filter((p) => p.mobile || p.packshot);
  return config;
}

export default function decorate(block) {
  const config = readRows(block);
  if (!config.products.length) return;

  const panels = el('div', 'product-range-panels');
  const lazyBgs = [];
  config.products.forEach((p) => {
    const item = el('article', 'product-range-item');
    if (p.name) {
      const h = el('h3', 'product-range-name');
      h.textContent = p.name;
      item.append(h);
    }
    if (p.background) {
      const bg = el('div', 'product-range-bg', { 'aria-hidden': 'true' });
      lazyBgs.push({ bg, url: bgUrl(p.background, 1600) });
      item.append(bg);
    }
    if (p.packshot) item.append(picture(p.packshot, '1000', 'product-range-packshot'));
    if (p.mobile) item.append(picture(p.mobile, '750', 'product-range-mobile'));
    if (p.price || p.priceNote) {
      const price = el('div', 'product-range-price');
      if (p.price) price.append(priceLine(p.price));
      if (p.priceNote) price.append(noteLine(p.priceNote));
      item.append(price);
    }
    if (p.link) {
      const a = el('a', 'product-range-cta', { href: p.link.getAttribute('href') });
      a.append(text(p.link) || 'Product Details');
      const extra = [p.name ? ` for ${p.name}` : '', p.link.target === '_blank' ? ' (opens in a new tab)' : ''].join('');
      if (p.link.target === '_blank') {
        a.target = '_blank';
        a.rel = 'noopener';
      }
      if (extra) a.append(Object.assign(el('span', 'product-range-visually-hidden'), { textContent: extra }));
      a.insertAdjacentHTML('beforeend', ARROW);
      item.append(a);
    }
    panels.append(item);
  });

  const children = [panels];
  if (config.note) {
    const note = el('p', 'product-range-note');
    note.textContent = config.note;
    children.push(note);
  }
  block.replaceChildren(...children);

  // desktop textures are CSS backgrounds (stretched like the source); set
  // them only when the block nears the viewport so they load lazily
  const load = () => lazyBgs.forEach(({ bg, url }) => bg.style.setProperty('--product-range-bg', url));
  if (!('IntersectionObserver' in window)) {
    load();
    return;
  }
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      load();
      io.disconnect();
    }
  }, { rootMargin: '300px' });
  io.observe(block);
}
