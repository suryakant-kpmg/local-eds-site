import { createOptimizedPicture } from '../../scripts/aem.js';
import { trackEvent, pushAdobeCtaClickEvent } from '../../scripts/analytics_1.js';

const buildArrowSVG = () => `
  <svg class="sicls-arrow-icon" width="24" height="18" viewBox="0 0 32 24" aria-hidden="true" focusable="false">
    <path d="M2 12h26" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M20 6l8 6-8 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
`;

function getCellText(cell) {
  return (cell?.textContent || '').trim();
}

function getLinkHref(cell) {
  const a = cell?.querySelector('a');
  if (a?.href) return a.href;
  const raw = getCellText(cell);
  return raw || '';
}

function extractHeading(rows) {
  if (!rows.length) return { heading: null, rows };

  // Case 1: single-cell first row => treat as heading content
  if (rows[0].length === 1) {
    const headingHTML = rows[0][0].innerHTML.trim();
    if (headingHTML) {
      return { heading: headingHTML, rows: rows.slice(1) };
    }
  }

  // Case 2: first cell says "Heading"
  if (rows[0].length >= 2) {
    const label = getCellText(rows[0][0]).toLowerCase();
    if (label === 'heading') {
      const headingHTML = rows[0][1].innerHTML.trim();
      return { heading: headingHTML || null, rows: rows.slice(1) };
    }
  }

  return { heading: null, rows };
}

export default function decorate(block) {
  const rowEls = [...block.children];
  const rows = rowEls.map((row) => [...row.children]);

  // Pull optional heading
  const { heading, rows: dataRowsRaw } = extractHeading(rows);

  // Remove header row if it contains column labels
  let dataRows = dataRowsRaw;
  if (dataRows.length) {
    const firstRowText = dataRows[0].map((c) => getCellText(c).toLowerCase());
    const looksLikeHeader =
      firstRowText.includes('image') && firstRowText.includes('title') && firstRowText.includes('link');
    if (looksLikeHeader) dataRows = dataRows.slice(1);
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'square-image-cross-links__wrapper';

  if (heading) {
    const header = document.createElement('div');
    header.className = 'square-image-cross-links__header';
    // Render as-is so author can bold/format
    header.innerHTML = `<h2 class="square-image-cross-links__heading">${heading}</h2>`;
    wrapper.append(header);
  }

  const list = document.createElement('ul');
  list.className = 'square-image-cross-links__list';

  dataRows.forEach((cells) => {
    const [imgCell, titleCell, descCell, linkCell] = cells;

    const title = getCellText(titleCell);
    const descHTML = descCell ? descCell.innerHTML.trim() : '';
    const href = getLinkHref(linkCell);

    // Image extraction
    const img = imgCell?.querySelector('img');
    const imgSrc = img?.getAttribute('src') || getCellText(imgCell);
    const alt = img?.getAttribute('alt') || title || '';

    const li = document.createElement('li');
    li.className = 'square-image-cross-links__item';

    const cardTag = href ? 'a' : 'div';
    const card = document.createElement(cardTag);
    card.className = 'square-image-cross-links__card';
    if (href) {
      card.href = href;
      card.setAttribute('aria-label', title ? `${title}` : 'View');
    }

    // Media
    const media = document.createElement('div');
    media.className = 'square-image-cross-links__media';

    if (imgSrc) {
      const picture = createOptimizedPicture(
        imgSrc,
        alt,
        false,
        [
          { width: '400' },
          { width: '600' },
          { width: '900' }
        ]
      );
      media.append(picture);
    }

    // Body
    const body = document.createElement('div');
    body.className = 'square-image-cross-links__body';

    const titleRow = document.createElement('div');
    titleRow.className = 'square-image-cross-links__title-row';

    const h = document.createElement('h3');
    h.className = 'square-image-cross-links__title';
    h.textContent = title;

    const arrow = document.createElement('span');
    arrow.className = 'square-image-cross-links__arrow';
    arrow.innerHTML = buildArrowSVG();

    titleRow.append(h, arrow);

    const desc = document.createElement('p');
    desc.className = 'square-image-cross-links__desc';
    desc.innerHTML = descHTML;

    const mobileCta = document.createElement('span');
    mobileCta.className = 'square-image-cross-links__mobile-cta';
    mobileCta.textContent = 'VIEW PRODUCTS';

    body.append(titleRow, desc, mobileCta);

    // Build card
    card.append(media, body);
    li.append(card);
    list.append(li);
  });

  wrapper.append(list);

  // Replace authored table markup
  block.textContent = '';
  block.append(wrapper);
  
  const cardLinks = block.querySelectorAll('.square-image-cross-links__item a');
  cardLinks.forEach((linkEl) => {
    linkEl.addEventListener('click', () => {
      const exploreLink = linkEl.getAttribute('href') || '';
      // Analytics param2 (eVar86) must be the COMPLETE redirection URL.
      // The href attribute may be relative, so use the resolved absolute
      // .href property for reporting.
      const exploreAbsoluteLink = linkEl.href || exploreLink;
      const exploreTitle = (linkEl.querySelector('.text-explore-stores')?.textContent || '').trim();
      const exploreMainTitle = (linkEl.querySelector('.square-image-cross-links__title')?.textContent || '').trim();

      if (exploreLink && window.digitalData) {
        window.digitalData.data = {
          cta_: exploreTitle,
          param1: exploreMainTitle,
          param2: exploreAbsoluteLink,
        };
      }

      if (exploreLink) {
        trackEvent('squarecross_click', {
          cta_: exploreTitle,
          param1: exploreMainTitle,
          param2: exploreAbsoluteLink,
        });

        pushAdobeCtaClickEvent({
          event : "squarecross_click",
          cta : exploreTitle , 
          detail2 : param2 || ''
        })
      }
    });
  });
}