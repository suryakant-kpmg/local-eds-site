import { createOptimizedPicture } from '../../scripts/aem.js';
import { getDigitalData, trackEvent , pushAdobeCtaClickEvent } from '../../scripts/analytics_1.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

const PINCODE_STORAGE_KEY = 'pincode';
const PINCODE_COOKIE_NAME = 'cpPincode';

function getSavedPincodeValue() {
  try {
    const stored = localStorage.getItem(PINCODE_STORAGE_KEY);
    if (stored && stored.length === 6 && /^[0-9]{6}$/.test(stored)) return stored;
  } catch {
    // localStorage unavailable
  }

  const cookieVal = `; ${document.cookie}`;
  const parts = cookieVal.split(`; ${PINCODE_COOKIE_NAME}=`);
  if (parts.length === 2) {
    const raw = parts.pop().split(';').shift();
    const decoded = raw ? decodeURIComponent(raw) : '';
    if (decoded && decoded.length === 6 && /^[0-9]{6}$/.test(decoded)) return decoded;
  }

  return '';
}

/**
 * Four Image Row - Mobile Only Swiper (Robust)
 */

function extractHref(row) {
  const anchor = row.querySelector('a[href]');
  if (anchor) return anchor.getAttribute('href') || '';

  const rawText = row.textContent || '';
  const match = rawText.match(/https?:\/\/\S+|\/\S+\.html(?:#[^\s"'<>]*)?/i);
  return match ? match[0].trim() : '';
}

async function getSwiperClass() {
  if (window.Swiper) return window.Swiper;

  if (window.loadSwiper) {
    return window.loadSwiper();
  }

  // ⛑️ fallback wait (EDS safe)
  return new Promise((resolve) => {
    let tries = 0;

    const interval = setInterval(() => {
      if (window.Swiper) {
        clearInterval(interval);
        resolve(window.Swiper);
      }

      tries += 1;
      if (tries > 20) {
        clearInterval(interval);
        console.warn('Swiper not found');
        resolve(null);
      }
    }, 100);
  });
}

export default async function decorate(block) {
  const rows = [...block.querySelectorAll(':scope > div')];

  const container = document.createElement('div');
  container.className = 'fourimageinrow';

  // Build UI
  rows.forEach((row) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'fourimageinrow-wraper';

    const pic = row.querySelector('picture');
    const link = row.querySelector('a[href]');
    const href = extractHref(row);

    let title = '';
    const headings = row.querySelectorAll('h1, h2, h3, h4, h5, h6');

    if (headings.length > 0) {
      title = headings[0].textContent;
    } else if (link) {
      title = link.textContent;
    } else {
      title = row.textContent.trim();
    }

    const a = document.createElement('a');
    a.className = 'fourimageinrow-imagewithtext fourimageinrow-track';
    a.href = href || '#';

    if (link && link.target) a.target = link.target;

    a.setAttribute('aria-label', title);
    a.addEventListener('click', (event) => {
      const destination = a.getAttribute('href') || '';
      if (!destination || destination === '#') return;

      event.preventDefault();

      // Append pincode from cookie to contractor listing redirects
      let finalUrl = destination;
      const pincodeVal = getSavedPincodeValue();
      if (pincodeVal && !destination.includes('cpListing=')) {
        const separator = destination.includes('?') ? '&' : '?';
        finalUrl = `${destination}${separator}cpListing=pinCode:${encodeURIComponent(pincodeVal)}`;
      }
      window.location.href = finalUrl;
    });

    if (pic) {
      const img = pic.querySelector('img');
      if (img) {
        img.className = 'fourimageinrow-img';
        img.width = 314;
        img.height = 214;
      }
      a.append(pic);
    }

    const titleWrap = document.createElement('div');
    titleWrap.className = 'fourimageinrow-titlewitharrow';

    const titleSpan = document.createElement('span');
    titleSpan.className = 'fourimageinrow-imgtitle';
    titleSpan.textContent = title;

    const arrowSpan = document.createElement('span');
    arrowSpan.className = 'fourimageinrow-imgarrow';
    arrowSpan.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="15" viewBox="0 0 16 14">
      <path d="M9.11103 1.1665L14.6666 6.99984M14.6666 6.99984L9.11103 12.8332M14.6666 6.99984L1.33325 6.99984"
      stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`;

    titleWrap.append(titleSpan, arrowSpan);
    a.append(titleWrap);

    wrapper.append(a);
    moveInstrumentation(row, wrapper);
    container.append(wrapper);
  });

  // Optimize images
  container.querySelectorAll('picture > img').forEach((img) => {
    const optimizedPic = createOptimizedPicture(img.src, img.alt, false, [{ width: '400' }]);
    moveInstrumentation(img, optimizedPic.querySelector('img'));
    img.closest('picture').replaceWith(optimizedPic);
    optimizedPic.querySelector('img').className = 'fourimageinrow-img';
  });

  block.textContent = '';
  block.append(container);

  const cardLinks = block.querySelectorAll('.fourimageinrow-track');
  cardLinks.forEach((linkEl) => {
    if (linkEl.dataset.analyticsBound === 'true') return;
    linkEl.dataset.analyticsBound = 'true';

    linkEl.addEventListener('click', () => {
      const exploreLink = linkEl.getAttribute('href') || '';
      // Analytics param2 (eVar86) must be the COMPLETE redirection URL.
      // The href attribute is intentionally relative (for in-domain
      // redirection, see "Fix CTA redirection for relative paths"), so
      // use the resolved absolute .href property for reporting.
      const exploreAbsoluteLink = linkEl.href || exploreLink;
      const exploreTitle = (linkEl.querySelector('.text-explore-stores')?.textContent || '').trim()
        || (linkEl.querySelector('.fourimageinrow-imgtitle')?.textContent || '').trim();
      const exploreMainTitle = (linkEl.querySelector('.track-main-title')?.textContent || '').trim()
        || (linkEl.querySelector('.fourimageinrow-imgtitle')?.textContent || '').trim();

      if (!exploreLink) return;

      getDigitalData().data = {
        cta_: exploreTitle,
        param1: exploreMainTitle,
        param2: exploreAbsoluteLink,
      };

      trackEvent('squarecross_click', {
        cta_: exploreTitle,
        param1: exploreMainTitle,
        param2: exploreAbsoluteLink,
      });


      pushAdobeCtaClickEvent({
        event : "squarecross_click" , 
        detail2 : exploreAbsoluteLink || '',
        cta: exploreTitle || ''
      })

    });
  });

  // =========================
  // MOBILE SWIPER INIT
  // =========================

  let swiperInstance = null;
  let paginationEl = null;

  async function initSwiper() {
    if (swiperInstance) return;

    const Swiper = await getSwiperClass();
    if (!Swiper) return;

    const children = [...container.children];

    container.classList.add('swiper');

    const wrapper = document.createElement('div');
    wrapper.className = 'swiper-wrapper';

    children.forEach((child) => {
      child.classList.add('swiper-slide');
      wrapper.appendChild(child);
    });

    container.innerHTML = '';
    container.appendChild(wrapper);

    paginationEl = document.createElement('div');
    paginationEl.className = 'swiper-pagination fourimageinrow-pagination';
    block.append(paginationEl);

    swiperInstance = new Swiper(container, {
      slidesPerView: 1,
      spaceBetween: 20,
      loop: false,
      resistanceRatio: 0.85,
      touchRatio: 1,
      threshold: 5,
      longSwipesRatio: 0.2,
      pagination: {
        el: paginationEl,
        clickable: true,
      },
    });
  }

  function destroySwiper() {
    if (!swiperInstance) return;

    swiperInstance.destroy(true, true);
    swiperInstance = null;

    const slides = container.querySelectorAll('.swiper-slide');

    container.classList.remove('swiper');
    container.innerHTML = '';

    slides.forEach((slide) => {
      slide.classList.remove('swiper-slide');
      container.appendChild(slide);
    });

    if (paginationEl) {
      paginationEl.remove();
      paginationEl = null;
    }
  }

  function handleResize() {
    if (window.innerWidth < 768) {
      initSwiper();
    } else {
      destroySwiper();
    }
  }

  // ⛑️ ensure it runs after everything loads
  window.addEventListener('load', handleResize);
  handleResize();

  window.addEventListener('resize', handleResize);
}
