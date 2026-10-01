/**
 * Contact Us - Complaint Bot block.
 *
 * Two side-by-side help panels separated by an "OR" divider. All text and the
 * block background colour come from Document Authoring.
 *
 * Authoring model (rows, top to bottom):
 *   Optional config row → | Background | #f5f5f5 |
 *       (first cell contains "background" or "color"; second cell is the value)
 *   Panels row → | left panel content | right panel content |
 *       Each cell holds its own heading, paragraph(s) and a link. In the left
 *       (complaint) panel the first link renders as the purple CTA button.
 */
import { trackEvent, pushAdobeCtaClickEvent } from '../../scripts/analytics_1.js';

function isColorConfig(row) {
  const first = row.children[0];
  if (!first) return false;
  const key = first.textContent.trim().toLowerCase();
  return key === 'background' || key === 'background color'
    || key === 'color' || key === 'bg' || key === 'bg color';
}

export default function decorate(block) {
  const rows = [...block.children];

  // Optional config row for the background colour.
  let bgColor = '';
  if (rows.length && isColorConfig(rows[0])) {
    const configRow = rows.shift();
    bgColor = configRow.children[1] ? configRow.children[1].textContent.trim() : '';
  }

  // Panels row: left (complaint) | right (paints selection).
  const panelRow = rows.shift();
  const panelCells = panelRow ? [...panelRow.children] : [];
  const leftCell = panelCells[0] || null;
  const rightCell = panelCells[1] || null;

  // --- Build the new structure --------------------------------------------
  block.textContent = '';
  if (bgColor) {
    block.style.backgroundColor = bgColor;
  }

  // Left (complaint) panel — first link becomes the CTA button.
  const left = document.createElement('div');
  left.className = 'contact-complaint-bot-panel contact-complaint-bot-complaint';
  if (leftCell) {
    const authoredLink = leftCell.querySelector('a[href]');
    // clone drops the global bindButtonContainerTracking listener (custom_cta_click)
    const firstLink = authoredLink ? authoredLink.cloneNode(true) : null;
    if (firstLink) {
      authoredLink.replaceWith(firstLink);
      firstLink.classList.add('contact-complaint-bot-cta');
      firstLink.addEventListener('click', () => {
        const cta = firstLink.textContent.trim();
        const parentTitle = left.querySelector('h1, h2, h3, h4, h5, h6')?.textContent.trim() || '';
        const destinationUrl = firstLink.href;
        trackEvent('contact_us_click_whatsapp', { cta_: cta, parentTitle, redirectionLink: destinationUrl });
        pushAdobeCtaClickEvent({
          cta, parentTitle, destinationUrl, event: 'contact_us_click_whatsapp',
        });
      });
      try {
        const url = new URL(firstLink.href, window.location.href);
        if (url.origin !== window.location.origin) {
          firstLink.target = '_blank';
          firstLink.rel = 'noopener noreferrer';
        }
      } catch (e) {
        // leave malformed hrefs as-is
      }
    }
    while (leftCell.firstChild) left.append(leftCell.firstChild);

    // Place the CTA beside the paragraph that precedes it (side-by-side on desktop).
    const ctaHolder = firstLink ? firstLink.closest('p') : null;
    const intro = ctaHolder ? ctaHolder.previousElementSibling : null;
    if (ctaHolder && ctaHolder.textContent.trim() === firstLink.textContent.trim()
      && intro && intro.tagName === 'P') {
      const row = document.createElement('div');
      row.className = 'contact-complaint-bot-row';
      intro.before(row);
      row.append(intro, ctaHolder);
    }
  }

  // Divider with "OR".
  const divider = document.createElement('div');
  divider.className = 'contact-complaint-bot-divider';
  divider.setAttribute('aria-hidden', 'true');
  const or = document.createElement('span');
  or.textContent = 'OR';
  divider.append(or);

  // Right (paints selection) panel — links render as plain email links.
  const right = document.createElement('div');
  right.className = 'contact-complaint-bot-panel contact-complaint-bot-paints';
  if (rightCell) {
    rightCell.querySelectorAll('a[href]').forEach((authored) => {
      // clone drops the global bindButtonContainerTracking listener (custom_cta_click)
      const a = authored.cloneNode(true);
      authored.replaceWith(a);
      a.classList.add('contact-complaint-bot-email');
      a.addEventListener('click', () => {
        const cta = a.textContent.trim();
        const parentTitle = right.querySelector('h1, h2, h3, h4, h5, h6')?.textContent.trim() || '';
        const destinationUrl = a.getAttribute('href') || '';
        trackEvent('cta_link_text', { cta_: cta, parentTitle, param1: destinationUrl });
        pushAdobeCtaClickEvent({
          cta, parentTitle, destinationUrl, event: 'cta_link_text',
        });
      });
    });
    while (rightCell.firstChild) right.append(rightCell.firstChild);
  }

  block.append(left, divider, right);
}
