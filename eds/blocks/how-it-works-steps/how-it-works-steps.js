/**
 * How It Works Steps Block (EDS)
 * - Row 1: Title | Desktop Image | (Optional) Mobile Image
 * - Next rows: Step title | Step description
 */
export default function decorate(block) {
  const rows = Array.from(block.children);

  block.innerHTML = '';
  block.classList.add('how-works-container', 'focus-visible-auto-imp');
  block.setAttribute('tabindex', '0');
  block.setAttribute('aria-label', 'How it Works Section');

  function buildPicture(desktopUrl, mobileUrl) {
    const picture = document.createElement('picture');
    picture.classList.add('title-image');

    // Mobile source (only if provided)
    if (mobileUrl) {
      const mobSource = document.createElement('source');
      mobSource.setAttribute('media', '(max-width: 991px)');
      mobSource.setAttribute('srcset', mobileUrl);
      mobSource.setAttribute('type', 'image/webp');
      picture.appendChild(mobSource);
    }

    // Desktop fallback img
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.setAttribute('alt', '');
    img.setAttribute('aria-hidden', 'true');
    img.src = desktopUrl || mobileUrl || '';
    picture.appendChild(img);

    return picture;
  }

  // Left column (title + image)
  if (rows.length > 0) {
    const firstRowColumns = Array.from(rows[0].children);
    const leftCol = document.createElement('div');
    leftCol.className = 'how-works-img-section';

    // Title (col 1)
    if (firstRowColumns[0]) {
      const titleSource = firstRowColumns[0].querySelector('h1,h2,h3,p');
      const titleText = titleSource ? titleSource.textContent.trim() : firstRowColumns[0].textContent.trim();
      if (titleText) {
        const titleEl = document.createElement('h2');
        titleEl.className = 'title';
        titleEl.textContent = titleText;
        leftCol.appendChild(titleEl);
      }
    }

    // Desktop image (col 2)
    let desktopUrl = '';
    if (firstRowColumns[1]) {
      const link = firstRowColumns[1].querySelector('a');
      const img = firstRowColumns[1].querySelector('img');
      desktopUrl = (link && link.getAttribute('href')) || (img && img.getAttribute('src')) || firstRowColumns[1].textContent.trim();
    }

    // Mobile image (col 3 - optional)
    let mobileUrl = '';
    if (firstRowColumns[2]) {
      const link = firstRowColumns[2].querySelector('a');
      const img = firstRowColumns[2].querySelector('img');
      mobileUrl = (link && link.getAttribute('href')) || (img && img.getAttribute('src')) || firstRowColumns[2].textContent.trim();
    }

    // Build picture from urls (no flip here)
    if (desktopUrl || mobileUrl) {
      leftCol.appendChild(buildPicture(desktopUrl, mobileUrl));
    }

    block.appendChild(leftCol);
  }

  // Right column (steps)
  const rightCol = document.createElement('div');
  rightCol.className = 'how-works-text-section';

  for (let i = 1; i < rows.length; i += 1) {
    const cols = Array.from(rows[i].children);
    if (cols.length >= 2) {
      const stepWrap = document.createElement('div');
      stepWrap.className = 'text-section-wraper';

      const numberEl = document.createElement('p');
      numberEl.className = 'text-section-number';
      numberEl.textContent = String(i).padStart(2, '0');
      stepWrap.appendChild(numberEl);

      const innerWrap = document.createElement('div');
      innerWrap.className = 'inner-text-wraper';

      const stepTitleText = cols[0].textContent.trim();
      if (stepTitleText) {
        const stepTitleEl = document.createElement('p');
        stepTitleEl.className = 'text-title focus-visible-auto-imp';
        stepTitleEl.setAttribute('tabindex', '0');
        stepTitleEl.setAttribute('aria-label', stepTitleText);
        stepTitleEl.textContent = stepTitleText;
        innerWrap.appendChild(stepTitleEl);
      }

      const stepDescText = cols[1].textContent.trim();
      if (stepDescText) {
        const stepDescEl = document.createElement('p');
        stepDescEl.className = 'text-description';
        stepDescEl.textContent = stepDescText;
        innerWrap.appendChild(stepDescEl);
      }

      stepWrap.appendChild(innerWrap);
      rightCol.appendChild(stepWrap);
    }
  }

  block.appendChild(rightCol);
}