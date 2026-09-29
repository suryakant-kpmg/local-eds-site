// add delayed functionality here

import { trackEvent, ga4Implementaion , pushAdobeCtaClickEvent } from './analytics_1.js';

// Third-party marketing pixels (Facebook Pixel and friends).
// Loaded via requestIdleCallback so the pixel scripts never compete
// with LCP/TBT and contribute zero to the Lighthouse Performance
// score (delayed phase fires after the synthetic audit window
// closes). When Adobe Edge Network Event Forwarding goes live for
// these destinations, this dynamic import can be removed — the
// third-party-pixels module is designed to be safely no-op'd or
// fully deleted without touching any other code.
(() => {
  const init = () => import('./third-party-pixels.js')
    .then(({ initThirdPartyPixels }) => initThirdPartyPixels())
    // eslint-disable-next-line no-console
    .catch((e) => console.error('[delayed] third-party-pixels import failed:', e));

  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(init, { timeout: 3000 });
  } else {
    // Safari < 15 + a few mobile browsers lack rIC. Fall back to a
    // short setTimeout — still in the delayed phase, just no idle
    // scheduling. Covers ~5 % of traffic.
    setTimeout(init, 100);
  }
})();

// OneTrust cookie consent banner. Loaded here (delayed phase, idle-scheduled)
// rather than in head.html so it never blocks/competes with LCP or adds to
// TBT during the Lighthouse audit window.
(() => {
  const loadOneTrust = () => {
    const script = document.createElement('script');
    script.src = 'https://cdn.cookielaw.org/scripttemplates/otSDKStub.js';
    script.type = 'text/javascript';
    script.charset = 'UTF-8';
    script.setAttribute('data-domain-script', '433d1cae-89f6-480b-a880-b80ddb341a2c');
    document.head.appendChild(script);
  };

  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(loadOneTrust, { timeout: 3000 });
  } else {
    setTimeout(loadOneTrust, 100);
  }
})();

/**
 * Global function to trigger the exit-intent modal from any CTA with class 'trigger-exit-intent-popup-form'
 * Can be called from JavaScript, Target, or data attributes
 */

const EXIT_INTENT_PATH = '/eds/forms/book-free-site-visit';

window.triggerExitIntentModal = async function triggerExitIntentModal(modalPath = EXIT_INTENT_PATH, options = {}) {
  try {
    // eslint-disable-next-line import/no-cycle
    const { openModal } = await import('../blocks/modal/modal.js');
    await openModal(modalPath, options);
  } catch (e) {
    console.error('Failed to trigger exit-intent modal:', e);
  }
};

// Expose this globally too, so it can be called from DevTools if needed.
// This is the GENUINE exit-intent entry point (invoked by Adobe Target
// exit-intent activities / data-attribute triggers), so it fires the
// Exit Intent Pop-up Impression (event359). CTA-initiated opens (sticky
// CTA, header CTA) go through openModal without this flag.
window.triggerExitIntentPopupForm = function triggerExitIntentPopupForm() {
  window.triggerExitIntentModal(EXIT_INTENT_PATH, { trackExitIntentImpression: true });
};

// Global click listener for all trigger buttons
function setupGlobalClickListener() {
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('.trigger-book-free-site-visit-modal');
    if (!trigger) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const ctaLink = trigger.getAttribute('href') || '';
    const btnTitle = trigger.textContent.trim();

    // e278 - Sticky Form CTA Clicks (.trigger-book-free-site-visit-modal isn't
    // a .button-container child, so bindButtonContainerTracking misses it).
    if (e.isTrusted) {
      trackEvent('sticky_cta_click', {
        cta_: btnTitle,
      });
      pushAdobeCtaClickEvent({
        event: 'sticky_cta_click',
        cta: btnTitle,
      });
      if (trigger.closest('.header-cta')) {
        ga4Implementaion({
          event: 'book_free_site_visit',
          click_text: btnTitle || ctaLink,
          click_category: 'click_header',
        });
      }
    }

    const modalPath = trigger.dataset.modalPath || trigger.getAttribute('href') || EXIT_INTENT_PATH;
    window.triggerExitIntentModal(modalPath);
  }, true);
}

setupGlobalClickListener();

