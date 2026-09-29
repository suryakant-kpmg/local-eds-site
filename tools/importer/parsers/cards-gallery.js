/* eslint-disable */
/* global WebImporter */

/**
 * Parser for cards-gallery block
 *
 * Source: https://www.asianpaints.com/products/paints-and-textures/interior-walls/royale-play.html
 * Base Block: cards
 *
 * Block Structure:
 * - 2 columns: image | optional text
 * - Used for Italian Collection, LUXE Collection galleries
 *
 * Source HTML Pattern:
 * <div class="imageGrid">
 *   <div class="imageGrid-wraper">
 *     <div class="column">
 *       <div class="image">
 *         <picture><img src="texture.jpg"></picture>
 *       </div>
 *       <div class="heading">Title</div>
 *       <div class="description">Description</div>
 *     </div>
 *   </div>
 * </div>
 *
 * Generated: 2026-01-30
 */
export default function parse(element, { document }) {
  const cells = [];

  // Find all gallery items - they can be in columns or direct children
  const items = element.querySelectorAll('.imageGrid-wraper .column, .imageGrid .column, .imageGrid-wraper > div');

  items.forEach(item => {
    // Skip if it's just a wrapper without content
    if (!item.querySelector('img') && !item.querySelector('.heading')) return;

    // Extract image
    const image = item.querySelector('.image img, picture img, img');

    // Extract optional title/heading
    const headingEl = item.querySelector('.heading, h3, h4, .title');
    const heading = headingEl ? headingEl.textContent.trim() : '';

    // Extract optional description
    const descEl = item.querySelector('.description, .desc, p');
    const description = descEl ? descEl.textContent.trim() : '';

    if (image) {
      // Image cell
      const imageCell = document.createElement('div');
      const imgClone = image.cloneNode(true);
      imageCell.appendChild(imgClone);

      // Text cell (can be empty for pure image galleries)
      const textCell = document.createElement('div');
      if (heading) {
        const strong = document.createElement('strong');
        strong.textContent = heading;
        textCell.appendChild(strong);
      }
      if (description) {
        const p = document.createElement('p');
        p.textContent = description;
        textCell.appendChild(p);
      }

      cells.push([imageCell, textCell]);
    }
  });

  // Create block using WebImporter utility
  const block = WebImporter.Blocks.createBlock(document, { name: 'Cards-Gallery', cells });

  // Replace original element with structured block table
  element.replaceWith(block);
}
