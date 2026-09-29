/*
** Authoring format **
Row 1 (header)
  Col 1 contains the heading (rich text, e.g. "Give Every Corner A Little Character")
  Col 2 contains the intro description (plain text)
Row 2 (config)
  Col 1 contains the label "Open in new tab"
  Col 2 contains true / false (defaults to false) - applies to all card links
Row 3+ (one row per card)
  Col 1 contains the desktop background image
  Col 2 contains the mobile background image (optional, falls back to Col 1)
  Col 3 contains the card title
  Col 4 contains the card description
  Col 5 contains the card link URL (optional, e.g. /resources/tools/modular-kitchens.html)
*/

/**
 * Splits the heading into two lines so the second can be indented. Uses the
 * authored line break when present, otherwise breaks at the word boundary
 * that best balances the two lines.
 * @param {string} html The heading's inner HTML
 * @returns {string[]} the heading lines (HTML)
 */
import { getDigitalData, trackEvent , pushAdobeCtaClickEvent } from '../../scripts/analytics_1.js';

function splitHeadingLines(html) {
  const byBreak = html.split(/<br\s*\/?>/i).map((l) => l.trim()).filter(Boolean);
  if (byBreak.length > 1) return byBreak;

  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  const words = tmp.textContent.trim().split(/\s+/);
  if (words.length < 2) return [html];
  let best = 1;
  let bestDiff = Infinity;
  for (let i = 1; i < words.length; i += 1) {
    const diff = Math.abs(words.slice(0, i).join(' ').length - words.slice(i).join(' ').length);
    if (diff < bestDiff) {
      best = i;
      bestDiff = diff;
    }
  }
  return [words.slice(0, best).join(' '), words.slice(best).join(' ')];
}

/**
 * Service Matrix
 * A heading/description header followed by a grid of image cards. Each card
 * shows a title and short description over a background image, with an arrow
 * link in the top-right corner. See the authoring format at the top of the file.
 *
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const rows = [...block.children];
  if (!rows.length) return;

  // --- config: "Open in new tab | true" makes card links open in a new tab ---
  const isConfigRow = (row) => !row.querySelector('img, picture')
    && /^open\s+in\s+new\s+tab$/i.test(row.children[0]?.textContent.trim() || '');
  const configRow = rows.find(isConfigRow);
  const openInNewTab = configRow?.children[1]?.textContent.trim().toLowerCase() === 'true';

  // --- header: first non-config row without an image is heading | description
  const headerRow = rows.find((row) => !row.querySelector('img, picture') && !isConfigRow(row));
  const cardRows = rows.filter((row) => row.querySelector('img, picture'));

  const header = document.createElement('div');
  header.className = 'service-matrix-header';
  if (headerRow) {
    const cells = [...headerRow.children];
    const heading = document.createElement('div');
    heading.className = 'service-matrix-heading';
    const headingHtml = (cells[0]?.querySelector('h1, h2, h3, p') || cells[0])?.innerHTML || '';
    splitHeadingLines(headingHtml).forEach((line, i) => {
      // keep a real space between lines so they flow as one sentence on mobile
      if (i) heading.append(' ');
      const span = document.createElement('span');
      span.className = 'service-matrix-heading-line';
      span.innerHTML = line;
      heading.append(span);
    });
    header.append(heading);
    if (cells[1] && cells[1].textContent.trim()) {
      const desc = document.createElement('div');
      desc.className = 'service-matrix-intro';
      desc.innerHTML = (cells[1].querySelector('p') || cells[1]).innerHTML;
      header.append(desc);
    }
  }

  // --- cards ------------------------------------------------------------
  const grid = document.createElement('div');
  grid.className = 'service-matrix-cards';

  cardRows.forEach((row) => {
    const cells = [...row.children];
    // The first two image cells are the desktop and mobile background images
    // (authored as two separate columns). A card may still author a single
    // image, in which case it is used for both viewports.
    const imgs = [...row.querySelectorAll('img')];
    const desktopImg = imgs[0];
    const mobileImg = imgs[1] || imgs[0];
    // the remaining non-image cells: title, description, and an optional link
    const textCells = cells.filter((c) => !c.querySelector('img, picture'));
    const linkEl = row.querySelector('a');
    const href = linkEl ? linkEl.getAttribute('href') : '';
    const title = textCells[0] ? textCells[0].textContent.trim() : '';
    // description is the first remaining cell that isn't the title or a bare link
    const descCell = textCells.find((c, i) => i > 0 && !(c.querySelector('a') && c.textContent.trim() === (linkEl?.textContent.trim() || '')));
    const description = descCell ? descCell.textContent.trim() : '';

    // a card is an anchor when a link is authored, otherwise a plain article
    const card = document.createElement(href ? 'a' : 'article');
    card.className = 'service-matrix-card';
    if (href) {
      card.href = href;
      card.setAttribute('aria-label', title);
      if (openInNewTab) {
        card.target = '_blank';
        card.rel = 'noopener noreferrer';
      }
    }

    // background image: a <picture> that serves the mobile image by default
    // and swaps to the desktop image at the 900px breakpoint.
    if (mobileImg) {
      const picture = document.createElement('picture');
      picture.className = 'service-matrix-card-bg';
      if (desktopImg) {
        const [desktopSrc] = (desktopImg.currentSrc || desktopImg.src).split('?');
        const source = document.createElement('source');
        source.media = '(min-width: 900px)';
        source.srcset = desktopSrc;
        picture.append(source);
      }
      const [mobileSrc] = (mobileImg.currentSrc || mobileImg.src).split('?');
      const img = document.createElement('img');
      img.src = mobileSrc;
      img.alt = mobileImg.alt || desktopImg?.alt || title;
      img.loading = 'lazy';
      picture.append(img);
      card.append(picture);
    }

    // arrow indicator (top-right)
    const arrow = document.createElement('span');
    arrow.className = 'service-matrix-card-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    card.append(arrow);

    // title (top-left)
    const titleEl = document.createElement('h3');
    titleEl.className = 'service-matrix-card-title';
    titleEl.textContent = title;
    card.append(titleEl);

    // description (bottom)
    if (description) {
      const descEl = document.createElement('p');
      descEl.className = 'service-matrix-card-desc';
      descEl.textContent = description;
      card.append(descEl);
    }

    grid.append(card);
  });

  // Add click handlers for cards with href
  grid.querySelectorAll('.service-matrix-card[href]').forEach((card) => {
    card.addEventListener('click', (event) => {
      // Get card title
      const cardTitle = card.querySelector('.service-matrix-card-title')?.textContent?.trim();
      
      // Get card href
      const cardHref = card.href;
      
      // Get parent title from the service-matrix-heading
      const headingLines = [...document.querySelectorAll('.service-matrix-heading-line')]
        .map((span) => span.textContent?.trim())
        .filter(Boolean)
        .join(' ');
      const parentTitle = headingLines || 'Service Matrix';
      
      trackEvent('cta_link_text', {
        cta_: cardTitle,
        parentTitle: parentTitle,
        param1: cardHref,
      });

      pushAdobeCtaClickEvent({
        event: "squarecross_click",
        detail2: cardHref || '',
        cta: cardTitle || ''
      })

    });
  });

  block.textContent = '';
  block.append(header, grid);
}