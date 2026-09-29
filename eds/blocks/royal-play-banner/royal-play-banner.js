/*
** Authoring format **
Row 1
Col 1 - logo (only for desktop) 
Col 2 - desktop image 
Col 3 - mobile image
Col 4 - White text called title line 1 and line 2 (only for desktop) 
Col 5 - Subtitle in black (only for desktop) 
Col 6 - CTA label and Redirection link 
Col 7 - Button type

Row 2
Col 1 - logo (only for desktop)
Col 2 - desktop image 
Col 3 - mobile image 
Col 4 - Desktop title image 
Col 5 - Mobile title image
Col 6 - CTA label and Redirection link 
Col 7 - Button type
*/

import { trackEvent, triggerCTAClickWithLinkAndTitle } from '../../scripts/analytics_1.js';

async function getSwiper() {
  if (window.Swiper) return window.Swiper;
  if (window.loadSwiper) return window.loadSwiper();

  console.warn('Swiper not available');
  return null;
}


function getTextContent(cell) {
  return cell?.textContent?.trim() || '';
}

/**
 * Clone picture element (preserves sources)
 */
function getPicture(cell) {
  return cell?.querySelector('picture')?.cloneNode(true) || null;
}

/**
 * Get anchor element (CTA source)
 */
function getLink(cell) {
  return cell?.querySelector('a') || null;
}

function getBannerImageTitle(picture) {
  const img = picture?.querySelector('img');
  return img?.getAttribute('title')?.trim() || img?.getAttribute('alt')?.trim() || '';
}

function wrapTrackableBannerImage(picture, ctaSourceLink) {
  if (!picture) return null;

  const destinationUrl = ctaSourceLink?.getAttribute('href') || '';
  if (!destinationUrl) return picture;

  const wrapper = document.createElement('a');
  wrapper.className = 'track-banner-image';
  wrapper.href = destinationUrl;
  if (ctaSourceLink?.target) wrapper.target = ctaSourceLink.target;
  if (ctaSourceLink?.rel) wrapper.rel = ctaSourceLink.rel;
  wrapper.setAttribute('aria-label', getBannerImageTitle(picture) || 'Banner image');
  wrapper.appendChild(picture);
  return wrapper;
}

/**
 * Normalize image attributes for performance
 * - eager loading for above-the-fold
 * - remove width/height for responsive behavior
 */
function updateImageAttributes(picture, eager = false) {
  if (!picture) return picture;

  const img = picture.querySelector('img');
  if (img) {
    img.loading = eager ? 'eager' : 'lazy';
    img.setAttribute('fetchpriority', eager ? 'high' : 'auto');
    img.removeAttribute('width');
    img.removeAttribute('height');
  }

  return picture;
}

/**
 * Extract 2-line title from paragraph structure
 */
function getTitleLines(cell) {
  const paragraphs = [...(cell?.querySelectorAll('p') || [])].filter((p) => p.textContent.trim());

  return {
    line1: paragraphs[0]?.textContent.trim() || '',
    line2: paragraphs[1]?.textContent.trim() || '',
  };
}

/**
 * Build CTA with variant styles:
 * - transparent
 * - white
 * - default
 */
function createCTA(cell, buttonType) {
  const link = getLink(cell);
  if (!link) return null;

  const cta = link.cloneNode(true);
  cta.className = 'royal-play-banner__cta';

  const text = cta.textContent.trim();
  cta.innerHTML = '';

  const span = document.createElement('span');
  span.textContent = text;

  const icon = document.createElement('img');
  icon.src = '/eds/icons/arrow-icon-new.svg';
  icon.alt = 'arrow icon';
  icon.className = 'link-icon';

  cta.append(span, icon);

  const type = (buttonType || '').trim().toUpperCase();

  if (type === 'TRANSPARENT BUTTON') {
    cta.classList.add('royal-play-banner__cta--transparent');
  } else if (type === 'WHITE BUTTON') {
    cta.classList.add('royal-play-banner__cta--white');
  } else {
    cta.classList.add('royal-play-banner__cta--default');
  }

  return cta;
}

/* =====================================================
   SLIDE 1 (Hero Slide - Different Structure)
===================================================== */

