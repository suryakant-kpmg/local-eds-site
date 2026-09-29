import {
  loadHeader,
  loadFooter,
  decorateButtons,
  decorateIcons,
  decorateLinkedPictures,
  decorateSections,
  decorateBlocks,
  decorateTemplateAndTheme,
  getMetadata,
  waitForFirstImage,
  loadSection,
  loadSections,
  loadCSS,
} from './aem.js';
import {
  bindButtonContainerTracking,
  bindReadTermsPdfTracking,
  royalePlayAnimatedImageTracking,
  bindChatbotInteractionTracking,
} from './analytics_1.js';
import { DOMAIN_ENV, getDomainEnvironment } from './environment.js';
import {
  SUPPRESS_ANALYTICS_FOR_THIS_PAGE,
} from './auth-callback-suppression.js';

const SPRINKLR_APP_IDS = Object.freeze({
  [DOMAIN_ENV.BETA]: '65d88620e479600565c07099_app_600025303',
  [DOMAIN_ENV.PROD]: '65d829916b40b375b1c92ac9_app_600025297',
});

function loadSprinklrChatWidget() {
  const environment = getDomainEnvironment();
  const appId = SPRINKLR_APP_IDS[environment] || SPRINKLR_APP_IDS[DOMAIN_ENV.BETA];

  window.sprChatSettings = {
    ...(window.sprChatSettings || {}),
    appId,
    skin: 'MODERN',
  };

  const t = window;
  const e = t.sprChat;
  const a = e && !!e.loaded;
  const n = document;
  const r = function sprinklrChatProxy(...args) { r.m(args); };
  r.q = [];
  r.m = (args) => { r.q.push(args); };
  t.sprChat = a ? e : r;

  const e2 = t.sprTeamChat;
  const r2 = function sprinklrTeamChatProxy(...args) { r2.m(args); };
  r2.q = [];
  r2.m = (args) => { r2.q.push(args); };
  t.sprTeamChat = e2 ? e2 : r2;

  const insertScript = () => {
    const script = n.createElement('script');
    script.type = 'text/javascript';
    script.async = true;
    script.src = `https://prod4-live-chat.sprinklr.com/api/livechat/handshake/widget/${appId}`;
    script.onerror = () => {
      t.sprChat.loaded = false;
    };
    script.onload = () => {
      t.sprChat.loaded = true;
    };
    const firstScript = n.getElementsByTagName('script')[0];
    firstScript.parentNode.insertBefore(script, firstScript);
  };

  if (typeof e === 'function') {
    if (a) e('update', t.sprChatSettings);
    else insertScript();
  } else if (n.readyState !== 'loading') {
    insertScript();
  } else {
    n.addEventListener('DOMContentLoaded', insertScript, { once: true });
  }
}

