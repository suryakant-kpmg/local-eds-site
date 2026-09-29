import { createOptimizedPicture } from '../../scripts/aem.js';

/**
 * metric-section — "Why choose us" metrics band.
 *
 * Authoring model (see README in metric-section.css header):
 *   Row 1     : header -> [ title | subtitle ]
 *   Rows 2..n : stat   -> [ icon image | count | label ]
 * Renders a heading + subheading and a row of stats (icon + big count + label).
 */

/** Unwrap a lone <p>/<h*> the authoring pipeline adds so text lands cleanly. */
function cellInner(cell) {
  if (!cell) return '';
  const kids = [...cell.children];
  if (kids.length === 1 && /^(P|H[1-6])$/.test(kids[0].tagName)) return kids[0].innerHTML;
  return cell.innerHTML;
}

const text = (cell) => (cell?.textContent || '').trim();

export default function decorate(block) {
  const rows = [...block.children];
  const headerRow = rows.shift();

  // --- header (title + subtitle) ---
  const header = document.createElement('div');
  header.className = 'metric-section-header';
  if (headerRow) {
    const [titleCell, subtitleCell] = headerRow.children;
    if (titleCell && text(titleCell)) {
      const h2 = document.createElement('h2');
      h2.className = 'metric-section-title';
      h2.innerHTML = cellInner(titleCell);
      header.append(h2);
    }
    if (subtitleCell && text(subtitleCell)) {
      const p = document.createElement('p');
      p.className = 'metric-section-subtitle';
      p.innerHTML = cellInner(subtitleCell);
      header.append(p);
    }
  }

  // --- stats ---
  const dl = document.createElement('dl');
  dl.className = 'metric-section-stats';

  rows.forEach((row) => {
    const cells = [...row.children];
    const iconEl = cells[0]?.querySelector('img');
    const count = cellInner(cells[1]);
    const label = cellInner(cells[2]);
    if (!count && !label) return;

    const item = document.createElement('div');
    item.className = 'metric-section-stat';

    if (iconEl) {
      const iconWrap = document.createElement('div');
      iconWrap.className = 'metric-section-stat-icon';
      iconWrap.append(createOptimizedPicture(iconEl.src, iconEl.alt || '', false, [{ width: '120' }]));
      item.append(iconWrap);
    }
    if (count) {
      const dt = document.createElement('dt');
      dt.className = 'metric-section-stat-count';
      dt.innerHTML = count;
      item.append(dt);
    }
    if (label) {
      const dd = document.createElement('dd');
      dd.className = 'metric-section-stat-label';
      dd.innerHTML = label;
      item.append(dd);
    }
    dl.append(item);
  });

  // --- assemble ---
  block.textContent = '';
  if (header.children.length) block.append(header);
  block.append(dl);
}