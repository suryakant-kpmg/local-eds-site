/* eslint-disable */
/* global WebImporter */

/**
 * Parser for testimonial-carousel block
 *
 * Source: https://www.asianpaints.com/painting-contractors.html
 * Base Block: carousel
 *
 * Block Structure:
 * - Each row: [customer photo, testimonial text + name + location]
 *
 * Source HTML Pattern:
 * <div class="testimonial-image-section">
 *   <div class="carousel-image"><img src="..."></div>
 *   <div class="testimonial-content">
 *     <p>Testimonial text...</p>
 *     <strong>Customer Name</strong>, Location
 *   </div>
 * </div>
 *
 * Generated: 2026-01-30
 */
export default function parse(element, { document }) {
  // Find all testimonial slides
  const slides = element.querySelectorAll('.testimonial-image-section, [class*="testimonial-slide"]');

  const cells = [];

  slides.forEach(slide => {
    // Extract customer photo
    const image = slide.querySelector('.carousel-image img, img');

    // Extract testimonial content
    const testimonialText = slide.querySelector('p, [class*="testimonial-text"], [class*="review"]');
    const customerName = slide.querySelector('strong, [class*="name"], h4');
    const location = slide.querySelector('[class*="location"], span');

    if (image || testimonialText) {
      const imageCell = image ? image.cloneNode(true) : '';

      const contentCell = [];

      // Add testimonial text
      if (testimonialText) {
        contentCell.push(testimonialText.cloneNode(true));
      }

      // Add customer name and location
      if (customerName) {
        const nameEl = document.createElement('strong');
        let nameText = customerName.textContent.trim();

        // Append location if separate
        if (location && location !== customerName) {
          nameText += ', ' + location.textContent.trim();
        }
        nameEl.textContent = nameText;
        contentCell.push(nameEl);
      }

      cells.push([imageCell, contentCell]);
    }
  });

  // Create block
  const block = WebImporter.Blocks.createBlock(document, { name: 'Testimonial-Carousel', cells });
  element.replaceWith(block);
}