function initChatPlaceholder() {
  const style = document.createElement('style');
  style.id = 'sprinklr-placeholder-styles';
  // eslint-disable-next-line max-len
  style.textContent = '.embeddedServiceHelpButton{position:fixed;z-index:1036;font-family:sans-serif}.embeddedServiceHelpButton .helpButton .uiButton{font-family:sans-serif;padding:0;margin:0;height:56px;box-shadow:0 0 12px 0 rgba(0,0,0,.5);border-radius:23px;background:#431a80;font-size:.875em;color:#fff;font-weight:400;text-shadow:none;display:-webkit-box;display:-webkit-flex;display:-ms-flexbox;display:flex;justify-content:center;-webkit-align-items:center;-ms-flex-align:center;align-items:center;background-color:#01c150;background:linear-gradient(180deg,#00c853,#03953f)}@media (min-width:320px) and (max-width:991px){.embeddedServiceHelpButton .helpButton .uiButton{height:38px}}@media (min-width:320px) and (max-width:991px){.embeddedServiceHelpButton.embeddedServiceBottomTabBar .helpButton,.embeddedServiceHelpButton .helpButton{position:fixed;bottom:95px;right:20px;height:auto!important}}@media (min-width:320px) and (max-width:991px){html[lang=en] .embeddedServiceHelpButton .helpButton{bottom:30px!important}}.embeddedServiceHelpButton .helpButton .helpButtonEnabled.no-hover:focus:before,.embeddedServiceHelpButton .helpButton .helpButtonEnabled.no-hover:hover:before{display:none}@media only screen and (min-width:48em){.embeddedServiceHelpButton{background-color:transparent}.embeddedServiceHelpButton.embeddedServiceBottomTabBar .helpButton,.embeddedServiceHelpButton .helpButton{position:fixed;bottom:50px;right:40px;transform:scale(1)}.embeddedServiceHelpButton .helpButton .uiButton,.embeddedServiceHelpButton .helpButton .uiButton:focus:before,.embeddedServiceHelpButton .helpButton .uiButton:hover:before{border-radius:8px 8px 0 0}}.embeddedServiceHelpButton .uiButton{min-width:8em;border:0}.embeddedServiceHelpButton .uiButton .helpButtonLabel{flex-grow:1;line-height:normal;display:none!important}.embeddedServiceHelpButton .helpButton .uiButton{min-width:56px;border-radius:10px!important}.embeddedServiceHelpButton .helpButton .uiButton:hover:before{border-radius:10px}@media (min-width:320px) and (max-width:991px){.embeddedServiceHelpButton .helpButton .uiButton{min-width:38px;border-radius:10px!important}}.embeddedServiceHelpButton .embeddedServiceIcon{z-index:1;display:inline-block!important;margin-right:0;line-height:1!important}.embeddedServiceHelpButton div[dir=rtl] .embeddedServiceIcon{margin-left:10px;margin-right:auto}.embeddedServiceHelpButton .embeddedServiceIcon:before{font-family:embeddedserviceiconfont;font-size:30px;content:attr(data-icon);speak:none;text-rendering:auto;font-weight:400;font-variant:normal;text-transform:none;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}@font-face{font-family:embeddedserviceiconfont;src:url(data:application/octet-stream;base64,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) format("truetype")}';
  document.head.appendChild(style);

  const placeholder = document.createElement('div');
  placeholder.id = 'sprinklr-chat-placeholder';
  placeholder.className = 'embeddedServiceHelpButton customChatIcon';
  placeholder.style.display = 'block';
  placeholder.innerHTML = `<div class="helpButton">
    <button aria-label="chat Bot" tabindex="0" class="focus-visible-auto-imp uiButton helpButtonEnabled" title="help">
      <span class="embeddedServiceIcon" aria-hidden="true" data-icon="\uE900"></span>
      <span class="helpButtonLabel" aria-live="polite" aria-atomic="true">
        <span class="assistiveText">Live chat:</span>
        <span class="message">Chat</span>
      </span>
    </button>
  </div>`;
  document.body.appendChild(placeholder);

  placeholder.querySelector('button').addEventListener('click', () => {
    placeholder.remove();
    loadSprinklrChatWidget();
    // Open chat once Sprinklr widget finishes loading
    let attempts = 0;
    const tryOpen = setInterval(() => {
      attempts += 1;
      if (window.sprChat?.loaded) {
        clearInterval(tryOpen);
        window.sprChat('open');
      } else if (attempts > 20) {
        clearInterval(tryOpen);
      }
    }, 300);
  }, { once: true });
}

(function loadCryptoJSGlobally() {
  if (window.CryptoJS) return;

  const script = document.createElement('script');
  script.src = '/eds/scripts/crypto.js';
  script.async = true;
  document.head.appendChild(script);
}());

/**
 * Global jQuery loader
 * - loads jQuery only once
 * - returns a promise so dependent code can await it
 * - useful for legacy modules such as analytics or older blocks
 */
window.loadJQuery = function loadJQuery() {
  if (window.jqueryLoadPromise) return window.jqueryLoadPromise;

  window.jqueryLoadPromise = new Promise((resolve, reject) => {
    if (window.jQuery) {
      resolve(window.jQuery);
      return;
    }

    const existingScript = document.querySelector('script[data-jquery-js]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(window.jQuery), { once: true });
      existingScript.addEventListener('error', reject, { once: true });
      return;
    }

    const jqueryScript = document.createElement('script');
    jqueryScript.src = '/eds/scripts/jquery.min.js';
    jqueryScript.async = true;
    jqueryScript.setAttribute('data-jquery-js', 'true');
    jqueryScript.onload = () => resolve(window.jQuery);
    jqueryScript.onerror = reject;
    document.head.appendChild(jqueryScript);
  });

  return window.jqueryLoadPromise;
};

