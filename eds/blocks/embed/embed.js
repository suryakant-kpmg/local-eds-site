import { getDigitalData, trackEvent, pushAdobeCtaClickEvent } from '../../scripts/analytics_1.js';

/*
 * Embed Block
 * Show videos and social posts directly on your page
 * https://www.hlx.live/developer/block-collection/embed
 *
 * Variants:
 * - default: standard embed (YouTube, Vimeo, Twitter, iframe)
 * - media: adds direct video file support, image-only banners, autoplay/loop/muted options
 */

/*
** Authoring format (default variant) **

Each row is a label / value pair. Col 1 is the label, Col 2 is the value.
Only the Play icon label is read by code (must contain "play").

Row 1 (Video Link)
Col 2 → YouTube / Vimeo / Twitter URL (link)

Row 2 (Desktop Thumbnail)
Col 2 → Desktop placeholder image (picture)

Row 3 (Mobile Thumbnail)
Col 2 → Mobile placeholder image (picture)

Row 4 (Play icon)
Col 2 → Play icon image (picture), rendered inside the play button

Notes:
- The first link found in the block is used as the video URL.
- Pictures are picked up in row order: 1st → desktop, 2nd → mobile.
  If only one picture is authored it is used for all screen sizes.
- Thumbnail rows are optional; without them the video loads lazily
  when the block scrolls into view.
- Clicking the placeholder loads the embed with autoplay.
*/

const loadScript = (url, callback, type) => {
  const head = document.querySelector('head');
  const script = document.createElement('script');
  script.src = url;
  if (type) {
    script.setAttribute('type', type);
  }
  script.onload = callback;
  head.append(script);
  return script;
};

const getDefaultEmbed = (url) => `<div style="left: 0; width: 100%; height: 0; position: relative; padding-bottom: 56.25%;">
    <iframe src="${url.href}" style="border: 0; top: 0; left: 0; width: 100%; height: 100%; position: absolute;" allowfullscreen=""
      scrolling="no" allow="encrypted-media" title="Content from ${url.hostname}" loading="lazy">
    </iframe>
  </div>`;

const embedYoutube = (url, autoplay) => {
  const usp = new URLSearchParams(url.search);
  const suffix = autoplay ? '&muted=1&autoplay=1' : '';
  let vid = usp.get('v') ? encodeURIComponent(usp.get('v')) : '';
  const embed = url.pathname;
  if (url.origin.includes('youtu.be')) {
    [, vid] = url.pathname.split('/');
  }
  return `<div style="left: 0; width: 100%; height: 0; position: relative; padding-bottom: 56.25%;">
      <iframe src="https://www.youtube.com${vid ? `/embed/${vid}?rel=0&v=${vid}${suffix}` : embed}" style="border: 0; top: 0; left: 0; width: 100%; height: 100%; position: absolute;"
      allow="autoplay; fullscreen; picture-in-picture; encrypted-media; accelerometer; gyroscope; picture-in-picture" allowfullscreen="" scrolling="no" title="Content from Youtube" loading="lazy"></iframe>
    </div>`;
};

const embedVimeo = (url, autoplay) => {
  const [, video] = url.pathname.split('/');
  const suffix = autoplay ? '?muted=1&autoplay=1' : '';
  return `<div style="left: 0; width: 100%; height: 0; position: relative; padding-bottom: 56.25%;">
      <iframe src="https://player.vimeo.com/video/${video}${suffix}"
      style="border: 0; top: 0; left: 0; width: 100%; height: 100%; position: absolute;"
      frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen
      title="Content from Vimeo" loading="lazy"></iframe>
    </div>`;
};

const embedTwitter = (url) => {
  if (!url.href.startsWith('https://twitter.com')) {
    url.href = url.href.replace('https://x.com', 'https://twitter.com');
  }
  const embedHTML = `<blockquote class="twitter-tweet"><a href="${url.href}"></a></blockquote>`;
  loadScript('https://platform.twitter.com/widgets.js');
  return embedHTML;
};

const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.ogg', '.mov'];

const isVideoFile = (url) => VIDEO_EXTENSIONS.some(
  (ext) => url.pathname.toLowerCase().endsWith(ext),
);

function getVideoTitleFromUrl(url) {
  const fileName = url.pathname.split('/').pop() || '';
  return decodeURIComponent(fileName).replace(/\.[^.]+$/, '');
}

function trackVideoPlayButtonClick(wrapper) {
  const videoTitle = wrapper?.getAttribute('aria-label') || '';
  trackEvent('video_playbotton_click', { videoTitle });
  pushAdobeCtaClickEvent({
    event: 'video_playbotton_click',
    title: videoTitle,
  });
}

