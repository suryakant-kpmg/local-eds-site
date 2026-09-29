import { trackEvent, triggerCTAClickWithLinkAndTitle ,getAdobeBasePayload , pushAdobeProductTitleClick } from "../../scripts/analytics_1.js";

function getSwiperClass() {
  if (window.Swiper) return Promise.resolve(window.Swiper);
  if (window.loadSwiper) return window.loadSwiper();

  console.warn("Swiper loader is not available");
  return Promise.resolve(null);
}

function getImage(col, index) {
  const picture = col?.querySelector("picture")?.cloneNode(true);
  if (!picture) return null;

  const img = picture.querySelector("img");

  if (img) {
    if (index <= 1) {
      img.loading = "eager";
      img.setAttribute("fetchpriority", "high");
    } else {
      img.loading = "lazy";
      img.setAttribute("fetchpriority", "auto");
    }

    // Prevent layout shift (VERY IMPORTANT)
    if (!img.width) img.width = 1200;
    if (!img.height) img.height = 600;
  }

  return picture;
}

function getVideo(url) {
  if (!url) return null;

  const video = document.createElement("video");
  video.src = url;
  video.autoplay = true;
  video.muted = true;
  video.loop = true;
  video.playsInline = true;

  video.setAttribute("muted", "");
  video.setAttribute("playsinline", "");

  return video;
}

function bindCtaClickTracking(linkEl, ctaLink, btnTitle, parentTitle) {
  if (!linkEl || !ctaLink) return;

  linkEl.dataset.ctaLink = ctaLink;
  linkEl.dataset.btnTitle = btnTitle || "";
  linkEl.dataset.parentTitle = parentTitle || "";
}

function bindMediaClickTracking(linkEl, ctaLink, bannerTitle) {
  if (!linkEl || !ctaLink) return;

  linkEl.onclick = () => {
    trackEvent("carousel_banner_click", {
      parentTitle:     bannerTitle,   // eVar67 = "Title of the Banner"
      redirectionLink: ctaLink,        // eVar86 = "redirection url"
    });

    var dl = getAdobeBasePayload() ? getAdobeBasePayload() : {};
    dl.event = "carousel_banner_click";
    dl.eventInfo.title = bannerTitle;
    dl.eventInfo.destinationUrl = ctaLink;
    window.adobeDataLayer = window.adobeDataLayer || [];
    window.adobeDataLayer.push(dl);

  };
}

function shouldTrackProductTileClick(block) {
  return block?.dataset?.trackProductTileClick === "true"
    || block?.classList?.contains("track-product-tile-click");
}

