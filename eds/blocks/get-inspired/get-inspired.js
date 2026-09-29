import { triggerCTAClickWithLinkAndTitle, trackEvent , pushAdobeCtaClickEvent } from '../../scripts/analytics_1.js';

async function getSwiperClass() {
  if (window.Swiper) return window.Swiper;
  if (window.loadSwiper) return window.loadSwiper();

  return null;
}

function runWhenIdle(callback) {
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(callback, { timeout: 1200 });
    return;
  }

  window.setTimeout(callback, 0);
}

function deferImageSource(img) {
  if (!img) return;

  const src = img.getAttribute('src');
  const srcset = img.getAttribute('srcset');
  const sizes = img.getAttribute('sizes');

  if (src) {
    img.dataset.deferSrc = src;
    img.removeAttribute('src');
  }

  if (srcset) {
    img.dataset.deferSrcset = srcset;
    img.removeAttribute('srcset');
  }

  if (sizes) {
    img.dataset.deferSizes = sizes;
    img.removeAttribute('sizes');
  }
}

function deferPictureSource(picture) {
  if (!picture) return;

  picture.querySelectorAll('source').forEach((source) => {
    const srcset = source.getAttribute('srcset');
    const sizes = source.getAttribute('sizes');

    if (srcset) {
      source.dataset.deferSrcset = srcset;
      source.removeAttribute('srcset');
    }

    if (sizes) {
      source.dataset.deferSizes = sizes;
      source.removeAttribute('sizes');
    }
  });

  deferImageSource(picture.querySelector('img'));
}

function restoreDeferredImageSource(img) {
  if (!img) return;

  if (img.dataset.deferSrc) {
    img.setAttribute('src', img.dataset.deferSrc);
    delete img.dataset.deferSrc;
  }

  if (img.dataset.deferSrcset) {
    img.setAttribute('srcset', img.dataset.deferSrcset);
    delete img.dataset.deferSrcset;
  }

  if (img.dataset.deferSizes) {
    img.setAttribute('sizes', img.dataset.deferSizes);
    delete img.dataset.deferSizes;
  }
}

function restoreDeferredPictureSource(picture) {
  if (!picture) return;

  picture.querySelectorAll('source').forEach((source) => {
    if (source.dataset.deferSrcset) {
      source.setAttribute('srcset', source.dataset.deferSrcset);
      delete source.dataset.deferSrcset;
    }

    if (source.dataset.deferSizes) {
      source.setAttribute('sizes', source.dataset.deferSizes);
      delete source.dataset.deferSizes;
    }
  });

  restoreDeferredImageSource(picture.querySelector('img'));
}

function hydratePanelImages(panel) {
  if (!panel) return;

  panel.querySelectorAll('picture').forEach((picture) => {
    restoreDeferredPictureSource(picture);
  });
}

// Category keywords that follow the room name in an inspiration card's URL
// slug (e.g. living-room-texture-designs). Used to isolate the room name.
const CARD_CATEGORY_WORDS = new Set([
  'colour', 'color', 'colours', 'colors',
  'texture', 'textures', 'wallpaper', 'wallpapers',
  'wood', 'combination', 'combinations',
  'design', 'designs', 'work', 'works', 'idea', 'ideas',
]);

/**
 * Derive the card's room name (eVar67) from its destination URL slug.
 * The room is the leading part of the slug before the first category word,
 * formatted as sentence case. Examples:
 *   /inspiration/living-room-texture-designs.html -> 'Living room'
 *   /inspiration/kids-room-colour-combination.html -> 'Kids room'
 */
function getCardTitleFromHref(href) {
  const slug = (href || '')
    .split('?')[0]
    .split('#')[0]
    .replace(/\.html?$/i, '')
    .split('/')
    .filter(Boolean)
    .pop() || '';
  if (!slug) return '';

  const tokens = slug.split('-');
  const stop = tokens.findIndex((t) => CARD_CATEGORY_WORDS.has(t.toLowerCase()));
  const roomTokens = stop === -1 ? tokens : tokens.slice(0, stop);
  if (!roomTokens.length) return '';

  const phrase = roomTokens.join(' ');
  return phrase.charAt(0).toUpperCase() + phrase.slice(1).toLowerCase();
}