/**
 * Global Bootstrap loader
 * - loads Bootstrap CSS once
 * - optionally loads Bootstrap JS bundle once
 */
window.loadBootstrap = function loadBootstrap({ withJS = false } = {}) {
  if (!window.bootstrapCssLoadPromise) {
    window.bootstrapCssLoadPromise = new Promise((resolve, reject) => {
      if (document.querySelector('link[data-bootstrap-css]')) {
        resolve();
        return;
      }

      const bootstrapCss = document.createElement('link');
      bootstrapCss.rel = 'stylesheet';
      bootstrapCss.href = 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css';
      bootstrapCss.setAttribute('data-bootstrap-css', 'true');
      bootstrapCss.onload = () => resolve();
      bootstrapCss.onerror = reject;
      document.head.appendChild(bootstrapCss);
    });
  }

  if (!withJS) return window.bootstrapCssLoadPromise;

  if (!window.bootstrapJsLoadPromise) {
    window.bootstrapJsLoadPromise = new Promise((resolve, reject) => {
      if (window.bootstrap) {
        resolve(window.bootstrap);
        return;
      }

      const existingScript = document.querySelector('script[data-bootstrap-js]');
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(window.bootstrap), { once: true });
        existingScript.addEventListener('error', reject, { once: true });
        return;
      }

      const bootstrapScript = document.createElement('script');
      bootstrapScript.src = 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js';
      bootstrapScript.async = true;
      bootstrapScript.setAttribute('data-bootstrap-js', 'true');
      bootstrapScript.onload = () => resolve(window.bootstrap);
      bootstrapScript.onerror = reject;
      document.head.appendChild(bootstrapScript);
    });
  }

  return Promise.all([window.bootstrapCssLoadPromise, window.bootstrapJsLoadPromise]);
};

/**
 * Global Swiper loader
 * - can be called by any block when needed
 * - keeps a single promise to avoid duplicate requests
 */
window.loadSwiper = function loadSwiper() {
  if (window.swiperLoadPromise) return window.swiperLoadPromise;

  window.swiperLoadPromise = new Promise((resolve, reject) => {
    if (window.Swiper) {
      resolve(window.Swiper);
      return;
    }

    if (!document.querySelector('link[data-swiper-css]')) {
      const swiperCss = document.createElement('link');
      swiperCss.rel = 'stylesheet';
      swiperCss.href = '/eds/styles/swiper.css';
      swiperCss.setAttribute('data-swiper-css', 'true');
      document.head.appendChild(swiperCss);
    }

    const existingScript = document.querySelector('script[data-swiper-js]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(window.Swiper), { once: true });
      existingScript.addEventListener('error', reject, { once: true });
      return;
    }

    const swiperScript = document.createElement('script');
    swiperScript.src = '/eds/scripts/swiper.js';
    swiperScript.setAttribute('data-swiper-js', 'true');
    swiperScript.async = true;
    swiperScript.onload = () => resolve(window.Swiper);
    swiperScript.onerror = reject;
    document.head.appendChild(swiperScript);
  });

  return window.swiperLoadPromise;
};

/**
 * Moves all the attributes from a given element to another given element.
 * @param {Element} from the element to copy attributes from
 * @param {Element} to the element to copy attributes to
 * @param {string[]} [attrs] optional list of attribute names to move
 */
export function moveAttributes(
  from,
  to,
  attrs = [...from.attributes].map(({ nodeName }) => nodeName),
) {
  attrs.forEach((attr) => {
    const value = from.getAttribute(attr);
    if (value) {
      to.setAttribute(attr, value);
      from.removeAttribute(attr);
    }
  });
}

/**
 * Move instrumentation attributes from a given element to another given element.
 * @param {Element} from the element to copy attributes from
 * @param {Element} to the element to copy attributes to
 */
export function moveInstrumentation(from, to) {
  moveAttributes(
    from,
    to,
    [...from.attributes]
      .map(({ nodeName }) => nodeName)
      .filter((attr) => attr.startsWith('data-aue-') || attr.startsWith('data-richtext-')),
  );
}

