/*
** Authoring format **

Row 1 (Title)
Col 1 → Label "Title"
Col 2 → Section title (e.g. "Trending Now!")

Row 2 (Subtitle)
Col 1 → Label "Subtitle"
Col 2 → Subtitle text

Row 3 (CTA)
Col 1 → Label "CTA"
Col 2 → CTA link (e.g. "View Textures")

Row 4 onwards (one row per trending card)
Col 1 → Desktop image (picture) - tall image shown in the desktop card grid
Col 2 → Mobile image (picture) - shown in the mobile swiper (≤768px)
Col 3 → Card title (e.g. "Lattice Layer")
Col 4 → Card link (e.g. /interior-textures/lattice-link-imp1014cmb1007.html)
        - optional; when empty the card is not clickable (no hand cursor)

----------------------------------------
Variant: service-variant
(block authored as "carousel-trending (service-variant)")

Same authoring format as above. Title and subtitle are left-aligned (subtitle in grey),
and each card shows its title in a white box with an arrow icon at the bottom of the image
(e.g. "Our Services" → Interior Painting, Exterior Painting, Waterproofing Service ...)
*/

import {  trackEvent , pushAdobeCtaClickEvent } from '../../scripts/analytics_1.js';

// Get Swiper instance
async function getSwiper() {
  if (window.Swiper) return window.Swiper;
  if (window.loadSwiper) return window.loadSwiper();

  console.warn('Swiper not available');
  return null;
}

function normalizeButtonLink(href) {
  if (!href) return '';

  const lowerHref = href.toLowerCase();
  if (
    lowerHref.startsWith('mailto:')
    || lowerHref.startsWith('tel:')
    || lowerHref.startsWith('javascript:')
    || lowerHref.startsWith('#')
  ) {
    return href;
  }

  if (href.indexOf('.html') === -1) {
    return `${href}.html`;
  }

  return href;
}

// Desktop: animate each card when that card enters viewport
function createCardObserver($) {
  return new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;

      const $overlay = $(entry.target);
      if ($overlay.data('animated')) return;

      $overlay.data('animated', true);

      const index = $overlay.closest('.card').index();

      setTimeout(() => {
        $overlay.addClass('grow-image-bottom-to-top');
      }, 150 * index);

      observer.unobserve(entry.target);
    });
  }, {
    threshold: 0.2,
  });
}

// Mobile: animate all overlays once when whole swiper enters viewport
function createMobileObserver($, $container) {
  return new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;

      $container.find('.card-overlay').each(function (index) {
        const $overlay = $(this);
        if ($overlay.data('animated')) return;

        $overlay.data('animated', true);

        setTimeout(() => {
          $overlay.addClass('grow-image-bottom-to-top');
        }, 150 * index);
      });

      observer.unobserve(entry.target);
    });
  }, {
    threshold: 0.2,
  });
}

const HEADER_LABELS = ['title', 'subtitle', 'cta'];

// Returns the label of a Title / Subtitle / CTA row, or '' for a card row
function getRowLabel(row) {
  const cells = row.children;
  if (cells.length !== 2) return '';
  const label = cells[0].textContent.trim().toLowerCase();
  return HEADER_LABELS.includes(label) ? label : '';
}

function buildHeader($, rows) {
  const $header = $('<div class="carousel-trending-header"></div>');

  rows.forEach((row) => {
    const label = getRowLabel(row);
    if (!label) return;

    const $value = $(row.children[1]);
    const text = $value.text().trim();
    if (!text) return;

    if (label === 'title') {
      $header.append($('<h2 class="carousel-trending-title"></h2>').text(text));
    } else if (label === 'subtitle') {
      $header.append($('<p class="carousel-trending-subtitle"></p>').text(text));
    } else if (label === 'cta') {
      const $a = $value.find('a').first();
      if (!$a.length) return;
      const $cta = $('<a class="carousel-trending-cta"></a>')
        .attr('href', $a.attr('href'))
        .attr('title', $a.attr('title') || text)
        .text($a.text().trim());
      $header.append($('<div class="carousel-trending-cta-wrap"></div>').append($cta));
    }
  });

  return $header.children().length ? $header : null;
}

