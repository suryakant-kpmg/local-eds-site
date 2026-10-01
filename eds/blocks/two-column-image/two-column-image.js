import { createOptimizedPicture } from '../../scripts/aem.js';
import { triggerCTAClickWithLinkAndTitle } from '../../scripts/analytics_1.js';

/**
 * Two Column Image
 * Side-by-side image cards with an optional overlaid title, subtitle and CTA.
 *
 * Authoring model (first row is a header row and is ignored):
 *   Desktop image | Mobile image | Title | Sub title | CTA Label | Redirection link
 *
 * Title, sub title and CTA are optional. When a redirection link is authored
 * without a CTA label, the whole image becomes the link.
 */

const HEADER_LABELS = ['desktop image', 'mobile image', 'title'];

const isHeaderRow = (row) => !row.querySelector('img')
  && HEADER_LABELS.includes(row.children[0]?.textContent.trim().toLowerCase());

function getLink(cell) {
  const a = cell?.querySelector('a');
  if (a) return a.getAttribute('href');
  return cell?.textContent.trim() || '';
}

function buildPicture(desktopImg, mobileImg) {
  const mobile = mobileImg || desktopImg;
  const desktop = desktopImg || mobileImg;
  const alt = desktop.alt || mobile.alt || '';
  const picture = createOptimizedPicture(mobile.src, alt, false, [{ width: '750' }]);
  const desktopPicture = createOptimizedPicture(desktop.src, alt, false, [
    { media: '(min-width: 900px)', width: '1200' },
    { width: '750' },
  ]);
  picture.prepend(...desktopPicture.querySelectorAll('source[media]'));
  return picture;
}

function buildCta(label, href) {
  const cta = document.createElement('a');
  cta.href = href;
  cta.className = 'two-column-image-cta';
  cta.textContent = `${label} `;
  const icon = document.createElement('img');
  icon.src = '/eds/icons/arrow-icon-new.svg';
  icon.alt = 'arrow icon';
  icon.className = 'link-icon';
  cta.append(icon);
  return cta;
}

function buildCard(row) {
  const [desktopCell, mobileCell, titleCell, subtitleCell, labelCell, linkCell] = row.children;
  const desktopImg = desktopCell?.querySelector('img');
  const mobileImg = mobileCell?.querySelector('img');
  if (!desktopImg && !mobileImg) return null;

  const title = titleCell?.textContent.trim() || '';
  const subtitle = subtitleCell?.textContent.trim() || '';
  const label = labelCell?.textContent.trim() || '';
  const href = getLink(linkCell);

  const card = document.createElement('div');

  const imageWrapper = document.createElement('div');
  imageWrapper.className = 'image-wrapper';
  const picture = buildPicture(desktopImg, mobileImg);
  if (href && !label) {
    const link = document.createElement('a');
    link.href = href;
    link.append(picture);
    imageWrapper.append(link);
  } else {
    imageWrapper.append(picture);
  }
  card.append(imageWrapper);

  if (title || subtitle || (label && href)) {
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'content-wrapper';

    const titleWrapper = document.createElement('div');
    if (title) {
      const heading = document.createElement('h3');
      heading.textContent = title;
      titleWrapper.append(heading);
    }
    contentWrapper.append(titleWrapper);

    const subtitleWrapper = document.createElement('div');
    if (subtitle) {
      const p = document.createElement('p');
      p.textContent = subtitle;
      subtitleWrapper.append(p);
    }
    contentWrapper.append(subtitleWrapper);

    if (label && href) contentWrapper.append(buildCta(label, href));
    card.append(contentWrapper);
  }

  return card;
}

function bindAnalytics(block) {
  block.addEventListener('click', (event) => {
    const cta = event.target.closest('.image-wrapper a, .content-wrapper a');
    if (!cta || !block.contains(cta)) return;

    const ctaLink = cta.getAttribute('href') || '';
    const btnTitle = Array.from(cta.childNodes)
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent)
      .join('')
      .trim() || cta.querySelector('img')?.alt?.trim() || 'CTA';

    const parentCard = cta.closest('.image-wrapper, .content-wrapper')?.parentElement;
    const parentTitle = parentCard?.querySelector('h3, p')?.textContent?.trim()
      || parentCard?.querySelector('.image-wrapper img')?.alt?.trim()
      || '';

    triggerCTAClickWithLinkAndTitle(ctaLink, btnTitle, parentTitle);
  });
}

/**
 * loads and decorates the block
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const rows = [...block.children].filter((row) => !isHeaderRow(row));
  const cards = rows.map(buildCard).filter(Boolean);
  block.replaceChildren(...cards);
  bindAnalytics(block);
}
