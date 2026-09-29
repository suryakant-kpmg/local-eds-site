/**
 * Asian Paints Footer Block
 * Content-driven: fetches /footer.plain.html and renders 5 sections
 * Mega Footer | Video Banner | Global Presence | Divisions | Bottom Bar
 * @param {Element} block The footer block element
 */

import { trackEvent, triggerCTAClickWithLinkAndTitle , pushAdobeSingleEvent , pushAdobeCtaClickEvent } from '../../scripts/analytics_1.js';

/* ---------- IMAGE FALLBACKS (local PNG images) ---------- */
const IMG = 'https://content.da.live/aemysites/asian-paints-demo/.footer';
const IMAGE_FALLBACKS = {
  'Asian Paints Logo': `${IMG}/ap-logo.png`,
  'Asian Paints': `${IMG}/ap-logo.png`,
  'Har Ghar Kuch Kehta Hai': `${IMG}/har-ghar-kuch-kehta-hai-desktop.png`,
  Global: `${IMG}/global.png`,
  Arabia: `${IMG}/arabia.png`,
  Bangladesh: `${IMG}/bangladesh.png`,
  Egypt: `${IMG}/egypt.png`,
  Ethiopia: `${IMG}/ethiopia.png`,
  Fiji: `${IMG}/fiji.png`,
  Nepal: `${IMG}/nepal.png`,
  'Sri Lanka': `${IMG}/sri-lanka.png`,
  Facebook: `${IMG}/facebook.png`,
  X: `${IMG}/x.png`,
  Instagram: `${IMG}/instagram.png`,
  YouTube: `${IMG}/youtube.png`,
  Pinterest: `${IMG}/pinterest.png`,
};

const FOOTER_BRAND_LOGO = 'https://static.asianpaints.com/content/dam/home-revamp/footer/ap-logo/ap-logo-footer.png';

/**
 * Fix broken images in parsed HTML fragment.
 * DA content sometimes has src="about:error" for images that weren't uploaded.
 * Replace with known CDN URLs based on alt text.
 */
function fixBrokenImages(fragment) {
  fragment.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src') || '';
    if (src === 'about:error' || !src || src === '') {
      const alt = img.getAttribute('alt') || '';
      const fallback = IMAGE_FALLBACKS[alt];
      if (fallback) {
        img.setAttribute('src', fallback);
      }
    }
  });
}

/* ---------- HELPERS ---------- */
function el(tag, attrs = {}, ...children) {
  const elem = document.createElement(tag);
  Object.entries(attrs).forEach(([key, val]) => {
    if (key === 'className') elem.className = val;
    else elem.setAttribute(key, val);
  });
  children.forEach((child) => {
    if (typeof child === 'string') elem.appendChild(document.createTextNode(child));
    else if (child) elem.appendChild(child);
  });
  return elem;
}

function getFooterVideoLink(cell) {
  return cell.querySelector('a[href*="youtube"], a[href*="youtu.be"]')?.href
    || 'https://www.youtube.com/watch?v=c6GKMQDYI1k';
}

