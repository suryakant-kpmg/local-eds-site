/* eslint-disable */
/* global WebImporter */

/**
 * Parser for hero-form block
 *
 * Source: https://www.asianpaints.com/painting-contractors.html
 * Base Block: hero
 *
 * Block Structure:
 * - Row 1: [background image]
 * - Row 2: [heading + description, form fields]
 *
 * Source HTML Pattern:
 * <div class="miniform">
 *   <div class="mini-form-image-main-section">
 *     <picture><img src="..." alt="hero banner"></picture>
 *     <div class="find-contractor-form-container">
 *       <h1>Asian Paints Trusted Painting Contractors</h1>
 *       <p>Description text...</p>
 *       <form>
 *         <input name="name" placeholder="Name">
 *         <input name="phone" placeholder="Phone Number">
 *         <input name="city" placeholder="City">
 *         <button>Book a Free Consultation</button>
 *       </form>
 *     </div>
 *   </div>
 * </div>
 *
 * Generated: 2026-01-30
 */
export default function parse(element, { document }) {
  const cells = [];

  // Row 1: Background image
  const heroImage = element.querySelector('.mini-form-image-main-section img, picture img');
  if (heroImage) {
    cells.push([heroImage.cloneNode(true)]);
  }

  // Row 2: Content + Form fields
  const heading = element.querySelector('h1, .banner-title, [class*="title"]');
  const description = element.querySelector('.mini-form-image-main-section p, .banner-desc');

  // Build content cell
  const contentCell = [];
  if (heading) {
    const h1 = document.createElement('h1');
    const strong = document.createElement('strong');
    strong.textContent = heading.textContent.trim();
    h1.appendChild(strong);
    contentCell.push(h1);
  }
  if (description) {
    contentCell.push(description.cloneNode(true));
  }

  // Build form fields cell
  const formCell = [];
  const formInputs = element.querySelectorAll('input[placeholder], select');
  formInputs.forEach(input => {
    const placeholder = input.getAttribute('placeholder') || input.getAttribute('name') || '';
    if (placeholder) {
      const strong = document.createElement('strong');
      strong.textContent = placeholder;
      formCell.push(strong);
    }
  });

  // Add submit button
  const submitBtn = element.querySelector('button[type="submit"], .submit-btn, [class*="submit"]');
  if (submitBtn) {
    const link = document.createElement('a');
    link.href = '#';
    const strong = document.createElement('strong');
    strong.textContent = submitBtn.textContent.trim() || 'Submit';
    link.appendChild(strong);
    formCell.push(link);
  }

  if (contentCell.length > 0 || formCell.length > 0) {
    cells.push([contentCell, formCell]);
  }

  // Create block
  const block = WebImporter.Blocks.createBlock(document, { name: 'Hero-Form', cells });
  element.replaceWith(block);
}
