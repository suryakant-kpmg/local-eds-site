/*
** Authoring format **

Block name: Banner Accordian

Tab row - starts a new tab
Col 1 → "Tab"
Col 2 → Tab title (e.g. "Clear Finishes")

Card rows - one row per card, after their tab row
Col 1 → Desktop image (shown from 992px)
Col 2 → Mobile image (shown below 992px; falls back to the desktop image)
Col 3 → Card title (e.g. "Italian Luxury")
Col 4 → Description (shown on hover on desktop, always shown on mobile)
Col 5 → CTA link (link text is the label, e.g. "View product")

Without any Tab row all cards are shown without tabs.
*/

import { createOptimizedPicture } from '../../scripts/aem.js';
import { trackEvent } from '../../scripts/analytics_1.js';

const MOBILE_MEDIA = '(max-width: 991px)';

let blockCount = 0;

function text(el) {
  return (el?.textContent || '').trim();
}

function cells(row) {
  return [...row.querySelectorAll(':scope > div')];
}

function absoluteUrl(href) {
  try {
    return new URL(href, window.location.origin).href;
  } catch (e) {
    return href || '';
  }
}

// desktop picture with the mobile image as a source below 992px
function buildPicture(desktopImg, mobileImg, alt) {
  const picture = createOptimizedPicture(desktopImg.src, alt, false, [{ width: '750' }]);
  if (mobileImg && mobileImg.src !== desktopImg.src) {
    const mobilePicture = createOptimizedPicture(mobileImg.src, alt, false, [{ width: '600' }]);
    const webp = mobilePicture.querySelector('source[type="image/webp"]');
    if (webp) {
      webp.media = MOBILE_MEDIA;
      picture.prepend(webp);
    }
  }
  picture.className = 'banner-accordian-card-image';
  return picture;
}

function parseTabs(block) {
  const tabs = [];
  [...block.children].forEach((row) => {
    const c = cells(row);
    if (text(c[0]).toLowerCase() === 'tab' && !row.querySelector('img')) {
      tabs.push({ title: text(c[1]), cards: [] });
      return;
    }
    const desktopImg = c[0]?.querySelector('img');
    if (!desktopImg) return;
    if (!tabs.length) tabs.push({ title: '', cards: [] });
    const link = c[4]?.querySelector('a[href]');
    tabs[tabs.length - 1].cards.push({
      desktopImg,
      mobileImg: c[1]?.querySelector('img'),
      title: text(c[2]),
      description: text(c[3]),
      ctaLabel: text(link),
      ctaHref: link?.getAttribute('href') || '',
    });
  });
  return tabs.filter((tab) => tab.cards.length);
}

function buildCard(card, getFlowType) {
  const el = document.createElement('div');
  el.className = 'banner-accordian-card';
  el.tabIndex = 0;
  if (card.title) el.setAttribute('aria-label', card.title);

  el.append(buildPicture(card.desktopImg, card.mobileImg, card.desktopImg.alt || card.title));

  const details = document.createElement('div');
  details.className = 'banner-accordian-card-details';

  if (card.title) {
    const title = document.createElement('h3');
    title.className = 'banner-accordian-card-title';
    title.textContent = card.title;
    details.append(title);
  }

  if (card.description) {
    const description = document.createElement('p');
    description.className = 'banner-accordian-card-description';
    description.textContent = card.description;
    details.append(description);
  }

  if (card.ctaLabel && card.ctaHref) {
    const cta = document.createElement('div');
    cta.className = 'banner-accordian-card-cta';
    const a = document.createElement('a');
    a.href = card.ctaHref;
    a.textContent = card.ctaLabel;
    const arrow = document.createElement('span');
    arrow.className = 'banner-accordian-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    a.append(arrow);
    a.addEventListener('click', () => {
      trackEvent('custom_cta_click', {
        cta_: card.ctaLabel,
        redirectionLink: absoluteUrl(card.ctaHref),
        parentTitle: card.title,
        flowType: getFlowType(),
      });
    });
    cta.append(a);
    details.append(cta);
  }

  el.append(details);
  return el;
}

