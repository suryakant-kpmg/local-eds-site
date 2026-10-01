/**
 * Get in Touch block.
 *
 * A contact banner with a background image, an eyebrow label, a heading, two
 * information columns, and a configurable CTA (e.g. "Get Direction"). Every
 * piece of content comes from Document Authoring.
 *
 * Authoring model (rows, top to bottom):
 *   Row 1 → background image (a single picture)
 *   Row 2 → | Title | eyebrow label (e.g. "Get in touch") |
 *   Row 3 → | Subtitle | heading (e.g. "We'd love to hear from you") |
 *       The value is read from the last cell, so a single-cell row still works.
 *   Open-in-new-tab row → | Open in new tab | true/false |
 *       Identified by a cell whose text is exactly "true" or "false".
 *       true opens the CTA link in a new tab; false (default) opens it in the
 *       same tab.
 *   CTA row → | CTA name | CTA link |
 *       Identified by a second cell holding only a link/URL. The CTA renders
 *       under the first info column.
 *       (Legacy 3-cell form | name | link | true/false | is still supported.)
 *   Columns row → | left info column | right info column |
 *       Each column holds its own bold label and paragraph(s).
 */

import { trackEvent , pushAdobeCtaClickEvent } from '../../scripts/analytics_1.js'; 


function findBooleanCell(cells) {
  return cells.findIndex((cell) => {
    const t = cell.textContent.trim().toLowerCase();
    return t === 'true' || t === 'false';
  });
}

// Returns the href if the cell contains only a link (authored anchor or plain URL).
function getLinkOnlyHref(cell) {
  if (!cell) return '';
  const text = cell.textContent.trim();
  const anchors = cell.querySelectorAll('a[href]');
  if (anchors.length === 1 && anchors[0].textContent.trim() === text) {
    return anchors[0].getAttribute('href');
  }
  if (!anchors.length && /^(https?:\/\/|\/|#|mailto:|tel:)\S*$/i.test(text)) return text;
  return '';
}

// Text of a | label | value | row (the last cell), or of a legacy single-cell row.
function getRowValue(row) {
  const lastCell = row ? row.lastElementChild : null;
  return lastCell ? lastCell.textContent.trim() : '';
}

export default function decorate(block) {
  const rows = [...block.children];

  // Row 1: background image.
  const bgRow = rows.shift();
  const bgPic = bgRow ? bgRow.querySelector('picture') : null;

  // Row 2: eyebrow. Row 3: heading. (Both plain text.)
  const eyebrow = getRowValue(rows.shift());
  const heading = getRowValue(rows.shift());

  // Remaining rows: open-in-new-tab flag, CTA row and info-column rows.
  let ctaConfig = null;
  let openInNewTab = false;
  const columnCells = [];

  rows.forEach((row) => {
    const cells = [...row.children];
    const boolIndex = findBooleanCell(cells);

    if (boolIndex !== -1) {
      const flag = cells[boolIndex].textContent.trim().toLowerCase() === 'true';
      const otherCells = cells.filter((_, i) => i !== boolIndex);
      const linkCell = otherCells.find((cell) => getLinkOnlyHref(cell));
      if (linkCell) {
        // Legacy CTA row: | name | link | true/false |
        const nameCell = otherCells.find((cell) => cell !== linkCell);
        ctaConfig = {
          name: nameCell ? nameCell.textContent.trim() : '',
          href: getLinkOnlyHref(linkCell),
        };
      }
      // Either way the boolean controls whether the CTA opens in a new tab.
      openInNewTab = flag;
    } else if (cells.length === 2 && !ctaConfig && getLinkOnlyHref(cells[1])) {
      // CTA row: | name | link |
      ctaConfig = {
        name: cells[0].textContent.trim(),
        href: getLinkOnlyHref(cells[1]),
      };
    } else {
      // Info columns row.
      cells.forEach((cell) => columnCells.push(cell));
    }
  });

  // --- Build the new structure --------------------------------------------
  block.textContent = '';

  // Background image layer.
  if (bgPic) {
    const media = document.createElement('div');
    media.className = 'contact-get-in-touch-media';
    media.append(bgPic);
    block.append(media);
  }

  const content = document.createElement('div');
  content.className = 'contact-get-in-touch-content';

  if (eyebrow) {
    const eb = document.createElement('p');
    eb.className = 'contact-get-in-touch-eyebrow';
    eb.textContent = eyebrow;
    content.append(eb);
  }

  if (heading) {
    const h = document.createElement('h2');
    h.className = 'contact-get-in-touch-heading';
    h.textContent = heading;
    content.append(h);
  }

  // Build the CTA element (rendered under the first column below).
  let ctaEl = null;
  if (ctaConfig && ctaConfig.name && ctaConfig.href) {
    ctaEl = document.createElement('a');
    ctaEl.className = 'contact-get-in-touch-cta';
    ctaEl.href = ctaConfig.href;
    ctaEl.textContent = ctaConfig.name;
    // "Open in new tab" flag: true → new tab, false/absent → same tab.
    if (openInNewTab) {
      ctaEl.target = '_blank';
      ctaEl.rel = 'noopener noreferrer';
    }
    ctaEl.addEventListener('click', () => {
      const cta = ctaEl.textContent.trim();
      const destinationUrl = ctaEl.href;
      trackEvent('cta_link_text', { cta_: cta, parentTitle: heading, param1: destinationUrl });
      pushAdobeCtaClickEvent({
        cta, parentTitle: heading, destinationUrl, event: 'cta_link_text',
      });
    });
  }

  if (columnCells.length) {
    const cols = document.createElement('div');
    cols.className = 'contact-get-in-touch-columns';
    columnCells.forEach((cell, index) => {
      const col = document.createElement('div');
      col.className = 'contact-get-in-touch-column';
      // Move the authored content into the column wrapper.
      while (cell.firstChild) col.append(cell.firstChild);
      // Tag paragraphs for styling: a bold-only label (e.g. "Head Office") is the
      // title; any other paragraph (address, phone, etc.) is body text.
      col.querySelectorAll('p').forEach((p) => {
        const label = p.querySelector('strong, b');
        if (label && p.textContent.trim() === label.textContent.trim()) {
          p.classList.add('contact-get-in-touch-column-title');
          label.classList.add('contact-get-in-touch-column-label');
        } else {
          p.classList.add('contact-get-in-touch-column-text');
        }
      });
      // Place the CTA under the first column, matching the reference layout.
      if (index === 0 && ctaEl) {
        col.append(ctaEl);
      }
      cols.append(col);
    });
    content.append(cols);
  } else if (ctaEl) {
    // No columns authored — still render the CTA.
    content.append(ctaEl);
  }

  block.append(content);
}
