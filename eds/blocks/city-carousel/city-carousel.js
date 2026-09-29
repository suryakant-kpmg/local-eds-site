/*
** Authoring format **

Row 1 (Title) - optional; not shown when left empty
Col 1 → Label "Title"
Col 2 → Section title (e.g. "Find trusted contractors in your city")

Row 2 (Subtitle) - optional; not shown when left empty
Col 1 → Label "Subtitle"
Col 2 → Subtitle text (e.g. "Real stories of beautifully transformed homes")

Row 3 onwards (one row per city card)
Col 1 → Desktop image (picture)
Col 2 → Mobile image (picture) - shown below 992px; falls back to the desktop image
Col 3 → Card title (e.g. "Delhi")
Col 4 → Redirection link (e.g. /contractors/delhi.html)

----------------------------------------
Variant: grid-variant
(block authored as "city-carousel (grid-variant)")

Same authoring format as above. Cards are shown as a grid (5 per row on desktop,
2 per row on mobile) instead of a slider. The whole card (image + title) is the link,
and hovering the card zooms the image slightly.

----------------------------------------
Variant: before-after-variant
(block authored as "city-carousel (before-after-variant)")

Same Title / Subtitle rows. Each card row only needs:
Col 1 → Desktop image (picture) - before/after image
Col 2 → Mobile image (picture) - shown below 992px; falls back to the desktop image
Cols 3 & 4 are ignored. Cards are image-only slides with no link / redirection.
*/

import { trackEvent, bindCarouselNavigationTracking, pushAdobeProductTitleClick } from '../../scripts/analytics_1.js';

function text(el) {
  return (el?.textContent || '').trim();
}

function cells(row) {
  return [...row.querySelectorAll(':scope > div')];
}

function rowHasImage(row) {
  return !!row.querySelector('img');
}

function extractHref(cell) {
  if (!cell) return '';
  const a = cell.querySelector('a[href]');
  if (a) return a.getAttribute('href') || '';
  const m = text(cell).match(/https?:\/\/\S+|\/\S+/);
  return m ? m[0] : '';
}

function normalizeTarget(cell) {
  const a = cell?.querySelector('a[target]');
  return (a?.getAttribute('target') || '_self').trim() || '_self';
}

const HEADER_LABELS = ['title', 'subtitle'];

// Returns the label of a Title / Subtitle row, or '' for a card row
function getRowLabel(row) {
  const c = cells(row);
  if (c.length !== 2 || rowHasImage(row)) return '';
  const label = text(c[0]).toLowerCase();
  return HEADER_LABELS.includes(label) ? label : '';
}