// mobile slider: native scroll with dots under the cards
function bindDots(panel) {
  const track = panel.querySelector('.banner-accordian-cards');
  const cards = [...track.children];
  if (cards.length < 2) return;

  const dots = document.createElement('div');
  dots.className = 'banner-accordian-dots';
  const buttons = cards.map((card, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'banner-accordian-dot';
    dot.setAttribute('aria-label', `Go to card ${i + 1} of ${cards.length}`);
    dot.addEventListener('click', () => {
      track.scrollTo({ left: card.offsetLeft - cards[0].offsetLeft, behavior: 'smooth' });
    });
    dots.append(dot);
    return dot;
  });

  const update = () => {
    const max = track.scrollWidth - track.clientWidth;
    let active = 0;
    // at the start (also before the section is shown) the first dot is active
    if (track.scrollLeft <= 0) {
      active = 0;
    } else if (track.scrollLeft >= max - 2) {
      active = cards.length - 1;
    } else {
      cards.forEach((card, i) => {
        const start = card.offsetLeft - cards[0].offsetLeft;
        if (start <= track.scrollLeft + card.offsetWidth / 2) active = i;
      });
    }
    buttons.forEach((dot, i) => dot.classList.toggle('is-active', i === active));
  };

  track.addEventListener('scroll', update, { passive: true });
  panel.append(dots);
  panel.resetSlider = () => {
    track.scrollLeft = 0;
    update();
  };
  update();
}

export default function decorate(block) {
  const tabs = parseTabs(block);
  if (!tabs.length) return;

  blockCount += 1;
  const id = `banner-accordian-${blockCount}`;

  const tabList = document.createElement('div');
  tabList.className = 'banner-accordian-tabs';
  tabList.setAttribute('role', 'tablist');

  const panels = [];
  const tabButtons = [];
  let activeIndex = 0;
  const getFlowType = () => tabs[activeIndex].title;

  const activate = (index, focus = false) => {
    activeIndex = index;
    tabButtons.forEach((button, i) => {
      const selected = i === index;
      button.setAttribute('aria-selected', selected);
      button.tabIndex = selected ? 0 : -1;
      panels[i].hidden = !selected;
    });
    panels[index].resetSlider?.();
    if (focus) tabButtons[index].focus();
  };

  tabs.forEach((tab, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'banner-accordian-tab';
    button.id = `${id}-tab-${i}`;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', `${id}-panel-${i}`);
    button.textContent = tab.title;
    button.addEventListener('click', () => {
      if (i !== activeIndex) activate(i);
      trackEvent('custom_cta_click', { cta_: tab.title });
    });
    tabButtons.push(button);
    tabList.append(button);

    const panel = document.createElement('div');
    panel.className = 'banner-accordian-panel';
    panel.id = `${id}-panel-${i}`;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', button.id);

    const track = document.createElement('div');
    track.className = 'banner-accordian-cards';
    tab.cards.forEach((card) => track.append(buildCard(card, getFlowType)));
    panel.append(track);
    panels.push(panel);
  });

  // arrow keys move between tabs
  tabList.addEventListener('keydown', (e) => {
    const last = tabButtons.length - 1;
    const keys = {
      ArrowRight: activeIndex === last ? 0 : activeIndex + 1,
      ArrowLeft: activeIndex === 0 ? last : activeIndex - 1,
      Home: 0,
      End: last,
    };
    if (!(e.key in keys)) return;
    e.preventDefault();
    activate(keys[e.key], true);
  });

  // a single untitled tab needs no tab bar
  if (tabs.length === 1 && !tabs[0].title) tabList.hidden = true;

  block.replaceChildren(tabList, ...panels);
  panels.forEach(bindDots);
  activate(0);
}
