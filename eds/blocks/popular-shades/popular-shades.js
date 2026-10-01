/*
** Authoring format **
Row 1 = static content panel
Row 2 onwards = one carousel card per row
Col 1 = desktop image
Col 2 = mobile image
Col 3 = swatch color
Col 4 = swatch name
Col 5 = swatch number

Variant "exterior" (Popular Shades (exterior)): house preview bleeding off the left
edge with the text on the right (desktop) or over the image (mobile), larger rounded
swatches, and continuous auto-rotation every 3s while on screen (never with reduced
motion; add "no-autoplay" to the block name to switch it off).
*/
import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';
import {
  getDigitalData,
  trackEvent,
  triggerCTAClickWithLinkAndTitle, pushAdobeProductTitleClick,
} from '../../scripts/analytics_1.js';

const EXTERIOR_DESKTOP = '(width >= 992px)';
const EXTERIOR_AUTOPLAY_DELAY = 3000;
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)');

function getSwiperClass() {
  if (window.Swiper) return Promise.resolve(window.Swiper);
  if (window.loadSwiper) return window.loadSwiper();

  // eslint-disable-next-line no-console
  console.warn('Swiper loader is not available on window.loadSwiper');
  return Promise.resolve(null);
}

function getImageData(col) {
  if (!col) return null;

  const picture = col.querySelector('picture');
  const img = col.querySelector('img');

  if (!picture && !img) return null;

  return { picture, img };
}

function getTextData(col) {
  if (!col) return '';
  const link = col.querySelector('a');
  if (link) return link.textContent.trim();
  return col.textContent?.trim() || '';
}

function buildPicture(desktopItem, mobileItem, altText) {
  const picture = document.createElement('picture');

  const desktopPicture = desktopItem?.picture;
  const mobilePicture = mobileItem?.picture;

  const desktopImg = desktopPicture?.querySelector('img') || desktopItem?.img;
  const mobileImg = mobilePicture?.querySelector('img') || mobileItem?.img;

  if (mobilePicture) {
    [...mobilePicture.querySelectorAll('source')].forEach((sourceEl) => {
      const source = document.createElement('source');
      [...sourceEl.attributes].forEach((attr) => {
        source.setAttribute(attr.name, attr.value);
      });
      source.media = '(max-width: 767px)';
      picture.appendChild(source);
    });
  } else if (mobileImg?.src) {
    const source = document.createElement('source');
    source.media = '(max-width: 767px)';
    source.srcset = mobileImg.currentSrc || mobileImg.src;
    picture.appendChild(source);
  }

  if (desktopPicture) {
    [...desktopPicture.querySelectorAll('source')].forEach((sourceEl) => {
      const source = document.createElement('source');
      [...sourceEl.attributes].forEach((attr) => {
        source.setAttribute(attr.name, attr.value);
      });
      source.media = '(min-width: 768px)';
      picture.appendChild(source);
    });
  }

  const img = document.createElement('img');
  img.src = desktopImg?.currentSrc || desktopImg?.src || mobileImg?.currentSrc || mobileImg?.src || '';
  img.alt = altText || desktopImg?.alt || mobileImg?.alt || 'Popular shade';
  img.loading = 'lazy';

  // Carry over intrinsic dimensions so the browser reserves space before
  // load and avoids CLS / "image without explicit width and height" diagnostic.
  const widthAttr = desktopImg?.getAttribute('width') || mobileImg?.getAttribute('width');
  const heightAttr = desktopImg?.getAttribute('height') || mobileImg?.getAttribute('height');
  if (widthAttr) img.setAttribute('width', widthAttr);
  if (heightAttr) img.setAttribute('height', heightAttr);

  picture.appendChild(img);
  return picture;
}

/** exterior: desktop + mobile pictures through the media bus, keeping UE instrumentation */
function buildExteriorPicture(desktopItem, mobileItem, altText) {
  const desktopImg = desktopItem?.img;
  const mobileImg = mobileItem?.img || desktopImg;
  const alt = desktopImg?.alt || mobileImg?.alt || altText;
  const picture = createOptimizedPicture(mobileImg.src, alt, false, [{ width: '750' }]);
  if (desktopImg && desktopImg !== mobileImg) {
    const desktop = createOptimizedPicture(desktopImg.src, alt, false, [{ media: EXTERIOR_DESKTOP, width: '1600' }]);
    picture.prepend(...desktop.querySelectorAll('source[media]'));
  }
  moveInstrumentation(desktopImg || mobileImg, picture.querySelector('img'));
  return picture;
}

