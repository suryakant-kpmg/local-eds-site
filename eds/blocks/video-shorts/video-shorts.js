import { trackEvent, pushAdobeCtaClickEvent } from "../../scripts/analytics_1.js";

const SHORTS_WRAPPER_SEL = '.sa_shorts_video-wrapper';
// Fallback selectors for SaleAssist widget variants used on pages
// other than the home page (e.g. IDS grid/list layout).
const SHORTS_WRAPPER_FALLBACKS = [
  '.sa_shorts_video-wrapper',
  '[class*="sa_shorts"]',
  '[class*="saleassist"]',
  '[class*="vtile"]',
];

function getShortsWrapper(el) {
  for (const sel of SHORTS_WRAPPER_FALLBACKS) {
    const found = el.closest(sel);
    if (found) return found;
  }
  return null;
}
const VIDEO_SHORTS_PREFIX = "video-shorts-";

// Ordered list of known SaleAssist caption selectors across widget
// variants (tile on home page vs grid/list on IDS page).
const CAPTION_SELECTORS = [
  '.sa_shorts_parentVideo-caption p',
  '.sa_shorts_video-caption p',
  '.sa_shorts_caption p',
  '.sa_shorts_title p',
  '[class*="caption"] p',
  '[class*="title"] p',
];

function getVideoTitle(wrapper, videoEl) {
  for (const sel of CAPTION_SELECTORS) {
    const text = wrapper?.querySelector(sel)?.textContent?.trim();
    if (text) return text;
  }
  // Fallback: title / aria-label on the <video> element itself
  if (videoEl) {
    const attr = videoEl.getAttribute('title')
      || videoEl.getAttribute('aria-label')
      || videoEl.getAttribute('data-title')
      || videoEl.getAttribute('data-video-title')
      || '';
    if (attr.trim()) return attr.trim();
  }
  return '';
}

// Video play dedup rule (simple):
//   Fire only when the user selects a DIFFERENT tile than the currently
//   selected one. Clicking the same tile again (pause/resume, or same tile
//   from a swiper clone / modal duplicate) does not fire.
//   Modal close resets the tracker so replay after reopen fires again.
// Tile identity: SaleAssist sets aria-label="N / M" on each wrapper.
// The value is stable per underlying tile across grid/modal/Swiper clones,
// and unique across different tiles even when they share the same CTA.
let currentTileKey = null;
const firedVideoShop = new Set();

function getTileKey(wrapper, videoEl) {
  const aria = wrapper?.getAttribute('aria-label')?.trim();
  if (aria) return `aria:${aria}`;
  const src = (videoEl?.currentSrc || videoEl?.src || '').trim();
  if (src) return `src:${src}`;
  const cta = wrapper?.querySelector('.cta-link')?.getAttribute('href') || '';
  return cta ? `cta:${cta}` : '';
}

function triggerVideoPlayAnalyticsEvt(wrapper, videoEl) {
  const key = getTileKey(wrapper, videoEl);
  // Same tile as currently selected — skip.
  if (key && key === currentTileKey) return;
  if (key) currentTileKey = key;
  videoEl.dataset.playTrackingBound = 'true';
  const videoTitle = getVideoTitle(wrapper, videoEl);
  trackEvent('short_video_play', {
    videoTitle,
  });
  pushAdobeCtaClickEvent({
    cta: 'Video Play',
    title: videoTitle || '',
  })
}

function triggerVideoShopAnalyticsEvt(anchorEl) {
  const key = (anchorEl.getAttribute('href') || anchorEl.href || '').trim();
  if (key && firedVideoShop.has(key)) return;
  if (key) firedVideoShop.add(key);
  anchorEl.dataset.shopTrackingBound = 'true';
  
  const wrapper = getShortsWrapper(anchorEl);
  const videoTitle = wrapper ? getVideoTitle(wrapper) : '';

  trackEvent("short_video_shop", {
    param1: anchorEl.href,
    ...(videoTitle && { videoTitle }),
  });
  pushAdobeCtaClickEvent({
    cta: anchorEl.textContent.trim() || '',
    title: videoTitle || '',
    destinationUrl: anchorEl.href,
    event: 'short_video_shop'
  });
}

// Reset play/shop tracking when the SaleAssist modal is closed so a fresh
// viewing session (reopen + click same video) fires the event again.
function resetDedupOnModalClose() {
  document.addEventListener('click', (e) => {
    // SaleAssist's modal close button — matches multiple potential class/id
    // names used across widget variants.
    const closeBtn = e.target.closest(
      '[class*="sa_shorts_close"], [class*="sa_shorts_modal_close"], [aria-label="Close"], .sa-shorts-modal-close, [class*="close-btn"]'
    );
    if (!closeBtn) return;
    // Only act if the close button is inside the SaleAssist modal.
    if (!closeBtn.closest('[id*="sa_shorts_modal"], [class*="sa_shorts_modal"]')) return;
    currentTileKey = null;
    firedVideoShop.clear();
  }, true);
}