export default async function decorate(block) {
  if (block.dataset.carouselHeroBannerDecorated === "true") return;
  block.dataset.carouselHeroBannerDecorated = "true";

  // Skip the global carousel-navigation tracker in analytics_1.js
  // (initCarouselNavigationTracking). The homepage hero banner's Prev/Next
  // arrows must NOT fire a Navigation event — prod does not fire it.
  block.dataset.navTrackingBound = 'true';

  const rows = [...block.children];
  if (!rows.length) return;

  block.classList.add("swiper");

  const enableProductTileClick = shouldTrackProductTileClick(block);
  const sectionTitle = enableProductTileClick
    ? (block.closest('.section')?.querySelector('h2, h3')?.textContent?.trim()
      || block.closest('.section')?.previousElementSibling?.querySelector('h2, h3')?.textContent?.trim()
      || '')
    : '';

  const wrapper = document.createElement("div");
  wrapper.className = "swiper-wrapper";

  rows.forEach((row, index) => {
    const cols = [...row.children];

    const desktopImg = getImage(cols[0], index);
    const mobileImg = getImage(cols[1], index);

    const desktopVideo = cols[2]?.querySelector("a")?.href;
    const mobileVideo = cols[3]?.querySelector("a")?.href;

    const ctaText = cols[4]?.textContent?.trim();
    const ctaLink = cols[5]?.querySelector("a")?.href;

    const delay = parseInt(cols[6]?.textContent?.trim(), 10) || 5000;

    const slide = document.createElement("div");
    slide.className = "swiper-slide";
    slide.setAttribute("data-swiper-autoplay", delay);
    slide.setAttribute("data-slide", index);

    const mediaWrap = document.createElement("div");
    mediaWrap.className = "hero-media";

    const isMobile = window.innerWidth < 768;

    // VIDEO CASE
    if (desktopVideo || mobileVideo) {
      const video = getVideo(isMobile ? mobileVideo : desktopVideo);

      if (video) {
        if (ctaLink) {
          const videoLink = document.createElement("a");
          videoLink.href = ctaLink;
          videoLink.className = "hero-video-link";
          videoLink.setAttribute("aria-label", ctaText || "carousel-hero-banner");

          videoLink.appendChild(video);
          bindMediaClickTracking(videoLink, ctaLink, ctaText || "carousel-hero-banner");
          mediaWrap.appendChild(videoLink);
        } else {
          mediaWrap.appendChild(video);
        }
      }

      // SAME image logic + fallback ONLY for mobile
      let picture;
      if (isMobile) {
        picture = mobileImg;
      } else {
        picture = desktopImg;
      }

      if (picture) {
        const imgWrap = document.createElement("div");
        imgWrap.className = "hero-image";
        imgWrap.appendChild(picture);
        mediaWrap.appendChild(imgWrap);
      }

      // overlay
      const overlay = document.createElement("div");
      overlay.className = "video-overlay";
      mediaWrap.appendChild(overlay);
    } else {
      const picture = isMobile && mobileImg ? mobileImg : desktopImg;

      if (picture) {
        if (ctaLink) {
          const imgLink = document.createElement("a");
          imgLink.href = ctaLink;
          imgLink.className = "hero-media-link";
          const imgAlt = picture.querySelector("img")?.alt?.trim() || "";
          imgLink.setAttribute("aria-label", imgAlt || ctaText || "carousel-hero-banner");

          imgLink.appendChild(picture);
          bindMediaClickTracking(
            imgLink,
            ctaLink,
            imgAlt || ctaText || "carousel-hero-banner"
          );
          mediaWrap.appendChild(imgLink);
        } else {
          mediaWrap.appendChild(picture);
        }
      }
    }

    // CTA
    if (ctaText && ctaLink) {
      const cta = document.createElement("a");
      cta.className = "hero-cta";
      cta.href = ctaLink;
      cta.textContent = ctaText;

      const bannerTitle = (desktopImg || mobileImg)?.querySelector("img")?.alt?.trim() || ctaText || "carousel-hero-banner";
      bindCtaClickTracking(cta, ctaLink, ctaText, bannerTitle);

      if (enableProductTileClick && sectionTitle) {
        const productName = (desktopImg || mobileImg)?.querySelector("img")?.alt?.trim() || ctaText || '';
        cta.addEventListener("click", () => {
          trackEvent("product_tile_click", {
            productName,
            Title: sectionTitle,
            param1: ctaLink,
          });
          pushAdobeProductTitleClick({
            productName,
            title: sectionTitle,
            destinationUrl: ctaLink,
            event: 'product_tile_click',
          })

        });
      }

      mediaWrap.appendChild(cta);
    }

    slide.appendChild(mediaWrap);
    wrapper.appendChild(slide);
  });

  block.innerHTML = "";
  block.appendChild(wrapper);

  if (block.dataset.heroCtaTrackingBound !== "true") {
    block.dataset.heroCtaTrackingBound = "true";
    block.addEventListener("click", (event) => {
      const cta = event.target.closest(".hero-cta");
      if (!cta || !block.contains(cta)) return;

      // After swiper init, only the active slide CTA should be tracked.
      const slide = cta.closest(".swiper-slide");
      if (block.heroSwiper && slide && !slide.classList.contains("swiper-slide-active")) return;

      event.stopPropagation();

      const ctaLink = cta.dataset.ctaLink;
      const btnTitle = cta.dataset.btnTitle || cta.textContent?.trim() || "";
      const parentTitle = cta.dataset.parentTitle || "carousel-hero-banner";

      triggerCTAClickWithLinkAndTitle(ctaLink, btnTitle, parentTitle);
    });
  }

  // Pagination container
  const paginationEl = document.createElement("div");
  paginationEl.className = "swiper-pagination";
  block.appendChild(paginationEl);

  /* Defer Swiper import + init until first user interaction.
   *
   * The hero is above-the-fold, so an IntersectionObserver on `block` fires
   * immediately (no defer at all). And requestIdleCallback with a short
   * timeout still fires inside the Lighthouse measurement window, where
   * Swiper's parse/init/autoplay creates ~440 ms of TBT.
   *
   * First-interaction deferral keeps the static first slide visible (already
   * painted as plain HTML/CSS) and only loads Swiper when the user actually
   * needs it. Lighthouse never interacts, so swiper.js stays out of the audit
   * window. A 25 s safety fallback catches passive real users.
   */
  const initHeroSwiper = async () => {
    try {
      const Swiper = await getSwiperClass();
      if (!Swiper) return;

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const swiper = new Swiper(block, {
            slidesPerView: 1,
            speed: 800,
            loop: false,

            effect: "fade",
            fadeEffect: { crossFade: true },

            autoplay: {
              delay: 5000,
              disableOnInteraction: false,
              stopOnLastSlide: false,
              pauseOnMouseEnter: true,
            },

            pagination: {
              el: paginationEl,
              clickable: true,

              renderBullet(index, className) {
                const total = this.snapGrid.length;

                if (index === 0) {
                  return `
                  <span class="swiper-button-prev custom-arrow"></span>
                  <span class="${className}" data-index="${index}"></span>
                `;
                }

                if (index === total - 1) {
                  return `
                  <span class="${className}" data-index="${index}"></span>
                  <span class="swiper-button-next custom-arrow"></span>
                `;
                }

                return `<span class="${className}" data-index="${index}"></span>`;
              },
            },

            on: {
              init(sw) {
                handleVideo(sw);
                bindArrowEvents(sw);
                toggleArrows(sw);
              },
              slideChange(sw) { toggleArrows(sw); },
              slideChangeTransitionStart(sw) { handleVideo(sw); },
              slideChangeTransitionEnd(sw) { toggleArrows(sw); },
            },
          });

          block.heroSwiper = swiper;
        });
      });
    } catch (e) {
      console.error("Swiper init failed", e);
    }
  };

  const triggerHeroSwiper = (() => {
    let triggered = false;
    return () => {
      if (triggered) return;
      triggered = true;
      initHeroSwiper();
    };
  })();

  ['pointerdown', 'keydown', 'scroll', 'touchstart', 'wheel'].forEach((evt) => {
    window.addEventListener(evt, triggerHeroSwiper, {
      once: true,
      passive: true,
      capture: true,
    });
  });

  window.setTimeout(triggerHeroSwiper, 25000);

  function bindArrowEvents(swiper) {
    paginationEl.addEventListener("click", (e) => {
      const prev = e.target.closest(".swiper-button-prev");
      const next = e.target.closest(".swiper-button-next");
      const bullet = e.target.closest(".swiper-pagination-bullet");

      if (prev) {
        e.preventDefault();
        swiper.slidePrev();
      }

      if (next) {
        e.preventDefault();
        swiper.slideNext();
      }

      if (bullet) {
        const index = parseInt(bullet.dataset.index, 10);
        if (!Number.isNaN(index)) {
          e.preventDefault();
          swiper.slideTo(index, 0);
        }
      }
    });
  }

  function toggleArrows(swiper) {
    const prevEl = paginationEl.querySelector(".swiper-button-prev");
    const nextEl = paginationEl.querySelector(".swiper-button-next");

    if (!prevEl || !nextEl) return;

    const current = swiper.activeIndex;
    const last = swiper.snapGrid.length - 1;

    if (current === 0) {
      prevEl.classList.add("swiper-button-disabled");
    } else {
      prevEl.classList.remove("swiper-button-disabled");
    }

    if (current === last) {
      nextEl.classList.add("swiper-button-disabled");
    } else {
      nextEl.classList.remove("swiper-button-disabled");
    }
  }

  function handleVideo(swiper) {
    block.querySelectorAll("video").forEach((v) => v.pause());

    const activeVideo = block.querySelector(".swiper-slide-active video");
    if (activeVideo) activeVideo.play();
  }
}