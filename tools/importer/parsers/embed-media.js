/* eslint-disable */
/* global WebImporter */

/**
 * Parser for embed-media block
 *
 * Source: https://www.asianpaints.com/products/paints-and-textures/interior-walls/royale-play.html
 * Base Block: embed
 *
 * Block Structure:
 * - 1 column: media content (image, GIF, video, or embed URL)
 *
 * Source HTML Pattern:
 * <div class="imageBanner-fullwidth">
 *   <picture>
 *     <img src="playlist.gif">
 *   </picture>
 *   or
 *   <video src="video.mp4"></video>
 *   or
 *   <iframe src="embed-url"></iframe>
 * </div>
 *
 * Generated: 2026-01-30
 */
export default function parse(element, { document }) {
  const cells = [];

  // Check for different media types

  // 1. Image/GIF
  const image = element.querySelector('picture img, img');

  // 2. Video
  const video = element.querySelector('video');

  // 3. Iframe embed
  const iframe = element.querySelector('iframe');

  // Create media cell
  const mediaCell = document.createElement('div');

  if (video) {
    // Clone video element
    const videoClone = video.cloneNode(true);
    mediaCell.appendChild(videoClone);
    cells.push([mediaCell]);
  } else if (iframe) {
    // Extract iframe src as a link
    const src = iframe.getAttribute('src');
    if (src) {
      const link = document.createElement('a');
      link.href = src;
      link.textContent = src;
      mediaCell.appendChild(link);
      cells.push([mediaCell]);
    }
  } else if (image) {
    // Clone image
    const imgClone = image.cloneNode(true);
    mediaCell.appendChild(imgClone);
    cells.push([mediaCell]);
  }

  // Create block using WebImporter utility
  const block = WebImporter.Blocks.createBlock(document, { name: 'Embed-Media', cells });

  // Replace original element with structured block table
  element.replaceWith(block);
}