/**
 * Desktop Hero Slide
 * - Background image
 * - Left gradient overlay
 * - Logo + title + subtitle + CTA
 */
function createFirstSlideDesktop(row) {
  const cols = [...row.children];

  const logo = updateImageAttributes(getPicture(cols[0]), true);
  const desktopImage = updateImageAttributes(getPicture(cols[1]), true);
  const ctaSourceLink = getLink(cols[5]);
  const { line1, line2 } = getTitleLines(cols[3]);
  const subtitle = getTextContent(cols[4]);
  const buttonType = getTextContent(cols[6]);
  const cta = createCTA(cols[5], buttonType);

  const slide = document.createElement('div');
  slide.className = 'swiper-slide royal-play-banner__slide royal-play-banner__slide--hero';
  slide.dataset.parentTitle = [line1, line2].filter(Boolean).join(' ').trim();

  const media = document.createElement('div');
  media.className = 'royal-play-banner__media';

  const imageWrap = document.createElement('div');
  imageWrap.className = 'royal-play-banner__image-wrap';

  if (desktopImage) {
    desktopImage.classList.add('royal-play-banner__image', 'royal-play-banner__image--hero');
    imageWrap.appendChild(wrapTrackableBannerImage(desktopImage, ctaSourceLink));
  }

  // Gradient overlay section
  const overlay = document.createElement('div');
  overlay.className = 'royal-play-banner__overlay';

  const content = document.createElement('div');
  content.className = 'royal-play-banner__content';

  if (logo) {
    const logoWrap = document.createElement('div');
    logoWrap.className = 'royal-play-banner__logo';
    logoWrap.appendChild(logo);
    content.appendChild(logoWrap);
  }

  if (line1 || line2) {
    const title = document.createElement('div');
    title.className = 'royal-play-banner__title';

    if (line1) {
      const el = document.createElement('div');
      el.className = 'royal-play-banner__title-line';
      el.textContent = line1;
      title.appendChild(el);
    }

    if (line2) {
      const el = document.createElement('div');
      el.className = 'royal-play-banner__title-line';
      el.textContent = line2;
      title.appendChild(el);
    }

    content.appendChild(title);
  }

  if (subtitle) {
    const sub = document.createElement('p');
    sub.className = 'royal-play-banner__subtitle';
    sub.textContent = subtitle;
    content.appendChild(sub);
  }

  if (cta) {
    const actions = document.createElement('div');
    actions.className = 'royal-play-banner__actions';
    actions.appendChild(cta);
    content.appendChild(actions);
  }

  overlay.appendChild(content);
  media.append(imageWrap, overlay);
  slide.appendChild(media);

  return slide;
}

/**
 * Mobile Hero Slide
 * - Full image
 * - Logo top-left
 * - CTA centered bottom
 */
function createFirstSlideMobile(row) {
  const cols = [...row.children];

  const logo = updateImageAttributes(getPicture(cols[0]), true);
  const mobileImage = updateImageAttributes(getPicture(cols[2]), true);
  const ctaSourceLink = getLink(cols[5]);
  const { line1, line2 } = getTitleLines(cols[3]);
  const buttonType = getTextContent(cols[6]);
  const cta = createCTA(cols[5], buttonType);

  const slide = document.createElement('div');
  slide.className = 'swiper-slide royal-play-banner__slide';
  slide.dataset.parentTitle = [line1, line2].filter(Boolean).join(' ').trim();

  const wrap = document.createElement('div');
  wrap.className = 'royal-play-banner__mobile-image-wrap';

  if (mobileImage) {
    mobileImage.classList.add('royal-play-banner__image');
    wrap.appendChild(wrapTrackableBannerImage(mobileImage, ctaSourceLink));
  }

  /* logo top-left */
  if (logo) {
    const logoWrap = document.createElement('div');
    logoWrap.className = 'royal-play-banner__mobile-logo';
    logoWrap.appendChild(logo);
    wrap.appendChild(logoWrap);
  }

  /* centered CTA */
  if (cta) {
    const action = document.createElement('div');
    action.className = 'royal-play-banner__mobile-actions';
    action.appendChild(cta);
    wrap.appendChild(action);
  }

  slide.appendChild(wrap);
  return slide;
}

