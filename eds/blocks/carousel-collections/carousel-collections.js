/*
 * Carousel Collections Block
 * Supports two variants:
 *
 * 1. Video Collage Variant (single row with video URLs + text):(REMOVED FROM PAGE AND CREATED NEW BLOCK)
 * <div class="carousel-collections">
 *   <div>
 *     <div>url1.webm url2.webm url3.webm url4.webm</div>  <!-- video URLs -->
 *     <div>Heading and CTA text</div>
 *   </div>
 * </div>
 *
 * 2. Image Card Carousel Variant (multiple rows with image + title):
 * <div class="carousel-collections">
 *   <div>
 *     <div><picture>image</picture></div>
 *     <div>Title</div>
 *   </div>
 *   <div>...</div>
 * </div>
 */

/**
 * Detect if block contains video URLs (video collage variant)
 */
function isVideoCollageVariant(block) {
  const rows = [...block.children];
  if (rows.length !== 1) return false;

  const firstCol = rows[0]?.children[0];
  if (!firstCol) return false;

  const text = firstCol.textContent.trim();
  return text.includes('.webm') || text.includes('.mp4');
}

/**
 * Extract video URLs from text content
 */
function extractVideoUrls(text) {
  // Split by whitespace and filter for video URLs
  return text.split(/\s+/).filter((url) => url.match(/\.(webm|mp4)$/i));
}

/**
 * Render video collage variant - carousel panel + 2x2 video grid + text panel
 */
function renderVideoCollage(block) {
  const row = block.children[0];
  const cols = [...row.children];
  if (cols.length < 2) return;

  const videoCol = cols[0];
  const textCol = cols[1];

  // Extract video URLs
  const videoUrls = extractVideoUrls(videoCol.textContent);

  // Create collage layout - 3 columns
  const collage = document.createElement('div');
  collage.className = 'carousel-collections-collage';

  // Left column - Carousel panel with branding card
  const carouselPanel = document.createElement('div');
  carouselPanel.className = 'carousel-collections-carousel-panel';

  // Branding card - "Royale Designer Palette"
  const brandCard = document.createElement('div');
  brandCard.className = 'carousel-collections-brand-card';

  const brandLogo = document.createElement('div');
  brandLogo.className = 'carousel-collections-brand-logo';
  brandLogo.textContent = 'Royale';

  const brandTagline = document.createElement('div');
  brandTagline.className = 'carousel-collections-brand-tagline';
  brandTagline.textContent = 'Designer Palette';

  brandCard.appendChild(brandLogo);
  brandCard.appendChild(brandTagline);
  carouselPanel.appendChild(brandCard);

  // Slides container
  const slides = document.createElement('div');
  slides.className = 'carousel-collections-slides';

  // Portrait image/video for carousel
  if (videoUrls.length > 0) {
    const portrait = document.createElement('div');
    portrait.className = 'carousel-collections-portrait';

    const video = document.createElement('video');
    video.src = videoUrls[0];
    video.autoplay = true;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;

    portrait.appendChild(video);
    slides.appendChild(portrait);
  }

  carouselPanel.appendChild(slides);

  // Pagination dots
  const dots = document.createElement('div');
  dots.className = 'carousel-collections-dots';

  for (let i = 0; i < Math.min(4, videoUrls.length); i += 1) {
    const dot = document.createElement('button');
    dot.className = 'carousel-collections-dot';
    if (i === 0) dot.classList.add('active');
    dot.setAttribute('aria-label', `Slide ${i + 1}`);
    dot.setAttribute('data-index', i);
    dots.appendChild(dot);
  }

  carouselPanel.appendChild(dots);

  // Middle column - Video grid (2x2)
  const videoGrid = document.createElement('div');
  videoGrid.className = 'carousel-collections-video-grid';

  videoUrls.slice(0, 4).forEach((url, index) => {
    const videoWrapper = document.createElement('div');
    videoWrapper.className = 'carousel-collections-video-item';

    const video = document.createElement('video');
    video.src = url;
    video.autoplay = true;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.setAttribute('data-index', index);

    videoWrapper.appendChild(video);
    videoGrid.appendChild(videoWrapper);
  });

  // Right column - Text content panel
  const textPanel = document.createElement('div');
  textPanel.className = 'carousel-collections-text-panel';

  // Parse text content - find strong elements for gradient text
  const strong = textCol.querySelector('strong');
  const link = textCol.querySelector('a');

  // "Get inspired by our" heading
  const heading = document.createElement('h2');
  heading.className = 'carousel-collections-heading';

  // Extract text before <strong>
  const beforeStrong = textCol.innerHTML.split('<strong>')[0];
  heading.textContent = beforeStrong.replace(/<[^>]*>/g, '').trim();
  textPanel.appendChild(heading);

  // Gradient text - "Exquisite Collections"
  if (strong) {
    const gradientText = document.createElement('div');
    gradientText.className = 'carousel-collections-gradient-text';
    gradientText.textContent = strong.textContent;
    textPanel.appendChild(gradientText);
  }

  // Description - text between strong and link
  const parts = textCol.innerHTML.split('</strong>');
  if (parts.length > 1) {
    const afterStrong = parts[1].split('<a')[0];
    const descText = afterStrong.replace(/<[^>]*>/g, '').trim();
    if (descText) {
      const description = document.createElement('p');
      description.className = 'carousel-collections-description';
      description.textContent = descText;
      textPanel.appendChild(description);
    }
  }

  // CTA button
  if (link) {
    const cta = document.createElement('a');
    cta.href = link.href;
    cta.className = 'carousel-collections-cta';
    cta.textContent = link.textContent;
    textPanel.appendChild(cta);
  }

  // Assemble collage: carousel panel + video grid + text panel
  collage.appendChild(carouselPanel);
  collage.appendChild(videoGrid);
  collage.appendChild(textPanel);

  // Clear and add collage
  block.textContent = '';
  block.classList.add('video-collage');
  block.appendChild(collage);

  // Add carousel interactivity
  const dotButtons = dots.querySelectorAll('.carousel-collections-dot');
  const portraitContainer = slides.querySelector('.carousel-collections-portrait');

  dotButtons.forEach((dot) => {
    dot.addEventListener('click', () => {
      const idx = parseInt(dot.getAttribute('data-index'), 10);

      // Update active dot
      dotButtons.forEach((d) => d.classList.remove('active'));
      dot.classList.add('active');

      // Update portrait video
      if (portraitContainer && videoUrls[idx]) {
        const video = portraitContainer.querySelector('video');
        if (video) {
          video.src = videoUrls[idx];
          video.play();
        }
      }
    });
  });
}

