/*
** Authoring format **
col 1 = heading
col 2 = multiple images
col 3 = multiple titles
col 4 = multiple URLs
*/

import { trackEvent , pushAdobeCtaClickEvent } from '../../scripts/analytics_1.js';

async function getSwiperClass() {
  if (window.Swiper) return window.Swiper;
  if (window.loadSwiper) return window.loadSwiper();

  // eslint-disable-next-line no-console
  console.warn('Swiper loader is not available on window.loadSwiper');
  return null;
}

function updateNavState(swiper, prevButton, nextButton) {
  if (!swiper || !prevButton || !nextButton) return;

  prevButton.disabled = swiper.isBeginning;
  nextButton.disabled = swiper.isEnd;

  prevButton.style.opacity = swiper.isBeginning ? '0.4' : '1';
  nextButton.style.opacity = swiper.isEnd ? '0.4' : '1';
}

function removeInjectedSwiperIcons(prevButton, nextButton) {
  prevButton?.querySelectorAll('.swiper-navigation-icon').forEach((icon) => icon.remove());
  nextButton?.querySelectorAll('.swiper-navigation-icon').forEach((icon) => icon.remove());
}

function getDirectItems(column) {
  if (!column) return [];

  const items = [...column.children].filter((child) => {
    const text = child.textContent?.trim();
    const media = child.querySelector('picture, img') || child.matches('picture, img');
    const link = child.querySelector('a') || child.matches('a');
    return text || media || link;
  });

  if (items.length) return items;

  return column.textContent?.trim() ? [column] : [];
}

function getTitleFromItem(item) {
  if (!item) return '';

  const cloned = item.cloneNode(true);
  cloned.querySelectorAll('picture, img, a').forEach((el) => el.remove());

  return cloned.textContent?.trim() || item.textContent?.trim() || '';
}

function getImageFromItem(item) {
  if (!item) return null;

  if (item.matches?.('picture')) return item.cloneNode(true);

  const picture = item.querySelector?.('picture');
  if (picture) return picture.cloneNode(true);

  const img = item.matches?.('img') ? item : item.querySelector?.('img');
  if (img) return img.cloneNode(true);

  return null;
}

function getHrefFromItem(item) {
  if (!item) return '#';

  if (item.matches?.('a[href]')) return item.href.trim();

  const anchor = item.querySelector?.('a[href]');
  if (anchor?.href) return anchor.href.trim();

  const text = item.textContent?.trim();
  return text || '#';
}