/* =====================================================
   SLIDE 2+ (Regular Slides)
===================================================== */

/**
 * Regular slides:
 * - Full image background
 * - Logo top-left
 * - Title image + CTA centered
 */
function createRegularSlide(row, isMobile = false) {
  const cols = [...row.children];

  const logo = updateImageAttributes(getPicture(cols[0]), true);
  const image = updateImageAttributes(getPicture(cols[isMobile ? 2 : 1]), true);
  const ctaSourceLink = getLink(cols[5]);
  const titleImage = updateImageAttributes(getPicture(cols[isMobile ? 4 : 3]), true);
  const buttonType = getTextContent(cols[6]);
  const cta = createCTA(cols[5], buttonType);

  const titleImg = titleImage?.querySelector('img');
  // Per-slide analytics overrides keyed by a substring of the CTA destination.
  // The title image on beta is EDS-optimized (media_<hash>, empty alt), so the
  // human-readable slide title is not derivable from the DOM. Hard-code here,
  // same pattern as store-banner.js ANALYTICS_OVERRIDES.
  const ROYAL_PLAY_SLIDE_OVERRIDES = [
    { match: 'lux-imprints', parentTitle: 'A Tactile Celebration Of Textures' },
  ];
  const ctaHref = ctaSourceLink?.getAttribute('href') || '';
  const override = ROYAL_PLAY_SLIDE_OVERRIDES.find((o) => ctaHref.includes(o.match));
  const slideTitle = override?.parentTitle
    || titleImg?.getAttribute('title')?.trim()
    || titleImg?.getAttribute('alt')?.trim()
    || '';

  const slide = document.createElement('div');
  slide.className = 'swiper-slide royal-play-banner__slide';
  slide.dataset.parentTitle = slideTitle;

  const inner = document.createElement('div');
  inner.className = 'royal-play-banner__slide-inner';

  if (image) inner.appendChild(wrapTrackableBannerImage(image, ctaSourceLink));

  if (logo) {
    const logoWrap = document.createElement('div');
    logoWrap.className = 'royal-play-banner__slide-logo';
    logoWrap.appendChild(logo);
    inner.appendChild(logoWrap);
  }

  // Center content (title image + CTA)
  const centerWrap = document.createElement('div');
  centerWrap.className = 'royal-play-banner__slide-center';

  if (titleImage) {
    const titleWrap = document.createElement('div');
    titleWrap.className = 'royal-play-banner__slide-title-image';
    titleWrap.appendChild(titleImage);
    centerWrap.appendChild(titleWrap);
  }

  if (cta) {
    const actionWrap = document.createElement('div');
    actionWrap.className = 'royal-play-banner__slide-actions';
    actionWrap.appendChild(cta);
    centerWrap.appendChild(actionWrap);
  }

  inner.appendChild(centerWrap);
  slide.appendChild(inner);

  return slide;
}

/**
 * Decide slide type:
 * - index 0 → hero
 * - index > 0 → regular
 */
function createSlide(row, index, isMobile) {
  return index === 0
    ? (isMobile ? createFirstSlideMobile(row) : createFirstSlideDesktop(row))
    : createRegularSlide(row, isMobile);
}

/**
 * Build Swiper structure
 */
function createCarousel(rows, isMobile) {
  const root = document.createElement('div');
  root.className = `royal-play-banner__carousel ${isMobile ? 'royal-play-banner__carousel--mobile' : 'royal-play-banner__carousel--desktop'}`;

  const swiperEl = document.createElement('div');
  swiperEl.className = 'swiper';

  const wrapper = document.createElement('div');
  wrapper.className = 'swiper-wrapper';

  rows.forEach((row, index) => {
    const slide = createSlide(row, index, isMobile);
    if (slide) wrapper.appendChild(slide);
  });

  swiperEl.appendChild(wrapper);

  const pagination = document.createElement('div');
  pagination.className = 'swiper-pagination';

  root.append(swiperEl, pagination);

  return { root, swiperEl, pagination };
}

/**
 * Add custom arrows inside pagination pill
 */
