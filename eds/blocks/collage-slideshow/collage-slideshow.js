import { triggerCTAClickWithLinkAndTitle } from '../../scripts/analytics_1.js';

function getSwiperClass() {
  if (window.Swiper) return Promise.resolve(window.Swiper);
  if (window.loadSwiper) return window.loadSwiper();

  // eslint-disable-next-line no-console
  console.warn('Swiper loader is not available on window.loadSwiper');
  return Promise.resolve(null);
}

function getTextContent(cell) {
  if (!cell) return '';
  return cell.textContent?.trim() || '';
}

function cloneMediaFromCell(cell) {
  if (!cell) return null;

  const picture = cell.querySelector('picture');
  if (picture) return picture.cloneNode(true);

  const img = cell.querySelector('img');
  if (img) return img.cloneNode(true);

  const video = cell.querySelector('video');
  if (video) return video.cloneNode(true);

  const link = cell.querySelector('a[href]');
  if (link) {
    const href = link.getAttribute('href') || link.href;
    const lowerHref = href.toLowerCase();

    if (
      lowerHref.endsWith('.mp4')
      || lowerHref.endsWith('.webm')
      || lowerHref.endsWith('.ogg')
    ) {
      const videoEl = document.createElement('video');
      videoEl.src = href;
      return videoEl;
    }

    return null;
  }

  const text = getTextContent(cell);
  if (text) {
    const lower = text.toLowerCase();
    const isVideoLike = lower.endsWith('.mp4')
      || lower.endsWith('.webm')
      || lower.endsWith('.ogg');

    if (isVideoLike) {
      const videoEl = document.createElement('video');
      videoEl.src = text;
      return videoEl;
    }
  }

  return null;
}

function buildImageMedia(cell, altText = '') {
  const media = cloneMediaFromCell(cell);
  if (!media) return null;

  const tag = media.tagName?.toLowerCase();

  if (tag === 'picture') {
    const img = media.querySelector('img');
    if (img) {
      if (!img.alt) img.alt = altText;

      // Apply lazy loading to all images in this block
      img.loading = 'lazy';
      img.decoding = 'async';
      img.setAttribute('fetchpriority', 'auto');
    }
    return media;
  }

  if (tag === 'img') {
    if (!media.alt) media.alt = altText;

    // Apply lazy loading to standalone img too
    media.loading = 'lazy';
    media.decoding = 'async';
    media.setAttribute('fetchpriority', 'auto');

    return media;
  }

  return null;
}

function buildVideoMedia(cell, ariaLabel = '') {
  const media = cloneMediaFromCell(cell);
  if (!media) return null;

  let videoEl = null;
  const tag = media.tagName?.toLowerCase();

  if (tag === 'video') {
    videoEl = media;
  } else if (tag === 'a') {
    const href = media.getAttribute('href') || media.href;
    videoEl = document.createElement('video');
    videoEl.src = href;
  } else {
    const text = getTextContent(cell);
    if (text) {
      videoEl = document.createElement('video');
      videoEl.src = text;
    }
  }

  if (!videoEl) return null;

  videoEl.setAttribute('playsinline', '');
  videoEl.setAttribute('autoplay', '');
  videoEl.setAttribute('loop', '');
  videoEl.setAttribute('muted', '');
  videoEl.muted = true;
  videoEl.autoplay = true;
  videoEl.loop = true;
  videoEl.playsInline = true;
  videoEl.setAttribute('aria-hidden', 'true');

  if (ariaLabel) {
    videoEl.setAttribute('aria-label', ariaLabel);
  }

  return videoEl;
}