function buildVariant2(block) {
  if (block.querySelector('.contractors-in-your-city')) return;

  const rows = [...block.querySelectorAll(':scope > div')];
  if (!rows.length) return;

  let title = '';
  let subtitle = '';

  const cardRows = rows.filter((row) => {
    const label = getRowLabel(row);
    if (label === 'title') title = text(cells(row)[1]);
    if (label === 'subtitle') subtitle = text(cells(row)[1]);
    return !label;
  });

  const isGrid = block.classList.contains('grid-variant');
  const isBeforeAfter = block.classList.contains('before-after-variant');

  const items = cardRows
    .map((row) => {
      const c = cells(row);
      const desktopImg = c[0]?.querySelector('img');
      const mobileImg = c[1]?.querySelector('img');
      return {
        src: desktopImg?.getAttribute('src') || '',
        mobileSrc: mobileImg?.getAttribute('src') || '',
        alt: desktopImg?.getAttribute('alt') || '',
        cityTitle: text(c[2]),
        href: extractHref(c[3]),
        target: normalizeTarget(c[3]),
      };
    })
    .filter((i) => i.src && (isBeforeAfter || i.cityTitle));

  const section = document.createElement('div');
  section.className = 'contractors-in-your-city';

  if (title) {
    const h2 = document.createElement('h2');
    h2.className = 'contractors-in-your-city-title';
    h2.textContent = title;
    section.appendChild(h2);
  }

  if (subtitle) {
    const p = document.createElement('p');
    p.className = 'contractors-in-your-city-subtitle';
    p.textContent = subtitle;
    section.appendChild(p);
  }

  // Slider arrows - not used by the grid variant
  if (!isGrid) {
    const nav = document.createElement('div');
    nav.className = 'contractors-in-your-city-nav';
    nav.innerHTML = `
      <button type="button" class="contractors-in-your-city-prev focus-visible-auto-imp" aria-label="Previous"></button>
      <button type="button" class="contractors-in-your-city-next focus-visible-auto-imp" aria-label="Next"></button>
    `;
    section.appendChild(nav);
  }

  const cards = document.createElement('div');
  cards.className = `contractors-in-your-city-cards${isGrid ? '' : ' swiper'}`;

  // Grid: cards go straight into the container; slider: into the swiper wrapper
  let wrapper = cards;
  if (!isGrid) {
    wrapper = document.createElement('div');
    wrapper.className = 'swiper-wrapper';
    cards.appendChild(wrapper);
  }

  items.forEach((it, index) => {
    const card = document.createElement('div');
    card.className = `contractors-in-your-city-card${isGrid ? '' : ' swiper-slide focus-visible-auto-imp'}`;
    // Slider: the card takes focus; grid: the link inside is focused directly
    if (!isGrid) card.setAttribute('tabindex', '0');

    const picture = document.createElement('picture');
    picture.className = 'contractors-in-your-city-card-img';
    if (it.mobileSrc && it.mobileSrc !== it.src) {
      const source = document.createElement('source');
      source.media = '(max-width: 991px)';
      source.srcset = it.mobileSrc;
      picture.appendChild(source);
    }

    // Before/after: image-only slide, no link or click tracking
    if (isBeforeAfter) {
      const img = document.createElement('img');
      img.loading = index < 2 ? 'eager' : 'lazy';
      img.src = it.src;
      img.width = '562';
      img.height = '566';
      img.className = 'before-after-image';
      img.alt = it.alt;
      picture.appendChild(img);
      card.appendChild(picture);
      wrapper.appendChild(card);
      return;
    }

    const a = document.createElement('a');
    a.className = 'contractors-citycard-link';
    a.setAttribute('role', 'link');
    a.setAttribute('href', it.href || '#');
    a.setAttribute('target', it.target);
    if (!isGrid) {
      a.setAttribute('tabindex', '-1');
    } else {
      a.classList.add('focus-visible-auto-imp');
    }

    // The city carousel sits well below the fold on the contractors
    // page. Earlier markup set loading="eager" + fetchpriority="high"
    // on every tile, which on the painting-contractors page meant 9
    // city tiles (~250 KiB total) competed with the real LCP image
    // (the contractor-finder hero) for high-priority bandwidth.
    // PSI flagged this as the main reason LCP was 7.1 s on that page.
    //
    // Now: lazy-load all tiles by default, and only eagerly load the
    // FIRST two (which may be partially in viewport on tall desktop
    // breakpoints) at default priority. The LCP image keeps its
    // fetchpriority="high" slot to itself.
    const img = document.createElement('img');
    if (index < 2) {
      img.loading = 'eager';
    } else {
      img.loading = 'lazy';
    }
    img.src = it.src;
    img.width = '229';
    img.height = '210';
    img.title = 'image';
    img.className = 'blur-image';
    img.alt = it.alt;

    const h4 = document.createElement('h4');
    h4.className = 'contractors-in-your-city-card-title';
    h4.textContent = it.cityTitle;

    a.addEventListener('click', () => {
      // eVar86 (param1) must be an absolute URL, not a relative path.
      let absoluteHref = '';
      try {
        absoluteHref = new URL(it.href, window.location.origin).href;
      } catch (e) { absoluteHref = it.href || ''; }
      trackEvent('product_tile_click', {
        productName: it.cityTitle || '',
        param1: absoluteHref,
        Title: title || '',
      });

      pushAdobeProductTitleClick({
        productName: it.cityTitle || '',
        title: title || '',
        destinationUrl: absoluteHref,
        event: 'product_tile_click',
      });
    });

    picture.appendChild(img);
    a.append(picture, h4);
    card.appendChild(a);
    wrapper.appendChild(card);
  });

  section.appendChild(cards);

  if (!isGrid) {
    const pagination = document.createElement('div');
    pagination.className = 'contractors-in-your-city-pagination';
    section.appendChild(pagination);
  }

  block.innerHTML = '';
  block.appendChild(section);
}

function initVariant2(block, Swiper) {
  const cardsEl = block.querySelector('.contractors-in-your-city-cards');
  if (!cardsEl || !cardsEl.querySelector('.swiper-slide')) return;

  const title = block.querySelector('.contractors-in-your-city-title')?.textContent?.trim();

  const swiper = new Swiper(cardsEl, {
    slidesPerView: 'auto',
    spaceBetween: 20,
    watchOverflow: true,
    watchSlidesProgress: true,
    navigation: {
      prevEl: block.querySelector('.contractors-in-your-city-prev'),
      nextEl: block.querySelector('.contractors-in-your-city-next'),
      disabledClass: 'is-disabled',
    },
    pagination: {
      el: block.querySelector('.contractors-in-your-city-pagination'),
      clickable: true,
    },
  });

  bindCarouselNavigationTracking(block, title || 'Contractors in Your City');

  block.querySelectorAll('.contractors-in-your-city-card').forEach((card, index) => {
    // Card is focusable (link inside has tabindex -1) - Enter opens the link
    card.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const href = card.querySelector('a')?.getAttribute('href');
      if (!href || href === '#') return;
      window.location.href = href;
    });

    // Keep the focused card in view when tabbing through the slider
    card.addEventListener('focus', () => {
      if (!card.classList.contains('swiper-slide-visible')) swiper.slideTo(index);
    });
  });
}

export default async function decorate(block) {
  buildVariant2(block);

  // Grid variant is a static grid - no slider needed
  if (block.classList.contains('grid-variant')) return;

  const Swiper = await window.loadSwiper?.();
  if (!Swiper) return;

  initVariant2(block, Swiper);
}