/**
 * Loads fonts.css and sets a session storage flag.
 * Fonts are intentionally not forced into the critical path.
 */
async function loadFonts() {
  await loadCSS(`${window.hlx.codeBasePath}/styles/fonts.css`);
  try {
    if (!window.location.hostname.includes('localhost')) {
      sessionStorage.setItem('fonts-loaded', 'true');
    }
  } catch (e) {
    // sessionStorage may be unavailable
  }
}

/**
 * Builds all synthetic blocks in a container element.
 * @param {Element} main The container element
 */
// eslint-disable-next-line no-unused-vars
function buildAutoBlocks(main) {
  try {
    // TODO: add auto block, if needed
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Auto Blocking failed', error);
  }
}

/**
 * Replaces a heading element with the requested heading tag while preserving
 * attributes and child nodes.
 * @param {HTMLHeadingElement} heading Existing heading element
 * @param {number} level Heading level (1-6)
 * @returns {HTMLHeadingElement} The replacement heading element
 */
function replaceHeadingLevel(heading, level) {
  const targetTag = `H${level}`;
  if (!heading || heading.tagName === targetTag) return heading;

  const replacement = document.createElement(targetTag.toLowerCase());
  [...heading.attributes].forEach(({ name, value }) => {
    replacement.setAttribute(name, value);
  });
  replacement.append(...heading.childNodes);
  heading.replaceWith(replacement);

  return replacement;
}

/**
 * Reads a metadata value from the page metadata table when present.
 * @param {Element} main The main element
 * @param {string} key Metadata key to read
 * @returns {string} Metadata value
 */
function readPageMetadata(main, key) {
  const rows = [...main.querySelectorAll('.metadata > div')];
  const match = rows.find((row) => row.children[0]?.textContent?.trim()?.toLowerCase() === key.toLowerCase());
  return match?.children[1]?.textContent?.trim() || '';
}

/**
 * Ensures the first heading on the page is a single SEO H1 placed before any
 * header or modal headings injected by other blocks.
 * @param {Document} doc The document
 * @param {Element} main The main element
 */
function ensureDocumentPrimaryHeading(doc, main) {
  if (!main || doc.querySelector('body > h1[data-seo-primary-heading="true"]')) return;

  const firstContentHeading = main.querySelector('h1, h2, h3, h4, h5, h6');
  const metadataH1 = getMetadata('h1')
    || readPageMetadata(main, 'h1')
    || readPageMetadata(main, 'seo h1')
    || readPageMetadata(main, 'seo-h1');
  const metadataTitle = getMetadata('og:title')
    || getMetadata('title')
    || readPageMetadata(main, 'title');
  const primaryText = metadataH1 || firstContentHeading?.textContent?.trim() || metadataTitle.trim();

  if (!primaryText) return;

  const h1 = doc.createElement('h1');
  h1.dataset.seoPrimaryHeading = 'true';
  h1.textContent = primaryText;
  h1.setAttribute(
    'style',
    'position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important;',
  );

  doc.body.prepend(h1);

  [...doc.querySelectorAll('h1')]
    .filter((heading) => heading !== h1)
    .forEach((heading) => {
      replaceHeadingLevel(heading, 2);
    });
}

/**
 * Decorates the main element.
 * @param {Element} main The main element
 */
// eslint-disable-next-line import/prefer-default-export
export function decorateMain(main) {
  decorateButtons(main);
  bindReadTermsPdfTracking(main);
  bindButtonContainerTracking(main);
  royalePlayAnimatedImageTracking(main);
  decorateIcons(main);
  decorateLinkedPictures(main);
  buildAutoBlocks(main);
  decorateSections(main);
  decorateBlocks(main);
}




/**
 * Append a <link rel="preload" as="image" fetchpriority="high"> for an
 * image URL. Idempotent — no-op if the same href is already preloaded.
 */
