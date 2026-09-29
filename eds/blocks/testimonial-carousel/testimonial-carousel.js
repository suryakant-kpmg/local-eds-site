/*
** Authoring format **

Row 1 (Title)
Col 1 → Label "Title"
Col 2 → Section title (e.g. "What our clients say!")

Row 2 (Subtitle) - optional; shown below the title only when filled in
Col 1 → Label "Subtitle"
Col 2 → Subtitle text

Row 3 (Play icon)
Col 1 → Label "Play icon"
Col 2 → Play icon image (picture) - shown on every testimonial thumbnail

Row 4 onwards (one row per testimonial)
Col 1 → Thumbnail image (picture)
Col 2 → YouTube embed link (e.g. https://www.youtube.com/embed/<id>)
Col 3 → Testimonial text
Col 4 → Customer name
Col 5 → Place

----------------------------------------
Variant: stories-variant
(block authored as "testimonial-carousel (stories-variant)")

Row 1 (Title)
Col 1 → Label "Title"
Col 2 → Section title (e.g. "What our clients say!")

Row 2 (Subtitle) - optional
Col 1 → Label "Subtitle"
Col 2 → Subtitle (e.g. "Real stories of beautifully transformed homes")

Row 3 (Play icon)
Col 1 → Label "Play icon"
Col 2 → Play icon image (picture) - shown on every testimonial thumbnail

Row 4 onwards (one row per testimonial)
Col 1 → Thumbnail image (picture)
Col 2 → YouTube embed link (e.g. https://www.youtube.com/embed/<id>)
Col 3 → Testimonial text (short quote, shown exactly as authored)
Col 4 → Customer name (e.g. "Dr.Sachin Kumble - Pune")
Col 5 → Number of views (e.g. "110" → shown as "110 views" with an eye icon)

Labels in Col 1 are matched case-insensitively. Older unlabelled title rows
("Title" or "Title | Subtitle") are still supported.
*/

import { trackEvent, bindCarouselNavigationTracking, pushAdobeCtaClickEvent } from "../../scripts/analytics_1.js";
async function getSwiperClass() {
  if (window.Swiper) return window.Swiper;
  if (window.loadSwiper) return window.loadSwiper();

  // eslint-disable-next-line no-console
  console.warn('Swiper loader is not available on window.loadSwiper');
  return null;
}

function buildHeading(rows, block) {
  let headingText = '';
  let siblingHeading = null;

  const blockWrapper = block.closest('.testimonial-carousel-wrapper');
  if (blockWrapper) {
    const prevWrapper = blockWrapper.previousElementSibling;
    if (prevWrapper?.classList.contains('default-content-wrapper')) {
      siblingHeading = prevWrapper.querySelector('h2');
      if (siblingHeading) headingText = siblingHeading.textContent.trim();
    }
  }

  if (!siblingHeading && block.previousElementSibling?.tagName === 'H2') {
    siblingHeading = block.previousElementSibling;
    headingText = siblingHeading.textContent.trim();
  }

  const testimonialRows = [];
  let playIcon = null;
  let subtitleText = '';

  rows.forEach((row) => {
    const cols = [...row.querySelectorAll(':scope > div')];
    // labelled 2-column config rows: "Title | …", "Subtitle | …", "Play icon | <image>"
    const label = cols.length === 2 ? cols[0].textContent.trim().toLowerCase() : '';
    const isPlayIconRow = /^play\s*icon$/.test(label) && cols[1].querySelector('picture');
    // unlabelled title row (older layout): "Title" or "Title | Subtitle"
    const isHeadingRow = !isPlayIconRow
      && cols.length <= 2
      && !row.querySelector('picture');

    if (isPlayIconRow) {
      playIcon = cols[1].querySelector('picture');
    } else if (label === 'title') {
      if (!headingText) headingText = cols[1].textContent.trim();
    } else if (label === 'subtitle') {
      subtitleText = cols[1].textContent.trim();
    } else if (isHeadingRow) {
      if (!headingText) headingText = cols[0].textContent.trim();
      if (cols[1]) subtitleText = cols[1].textContent.trim();
    } else {
      testimonialRows.push(row);
    }
  });

  return {
    headingText, subtitleText, siblingHeading, testimonialRows, playIcon,
  };
}