export default function decorate(block) {
  const sections = [...block.children];
  let blockInView = false;

  const tabsContainer = document.createElement('div');
  tabsContainer.className = 'tabs';

  const tabNav = document.createElement('div');
  tabNav.className = 'tabs-nav';

  const tabContent = document.createElement('div');
  tabContent.className = 'tabs-content';

  const initializePanelSwiper = async (panel) => {
    if (!panel || panel.swiperInstance || panel.dataset.swiperPending === 'true') return;

    const swiperEl = panel.querySelector('.swiper');
    const paginationEl = panel.querySelector('.swiper-pagination');
    const nextEl = panel.querySelector('.swiper-button-next');
    const prevEl = panel.querySelector('.swiper-button-prev');

    if (!swiperEl || !paginationEl || !nextEl || !prevEl) return;

    panel.dataset.swiperPending = 'true';

    const Swiper = await getSwiperClass();
    if (!Swiper) {
      panel.dataset.swiperPending = 'false';
      return;
    }

    panel.swiperInstance = new Swiper(swiperEl, {
      slidesPerView: 1.5,
      spaceBetween: 18,
      loop: false,
      watchOverflow: true,
      observer: true,
      observeParents: true,
      pagination: {
        el: paginationEl,
        clickable: true,
      },
      breakpoints: {
        0: {
          slidesPerView: 1.5,
          spaceBetween: 16,
        },
        1024: {
          slidesPerView: 'auto',
          spaceBetween: 18,
        },
      },
      navigation: {
        nextEl,
        prevEl,
      },
    });

    panel.dataset.swiperPending = 'false';
  };

  const maybeInitializePanelSwiper = (panel, force = false) => {
    if (!panel) return;
    if (!force && !blockInView) return;

    runWhenIdle(() => {
      initializePanelSwiper(panel);
    });
  };

  sections.forEach((section, index) => {
    const titleEl = section.querySelector(':scope > div:first-child');
    const contentEl = section.querySelector(':scope > div:last-child');

    const title = titleEl.textContent.trim();

    const btn = document.createElement('button');
    btn.className = 'tab-btn';
    btn.textContent = title;

    const panel = document.createElement('div');
    panel.className = 'tab-panel';

    const prevEl = document.createElement('button');
    prevEl.className = 'swiper-button-prev';
    prevEl.type = 'button';
    prevEl.setAttribute('aria-label', 'Previous');

    const nextEl = document.createElement('button');
    nextEl.className = 'swiper-button-next';
    nextEl.type = 'button';
    nextEl.setAttribute('aria-label', 'Next');

    // Prev/Next Navigation event is fired by the global
    // initCarouselNavigationTracking() in analytics_1.js, which resolves
    // eVar67 from the section heading ("Get inspired") — matching prod
    // behaviour. Do not attach a block-level tracker here, or the event
    // will send the tab title (e.g. "Colours") and duplicate the beacon.

    const swiperContainerWrapper = document.createElement('div');
    swiperContainerWrapper.className = 'swiper-container-wrapper';

    const swiperNavWrapper = document.createElement('div');
    swiperNavWrapper.className = 'swiper-nav-wrapper';

    const swiperPaginationWrapper = document.createElement('div');
    swiperPaginationWrapper.className = 'swiper-pagination-wrapper';

    swiperContainerWrapper.appendChild(swiperNavWrapper);
    swiperContainerWrapper.appendChild(swiperPaginationWrapper);

    swiperNavWrapper.appendChild(prevEl);
    swiperNavWrapper.appendChild(nextEl);

    const swiperEl = document.createElement('div');
    swiperEl.className = 'swiper';

    const swiperWrapper = document.createElement('div');
    swiperWrapper.className = 'swiper-wrapper';

    swiperWrapper.addEventListener('click', (event) => {
      const anchor = event.target.closest('a');
      if (!anchor || !swiperWrapper.contains(anchor)) return;

      const ctaLink = anchor.getAttribute('href') || '';
      const btnTitle = anchor.getAttribute('title') || anchor.textContent.trim();
      // eVar67 must be the clicked card's own room name (e.g. 'Living room'),
      // not the active tab title. Fall back to the tab title if the URL slug
      // doesn't yield a room name.
      const cardTitle = getCardTitleFromHref(ctaLink) || title;
      triggerCTAClickWithLinkAndTitle(ctaLink, btnTitle, cardTitle);
    });

    const anchors = [...contentEl.querySelectorAll('a')];

    anchors.forEach((a, slideIndex) => {
      const image = a.querySelector('img');
      if (image) {
        image.setAttribute('width', '324');
        image.setAttribute('height', '470');

        // First slide of the first (active) panel is the LCP candidate —
        // load eagerly with high priority so it isn't blocked behind lazy images.
        if (index === 0 && slideIndex === 0) {
          image.setAttribute('loading', 'eager');
          image.setAttribute('fetchpriority', 'high');
          image.setAttribute('decoding', 'sync');
          image.removeAttribute('data-loading');
        } else if (index === 0) {
          // Keep first tab sources in DOM so mobile can paint visible cards fast.
          image.setAttribute('loading', 'lazy');
          image.setAttribute('fetchpriority', 'low');
          image.setAttribute('decoding', 'async');
        } else {
          image.setAttribute('loading', 'lazy');
          image.setAttribute('fetchpriority', 'low');
          image.setAttribute('decoding', 'async');
          deferPictureSource(a.querySelector('picture'));
        }
      }

      const slide = document.createElement('div');
      slide.className = 'swiper-slide';

      const titleAnchor = a.getAttribute('title');

      const infoDiv = document.createElement('div');
      infoDiv.className = 'link-fwd';

      infoDiv.innerHTML = `
        <span class="link-title">${titleAnchor}</span>
        <img src="/eds/icons/arrow-icon-new.svg" alt="arrow icon" class="link-icon">
      `;

      a.appendChild(infoDiv);

      slide.appendChild(a);
      swiperWrapper.appendChild(slide);
    });

    swiperEl.appendChild(swiperWrapper);

    const paginationEl = document.createElement('div');
    paginationEl.className = 'swiper-pagination';

    swiperContainerWrapper.appendChild(swiperEl);
    swiperPaginationWrapper.appendChild(paginationEl);
    panel.appendChild(swiperContainerWrapper);

    if (index === 0) {
      btn.classList.add('active');
      panel.classList.add('active');
    }

    btn.addEventListener('click', () => {
      const currentTabName = btn.textContent.trim();

      // Registry key for eVar67 is `title` — passing `categories` would
      // fall through to contextData.categories instead of the eVar.
      trackEvent('waterproofing_categories', {
        title: currentTabName,
      });

      pushAdobeCtaClickEvent({
        event: 'waterproofing_categories',
        title: currentTabName,
      });

      tabsContainer.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      tabsContainer.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));

      btn.classList.add('active');
      panel.classList.add('active');

      hydratePanelImages(panel);
      maybeInitializePanelSwiper(panel, true);

      requestAnimationFrame(() => {
        if (panel.swiperInstance) {
          panel.swiperInstance.update();
        }
      });
    });

    tabNav.appendChild(btn);
    tabContent.appendChild(panel);

    if (index === 0) {
      maybeInitializePanelSwiper(panel);
    }
  });

  block.innerHTML = '';

  tabsContainer.appendChild(tabNav);
  tabsContainer.appendChild(tabContent);

  block.appendChild(tabsContainer);

  const observer = new IntersectionObserver((entries, obs) => {
    if (!entries[0]?.isIntersecting) return;

    blockInView = true;
    const activePanel = block.querySelector('.tab-panel.active');
    hydratePanelImages(activePanel);
    maybeInitializePanelSwiper(activePanel, true);
    obs.disconnect();
  }, {
    rootMargin: '200px 0px',
    threshold: 0,
  });

  observer.observe(block);
}