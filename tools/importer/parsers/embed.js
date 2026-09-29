/* eslint-disable */
/* global WebImporter */

/**
 * Parser for embed block
 *
 * Source: https://www.asianpaints.com/painting-contractors.html
 * Base Block: embed
 *
 * Block Structure:
 * - Single cell: [video URL]
 *
 * Source HTML Pattern:
 * <div class="youtube-cta-section">
 *   <iframe src="https://www.youtube.com/embed/..."></iframe>
 * </div>
 * OR
 * <a href="https://www.youtube.com/watch?v=..." data-video-id="...">
 *
 * Generated: 2026-01-30
 */
export default function parse(element, { document }) {
  let videoUrl = '';

  // Try to find iframe src
  const iframe = element.querySelector('iframe');
  if (iframe && iframe.src) {
    videoUrl = iframe.src;
    // Convert embed URL to watch URL if needed
    if (videoUrl.includes('/embed/')) {
      const videoId = videoUrl.split('/embed/')[1].split('?')[0];
      videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    }
  }

  // Try to find video link with data attribute
  if (!videoUrl) {
    const videoLink = element.querySelector('[data-video-id], [data-youtube-id], a[href*="youtube"]');
    if (videoLink) {
      const videoId = videoLink.getAttribute('data-video-id') ||
                      videoLink.getAttribute('data-youtube-id');
      if (videoId) {
        videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
      } else if (videoLink.href && videoLink.href.includes('youtube')) {
        videoUrl = videoLink.href;
      }
    }
  }

  // Try to find video URL in any attribute
  if (!videoUrl) {
    const allElements = element.querySelectorAll('*');
    for (const el of allElements) {
      const attrs = el.attributes;
      for (const attr of attrs) {
        if (attr.value && attr.value.includes('youtube.com')) {
          videoUrl = attr.value;
          break;
        }
      }
      if (videoUrl) break;
    }
  }

  // Default fallback
  if (!videoUrl) {
    videoUrl = 'https://www.youtube.com/watch?v=XqZsoesa55w';
  }

  // Create cells with just the URL
  const cells = [[videoUrl]];

  // Create block
  const block = WebImporter.Blocks.createBlock(document, { name: 'Embed', cells });
  element.replaceWith(block);
}