/** exterior: rotate continuously, only while the block is on screen and the tab is visible */
function setupExteriorAutoplay(block, swiper) {
  if (REDUCED_MOTION.matches || block.classList.contains('no-autoplay')) return;
  let visible = false;
  let timer;
  const schedule = () => {
    clearTimeout(timer);
    if (!visible || document.hidden) return;
    timer = setTimeout(() => {
      swiper.slideNext();
      schedule();
    }, EXTERIOR_AUTOPLAY_DELAY);
  };
  // a chosen shade restarts the interval rather than stopping the rotation
  swiper.on('slideChange', schedule);
  document.addEventListener('visibilitychange', schedule);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    schedule();
  }).observe(block);
}

function createContentPanel(contentRow) {
  const panel = document.createElement('div');
  panel.className = 'popular-shades__content';

  const firstCol = contentRow.children[0] || contentRow;
  [...firstCol.childNodes].forEach((node) => {
    panel.appendChild(node.cloneNode(true));
  });

  const heading = panel.querySelector('h1, h2, h3, h4, h5, h6');
  const desc = panel.querySelector('p');
  const cta = panel.querySelector('a');

  if (heading) {
    heading.classList.add('popular-shades__title');

    if (heading.textContent.trim().toLowerCase() === 'popular shades') {
      heading.innerHTML = 'Popular <span class="gradient-text">Shades</span>';
    }
  }

  if (desc) {
    desc.classList.add('popular-shades__description');
  }

  if (cta) {
    cta.classList.add('popular-shades__cta');
    const label = cta.textContent.trim();
    const ctaLink = cta.getAttribute('href') || cta.href || '';
    const parentTitle = heading?.textContent?.trim() || '';
    cta.innerHTML = `
      <span>${label}</span>
      <span class="popular-shades__cta-icon" aria-hidden="true">➜</span>
    `;
    cta.addEventListener('click', () => {
      triggerCTAClickWithLinkAndTitle(ctaLink, label, parentTitle);
    });
  }

  return panel;
}

function getSlidesFromRows(rows) {
  return rows
    .slice(1)
    .map((row) => {
      const cols = [...row.children];
      if (cols.length < 5) return null;

      return {
        desktopImage: getImageData(cols[0]),
        mobileImage: getImageData(cols[1]) || getImageData(cols[0]),
        swatchColour: getTextData(cols[2]),
        swatchName: getTextData(cols[3]),
        swatchNumber: getTextData(cols[4]),
        row,
      };
    })
    .filter((slide) => slide && (slide.desktopImage || slide.mobileImage));
}

