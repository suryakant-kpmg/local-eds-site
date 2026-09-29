/**
 * Service Steps block.
 *
 * Authoring model (Document Authoring). The first row holds the logo with its
 * desktop and mobile variants; every following row is classified by what it
 * contains, so authors can reorder rows and add or remove steps freely.
 *
 *   Row 1 (two cells) → | desktop logo image | mobile logo image |
 *   A row with only images (no text)         → background image
 *                                              | desktop image | mobile image |
 *   A row with a link to an .mp4            → background video (authorable)
 *   A row with only text (no link, no image) → heading
 *   A row with a single link                 → CTA button (in author order)
 *   A row with an image AND text             → a step (icon + description)
 *
 * If a cell holds several images, the last one wins, so an image added next
 * to an existing one replaces it. If only one of a desktop/mobile pair is
 * authored, it is shown at every viewport.
 *
 * Renders a left container (logo + CTA buttons) and a right container
 * (heading + steps) over an authored background image and/or video.
 */
function lastPicture(el) {
  const pics = el ? el.querySelectorAll('picture') : [];
  return pics.length ? pics[pics.length - 1] : null;
}

/**
 * Tags a desktop/mobile picture pair with viewport classes. A picture without
 * a partner gets no viewport class, so it stays visible everywhere.
 */
function tagPair(desktop, mobile, prefix) {
  if (desktop && mobile) {
    desktop.classList.add(`${prefix}-desktop`);
    mobile.classList.add(`${prefix}-mobile`);
  }
  return [desktop, mobile].filter(Boolean);
}

export default function decorate(block) {
  const rows = [...block.children];

  // --- Row 1: logo (desktop | mobile) -------------------------------------
  const logoRow = rows.shift();
  const logoCells = logoRow ? [...logoRow.children] : [];
  const desktopLogo = lastPicture(logoCells[0]);
  const mobileLogo = lastPicture(logoCells[1]);

  // --- Classify remaining rows --------------------------------------------
  let heading = '';
  let videoSrc = '';
  let bgDesktop = null;
  let bgMobile = null;
  const ctas = [];
  const steps = [];

  rows.forEach((row) => {
    const pic = lastPicture(row);
    const link = row.querySelector('a[href]');
    const text = row.textContent.trim();
    // A two-cell row with text is a step even while its image cell is empty,
    // so it never gets mistaken for the heading.
    const isStepRow = row.children.length > 1 && text && !link;

    if ((pic && text) || isStepRow) {
      // image + text → a step (icon + description)
      steps.push({ pic, text });
    } else if (pic) {
      // images only → background image (desktop | mobile)
      const cells = [...row.children];
      bgDesktop = lastPicture(cells[0]);
      bgMobile = cells.length > 1 ? lastPicture(cells[1]) : null;
    } else if (link && /\.mp4(\?|$)/i.test(link.href)) {
      // link to a video file → background video
      videoSrc = link.href;
    } else if (link) {
      // single link → CTA button
      ctas.push(link);
    } else if (text) {
      // text only → heading
      heading = text;
    }
  });

  // --- Build the new structure --------------------------------------------
  block.textContent = '';

  // Background layer: authored image(s) underneath an optional video. Falls
  // back to the CSS background colour when neither is provided.
  const bgPics = tagPair(bgDesktop, bgMobile, 'servicesteps-bg');
  if (bgPics.length || videoSrc) {
    const media = document.createElement('div');
    media.className = 'servicesteps-media';
    bgPics.forEach((pic) => {
      pic.classList.add('servicesteps-bg');
      media.append(pic);
    });
    if (videoSrc) {
      const video = document.createElement('video');
      video.className = 'servicesteps-video';
      video.src = videoSrc;
      video.autoplay = true;
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.setAttribute('muted', '');
      video.setAttribute('playsinline', '');
      video.setAttribute('aria-hidden', 'true');
      media.append(video);
    }
    block.append(media);
  }

  const content = document.createElement('div');
  content.className = 'servicesteps-content';

  // Left: logo + CTA buttons
  const left = document.createElement('div');
  left.className = 'servicesteps-left';

  const logos = tagPair(desktopLogo, mobileLogo, 'servicesteps-logo');
  if (logos.length) {
    const logoWrap = document.createElement('div');
    logoWrap.className = 'servicesteps-logo';
    logoWrap.append(...logos);
    left.append(logoWrap);
  }

  if (ctas.length) {
    const buttons = document.createElement('div');
    buttons.className = 'servicesteps-buttons';
    ctas.forEach((cta, i) => {
      // Downloadable links (PDFs / download attr) get the outlined + arrow-down
      // treatment; the first non-download CTA is the primary (yellow) button.
      const isDownload = cta.hasAttribute('download') || /\.pdf(\?|$)/i.test(cta.href);
      cta.classList.add('servicesteps-cta');
      if (isDownload) {
        cta.classList.add('servicesteps-cta-secondary', 'servicesteps-cta-download');
      } else {
        cta.classList.add(i === 0 ? 'servicesteps-cta-primary' : 'servicesteps-cta-secondary');
      }
      // Open external / download links in a new tab.
      try {
        const url = new URL(cta.href, window.location.href);
        if (url.origin !== window.location.origin) {
          cta.target = '_blank';
          cta.rel = 'noopener noreferrer';
        }
      } catch (e) {
        // leave malformed hrefs as-is
      }
      const wrap = document.createElement('div');
      wrap.className = 'servicesteps-button';
      wrap.append(cta);
      buttons.append(wrap);
    });
    left.append(buttons);
  }

  // Right: heading + steps
  const right = document.createElement('div');
  right.className = 'servicesteps-right';

  if (heading) {
    const h = document.createElement('div');
    h.className = 'servicesteps-heading';
    h.setAttribute('role', 'heading');
    h.setAttribute('aria-level', '2');
    h.textContent = heading;
    right.append(h);
  }

  if (steps.length) {
    const stepList = document.createElement('div');
    stepList.className = 'servicesteps-steps';
    steps.forEach(({ pic, text }) => {
      const step = document.createElement('div');
      step.className = 'servicesteps-step';
      step.setAttribute('role', 'figure');

      // The authored step artwork already includes its ring and number badge.
      if (pic) {
        const icon = document.createElement('div');
        icon.className = 'servicesteps-step-icon';
        icon.append(pic);
        step.append(icon);
      }

      const desc = document.createElement('div');
      desc.className = 'servicesteps-step-description';
      desc.textContent = text;

      step.append(desc);
      stepList.append(step);
    });
    right.append(stepList);
  }

  content.append(left, right);
  block.append(content);
}
