import { triggerCTAClickWithLinkAndTitle } from '../../scripts/analytics_1.js';

/**
 * Returns the section-level title (h2 in the .section wrapper) for the
 * "Explore Beyond Colours" banner, falling back to the nearest h3 inside
 * the block (i.e. "Textures" / "Wallpapers") when no section h2 exists.
 */
function getSectionOrNearestHeadingTitle(cta, block) {
  // 1. Prefer an h2 in the enclosing .section (e.g. "Explore Beyond Colours")
  const section = cta.closest('.section');
  if (section) {
    const sectionH2 = section.querySelector(':scope > h2, :scope > .default-content-wrapper h2');
    if (sectionH2?.textContent?.trim()) return sectionH2.textContent.trim();
  }

  // 2. Walk up to block boundary looking for a direct-child h3
  let scope = cta.parentElement;
  while (scope && scope !== block) {
    const scopedHeading = scope.querySelector(':scope > h3');
    if (scopedHeading?.textContent?.trim()) {
      return scopedHeading.textContent.trim();
    }
    scope = scope.parentElement;
  }

  // 3. Nearest preceding h3 in the block
  const headings = [...block.querySelectorAll('h3')].reverse();
  const nearest = headings.find((heading) => {
    const relation = heading.compareDocumentPosition(cta);
    return (relation & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
  });
  return nearest?.textContent?.trim() || 'Explore Split';
}

function getExploreSplitParentTitle(cta, block) {
  const splitColumn = cta.closest('.textures-desktop, .textures-mobile, .wallpapers-desktop, .wallpapers-mobile');
  if (splitColumn) {
    const columnHeading = splitColumn.querySelector(':scope > h3');
    const headingId = (columnHeading?.id || '').trim().toLowerCase();
    const headingText = (columnHeading?.textContent || '').trim().toLowerCase();

    if (headingId.includes('texture') || headingText.includes('texture')) return 'textures';
    if (headingId.includes('wallpaper') || headingText.includes('wallpaper')) return 'wallpapers';
  }

  const fallbackTitle = getSectionOrNearestHeadingTitle(cta, block);
  const normalized = fallbackTitle.toLowerCase();
  if (normalized.includes('texture')) return 'textures';
  if (normalized.includes('wallpaper')) return 'wallpapers';
  return fallbackTitle;
}

function bindViewAllTracking(block) {
  block.querySelectorAll('.button-container a.button').forEach((cta) => {
    if (cta.dataset.exploreSplitAnalyticsBound === 'true') return;

    const buttonText = (cta.textContent || '').trim().toLowerCase();
    if (!buttonText.startsWith('view all')) return;

    cta.dataset.exploreSplitAnalyticsBound = 'true';
    cta.dataset.analyticsBound = 'true';
    cta.addEventListener('click', () => {
      const ctaLink = cta.getAttribute('href') || '';
      // eVar45 (cta_): use the actual button text ("View All"), not the heading id slug
      const btnTitle = cta.textContent.trim();
      // eVar67 (parentTitle): derive from the clicked split column context.
      const parentTitle = getExploreSplitParentTitle(cta, block);

      triggerCTAClickWithLinkAndTitle(ctaLink, btnTitle, parentTitle);
    });
  });
}

function debounce(fn, delay = 150) {
  let timer;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), delay);
  };
}