export default async function decorate(block) {
  const section = block.closest('.section');
  if (section) section.classList.add('popular-shades-container');

  const rows = [...block.children];
  if (rows.length < 2) return;

  const contentRow = rows[0];
  const slides = getSlidesFromRows(rows);
  const isExterior = block.classList.contains('exterior');

  if (!slides.length) return;

  block.textContent = '';
  block.classList.add('popular-shades');

  const wrapper = document.createElement('div');
  wrapper.className = 'popular-shades__wrapper';

  const contentPanel = createContentPanel(contentRow);
  if (isExterior) moveInstrumentation(contentRow, contentPanel);
  const colourTitle = contentPanel.querySelector('.popular-shades__title')?.textContent?.trim() || '';

  const media = document.createElement('div');
  media.className = 'popular-shades__media';

  const swiperEl = document.createElement('div');
  swiperEl.className = 'popular-shades__swiper swiper';

  const swiperWrapper = document.createElement('div');
  swiperWrapper.className = 'swiper-wrapper';

  slides.forEach((slide, index) => {
    const slideEl = document.createElement('div');
    slideEl.className = 'popular-shades__slide swiper-slide';
    slideEl.dataset.index = index;

    const imageWrap = document.createElement('div');
    imageWrap.className = 'popular-shades__image-wrap';

    const altText = slide.swatchName || `Popular shade ${index + 1}`;
    const picture = isExterior
      ? buildExteriorPicture(slide.desktopImage, slide.mobileImage, altText)
      : buildPicture(slide.desktopImage, slide.mobileImage, altText);
    picture.classList.add('popular-shades__picture');

    imageWrap.appendChild(picture);
    slideEl.appendChild(imageWrap);
    swiperWrapper.appendChild(slideEl);
  });

  swiperEl.appendChild(swiperWrapper);

  const swatches = document.createElement('div');
  swatches.className = 'popular-shades__swatches';

  const swatchList = document.createElement('ul');
  swatchList.className = 'popular-shades__swatch-list';

  slides.forEach((slide, index) => {
    const swatchItem = document.createElement('li');
    swatchItem.className = 'popular-shades__swatch-item track_paint_colour';
    swatchItem.dataset.index = index;
    if (isExterior) moveInstrumentation(slide.row, swatchItem);

    const swatchBtn = document.createElement('button');
    swatchBtn.type = 'button';
    swatchBtn.className = 'popular-shades__swatch';
    swatchBtn.dataset.index = index;
    swatchBtn.setAttribute('aria-label', slide.swatchName || `Shade ${index + 1}`);

    swatchBtn.innerHTML = `
      <span class="popular-shades__swatch-chip" style="background-color: ${slide.swatchColour || '#ddd'}">
        <img
          class="popular-shades__swatch-check"
          src="https://www.asianpaints.com/etc.clientlibs/apcolourcatalogue/clientlibs/clientlib-global/resources/images/circleWithCheckMark-small.svg"
          alt=""
          aria-hidden="true"
        />
      </span>
      <span class="popular-shades__swatch-meta">
        <span class="popular-shades__swatch-name">${slide.swatchName || ''}</span>
        <span class="popular-shades__swatch-number">${slide.swatchNumber || ''}</span>
      </span>
    `;

    swatchItem.appendChild(swatchBtn);
    swatchList.appendChild(swatchItem);
  });

  swatches.appendChild(swatchList);
  media.appendChild(swiperEl);
  media.appendChild(swatches);

  wrapper.appendChild(media);
  wrapper.appendChild(contentPanel);

  if (window.innerWidth < 768) {
    const buttonContainer = contentPanel.querySelector('.button-container');

    if (buttonContainer) {
      media.insertAdjacentElement('afterend', buttonContainer);
    }
  }
  block.appendChild(wrapper);

  if (slides.length <= 1) {
    const firstButton = swatchList.querySelector('.popular-shades__swatch');
    if (firstButton) firstButton.classList.add('is-active');
    return;
  }

  const updateActiveSwatch = (activeIndex) => {
    const swatchButtons = [...swatchList.querySelectorAll('.popular-shades__swatch')];

    swatchButtons.forEach((btn, index) => {
      const isActive = index === activeIndex;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });

    const activeButton = swatchButtons[activeIndex];
    if (activeButton?.parentElement) {
      const listRect = swatchList.getBoundingClientRect();
      const itemRect = activeButton.parentElement.getBoundingClientRect();

      if (itemRect.left < listRect.left || itemRect.right > listRect.right) {
        swatchList.scrollTo({
          left: activeButton.parentElement.offsetLeft - 12,
          behavior: 'smooth',
        });
      }
    }
  };

  try {
    const Swiper = await getSwiperClass();
    if (!Swiper) return;

    const swiper = new Swiper(swiperEl, {
      slidesPerView: 1,
      spaceBetween: 0,
      speed: 600,
      loop: true,
      watchOverflow: true,
      allowTouchMove: true,
      autoHeight: false,
      effect: 'fade',
      fadeEffect: {
        crossFade: true,
      },
      on: {
        init(instance) {
          updateActiveSwatch(instance.realIndex);
        },
        slideChange(instance) {
          updateActiveSwatch(instance.realIndex);
        },
      },
    });

    [...swatchList.querySelectorAll('.popular-shades__swatch')].forEach((btn) => {
      btn.addEventListener('click', () => {
        const index = Number(btn.dataset.index);
        const slide = slides[index] || {};
        const colourName = slide.swatchName || '';
        const colourCode = slide.swatchNumber || '';

        if (btn.closest('.popular-shades__swatch-item')?.classList.contains('track_paint_colour')) {
          // Spec: eVar8 (productName) must carry the shade name AND code,
          // e.g. "Chutney Green 8013". Combine name + number so the shade
          // code isn't dropped (productSKU isn't mapped to an eVar here).
          const productName = [colourName, colourCode].filter(Boolean).join(' ').trim();

          const dd = getDigitalData();
          dd.title = colourTitle;
          dd.data = {
            productName,
            productSKU: colourCode,
          };

          trackEvent('natural_wood_shade_click', {
            title: colourTitle,
            productName,
            productSKU: colourCode,
          });
          pushAdobeProductTitleClick({
            productName: colourName,
            productSku: colourCode,
            title: colourTitle,
            event: 'natural_wood_shade_click',
          });
        }

        swiper.slideTo(index);
      });
    });

    block.popularShadesSwiper = swiper;
    if (isExterior) setupExteriorAutoplay(block, swiper);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to initialize Popular Shades Swiper', error);
  }
}
