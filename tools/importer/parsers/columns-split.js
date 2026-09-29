/* eslint-disable */
/* global WebImporter */

/**
 * Parser for columns-split block
 *
 * Source: https://www.asianpaints.com/inspiration/ideas/colour-inspiration.html
 * Base Block: columns
 *
 * Block Structure:
 * - Row 1: Image column | Text content column (eyebrow, heading, description, CTA)
 *
 * Source HTML Pattern:
 * <div class="columnCrosslinks">
 *   <div class="column-image">
 *     <img src="..." alt="...">
 *   </div>
 *   <div class="column-content">
 *     <span class="eyebrow">ASIAN PAINTS...</span>
 *     <h2>Heading</h2>
 *     <p>Description</p>
 *     <a href="...">CTA</a>
 *   </div>
 * </div>
 *
 * Generated: 2026-01-27
 */
export default function parse(element, { document }) {
  // Extract image
  const image = element.querySelector('img') ||
                element.querySelector('[class*="image"] img');

  // Extract eyebrow text
  const eyebrow = element.querySelector('.eyebrow') ||
                  element.querySelector('[class*="eyebrow"]') ||
                  element.querySelector('span:first-child');

  // Extract heading
  const heading = element.querySelector('h2') ||
                  element.querySelector('h3') ||
                  element.querySelector('[class*="title"]');

  // Extract description
  const description = element.querySelector('p') ||
                      element.querySelector('[class*="description"]');

  // Extract CTA link
  const ctaLink = element.querySelector('a.ctaText') ||
                  element.querySelector('a[href]');

  // Build image cell
  const imageCell = image ? [image] : [''];

  // Build content cell
  const contentCell = [];

  if (eyebrow) {
    const eyebrowText = document.createElement('p');
    eyebrowText.textContent = eyebrow.textContent.trim();
    contentCell.push(eyebrowText);
  }

  if (heading) {
    const h2 = document.createElement('h2');
    h2.textContent = heading.textContent.trim();
    contentCell.push(h2);
  }

  if (description) {
    const p = document.createElement('p');
    p.textContent = description.textContent.trim();
    contentCell.push(p);
  }

  if (ctaLink) {
    const strong = document.createElement('strong');
    const link = document.createElement('a');
    link.href = ctaLink.href;
    link.textContent = ctaLink.textContent.trim();
    strong.appendChild(link);
    contentCell.push(strong);
  }

  // Build cells array - 2 columns: image | content
  const cells = [
    [imageCell, contentCell]
  ];

  const block = WebImporter.Blocks.createBlock(document, { name: 'Columns-Split', cells });
  element.replaceWith(block);
}
