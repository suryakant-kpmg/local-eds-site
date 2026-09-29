/* eslint-disable */
/* global WebImporter */

/**
 * Parser for carousel-collections block
 *
 * Source: https://www.asianpaints.com/products/paints-and-textures/interior-walls/royale-play.html
 * Base Block: carousel
 *
 * Block Structure:
 * - 2 columns: image | product name
 *
 * Source HTML Pattern:
 * <div class="imageaccordion">
 *   <ul class="img-side-by-side">
 *     <li>
 *       <picture>
 *         <img src="texture.jpg">
 *       </picture>
 *       <span class="title">Product Name</span>
 *     </li>
 *   </ul>
 * </div>
 *
 * Generated: 2026-01-30
 */
export default function parse(element, { document }) {
  const cells = [];

  // Find all collection items
  const items = element.querySelectorAll('.img-side-by-side li, .imageaccordion li');

  items.forEach(item => {
    // Extract image
    const image = item.querySelector('picture img, img');

    // Extract product name/title
    const titleEl = item.querySelector('.title, span.title, .heading, h3, h4');
    const title = titleEl ? titleEl.textContent.trim() : '';

    if (image || title) {
      // Image cell
      const imageCell = document.createElement('div');
      if (image) {
        const imgClone = image.cloneNode(true);
        imageCell.appendChild(imgClone);
      }

      // Title cell
      const titleCell = document.createElement('div');
      titleCell.textContent = title;

      cells.push([imageCell, titleCell]);
    }
  });

  // Create block using WebImporter utility
  const block = WebImporter.Blocks.createBlock(document, { name: 'Carousel-Collections', cells });

  // Replace original element with structured block table
  element.replaceWith(block);
}
