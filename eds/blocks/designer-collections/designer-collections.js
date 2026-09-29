import { trackEvent, getDigitalData, bindCarouselNavigationTracking , pushAdobeCtaClickEvent } from "../../scripts/analytics_1.js";
/*
** Authoring format **
Column 1 → logo desktop
Column 2 → logo mobile
Column 3 → gif/video URL
Column 4 → title
Column 5 → subtitle
Column 6 → CTA label
Column 7 → PDF link
*/

async function getSwiperClass() {
  if (window.Swiper) return window.Swiper;
  if (window.loadSwiper) return window.loadSwiper();

  // eslint-disable-next-line no-console
  console.warn('Swiper loader is not available on window.loadSwiper');
  return null;
}
function initVideoOnView(video) {
  if (!video) return;

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;

      if (video.dataset.loaded) {
        obs.unobserve(video);
        return;
      }

      video.dataset.loaded = 'true';

      // Force video to load
      if (typeof video.load === 'function') {
        video.load();
      }

      // Try to play → triggers frame rendering
      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          // Autoplay blocked → expected on mobile
        });
      }

      // Immediately pause → keeps first frame visible
      video.pause();

      obs.unobserve(video);
    });
  }, {
    root: null,
    rootMargin: '200px 0px',
    threshold: 0.01,
  });

  observer.observe(video);
}
function updateNavState(swiper, prevButton, nextButton) {
  if (!swiper || !prevButton || !nextButton) return;

  prevButton.disabled = swiper.isBeginning;
  nextButton.disabled = swiper.isEnd;

  prevButton.style.opacity = swiper.isBeginning ? '0.4' : '1';
  nextButton.style.opacity = swiper.isEnd ? '0.4' : '1';
}

function removeInjectedSwiperIcons(prevButton, nextButton) {
  prevButton?.querySelectorAll('.swiper-navigation-icon').forEach((icon) => icon.remove());
  nextButton?.querySelectorAll('.swiper-navigation-icon').forEach((icon) => icon.remove());
}

function getColumnItems(column) {
  if (!column) return [];

  const directChildren = [...column.children].filter((child) => {
    const hasText = child.textContent?.trim();
    const hasPicture = child.querySelector('picture, img') || child.matches('picture, img');
    const hasLink = child.querySelector('a[href]') || child.matches('a[href]');
    return hasText || hasPicture || hasLink;
  });

  if (directChildren.length) return directChildren;

  return column.textContent?.trim() ? [column] : [];
}

function getPictureItem(item) {
  if (!item) return null;

  if (item.matches?.('picture')) return item.cloneNode(true);

  const picture = item.querySelector?.('picture');
  if (picture) return picture.cloneNode(true);

  const img = item.matches?.('img') ? item : item.querySelector?.('img');
  if (img) return img.cloneNode(true);

  return null;
}

function getTextItem(item) {
  if (!item) return '';

  const cloned = item.cloneNode(true);
  cloned.querySelectorAll('picture, img, a').forEach((el) => el.remove());

  return cloned.textContent?.trim() || item.textContent?.trim() || '';
}

function getHrefItem(item) {
  if (!item) return '';

  if (item.matches?.('a[href]')) return item.href.trim();

  const anchor = item.querySelector?.('a[href]');
  if (anchor?.href) return anchor.href.trim();

  return item.textContent?.trim() || '';
}

function trackNavClick(button, sectionTitle) {
  if (!button) return;

  button.addEventListener('click', (event) => {
    event.preventDefault();

    let direction = '';
    if (button.classList.contains('designer-collections-next') || button.classList.contains('swiper-button-next') || button.classList.contains('slick-next')) {
      direction = 'Next';
    } else if (button.classList.contains('designer-collections-prev') || button.classList.contains('swiper-button-prev') || button.classList.contains('slick-prev')) {
      direction = 'Previous';
    }

    // trackEvent('sitesection_click', {
    //   direction,
    //   testTitle: sectionTitle,
    // });
    trackEvent('Navigation', {
      direction,
      testTitle: sectionTitle,
    });
    pushAdobeCtaClickEvent ({
      selectedValue : direction,
      title: sectionTitle,
      event: 'Navigation',
    });
  });
}

function createVideoElement(src, title) {
  if (!src) return null;

  const video = document.createElement('video');
  video.className = 'designer-collections-video';
  video.src = src;
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.setAttribute('aria-label', title || 'Collection preview');

  video.addEventListener('ended', () => {
    video.pause();
  });

  return video;
}