function createContentPanel(contentRow) {
  const panel = document.createElement('div');
  panel.className = 'collage-slideshow__content';

  const firstCol = contentRow.children[0] || contentRow;
  [...firstCol.childNodes].forEach((node) => {
    panel.appendChild(node.cloneNode(true));
  });

  const links = [...panel.querySelectorAll('a')];
  const paragraphs = [...panel.querySelectorAll('p')];
  const headings = [...panel.querySelectorAll('h1, h2, h3, h4, h5, h6')];

  if (headings.length) {
    headings.forEach((heading, index) => {
      if (index === 0) {
        heading.classList.add('collage-slideshow__eyebrow');
      } else {
        heading.classList.add('collage-slideshow__title-line');
      }
    });

    const nonHeadingParagraphs = [...panel.querySelectorAll('p')];
    if (nonHeadingParagraphs.length) {
      nonHeadingParagraphs[0].classList.add('collage-slideshow__description');
    }
  } else if (paragraphs.length) {
    if (paragraphs[0]) paragraphs[0].classList.add('collage-slideshow__eyebrow');
    if (paragraphs[1]) paragraphs[1].classList.add('collage-slideshow__title-line');
    if (paragraphs[2]) paragraphs[2].classList.add('collage-slideshow__description');
    if (paragraphs[3]) paragraphs[3].classList.add('collage-slideshow__description');
  }

  const eyebrowText = panel.querySelector('.collage-slideshow__eyebrow')?.textContent?.trim() || '';
  const titleLineTexts = [...panel.querySelectorAll('.collage-slideshow__title-line')]
    .map((node) => node.textContent?.trim() || '')
    .filter(Boolean);
  const parentTitle = [eyebrowText, ...titleLineTexts].filter(Boolean).join(' ').trim()
    || panel.querySelector('h1, h2, h3, h4, h5, h6, p')?.textContent?.trim()
    || '';

  const firstLink = links[0];
  if (firstLink) {
    firstLink.classList.add('collage-slideshow__cta');
    const label = firstLink.textContent.trim();
    const ctaLink = firstLink.getAttribute('href') || firstLink.href || '';
    firstLink.innerHTML = `
      <span>${label}</span>
      <span class="collage-slideshow__cta-icon" aria-hidden="true">➜</span>
    `;
    firstLink.addEventListener('click', () => {
      triggerCTAClickWithLinkAndTitle(ctaLink, label, parentTitle);
    });
  }

  return panel;
}

function getSlides(rows) {
  return rows.slice(1).map((row, rowIndex) => ({
    rowIndex,
    columns: [...row.children],
  })).filter((slide) => slide.columns.length);
}

function createMediaBlock(cell, type, rowIndex, colIndex, labelText) {
  const mediaWrap = document.createElement('div');
  mediaWrap.className = `collage-slideshow__media collage-slideshow__media--col-${colIndex + 1}`;

  let mediaNode = null;

  if (type === 'video') {
    mediaNode = buildVideoMedia(cell, labelText);
    mediaWrap.classList.add('collage-slideshow__media--video');
  } else {
    mediaNode = buildImageMedia(cell, labelText);
    mediaWrap.classList.add('collage-slideshow__media--image');
  }

  if (!mediaNode) return null;

  mediaWrap.appendChild(mediaNode);

  if (colIndex === 0) {
    mediaWrap.classList.add('collage-slideshow__media--logo');
  }

  return mediaWrap;
}

