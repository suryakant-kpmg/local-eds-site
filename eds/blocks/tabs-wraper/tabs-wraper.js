/*
 * Tabs Wraper
 * Category banner for product listing pages: full-width background, a title image, a pill of
 * range links (the current page is highlighted) and, on desktop, a promo image with a CTA.
 * The "tabs" are links to sibling listing pages, so this is page navigation, not ARIA tabs.
 *
 * Authoring (Tabs convention, 2 columns: label | content). Each tab is a row:
 *   | Super Luxury | link to that listing page |      (bold label = current tab, optional)
 * plus optional reserved rows, recognised by their label:
 *   | Background   | desktop image, optional mobile image (below 992px) |
 *   | Title        | title image (alt = the visible title)              |
 *   | Heading      | page heading text (rendered as a visually hidden h1, as on the source) |
 *   | Promo        | promo image, CTA link                              |
 * The Promo CTA opens the site-visit lead form pop-up (scripts/site-visit-form.js); its link is
 * the fallback when the form cannot load.
 * The current tab is the one whose link matches this page, or the one with a bold label.
 */
import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

const DESKTOP_MEDIA = '(min-width: 992px)';
const RESERVED = ['background', 'title', 'heading', 'promo'];

const normalisePath = (path) => path.replace(/\.html$/, '').replace(/\/$/, '') || '/';

/** Art-directed background: desktop image from 992px, mobile image below. */
function buildBackground(content, eager) {
  const [desktop, mobile] = [...content.querySelectorAll('picture img')];
  if (!desktop) return null;
  // base picture = mobile image (or desktop when there is none); desktop sources win from 992px
  const small = mobile || desktop;
  const picture = createOptimizedPicture(small.src, desktop.alt || '', eager, [{ width: '750' }]);
  const wide = createOptimizedPicture(desktop.src, '', eager, [
    { media: DESKTOP_MEDIA, width: '2000' },
    { width: '750' },
  ]);
  picture.prepend(...wide.querySelectorAll(`source[media="${DESKTOP_MEDIA}"]`));
  const img = picture.querySelector('img');
  moveInstrumentation(desktop, img);
  if (eager) img.setAttribute('fetchpriority', 'high');
  const wrapper = document.createElement('div');
  wrapper.className = 'tabs-wraper-background';
  wrapper.append(picture);
  return wrapper;
}

function buildTitle(content, eager) {
  const img = content.querySelector('picture img');
  const title = document.createElement('div');
  title.className = 'tabs-wraper-title';
  if (img) {
    const picture = createOptimizedPicture(img.src, img.alt || '', eager, [{ width: '400' }]);
    moveInstrumentation(img, picture.querySelector('img'));
    title.append(picture);
  } else if (content.textContent.trim()) {
    const p = document.createElement('p');
    p.textContent = content.textContent.trim();
    title.append(p);
  }
  return title.children.length ? title : null;
}

/**
 * Builds the range navigation from tab rows (| label | link |).
 * @param {{row: Element, label: Element, link: HTMLAnchorElement}[]} tabs Tab rows
 * @param {string} name Accessible name for the navigation landmark
 */
function buildTabs(tabs, name) {
  const nav = document.createElement('nav');
  nav.className = 'tabs-wraper-nav';
  nav.setAttribute('aria-label', name);
  const list = document.createElement('ul');
  const here = normalisePath(window.location.pathname);
  tabs.forEach(({ row, label, link }) => {
    const li = document.createElement('li');
    moveInstrumentation(row, li);
    const a = document.createElement('a');
    a.href = link.href;
    a.textContent = label.textContent.trim() || link.textContent.trim();
    moveInstrumentation(link, a);
    const current = normalisePath(new URL(link.href, window.location.href).pathname) === here
      || Boolean(label.querySelector('strong, b'));
    if (current) a.setAttribute('aria-current', 'page');
    li.append(a);
    list.append(li);
  });
  nav.append(list);
  return nav;
}

function buildPromo(content) {
  const img = content.querySelector('picture img');
  const link = content.querySelector('a[href]');
  if (!img && !link) return null;
  const promo = document.createElement('div');
  promo.className = 'tabs-wraper-promo';
  if (img) {
    const picture = createOptimizedPicture(img.src, img.alt || '', false, [{ width: '500' }]);
    moveInstrumentation(img, picture.querySelector('img'));
    promo.append(picture);
  }
  if (link) {
    // opens the "Book a FREE Site Visit" lead form pop-up, as on the source; the authored link is
    // the fallback if the form cannot load
    const cta = document.createElement('button');
    cta.type = 'button';
    cta.className = 'tabs-wraper-cta';
    cta.textContent = link.textContent.trim();
    cta.setAttribute('aria-haspopup', 'dialog');
    moveInstrumentation(link, cta);
    cta.addEventListener('click', async () => {
      try {
        const { default: openSiteVisitForm } = await import('../../scripts/site-visit-form.js');
        const dialog = await openSiteVisitForm();
        dialog.addEventListener('close', () => cta.focus(), { once: true });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('site visit form failed to load', error);
        window.location.href = link.href;
      }
    });
    promo.append(cta);
  }
  return promo;
}

export default function decorate(block) {
  const main = block.closest('main');
  const eager = !main || block.closest('.section') === main.querySelector('.section');

  const parts = {};
  const tabs = [];
  [...block.children].forEach((row) => {
    const [labelCell, contentCell] = row.children;
    if (!labelCell) return;
    const content = contentCell || labelCell;
    const key = labelCell.textContent.trim().toLowerCase();
    if (contentCell && RESERVED.includes(key)) {
      if (!parts[key]) parts[key] = { row, content };
      return;
    }
    const link = content.querySelector('a[href]');
    if (link) tabs.push({ row, label: contentCell ? labelCell : link, link });
  });

  const titleEl = parts.title ? buildTitle(parts.title.content, eager) : null;
  const titleText = titleEl?.querySelector('img')?.alt || titleEl?.textContent.trim();
  let heading = null;
  const headingText = parts.heading?.content.textContent.trim();
  if (headingText) {
    // the page's h1: read by screen readers and search engines, hidden like on the source
    heading = document.createElement('h1');
    heading.className = 'tabs-wraper-heading';
    heading.textContent = headingText;
  }
  const built = {
    background: parts.background && buildBackground(parts.background.content, eager),
    title: titleEl,
    heading,
    promo: parts.promo && buildPromo(parts.promo.content),
  };
  Object.entries(built).forEach(([key, el]) => {
    if (el && parts[key]) moveInstrumentation(parts[key].row, el);
  });
  const nav = tabs.length ? buildTabs(tabs, titleText ? `${titleText} ranges` : 'Product ranges') : null;

  const center = document.createElement('div');
  center.className = 'tabs-wraper-center';
  center.append(...[built.heading, built.title, nav].filter(Boolean));

  block.replaceChildren(...[built.background, center, built.promo].filter(Boolean));
}