function bindHoverPlayback(target, mediaEl) {
  if (!mediaEl || mediaEl.tagName.toLowerCase() !== 'video') return;

  target.addEventListener('mouseenter', async () => {
    try {
      mediaEl.pause();
      mediaEl.currentTime = 0;
      await mediaEl.play();
    } catch (e) { }
  });

  // ⏹️ Hover out → reset
  target.addEventListener('mouseleave', () => {
    mediaEl.pause();
    mediaEl.currentTime = 0;
  });

  // ✅ When video ends → DO NOTHING (stay at last frame)
  mediaEl.addEventListener('ended', () => {
    mediaEl.pause();
    // ❌ no reset here
  });
}

export default async function decorate(block) {
  // This block tracks Previous/Next locally via trackNavClick.
  // Mark as already bound so analytics_1's document-level delegated
  // carousel tracker skips it and does not double-fire Navigation.
  block.dataset.navTrackingBound = 'true';

  const section = block.closest('.section');
  const sectionTitle = section?.querySelector('h2');
  const titleText = sectionTitle?.textContent?.trim() || 'Designer Collections';

  if (sectionTitle) {
    sectionTitle.style.display = 'none';
  }

  const row = block.querySelector(':scope > div');
  if (!row) return;

  const columns = [...row.children];
  if (columns.length < 7) return;

  const desktopLogoCol = columns[0];
  const mobileLogoCol = columns[1];
  const mediaUrlCol = columns[2];
  const titleCol = columns[3];
  const subtitleCol = columns[4];
  const ctaLabelCol = columns[5];
  const pdfLinkCol = columns[6];

  const desktopLogoItems = getColumnItems(desktopLogoCol);
  const mobileLogoItems = getColumnItems(mobileLogoCol);
  const mediaUrlItems = getColumnItems(mediaUrlCol);
  const titleItems = getColumnItems(titleCol);
  const subtitleItems = getColumnItems(subtitleCol);
  const ctaLabelItems = getColumnItems(ctaLabelCol);
  const pdfLinkItems = getColumnItems(pdfLinkCol);

  const totalCards = Math.max(
    desktopLogoItems.length,
    mobileLogoItems.length,
    mediaUrlItems.length,
    titleItems.length,
    subtitleItems.length,
    ctaLabelItems.length,
    pdfLinkItems.length,
  );

  if (!totalCards) return;

  const header = document.createElement('div');
  header.className = 'designer-collections-header';

  const titleEl = document.createElement('h2');
  titleEl.className = 'designer-collections-title';
  titleEl.textContent = titleText;
  header.appendChild(titleEl);

  const navWrapper = document.createElement('div');
  navWrapper.className = 'designer-collections-nav-wrapper';

  const prevButton = document.createElement('button');
  prevButton.className = 'designer-collections-nav designer-collections-prev swiper-button-prev';
  prevButton.type = 'button';
  prevButton.setAttribute('aria-label', 'Previous');

  const nextButton = document.createElement('button');
  nextButton.className = 'designer-collections-nav designer-collections-next swiper-button-next';
  nextButton.type = 'button';
  nextButton.setAttribute('aria-label', 'Next');

  trackNavClick(prevButton, titleText);
  trackNavClick(nextButton, titleText);

  navWrapper.appendChild(prevButton);
  navWrapper.appendChild(nextButton);
  header.appendChild(navWrapper);

  const carousel = document.createElement('div');
  carousel.className = 'designer-collections-carousel swiper';

  const track = document.createElement('div');
  track.className = 'designer-collections-track swiper-wrapper';

  for (let i = 0; i < totalCards; i += 1) {
    const desktopLogo = getPictureItem(desktopLogoItems[i]);
    const mobileLogo = getPictureItem(mobileLogoItems[i]);
    const mediaSrc = getHrefItem(mediaUrlItems[i]);
    const title = getTextItem(titleItems[i]);
    const subtitle = getTextItem(subtitleItems[i]);
    const ctaLabel = getTextItem(ctaLabelItems[i]) || 'Download PDF';
    const pdfHref = getHrefItem(pdfLinkItems[i]) || '#';

    if (!title && !desktopLogo && !mobileLogo && !mediaSrc) continue;

    const slide = document.createElement('div');
    slide.className = 'designer-collections-card swiper-slide';

    const cardInner = document.createElement('div');
    cardInner.className = 'designer-collections-card-inner';

    const logoWrap = document.createElement('div');
    logoWrap.className = 'designer-collections-logo';

    if (desktopLogo) {
      const desktopWrap = document.createElement('div');
      desktopWrap.className = 'designer-collections-logo-image designer-collections-logo-image--desktop';
      desktopWrap.appendChild(desktopLogo);
      logoWrap.appendChild(desktopWrap);
    }

    if (mobileLogo) {
      const mobileWrap = document.createElement('div');
      mobileWrap.className = 'designer-collections-logo-image designer-collections-logo-image--mobile';
      mobileWrap.appendChild(mobileLogo);
      logoWrap.appendChild(mobileWrap);
    }

    const mediaWrap = document.createElement('div');
    mediaWrap.className = 'designer-collections-image';

    const mediaEl = createVideoElement(mediaSrc, title);
    if (mediaEl) {
      mediaWrap.appendChild(mediaEl);

        // ✅ ADD THIS LINE
      initVideoOnView(mediaEl);
      bindHoverPlayback(mediaWrap, mediaEl);
    }

    const content = document.createElement('div');
    content.className = 'designer-collections-content';

    if (title) {
      const cardTitle = document.createElement('h3');
      cardTitle.textContent = title;
      content.appendChild(cardTitle);
    }

    if (subtitle) {
      const cardSubtitle = document.createElement('p');
      cardSubtitle.textContent = subtitle;
      content.appendChild(cardSubtitle);
    }

    const ctaWrap = document.createElement('div');
    ctaWrap.className = 'designer-collections-cta-wrap';

    const cta = document.createElement('a');
    cta.className = 'designer-collections-cta';
    cta.href = pdfHref;
    cta.target = '_blank';
    cta.rel = 'noopener noreferrer';
    cta.setAttribute('aria-label', title ? `${ctaLabel} - ${title}` : ctaLabel);

    const ctaText = document.createElement('span');
    ctaText.className = 'designer-collections-cta-text';
    ctaText.textContent = ctaLabel;

    const ctaIcon = document.createElement('img');
    ctaIcon.className = 'designer-collections-cta-icon';
    ctaIcon.src = 'https://www.asianpaints.com/etc.clientlibs/apcolourcatalogue/clientlibs/clientlib-global/resources/images/download-icon-shade-tool.svg';
    ctaIcon.alt = '';
    ctaIcon.setAttribute('aria-hidden', 'true');
    ctaIcon.setAttribute('width', '18');
    ctaIcon.setAttribute('height', '18');

    cta.appendChild(ctaText);
    cta.appendChild(ctaIcon);

    cta.addEventListener("click", function (e) {
      const data = {
        "Title": titleText,
        "pdfName": pdfHref.split('/').pop().replace(".pdf", "")
      }
      getDigitalData().download = data;
      trackEvent("download_multiple_pdf", data);

      pushAdobeCtaClickEvent({
        event: "download_multiple_pdf",
        title: pdfHref.split('/').pop().replace(".pdf", ""),
      });

    });
    ctaWrap.appendChild(cta);

    cardInner.appendChild(logoWrap);
    cardInner.appendChild(mediaWrap);
    cardInner.appendChild(content);
    cardInner.appendChild(ctaWrap);

    slide.appendChild(cardInner);
    track.appendChild(slide);
  }

  if (!track.children.length) return;

  carousel.appendChild(track);

  const pagination = document.createElement('div');
  pagination.className = 'designer-collections-pagination swiper-pagination';
  // carousel.appendChild(pagination);

  block.innerHTML = '';
  block.appendChild(header);
  block.appendChild(carousel);

  if (track.children.length <= 1) {
    navWrapper.style.display = 'none';
    pagination.style.display = 'none';
    return;
  }

  try {
    const Swiper = await getSwiperClass();
    if (!Swiper) return;

    const swiper = new Swiper(carousel, {
      slidesPerView: 1.15,
      spaceBetween: 18,
      speed: 500,
      loop: false,
      watchOverflow: true,
      navigation: {
        prevEl: prevButton,
        nextEl: nextButton,
      },
      breakpoints: {
        0: {
          slidesPerView: 1.5,
          spaceBetween: 18,
        },
        600: {
          slidesPerView: 1.75,
          spaceBetween: 10,
        },
        900: {
          slidesPerView: 3.9,
          spaceBetween: 50,
        },
      },
      on: {
        init(instance) {
          removeInjectedSwiperIcons(prevButton, nextButton);
          updateNavState(instance, prevButton, nextButton);
        },
        slideChange(instance) {
          updateNavState(instance, prevButton, nextButton);
        },
        resize(instance) {
          removeInjectedSwiperIcons(prevButton, nextButton);
          updateNavState(instance, prevButton, nextButton);
        },
        reachBeginning(instance) {
          updateNavState(instance, prevButton, nextButton);
        },
        reachEnd(instance) {
          updateNavState(instance, prevButton, nextButton);
        },
        fromEdge(instance) {
          updateNavState(instance, prevButton, nextButton);
        },
      },
    });

    removeInjectedSwiperIcons(prevButton, nextButton);
    block.designerCollectionsSwiper = swiper;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to initialize designer-collections Swiper', error);
  }
}