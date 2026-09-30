/*
** Authoring format **
Tab row (one cell)  - tab label, e.g. "Wall Paints"; the rows below it belong to that tab
Card row            - Col 1: desktop image, Col 2: mobile image (optional),
                      Col 3: title (heading), "Upto **15** Years", subtitle, CTA link
Tab CTA row         - "Tab CTA" | label | jump link id (e.g. collage_slides_how) or a link
                      Shown centred under that tab's cards; a jump id scrolls to the element
                      with that id, or to a section whose Section Metadata sets "Id".

Card rows use the same columns as the Cards (grid, interior-hero) block.
*/

import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';
import { triggerCTAClickWithLinkAndTitle } from '../../scripts/analytics_1.js';

const DESKTOP_MEDIA = '(width >= 992px)';
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)');
let blockCount = 0;

const cellText = (cell) => cell?.textContent.trim() || '';

/** Fills a link with a text label and a decorative icon span. */
function setLinkContent(link, label, labelClass, iconClass) {
  const text = document.createElement('span');
  if (labelClass) text.className = labelClass;
  text.textContent = label;
  const icon = document.createElement('span');
  icon.className = iconClass;
  icon.setAttribute('aria-hidden', 'true');
  link.replaceChildren(text, icon);
}
const isTabCtaRow = (row) => /^tab cta$/i.test(cellText(row.children[0])) && row.children.length > 1;
const isTabRow = (row) => row.children.length === 1 && !row.querySelector('img, a[href]') && cellText(row);

function isSameOrigin(img) {
  return new URL(img.src, window.location.href).origin === window.location.origin;
}

function buildPicture(desktopImg, mobileImg) {
  const fallbackImg = mobileImg || desktopImg;
  const alt = desktopImg.alt || mobileImg?.alt || '';
  let picture;
  if (isSameOrigin(fallbackImg)) {
    picture = createOptimizedPicture(fallbackImg.src, alt, false, [{ width: mobileImg ? '400' : '750' }]);
    if (mobileImg) {
      const desktop = createOptimizedPicture(desktopImg.src, alt, false, [{ media: DESKTOP_MEDIA, width: '750' }]);
      picture.prepend(...desktop.querySelectorAll('source[media]'));
    }
  } else {
    // media hosted elsewhere cannot be resized by the media bus
    picture = document.createElement('picture');
    if (mobileImg) {
      const source = document.createElement('source');
      source.media = DESKTOP_MEDIA;
      source.srcset = desktopImg.src;
      picture.append(source);
    }
    const img = document.createElement('img');
    img.src = fallbackImg.src;
    img.alt = alt;
    img.loading = 'lazy';
    picture.append(img);
  }
  moveInstrumentation(fallbackImg, picture.querySelector('img'));
  return picture;
}

function decorateCard(row, sectionTitle) {
  const card = document.createElement('li');
  card.className = 'cards-tabs-grid-card';
  moveInstrumentation(row, card);

  const [desktopImg, mobileImg] = [...row.querySelectorAll('img')];
  if (desktopImg) {
    const media = document.createElement('div');
    media.className = 'cards-tabs-grid-media';
    media.append(buildPicture(desktopImg, mobileImg));
    card.append(media);
  }

  const body = document.createElement('div');
  body.className = 'cards-tabs-grid-body';
  [...row.children].filter((col) => !col.querySelector('img'))
    .forEach((col) => body.append(...col.childNodes));
  // drop empty paragraphs (e.g. "All Products" has no warranty lines)
  body.querySelectorAll('p').forEach((p) => { if (!p.textContent.trim() && !p.querySelector('img')) p.remove(); });

  const title = body.querySelector('h1, h2, h3, h4, h5, h6');
  title?.classList.add('cards-tabs-grid-title');
  const titleText = title?.textContent.trim() || '';

  const link = [...body.querySelectorAll('a[href]')].pop();
  // title + warranty lines share a fixed-height slot so every card's CTA lines up
  const info = document.createElement('div');
  info.className = 'cards-tabs-grid-info';
  [...body.children].filter((el) => !el.contains(link)).forEach((el) => info.append(el));
  body.prepend(info);
  if (link) {
    const wrapper = link.closest('p');
    const cta = document.createElement('p');
    cta.className = 'cards-tabs-grid-cta';
    const label = link.textContent.trim();
    link.className = '';
    setLinkContent(link, label, 'cards-tabs-grid-cta-label', 'cards-tabs-grid-arrow');
    if (titleText) link.setAttribute('aria-label', `${label} ${titleText}`);
    cta.append(link);
    body.append(cta);
    if (wrapper && !wrapper.textContent.trim()) wrapper.remove();
    link.addEventListener('click', () => triggerCTAClickWithLinkAndTitle(link.href, label, sectionTitle || titleText));
  }
  card.append(body);
  return card;
}

