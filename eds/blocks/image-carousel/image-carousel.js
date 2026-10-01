const VERSION = 'image-carousel@v4 (desktopImage+mobileImage comma lists, responsive picture)';

/*
** Authoring format **

Config rows (Col 1 → key, Col 2 → value)
autoplay  → true / false
interval  → slide interval in ms (min 1000)

Header row (ignored by code)
Desktop image | Mobile image | Redirection link

Slide rows (one per slide)
Col 1 → Desktop image (picture)
Col 2 → Mobile image (picture), used at ≤ 767px; falls back to desktop
Col 3 → Redirection link (text or link), optional.
        With a link the slide is clickable; without one, no hand cursor.
*/

// Right-pointing arrow; the prev button mirrors it via CSS
const ARROW_SVG = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false"><path d="M2 8h12M9 3l5 5-5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function qsa(el, sel) { return [...el.querySelectorAll(sel)]; }
function qs(el, sel) { return el.querySelector(sel); }

function cellText(cell) {
  return (cell?.textContent || '').replace(/\s+/g, ' ').trim();
}

function cellHrefOrText(cell) {
  const a = cell?.querySelector?.('a[href]');
  if (a?.getAttribute('href')) return a.getAttribute('href').trim();
  return cellText(cell);
}

function yesNo(val, def = false) {
  const v = String(val || '').trim().toLowerCase();
  if (v === 'yes' || v === 'true') return true;
  if (v === 'no' || v === 'false') return false;
  return def;
}