function buildDesktopVideoSlide(slide, labelText) {
  const collage = document.createElement('div');
  collage.className = 'collage-slideshow__collage collage-slideshow__collage--desktop';

  const col1 = document.createElement('div');
  col1.className = 'collage-slideshow__column collage-slideshow__column--1';

  const col2 = document.createElement('div');
  col2.className = 'collage-slideshow__column collage-slideshow__column--2';

  const col3 = document.createElement('div');
  col3.className = 'collage-slideshow__column collage-slideshow__column--3';

  if (slide.columns[0]) {
    const logo = createMediaBlock(slide.columns[0], 'image', slide.rowIndex, 0, labelText);
    if (logo) col1.appendChild(logo);
  }

  if (slide.columns[1]) {
    const bottom = createMediaBlock(slide.columns[1], 'video', slide.rowIndex, 1, labelText);
    if (bottom) {
      bottom.classList.add('collage-slideshow__media--short');
      col1.appendChild(bottom);
    }
  }

  if (slide.columns[2]) {
    const center = createMediaBlock(slide.columns[2], 'video', slide.rowIndex, 2, labelText);
    if (center) {
      center.classList.add('collage-slideshow__media--tall');
      col2.appendChild(center);
    }
  }

  if (slide.columns[3]) {
    const top = createMediaBlock(slide.columns[3], 'video', slide.rowIndex, 3, labelText);
    if (top) {
      top.classList.add('collage-slideshow__media--top');
      col3.appendChild(top);
    }
  }

  if (slide.columns[4]) {
    const bottomRight = createMediaBlock(slide.columns[4], 'video', slide.rowIndex, 4, labelText);
    if (bottomRight) {
      bottomRight.classList.add('collage-slideshow__media--bottom');
      col3.appendChild(bottomRight);
    }
  }

  collage.append(col1, col2, col3);
  return collage;
}

function buildDesktopFiveImageSlide(slide, labelText) {
  const collage = document.createElement('div');
  collage.className = 'collage-slideshow__collage collage-slideshow__collage--desktop collage-slideshow__collage--five';

  const left = document.createElement('div');
  left.className = 'collage-slideshow__five-left';

  const right = document.createElement('div');
  right.className = 'collage-slideshow__five-right';

  const rightBottom = document.createElement('div');
  rightBottom.className = 'collage-slideshow__five-right-bottom';

  if (slide.columns[0]) {
    const logo = createMediaBlock(slide.columns[0], 'image', slide.rowIndex, 0, labelText);
    if (logo) {
      logo.classList.add('collage-slideshow__media--five-logo');
      left.appendChild(logo);
    }
  }

  if (slide.columns[1]) {
    const largeLeft = createMediaBlock(slide.columns[1], 'image', slide.rowIndex, 1, labelText);
    if (largeLeft) {
      largeLeft.classList.add('collage-slideshow__media--five-large-left');
      left.appendChild(largeLeft);
    }
  }

  if (slide.columns[2]) {
    const topWide = createMediaBlock(slide.columns[2], 'image', slide.rowIndex, 2, labelText);
    if (topWide) {
      topWide.classList.add('collage-slideshow__media--five-top-wide');
      right.appendChild(topWide);
    }
  }

  if (slide.columns[3]) {
    const bottomOne = createMediaBlock(slide.columns[3], 'image', slide.rowIndex, 3, labelText);
    if (bottomOne) {
      bottomOne.classList.add('collage-slideshow__media--five-bottom-small');
      rightBottom.appendChild(bottomOne);
    }
  }

  if (slide.columns[4]) {
    const bottomTwo = createMediaBlock(slide.columns[4], 'image', slide.rowIndex, 4, labelText);
    if (bottomTwo) {
      bottomTwo.classList.add('collage-slideshow__media--five-bottom-small');
      rightBottom.appendChild(bottomTwo);
    }
  }

  right.appendChild(rightBottom);
  collage.append(left, right);
  return collage;
}

