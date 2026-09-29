/* eslint-disable */
/* global WebImporter */

/**
 * Parser for carousel-cities block
 *
 * Source: https://www.asianpaints.com/painting-contractors.html
 * Base Block: carousel
 *
 * Block Structure:
 * - Each row: [city image, city name]
 *
 * Source HTML Pattern:
 * <div class="contractors-in-your-city">
 *   <h2 class="contractors-in-your-city-title">Find trusted contractors in your city</h2>
 *   <div class="contractors-in-your-city-cards">
 *     <div class="contractors-in-your-city-card">
 *       <a href="..." class="contractors-citycard-link">
 *         <picture class="contractors-in-your-city-card-img"><img src="..."></picture>
 *         <h4 class="contractors-in-your-city-card-title">Delhi</h4>
 *       </a>
 *     </div>
 *   </div>
 * </div>
 *
 * Generated: 2026-01-30
 */
export default function parse(element, { document }) {
  // Find all city cards
  const cityCards = element.querySelectorAll('.contractors-in-your-city-card');

  const cells = [];

  cityCards.forEach(card => {
    // Extract image
    const image = card.querySelector('picture img, img');

    // Extract city name
    const cityName = card.querySelector('.contractors-in-your-city-card-title, h4, h3');

    if (image && cityName) {
      const imageCell = image.cloneNode(true);

      // Create strong element for city name
      const strong = document.createElement('strong');
      strong.textContent = cityName.textContent.trim();

      cells.push([imageCell, strong]);
    }
  });

  // Create block
  const block = WebImporter.Blocks.createBlock(document, { name: 'Carousel-Cities', cells });
  element.replaceWith(block);
}