const embedVideo = (url, options = {}) => {
  const { autoplay, loop, muted } = options;
  const videoTitle = getVideoTitleFromUrl(url);
  const attrs = [
    'playsinline',
    autoplay ? 'autoplay' : '',
    loop ? 'loop' : '',
    muted ? 'muted' : '',
    'controls',
  ].filter(Boolean).join(' ');

  return `<div class="embed-media-video-wrapper youtube-cta-section" aria-label="${videoTitle}">
    <video ${attrs} preload="metadata">
      <source src="${url.href}" type="video/${url.pathname.split('.').pop()}">
      Your browser does not support the video tag.
    </video>
  </div>`;
};

const EMBEDS_CONFIG = [
  { match: ['youtube', 'youtu.be'], embed: embedYoutube },
  { match: ['vimeo'], embed: embedVimeo },
  { match: ['twitter', 'x.com'], embed: embedTwitter },
];

function trackYoutubePlay(block, link) {
  const videoPlayUrl = block.closest('.video-elem__wrapper')
    ?.querySelector('.video-elem__player')
    ?.getAttribute('data-video-key')
    || link
    || '';

  if (!videoPlayUrl) return;

  getDigitalData().data = {
    url: videoPlayUrl,
  };

  trackEvent('youtube_play', { url: videoPlayUrl });
  pushAdobeCtaClickEvent({
    event: 'youtube_play',
    destinationUrl: videoPlayUrl,
  });

}

const loadEmbed = (block, link, autoplay, options = {}) => {
  if (block.classList.contains('embed-is-loaded')) return;

  const config = EMBEDS_CONFIG.find((e) => e.match.some((match) => link.includes(match)));
  const url = new URL(link);
  const isMedia = block.classList.contains('media');

  if (isMedia && isVideoFile(url)) {
    block.innerHTML = embedVideo(url, {
      autoplay: autoplay || options.autoplay,
      loop: options.loop,
      muted: options.muted,
    });
    const videoWrapper = block.querySelector('.youtube-cta-section');
    if (videoWrapper && videoWrapper.dataset.videoPlayButtonTracked !== 'true') {
      videoWrapper.dataset.videoPlayButtonTracked = 'true';
      videoWrapper.addEventListener('click', () => {
        trackVideoPlayButtonClick(videoWrapper);
      });
    }
    block.classList.add('embed-video');
  } else if (config) {
    block.innerHTML = config.embed(url, autoplay);
    block.classList.add(`embed-${config.match[0]}`);
  } else {
    block.innerHTML = getDefaultEmbed(url);
  }
  block.classList.add('embed-is-loaded');
};

export default function decorate(block) {
  const isMedia = block.classList.contains('media');
  const rows = [...block.querySelectorAll(':scope > div')];

  let link = '';
  const placeholders = [];
  let playIcon = null;

  rows.forEach((row) => {
    const a = row.querySelector('a');
    if (a && !link) {
      link = a.href;
    }
    const pics = [...row.querySelectorAll('picture')];
    if (pics.length === 0) return;
    const label = row.firstElementChild?.textContent.trim().toLowerCase() || '';
    if (!isMedia && !playIcon && label.includes('play')) {
      [playIcon] = pics;
    } else {
      placeholders.push(...pics);
    }
  });

  // Fallback for media variant if link not found in <a>
  if (!link && isMedia) link = block.textContent.trim();

  const options = isMedia ? {
    autoplay: block.classList.contains('autoplay'),
    loop: block.classList.contains('loop'),
    muted: block.classList.contains('muted'),
  } : {};

  if (isMedia && (!link || (!link.startsWith('http')))) {
    if (placeholders.length > 0) {
      block.textContent = '';
      const wrapper = document.createElement('div');
      wrapper.className = 'embed-media-image-only';
      wrapper.appendChild(placeholders[0]);
      block.appendChild(wrapper);
      block.classList.add('embed-media-banner');
    }
    return;
  }

  block.textContent = '';

  if (isMedia) {
    try {
      const url = new URL(link);
      if (isVideoFile(url) && options.autoplay) {
        loadEmbed(block, link, true, options);
        return;
      }
    } catch (e) {
      // invalid URL
    }
  }

  if (placeholders.length > 0) {
    const wrapper = document.createElement('div');
    wrapper.className = 'embed-placeholder';
    wrapper.innerHTML = '<div class="embed-placeholder-play"><button type="button" aria-label="Play Video"></button></div>';
    const playButton = wrapper.querySelector('.embed-placeholder-play button');
    if (playIcon) {
      const img = playIcon.querySelector('img');
      if (img) img.alt = '';
      playButton.append(playIcon);
    }

    if (placeholders.length >= 2) {
      placeholders[0].classList.add('embed-placeholder-desktop');
      placeholders[1].classList.add('embed-placeholder-mobile');
      wrapper.prepend(placeholders[0], placeholders[1]);
    } else {
      wrapper.prepend(placeholders[0]);
    }

    wrapper.addEventListener('click', () => {
      loadEmbed(block, link, true, options);
    });

    playButton?.addEventListener('click', () => {
      trackYoutubePlay(block, link);
    });

    block.append(wrapper);
  } else if (link) {
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        observer.disconnect();
        loadEmbed(block, link, false, options);
      }
    });
    observer.observe(block);
  }
}
