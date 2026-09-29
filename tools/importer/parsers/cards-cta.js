/* eslint-disable */
/* global WebImporter */

/**
 * Parser for cards-cta block
 *
 * Source: https://www.asianpaints.com/inspiration/ideas/colour-inspiration.html
 * Base Block: cards
 *
 * Block Structure:
 * - Row 1-N: Title, Description, Link (no images)
 *
 * Source HTML Pattern:
 * <a class="columnCrosslinks__item" href="...">
 *   <h3>Title</h3>
 *   <p>Description</p>
 * </a>
 *
 * Generated: 2026-01-27
 */
export default function parse(element, { document }) {
  // Extract title
  const title = element.querySelector('h2, h3, h4') ||
                element.querySelector('[class*="title"]') ||
                element.querySelector('strong');

  // Extract description
  const description = element.querySelector('p') ||
                      element.querySelector('[class*="description"]') ||
                      element.querySelector('[class*="text"]');

  // Extract link (element itself might be the link)
  const link = element.tagName === 'A' ? element : element.querySelector('a[href]');

  // Build content cell
  const contentCell = [];

  if (title) {
    const strong = document.createElement('strong');
    strong.textContent = title.textContent.trim();
    contentCell.push(strong);
  }

  if (description) {
    const p = document.createElement('p');
    p.textContent = description.textContent.trim();
    contentCell.push(p);
  }

  if (link) {
    const a = document.createElement('a');
    a.href = link.href;
    a.textContent = 'Learn more';
    contentCell.push(a);
  }

  // Build cells array - single column (no images)
  const cells = [
    contentCell
  ];

  const block = WebImporter.Blocks.createBlock(document, { name: 'Cards-Cta', cells });
  element.replaceWith(block);
}