function addCustomArrowsToPagination(paginationEl, swiper) {
  const prev = document.createElement('button');
  prev.className = 'custom-arrow custom-arrow-prev';
  prev.setAttribute('aria-label', 'Previous');

  const next = document.createElement('button');
  next.className = 'custom-arrow custom-arrow-next';
  next.setAttribute('aria-label', 'Next');

  prev.onclick = () => swiper.slidePrev();
  next.onclick = () => swiper.slideNext();

  paginationEl.prepend(prev);
  paginationEl.append(next);
}

/**
 * Entry point
 */
export default async function decorate(block) {
  const rows = [...block.children];
  if (!rows.length) return;

  // Use first row title as analytics parent title for hero slide CTA
  const firstRow = rows[0];
  const titleCell = firstRow?.children?.[3];
  const { line1, line2 } = getTitleLines(titleCell);
  const parentTitle = [line1, line2].filter(Boolean).join(' ').trim();

  // Clear authored table markup and prepare block root
  block.textContent = '';
  block.classList.add('royal-play-banner');

  // Build desktop + mobile carousels
  const desktop = createCarousel(rows, false);
  const mobile = createCarousel(rows, true);

  // Append actual DOM roots
  block.append(desktop.root, mobile.root);

  // Init Swiper
  const Swiper = await getSwiper();
  if (!Swiper) return;

  function attachArrows(swiper, paginationEl) {
  if (paginationEl.querySelector('.custom-arrow')) return;

  const prev = document.createElement('button');
  prev.className = 'custom-arrow custom-arrow-prev';
  prev.setAttribute('aria-label', 'Previous');

  const next = document.createElement('button');
  next.className = 'custom-arrow custom-arrow-next';
  next.setAttribute('aria-label', 'Next');

  prev.onclick = () => swiper.slidePrev();
  next.onclick = () => swiper.slideNext();

  paginationEl.prepend(prev);
  paginationEl.append(next);
}

  const desktopSwiper = new Swiper(desktop.swiperEl, {
    slidesPerView: 1,
    loop: rows.length > 1,
    pagination: {
      el: desktop.pagination,
      clickable: true,
    },
  });

desktopSwiper.on('paginationRender', () => {
  attachArrows(desktopSwiper, desktop.pagination);
});

desktopSwiper.on('init', () => {
  attachArrows(desktopSwiper, desktop.pagination);
});

desktopSwiper.init();

  const mobileSwiper = new Swiper(mobile.swiperEl, {
    slidesPerView: 1,
    loop: rows.length > 1,
    pagination: {
      el: mobile.pagination,
      clickable: true,
    },
  });

  mobileSwiper.on('init', () => {
  attachArrows(mobileSwiper, mobile.pagination);
});

mobileSwiper.on('paginationRender', () => {
  attachArrows(mobileSwiper, mobile.pagination);
});

mobileSwiper.init();

  // Add custom arrows inside pagination pill
  addCustomArrowsToPagination(desktop.pagination, desktopSwiper);
  addCustomArrowsToPagination(mobile.pagination, mobileSwiper);

  // Bind analytics once at block level (event delegation)
  if (block.dataset.royalPlayAnalyticsBound !== 'true') {
    block.dataset.royalPlayAnalyticsBound = 'true';

    block.addEventListener('click', (event) => {
      const slideEl = event.target.closest('.swiper-slide');
      const slideParentTitle = slideEl?.dataset?.parentTitle?.trim() || parentTitle;

      const bannerImage = event.target.closest('.track-banner-image');
      if (bannerImage && block.contains(bannerImage)) {
        const destinationUrl = bannerImage.getAttribute('href') || '';
        const img = bannerImage.querySelector('img');
        const imageTitle = img?.getAttribute('title')?.trim()
          || img?.getAttribute('alt')?.trim()
          || 'Royale Play';

        if (destinationUrl) {
          triggerCTAClickWithLinkAndTitle(destinationUrl, imageTitle, slideParentTitle);
        }
      }

      const cta = event.target.closest('.royal-play-banner__cta');
      if (!cta || !block.contains(cta)) return;

      const ctaLink = cta.getAttribute('href') || '';
      const btnTitle = cta.textContent.trim();

      triggerCTAClickWithLinkAndTitle(ctaLink, btnTitle, slideParentTitle);
    });
  }
}