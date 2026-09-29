/*
** Authoring format **
Each row = one category
Col 1 = category name
Col 2+ = one slide each
Each slide cell contains desktop + mobile image
Selected category shows its own Swiper on the right
*/

import { trackEvent, getAdobeBasePayload } from '../../scripts/analytics_1.js';

function getTextContent(el) {
  return el ? el.textContent.trim() : '';
}

function getDirectRows(block) {
  return [...block.children].filter((child) => child.tagName === 'DIV');
}

function getPicturesFromCell(cell) {
  if (!cell) return [];
  return [...cell.querySelectorAll('picture')];
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
  picture.className = 'categories-offer-slide-picture';

  cloneSourcesToPicture(picture, mobilePicture, '(max-width: 767px)');
  cloneSourcesToPicture(picture, desktopPicture, '(min-width: 768px)');

  const img = document.createElement('img');
  img.src = mobileImg?.src || desktopImg?.src || '';
  img.alt = mobileImg?.alt || desktopImg?.alt || altText;
  img.loading = 'lazy';
  img.decoding = 'async';

  if (desktopImg?.width) img.width = desktopImg.width;
  if (desktopImg?.height) img.height = desktopImg.height;

  picture.appendChild(img);
  return picture;
}

async function getSwiperClass() {
  if (window.Swiper) return window.Swiper;
  if (window.loadSwiper) return window.loadSwiper();

  // eslint-disable-next-line no-console
  console.warn('Swiper loader is not available on window.loadSwiper');
  return null;
}

function createSlide(cell, categoryName, slideIndex) {
  const slide = document.createElement('div');
  slide.className = 'swiper-slide categories-offer-slide';

  const pictures = getPicturesFromCell(cell);
  const desktopPicture = pictures[0] || null;
  const mobilePicture = pictures[1] || pictures[0] || null;

  const responsivePicture = createResponsivePicture(
    desktopPicture,
    mobilePicture,
    `${categoryName} slide ${slideIndex + 1}`,
  );

  if (!responsivePicture) return null;

  const imageWrap = document.createElement('div');
  imageWrap.className = 'categories-offer-slide-image';
  imageWrap.appendChild(responsivePicture);

  slide.appendChild(imageWrap);
  return slide;
}

function buildCarousel(categoryIndex) {
  const carouselWrap = document.createElement('div');
  carouselWrap.className = 'categories-offer-carousel-wrap';
  carouselWrap.dataset.categoryIndex = String(categoryIndex);

  const swiperEl = document.createElement('div');
  swiperEl.className = 'swiper categories-offer-swiper';

  const swiperWrapper = document.createElement('div');
  swiperWrapper.className = 'swiper-wrapper categories-offer-swiper-wrapper';

  const pagination = document.createElement('div');
  pagination.className = 'swiper-pagination categories-offer-pagination';

  swiperEl.appendChild(swiperWrapper);
  carouselWrap.appendChild(swiperEl);
  carouselWrap.appendChild(pagination);

  return {
    carouselWrap,
    swiperEl,
    swiperWrapper,
    pagination,
  };
}

function updateActiveCarouselHeight(carouselWrappers, activeIndex) {
  const activeCarousel = carouselWrappers[activeIndex];
  const carouselsContainer = activeCarousel?.parentElement;

  if (!activeCarousel || !carouselsContainer) return;

  requestAnimationFrame(() => {
    if (window.innerWidth >= 768) {
      carouselsContainer.style.height = '500px';
      activeCarousel.style.height = '500px';
    } else {
      activeCarousel.style.height = '';

      // const activeHeight = activeCarousel.offsetHeight;
      // if (activeHeight) {
      //   carouselsContainer.style.height = `${activeHeight}px`;
      // }
    }
  });
}