export default async function decorate(block) {
  // Wait for jQuery because it is lazy-loaded in EDS
  await window.loadJQuery?.();
  const $ = window.jQuery;

  const $block = $(block);
  const $header = buildHeader($, $block.children().toArray());
  const items = $block.children().toArray().filter((row) => !getRowLabel(row));

  const Swiper = await getSwiper();
  if (!Swiper) return;

  let swiper = null;
  let cardObserver = null;
  let mobileObserver = null;
  let mode = '';

  const bp = 768;
  const ns = `.carousel-${Date.now()}`;

  if (block.dataset.ctaTrackingBound !== 'true') {
    block.dataset.ctaTrackingBound = 'true';
    block.addEventListener('click', (event) => {
      const anchor = event.target.closest('.card-container a, .swiper a, .carousel-trending-cta');
      if (!anchor || !block.contains(anchor)) return;

      if (anchor.closest('.imageAccordion-withicon.flip-Image-OnHover')) {
        return;
      }

      event.preventDefault();

      const titleNode = anchor.querySelector('h3');
      const cardTitle = titleNode?.textContent?.trim() || '';
      // CTA button text (e.g. "View Textures") — look for the explicit button/link text
      // that is separate from the card heading; fall back to anchor text.
      const ctaEl = anchor.querySelector('.button, .cta, [class*="btn"]');
      const btnText = ctaEl?.textContent?.trim() || anchor.querySelector('p:last-child')?.textContent?.trim() || anchor.textContent.trim();
      const buttonLink = normalizeButtonLink(anchor.getAttribute('href') || '');
      const targetAttr = anchor.getAttribute('target') || '';

      // Section heading = parentTitle (eVar67); card title is the h3 inside the anchor
      const sectionHeading = block.closest('.section')?.querySelector('h2, h3, h4')?.textContent?.trim()
        || block.querySelector('h2, h3, h4')?.textContent?.trim()
        || cardTitle;

      // triggerCTAClickWithLinkAndTitle(buttonLink, btnText, sectionHeading);

      if (buttonLink) {
        if (targetAttr.indexOf('blank') > -1) {
          window.open(buttonLink, '_blank');
        } else {
          window.location.href = buttonLink;
        }
      }
    });
  }

  function resetObservers() {
    if (cardObserver) {
      cardObserver.disconnect();
      cardObserver = null;
    }

    if (mobileObserver) {
      mobileObserver.disconnect();
      mobileObserver = null;
    }
  }

  function destroySwiper() {
    if (swiper) {
      swiper.destroy(true, true);
      swiper = null;
    }
  }

  function makeCard(child, imgIndex, slide = false) {
    const $child = $(child);

    // Card link (Col 4) is optional - without it the card is not clickable
    const $a = $child.children().eq(3).find('a').first()
      .clone();
    const hasLink = $a.length > 0;

    const $img = $child.children().eq(imgIndex).clone().addClass('card-img');
    const $body = $child.children().eq(2).clone().addClass('card-body');
    const bodyText = $body.text().trim();
    $body.empty().append($('<div class="card-body-text"></div>').text(bodyText));
    const $overlay = $('<div class="card-overlay"></div>');
    const $card = $(`<div class="card${slide ? ' swiper-slide' : ''}${hasLink ? '' : ' no-link'}"></div>`);
    const $inner = hasLink ? $a.empty() : $('<div class="card-inner"></div>');

    $inner.append($img, $body);
    $card.append($inner, $overlay);

    $card[0].addEventListener('click', () => {
      const btnTitle = $card[0].querySelector('.card-body-text')?.textContent?.trim() || '';
      // anchor.href resolves to the absolute URL (with domain)
      const ctaLink = $card[0].querySelector('a')?.href || '';
      const parentTitle = block.querySelector('.carousel-trending-header .carousel-trending-title')?.textContent?.trim() || '';

      trackEvent('cta_link_text', {
        cta_: btnTitle,
        parentTitle,
        param1: ctaLink,
      });

      pushAdobeCtaClickEvent({
        cta: btnTitle,
        parentTitle,
        destinationUrl: ctaLink,
        event: 'cta_link_text',
      });


    });

    return $card;
  }

  function renderDesktop() {
    resetObservers();
    $block.empty();
    if ($header) $block.append($header);

    const $container = $('<div class="card-container"></div>');
    cardObserver = createCardObserver($);

    items.forEach((item) => {
      const $card = makeCard(item, 0, false);
      if ($card) {
        $container.append($card);
        const $overlay = $card.find('.card-overlay');
        if ($overlay.length) cardObserver.observe($overlay[0]);
      }
    });

    $block.append($container);
  }

  function renderMobile() {
    resetObservers();
    $block.empty();
    if ($header) $block.append($header);

    const $swiper = $('<div class="swiper"></div>');
    const $wrapper = $('<div class="swiper-wrapper"></div>');
    const $pagination = $('<div class="swiper-pagination"></div>');

    let slideCount = 0;

    items.forEach((item) => {
      const $card = makeCard(item, 1, true);
      if ($card) {
        $wrapper.append($card);
        slideCount += 1;
      }
    });

    $swiper.append($wrapper);
    $block.append($swiper, $pagination);

    // Init swiper after DOM is appended
    setTimeout(() => {
      swiper = new Swiper($swiper[0], {
        loop: slideCount > 1 && !$block.hasClass('service-variant'),
        slidesPerView: 1.2,
        spaceBetween: 10,
        pagination: {
          el: $pagination[0],
          clickable: true,
        },
        autoplay: false,
      });

      swiper.update();

      // Animate all mobile cards once when whole swiper enters viewport
      mobileObserver = createMobileObserver($, $swiper);
      mobileObserver.observe($swiper[0]);
    }, 0);
  }

  function update() {
    const nextMode = window.innerWidth <= bp ? 'mobile' : 'desktop';
    if (nextMode === mode) return;

    destroySwiper();

    if (nextMode === 'mobile') {
      renderMobile();
    } else {
      renderDesktop();
    }

    mode = nextMode;
  }

  update();

  $(window)
    .off(`resize${ns}`)
    .on(`resize${ns}`, update);
}