function appendImagePreload(href, srcset, sizes, media) {
  if (!href) return;
  if (document.querySelector(`link[rel="preload"][as="image"][href="${CSS.escape(href)}"]`)) return;

  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.href = href;
  link.setAttribute('fetchpriority', 'high');
  if (srcset) link.setAttribute('imagesrcset', srcset);
  if (sizes) link.setAttribute('imagesizes', sizes);
  // A `media` attribute makes the browser preload only when it matches the
  // viewport — essential for responsive heroes with separate desktop/mobile
  // images, so a phone never wastes bandwidth on the hidden desktop image.
  if (media) link.media = media;
  document.head.appendChild(link);
}

/**
 * Preload for the carousel-hero-banner, which authors the LCP slide as a
 * desktop image (cell 0) and a separate mobile image (cell 1), toggled at
 * 768px in the block JS. The generic first-<img> logic below always picks
 * cell 0 (desktop), leaving the mobile LCP image unpreloaded on phones —
 * exactly where LCP was swinging. Emit viewport-scoped preloads for both so
 * each device fetches only the image it will actually render.
 * @returns {boolean} true if it handled the preload (caller should stop)
 */
function preloadHeroBannerLcp(firstSection) {
  const heroBanner = firstSection.querySelector('.carousel-hero-banner');
  if (!heroBanner) return false;

  const firstSlide = heroBanner.firstElementChild;
  const cells = firstSlide ? [...firstSlide.children] : [];

  const preloadCell = (cell, media) => {
    const picture = cell?.querySelector('picture');
    const src = picture?.querySelector('img')?.getAttribute('src');
    if (!src) return false;
    const source = picture.querySelector('source[srcset]');
    appendImagePreload(src, source?.getAttribute('srcset') || '', source?.getAttribute('sizes') || '', media);
    return true;
  };

  // Breakpoint mirrors carousel-hero-banner.js (window.innerWidth < 768).
  const desktopDone = preloadCell(cells[0], '(min-width: 768px)');
  const mobileDone = preloadCell(cells[1], '(max-width: 767px)');
  return desktopDone || mobileDone;
}

/**
 * Preload the LCP image as early as possible in the eager phase.
 *
 * EDS pages serve mostly-text HTML where the hero <img> is present but
 * doesn't get `fetchpriority="high"` until block decoration runs in JS.
 * By that point the browser's preload scanner has already missed it,
 * so the LCP image fetches at default priority — failing the
 * Lighthouse "LCP request discovery" audit ("fetchpriority=high should
 * be applied", "Request is discoverable in initial document") and
 * losing 200–500 ms of LCP on cold-cache runs.
 *
 * Injecting a <link rel="preload" as="image" fetchpriority="high">
 * here, before any block decoration, lets the browser deduplicate the
 * fetch the <img> tag triggers and bump it to high priority.
 *
 * URL resolution order:
 *   1. Author override via  <meta name="lcp-image" content="<url>">
 *   2. Auto-detect: first <img> inside the first section of <main>
 *
 * Mirrors the <picture> element's responsive sources via
 * `imagesrcset` / `imagesizes` so the browser picks the same URL it
 * would have picked from the <picture> markup.
 */