function buildDesktopNineImageSlide(slide, labelText) {
  const collage = document.createElement('div');
  collage.className = 'collage-slideshow__collage collage-slideshow__collage--desktop';

  const col1 = document.createElement('div');
  col1.className = 'collage-slideshow__column collage-slideshow__column--1';

  const col2 = document.createElement('div');
  col2.className = 'collage-slideshow__column collage-slideshow__column--2';

  const col3 = document.createElement('div');
  col3.className = 'collage-slideshow__column collage-slideshow__column--3';

  const col4 = document.createElement('div');
  col4.className = 'collage-slideshow__column collage-slideshow__column--4';

  if (slide.columns[0]) {
    const logoOrImage = createMediaBlock(slide.columns[0], 'image', slide.rowIndex, 0, labelText);
    if (logoOrImage) {
      logoOrImage.classList.add('collage-slideshow__media--logo');
      col1.appendChild(logoOrImage);
    }
  }

  if (slide.columns[1]) {
    const img = createMediaBlock(slide.columns[1], 'image', slide.rowIndex, 1, labelText);
    if (img) col1.appendChild(img);
  }

  if (slide.columns[2]) {
    const img = createMediaBlock(slide.columns[2], 'image', slide.rowIndex, 2, labelText);
    if (img) col2.appendChild(img);
  }

  if (slide.columns[3]) {
    const img = createMediaBlock(slide.columns[3], 'image', slide.rowIndex, 3, labelText);
    if (img) col2.appendChild(img);
  }

  if (slide.columns[4]) {
    const img = createMediaBlock(slide.columns[4], 'image', slide.rowIndex, 4, labelText);
    if (img) col3.appendChild(img);
  }

  if (slide.columns[5]) {
    const img = createMediaBlock(slide.columns[5], 'image', slide.rowIndex, 5, labelText);
    if (img) col3.appendChild(img);
  }

  if (slide.columns[6]) {
    const img = createMediaBlock(slide.columns[6], 'image', slide.rowIndex, 6, labelText);
    if (img) col3.appendChild(img);
  }

  if (slide.columns[7]) {
    const img = createMediaBlock(slide.columns[7], 'image', slide.rowIndex, 7, labelText);
    if (img) col4.appendChild(img);
  }

  if (slide.columns[8]) {
    const img = createMediaBlock(slide.columns[8], 'image', slide.rowIndex, 8, labelText);
    if (img) col4.appendChild(img);
  }

  collage.append(col1, col2, col3, col4);
  return collage;
}

function buildDesktopCollage(slide, labelText = '') {
  if (slide.rowIndex === 0) {
    return buildDesktopVideoSlide(slide, labelText);
  }

  if (slide.columns.length === 5) {
    return buildDesktopFiveImageSlide(slide, labelText);
  }

  return buildDesktopNineImageSlide(slide, labelText);
}

function buildMobileVideoSlide(slide, labelText) {
  const mobile = document.createElement('div');
  mobile.className = 'collage-slideshow__collage collage-slideshow__collage--mobile';

  const col1 = document.createElement('div');
  col1.className = 'collage-slideshow__mobile-column collage-slideshow__mobile-column--1';

  const col2 = document.createElement('div');
  col2.className = 'collage-slideshow__mobile-column collage-slideshow__mobile-column--2';

  const col3 = document.createElement('div');
  col3.className = 'collage-slideshow__mobile-column collage-slideshow__mobile-column--3';

  if (slide.columns[0]) {
    const logo = createMediaBlock(slide.columns[0], 'image', slide.rowIndex, 0, labelText);
    if (logo) {
      logo.classList.add('collage-slideshow__media--mobile-logo');
      col1.appendChild(logo);
    }
  }

  if (slide.columns[1]) {
    const img1 = createMediaBlock(slide.columns[1], 'video', slide.rowIndex, 1, labelText);
    if (img1) {
      img1.classList.add('collage-slideshow__media--mobile-short');
      col1.appendChild(img1);
    }
  }

  if (slide.columns[2]) {
    const tall = createMediaBlock(slide.columns[2], 'video', slide.rowIndex, 2, labelText);
    if (tall) {
      tall.classList.add('collage-slideshow__media--mobile-tall');
      col2.appendChild(tall);
    }
  }

  if (slide.columns[3]) {
    const top = createMediaBlock(slide.columns[3], 'video', slide.rowIndex, 3, labelText);
    if (top) {
      top.classList.add('collage-slideshow__media--mobile-top');
      col3.appendChild(top);
    }
  }

  if (slide.columns[4]) {
    const bottom = createMediaBlock(slide.columns[4], 'video', slide.rowIndex, 4, labelText);
    if (bottom) {
      bottom.classList.add('collage-slideshow__media--mobile-bottom');
      col3.appendChild(bottom);
    }
  }

  mobile.append(col1, col2, col3);
  return mobile;
}