export function initSaleAssistTracking() {
  // Guard: only attach once per page even if called from multiple blocks/delayed.js.
  // NOTE: `document` has no `dataset` (only Elements do) — using it throws a
  // TypeError that aborts this function before any listener is bound, so use
  // the documentElement (<html>) dataset instead.
  if (document.documentElement.dataset.videoShortsTrackingBound === 'true') return;
  document.documentElement.dataset.videoShortsTrackingBound = 'true';

  const exploreSel = '.cta-link';

  resetDedupOnModalClose();
  observeModalSlideChange();

  // Delegate on document so clicks are caught regardless of where SaleAssist
  // injects its DOM (widget tiles or dynamically-created modal). The modal
  // (#sa_shorts_modal-wrapper) is created lazily on first video click, so
  // a direct querySelector at setup time always returns null.
  document.addEventListener('click', (e) => {
    // CTA click -> short_video_shop
    const cta = e.target.closest(exploreSel);
    if (cta) {
      triggerVideoShopAnalyticsEvt(cta);
      return;
    }

    // Video click -> short_video_play
    const video = e.target.closest('video');
    if (video) {
      const wrapper = getShortsWrapper(video);
      if (wrapper) {
        triggerVideoPlayAnalyticsEvt(wrapper, video);
      }
    }
    // Tile / wrapper background clicks intentionally fire NOTHING —
    // short_video_shop must only come from an explicit CTA click.
  });
}

// Watch the SaleAssist modal for slide changes. When the user navigates
// via the modal's Previous / Next arrows (or swipes), the currently-active
// slide (.swiper-slide-active) changes — no <video> click event fires,
// so the document click listener above cannot detect it. A MutationObserver
// on the modal detects the class change and fires short_video_play for the
// newly-active video, with the same currentPlayKey dedup.
function observeModalSlideChange() {
  const attach = (modal) => {
    if (modal.dataset.slideObserverBound === 'true') return;
    modal.dataset.slideObserverBound = 'true';
    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type !== 'attributes' || m.attributeName !== 'class') continue;
        const el = m.target;
        if (!el.classList?.contains('sa_shorts_video-wrapper')) continue;
        if (!el.classList.contains('swiper-slide-active')) continue;
        const video = el.querySelector('video');
        if (video) triggerVideoPlayAnalyticsEvt(el, video);
      }
    });
    mo.observe(modal, { subtree: true, attributes: true, attributeFilter: ['class'] });
  };

  // Modal is created lazily on first click, so watch for it.
  const existing = document.querySelector('[id*="sa_shorts_modal"], [class*="sa_shorts_modal"]');
  if (existing) attach(existing);
  const bodyObserver = new MutationObserver(() => {
    const modal = document.querySelector('[id*="sa_shorts_modal"], [class*="sa_shorts_modal"]');
    if (modal) attach(modal);
  });
  bodyObserver.observe(document.body, { childList: true, subtree: true });
}

export default function decorate(block) {
  const row = block.querySelector(":scope > div");
  if (!row) return;

  const columns = [...row.children];
  if (columns.length < 2) return;

  // Column 1 = heading/text
  const textCol = columns[0];
  textCol.classList.add("video-shorts-heading");

  // Column 2 = authored SaleAssist DOM wrapper id
  // Example authored value:
  // video-shorts-12b7c69d-67cb-4a7f-baba-11fbbd1d9c84
  const saleassistIdCol = columns[1];
  saleassistIdCol.classList.add("sale-assist-id");

  const authoredWrapperId = saleassistIdCol.textContent.trim();
  if (!authoredWrapperId) return;

  // SaleAssist mountWidget expects only the UUID part, not the full DOM id.
  // So strip "video-shorts-" if it is present.
  const saleassistWidgetId = authoredWrapperId.startsWith(VIDEO_SHORTS_PREFIX)
    ? authoredWrapperId.replace(VIDEO_SHORTS_PREFIX, "")
    : authoredWrapperId;

  let widgetLoaded = false;

  window.addEventListener("scroll", function loadWidget() {
    if (!widgetLoaded && window.scrollY > 100) {
      widgetLoaded = true;

      const container = document.querySelector(".section.video-shorts-container .video-shorts.block");

      // Create the mount container inside the block using the full authored DOM id.
      if (container && !container.querySelector(`#${authoredWrapperId}`)) {
        const div = document.createElement("div");
        div.id = authoredWrapperId;
        container.appendChild(div);
      }

      const script = document.createElement("script");
      script.src = "https://static.saleassist.ai/vtiles/swidget.min.js";
      script.type = "text/javascript";
      script.async = true;

      script.onload = function () {
        if (typeof saleassistVideoTiles !== "undefined") {
          const isMobile = window.matchMedia("(max-width: 480px)");

          saleassistVideoTiles.mountWidget({
            // Pass only the UUID to the SaleAssist widget API
            id: saleassistWidgetId,
            width: isMobile.matches ? "200px" : "225px",
            height: isMobile.matches ? "360px" : "400px",
            borderRadius: "rounded",
            type: "tile",
            alterMobileDimensions: true,
          });
        } else {
          // eslint-disable-next-line no-console
          console.error("SaleAssist script loaded, but saleassistVideoTiles is undefined.");
        }
      };

      document.head.appendChild(script);
      window.removeEventListener("scroll", loadWidget);
    }
  });

  // This extra body-level container is used by existing tracking logic.
  // Keep it aligned with the authored DOM id and avoid duplicates.
  if (!document.querySelector(`#${authoredWrapperId}`)) {
    const div = document.createElement("div");
    div.id = authoredWrapperId;
    document.body.appendChild(div);
  }
}

// Initialize tracking once when module loads
initSaleAssistTracking();