function createQuoteIcon() {
  const logo = document.createElement('div');
  logo.className = 'testimonial-logo-bg';

  const img = document.createElement('img');
  img.src = 'https://static.asianpaints.com/content/dam/apcolourcatalogue/asset/ap-revamp/waterproofing/landing-page/wht-our-clients-say/wht-our-client-say-bg-logo.webp';
  img.alt = 'Quote background';
  img.loading = 'lazy';

  logo.appendChild(img);

  return logo;
}

function getTestimonialContent(columns) {
  let quoteText = '';
  let nameText = '';
  let locationText = '';

  if (columns.length >= 4) {
    quoteText = columns[1]?.textContent?.trim() || '';
    nameText = columns[2]?.textContent?.trim() || '';
    locationText = columns[3]?.textContent?.trim() || '';
  } else if (columns.length >= 2) {
    const paragraphs = columns[1]?.querySelectorAll('p') || [];
    if (paragraphs[0]) quoteText = paragraphs[0].textContent.trim();

    if (paragraphs[1]) {
      const strong = paragraphs[1].querySelector('strong');
      const fullText = paragraphs[1].textContent.trim();

      if (strong) {
        nameText = strong.textContent.trim();
        locationText = fullText.replace(nameText, '').replace(/^[,\s]+/, '').trim();
      } else {
        const parts = fullText.split(',');
        nameText = parts[0]?.trim() || '';
        locationText = parts.slice(1).join(',').trim();
      }
    }
  }

  return { quoteText, nameText, locationText };
}

function createVideoModal(block) {
  const modal = document.createElement('div');
  modal.className = 'testimonial-video-modal';
  modal.innerHTML = `
    <div class="testimonial-video-modal-content">
      <button class="testimonial-video-close" type="button" aria-label="Close video popup">
        <span></span>
        <span></span>
      </button>
      <div class="testimonial-video-wrapper"></div>
    </div>
  `;

  block.appendChild(modal);
  return modal;
}

function openVideoModal(block, videoUrl) {
  const modal = block.querySelector('.testimonial-video-modal');
  const videoWrapper = modal?.querySelector('.testimonial-video-wrapper');
  if (!modal || !videoWrapper || !videoUrl) return;

  const separator = videoUrl.includes('?') ? '&' : '?';
  const iframeSrc = `${videoUrl}${separator}autoplay=1&rel=0`;

  videoWrapper.innerHTML = `
    <iframe
      src="${iframeSrc}"
      title="Customer testimonial video"
      allow="autoplay; encrypted-media; picture-in-picture"
      allowfullscreen
    ></iframe>
  `;

  modal.classList.add('active');
  document.body.classList.add('testimonial-video-open');
}

function closeVideoModal(block) {
  const modal = block.querySelector('.testimonial-video-modal');
  const videoWrapper = modal?.querySelector('.testimonial-video-wrapper');
  if (!modal || !videoWrapper) return;

  modal.classList.remove('active');
  videoWrapper.innerHTML = '';
  document.body.classList.remove('testimonial-video-open');
}

// eye icon for the stories-variant view count
const EYE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="21" height="16" viewBox="0 0 21 16" fill="none" aria-hidden="true" focusable="false">
  <path d="M1.14 7.636C2.93 3.97 6.39 1.5 10.39 1.5s7.46 2.47 9.25 6.136c-1.79 3.666-5.25 6.136-9.25 6.136S2.93 11.302 1.14 7.636Z" stroke="#75787B" stroke-width="1.5" stroke-linejoin="round"/>
  <path d="M12.7893 7.63631C12.7893 8.92609 11.7148 9.97166 10.3893 9.97166C9.06382 9.97166 7.98931 8.92609 7.98931 7.63631C7.98931 6.34653 9.06382 5.30095 10.3893 5.30095C11.7148 5.30095 12.7893 6.34653 12.7893 7.63631Z" stroke="#75787B" stroke-width="1.5"/>
