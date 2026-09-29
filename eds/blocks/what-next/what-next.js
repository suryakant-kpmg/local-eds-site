import { createOptimizedPicture } from '../../scripts/aem.js';

/**
 * what-next — text column beside a promo image, with optional promo copy and
 * app-store badges overlaid on the image.
 *
 * Authoring model (see README in what-next.css header):
 *   Row 1 : [ text content | image(s) ]
 *   Row 2 : [ promo title + description | badge links ]   (optional)
 * Text content is free rich text (headings, paragraphs, links). A link alone in
 * its own paragraph becomes an outline CTA button.
 * The image cell holds ONE image (all sizes) or TWO — first mobile, second
 * desktop — rendered as a responsive <picture>.
 * Badge links are images wrapped in links, or images followed by links (paired
 * in order).
 */

const DESKTOP_MEDIA = '(min-width: 992px)';

/** Width/height attributes of an authored image, if both are present. */
function dims(img) {
  const w = parseInt(img.getAttribute('width'), 10);
  const h = parseInt(img.getAttribute('height'), 10);
  return w && h ? { w, h } : null;
}

/**
 * Build the promo picture. Two images -> mobile <img> plus a desktop <source>
 * set; one image -> a single optimized picture. Intrinsic sizes are carried
 * onto <img>/<source> so the browser reserves space for whichever source wins.
 */
function buildPicture(imgs) {
  const [mobileImg, desktopImg] = imgs;
  const alt = mobileImg.alt || desktopImg?.alt || '';
  const picture = createOptimizedPicture(mobileImg.src, alt, false, desktopImg
    ? [{ width: '750' }]
    : [{ media: DESKTOP_MEDIA, width: '1600' }, { width: '750' }]);

  const mobileDims = dims(mobileImg);
  const img = picture.querySelector('img');
  if (mobileDims) {
    img.width = mobileDims.w;
    img.height = mobileDims.h;
  }

  if (desktopImg) {
    const desktop = createOptimizedPicture(desktopImg.src, alt, false, [{ width: '1600' }]);
    const desktopDims = dims(desktopImg);
    [...desktop.querySelectorAll('source')].reverse().forEach((source) => {
      source.setAttribute('media', DESKTOP_MEDIA);
      if (desktopDims) {
        source.setAttribute('width', desktopDims.w);
        source.setAttribute('height', desktopDims.h);
      }
      picture.prepend(source);
    });
  }
  return picture;
}

/** Pair badge images with their links: linked images first, else by order. */
function collectBadges(cell) {
  if (!cell) return [];
  const links = [...cell.querySelectorAll('a[href]')];
  const linkedImgs = links.filter((a) => a.querySelector('img'));
  if (linkedImgs.length) {
    return linkedImgs.map((a) => ({ href: a.href, img: a.querySelector('img'), label: a.title }));
  }
  const imgs = [...cell.querySelectorAll('img')];
  return links.map((a, i) => ({ href: a.href, img: imgs[i], label: a.textContent.trim() }));
}

export default function decorate(block) {
  const [mainRow, promoRow] = [...block.children];
  const [textCell, mediaCell] = mainRow ? [...mainRow.children] : [];
  const [promoTextCell, badgesCell] = promoRow ? [...promoRow.children] : [];

  // --- text column ---
  const content = document.createElement('div');
  content.className = 'what-next-content';
  if (textCell) content.append(...textCell.childNodes);

  // a link that is the only thing in its paragraph is a CTA button
  content.querySelectorAll('p a[href]').forEach((a) => {
    const p = a.closest('p');
    if (p.textContent.trim() !== a.textContent.trim() || a.querySelector('img')) return;
    p.className = 'what-next-cta-wrapper';
    a.className = 'what-next-cta';
  });

  // --- media + promo overlay ---
  const media = document.createElement('div');
  media.className = 'what-next-media';
  const imgs = mediaCell ? [...mediaCell.querySelectorAll('img')] : [];
  if (imgs.length) {
    const picture = buildPicture(imgs);
    picture.classList.add('what-next-image');
    media.append(picture);
  }

  const promoHasText = promoTextCell && promoTextCell.textContent.trim();
  const badges = collectBadges(badgesCell);
  if (promoHasText || badges.length) {
    const promo = document.createElement('div');
    promo.className = 'what-next-promo';

    if (promoHasText) {
      const blocks = [...promoTextCell.children];
      const [first, ...rest] = blocks.length ? blocks : [promoTextCell];
      // the first line is the promo title; keep an authored heading, else make one
      let title = first;
      if (!/^H[1-6]$/.test(first.tagName)) {
        title = document.createElement('h3');
        title.innerHTML = first.innerHTML;
      }
      title.classList.add('what-next-promo-title');
      promo.append(title);
      rest.forEach((el) => {
        el.classList.add('what-next-promo-text');
        promo.append(el);
      });
    }

    if (badges.length) {
      const list = document.createElement('ul');
      list.className = 'what-next-badges';
      badges.forEach(({ href, img, label }) => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = href;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        if (img) {
          const alt = img.alt || label || '';
          a.append(createOptimizedPicture(img.src, alt, false, [{ width: '300' }]));
        } else {
          a.textContent = label;
        }
        li.append(a);
        list.append(li);
      });
      promo.append(list);
    }
    media.append(promo);
  }

  block.replaceChildren(content, media);
}
