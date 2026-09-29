/*
** Authoring format **
Col 1 contains text content
Col 2 contains multiple desktop top images
Col 3 contains multiple mobile top images
Col 4 contains multiple desktop bottom images
Col 5 contains multiple mobile bottom images
Col 6 contains multiple URLs
*/

import { trackEvent, ga4Implementaion, triggerCTAClickWithLinkAndTitle, pushAdobeProductTitleClick } from '../../scripts/analytics_1.js';

function getPicturesFromColumn(col) {
  if (!col) return [];
  return [...col.querySelectorAll('picture')];
}

function getLinksFromColumn(col) {
  if (!col) return [];

  const links = [...col.querySelectorAll('a')];
  if (links.length) return links.map((link) => link.href);

  const paragraphValues = [...col.querySelectorAll('p')]
    .map((p) => p.textContent.trim())
    .filter(Boolean);

  if (paragraphValues.length) return paragraphValues;

  const text = col.textContent.trim();
  return text ? [text] : [];
}

function getParentTitle(textCol, block) {
  const title = textCol?.querySelector('h1, h2, h3, h4, h5, h6')?.textContent?.trim();
  if (title) return title;

  const fallbackText = textCol?.querySelector('p')?.textContent?.trim();
  if (fallbackText) return fallbackText;

  return block.closest('.section')?.querySelector('h1, h2, h3, h4, h5, h6')?.textContent?.trim() || '';
}

function getCardProductName(topPicture, bottomPicture, index) {
  // Bottom image alt holds the actual colour name (e.g. "Moon Light").
  // Top image alt is the swatch background and may be generic ("Top Image 1").
  const bottomAlt = bottomPicture?.querySelector('img')?.alt?.trim();
  if (bottomAlt) return bottomAlt;

  const topAlt = topPicture?.querySelector('img')?.alt?.trim();
  if (topAlt) return topAlt;

  return `Gallery card ${index + 1}`;
}

function cloneSourcesToPicture(targetPicture, sourcePicture, mediaQuery) {
  if (!sourcePicture) return;

  [...sourcePicture.querySelectorAll('source')].forEach((sourceEl) => {
    const source = document.createElement('source');

    if (sourceEl.type) source.type = sourceEl.type;
    if (sourceEl.srcset) source.srcset = sourceEl.srcset;

    if (mediaQuery) {
      source.media = mediaQuery;
    } else if (sourceEl.media) {
      source.media = sourceEl.media;
    }

    targetPicture.appendChild(source);
  });
}

function createResponsivePicture(desktopPicture, mobilePicture, altText = '') {
  const desktopImg = desktopPicture?.querySelector('img');
  const mobileImg = mobilePicture?.querySelector('img');

  if (!desktopImg && !mobileImg) return null;

  const picture = document.createElement('picture');

  cloneSourcesToPicture(picture, mobilePicture, '(max-width: 767px)');
  cloneSourcesToPicture(picture, desktopPicture, '(min-width: 768px)');

  const img = document.createElement('img');
  img.src = mobileImg?.src || desktopImg?.src || '';
  img.alt = mobileImg?.alt || desktopImg?.alt || altText;
  img.loading = 'lazy';
  img.decoding = 'async';

  // Set explicit width/height so the browser reserves space before the image
  // loads (prevents CLS on color swatch images flagged by PSI). Prefer the
  // value that's actually present — `getAttribute('width')` reads the HTML
  // attribute even before the image decodes; `.width` is 0 until decoded.
  const widthAttr = desktopImg?.getAttribute('width') || mobileImg?.getAttribute('width');
  const heightAttr = desktopImg?.getAttribute('height') || mobileImg?.getAttribute('height');
  if (widthAttr) img.setAttribute('width', widthAttr);
  if (heightAttr) img.setAttribute('height', heightAttr);

  picture.appendChild(img);

  return picture;
}

function updateNavState(swiper, prevButton, nextButton) {
  if (!swiper || !prevButton || !nextButton) return;

  prevButton.disabled = swiper.isBeginning;
  nextButton.disabled = swiper.isEnd;

  prevButton.style.opacity = swiper.isBeginning ? '0.4' : '1';
  nextButton.style.opacity = swiper.isEnd ? '0.4' : '1';
}

async function getSwiperClass() {
  if (window.Swiper) return window.Swiper;
  if (window.loadSwiper) return window.loadSwiper();

  // eslint-disable-next-line no-console
  console.warn('Swiper loader is not available on window.loadSwiper');
  return null;
}