</svg>`;

/**
 * stories-variant card body: the authored quote as a bold one-liner,
 * the customer name, and a view count with an eye icon.
 */
function buildStoriesContent(descriptionCol, nameCol, viewsCol) {
  const content = document.createElement('div');
  content.className = 'testimonial-content';

  const quoteText = descriptionCol?.textContent?.trim() || '';
  if (quoteText) {
    const quote = document.createElement('p');
    quote.className = 'testimonial-quote';
    quote.textContent = quoteText;
    content.appendChild(quote);
  }

  const nameText = nameCol?.textContent?.trim() || '';
  if (nameText) {
    const name = document.createElement('p');
    name.className = 'testimonial-name';
    name.textContent = nameText;
    content.appendChild(name);
  }

  const viewsText = viewsCol?.textContent?.trim() || '';
  if (viewsText) {
    const views = document.createElement('p');
    views.className = 'testimonial-views';
    // a bare number ("110", "1.2K") gets the "views" suffix
    const label = /^[\d.,]+\s*[kKmM+]?$/.test(viewsText) ? `${viewsText} views` : viewsText;
    views.innerHTML = EYE_ICON;
    views.append(label);
    content.appendChild(views);
  }

  return content;
}

function buildSlide(row, block, playIcon) {
  const slide = document.createElement('div');
  slide.className = 'testimonial-slide swiper-slide';

  const columns = [...row.querySelectorAll(':scope > div')];

  // HTML structure: columns[0] = <a href="youtube"><picture></picture></a>
  //                 columns[1] = quote text
  //                 columns[2] = name
  //                 columns[3] = location
const imageCol = columns[0];
const videoCol = columns[1];
const descriptionCol = columns[2];
const nameCol = columns[3];
const placeCol = columns[4];

  // Video link lives in the <a> wrapping the thumbnail image
  // const videoLink = imageCol?.querySelector('a')?.href || '';
  const videoLink = columns[1]?.textContent.trim() || '';

  const imageWrapper = document.createElement('div');
  imageWrapper.className = 'testimonial-image';

  const picture = imageCol?.querySelector('picture');
  if (picture) imageWrapper.appendChild(picture.cloneNode(true));

  const playButton = document.createElement('button');
  playButton.className = 'testimonial-play-button';
  playButton.type = 'button';
  playButton.setAttribute('aria-label', 'Play testimonial video');

  // play icon is authored in DA (row 2); the button's aria-label names it,
  // so the icon itself is decorative
  if (playIcon) {
    const icon = playIcon.cloneNode(true);
    const iconImg = icon.querySelector('img');
    if (iconImg) {
      iconImg.alt = '';
      iconImg.loading = 'lazy';
    }
    playButton.appendChild(icon);
  }

  if (!videoLink) {
    playButton.style.display = 'none';
  } else {
    playButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openVideoModal(block, videoLink);
      trackEvent('test_open');
      
        pushAdobeCtaClickEvent({
        title: nameCol?.textContent?.trim() || '',
        event: 'test_open'
        })


    });
  }

  imageWrapper.appendChild(playButton);

  if (block.classList.contains('stories-variant')) {
    slide.append(imageWrapper, buildStoriesContent(descriptionCol, nameCol, placeCol));
    return slide;
  }

  const contentWrapper = document.createElement('div');
  contentWrapper.className = 'testimonial-content';
  contentWrapper.appendChild(createQuoteIcon());

  const quoteText = descriptionCol?.textContent?.trim() || '';
const nameText = nameCol?.textContent?.trim() || '';
const placeText = placeCol?.textContent?.trim() || '';

  if (quoteText) {
    const quoteDiv = document.createElement('div');
    quoteDiv.className = 'testimonial-quote';
    quoteDiv.textContent = quoteText;
    contentWrapper.appendChild(quoteDiv);
  }

  if (nameText) {
    const attribution = document.createElement('div');
    attribution.className = 'testimonial-attribution';
    attribution.innerHTML = `
      <span class="testimonial-name">${nameText}</span>
      ${placeText ? `<span class="testimonial-location">, ${placeText}</span>` : ''}
    `;
    contentWrapper.appendChild(attribution);
  }

  slide.append(imageWrapper, contentWrapper);

  return slide;
}

function hideSiblingHeading(siblingHeading) {
  if (!siblingHeading) return;

  const wrapper = siblingHeading.closest('.default-content-wrapper');
  if (wrapper) {
    wrapper.style.display = 'none';
  } else {
    siblingHeading.style.display = 'none';
  }
}

function bindModalEvents(block) {
  const modal = block.querySelector('.testimonial-video-modal');
  const closeButton = block.querySelector('.testimonial-video-close');

  closeButton?.addEventListener('click', () => {
    closeVideoModal(block);
  });

  modal?.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeVideoModal(block);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal?.classList.contains('active')) {
      closeVideoModal(block);
    }
  });
}

export default function decorate(block) {
  const rows = [...block.querySelectorAll(':scope > div')];
  if (!rows.length) return;

  const {
    headingText, subtitleText, siblingHeading, testimonialRows, playIcon,
  } = buildHeading(rows, block);
  if (!testimonialRows.length) return;

  const isStories = block.classList.contains('stories-variant');

  const container = document.createElement('div');
  container.className = 'testimonial-carousel-container';

  const headingWrapper = document.createElement('div');
  headingWrapper.className = 'testimonial-heading';

  // heading comes only from authored content; skip it when none is provided
  if (isStories) {
    // stories: title + subtitle on the left, nav arrows on the right (added below)
    const headingTextEl = document.createElement('div');
    headingTextEl.className = 'testimonial-heading-text';
    if (headingText) {
      const h2 = document.createElement('h2');
      h2.textContent = headingText;
      headingTextEl.appendChild(h2);
    }
    if (subtitleText) {
      const subtitle = document.createElement('p');
      subtitle.className = 'testimonial-subtitle';
      subtitle.textContent = subtitleText;
      headingTextEl.appendChild(subtitle);
    }
    headingWrapper.appendChild(headingTextEl);
  } else {
    if (headingText) {
      const h2 = document.createElement('h2');
      const words = headingText.split(' ');
      const midPoint = Math.ceil(words.length / 3);
      h2.innerHTML = `${words.slice(0, midPoint).join(' ')}<br>${words.slice(midPoint).join(' ')}`;
      headingWrapper.appendChild(h2);
    }
    // subtitle only when authored
    if (subtitleText) {
      const subtitle = document.createElement('p');
      subtitle.className = 'testimonial-subtitle';
      subtitle.textContent = subtitleText;
      headingWrapper.appendChild(subtitle);
    }
  }

  const carouselWrapper = document.createElement('div');
  carouselWrapper.className = 'testimonial-carousel-inner-wrapper';

  const swiperEl = document.createElement('div');
  swiperEl.className = 'testimonial-swiper swiper';

  const swiperWrapper = document.createElement('div');
  swiperWrapper.className = 'swiper-wrapper';

  testimonialRows.forEach((row) => {
    swiperWrapper.appendChild(buildSlide(row, block, playIcon));
  });

  swiperEl.appendChild(swiperWrapper);

  const paginationEl = document.createElement('div');
  paginationEl.className = 'testimonial-pagination swiper-pagination';

  const navButtons = document.createElement('div');
  navButtons.className = 'testimonial-nav-buttons';
  navButtons.innerHTML = `
    <button class="testimonial-prev" aria-label="Previous testimonial" type="button">

    </button>
    <button class="testimonial-next" aria-label="Next testimonial" type="button">

    </button>
  `;

  if (isStories) {
    headingWrapper.appendChild(navButtons);
    carouselWrapper.append(swiperEl, paginationEl);
  } else {
    carouselWrapper.append(swiperEl, paginationEl, navButtons);
  }
  container.append(headingWrapper, carouselWrapper);

  block.textContent = '';
  block.appendChild(container);
  createVideoModal(block);

  hideSiblingHeading(siblingHeading);
  bindModalEvents(block);

  const prevButton = block.querySelector('.testimonial-prev');
  const nextButton = block.querySelector('.testimonial-next');
  function handleNav(swiper) {
    const totalSlides = swiper.slides.length;



    let slidesPerView = swiper.params.slidesPerView;

    // ✅ correct way to get current slidesPerView
    if (typeof slidesPerView !== 'number') {
      slidesPerView = swiper.slidesPerViewDynamic();
    }

    // Hide arrows if not enough slides. With slidesPerView 'auto' (stories-variant)
    // a partly visible slide counts as "in view", so check scrollability instead.
    const cannotScroll = typeof swiper.params.slidesPerView === 'number'
      ? totalSlides <= slidesPerView
      : swiper.isBeginning && swiper.isEnd;
    if (cannotScroll) {
      prevButton.style.display = 'none';
      nextButton.style.display = 'none';
      return;
    }

    // Otherwise show and control disable
    prevButton.style.display = '';
    nextButton.style.display = '';

    prevButton.disabled = swiper.isBeginning;
    nextButton.disabled = swiper.isEnd;
  }
  /* Defer Swiper init until the carousel is about to enter the viewport.
   * Until then, the static slides render as a vertical stack (CSS shows just
   * the first one — see .testimonial-carousel:not(.swiper-ready) rules).
   * This keeps the ~150 ms of Swiper parse/init out of the LCP critical path
   * for users who land on the page; users who scroll get Swiper ready by the
   * time they reach this block (300 px rootMargin).
   */
  const initSwiper = async () => {
    if (block.dataset.swiperInitialized === 'true') return;
    block.dataset.swiperInitialized = 'true';

    const Swiper = await getSwiperClass();
    if (!Swiper) return;

    // stories-variant: card widths come from CSS (next card peeks in)
    const layout = isStories
      ? {
        slidesPerView: 'auto',
        spaceBetween: 16,
        breakpoints: { 900: { spaceBetween: 20 } },
      }
      : {
        slidesPerView: 1,
        spaceBetween: 20,
        breakpoints: {
          600: {
            slidesPerView: 1.1,
            spaceBetween: 20,
          },
          900: {
            slidesPerView: 2,
            spaceBetween: 20,
          },
          1200: {
            slidesPerView: 3,
            spaceBetween: 20,
          },
        },
      };

    const swiper = new Swiper(swiperEl, {
      ...layout,
      speed: 500,
      slidesPerGroup: 1,
      centeredSlides: false,
      slideToClickedSlide: false,
      touchRatio: 1,
      resistanceRatio: 0.85,
      threshold: 5,
      watchOverflow: false,
      navigation: {
        prevEl: prevButton,
        nextEl: nextButton,
      },
      pagination: {
        el: paginationEl,
        clickable: true,
      },
      on: {
        init(s) {
          block.classList.add('swiper-ready');
          // Swiper measured the slides while the pre-init CSS was still hiding
          // all but the first one; re-measure now that they are visible, or it
          // thinks there is nothing to scroll (arrows stay disabled)
          requestAnimationFrame(() => {
            s.update();
            handleNav(s);
          });
          handleNav(s);
        },
        slideChange(s) {
          handleNav(s);
        },
        resize(s) {
          handleNav(s);
        },
      },
    });

    block._testimonialSwiper = swiper;
    bindCarouselNavigationTracking(block, headingText);
  };

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries, obs) => {
      if (!entries[0].isIntersecting) return;
      obs.disconnect();
      initSwiper();
    }, { rootMargin: '300px 0px' });
    observer.observe(block);
  } else {
    /* No IntersectionObserver — init immediately to keep functionality. */
    initSwiper();
  }
}