function buildMobileFiveImageSlide(slide, labelText) {
  const mobile = document.createElement('div');
  mobile.className = 'collage-slideshow__collage collage-slideshow__collage--mobile collage-slideshow__collage--mobile-five';

  const left = document.createElement('div');
  left.className = 'collage-slideshow__mobile-five-left';

  const right = document.createElement('div');
  right.className = 'collage-slideshow__mobile-five-right';

  const rightBottom = document.createElement('div');
  rightBottom.className = 'collage-slideshow__mobile-five-right-bottom';

  if (slide.columns[0]) {
    const logo = createMediaBlock(slide.columns[0], 'image', slide.rowIndex, 0, labelText);
    if (logo) {
      logo.classList.add('collage-slideshow__media--mobile-five-logo');
      left.appendChild(logo);
    }
  }

  if (slide.columns[1]) {
    const large = createMediaBlock(slide.columns[1], 'image', slide.rowIndex, 1, labelText);
    if (large) {
      large.classList.add('collage-slideshow__media--mobile-five-large-left');
      left.appendChild(large);
    }
  }

  if (slide.columns[2]) {
    const top = createMediaBlock(slide.columns[2], 'image', slide.rowIndex, 2, labelText);
    if (top) {
      top.classList.add('collage-slideshow__media--mobile-five-top');
      right.appendChild(top);
    }
  }

  if (slide.columns[3]) {
    const bottomOne = createMediaBlock(slide.columns[3], 'image', slide.rowIndex, 3, labelText);
    if (bottomOne) {
      bottomOne.classList.add('collage-slideshow__media--mobile-five-bottom');
      rightBottom.appendChild(bottomOne);
    }
  }

  if (slide.columns[4]) {
    const bottomTwo = createMediaBlock(slide.columns[4], 'image', slide.rowIndex, 4, labelText);
    if (bottomTwo) {
      bottomTwo.classList.add('collage-slideshow__media--mobile-five-bottom');
      rightBottom.appendChild(bottomTwo);
    }
  }

  right.appendChild(rightBottom);
  mobile.append(left, right);
  return mobile;
}

function buildMobileNineImageSlide(slide, labelText) {
  const mobile = document.createElement('div');
  mobile.className = 'collage-slideshow__collage collage-slideshow__collage--mobile';

  const col1 = document.createElement('div');
  col1.className = 'collage-slideshow__mobile-column collage-slideshow__mobile-column--1';

  const col2 = document.createElement('div');
  col2.className = 'collage-slideshow__mobile-column collage-slideshow__mobile-column--2';

  const col3 = document.createElement('div');
  col3.className = 'collage-slideshow__mobile-column collage-slideshow__mobile-column--3';

  if (slide.columns[0]) {
    const logo = createMediaBlock(slide.columns[0], 'image', slide.rowIndex, 0, labelText);
    if (logo) {
      logo.classList.add('collage-slideshow__media--mobile-logo');
      col1.appendChild(logo);
    }
  }

  if (slide.columns[1]) {
    const img = createMediaBlock(slide.columns[1], 'image', slide.rowIndex, 1, labelText);
    if (img) col2.appendChild(img);
  }

  if (slide.columns[2]) {
    const img = createMediaBlock(slide.columns[2], 'image', slide.rowIndex, 2, labelText);
    if (img) col3.appendChild(img);
  }

  if (slide.columns[3]) {
    const img = createMediaBlock(slide.columns[3], 'image', slide.rowIndex, 3, labelText);
    if (img) col1.appendChild(img);
  }

  if (slide.columns[4]) {
    const img = createMediaBlock(slide.columns[4], 'image', slide.rowIndex, 4, labelText);
    if (img) col2.appendChild(img);
  }

  if (slide.columns[5]) {
    const img = createMediaBlock(slide.columns[5], 'image', slide.rowIndex, 5, labelText);
    if (img) col2.appendChild(img);
  }

  if (slide.columns[6]) {
    const img = createMediaBlock(slide.columns[6], 'image', slide.rowIndex, 6, labelText);
    if (img) col3.appendChild(img);
  }

  if (slide.columns[7]) {
    const img = createMediaBlock(slide.columns[7], 'image', slide.rowIndex, 7, labelText);
    if (img) col1.appendChild(img);
  }

  if (slide.columns[8]) {
    const img = createMediaBlock(slide.columns[8], 'image', slide.rowIndex, 8, labelText);
    if (img) col3.appendChild(img);
  }

  mobile.append(col1, col2, col3);
  return mobile;
}