export default async function decorate(block) {
  const section = block.closest('.section');
  if (section) {
    section.classList.add('tools-carousel-wrapper');
  }

  const row = block.querySelector(':scope > div');
  if (!row) return;

  const columns = [...row.children];
  if (columns.length < 4) return;

  const headingCol = columns[0];
  headingCol.classList.add('tools-carousel-heading');

  const imageCol = columns[1];
  const titleCol = columns[2];
  const linkCol = columns[3];
  const parentTitle = headingCol.querySelector('h1, h2, h3, h4, h5, h6, p')?.textContent?.trim()
    || headingCol.textContent?.trim()
    || '';

  const carouselCol = document.createElement('div');
  carouselCol.className = 'tools-carousel-items';

  const imageItems = getDirectItems(imageCol);
  const titleItems = getDirectItems(titleCol);
  const linkItems = getDirectItems(linkCol);

  const items = Math.max(titleItems.length, imageItems.length, linkItems.length);

  if (!items) {
    block.append(headingCol, carouselCol);
    row.remove();
    return;
  }

  const swiperEl = document.createElement('div');
  swiperEl.className = 'tools-carousel-track swiper';

  const swiperWrapper = document.createElement('div');
  swiperWrapper.className = 'swiper-wrapper';

  for (let i = 0; i < items; i += 1) {
    const slide = document.createElement('a');
    slide.className = 'tools-carousel-slide swiper-slide';
    const buttonLink = getHrefFromItem(linkItems[i]);
    slide.href = buttonLink;

    const imageNode = getImageFromItem(imageItems[i]);
    const titleText = getTitleFromItem(titleItems[i]);

    if (imageNode) {
      slide.appendChild(imageNode);
    }

    if (titleText) {
      const title = document.createElement('div');
      title.className = 'tools-carousel-title';
      title.textContent = titleText;
      slide.appendChild(title);
    }

    slide.addEventListener('click', () => {
      const buttonTitle = titleText || slide.querySelector('.tools-carousel-title')?.textContent?.trim() || '';
      trackEvent('cta_link_text', {
        cta_: buttonTitle,
        parentTitle,
        param1: buttonLink,
      });

      pushAdobeCtaClickEvent({
        cta: buttonTitle,
        parentTitle,
        destinationUrl: buttonLink,
        event: 'cta_link_text',
      });
    });

    swiperWrapper.appendChild(slide);
  }

  swiperEl.appendChild(swiperWrapper);

  const totalSlides = swiperWrapper.children.length;
  let prevButton;
  let nextButton;

  carouselCol.innerHTML = '';

  if (totalSlides > 1) {
    const navContainer = document.createElement('div');
    navContainer.className = 'tools-carousel-nav-container';

    prevButton = document.createElement('button');
    prevButton.className = 'tools-carousel-nav tools-carousel-prev swiper-button-prev';
    prevButton.type = 'button';
    prevButton.setAttribute('aria-label', 'Previous');

    nextButton = document.createElement('button');
    nextButton.className = 'tools-carousel-nav tools-carousel-next swiper-button-next';
    nextButton.type = 'button';
    nextButton.setAttribute('aria-label', 'Next');

    // Prev/Next Navigation event is fired by the global
    // initCarouselNavigationTracking() in analytics_1.js, which resolves
    // eVar67 from the section heading ("Colour Tools") — matching prod
    // behaviour. Do not attach a block-level tracker here, or three
    // separate beacons (block Navigation + block sitesection_click + global
    // Navigation) will fire per click.

    navContainer.appendChild(prevButton);
    navContainer.appendChild(nextButton);

    // paginationEl = document.createElement('div');
    // paginationEl.className = 'tools-carousel-pagination swiper-pagination';

    carouselCol.appendChild(navContainer);
    carouselCol.appendChild(swiperEl);
    // carouselCol.appendChild(paginationEl);
  } else {
    carouselCol.appendChild(swiperEl);
  }

  block.append(headingCol, carouselCol);
  row.remove();

  if (totalSlides <= 1) return;

  try {
    const Swiper = await getSwiperClass();
    if (!Swiper) return;

    const swiper = new Swiper(swiperEl, {
      slidesPerView: 'auto',
      spaceBetween: 16,
      speed: 500,
      loop: false,
      watchOverflow: true,
      navigation: {
        prevEl: prevButton,
        nextEl: nextButton,
      },
      breakpoints: {
        0: {
          slidesPerView: 'auto',
          spaceBetween: 12,
        },
        1000: {
          slidesPerView: 'auto',
          spaceBetween: 16,
        },
      },
      on: {
        init(instance) {
          removeInjectedSwiperIcons(prevButton, nextButton);
          updateNavState(instance, prevButton, nextButton);
        },
        slideChange(instance) {
          updateNavState(instance, prevButton, nextButton);
        },
        resize(instance) {
          removeInjectedSwiperIcons(prevButton, nextButton);
          updateNavState(instance, prevButton, nextButton);
        },
        reachBeginning(instance) {
          updateNavState(instance, prevButton, nextButton);
        },
        reachEnd(instance) {
          updateNavState(instance, prevButton, nextButton);
        },
        fromEdge(instance) {
          updateNavState(instance, prevButton, nextButton);
        },
      },
    });

    removeInjectedSwiperIcons(prevButton, nextButton);
    block.toolsCarouselSwiper = swiper;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to initialize tools-carousel Swiper', error);
  }
}