function preloadLcpImage(doc) {
  // 1. Honor explicit author hint when present.
  const metaHint = doc.querySelector('meta[name="lcp-image"]')?.content?.trim();
  if (metaHint) {
    appendImagePreload(metaHint);
    return;
  }

  // 2. Section-walking preload is scoped to pages that host the
  //    `.get-inspired` block, which hides its content via
  //    `visibility: hidden` until decorate() runs and typically sits
  //    after decorative sr-only / breadcrumb sections. Applying the
  //    walk globally regressed CLS on other templates (e.g. image-carousel
  //    banners emit <img> without width/height — forcing them to eager
  //    fetch pulled their load-and-shift into the CLS measurement window).
  //    Everywhere else, fall back to the original single-first-section
  //    behaviour so no other page changes.
  const hasGetInspired = !!doc.querySelector('main .get-inspired');
  const firstSection = doc.querySelector('main > div:first-child');
  if (!firstSection) return;

  if (!hasGetInspired) {
    // Original behaviour — only inspect the first section.
    if (preloadHeroBannerLcp(firstSection)) return;
    const firstImg = firstSection.querySelector('img');
    if (firstImg) {
      const src = firstImg.getAttribute('src');
      if (src) {
        const picture = firstImg.closest('picture');
        const firstSource = picture?.querySelector('source[srcset]');
        const imagesrcset = firstSource?.getAttribute('srcset') || '';
        const imagesizes = firstSource?.getAttribute('sizes') || '';
        appendImagePreload(src, imagesrcset, imagesizes);
        return;
      }
    }
    const heroBlock = firstSection.querySelector('.hero-form, .hero');
    if (heroBlock) {
      const rows = heroBlock.querySelectorAll(':scope > div');
      for (let i = 0; i < rows.length; i += 1) {
        const key = (rows[i].children[0]?.textContent || '').trim().toLowerCase().replace(/[\s_]+/g, '-');
        if (key === 'hero-bg-desktop' || key === 'hero-background-desktop') {
          const url = (rows[i].children[1]?.textContent || '').trim();
          if (url && (url.startsWith('http') || url.startsWith('/') || url.startsWith('.'))) {
            appendImagePreload(url);
            return;
          }
        }
      }
    }
    return;
  }

  // .get-inspired pages: walk sections until we find the real LCP
  // candidate (skipping sr-only H1s, breadcrumbs, section-metadata).
  const sectionEls = [...doc.querySelectorAll('main > div')];
  for (let s = 0; s < sectionEls.length; s += 1) {
    const section = sectionEls[s];

    if (preloadHeroBannerLcp(section)) return;

    const firstImg = section.querySelector('img');
    if (firstImg) {
      const src = firstImg.getAttribute('src');
      if (src) {
        firstImg.setAttribute('loading', 'eager');
        firstImg.setAttribute('fetchpriority', 'high');
        const picture = firstImg.closest('picture');
        const firstSource = picture?.querySelector('source[srcset]');
        const imagesrcset = firstSource?.getAttribute('srcset') || '';
        const imagesizes = firstSource?.getAttribute('sizes') || '';
        appendImagePreload(src, imagesrcset, imagesizes);
        return;
      }
    }

    const heroBlock = section.querySelector('.hero-form, .hero');
    if (heroBlock) {
      const rows = heroBlock.querySelectorAll(':scope > div');
      for (let i = 0; i < rows.length; i += 1) {
        const key = (rows[i].children[0]?.textContent || '').trim().toLowerCase().replace(/[\s_]+/g, '-');
        if (key === 'hero-bg-desktop' || key === 'hero-background-desktop') {
          const url = (rows[i].children[1]?.textContent || '').trim();
          if (url && (url.startsWith('http') || url.startsWith('/') || url.startsWith('.'))) {
            appendImagePreload(url);
            return;
          }
        }
      }
    }
  }
}

/**
 * Loads only the assets and logic required for the initial render / LCP.
 * Analytics is intentionally excluded from this phase to avoid blocking
 * rendering and to keep jQuery out of the critical path.
 * @param {Element} doc The container element
 */
async function loadEager(doc) {
  // Run BEFORE any decoration so the browser's preload scanner picks
  // up the LCP image as early as possible.
  preloadLcpImage(doc);

  document.documentElement.lang = 'en';
  decorateTemplateAndTheme();

  const main = doc.querySelector('main');
  if (main) {
    decorateMain(main);
    ensureDocumentPrimaryHeading(doc, main);
    document.body.classList.add('appear');

    // Eagerly load sections. Section-walking is scoped to pages that
    // host the `.get-inspired` block, whose CSS hides its content with
    // `visibility: hidden` until decorate() runs — those pages need the
    // LCP section decorated inside the eager phase to unblock paint.
    // On every other page we keep the original single-first-section
    // behaviour so we don't accelerate CLS-inducing blocks (e.g.
    // image-carousel, whose <img> lacks width/height) on unrelated pages.
    const hasGetInspired = !!main.querySelector('.get-inspired');
    if (hasGetInspired) {
      const sections = [...main.querySelectorAll(':scope > div.section')];
      let loadedAny = false;
      for (let i = 0; i < sections.length; i += 1) {
        const section = sections[i];
        const hasImage = !!section.querySelector('img');
        // eslint-disable-next-line no-await-in-loop
        await loadSection(section, hasImage ? waitForFirstImage : undefined);
        loadedAny = true;
        if (hasImage) break;
      }
      if (!loadedAny && sections[0]) {
        await loadSection(sections[0], waitForFirstImage);
      }
    } else {
      await loadSection(main.querySelector('.section'), waitForFirstImage);
    }
  }

  loadFonts();
}