// Header CTA clicks (.header-cta .cta-btn) — event-delegated on document so
// this works regardless of when/if the header block has finished decorating.
// Moved here from header.js's decorate() so it isn't tied to the block's
// local querySelectorAll pass.
// NOTE: today's header CTA markup always also carries
// .trigger-book-free-site-visit-modal, so setupGlobalClickListener's
// capture-phase handler (above) intercepts and stops propagation before
// this bubble-phase listener ever sees the click — the Sticky Form CTA
// Click / book_free_site_visit tracking for that case lives there instead.
// This listener only matters if a future .header-cta .cta-btn is ever
// rendered WITHOUT the modal-trigger class.
function setupHeaderCtaClickListener() {
  document.addEventListener('click', (e) => {
    const ctaBtn = e.target.closest('.header-cta .cta-btn');
    if (!ctaBtn) return;

    const ctaLink = ctaBtn.getAttribute('href') || '';
    const btnTitle = ctaBtn.textContent?.trim() || '';
    trackEvent('sticky_cta_click', {
      cta_: btnTitle,
      parentTitle: 'Header',
      redirectionLink: ctaLink,
    });

    pushAdobeCtaClickEvent({
      event: 'sticky_cta_click',
      cta: btnTitle,
      parentTitle: 'Header',
      destinationUrl: ctaLink,
    });

    // GA4 -> Exit Intent Button Header
    // Defer navigation so dataLayer.push is processed before page unload
    if (ctaLink && !ctaBtn.classList.contains('trigger-book-free-site-visit-modal')) {
      e.preventDefault();
      ga4Implementaion({
        event: 'book_free_site_visit',
        click_text: btnTitle || ctaLink,
        click_category: 'click_header',
      });
      setTimeout(() => { window.location.assign(ctaLink); }, 300);
    } else {
      ga4Implementaion({
        event: 'book_free_site_visit',
        click_text: btnTitle || ctaLink,
        click_category: 'click_header',
      });
    }
  });
}

setupHeaderCtaClickListener();

// SaleAssist shoppable-shots tracking — set up page-level listeners so
// short_video_play (event296) and short_video_shop (event297) fire on
// ANY page that loads a SaleAssist widget (e.g. IDS page), not just
// pages that contain a video-shorts block.
import('../blocks/video-shorts/video-shorts.js')
  .then(({ initSaleAssistTracking }) => initSaleAssistTracking())
  .catch(() => { /* video-shorts block not available — skip */ });

// Below is the function with same name in aem code to allow Target to call it directly.
// window.modalHandler = {
//   // Triggers the full logic to fetch fragment and create modal
//   showModal() {
//     window.triggerExitIntentPopupForm();
//   },

//   // Targets the native <dialog> element stored during creation
//   closeModal() {
//     if (window.activeModalElement) {
//       window.activeModalElement.close();
//     } else {
//       console.warn('No active modal found to close.');
//     }
//   }
// };

/* CHECK TARGET*/
function appendModalBackdrop() {
  let backdrop = document.querySelector('.modal-backdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop fade';
    backdrop.style.display = 'none';
    document.body.append(backdrop);
  }
  return backdrop;
}
appendModalBackdrop();

window.modalHandler = window.modalHandler || {};
const modalHandler = window.modalHandler;

function resolveModal(modalOrSelector) {
  if (!modalOrSelector) return null;

  // CSS selector
  if (typeof modalOrSelector === 'string') {
    return document.querySelector(modalOrSelector);
  }

  // jQuery object
  if (window.jQuery && modalOrSelector instanceof jQuery) {
    return modalOrSelector[0] || null;
  }

  // DOM node
  if (modalOrSelector.nodeType === 1) {
    return modalOrSelector;
  }

  return null;
}


modalHandler.showModal = function (modalOrSelector) {
  const modal = resolveModal(modalOrSelector);

  if (!modal) {
    console.error('Modal not found:', modalOrSelector);
    return;
  }

  modal.style.display = 'block';
  modal.classList.add('in');

  const backdrop = document.querySelector('.modal-backdrop');
  if (backdrop) {
    backdrop.style.display = 'block';
    backdrop.classList.add('show');
  }

  document.body.classList.add('modal-open');
};


modalHandler.closeModal = function (modalOrSelector) {
  const modal = resolveModal(modalOrSelector);

  if (!modal) {
    console.error('Modal not found:', modalOrSelector);
    return;
  }

  modal.classList.remove('in');
  modal.style.display = 'none';

  const backdrop = document.querySelector('.modal-backdrop');
  if (backdrop) {
    backdrop.style.display = 'none';
    backdrop.classList.remove('show');
  }

  document.body.classList.remove('modal-open');
};

// common bottomUpAnimation
async function bottomUpAnimation() {
  await window.loadJQuery?.();

  const $ = window.jQuery;
  if (!$) {
    console.warn('jQuery not available for bottomUpAnimation');
    return;
  }

  const $win = $(window);
  const $stat = $('.allow-bottom-up-animation');
  const $fade = $('.allow-fade-up-animation');

  $win.on('scroll', function () {
    const scrollTop = $win.scrollTop();

    $stat.each(function () {
      const $self = $(this);
      const offsetTop = $self.offset().top;

      if ((scrollTop - offsetTop) > -450) {
        $self.addClass('animate-bottom-to-top');
      }
    });

    $fade.each(function () {
      const $self = $(this);
      const offsetTop = $self.offset().top;

      if ((scrollTop - offsetTop) > -450) {
        $self.addClass('animate-fade-to-top');
      }
    });
  }).scroll();
}

bottomUpAnimation();