function getYouTubeEmbedUrl(videoUrl) {
  try {
    const url = new URL(videoUrl, window.location.origin);
    let videoId = url.searchParams.get('v') || '';

    if (url.hostname.includes('youtu.be')) {
      videoId = url.pathname.split('/').filter(Boolean).pop() || '';
    } else if (url.pathname.startsWith('/embed/')) {
      [, , videoId] = url.pathname.split('/');
    }

    if (!videoId) return '';

    return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?autoplay=1&rel=0&playsinline=1`;
  } catch (e) {
    return '';
  }
}

function openFooterVideo(banner, videoUrl) {
  const player = banner.querySelector('.footer-video-player');
  const frame = banner.querySelector('.footer-video-embed');
  const embedUrl = getYouTubeEmbedUrl(videoUrl);

  if (!player || !frame || !embedUrl) return;

  frame.innerHTML = `
    <iframe
      src="${embedUrl}"
      title="Asian Paints footer video"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      referrerpolicy="strict-origin-when-cross-origin"
      allowfullscreen
    ></iframe>
  `;

  banner.classList.add('video-active');
  player.setAttribute('aria-hidden', 'false');
}

function closeFooterVideo(banner) {
  const player = banner.querySelector('.footer-video-player');
  const frame = banner.querySelector('.footer-video-embed');

  if (!player || !frame) return;

  banner.classList.remove('video-active');
  player.setAttribute('aria-hidden', 'true');
  frame.innerHTML = '';
}

/**
 * Parse link groups from a cell containing alternating title/link paragraphs.
 * DA format: <p>Title +</p> <p><a>link</a> <a>link</a>…</p>
 * @returns {Array<{title: string, links: Array<{text: string, href: string}>}>}
 */
function parseLinkGroups(cell) {
  const groups = [];
  const paras = [...cell.querySelectorAll(':scope > p')];
  let i = 0;
  while (i < paras.length) {
    const p = paras[i];
    const links = [...p.querySelectorAll('a')];
    const text = p.textContent.trim();

    if (links.length === 0 && text) {
      // Title paragraph (e.g. "Services +")
      const title = text.replace(/\s*\+\s*$/, '');
      i += 1;
      // Next paragraph should be links
      const linkPara = paras[i];
      const groupLinks = linkPara
        ? [...linkPara.querySelectorAll('a')].map((a) => ({
          text: a.textContent.trim(),
          href: a.getAttribute('href'),
        }))
        : [];
      groups.push({ title, links: groupLinks });
      i += 1;
    } else if (links.length > 0) {
      // Links paragraph without a preceding title (e.g. About section).
      // The "title" here is itself an authored link (e.g. "About Asianpaints")
      // and should redirect like the links below it, not just toggle an accordion.
      groups.push({
        title: links[0].textContent.trim(),
        href: links[0].getAttribute('href'),
        links: links.slice(1).map((a) => ({
          text: a.textContent.trim(),
          href: a.getAttribute('href'),
        })),
      });
      i += 1;
    } else {
      i += 1;
    }
  }
  return groups;
}

/* ---------- SECTION 1: MEGA FOOTER ---------- */
function buildBrandColumn(cell) {
  const col = el('div', { className: 'mega-col mega-col-brand' });

  // Logo — the <a> that wraps an <img> (not necessarily the first <a> in the cell)
  const logoImg = cell.querySelector('a img');
  const logoAnchor = logoImg?.closest('a');
  if (logoAnchor) {
    const logo = el('a', {
      href: logoAnchor.getAttribute('href') || '/',
      className: 'footer-brand-logo',
      'aria-label': 'Asian Paints Home',
    });
    logo.appendChild(el('img', {
      src: FOOTER_BRAND_LOGO,
      alt: logoImg.getAttribute('alt') || 'Asian Paints',
      width: '180',
      height: '63',
      loading: 'lazy',
    }));
    col.appendChild(logo);
  }

  // Contact — tel: and mailto: links
  const contact = el('div', { className: 'footer-brand-contact' });
  const allLinks = [...cell.querySelectorAll('a')];

  const phoneLink = allLinks.find((a) => a.getAttribute('href')?.startsWith('tel:'));
  if (phoneLink) {
    const phone = el('a', {
      href: phoneLink.getAttribute('href'),
      className: 'contact-row'
    });

    // tracking on actual clickable element
    phone.addEventListener('click', () => {
      trackEvent('footer_phone_number_click', {});
      pushAdobeSingleEvent('footer_phone_number_click');
    });

    // Phone icon
    phone.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none"><g clip-path="url(#clip0_18430_16866)"><g clip-path="url(#clip1_18430_16866)"><path d="M8.30004 4.07946C9.07381 4.20914 9.77663 4.57459 10.3377 5.13454C10.8989 5.6945 11.2621 6.39593 11.395 7.16809M8.41823 1.54785C9.79437 1.78068 11.0495 2.432 12.0477 3.42519C13.0458 4.42133 13.6955 5.67387 13.9288 7.04725M12.8538 12.5113C12.8538 12.5113 12.1067 13.2451 11.9236 13.4603C11.6253 13.7785 11.2739 13.9289 10.8132 13.9289C10.7689 13.9289 10.7217 13.9289 10.6774 13.9259C9.80028 13.8699 8.98519 13.528 8.37385 13.2363C6.70237 12.4287 5.23464 11.2823 4.01497 9.82938C3.00794 8.61804 2.33461 7.49817 1.88868 6.29571C1.61403 5.56188 1.51362 4.99013 1.55792 4.45079C1.58745 4.10598 1.72035 3.8201 1.96546 3.57549L2.9725 2.57051C3.1172 2.43494 3.27077 2.36126 3.42138 2.36126C3.60744 2.36126 3.75804 2.47326 3.85255 2.56757C3.8555 2.57051 3.85845 2.57346 3.8614 2.57641C4.04155 2.74439 4.21283 2.91828 4.39298 3.10395C4.48453 3.19826 4.57903 3.29256 4.67354 3.38982L5.47975 4.19439C5.79279 4.50679 5.79279 4.79562 5.47975 5.10801C5.39411 5.19348 5.31142 5.27895 5.22578 5.36147C4.97771 5.61492 5.17258 5.42045 4.91566 5.65033C4.90975 5.65622 4.90385 5.65916 4.90089 5.66506C4.64691 5.91852 4.69417 6.16608 4.74732 6.33406C4.75027 6.34291 4.75323 6.35175 4.75619 6.36059C4.96586 6.8675 5.26118 7.34492 5.71006 7.91376L5.71301 7.91668C6.5281 8.9187 7.38748 9.69971 8.33545 10.298C8.45649 10.3746 8.58053 10.4365 8.69872 10.4955C8.80501 10.5485 8.9054 10.5986 8.99103 10.6516C9.00286 10.6575 9.01468 10.6664 9.02651 10.6723C9.12689 10.7224 9.22143 10.746 9.31882 10.746C9.56397 10.746 9.71757 10.5927 9.76773 10.5426L10.3466 9.96489C10.447 9.86471 10.6065 9.74388 10.7926 9.74388C10.9757 9.74388 11.1263 9.8588 11.2178 9.95904C11.2207 9.96197 11.2207 9.96197 11.2237 9.96489L12.8509 11.5888C13.1551 11.8894 12.8538 12.5113 12.8538 12.5113Z" stroke="#232426" stroke-width="0.695652" stroke-linecap="round" stroke-linejoin="round"/></g></g><defs><clipPath id="clip0_18430_16866"><rect width="16" height="16" fill="white"/></clipPath><clipPath id="clip1_18430_16866"><rect width="16" height="16" fill="white"/></clipPath></defs></svg>';
    phone.appendChild(el('span', {}, phoneLink.textContent.trim()));

    contact.appendChild(phone);
  }

  const emailLink = allLinks.find((a) => a.getAttribute('href')?.startsWith('mailto:'));
  if (emailLink) {
    const email = el('a', { href: emailLink.getAttribute('href'), className: 'contact-row email-row' });

    // Mirrors the AMS-side footer email click event
    email.addEventListener('click', () => {
      trackEvent('footer_email_click');
      pushAdobeSingleEvent('footer_email_click');
    });

    // Email icon
    email.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none"><g clip-path="url(#clip0_18430_16874)"><path d="M2.66002 3.98799L7.73813 8.18658L13.179 3.98799M6.22658 7.73851L2.66002 11.6218M12.8163 11.3037L9.2493 7.73851M3.38547 12.2524C2.58416 12.2524 1.93457 11.5688 1.93457 10.7256V4.75137C1.93457 3.90816 2.58416 3.22461 3.38547 3.22461H12.0908C12.8921 3.22461 13.5417 3.90816 13.5417 4.75137V10.7256C13.5417 11.5688 12.8921 12.2524 12.0908 12.2524H3.38547Z" stroke="#232426" stroke-width="0.695652" stroke-linecap="round" stroke-linejoin="round"/></g><defs><clipPath id="clip0_18430_16874"><rect width="16" height="16" fill="white"/></clipPath></defs></svg>';
    const emailText = emailLink.textContent.trim();
    const normalizedEmailText = emailText.replace(/\s+/g, '');
    const emailLabel = el('span', { className: 'email-label' });

    if (normalizedEmailText.includes('@')) {
      const [localPart, domainPart] = normalizedEmailText.split('@');
      emailLabel.appendChild(el('span', { className: 'email-line' }, localPart));
      emailLabel.appendChild(el('span', { className: 'email-line' }, `@${domainPart}`));
    } else {
      emailLabel.appendChild(document.createTextNode(emailText));
    }

    email.appendChild(emailLabel);
    contact.appendChild(email);
  }
  col.appendChild(contact);

  // Public Notice — look for "Public Notice" text
  const paras = [...cell.querySelectorAll('p')];
  const noticeTitleP = paras.find((p) => p.textContent.trim().startsWith('Public Notice'));
  if (noticeTitleP) {
    const notice = el('div', { className: 'footer-public-notice' });
    notice.appendChild(el('div', { className: 'notice-label' }, noticeTitleP.textContent.trim()));
    const nextP = noticeTitleP.nextElementSibling;
    if (nextP && nextP.tagName === 'P') {
      notice.appendChild(el('p', { className: 'notice-body' }, nextP.textContent.trim()));
    }
    col.appendChild(notice);
  }

  return col;
}

function buildLinkGroup(group, options = {}) {
  const { isProductGroup = false } = options;
  const section = el('div', { className: 'link-group panel-group' });

  const header = el('div', {
    className: 'link-group-title group-header',
    'aria-expanded': 'false',
    role: 'button',
    tabindex: '0',
  });
  header.appendChild(el('div', {
    className: `group-title clickable-title${isProductGroup ? ' product-title' : ''}`,
  }, group.title));
  header.innerHTML += '<span class="accordion-icon">+</span><svg class="accordion-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>';
  section.appendChild(header);

  const list = el('div', { className: 'link-group-list group-links' });
  group.links.forEach((link) => {
    const item = el('div', { className: 'group-link' });
    item.appendChild(el('a', { href: link.href }, link.text));
    list.appendChild(item);
  });
  section.appendChild(list);

  return section;
}

function buildLinkColumnFromGroups(groups) {
  const col = el('div', { className: 'mega-col mega-col-links' });
  groups.forEach((group) => {
    const section = el('div', { className: 'link-group' });

    let header;
    if (group.href) {
      // Title is an authored redirect link (e.g. "About Asianpaints") —
      // render as a real link like the group-links below it, not an accordion toggle.
      header = el('a', { href: group.href, className: 'link-group-title' });
      header.appendChild(el('span', {}, group.title));
    } else {
      header = el('button', {
        className: 'link-group-title',
        'aria-expanded': 'false',
        type: 'button',
      });
      header.appendChild(el('span', {}, group.title));
      header.innerHTML += '<span class="accordion-icon">+</span>';
    }
    section.appendChild(header);

    const list = el('div', { className: 'link-group-list' });
    group.links.forEach((link) => {
      const item = el('div', { className: 'group-link' });
      item.appendChild(el('a', { href: link.href }, link.text));
      list.appendChild(item);
    });
    section.appendChild(list);
    col.appendChild(section);
  });
  return col;
}

function buildMegaFooter(container, row) {
  const cells = [...row.querySelectorAll(':scope > div')];
  if (cells.length < 2) return;

  const section = el('section', { className: 'footer-mega', 'aria-label': 'Footer navigation' });
  const inner = el('div', { className: 'footer-mega-inner' });
  const grid = el('div', { className: 'mega-grid' });

  // Zone 1: Brand column (left — white text on grey)
  grid.appendChild(buildBrandColumn(cells[0]));

  // Parse groups from cells
  const linkGroups = parseLinkGroups(cells[1]);
  const aboutGroups = cells[2] ? parseLinkGroups(cells[2]) : [];

  // Zone 2: Center block (white background with link columns)
  const center = el('div', { className: 'mega-center' });
  const centerNav = el('nav', { className: 'mega-center-grid footer-col col-two' });

  const panelLeft = el('div', { className: 'panel-section panel-left mega-col-links' });
  linkGroups.slice(0, 2).forEach((group) => {
    panelLeft.appendChild(buildLinkGroup(group));
  });
  if (panelLeft.children.length) centerNav.appendChild(panelLeft);

  const panelMiddle = el('div', { className: 'panel-section panel-middle mega-col-links' });
  linkGroups.slice(2, 3).forEach((group) => {
    panelMiddle.appendChild(buildLinkGroup(group));
  });
  if (panelMiddle.children.length) centerNav.appendChild(panelMiddle);

  const panelRight = el('div', { className: 'panel-section panel-right mega-col-links' });
  const rightInner = el('div', { className: 'right-inner' });

  const rightColPrimary = el('div', { className: 'right-col' });
  linkGroups.slice(3, 5).forEach((group) => {
    rightColPrimary.appendChild(buildLinkGroup(group, { isProductGroup: true }));
  });
  if (rightColPrimary.children.length) rightInner.appendChild(rightColPrimary);

  const rightColSecondary = el('div', { className: 'right-col' });
  linkGroups.slice(5).forEach((group) => {
    rightColSecondary.appendChild(buildLinkGroup(group, { isProductGroup: true }));
  });
  if (rightColSecondary.children.length) rightInner.appendChild(rightColSecondary);

  if (rightInner.children.length) {
    panelRight.appendChild(rightInner);
    centerNav.appendChild(panelRight);
  }

  center.appendChild(centerNav);
  grid.appendChild(center);

  // Zone 3: About column (right — white text on grey)
  if (aboutGroups.length > 0) {
    const aboutCol = buildLinkColumnFromGroups(aboutGroups);
    aboutCol.classList.add('mega-col-about');
    grid.appendChild(aboutCol);
  }

  inner.appendChild(grid);
  section.appendChild(inner);
  container.appendChild(section);
}

/* ---------- SECTION 2: VIDEO BANNER ---------- */
function buildVideoBanner(container, row) {
  if (!row) return;
  const cell = row.querySelector(':scope > div') || row;
  const videoUrl = getFooterVideoLink(cell);

  const banner = el('section', { className: 'footer-video-banner' });
  const mediaBg = el('div', { className: 'video-bg' });

  // DA authoring convention for the video-banner row, in document order:
  //   1st image  → desktop banner (background image)
  //   2nd image  → mobile banner variant
  //   3rd image  → WATCH NOW play button icon
  const allImgs = [...cell.querySelectorAll('img')];

  const desktopImg = allImgs[0];
  const mobileImg = allImgs[1];
  const playIconImg = allImgs[2];

  if (desktopImg) {
    const pic = document.createElement('picture');
    const desktopSrc = (desktopImg.getAttribute('src') || '').split('?')[0];

    if (mobileImg?.getAttribute('src')) {
      const mobileSrc = mobileImg.getAttribute('src').split('?')[0];
      pic.appendChild(el('source', {
        media: '(max-width: 767px)',
        srcset: mobileSrc,
      }));
    }

    const imgEl = el('img', {
      src: desktopSrc,
      alt: desktopImg.getAttribute('alt') || 'Har Ghar Kuch Kehta Hai',
      loading: 'lazy',
    });

    pic.appendChild(imgEl);
    mediaBg.appendChild(pic);
  }
  banner.appendChild(mediaBg);

  // Gradient overlay
  banner.appendChild(el('div', { className: 'video-gradient' }));

  // CTA overlay — WATCH NOW play button.
  // Prefer the DA-authored play icon (from `<picture>` clone → optimized
  // media pipeline). Fall back to the shared IMG asset only when the
  // authoring is missing so the CTA still renders.
  const ctaText = 'WATCH NOW';
  const overlay = el('div', { className: 'video-overlay' });
  const cta = el('button', {
    className: 'watch-now-btn',
    'aria-label': `${ctaText} on YouTube`,
    type: 'button',
  });

  const authoredIconPicture = playIconImg?.closest('picture');
  if (authoredIconPicture) {
    const iconPic = authoredIconPicture.cloneNode(true);
    iconPic.classList.add('yt-icon');
    const iconImg = iconPic.querySelector('img');
    if (iconImg) {
      iconImg.classList.add('yt-icon');
      iconImg.setAttribute('alt', iconImg.getAttribute('alt') || 'YouTube');
      iconImg.setAttribute('loading', 'lazy');
    }
    cta.appendChild(iconPic);
  } else {
    cta.innerHTML = `<img class="yt-icon" src="${IMG}/youtube-logo.png" alt="YouTube" width="64" height="64">`;
  }

  cta.appendChild(el('span', {}, ctaText));
  cta.addEventListener('click', () => {
    trackEvent('video_playbotton_click', {
      videoTitle: cta.getAttribute('aria-label') || '',
    });
    pushAdobeCtaClickEvent({
      event: 'video_playbotton_click',
      title: cta.getAttribute('aria-label') || '',
    })
    openFooterVideo(banner, videoUrl);
  });
  overlay.appendChild(cta);
  banner.appendChild(overlay);

  const player = el('div', {
    className: 'footer-video-player',
    'aria-hidden': 'true',
  });
  const closeButton = el('button', {
    className: 'footer-video-close',
    type: 'button',
    'aria-label': 'Close footer video',
  });
  const frame = el('div', { className: 'footer-video-frame' });
  const embed = el('div', { className: 'footer-video-embed' });

  closeButton.addEventListener('click', () => {
    closeFooterVideo(banner);
  });

  player.addEventListener('click', (event) => {
    if (event.target === player) {
      closeFooterVideo(banner);
    }
  });

  frame.append(closeButton, embed);
  player.append(frame);
  banner.appendChild(player);

  container.appendChild(banner);
}

/* ---------- SECTION 3: GLOBAL PRESENCE ---------- */
function buildGlobalPresence(container, row) {
  if (!row) return;
  const cells = [...row.querySelectorAll(':scope > div')];

  const wrapper = el('section', { className: 'footer-global', 'aria-label': 'Our Global Presence' });
  const inner = el('div', { className: 'footer-global-inner' });

  // Title from first cell
  const titleText = cells[0]?.textContent.trim() || 'OUR GLOBAL PRESENCE';
  const titleRow = el('div', { className: 'section-title-row' });
  titleRow.appendChild(el('span', { className: 'title-line' }));
  titleRow.appendChild(el('h3', { className: 'section-title' }, titleText));
  titleRow.appendChild(el('span', { className: 'title-line' }));
  inner.appendChild(titleRow);

  // Country items from second cell.
  // DA authoring is inconsistent — the country name appears as:
  //  1. Text before <br> in the same <p> as the anchor: <p>Global<br><a>flag</a></p>
  //  2. Preceding text-only <p>: <p>Arabia</p><p><a>flag</a></p>
  //  3. Text node after a preceding anchor: <p><a>bd-flag</a> Egypt<br><a>eg-flag</a></p>
  // img alt is always empty in the current DA content.
  const contentCell = cells[1] || cells[0];
  const countries = el('div', { className: 'country-list' });

  // Walk childNodes of the parent <p> backwards from the anchor,
  // skip <br> elements, and return the first non-empty text node.
  // Falls back to the preceding text-only sibling <p>.
  const getCountryName = (anchor) => {
    const p = anchor.closest('p');
    if (!p) return '';
    const nodes = Array.from(p.childNodes);
    const anchorIdx = nodes.indexOf(anchor);
    for (let i = anchorIdx - 1; i >= 0; i -= 1) {
      const node = nodes[i];
      if (node.nodeName === 'BR') continue; // eslint-disable-line no-continue
      if (node.nodeType === Node.TEXT_NODE) {
        const t = node.textContent.trim();
        if (t) return t;
      }
      break; // stop at any other element (e.g. another <a>)
    }
    // Check preceding sibling <p> with no anchor
    const prev = p.previousElementSibling;
    if (prev && prev.tagName === 'P' && !prev.querySelector('a')) {
      const t = prev.textContent.trim();
      if (t) return t;
    }
    return anchor.querySelector('img')?.getAttribute('alt') || '';
  };

  const anchors = [...contentCell.querySelectorAll('a')];
  anchors.forEach((a) => {
    const img = a.querySelector('img');
    if (!img) return;
    const href = a.getAttribute('href') || '#';
    const name = getCountryName(a);
    const item = el('a', {
      href,
      className: 'country-item',
      target: '_blank',
      rel: 'noopener',
      'aria-label': name,
    });
    item.appendChild(el('img', {
      src: img.getAttribute('src'),
      alt: '',
      width: '32',
      height: '32',
      loading: 'lazy',
      className: 'country-flag',
    }));
    item.appendChild(el('span', { className: 'country-name track_countryName' }, name));
    countries.appendChild(item);
  });
  inner.appendChild(countries);

  wrapper.appendChild(inner);
  container.appendChild(wrapper);
}

/* ---------- SECTION 4: DIVISIONS ---------- */
function buildDivisions(container, row) {
  if (!row) return;
  const cells = [...row.querySelectorAll(':scope > div')];

  const wrapper = el('section', { className: 'footer-divisions', 'aria-label': 'Our Divisions' });
  const inner = el('div', { className: 'footer-divisions-inner' });

  // Title from first cell
  const titleText = cells[0]?.textContent.trim() || 'OUR DIVISIONS';
  const titleRow = el('div', { className: 'section-title-row' });
  titleRow.appendChild(el('span', { className: 'title-line' }));
  titleRow.appendChild(el('h3', { className: 'section-title' }, titleText));
  titleRow.appendChild(el('span', { className: 'title-line' }));
  inner.appendChild(titleRow);

  // Division logos from second cell — <a> with <picture>/<img>
  const contentCell = cells[1] || cells[0];
  const logos = el('div', { className: 'division-logos' });
  const anchors = [...contentCell.querySelectorAll('a')];
  anchors.forEach((a) => {
    const img = a.querySelector('img');
    if (!img) return;
    const link = el('a', {
      href: a.getAttribute('href') || '#',
      className: 'division-logo',
      'aria-label': img.getAttribute('alt') || '',
      target: '_blank',
      rel: 'noopener',
    });
    link.appendChild(el('img', {
      src: img.getAttribute('src'),
      alt: img.getAttribute('alt') || '',
      loading: 'lazy',
      height: '50',
    }));
    logos.appendChild(link);
  });
  inner.appendChild(logos);

  wrapper.appendChild(inner);
  container.appendChild(wrapper);
}

/* ---------- SECTION 5: BOTTOM BAR ---------- */
function buildBottomBar(container, row) {
  if (!row) return;
  const cells = [...row.querySelectorAll(':scope > div')];

  const bottom = el('section', { className: 'footer-bottom', 'aria-label': 'Footer info' });
  const inner = el('div', { className: 'footer-bottom-inner' });

  // Cell 0: Social icons
  if (cells[0]) {
    const social = el('div', { className: 'bottom-social' });
    [...cells[0].querySelectorAll('a')].forEach((a) => {
      const img = a.querySelector('img');
      if (!img) return;
      const platformName = img.getAttribute('alt') || '';
      const link = el('a', {
        href: a.getAttribute('href'),
        className: 'social-icon',
        'aria-label': platformName,
        'data-attr-platform': platformName,
        target: '_blank',
        rel: 'noopener',
      });
      link.appendChild(el('img', {
        src: img.getAttribute('src'),
        alt: img.getAttribute('alt') || '',
        width: '28',
        height: '28',
        loading: 'lazy',
      }));
      social.appendChild(link);
    });
    inner.appendChild(social);
  }

  // Cell 1: Copyright
  if (cells[1]) {
    const copy = el('div', { className: 'bottom-copyright' });
    copy.textContent = cells[1].textContent.trim();
    inner.appendChild(copy);
  }

  // Cell 2: Sitemap
  if (cells[2]) {
    const sitemap = el('div', { className: 'bottom-sitemap' });
    const sitemapLink = cells[2].querySelector('a');
    if (sitemapLink) {
      const a = el('a', { href: sitemapLink.getAttribute('href') });
      a.innerHTML = 'Sitemap <span class="sitemap-arrow">&rsaquo;</span>';
      sitemap.appendChild(a);
    }
    inner.appendChild(sitemap);
  }

  bottom.appendChild(inner);
  container.appendChild(bottom);
}

/* ---------- MOBILE ACCORDION ---------- */
function initMobileAccordions(block) {
  const titles = block.querySelectorAll('.mega-center .link-group-title');
  const toggleGroup = (btn) => {
    if (window.innerWidth >= 1024) return;
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    titles.forEach((other) => {
      other.setAttribute('aria-expanded', 'false');
      other.nextElementSibling.style.display = 'none';
      other.querySelector('.accordion-icon')?.classList.remove('open');
    });
    if (!expanded) {
      btn.setAttribute('aria-expanded', 'true');
      const list = btn.nextElementSibling;
      list.style.display = 'block';
      btn.querySelector('.accordion-icon')?.classList.add('open');
    }
  };

  titles.forEach((btn) => {
    btn.addEventListener('click', () => {
      toggleGroup(btn);
    });

    btn.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      toggleGroup(btn);
    });
  });

  const mq = window.matchMedia('(min-width: 1024px)');
  mq.addEventListener('change', (e) => {
    titles.forEach((btn) => {
      if (e.matches) {
        btn.nextElementSibling.style.display = '';
        btn.setAttribute('aria-expanded', 'false');
        btn.querySelector('.accordion-icon')?.classList.remove('open');
      } else {
        btn.nextElementSibling.style.display = 'none';
      }
    });
  });

  if (window.innerWidth < 1024) {
    titles.forEach((btn) => {
      btn.nextElementSibling.style.display = 'none';
      btn.setAttribute('aria-expanded', 'false');
      btn.querySelector('.accordion-icon')?.classList.remove('open');
    });
  }
}

function initFooterTabTracking(block) {
  const centerGrid = block.querySelector('.mega-center-grid');
  if (!centerGrid || centerGrid.dataset.footerTabBound === 'true') return;

  centerGrid.dataset.footerTabBound = 'true';
  centerGrid.addEventListener('click', (event) => {
    const link = event.target.closest('.link-group-list a');
    if (!link || !centerGrid.contains(link)) return;

    const parentTitle = link.closest('.link-group')
      ?.querySelector(':scope > .link-group-title .group-title')
      ?.textContent
      ?.trim() || 'footer';
    const ctaLink = link.getAttribute('href') || '';

    triggerCTAClickWithLinkAndTitle(ctaLink, link.textContent.trim(), parentTitle);
  });
}

function initFooterAboutTabTracking(block) {
  const aboutLinks = '.mega-col.mega-col-links.mega-col-about .link-group-list a, '
    + '.mega-col.mega-col-links.mega-col-about a.link-group-title';
  block.querySelectorAll(aboutLinks).forEach((link) => {
    link.addEventListener('click', () => {
      trackEvent('footer_tab', {
        cta_: link.textContent.trim(),
      });
      pushAdobeCtaClickEvent({
        event: 'footer_tab',
        cta: link.textContent.trim()
      })
    });
  });
}

function initFooterSitemapTracking(block) {
  block.querySelectorAll('.bottom-sitemap a').forEach((link) => {
    link.addEventListener('click', () => {
      trackEvent('custom_cta_click', {
        cta_: link.textContent.trim(),
        parentTitle: 'footer',
        redirectionLink: link.getAttribute('href') || '',
      });

      pushAdobeCtaClickEvent({
        event: 'custom_cta_click',
        cta: link.textContent.trim(),
        parentTitle: 'footer',
        destinationUrl: link.getAttribute('href') || '',
      })

    });
  });
}

function initFooterCountryTracking(block) {
  block.querySelectorAll('.country-list a').forEach((link) => {
    link.addEventListener('click', () => {
      const countryName = link.querySelector('.track_countryName')?.textContent?.trim() || '';

      trackEvent('footer_country', {
        cta_: countryName,
      });

      pushAdobeCtaClickEvent({
        event: 'footer_country',
        cta: countryName,
      })

    });
  });
}

function initFooterDivisionTracking(block) {
  block.querySelectorAll('.division-logos a').forEach((link) => {
    link.addEventListener('click', () => {
      // aria-label is set from img.alt — strip any file extension (e.g. "sleek.png" → "sleek")
      const rawLabel = link.getAttribute('aria-label') || link.textContent.trim();
      const ctaTitle = rawLabel.replace(/\.[a-z]{2,4}$/i, '').trim();
      const ctaLink = link.getAttribute('href') || '';
      // parentTitle: read section heading from DOM ("OUR DIVISIONS") instead of hardcoded 'footer'
      const sectionTitle = link.closest('.footer-divisions')
        ?.querySelector('.section-title')?.textContent?.trim() || 'OUR DIVISIONS';
      triggerCTAClickWithLinkAndTitle(ctaLink, ctaTitle, sectionTitle);
    });
  });
}

function initFooterSocialTracking(block) {
  block.querySelectorAll('.bottom-social a').forEach((link) => {
    link.addEventListener('click', () => {
      // Lowercase to match the live site's eVar52 value (e.g. "facebook").
      const platform = (link.getAttribute('data-attr-platform') || '').toLowerCase();
      trackEvent('footer_socialicons', {
        platform,
      });
      pushAdobeCtaClickEvent({
        event: 'footer_socialicons',
        cta: platform,
      })
    });
  });
}

function initFooterVideoBanner(block) {
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;

    block.querySelectorAll('.footer-video-banner.video-active').forEach((banner) => {
      closeFooterVideo(banner);
    });
  });
}

/* ---------- DECORATE ---------- */
export default async function decorate(block) {
  const resp = await fetch('/footer.plain.html');
  if (!resp.ok) {
    console.warn(`footer: /footer.plain.html returned ${resp.status}; footer left empty`);
    return;
  }

  const html = await resp.text();
  const fragment = document.createElement('div');
  fragment.innerHTML = html;

  // Fix broken image sources before processing
  fixBrokenImages(fragment);

  // Find the footer block wrapper — DA content has <div class="footer-wrapper">
  const wrapper = fragment.querySelector('.footer-wrapper') || fragment;

  // Rows = direct div children of the wrapper (5 rows)
  const rows = [...wrapper.querySelectorAll(':scope > div')];

  block.textContent = '';
  const footerContent = el('div', { className: 'footer-content' });

  // Row 0: Mega Footer (brand + links + about)
  if (rows[0]) buildMegaFooter(footerContent, rows[0]);

  // Row 1: Video Banner
  if (rows[1]) buildVideoBanner(footerContent, rows[1]);

  // Row 2 + 3: Global Presence & Divisions (side-by-side on mobile)
  const globalDivGrid = el('div', { className: 'footer-global-divisions' });
  if (rows[2]) buildGlobalPresence(globalDivGrid, rows[2]);
  if (rows[3]) buildDivisions(globalDivGrid, rows[3]);
  footerContent.appendChild(globalDivGrid);

  // Row 4: Bottom Bar
  if (rows[4]) buildBottomBar(footerContent, rows[4]);

  block.append(footerContent);
  initMobileAccordions(block);
  initFooterTabTracking(block);
  initFooterAboutTabTracking(block);
  initFooterSitemapTracking(block);
  initFooterCountryTracking(block);
  initFooterDivisionTracking(block);
  initFooterSocialTracking(block);
  initFooterVideoBanner(block);
}