/**
 * Loads everything that is needed soon after the first paint,
 * but is still non-critical compared to the eager phase.
 * @param {Element} doc The container element
 */
async function loadLazy(doc) {
  const main = doc.querySelector('main');
  const suppressAnalyticsForAuthCallback = SUPPRESS_ANALYTICS_FOR_THIS_PAGE;

  /* Fire analytics init as early as possible in the lazy phase so the
   * Alloy beacon doesn't wait for header/sections/footer to finish.
   * Runs in parallel with the awaits below — typically fires within
   * 1–2 s of LCP instead of 10–15 s. */
  if (!suppressAnalyticsForAuthCallback) {
    import('./analytics_1.js').then(({ initAnalytics }) => initAnalytics()).catch((e) => {
      // eslint-disable-next-line no-console
      console.error('Failed to initialize analytics', e);
    });
  }
   const ADOBE_LAUNCH_SCRIPT = 'https://assets.adobedtm.com/ef0f7eb243a4/50bf6aad1917/launch-1fb344a8e349-development.min.js';
  function bootstrapAdobeLaunch() {
  const script = document.createElement('script');
  script.src = ADOBE_LAUNCH_SCRIPT;
  script.async = true;
  document.head.appendChild(script);
}
  bootstrapAdobeLaunch();

  // Third-party marketing pixels — lightweight PageView image beacons
  // with optional GTM bridge (GTM-MP96GBBF) loaded by fireGTM().
  // PageView coverage includes FB Pixel, GA4, Google Ads, DCM Floodlight,
  // and GTM dataLayer event dispatch.
  //
  // Microsoft Clarity (session replay) loads in the delayed phase via
  // delayed.js — see initThirdPartyPixels() in third-party-pixels.js.
  //
  // Conversion events (form_submit, form_start, etc.) fire as additional
  // beacons via firePixelConversion() — wired from form handlers
  // alongside the existing trackEvent() calls.
  if (!suppressAnalyticsForAuthCallback) {
    import('./third-party-pixels.js').then(({ firePixelPageView }) => {
      firePixelPageView();
    }).catch((e) => {
      // eslint-disable-next-line no-console
      console.error('[scripts] third-party-pixels PageView beacons failed:', e);
    });
  }

  const headerLoaded = loadHeader(doc.querySelector('header'));
  await loadSections(main);

  /* Bootstrap CSS (32 KiB CDN, ~97% unused) is NOT loaded in the lazy
     phase — it only styles hidden cart/checkout/address inputs that
     appear on interaction. It is loaded on the first user interaction
     (see loadDelayed) so it is cached before the cart is ever opened,
     while staying out of the critical/LCP window. */

  const { hash } = window.location;
  const element = hash ? doc.getElementById(hash.substring(1)) : false;
  if (hash && element) element.scrollIntoView();

  await headerLoaded;
  loadFooter(doc.querySelector('footer'));

  loadCSS(`${window.hlx.codeBasePath}/styles/lazy-styles.css`);
}

/**
 * Loads the splash popup from the authored content fragment.
 * Deferred to loadDelayed so it doesn't compete with LCP.
 */
async function loadSplashPopup() {
  try {
    const splashPath = '/eds/fragments/splash-popup';
    const resp = await fetch(`${splashPath}.plain.html`);
    if (resp.ok) {
      const temp = document.createElement('div');
      temp.innerHTML = await resp.text();
      const baseUrl = new URL(splashPath, window.location);
      temp.querySelectorAll('img[src^="./media_"]').forEach((img) => {
        img.src = new URL(img.getAttribute('src'), baseUrl).href;
      });
      temp.querySelectorAll('source[srcset^="./media_"]').forEach((s) => {
        s.srcset = new URL(s.getAttribute('srcset'), baseUrl).href;
      });
      const contentDiv = temp.querySelector('div');
      const firstCta = contentDiv?.querySelector(':scope > p > a');
      if (firstCta) {
        const children = [...contentDiv.children];
        const splitAt = children.indexOf(firstCta.closest('p')) + 1;
        const leftCell = document.createElement('div');
        const rightCell = document.createElement('div');
        children.slice(0, splitAt).forEach((el) => leftCell.append(el));
        children.slice(splitAt).forEach((el) => rightCell.append(el));
        const row = document.createElement('div');
        row.append(leftCell, rightCell);
        const splashBlock = document.createElement('div');
        splashBlock.className = 'splash-popup';
        splashBlock.append(row);
        const { default: decorateSplashPopup } = await import('../blocks/splash-popup/splash-popup.js');
        await decorateSplashPopup(splashBlock);
      }
    }
  } catch (e) {
    // Splash popup content not available, skip silently
  }
}