function buildMobileCollage(slide, labelText = '') {
  if (slide.rowIndex === 0) {
    return buildMobileVideoSlide(slide, labelText);
  }

  if (slide.columns.length === 5) {
    return buildMobileFiveImageSlide(slide, labelText);
  }

  return buildMobileNineImageSlide(slide, labelText);
}

export default async function decorate(block) {
  const rows = [...block.children];
  if (rows.length < 2) return;

  const section = block.closest('.section');
  if (section) section.classList.add('collage-slideshow-container');

  const contentRow = rows[0];
  const slides = getSlides(rows);

  if (!slides.length) return;

  block.innerHTML = '';
  block.classList.add('collage-slideshow');

  const wrapper = document.createElement('div');
  wrapper.className = 'collage-slideshow__wrapper';

  const leftSection = document.createElement('div');
  leftSection.className = 'collage-slideshow__left';

  const rightSection = document.createElement('div');
  rightSection.className = 'collage-slideshow__right';

  const swiperEl = document.createElement('div');
  swiperEl.className = 'collage-slideshow__swiper swiper';

  const swiperWrapper = document.createElement('div');
  swiperWrapper.className = 'swiper-wrapper';

  slides.forEach((slide, index) => {
    const slideEl = document.createElement('div');
    slideEl.className = `collage-slideshow__slide swiper-slide collage-slideshow__slide--${index + 1}`;
    slideEl.dataset.index = index;

    const labelText = 'Range of Royale collections';
    const desktopCollage = buildDesktopCollage(slide, labelText);
    const mobileCollage = buildMobileCollage(slide, labelText);

    slideEl.appendChild(desktopCollage);
    slideEl.appendChild(mobileCollage);
    swiperWrapper.appendChild(slideEl);
  });

  swiperEl.appendChild(swiperWrapper);

  const pagination = document.createElement('div');
  pagination.className = 'collage-slideshow__pagination swiper-pagination';

  leftSection.append(swiperEl, pagination);

  const contentPanel = createContentPanel(contentRow);
  rightSection.appendChild(contentPanel);

  // MOBILE: move CTA + description below left section
  if (window.innerWidth <= 991) {
    const description = contentPanel.querySelector('.collage-slideshow__description');
    const cta = contentPanel.querySelector('.collage-slideshow__cta');
    if (cta) leftSection.appendChild(cta);
  }

  wrapper.append(leftSection, rightSection);
  block.appendChild(wrapper);

  if (slides.length <= 1) {
    pagination.style.display = 'none';
    return;
  }

  try {
    const Swiper = await getSwiperClass();
    if (!Swiper) return;

    const swiper = new Swiper(swiperEl, {
      slidesPerView: 1,
      speed: 700,
      loop: false,
      watchOverflow: true,
      autoHeight: false,
      spaceBetween: 0,
      pagination: {
        el: pagination,
        clickable: true,
      },
    });

    block.collageSlideshowSwiper = swiper;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to initialize collage slideshow Swiper', error);
  }
}