function setActiveCategory({
  activeIndex,
  tabButtons,
  carouselWrappers,
  swiperInstances,
}) {
  tabButtons.forEach((btn, index) => {
    const isActive = index === activeIndex;
    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  carouselWrappers.forEach((carousel, index) => {
    const isActive = index === activeIndex;
    carousel.classList.toggle('is-active', isActive);
  });

  const activeSwiper = swiperInstances[activeIndex];

  if (activeSwiper) {
    requestAnimationFrame(() => {
      activeSwiper.update();
      if (activeSwiper.pagination?.render) activeSwiper.pagination.render();
      if (activeSwiper.pagination?.update) activeSwiper.pagination.update();

      updateActiveCarouselHeight(carouselWrappers, activeIndex);
    });
  } else {
    updateActiveCarouselHeight(carouselWrappers, activeIndex);
  }
}

export default async function decorate(block) {
  if (block.dataset.categoriesOfferInitialized === 'true') return;

  const section = block.closest('.section');
  let sectionTitle = null;

  if (section) {
    section.classList.add('categories-offer-section');
    sectionTitle = section.children[0];
  }

  const originalRows = getDirectRows(block);
  if (!originalRows.length) return;

  let titleText = '';

  const firstHeading = block.querySelector('h1, h2, h3, h4, h5, h6');
  if (firstHeading) {
    titleText = firstHeading.textContent.trim();
  }

  const categoryRows = originalRows.filter((row) => {
    const cols = [...row.children];
    if (cols.length < 2) return false;
    return cols.slice(1).some((col) => col.querySelector('picture'));
  });

  if (!categoryRows.length) return;

  block.innerHTML = '';
  block.classList.add('categories-offer');

  const wrapper = document.createElement('div');
  wrapper.className = 'categories-offer__wrapper';

  const sidebar = document.createElement('div');
  sidebar.className = 'categories-offer__sidebar';

  const content = document.createElement('div');
  content.className = 'categories-offer__content';

  if (titleText) {
    const title = document.createElement('h2');
    title.className = 'categories-offer__title';
    title.textContent = titleText;
    sidebar.appendChild(title);
  }

  const tabs = document.createElement('div');
  tabs.className = 'categories-offer__tabs';
  tabs.setAttribute('role', 'tablist');

  const carouselsContainer = document.createElement('div');
  carouselsContainer.className = 'categories-offer__carousels';

  const tabButtons = [];
  const carouselWrappers = [];
  const swiperConfigs = [];
  const swiperInstances = [];

  categoryRows.forEach((row, rowIndex) => {
    const cols = [...row.children];
    const categoryName = getTextContent(cols[0]);

    if (!categoryName) return;

    const tabButton = document.createElement('button');
    tabButton.className = `categories-offer__tab${rowIndex === 0 ? ' is-active' : ''}`;
    tabButton.type = 'button';
    tabButton.textContent = categoryName;
    tabButton.setAttribute('role', 'tab');
    tabButton.setAttribute('aria-selected', rowIndex === 0 ? 'true' : 'false');
    tabButton.dataset.index = String(rowIndex);

    const {
      carouselWrap,
      swiperEl,
      swiperWrapper,
      pagination,
    } = buildCarousel(rowIndex);

    cols.slice(1).forEach((cell, slideIndex) => {
      const slide = createSlide(cell, categoryName, slideIndex);
      if (slide) swiperWrapper.appendChild(slide);
    });

    if (!swiperWrapper.children.length) return;

    if (rowIndex === 0) {
      carouselWrap.classList.add('is-active');
    }

    tabs.appendChild(tabButton);
    carouselsContainer.appendChild(carouselWrap);

    tabButtons.push(tabButton);
    carouselWrappers.push(carouselWrap);
    swiperConfigs.push({
      swiperEl,
      pagination,
    });
  });

  if (!tabButtons.length || !carouselWrappers.length) return;

  const tabsContainer = document.createElement('div');
  tabsContainer.className = 'categories-offer__tabs-container';
  tabsContainer.append(tabs);

  if (sectionTitle) {
    sidebar.prepend(sectionTitle);
  }

  sidebar.appendChild(tabsContainer);
  content.appendChild(carouselsContainer);
  wrapper.append(sidebar, content);
  block.appendChild(wrapper);

  tabButtons.forEach((button, index) => {
    button.addEventListener('click', () => {
      const filterOption = button.textContent.trim();

      if (filterOption) {
        trackEvent('filter_click', {
          filter: filterOption,
        });
        
        // Adobe Analytics: push filter_click event to ACDL
        
        var dl = getAdobeBasePayload();
        dl.event = 'filter_click';
        dl.eventInfo.filter = filterOption;
        window.adobeDataLayer = window.adobeDataLayer || [];
        window.adobeDataLayer.push(dl);
      }

      setActiveCategory({
        activeIndex: index,
        tabButtons,
        carouselWrappers,
        swiperInstances,
      });
    });
  });

  block.dataset.categoriesOfferInitialized = 'true';

  try {
    const Swiper = await getSwiperClass();
    if (!Swiper) return;

    swiperConfigs.forEach((config, index) => {
      const totalSlides = config.swiperEl.querySelectorAll('.swiper-slide').length;

      swiperInstances[index] = new Swiper(config.swiperEl, {
        slidesPerView: 1,
        spaceBetween: 0,
        speed: 500,
        loop: false,
        watchOverflow: true,
        observer: true,
        observeParents: true,
        pagination: {
          el: config.pagination,
          clickable: true,
        },
        breakpoints: {
          768: {
            slidesPerView: 1,
            spaceBetween: 0,
          },
        },
        on: {
          init(swiper) {
            if (index !== 0) return;

            requestAnimationFrame(() => {
              swiper.update();
              if (swiper.pagination?.render) swiper.pagination.render();
              if (swiper.pagination?.update) swiper.pagination.update();
            });
          },
        },
      });

      if (totalSlides <= 1) {
        config.pagination.style.display = 'none';
      }
    });

    setActiveCategory({
      activeIndex: 0,
      tabButtons,
      carouselWrappers,
      swiperInstances,
    });

    window.addEventListener('resize', () => {
      const activeIndex = tabButtons.findIndex((btn) => btn.classList.contains('is-active'));
      if (activeIndex >= 0) {
        updateActiveCarouselHeight(carouselWrappers, activeIndex);
      }
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to initialize categories-offer Swiper', error);
  }
}