function splitUrls(raw) {
  return String(raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseConfig(block) {
  const cfg = {
    autoplay: true,
    interval: 5000,
    fade: false,
    clickable: false,
    ctaLink: '',
    overlaySubtitle: '',
    overlayTitle: '',
    // slide rows authored as pictures: { desktopPic, mobilePic, link }
    slides: [],
    // legacy URL lists
    desktopImages: [],
    mobileImages: [],
    // optional breakpoint (defaults to 767)
    mobileMaxWidth: 767,
    debug: { parsed: [] },
  };

  // ---- support both table-based and div-based structures ----
  const tableRows = qsa(block, 'tr');
  const usingTable = tableRows.length > 0;

  const readRows = () => {
    if (usingTable) {
      // Skip header row
      return tableRows.slice(1).map((tr) => qsa(tr, 'th, td')).filter((cells) => cells.length >= 2);
    }

    // div-based (EDS-transformed) structure:
    const direct = qsa(block, ':scope > div');
    const wrapper = (direct.length === 1) ? direct[0] : null;
    const candidates = wrapper ? qsa(wrapper, ':scope > div') : direct;

    return candidates
      .filter((r) => r.children && r.children.length >= 2)
      .map((r) => [...r.children]);
  };

  readRows().forEach((cells) => {
    // Slide row: Desktop image | Mobile image | Redirection link
    if (cells.some((c) => c.querySelector('picture, img'))) {
      const getPic = (c) => c?.querySelector('picture') || c?.querySelector('img');
      cfg.slides.push({
        desktopPic: getPic(cells[0]),
        mobilePic: getPic(cells[1]),
        link: cellHrefOrText(cells[2]),
      });
      return;
    }

    const key = cellText(cells[0]).toLowerCase();
    const valText = cellText(cells[1]);
    const valHrefOrText = cellHrefOrText(cells[1]);

    cfg.debug.parsed.push({ key, valText, valHrefOrText });

    if (key === 'autoplay') cfg.autoplay = yesNo(valText, true);
    if (key === 'interval') {
      const n = Number(valText);
      if (!Number.isNaN(n) && n >= 1000) cfg.interval = n;
    }
    if (key === 'fade') cfg.fade = yesNo(valText, false);
    if (key === 'clickable') cfg.clickable = yesNo(valText, false);
    if (key === 'ctalink') cfg.ctaLink = valHrefOrText;
    if (key === 'overlaysubtitle') cfg.overlaySubtitle = valText;
    if (key === 'overlaytitle') cfg.overlayTitle = valText;

    // optional breakpoint override
    if (key === 'mobilemaxwidth') {
      const n = Number(valText);
      if (!Number.isNaN(n) && n >= 320) cfg.mobileMaxWidth = n;
    }

    // ✅ NEW KEYS
    if (key === 'desktopimage') cfg.desktopImages.push(...splitUrls(valHrefOrText || valText));
    if (key === 'mobileimage') cfg.mobileImages.push(...splitUrls(valHrefOrText || valText));

    // Backward compat: old "image" behaves as desktopImage
    if (key === 'image') cfg.desktopImages.push(...splitUrls(valHrefOrText || valText));
  });

  // De-dupe preserving order
  cfg.desktopImages = [...new Set(cfg.desktopImages)];
  cfg.mobileImages = [...new Set(cfg.mobileImages)];

  return cfg;
}

function overlayHTML(cfg) {
  if (!cfg.overlaySubtitle && !cfg.overlayTitle) return '';
  return `
    <div class="bannerTextDesc">
      ${cfg.overlaySubtitle ? `<p>${cfg.overlaySubtitle}</p>` : ''}
      ${cfg.overlayTitle ? `<h2>${cfg.overlayTitle}</h2>` : ''}
    </div>
  `;
}

function buildPictureHTML(desktopUrl, mobileUrl, mobileMaxWidth, eager) {
  // Use <picture> so browser picks correct source automatically
  // mobileUrl optional; fallback to desktopUrl if missing
  const mob = mobileUrl || desktopUrl;
  const load = eager ? 'eager' : 'lazy';
  return `
    <picture>
      <source media="(max-width: ${mobileMaxWidth}px)" srcset="${mob}">
      <img src="${desktopUrl}" alt="" loading="${load}">
    </picture>
  `;
}

function buildAuthoredPictureHTML(desktopPic, mobilePic, mobileMaxWidth, eager) {
  // Reuse the optimized <picture> authored in DA; add the mobile image as
  // sources scoped to the mobile breakpoint so the browser picks it there.
  const base = desktopPic || mobilePic;
  const pic = base.tagName === 'PICTURE' ? base.cloneNode(true) : document.createElement('picture');
  if (base.tagName !== 'PICTURE') pic.append(base.cloneNode(true));

  if (desktopPic && mobilePic) {
    const media = `(max-width: ${mobileMaxWidth}px)`;
    const mobileImg = mobilePic.tagName === 'IMG' ? mobilePic : mobilePic.querySelector('img');
    const mobileWebp = mobilePic.querySelector?.('source[type="image/webp"]:not([media])');
    const newSources = [];
    if (mobileWebp) {
      const s = document.createElement('source');
      s.type = 'image/webp';
      s.media = media;
      s.srcset = mobileWebp.getAttribute('srcset');
      newSources.push(s);
    }
    if (mobileImg?.getAttribute('src')) {
      const s = document.createElement('source');
      s.media = media;
      s.srcset = mobileImg.getAttribute('src');
      newSources.push(s);
    }
    pic.prepend(...newSources);
  }

  const img = pic.querySelector('img');
  if (img) img.loading = eager ? 'eager' : 'lazy';
  return pic.outerHTML;
}

function getSwiperClass() {
  if (window.Swiper) return Promise.resolve(window.Swiper);
  if (window.loadSwiper) return window.loadSwiper().catch(() => null);
  return Promise.resolve(null);
}

export default async function decorate(block) {
  const cfg = parseConfig(block);

  // Compute slides: authored picture rows first, legacy URL lists as fallback
  const slides = cfg.slides.length
    ? cfg.slides
    : cfg.desktopImages.map((d, i) => ({
      desktop: d,
      mobile: cfg.mobileImages[i] || '',
      link: '',
    }));

  if (!slides.length) {
    const parsed = cfg.debug.parsed
      .map((r) => `${r.key}: text="${r.valText}" hrefOrText="${r.valHrefOrText}"`)
      .join('\n');

    block.innerHTML = `
      <pre style="white-space:pre-wrap;background:#fff3cd;padding:12px;border:1px solid #ffeeba;border-radius:8px;">
${VERSION}
No slides configured because I could not read any URLs from "desktopImage" (or legacy "image").

What I parsed from your table rows:
${parsed}

Expected one row per slide:
Desktop image (picture) | Mobile image (picture) | Redirection link

or (legacy):
desktopImage | https://.../banner-desktop.png
mobileImage  | https://.../banner-mobile.png
(comma-separated lists allowed)
      </pre>
    `;
    return;
  }

  block.classList.add('image-carousel');
  if (cfg.fade) block.classList.add('carousel--fade');

  const overlay = overlayHTML(cfg);

  const slidesHTML = slides.map((s, i) => {
    const pic = (s.desktopPic || s.mobilePic)
      ? buildAuthoredPictureHTML(s.desktopPic, s.mobilePic, cfg.mobileMaxWidth, i === 0)
      : buildPictureHTML(s.desktop, s.mobile, cfg.mobileMaxWidth, i === 0);

    // Redirection link is optional per slide: a slide with a link renders as
    // <a> (hand cursor), one without stays a plain <div>. No "clickable"
    // row is needed; it only remains for old pages using the legacy ctaLink.
    const href = s.link || (cfg.clickable ? cfg.ctaLink : '');

    const wrapStart = href
      ? `<a class="full-banner-click" href="${href}">`
      : `<div class="full-banner-click">`;

    const wrapEnd = href ? `</a>` : `</div>`;

    return `
      <div class="swiper-slide carousel__slide" data-i="${i}">
        <div class="bannerImgWithLeftTextComp bannerWithGreybackground">
          ${wrapStart}
            <div class="prodBannerImage">${pic}</div>
            ${overlay}
          ${wrapEnd}
        </div>
      </div>
    `;
  }).join('');

  block.innerHTML = `
    <div class="carousel__wrap">
      <div class="swiper carousel__viewport" role="region" aria-roledescription="carousel">
        <div class="swiper-wrapper carousel__track">${slidesHTML}</div>
      </div>
      <div class="carousel__controls">
        <button class="carousel__nav carousel__prev" type="button" aria-label="Previous">${ARROW_SVG}</button>
        <div class="carousel__dots"></div>
        <button class="carousel__nav carousel__next" type="button" aria-label="Next">${ARROW_SVG}</button>
      </div>
      <div style="display:none">${VERSION}</div>
    </div>
  `;

  // Single slide: static banner, no Swiper, no arrows/dots
  if (slides.length <= 1) {
    qs(block, '.carousel__controls')?.remove();
    return;
  }

  // Static dots so the pill looks complete before Swiper loads;
  // Swiper's pagination re-renders them on init.
  const dotsEl = qs(block, '.carousel__dots');
  dotsEl.innerHTML = slides.map((_, i) => `<button class="carousel__dot${i === 0 ? ' is-active' : ''}" type="button" aria-label="Go to slide ${i + 1}"></button>`).join('');

  /* Defer Swiper load + init until first user interaction (same approach as
   * carousel-hero-banner). The first slide is already painted as plain HTML,
   * so swiper.js stays out of the Lighthouse window and doesn't add TBT.
   * A 25 s fallback starts autoplay for passive visitors. */
  let pendingAction = null;
  const prevEl = qs(block, '.carousel__prev');
  const nextEl = qs(block, '.carousel__next');
  const rememberClick = (e) => {
    if (e.target.closest('.carousel__prev')) pendingAction = (sw) => sw.slidePrev();
    else if (e.target.closest('.carousel__next')) pendingAction = (sw) => sw.slideNext();
    else {
      const dot = e.target.closest('.carousel__dot');
      if (dot) {
        const i = [...dotsEl.children].indexOf(dot);
        pendingAction = (sw) => sw.slideTo(i);
      }
    }
  };
  const controlsEl = qs(block, '.carousel__controls');
  controlsEl.addEventListener('click', rememberClick);

  let triggered = false;
  const initSwiper = async () => {
    if (triggered) return;
    triggered = true;

    const Swiper = await getSwiperClass();
    if (!Swiper) return;

    const swiper = new Swiper(qs(block, '.carousel__viewport'), {
      slidesPerView: 1,
      // rewind instead of loop: loop is unreliable with only 2 slides
      rewind: true,
      speed: 350,
      ...(cfg.fade ? { effect: 'fade', fadeEffect: { crossFade: true } } : {}),
      autoplay: cfg.autoplay
        ? { delay: cfg.interval, disableOnInteraction: true }
        : false,
      navigation: { prevEl, nextEl },
      pagination: {
        el: dotsEl,
        clickable: true,
        bulletClass: 'carousel__dot',
        bulletActiveClass: 'is-active',
        renderBullet: (i, className) => `<button class="${className}" type="button" aria-label="Go to slide ${i + 1}"></button>`,
      },
    });

    // Replay an arrow/dot click that happened before Swiper was ready
    controlsEl.removeEventListener('click', rememberClick);
    if (pendingAction) {
      swiper.autoplay?.stop();
      pendingAction(swiper);
    }
  };

  ['pointerdown', 'keydown', 'scroll', 'touchstart', 'wheel'].forEach((evt) => {
    window.addEventListener(evt, initSwiper, { once: true, passive: true, capture: true });
  });
  window.setTimeout(initSwiper, 25000);
}
