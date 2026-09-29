const VERSION = 'image-carousel@v4 (desktopImage+mobileImage comma lists, responsive picture)';

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
    // new
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
      .map((r) => [...r.children].slice(0, 2));
  };

  readRows().forEach((cells) => {
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

export default function decorate(block) {
  const cfg = parseConfig(block);

  // Compute slides: based on desktopImages list (primary)
  const slides = cfg.desktopImages.map((d, i) => ({
    desktop: d,
    mobile: cfg.mobileImages[i] || '',
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

Expected:
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

  const dotsHTML = slides.map((_, i) =>
    `<button class="carousel__dot" type="button" aria-label="Go to slide ${i + 1}" data-i="${i}"></button>`
  ).join('');

  const slidesHTML = slides.map((s, i) => {
    const pic = buildPictureHTML(s.desktop, s.mobile, cfg.mobileMaxWidth, i === 0);

    const wrapStart = (cfg.clickable && cfg.ctaLink)
      ? `<a class="full-banner-click" href="${cfg.ctaLink}">`
      : `<div class="full-banner-click">`;

    const wrapEnd = (cfg.clickable && cfg.ctaLink) ? `</a>` : `</div>`;

    return `
      <li class="carousel__slide" data-i="${i}">
        <div class="bannerImgWithLeftTextComp bannerWithGreybackground">
          ${wrapStart}
            <div class="prodBannerImage">${pic}</div>
            ${overlay}
          ${wrapEnd}
        </div>
      </li>
    `;
  }).join('');

  block.innerHTML = `
    <div class="carousel__wrap">
      <button class="carousel__nav carousel__prev" type="button" aria-label="Previous">‹</button>
      <div class="carousel__viewport" role="region" aria-roledescription="carousel">
        <ul class="carousel__track">${slidesHTML}</ul>
      </div>
      <button class="carousel__nav carousel__next" type="button" aria-label="Next">›</button>
      <div class="carousel__dots">${dotsHTML}</div>
      <div style="display:none">${VERSION}</div>
    </div>
  `;

  const track = qs(block, '.carousel__track');
  const slideEls = qsa(block, '.carousel__slide');
  const dotEls = qsa(block, '.carousel__dot');
  const prev = qs(block, '.carousel__prev');
  const next = qs(block, '.carousel__next');
  const dotsWrap = qs(block, '.carousel__dots');


  if (slideEls.length <= 1) {
    if (dotsWrap) dotsWrap.style.display = 'none';
    if (prev) prev.style.display = 'none';
    if (next) next.style.display = 'none';
    // optional: stop autoplay even if enabled
    // cfg.autoplay = false;
  }


  let idx = 0;
  let timer = null;

  function setActive(i) {
    idx = (i + slideEls.length) % slideEls.length;

    if (!cfg.fade) {
      track.style.transform = `translateX(${-idx * 100}%)`;
    } else {
      slideEls.forEach((s, si) => { s.style.display = si === idx ? 'block' : 'none'; });
    }
    dotEls.forEach((d, di) => d.classList.toggle('is-active', di === idx));
  }

  function stop() { if (timer) clearInterval(timer); timer = null; }
  function start() {
    if (!cfg.autoplay || slideEls.length <= 1) return;
    stop();
    timer = setInterval(() => setActive(idx + 1), cfg.interval);
  }

  prev.addEventListener('click', () => { stop(); setActive(idx - 1); });
  next.addEventListener('click', () => { stop(); setActive(idx + 1); });
  dotEls.forEach((d) =>
    d.addEventListener('click', () => { stop(); setActive(Number(d.dataset.i)); })
  );

  setActive(0);
  start();
}
