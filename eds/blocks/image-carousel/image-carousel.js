const VERSION = 'image-carousel@v6 (per-slide title, subtitle, text and CTA alignment)';

/*
** Authoring format **

Config rows (Col 1 → key, Col 2 → value)
autoplay  → true / false
interval  → slide interval in ms (min 1000)
Overlay breadcrumb → true / false, default false. Overlays the breadcrumb block from
                     the same section on top of the banner (desktop only)
Title heading → h1 … h6, default h2. Heading level of the slide titles
Mobile max width → widest viewport (px) that shows the mobile image, default 767

Header row (optional). Its labels pick the column of each value, so columns
can be reordered or left out; without it the order below is used.
Desktop image | Mobile image | Redirection link | CTA Label | Open in new tab | CTA alignment
| Title | Subtitle | Text alignment

Slide rows (one per slide)
Col 1 → Desktop image (picture)
Col 2 → Mobile image (picture), used at ≤ 767px; falls back to desktop
Col 3 → Redirection link (text or link), optional.
        With a link the slide is clickable; without one, no hand cursor.
Col 4 → CTA Label, optional. Shown as a button over the slide when a
        redirection link is set.
Col 5 → Open in new tab (true / false), optional, default false
Col 6 → CTA alignment (left / center / right), optional, default center
Col 7 → Title, optional. Live text over the image (use a plain image)
Col 8 → Subtitle, optional. Line breaks (Shift+Enter) are kept
Col 9 → Text alignment (left / center / right), optional, default center.
        Places the title / subtitle / CTA box on the banner and aligns its text.
        With a title or subtitle the CTA sits under them (also on mobile);
        without them the CTA keeps its desktop-only spot on the image.
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

const CTA_ALIGNMENTS = ['left', 'center', 'right'];

function ctaAlignment(val) {
  const v = String(val || '').trim().toLowerCase();
  return CTA_ALIGNMENTS.includes(v) ? v : 'center';
}

function escapeHTML(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Slide columns in their default order; a header row with these labels overrides it
const SLIDE_COLUMNS = {
  'desktop image': 'desktopPic',
  'mobile image': 'mobilePic',
  'redirection link': 'link',
  'cta label': 'ctaLabel',
  'open in new tab': 'newTab',
  'cta alignment': 'ctaAlign',
  title: 'title',
  subtitle: 'subtitle',
  'text alignment': 'textAlign',
};
const DEFAULT_COLUMNS = Object.values(SLIDE_COLUMNS);

// Authored copy of a cell: paragraphs joined by line breaks, keeping <br>,
// bold and italic; any other markup is reduced to its text.
function cellInlineHTML(cell) {
  if (!cell) return '';
  const inline = (node) => [...node.childNodes].map((n) => {
    if (n.nodeType === Node.TEXT_NODE) return escapeHTML(n.textContent);
    if (n.nodeType !== Node.ELEMENT_NODE) return '';
    const tag = n.tagName.toLowerCase();
    if (tag === 'br') return '<br>';
    if (['strong', 'b', 'em', 'i'].includes(tag)) return `<${tag}>${inline(n)}</${tag}>`;
    return inline(n);
  }).join('');
  const paras = cell.querySelector(':scope > p') ? qsa(cell, ':scope > p') : [cell];
  return paras.map((p) => inline(p).replace(/\s+/g, ' ').trim()).filter(Boolean).join('<br>');
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
    breadcrumb: false,
    clickable: false,
    ctaLink: '',
    overlaySubtitle: '',
    overlayTitle: '',
    titleHeading: 'h2',
    // slide rows authored as pictures: { desktopPic, mobilePic, link, ... }
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

  let columns = DEFAULT_COLUMNS;

  readRows().forEach((cells) => {
    // Header row: maps each slide field to its column
    const labels = cells.map((c) => cellText(c).toLowerCase());
    if (labels[0] === 'desktop image') {
      columns = labels.map((l) => SLIDE_COLUMNS[l] || '');
      return;
    }

    // Slide row: Desktop image | Mobile image | Redirection link | CTA Label
    //   | Open in new tab | CTA alignment | Title | Subtitle | Text alignment
    if (cells.some((c) => c.querySelector('picture, img'))) {
      const getPic = (c) => c?.querySelector('picture') || c?.querySelector('img');
      const col = (field) => {
        const i = columns.indexOf(field);
        return i < 0 ? null : cells[i];
      };
      cfg.slides.push({
        desktopPic: getPic(col('desktopPic')),
        mobilePic: getPic(col('mobilePic')),
        link: cellHrefOrText(col('link')),
        ctaLabel: cellText(col('ctaLabel')),
        newTab: yesNo(cellText(col('newTab')), false),
        ctaAlign: ctaAlignment(cellText(col('ctaAlign'))),
        title: cellInlineHTML(col('title')),
        subtitle: cellInlineHTML(col('subtitle')),
        textAlign: ctaAlignment(cellText(col('textAlign'))),
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
    if (key === 'overlay breadcrumb' || key === 'breadcrumb') cfg.breadcrumb = yesNo(valText, false);
    if (key === 'clickable') cfg.clickable = yesNo(valText, false);
    if (key === 'ctalink') cfg.ctaLink = valHrefOrText;
    if (key === 'overlaysubtitle') cfg.overlaySubtitle = valText;
    if (key === 'overlaytitle') cfg.overlayTitle = valText;
    if (key === 'title heading' && /^h[1-6]$/i.test(valText)) cfg.titleHeading = valText.toLowerCase();

    // optional breakpoint override
    if (key.replace(/\s+/g, '') === 'mobilemaxwidth') {
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
  if (cfg.breadcrumb) block.classList.add('breadcrumb-overlay');

  const overlay = overlayHTML(cfg);

  const slidesHTML = slides.map((s, i) => {
    const pic = (s.desktopPic || s.mobilePic)
      ? buildAuthoredPictureHTML(s.desktopPic, s.mobilePic, cfg.mobileMaxWidth, i === 0)
      : buildPictureHTML(s.desktop, s.mobile, cfg.mobileMaxWidth, i === 0);

    // Redirection link is optional per slide: a slide with a link renders as
    // <a> (hand cursor), one without stays a plain <div>. No "clickable"
    // row is needed; it only remains for old pages using the legacy ctaLink.
    const href = s.link || (cfg.clickable ? cfg.ctaLink : '');

    const target = href && s.newTab ? ' target="_blank" rel="noopener noreferrer"' : '';
    const wrapStart = href
      ? `<a class="full-banner-click" href="${href}"${target}>`
      : '<div class="full-banner-click">';

    // CTA sits inside the slide link (a nested <a> is invalid), so it is a
    // button-styled span and the whole slide stays clickable.
    const ctaAlign = s.ctaAlign || 'center';
    const ctaPill = href && s.ctaLabel
      ? `<span class="carousel__cta">${escapeHTML(s.ctaLabel)}<span class="carousel__cta-arrow" aria-hidden="true"></span></span>`
      : '';

    // Live title / subtitle over a plain image, with the CTA under them;
    // without them the CTA keeps its own spot (copy is part of the image)
    let text = '';
    let cta = ctaPill ? `<div class="carousel__cta-wrap carousel__cta-wrap--${ctaAlign}">${ctaPill}</div>` : '';
    if (s.title || s.subtitle) {
      const tag = cfg.titleHeading;
      text = `
        <div class="carousel__text carousel__text--${s.textAlign || 'center'}">
          <div class="carousel__text-box">
            ${s.title ? `<${tag} class="carousel__title">${s.title}</${tag}>` : ''}
            ${s.subtitle ? `<p class="carousel__subtitle">${s.subtitle}</p>` : ''}
            ${ctaPill ? `<div class="carousel__text-cta carousel__text-cta--${ctaAlign}">${ctaPill}</div>` : ''}
          </div>
        </div>`;
      cta = '';
    }

    const wrapEnd = href ? '</a>' : '</div>';

    return `
      <div class="swiper-slide carousel__slide" data-i="${i}">
        <div class="bannerImgWithLeftTextComp bannerWithGreybackground">
          ${wrapStart}
            <div class="prodBannerImage">${pic}${text}</div>
            ${overlay}
            ${cta}
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
