/* eslint-disable */
/* global WebImporter */

/**
 * Parser for cards-blog block
 *
 * Source: https://www.asianpaints.com/inspiration/ideas/colour-inspiration.html
 * Base Block: cards
 *
 * Block Structure:
 * - Row 1-N: Image | Title, Read more link
 *
 * Source HTML Pattern:
 * <div class="blog-card">
 *   <img src="..." alt="...">
 *   <h3>Blog Title</h3>
 *   <a href="...">Read more</a>
 * </div>
 *
 * Generated: 2026-01-27
 */
export default function parse(element, { document }) {
  // Extract image
  const image = element.querySelector('img') ||
                element.querySelector('[class*="image"]');

  // Extract title
  const title = element.querySelector('h2, h3, h4') ||
                element.querySelector('[class*="title"]') ||
                element.querySelector('strong');

  // Extract link
  const link = element.querySelector('a[href]');

  // Build content cell
  const contentCell = [];

  if (title) {
    const strong = document.createElement('strong');
    strong.textContent = title.textContent.trim();
    contentCell.push(strong);
  }

  if (link) {
    const a = document.createElement('a');
    a.href = link.href;
    a.textContent = link.textContent.trim() || 'Read more';
    contentCell.push(a);
  }

  // Build cells array - 2 columns: image | content
  const cells = [
    [image || '', contentCell]
  ];

  const block = WebImporter.Blocks.createBlock(document, { name: 'Cards-Blog', cells });
  element.replaceWith(block);
}
