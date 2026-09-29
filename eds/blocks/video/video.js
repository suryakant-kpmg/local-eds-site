  /*
  * Video Block
  * Show a video referenced by a link
  * https://www.hlx.live/developer/block-collection/video
  */

    import { triggerCTAClickWithLinkAndTitle } from '../../scripts/analytics_1.js';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function embedYoutube(url, autoplay, background) {
    const usp = new URLSearchParams(url.search);
    let suffix = '';
    if (background || autoplay) {
      const suffixParams = {
        autoplay: autoplay ? '1' : '0',
        mute: background ? '1' : '0',
        controls: background ? '0' : '1',
        disablekb: background ? '1' : '0',
        loop: background ? '1' : '0',
        playsinline: background ? '1' : '0',
      };
      suffix = `&${Object.entries(suffixParams).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}`;
    }
    let vid = usp.get('v') ? encodeURIComponent(usp.get('v')) : '';
    const embed = url.pathname;
    if (url.origin.includes('youtu.be')) {
      [, vid] = url.pathname.split('/');
    }

    const temp = document.createElement('div');
    temp.innerHTML = `<div style="left: 0; width: 100%; height: 0; position: relative; padding-bottom: 56.25%;">
        <iframe src="https://www.youtube.com${vid ? `/embed/${vid}?rel=0&v=${vid}${suffix}` : embed}" style="border: 0; top: 0; left: 0; width: 100%; height: 100%; position: absolute;" 
        allow="autoplay; fullscreen; picture-in-picture; encrypted-media; accelerometer; gyroscope; picture-in-picture" allowfullscreen="" scrolling="no" title="Content from Youtube" loading="lazy"></iframe>
      </div>`;
    return temp.children.item(0);
  }

  function embedVimeo(url, autoplay, background) {
    const [, video] = url.pathname.split('/');
    let suffix = '';
    if (background || autoplay) {
      const suffixParams = {
        autoplay: autoplay ? '1' : '0',
        background: background ? '1' : '0',
      };
      suffix = `?${Object.entries(suffixParams).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}`;
    }
    const temp = document.createElement('div');
    temp.innerHTML = `<div style="left: 0; width: 100%; height: 0; position: relative; padding-bottom: 56.25%;">
        <iframe src="https://player.vimeo.com/video/${video}${suffix}" 
        style="border: 0; top: 0; left: 0; width: 100%; height: 100%; position: absolute;" 
        frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen  
        title="Content from Vimeo" loading="lazy"></iframe>
      </div>`;
    return temp.children.item(0);
  }

  function getVideoElement(source, autoplay, background) {
    const video = document.createElement('video');
    video.setAttribute('controls', '');
    if (autoplay) video.setAttribute('autoplay', '');
    if (background) {
      video.setAttribute('loop', '');
      video.setAttribute('playsinline', '');
      video.removeAttribute('controls');
      video.addEventListener('canplay', () => {
        video.muted = true;
        if (autoplay) video.play();
      });
    }

    const sourceEl = document.createElement('source');
    sourceEl.setAttribute('src', source);
    sourceEl.setAttribute('type', `video/${source.split('.').pop()}`);
    video.append(sourceEl);

    return video;
  }

  const loadVideoEmbed = (block, link, autoplay, background) => {
    if (block.dataset.embedLoaded === 'true') {
      return;
    }
    const url = new URL(link);

    const isYoutube = link.includes('youtube') || link.includes('youtu.be');
    const isVimeo = link.includes('vimeo');

    if (isYoutube) {
      const embedWrapper = embedYoutube(url, autoplay, background);
      block.append(embedWrapper);
      embedWrapper.querySelector('iframe').addEventListener('load', () => {
        block.dataset.embedLoaded = true;
      });
    } else if (isVimeo) {
      const embedWrapper = embedVimeo(url, autoplay, background);
      block.append(embedWrapper);
      embedWrapper.querySelector('iframe').addEventListener('load', () => {
        block.dataset.embedLoaded = true;
      });
    } else {
      const videoEl = getVideoElement(link, autoplay, background);
      block.append(videoEl);
      videoEl.addEventListener('canplay', () => {
        block.dataset.embedLoaded = true;
      });
    }
  };

  function decoratePromo(block) {
    const row = block.children[0];
    if (!row) return;

    const cols = [...row.children];
    if (cols.length < 2) return;

    const contentCol = cols[0];
    const videoCol = cols[1];
    const videoUrl = videoCol.textContent.trim();

    const strong = contentCol.querySelector('strong');
    const link = contentCol.querySelector('a');

    let eyebrowText = '';
    let headingText = '';
    let descriptionText = '';
    let ctaLink = null;

    if (strong) headingText = strong.textContent.trim();
    if (link) ctaLink = { href: link.href, text: link.textContent.trim() };

    const fullText = contentCol.textContent;
    if (strong && headingText) {
      const headingIndex = fullText.indexOf(headingText);
      if (headingIndex > 0) eyebrowText = fullText.substring(0, headingIndex).trim();
      const afterHeading = fullText.substring(headingIndex + headingText.length);
      if (ctaLink) {
        const ctaIndex = afterHeading.indexOf(ctaLink.text);
        if (ctaIndex > 0) descriptionText = afterHeading.substring(0, ctaIndex).trim();
      } else {
        descriptionText = afterHeading.trim();
      }
    }

    const textContent = document.createElement('div');
    textContent.className = 'video-promo-text';
    const videoContent = document.createElement('div');
    videoContent.className = 'video-promo-media';

    if (eyebrowText) {
      const eyebrow = document.createElement('p');
      eyebrow.className = 'video-promo-eyebrow';
      eyebrow.textContent = eyebrowText;
      textContent.appendChild(eyebrow);
    }
    if (headingText) {
      const h2 = document.createElement('h2');
      h2.className = 'video-promo-heading';
      h2.textContent = headingText;
      textContent.appendChild(h2);
    }
    if (descriptionText) {
      const desc = document.createElement('p');
      desc.className = 'video-promo-description';
      desc.textContent = descriptionText;
      textContent.appendChild(desc);
    }
    if (ctaLink) {
      const cta = document.createElement('a');
      cta.href = ctaLink.href;
      cta.className = 'video-promo-cta';
      cta.innerHTML = `${ctaLink.text}<span class="video-promo-cta-arrow"></span>`;
      cta.addEventListener('click', () => {
        triggerCTAClickWithLinkAndTitle(ctaLink.href, ctaLink.text, headingText);
      });
      textContent.appendChild(cta);
    }

    if (videoUrl && (videoUrl.includes('.mp4') || videoUrl.includes('.webm'))) {
      const videoWrapper = document.createElement('div');
      videoWrapper.className = 'video-promo-video-wrapper';

      const decoTopRight = document.createElement('div');
      decoTopRight.className = 'video-promo-deco video-promo-deco-top-right';
      const decoBottomLeft = document.createElement('div');
      decoBottomLeft.className = 'video-promo-deco video-promo-deco-bottom-left';

      const autoplay = !prefersReducedMotion.matches;
      const videoEl = getVideoElement(videoUrl, autoplay, autoplay);
      videoEl.className = 'video-promo-video-element';

      videoWrapper.appendChild(decoTopRight);
      videoWrapper.appendChild(videoEl);
      videoWrapper.appendChild(decoBottomLeft);
      videoContent.appendChild(videoWrapper);
    }

    block.textContent = '';
    block.appendChild(textContent);
    block.appendChild(videoContent);
    const moveMobileContent = () => {
      const desc = block.querySelector('.video-promo-description');
      const cta = block.querySelector('.video-promo-cta');
      const media = block.querySelector('.video-promo-media');
      const text = block.querySelector('.video-promo-text');
    
      if (!desc || !cta || !media || !text) return;
    
      if (window.innerWidth < 991) {
        if (media.nextElementSibling !== desc) {
          media.after(desc);
          desc.after(cta);
        }
      } else {
        if (text.lastElementChild !== cta) {
          text.append(desc);
          text.append(cta);
        }
      }
    };
    
    moveMobileContent();
    window.addEventListener('resize', moveMobileContent);

  }

  export default async function decorate(block) {
    if (block.classList.contains('promo')) {
      decoratePromo(block);
      return;
    }

    const placeholder = block.querySelector('picture');
    const link = block.querySelector('a').href;
    block.textContent = '';
    block.dataset.embedLoaded = false;

    const autoplay = block.classList.contains('autoplay');
    if (placeholder) {
      block.classList.add('placeholder');
      const wrapper = document.createElement('div');
      wrapper.className = 'video-placeholder';
      wrapper.append(placeholder);

      if (!autoplay) {
        wrapper.insertAdjacentHTML(
          'beforeend',
          '<div class="video-placeholder-play"><button type="button" title="Play"></button></div>',
        );
        wrapper.addEventListener('click', () => {
          wrapper.remove();
          loadVideoEmbed(block, link, true, false);
        });
      }
      block.append(wrapper);
    }

    if (!placeholder || autoplay) {
      const observer = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect();
          const playOnLoad = autoplay && !prefersReducedMotion.matches;
          loadVideoEmbed(block, link, playOnLoad, autoplay);
        }
      });
      observer.observe(block);
    }
  }