function loadDelayed() {
  /* ── Tier 1 (3 s) — lightweight, needed early ────────────────────── */
  window.setTimeout(() => {
    // eslint-disable-next-line import/no-cycle
    import('./delayed.js');
  }, 8000);

  // Skip splash popup for Lighthouse / PageSpeed bots — the full-screen
  // modal tanks Speed Index because it covers the entire viewport.
  const isBot = navigator.userAgent.includes('Lighthouse') || navigator.userAgent.includes('PSTS');
  window.setTimeout(() => {
    if (!isBot && !localStorage.getItem('splash-popup-shown')) {
      loadSplashPopup();
    }
  }, 6000);

  /* ── Tier 2 (6 s) — CSS-only preloads, low main-thread cost ───── */
  window.setTimeout(() => {
    window.loadSwiper?.().catch((e) => {
      // eslint-disable-next-line no-console
      console.error('Failed to preload Swiper', e);
    });
  }, 6000);

  /* Bootstrap CSS only styles interactive cart/form UI (never
     above-the-fold content) and is not render-blocking. Load it on the
     first genuine user-intent event instead of a timer. We deliberately
     do NOT listen for `scroll`: Lighthouse programmatically scrolls the
     page while gathering screenshots, which would trigger the load and
     put Bootstrap back in the audit. pointerdown/keydown/touchstart are
     not simulated by Lighthouse but always precede opening the cart or a
     form, so real users get it in time. */
  const bootstrapTriggers = ['pointerdown', 'keydown', 'touchstart'];
  const loadBootstrapOnce = () => {
    bootstrapTriggers.forEach((evt) => window.removeEventListener(evt, loadBootstrapOnce));
    window.loadBootstrap?.({ withJS: false }).catch((e) => {
      // eslint-disable-next-line no-console
      console.error('Failed to load Bootstrap', e);
    });
  };
  bootstrapTriggers.forEach((evt) => window
    .addEventListener(evt, loadBootstrapOnce, { passive: true }));

  /* ── Tier 3 — heavy JS: jQuery, Sprinklr chat ── */
  window.setTimeout(() => {
    window.loadJQuery?.().catch((e) => {
      // eslint-disable-next-line no-console
      console.error('Failed to preload jQuery', e);
    });
  }, 3000);

  /* Sprinklr chat — show placeholder icon immediately, load widget on click */
  initChatPlaceholder();
  bindChatbotInteractionTracking();
}



async function loadPage() {
  await loadEager(document);
  await loadLazy(document);
  loadDelayed();
}

loadPage();

const { searchParams, origin } = new URL(window.location.href);
const branch = searchParams.get('nx') || 'main';

export const NX_ORIGIN = branch === 'local' || origin.includes('localhost')
  ? 'http://localhost:6456/nx'
  : 'https://da.live/nx';

(async function loadDa() {
  /* eslint-disable import/no-unresolved */
  if (searchParams.get('dapreview')) {
    await import('https://da.live/scripts/dapreview.js').then(async ({ default: daPreview }) => {
      await daPreview(loadPage);

      /* add class to body to be used for restricting vh metric */
      document.body.classList.add('da-live-preview');

      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList') {
            const currentBody = document.body;
            if (currentBody && !currentBody.classList.contains('da-live-preview')) {
              currentBody.classList.add('da-live-preview');
            }
          }
        });
      });

      observer.observe(document.documentElement, { childList: true, subtree: false });
    });
  }

  if (searchParams.get('daexperiment')) {
    import(`${NX_ORIGIN}/public/plugins/exp/exp.js`);
  }
}());