export default async function decorate(block) {
  if (block.dataset.colorGalleryInitialized === 'true') return;

  const row = block.querySelector(':scope > div');
  if (!row) return;

  const columns = [...row.children];
  if (columns.length < 6) return;

  // Column 1 = text content
  const textCol = columns[0];
  textCol.classList.add('color-gallery-text');
  const parentTitle = getParentTitle(textCol, block);

  // Columns 2–6
  const desktopTopCol = columns[1];
  const mobileTopCol = columns[2];
  const desktopBottomCol = columns[3];
  const mobileBottomCol = columns[4];
  const urlCol = columns[5];

  const desktopTopPictures = getPicturesFromColumn(desktopTopCol);
  const mobileTopPictures = getPicturesFromColumn(mobileTopCol);
  const desktopBottomPictures = getPicturesFromColumn(desktopBottomCol);
  const mobileBottomPictures = getPicturesFromColumn(mobileBottomCol);
  const urls = getLinksFromColumn(urlCol);

  const totalCards = Math.max(
    desktopTopPictures.length,
    mobileTopPictures.length,
    desktopBottomPictures.length,
    mobileBottomPictures.length,
    urls.length,
  );

  if (!totalCards) return;

  const carouselCol = document.createElement('div');
  carouselCol.className = 'color-gallery-carousel';

  const swiperEl = document.createElement('div');
  swiperEl.className = 'swiper color-gallery-swiper';

  const swiperWrapper = document.createElement('div');
  swiperWrapper.className = 'swiper-wrapper color-gallery-carousel-track';

  if (carouselCol.dataset.analyticsBound !== 'true') {
    carouselCol.dataset.analyticsBound = 'true';
    carouselCol.addEventListener('click', (event) => {
      const card = event.target.closest('.color-gallery-card');
      if (!card || !carouselCol.contains(card)) return;

      trackEvent('product_tile_click', {
        productName: card.dataset.productName || '',
        param1: card.href || card.getAttribute('href') || '',
        Title: card.dataset.parentTitle || '',
      });

      pushAdobeProductTitleClick({
        productName: card.dataset.productName || '',
        title: card.dataset.parentTitle || '',
        destinationUrl: card.href || card.getAttribute('href') || '',
        event: 'product_tile_click',
      })

    });
  }

  for (let i = 0; i < totalCards; i += 1) {
    const topPicture = createResponsivePicture(
      desktopTopPictures[i],
      mobileTopPictures[i],
      `Top image ${i + 1}`,
    );

    const bottomPicture = createResponsivePicture(
      desktopBottomPictures[i],
      mobileBottomPictures[i],
      `Bottom image ${i + 1}`,
    );

    const bottomImageAlt =
  bottomPicture?.querySelector('img')?.alt?.trim() || '';

    // Skip card if both images are missing
    if (!topPicture && !bottomPicture) continue;

    const slide = document.createElement('div');
    slide.className = 'swiper-slide color-gallery-slide';

    const cardLink = document.createElement('a');
    cardLink.className = 'color-gallery-card';
    cardLink.href = urls[i] || '#';
    cardLink.setAttribute('aria-label', `View gallery card ${i + 1}`);
    cardLink.dataset.productName = getCardProductName(topPicture, bottomPicture, i);
    cardLink.dataset.parentTitle = parentTitle;

    /*GA 4 */

    cardLink.addEventListener('click', () => {
      const clickText = bottomImageAlt.includes('-') 
        ? bottomImageAlt.split('-')[0].trim() 
        : bottomImageAlt;
      const extraText = bottomImageAlt.includes('-') 
        ? bottomImageAlt.split('-')[1].trim() 
        : '';
      const category = extraText 
        ? `Colours of the year ${extraText}` 
        : 'Colours of the year';
      
      ga4Implementaion({
        event:'catelouge_interaction',
        click_text: clickText,
        click_category: category,
        click_header:'Colour of the years'
      })
    })
    const topWrap = document.createElement('div');
    topWrap.className = 'color-gallery-card-top';

    const bottomWrap = document.createElement('div');
    bottomWrap.className = 'color-gallery-card-bottom';

    if (topPicture) topWrap.appendChild(topPicture);
    if (bottomPicture) bottomWrap.appendChild(bottomPicture);

    cardLink.appendChild(topWrap);
    cardLink.appendChild(bottomWrap);
    slide.appendChild(cardLink);
    swiperWrapper.appendChild(slide);
  }

  if (!swiperWrapper.children.length) return;

  swiperEl.appendChild(swiperWrapper);

  const paginationEl = document.createElement('div');
  paginationEl.className = 'color-gallery-pagination swiper-pagination';

  const totalSlides = swiperWrapper.children.length;
  let prevButton;
  let nextButton;

  if (totalSlides > 1) {
    const navContainer = document.createElement('div');
    navContainer.className = 'color-gallery-navigation';

    prevButton = document.createElement('button');
    prevButton.className = 'color-gallery-nav color-gallery-prev swiper-button-prev';
    prevButton.type = 'button';
    prevButton.setAttribute('aria-label', 'Previous');

    nextButton = document.createElement('button');
    nextButton.className = 'color-gallery-nav color-gallery-next swiper-button-next';
    nextButton.type = 'button';
    nextButton.setAttribute('aria-label', 'Next');

    // Prev/Next Navigation event is fired by the global
    // initCarouselNavigationTracking() in analytics_1.js, which sends
    // eVar67 from the section heading ("Colour of the years") — matching
    // prod. Do not attach a block-level sitesection_click tracker here;
    // prod does not fire that event on carousel nav.

    navContainer.appendChild(prevButton);
    navContainer.appendChild(nextButton);
    swiperEl.appendChild(navContainer);
  }

  carouselCol.appendChild(swiperEl);
  carouselCol.appendChild(paginationEl);

  // Remove original columns 2–6 and append carousel
  columns.slice(1).forEach((col) => col.remove());
  row.appendChild(carouselCol);

  // Add mobile CTA below carousel
  const existingMobileCta = block.querySelector('.color-gallery-mobile-cta');
  if (existingMobileCta) existingMobileCta.remove();

  const mobileCta = document.createElement('div');
  mobileCta.className = 'color-gallery-mobile-cta';

  const ctaLink = textCol.querySelector('a');
  if (ctaLink) {
    ctaLink.addEventListener('click', () => {
      ga4Implementaion({
        event: 'catelouge_interaction',
        click_text: ctaLink.textContent.trim(),
        click_header: 'Colour of the years',
      });
      // Desktop CTA can already be tracked by the shared
      // bindButtonContainerTracking() handler. Avoid double-firing.
      if (ctaLink.dataset.analyticsBound !== 'true') {
        triggerCTAClickWithLinkAndTitle(
          ctaLink.href,
          ctaLink.textContent.trim(),
          parentTitle,
        );
      }
    });

    const mobileLink = ctaLink.cloneNode(true);
    mobileLink.addEventListener('click', () => {
      ga4Implementaion({
        event: 'catelouge_interaction',
        click_text: mobileLink.textContent.trim(),
        click_category: 'Colours of the year 2025',
      });
      triggerCTAClickWithLinkAndTitle(
        mobileLink.href,
        mobileLink.textContent.trim(),
        parentTitle,
      );
    });
    mobileCta.appendChild(mobileLink);
    block.appendChild(mobileCta);
  }

  block.dataset.colorGalleryInitialized = 'true';

  if (totalSlides <= 1) return;

  const initSwiper = async () => {
    if (block.dataset.swiperInitialized === 'true') return;
    block.dataset.swiperInitialized = 'true';

    try {
      const Swiper = await getSwiperClass();
      if (!Swiper) return;

      const swiper = new Swiper(swiperEl, {
        slidesPerView: 1.3,
        spaceBetween: 12,
        speed: 500,
        loop: false,
        watchOverflow: true,

        navigation: {
          prevEl: prevButton,
          nextEl: nextButton,
        },

        pagination: {
          el: paginationEl,
          clickable: true,
          enabled: true,
        },

        breakpoints: {
          768: {
            slidesPerView: 1.3,
            spaceBetween: 10,
          },
          992: {
            slidesPerView: 3,
            spaceBetween: 16,
          },
          1200: {
            slidesPerView: 3,
            spaceBetween: 16,
          },
        },
      });

      block.colorGallerySwiper = swiper;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to initialize color-gallery Swiper', error);
    }
  };

  /* Defer Swiper load + init until this below-the-fold carousel nears the
     viewport, so its ~150 KB download and ~465 ms parse/init stay off the
     main thread during the hero's LCP window (Swiper was loading ~1s in and
     delaying paint). The first cards are already visible as static markup;
     scrollers get Swiper ready via the 300px rootMargin. Mirrors the
     testimonial-carousel / designer-collections pattern. */
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries, obs) => {
      if (!entries[0].isIntersecting) return;
      obs.disconnect();
      initSwiper();
    }, { rootMargin: '300px 0px' });
    observer.observe(block);
  } else {
    initSwiper();
  }
}