export default function decorate(block) {
  bindViewAllTracking(block);

  const section = block.closest('.section');
  if (section) section.classList.add('explore-split-wrapper');

  const rows = [...block.children];
  if (rows.length < 1) return;

  const desktopRow = rows[0] || null;
  const mobileRow = rows[1] || null;

  const isDesktop = window.matchMedia('(min-width: 992px)').matches;
  const isMobile = window.matchMedia('(max-width: 991px)').matches;

  /* ---------------- DESKTOP ---------------- */

  if (isDesktop && desktopRow) {
    const desktopCols = [...desktopRow.children];
    if (desktopCols.length < 2) return;

    const texturesHeadingCol = desktopCols[0];
    const texturesImagesCol = desktopCols[1];

    desktopRow.classList.add('explore-split-desktop');
    texturesHeadingCol.classList.add('textures-desktop');
    texturesImagesCol.classList.add('wallpapers-desktop');

    const paragraphs = texturesHeadingCol.querySelectorAll('p');
    paragraphs.forEach((p, index) => {
      p.classList.add(`img-${index + 1}`);
    });

    if (mobileRow) mobileRow.remove();
  }

  /* ---------------- MOBILE ---------------- */

  if (isMobile && mobileRow) {
    const mobileCols = [...mobileRow.children];
    if (mobileCols.length < 2) return;

    const texturesCol = mobileCols[0];
    const wallpapersCol = mobileCols[1];

    mobileRow.classList.add('explore-split-mobile');
    texturesCol.classList.add('textures-mobile');
    wallpapersCol.classList.add('wallpapers-mobile');

    const paragraphs = texturesCol.querySelectorAll('p');
    paragraphs.forEach((p, index) => {
      p.classList.add(`img-${index + 1}`);
    });

    const texturesTab = texturesCol.querySelector('h3');
    const wallpapersTab = wallpapersCol.querySelector('h3');
    if (!texturesTab || !wallpapersTab) return;

    /* Tabs */
    const tabsNav = document.createElement('div');
    tabsNav.className = 'explore-mobile-tabs';

    const texturesTabClone = texturesTab.cloneNode(true);
    const wallpapersTabClone = wallpapersTab.cloneNode(true);

    tabsNav.append(texturesTabClone, wallpapersTabClone);
    mobileRow.insertBefore(tabsNav, mobileRow.firstChild);

    wallpapersCol.style.display = 'none';
    texturesCol.style.display = 'block';
    texturesTabClone.classList.add('active');

    texturesTabClone.addEventListener('click', () => {
      texturesCol.style.display = 'block';
      wallpapersCol.style.display = 'none';

      texturesTabClone.classList.add('active');
      wallpapersTabClone.classList.remove('active');

      runLayout(texturesCol);
    });

    wallpapersTabClone.addEventListener('click', () => {
      texturesCol.style.display = 'none';
      wallpapersCol.style.display = 'grid';

      wallpapersTabClone.classList.add('active');
      texturesTabClone.classList.remove('active');
    });

    if (desktopRow) desktopRow.remove();

    /* INIT */
    runLayout(texturesCol);

    const debouncedResize = debounce(() => {
      if (texturesCol.style.display !== 'none') {
        runLayout(texturesCol);
      }
    }, 150);

    window.addEventListener('resize', debouncedResize);
  }
}

/* ---------------- MASTER RUNNER ---------------- */

function runLayout(container) {
  waitForImages(container, () => {
    requestAnimationFrame(() => {
      applyTextureLayout(container);
    });
  });
}

/* ---------------- IMAGE LOAD HELPER ---------------- */

function waitForImages(container, callback) {
  const images = container.querySelectorAll('img');

  if (!images.length) {
    callback();
    return;
  }

  let loaded = 0;
  const done = () => {
    loaded += 1;
    if (loaded === images.length) callback();
  };

  images.forEach((img) => {
    if (img.complete && img.naturalHeight > 0) {
      done();
    } else {
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
    }
  });
}

/* ---------------- LAYOUT ---------------- */

function applyTextureLayout(container) {
  if (!container) return;

  const items = container.querySelectorAll('p:not(.button-container)');
  if (items.length < 4) return;

  const img1 = items[0];
  const img2 = items[1];
  const img3 = items[2];
  const img4 = items[3];

  const gap = 12;

  /* Reset all writes first */
  img1.style.top = '0px';
  img2.style.top = '0px';
  img3.style.top = '0px';
  img4.style.top = '0px';

  /* Read sizes once, after reset */
  const h1 = getStableHeight(img1);
  const h2 = getStableHeight(img2);
  const h3 = getStableHeight(img3);
  const h4 = getStableHeight(img4);

  /* Apply final writes */
  img3.style.top = `${h1 + gap}px`;
  img4.style.top = `${h2 + gap}px`;

  const totalHeight = Math.max(
    h1 + h3 + gap,
    h2 + h4 + gap
  );

  if (totalHeight > 0) {
    container.style.minHeight = `${totalHeight}px`;
  }
}

/* ---------------- HEIGHT HELPER ---------------- */

function getStableHeight(el) {
  if (!el) return 0;

  const img = el.querySelector('img');
  if (!img) return 0;

  const renderedWidth = img.offsetWidth;
  const naturalWidth = img.naturalWidth;
  const naturalHeight = img.naturalHeight;

  if (renderedWidth > 0 && naturalWidth > 0 && naturalHeight > 0) {
    return Math.round((renderedWidth / naturalWidth) * naturalHeight);
  }

  return img.offsetHeight || 0;
}