/**
 * Render image card carousel variant - horizontal scrolling cards
 */
function renderImageCarousel(block) {
  const rows = [...block.children];
  if (!rows.length) return;

  // Create carousel structure
  const carousel = document.createElement('div');
  carousel.className = 'carousel-collections-carousel';

  const track = document.createElement('div');
  track.className = 'carousel-collections-track';

  // Process each row as a card
  rows.forEach((row, index) => {
    const cols = [...row.children];
    if (cols.length < 2) return;

    const imageCol = cols[0];
    const titleCol = cols[1];

    // Create card
    const card = document.createElement('div');
    card.className = 'carousel-collections-card';
    card.setAttribute('data-index', index);

    // Image wrapper
    const imageWrapper = document.createElement('div');
    imageWrapper.className = 'carousel-collections-card-image';

    // Get image from first column
    const picture = imageCol.querySelector('picture');
    if (picture) {
      imageWrapper.appendChild(picture.cloneNode(true));
    }

    // Title overlay
    const titleOverlay = document.createElement('div');
    titleOverlay.className = 'carousel-collections-card-title';
    titleOverlay.textContent = titleCol.textContent.trim();

    card.appendChild(imageWrapper);
    card.appendChild(titleOverlay);
    track.appendChild(card);
  });

  carousel.appendChild(track);

  // Create pagination dots
  const pagination = document.createElement('div');
  pagination.className = 'carousel-collections-pagination';

  rows.forEach((_, index) => {
    const dot = document.createElement('button');
    dot.className = 'carousel-collections-dot';
    if (index === 0) dot.classList.add('active');
    dot.setAttribute('aria-label', `Go to slide ${index + 1}`);
    dot.setAttribute('data-index', index);
    pagination.appendChild(dot);
  });

  // Add interactivity
  let currentIndex = 0;
  const totalItems = rows.length;

  const updateCarousel = (newIndex) => {
    currentIndex = Math.max(0, Math.min(newIndex, totalItems - 1));
    const cards = track.querySelectorAll('.carousel-collections-card');
    const cardWidth = cards[0]?.offsetWidth || 300;
    const gap = 20;

    track.style.transform = `translateX(-${currentIndex * (cardWidth + gap)}px)`;

    // Update dots
    pagination.querySelectorAll('.carousel-collections-dot').forEach((dot, idx) => {
      dot.classList.toggle('active', idx === currentIndex);
    });
  };

  // Dot click handlers
  pagination.querySelectorAll('.carousel-collections-dot').forEach((dot) => {
    dot.addEventListener('click', () => {
      const idx = parseInt(dot.getAttribute('data-index'), 10);
      updateCarousel(idx);
    });
  });

  // Touch/swipe support
  let touchStartX = 0;
  let touchEndX = 0;

  track.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
  }, { passive: true });

  track.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    const diff = touchStartX - touchEndX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        updateCarousel(currentIndex + 1);
      } else {
        updateCarousel(currentIndex - 1);
      }
    }
  }, { passive: true });

  // Clear block and add carousel
  block.textContent = '';
  block.appendChild(carousel);
  block.appendChild(pagination);
}

export default function decorate(block) {
  if (isVideoCollageVariant(block)) {
    renderVideoCollage(block);
  } else {
    renderImageCarousel(block);
  }
}