/**
 * Builds a tab's footer CTA. A plain id (or #id) is a jump link to that element on the page.
 */
function buildTabCta(row, sectionTitle) {
  const cells = [...row.children];
  const label = cellText(cells[1]);
  const authoredLink = row.querySelector('a[href]');
  const jumpId = cells[2] ? cellText(cells[2]).replace(/^#/, '') : '';
  if (!label && !authoredLink) return null;

  const link = document.createElement('a');
  link.className = 'cards-tabs-grid-tab-cta';
  if (authoredLink && !jumpId) {
    link.href = authoredLink.getAttribute('href');
  } else {
    link.href = `#${jumpId}`;
    link.dataset.jumpId = jumpId;
  }
  setLinkContent(link, label || authoredLink.textContent.trim(), '', 'cards-tabs-grid-chevron');
  link.addEventListener('click', (e) => {
    triggerCTAClickWithLinkAndTitle(link.href, link.textContent.trim(), sectionTitle);
    const id = link.dataset.jumpId;
    if (!id) return;
    const target = document.getElementById(id) || document.querySelector(`[data-id="${CSS.escape(id)}"]`);
    if (!target) return; // placeholder id with no target yet: behave as a plain anchor
    e.preventDefault();
    // land the target just below the fixed site header
    const headerBottom = Math.max(document.querySelector('header')?.getBoundingClientRect().bottom || 0, 0);
    window.scrollTo({
      top: target.getBoundingClientRect().top + window.scrollY - headerBottom,
      behavior: REDUCED_MOTION.matches ? 'auto' : 'smooth',
    });
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  });

  const wrap = document.createElement('p');
  wrap.className = 'cards-tabs-grid-tab-cta-wrap';
  moveInstrumentation(row, wrap);
  wrap.append(link);
  return wrap;
}

function setupTabs(tablist, tabs, panels) {
  const select = (index, focus = false) => {
    tabs.forEach((tab, i) => {
      const selected = i === index;
      tab.setAttribute('aria-selected', selected ? 'true' : 'false');
      tab.tabIndex = selected ? 0 : -1;
      panels[i].hidden = !selected;
    });
    if (focus) tabs[index].focus();
  };
  tabs.forEach((tab, i) => tab.addEventListener('click', () => select(i)));
  tablist.addEventListener('keydown', (e) => {
    const current = tabs.indexOf(document.activeElement);
    if (current < 0) return;
    const last = tabs.length - 1;
    const next = {
      ArrowRight: current === last ? 0 : current + 1,
      ArrowLeft: current === 0 ? last : current - 1,
      Home: 0,
      End: last,
    }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    select(next, true);
  });
  select(0);
}

export default function decorate(block) {
  blockCount += 1;
  const uid = `cards-tabs-grid-${blockCount}`;
  const sectionTitle = block.closest('.section')?.querySelector('h1, h2, h3')?.textContent.trim() || '';

  // group rows into tabs; card rows before any tab row form an unnamed first tab
  const groups = [];
  [...block.children].forEach((row) => {
    if (isTabRow(row)) {
      groups.push({ label: cellText(row), row, items: [] });
      return;
    }
    if (!groups.length) groups.push({ label: '', row: null, items: [] });
    groups[groups.length - 1].items.push(row);
  });

  const tablist = document.createElement('div');
  tablist.className = 'cards-tabs-grid-tabs';
  tablist.setAttribute('role', 'tablist');
  const tabs = [];
  const panels = [];

  groups.forEach((group, i) => {
    const panel = document.createElement('div');
    panel.className = 'cards-tabs-grid-panel';
    panel.id = `${uid}-panel-${i}`;
    const list = document.createElement('ul');
    list.className = 'cards-tabs-grid-cards';
    let tabCta = null;
    group.items.forEach((row) => {
      if (isTabCtaRow(row)) tabCta = buildTabCta(row, sectionTitle);
      else if (row.querySelector('img') || row.querySelector('a[href]')) list.append(decorateCard(row, sectionTitle));
    });
    panel.append(list);
    if (tabCta) {
      panel.classList.add('has-cta');
      panel.append(tabCta);
    }
    panels.push(panel);

    if (groups.length > 1 || group.label) {
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'cards-tabs-grid-tab';
      tab.id = `${uid}-tab-${i}`;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-controls', panel.id);
      tab.textContent = group.label || `Tab ${i + 1}`;
      if (group.row) moveInstrumentation(group.row, tab);
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', tab.id);
      tablist.append(tab);
      tabs.push(tab);
    }
  });

  block.replaceChildren(...(tabs.length ? [tablist] : []), ...panels);
  if (tabs.length) setupTabs(tablist, tabs, panels);
}
