/* eslint-disable */
/* global WebImporter */

/**
 * Parser for carousel-hero block
 *
 * Source: https://www.asianpaints.com/products/paints-and-textures/interior-walls/royale-play.html
 * Base Block: carousel
 *
 * Block Structure:
 * - Row 1: Block name
 * - Row 2+: Background image, then content (logo, heading, CTA)
 *
 * Source HTML Pattern:
 * <div class="bannercarousel">
 *   <div class="js-carouselWithText carouselWithText">
 *     <div class="bannerImgWithLeftTextComp slick-slide">
 *       <a class="full-width">
 *         <picture class="prodBannerImage">
 *           <img src="background.jpg">
 *         </picture>
 *         <picture class="banner-logo-image">
 *           <img src="logo.png">
 *         </picture>
 *         <picture class="banner-text-image">
 *           <img src="text-image.png">
 *         </picture>
 *       </a>
 *       <div class="bannerTextDesc">
 *         <div class="packshotImage1 image"><img></div>
 *         <div class="packshotText1 text">
 *           <p class="title">Heading</p>
 *           <p class="desc">Description</p>
 *         </div>
 *         <div class="packshotCta1 cta"><a>CTA</a></div>
 *       </div>
 *     </div>
 *   </div>
 * </div>
 *
 * Generated: 2026-01-30
 */
export default function parse(element, { document }) {
  const cells = [];

  // Find all slides in the carousel
  const slides = element.querySelectorAll('.bannerImgWithLeftTextComp, .slick-slide:not(.slick-cloned)');

  slides.forEach(slide => {
    // Skip cloned slides (for infinite scroll)
    if (slide.classList.contains('slick-cloned')) return;

    // Extract background image
    const bgImage = slide.querySelector('.prodBannerImage img, picture.prodBannerImage img');

    // Extract logo image
    const logoImage = slide.querySelector('.banner-logo-image img, .packshotImage1 img, .packshotImage2 img');

    // Extract text image (like "Tactile Celebration")
    const textImage = slide.querySelector('.banner-text-image img');

    // Extract title and description
    const titleEl = slide.querySelector('.title, .packshotText1 .title, .packshotText2 .title');
    const descEl = slide.querySelector('.desc, .packshotText1 .desc, .packshotText2 .desc');

    // Extract CTA link
    const ctaLink = slide.querySelector('.cta a, .packshotCta1 a, .packshotCta2 a, .download-pdf-button-section a');

    // Create slide row
    const slideContent = document.createElement('div');

    // Add background image row first
    if (bgImage) {
      const bgRow = document.createElement('p');
      const bgImgClone = bgImage.cloneNode(true);
      bgRow.appendChild(bgImgClone);
      cells.push([bgRow]);
    }

    // Build content cell
    if (logoImage) {
      const logoClone = logoImage.cloneNode(true);
      slideContent.appendChild(logoClone);
      slideContent.appendChild(document.createElement('br'));
    }

    if (textImage) {
      const textImgClone = textImage.cloneNode(true);
      slideContent.appendChild(textImgClone);
      slideContent.appendChild(document.createElement('br'));
    }

    if (titleEl) {
      const titleText = titleEl.textContent.trim();
      if (titleText) {
        const h2 = document.createElement('h2');
        h2.innerHTML = titleText.replace('<br>', ' ');
        slideContent.appendChild(h2);
      }
    }

    if (descEl) {
      const descText = descEl.textContent.trim();
      if (descText) {
        const p = document.createElement('p');
        p.textContent = descText;
        slideContent.appendChild(p);
      }
    }

    if (ctaLink) {
      const href = ctaLink.getAttribute('href') || '';
      const text = ctaLink.textContent.trim() || 'Explore Now';
      if (href && href !== 'javascript:void(0)') {
        const ctaP = document.createElement('p');
        const strong = document.createElement('strong');
        const a = document.createElement('a');
        a.href = href;
        a.textContent = text;
        strong.appendChild(a);
        ctaP.appendChild(strong);
        slideContent.appendChild(ctaP);
      }
    }

    // Add content row
    if (slideContent.children.length > 0) {
      cells.push([slideContent]);
    }
  });

  // Create block using WebImporter utility
  const block = WebImporter.Blocks.createBlock(document, { name: 'Carousel-Hero', cells });

  // Replace original element with structured block table
  element.replaceWith(block);
}
