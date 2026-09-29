import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';
import { trackEvent, triggerCTAClickWithLinkAndTitle, ga4Implementaion, pushAdobeCtaClickEvent } from '../../scripts/analytics_1.js';

export default function decorate(block) {
  const isCta = block.classList.contains('cta');
  const isGrid = block.classList.contains('grid');
  const isStats = block.classList.contains('stats');
  const isServicesBlock = block.classList.contains('services');
  const isRoomBlock = block.classList.contains('room');
  const isBenefitsBlock = block.classList.contains('benefits');

  const ul = document.createElement('ul');

  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    moveInstrumentation(row, li);

    while (row.firstElementChild) li.append(row.firstElementChild);

    [...li.children].forEach((div) => {
      if (!isCta && div.children.length === 1 && div.querySelector('picture')) {
        div.className = 'cards-card-image';
      } else {
        div.className = 'cards-card-body';

        if (isStats) div.classList.add('content-wrapper');
      }
    });

    if ((isGrid || isServicesBlock) && li.children.length === 3 && li.children[1].classList.contains('cards-card-image')) {
      li.children[1].classList.add('mob-view');
    }

    if (isGrid) {
      const bodyWrapper = li.querySelector('.cards-card-body');
      const ctaLink = bodyWrapper?.querySelector('a[href]');

      if (ctaLink) {
        li.querySelectorAll('.cards-card-image').forEach((imageWrapper) => {
          if (imageWrapper.querySelector('a')) return;

          const imageLink = document.createElement('a');
          imageLink.href = ctaLink.href;
          imageLink.className = 'cards-card-image-link';

          if (ctaLink.target) imageLink.target = ctaLink.target;
          if (ctaLink.rel) imageLink.rel = ctaLink.rel;
          else if (ctaLink.target === '_blank') imageLink.rel = 'noopener noreferrer';

          while (imageWrapper.firstChild) {
            imageLink.append(imageWrapper.firstChild);
          }

          imageWrapper.append(imageLink);
        });
      }
    }

    if (isStats) {
      li.classList.add('data-parent-container');

      li.querySelectorAll('.cards-card-body.content-wrapper').forEach((body) => {
        const ps = body.querySelectorAll('p');
        if (ps[0]) ps[0].classList.add('title');
        if (ps[1]) ps[1].classList.add('sub-title');
      });
    }

    /* Room variant only: make image clickable using CTA link */
    if (isRoomBlock) {
      li.querySelectorAll('.cards-card-body p').forEach((p) => {
        const strong = p.querySelector('strong');
        const link = p.querySelector('a');

        if (strong && !strong.classList.contains('cards-card-title')) {
          strong.classList.add('cards-card-title');
        }

        if (!strong || !link || p.querySelector('.cards-card-description')) return;

        const nodes = [...p.childNodes];
        const descriptionWrapper = document.createElement('span');
        descriptionWrapper.className = 'cards-card-description';

        let shouldCollect = false;
        let hasDescriptionContent = false;

        nodes.forEach((node) => {
          if (node === strong) {
            shouldCollect = true;
            return;
          }

          if (node === link) {
            shouldCollect = false;
            return;
          }

          if (shouldCollect) {
            const clonedNode = node.cloneNode(true);

            if (
              (clonedNode.nodeType === Node.TEXT_NODE && clonedNode.textContent.trim())
              || clonedNode.nodeType === Node.ELEMENT_NODE
            ) {
              hasDescriptionContent = true;
            }

            descriptionWrapper.append(clonedNode);
            node.remove();
          }
        });

        if (hasDescriptionContent) {
          strong.insertAdjacentElement('afterend', descriptionWrapper);
        }
      });

      /* Room variant only: make image clickable using CTA link */
      const imageWrapper = li.querySelector('.cards-card-image');
      const bodyWrapper = li.querySelector('.cards-card-body');
      const ctaLink = bodyWrapper?.querySelector('a[href]');

      if (imageWrapper && ctaLink && !imageWrapper.querySelector('a')) {
        const imageLink = document.createElement('a');
        imageLink.href = ctaLink.href;

        if (ctaLink.target) imageLink.target = ctaLink.target;
        if (ctaLink.rel) {
          imageLink.rel = ctaLink.rel;
        } else if (ctaLink.target === '_blank') {
          imageLink.rel = 'noopener noreferrer';
        }

        imageLink.className = 'cards-card-image-link';

        while (imageWrapper.firstChild) {
          imageLink.append(imageWrapper.firstChild);
        }

        imageWrapper.append(imageLink);
      }
    }

    ul.append(li);
  });

  /* Identify the first grid image BEFORE the optimisation loop so we can
     set loading="eager" + fetchpriority="high" at creation time.
     Setting these attributes after the element is created has no effect
     because the browser commits to lazy-loading when the <img> is parsed.
     Pick the image that is actually visible — mob-view on mobile,
     desktop image on wider viewports — so we don't eagerly fetch a
     display:none image that blocks the network pipe. */
  // Matches the CSS breakpoint in cards.css (max-width: 992px) that swaps
  // to the mob-view image, so the LCP-candidate pick agrees with what is
  // actually visible.
  const isMobileViewport = window.innerWidth <= 992;

  const firstGridImg = isGrid
    ? ul.querySelector(isMobileViewport
      ? '.cards-card-image.mob-view img'
      : '.cards-card-image:not(.mob-view) img')
    : null;

  const imgWidth = '750';
  ul.querySelectorAll('picture > img').forEach((img) => {
    const isLCPCandidate = img === firstGridImg;
    const optimizedPic = createOptimizedPicture(
      img.src,
      img.alt,
      isLCPCandidate,
      [{ width: imgWidth }],
    );
    const optimizedImg = optimizedPic.querySelector('img');

    moveInstrumentation(img, optimizedImg);

    // Copy existing intrinsic dimensions if present
    const originalWidth = img.getAttribute('width') || img.naturalWidth;
    const originalHeight = img.getAttribute('height') || img.naturalHeight;

    if (originalWidth) optimizedImg.setAttribute('width', originalWidth);
    if (originalHeight) optimizedImg.setAttribute('height', originalHeight);

    optimizedImg.decoding = 'async';

    if (isLCPCandidate) {
      optimizedImg.loading = 'eager';
      optimizedImg.setAttribute('fetchpriority', 'high');
    } else {
      optimizedImg.loading = 'lazy';
      optimizedImg.setAttribute('fetchpriority', 'auto');
    }

    img.closest('picture').replaceWith(optimizedPic);
  });

  if (!isServicesBlock && !isRoomBlock && !isBenefitsBlock) {
    ul.querySelectorAll('.cards-card-body p').forEach((p) => {
      if (!p.querySelector('a')) return;

      [...p.childNodes].forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          node.remove();
        } else if (node.nodeType === Node.ELEMENT_NODE && node.tagName !== 'A') {
          node.remove();
        }
      });
    });
  }

  block.textContent = '';
  block.append(ul);

  const sectionTitle = block.closest('.section')?.querySelector('h1, h2, h3, h4, h5, h6')?.textContent?.trim() || '';

  ul.querySelectorAll('.cards-card-body a').forEach((cta) => {
    cta.addEventListener('click', () => {
      const ctaLink = cta.getAttribute('href') || '';
      const btnTitle = cta.textContent.trim();
      const body = cta.closest('.cards-card-body');
      const parentTitle = sectionTitle || body?.querySelector('h1, h2, h3, h4, h5, h6, p')?.textContent.trim() || '';
      const imageAlt = cta
        .closest('li')
        ?.querySelector('.cards-card-image img')
        ?.alt || '';
      ga4Implementaion({
        event: 'product_cards',
        click_text: btnTitle,
        click_category: imageAlt,
      });
      if (isRoomBlock && btnTitle.toLowerCase() === 'explore now') {
        const roomTitle = body?.querySelector('.cards-card-title')?.textContent.trim() || parentTitle;

        // cta_link_text (event143): cta_->eVar45, parentTitle->eVar67,
        // param1->eVar86. Using cta_link_text (not custom_link_text) so
        // parentTitle/param1 map to eVars instead of landing in contextData.
        trackEvent('cta_link_text', {
          cta_: btnTitle,
          parentTitle: roomTitle,
          param1: ctaLink,
        });
        pushAdobeCtaClickEvent({
          event: 'cta_link_text',
          cta: btnTitle,
          parentTitle: roomTitle,
          destinationUrl: ctaLink,
        })
        return;
      }

      triggerCTAClickWithLinkAndTitle(ctaLink, btnTitle, parentTitle);
    });
  });

  // Image link clicks
  ul.querySelectorAll('.cards-card-image-link').forEach((imageLink) => {
    imageLink.addEventListener('click', () => {
      const ctaLink = imageLink.getAttribute('href') || '';
      const li = imageLink.closest('li');
      const imageAlt = li?.querySelector('.cards-card-image img')?.alt || '';
      const btnTitle = li?.querySelector('.cards-card-body a')?.textContent.trim() || '';

      ga4Implementaion({
        event: 'product_cards',
        click_text: btnTitle,
        click_category: imageAlt,
      });

      // Room cards have a redirect on the image too — fire the same
      // cta_link_text (event143) so image clicks aren't lost in Adobe.
      if (isRoomBlock) {
        const body = li?.querySelector('.cards-card-body');
        const roomTitle = body?.querySelector('.cards-card-title')?.textContent.trim() || sectionTitle;
        trackEvent('cta_link_text', {
          cta_: btnTitle || 'Explore Now',
          parentTitle: roomTitle,
          param1: ctaLink,
        });
        return;
      }

      // Other card variants (e.g. grid) also have a redirect on the image.
      // Mirror the body CTA so the image click fires custom_cta_click
      // (event132) instead of being lost in Adobe.
      if (ctaLink) {
        const body = li?.querySelector('.cards-card-body');
        const parentTitle = sectionTitle
          || body?.querySelector('h1, h2, h3, h4, h5, h6, p')?.textContent.trim() || '';
        triggerCTAClickWithLinkAndTitle(ctaLink, btnTitle, parentTitle);
      }
    });
  });

  if (isServicesBlock) {
    const initServicesSwiper = async () => {
      // match the CSS slider breakpoint (width <= 899px)
      const isMobile = window.innerWidth < 900;

      // Mobile browsers fire resize when the URL bar collapses on scroll;
      // only rebuild when the breakpoint is actually crossed.
      if (ul.swiperInitInProgress || isMobile === !!ul.servicesSwiper) return;
      ul.swiperInitInProgress = true;

      if (ul.servicesSwiper) {
        ul.servicesSwiper.destroy(true, true);
        ul.servicesSwiper = null;
      }

      // slides may be nested inside a previous swiper-wrapper
      const slides = [...ul.querySelectorAll(':scope li')];

      ul.classList.remove('swiper');
      ul.querySelectorAll(':scope > .swiper-wrapper').forEach((w) => w.remove());
      slides.forEach((li) => {
        li.classList.remove('swiper-slide');
        li.removeAttribute('style');
        ul.appendChild(li);
      });

      if (!isMobile) {
        ul.swiperInitInProgress = false;
        return;
      }

      ul.classList.add('swiper');

      const wrapper = document.createElement('div');
      wrapper.className = 'swiper-wrapper';

      slides.forEach((li) => {
        li.classList.add('swiper-slide');
        wrapper.appendChild(li);
      });

      ul.appendChild(wrapper);

      let pagination = ul.parentElement.querySelector('.swiper-pagination');
      if (!pagination) {
        pagination = document.createElement('div');
        pagination.className = 'swiper-pagination';
        ul.parentElement.appendChild(pagination);
      }

      const Swiper = window.Swiper || (window.loadSwiper && await window.loadSwiper());
      if (!Swiper) {
        ul.swiperInitInProgress = false;
        return;
      }

      ul.servicesSwiper = new Swiper(ul, {
        slidesPerView: 'auto',
        spaceBetween: 10,
        loop: false,
        pagination: {
          el: pagination,
          clickable: true,
        },
      });
      ul.swiperInitInProgress = false;
    };

    initServicesSwiper();
    window.addEventListener('resize', initServicesSwiper);
  }
}
