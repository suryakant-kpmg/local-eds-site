import { createOptimizedPicture } from '../../scripts/aem.js';

const URL_PATTERN = /^(https?:\/\/|\/)\S*$/;
const IMAGE_URL_PATTERN = /^https?:\/\/\S+\.(avif|gif|jpe?g|png|svg|webp)(\?\S*)?$/i;
const HEADINGS = 'h1, h2, h3, h4, h5, h6';

// Labels authors write in the first column of a settings row (label | value)...
const SETTING_LABELS = {
  title: ['title', 'heading'],
  subtitle: ['sub title', 'subtitle', 'sub-title'],
  description: ['description', 'note'],
  cta: ['cta', 'cta link'],
  ctaNewTab: ['open in new tab', 'cta open in new tab', 'cta new tab'],
};

// ...and in the header row that names the columns of the item rows below it.
const COLUMN_LABELS = {
  image: ['image', 'image link', 'circle image'],
  name: ['name', 'title', 'label'],
  description: ['description', 'sub text'],
  link: ['page link', 'link', 'url'],
  selected: ['selected'],
  newTab: ['open in new tab', 'new tab'],
};

/**
 * Opens the link in a new tab when the author asked for it.
 * @param {HTMLAnchorElement} link The link
 * @param {boolean} newTab Whether the author asked for a new tab
 */
function setTarget(link, newTab) {
  if (newTab) {
    link.target = '_blank';
    link.rel = 'noopener';
  }
}

/**
 * Matches a cell's text against a set of labels.
 * @param {Element} [cell] The cell
 * @param {Object<string, string[]>} labels Label key to accepted spellings
 * @returns {string|undefined} The matching label key
 */
function labelOf(cell, labels) {
  const text = (cell?.textContent || '').trim().toLowerCase().replace(/[:*]/g, '').replace(/\s+/g, ' ');
  return Object.keys(labels).find((key) => labels[key].includes(text));
}

/**
 * Reads a true/false value cell.
 * @param {Element} [cell] The cell
 * @returns {boolean} Whether the cell says true/yes
 */
function isTrue(cell) {
  return /^(true|yes|y|1)$/i.test(cell?.textContent.trim() || '');
}

/**
 * Whether a row is the header row naming the item columns (e.g. Image | Name | Page link).
 * @param {Element} row The authored row
 * @returns {boolean}
 */
function isHeaderRow(row) {
  if (row.querySelector('picture')) return false;
  const cells = [...row.children].filter((cell) => cell.textContent.trim());
  return cells.length >= 2
    && cells.every((cell) => labelOf(cell, COLUMN_LABELS))
    && cells.some((cell) => labelOf(cell, COLUMN_LABELS) === 'image');
}

/**
 * Reads the item image: an uploaded image, or a link/URL to an image file.
 * @param {Element} [cell] The cell (or row) holding the image
 * @returns {{ src: string, alt: string, optimize: boolean }|null}
 */
function readImage(cell) {
  const img = cell?.querySelector('picture img');
  if (img) return { src: img.src, alt: img.alt, optimize: true };
  const url = cell?.querySelector('a[href]')?.getAttribute('href') || cell?.textContent.trim() || '';
  return IMAGE_URL_PATTERN.test(url) ? { src: url, alt: '', optimize: false } : null;
}

/**
 * Reads the optional item options cell (e.g. "selected, new tab").
 * @param {Element} [cell] The options cell
 * @returns {{ selected: boolean, newTab: boolean }}
 */
function readOptions(cell) {
  const text = cell?.textContent.toLowerCase() || '';
  return {
    selected: /\bselected\b/.test(text),
    newTab: /new[\s-]?tab|_blank/.test(text),
  };
}

/**
 * Reads the link authored in the link cell, falling back to a linked title.
 * When the link text is a full URL it wins over the href, because publishing
 * rewrites links to the production domain into site-relative paths.
 * @param {Element} [linkCell] The link cell
 * @param {Element} [titleCell] The title cell
 * @returns {string} The href, or empty string when none is authored
 */
function readHref(linkCell, titleCell) {
  const anchor = linkCell?.querySelector('a[href]') || titleCell?.querySelector('a[href]');
  if (anchor) {
    const text = anchor.textContent.trim();
    return /^https?:\/\/\S+$/.test(text) ? text : anchor.getAttribute('href');
  }
  const text = linkCell?.textContent.trim() || '';
  return URL_PATTERN.test(text) ? text : '';
}

/**
 * Sends the brand icon click to Adobe Launch, matching the AEM component.
 * @param {string} title The item title
 */
function trackClick(title) {
  // eslint-disable-next-line no-underscore-dangle
  const satellite = window._satellite;
  if (typeof satellite?.track !== 'function') return;
  satellite.track('brandIcon_click_dcr', {
    cta: title,
    mcvid: window.ccAnalytics?.marketingVisitorId?.(),
  });
}

/**
 * Builds one circle item.
 * @param {Object} fields The item fields
 * @param {{ src: string, alt: string, optimize: boolean }} fields.image The image
 * @param {Element} [fields.nameCell] Name; extra lines become the description
 * @param {Element} [fields.descriptionCell] Description
 * @param {Element} [fields.linkCell] Page link
 * @param {boolean} fields.selected Whether the item has the purple ring
 * @param {boolean} fields.newTab Whether the link opens in a new tab
 * @returns {HTMLLIElement} The item
 */
function buildItem({
  image, nameCell, descriptionCell, linkCell, selected, newTab,
}) {
  const paragraphs = nameCell ? [...nameCell.querySelectorAll('p')] : [];
  const title = (paragraphs[0] || nameCell)?.textContent.trim() || image.alt;
  const descriptions = [
    ...paragraphs.slice(1).map((p) => p.textContent.trim()),
    descriptionCell?.textContent.trim(),
  ].filter(Boolean);
  const href = readHref(linkCell, nameCell);

  const li = document.createElement('li');
  li.className = 'circle-filters-item';
  if (selected) li.classList.add('selected');

  const wrapper = document.createElement(href ? 'a' : 'div');
  wrapper.className = 'circle-filters-link';
  if (href) {
    wrapper.href = href;
    setTarget(wrapper, newTab);
  }

  // the title names the link, so the image is decorative when a title exists
  const alt = title && title !== image.alt ? '' : image.alt;
  const circle = document.createElement('span');
  circle.className = 'circle-filters-image';
  if (image.optimize) {
    circle.append(createOptimizedPicture(image.src, alt, false, [{ width: '400' }]));
  } else {
    // external image URLs (e.g. DAM) don't support the media bus resize parameters
    const picture = document.createElement('picture');
    const img = document.createElement('img');
    img.src = image.src;
    img.alt = alt;
    img.loading = 'lazy';
    picture.append(img);
    circle.append(picture);
  }

  const text = document.createElement('span');
  text.className = 'circle-filters-text';
  const titleEl = document.createElement('span');
  titleEl.className = 'circle-filters-title';
  titleEl.textContent = title;
  text.append(titleEl);
  descriptions.forEach((description) => {
    const descEl = document.createElement('span');
    descEl.className = 'circle-filters-description';
    descEl.textContent = description;
    text.append(descEl);
  });

  wrapper.append(circle, text);
  li.append(wrapper);
  return li;
}

/**
 * Builds a text area (intro above or footer below the circles).
 * @param {Node[]} nodes The content
 * @param {string} className The area class name
 * @param {boolean} [newTab] Whether links open in a new tab
 * @returns {HTMLDivElement} The text area
 */
function buildTextArea(nodes, className, newTab = false) {
  const area = document.createElement('div');
  area.className = className;
  area.append(...nodes);

  area.querySelectorAll('a[href]').forEach((a) => {
    setTarget(a, newTab);
    a.classList.remove('button', 'primary', 'secondary');
    a.classList.add('circle-filters-cta');
    a.closest('.button-wrapper')?.classList.replace('button-wrapper', 'circle-filters-cta-wrapper');
  });
  return area;
}

/**
 * Creates a carousel control button.
 * @param {string} className The button class name
 * @param {string} label The accessible label
 * @returns {HTMLButtonElement} The button
 */
function createButton(className, label) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.setAttribute('aria-label', label);
  return button;
}

/**
 * Adds arrows (desktop) and dots (mobile) to the carousel variant.
 * Scrolls one item at a time and wraps around at either end.
 * @param {Element} carousel The carousel wrapper
 * @param {Element} scroller The horizontal scroll container
 * @param {Element} list The item list
 */
function initCarousel(carousel, scroller, list) {
  const items = [...list.children];
  if (items.length < 2) return;

  const step = () => items[1].offsetLeft - items[0].offsetLeft;
  const maxScroll = () => scroller.scrollWidth - scroller.clientWidth;
  const scrollToIndex = (index) => {
    scroller.scrollTo({ left: items[index].offsetLeft - items[0].offsetLeft, behavior: 'smooth' });
  };

  const prev = createButton('circle-filters-prev', 'Previous');
  const next = createButton('circle-filters-next', 'Next');
  prev.addEventListener('click', () => {
    if (scroller.scrollLeft <= 1) scroller.scrollTo({ left: maxScroll(), behavior: 'smooth' });
    else scroller.scrollBy({ left: -step(), behavior: 'smooth' });
  });
  next.addEventListener('click', () => {
    if (scroller.scrollLeft >= maxScroll() - 1) scroller.scrollTo({ left: 0, behavior: 'smooth' });
    else scroller.scrollBy({ left: step(), behavior: 'smooth' });
  });

  const dots = document.createElement('ol');
  dots.className = 'circle-filters-dots';
  const dotButtons = items.map((item, index) => {
    const li = document.createElement('li');
    const dot = createButton('circle-filters-dot', `Show item ${index + 1} of ${items.length}`);
    dot.addEventListener('click', () => scrollToIndex(index));
    li.append(dot);
    dots.append(li);
    return dot;
  });

  const update = () => {
    carousel.classList.toggle('is-scrollable', maxScroll() > 1);
    const atEnd = scroller.scrollLeft >= maxScroll() - 1;
    const active = atEnd ? items.length - 1 : Math.round(scroller.scrollLeft / (step() || 1));
    dotButtons.forEach((dot, index) => {
      if (index === active) dot.setAttribute('aria-current', 'true');
      else dot.removeAttribute('aria-current');
    });
  };

  let frame;
  scroller.addEventListener('scroll', () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(update);
  }, { passive: true });
  new ResizeObserver(update).observe(scroller);

  carousel.append(prev, next, dots);
  update();
}

/**
 * Builds the block heading from an authored heading (or a cell holding the title),
 * keeping its level, id and link. Plain text becomes an H2.
 * @param {Element} source The authored heading or title cell
 * @returns {HTMLHeadingElement} The block heading
 */
function buildHeading(source) {
  const authored = source.matches(HEADINGS) ? source : source.querySelector(HEADINGS);
  const heading = document.createElement(authored ? authored.tagName.toLowerCase() : 'h2');
  heading.className = 'circle-filters-heading';
  if (authored?.id) heading.id = authored.id;
  const text = (authored || source).textContent.trim();
  const anchor = source.querySelector('a[href]');
  if (anchor) {
    const link = document.createElement('a');
    link.href = anchor.getAttribute('href');
    link.textContent = text;
    heading.append(link);
  } else {
    heading.textContent = text;
  }
  return heading;
}

/**
 * Wraps a cell's content in paragraphs (single-line cells have bare text).
 * @param {Element} cell The cell
 * @returns {Node[]} The paragraphs
 */
function toParagraphs(cell) {
  if (cell.querySelector('p')) return [...cell.childNodes];
  const p = document.createElement('p');
  p.append(...cell.childNodes);
  return [p];
}

/**
 * Builds the CTA paragraph from the CTA cell (a link, or a bare URL).
 * @param {Element} cell The CTA cell
 * @returns {HTMLParagraphElement|null} The CTA paragraph
 */
function buildCta(cell) {
  let link = cell.querySelector('a[href]');
  if (!link) {
    const url = cell.textContent.trim();
    if (!URL_PATTERN.test(url)) return null;
    link = document.createElement('a');
    link.href = url;
    link.textContent = url;
  }
  const p = document.createElement('p');
  p.append(link);
  return p;
}

/**
 * Decorates the circle-filters block.
 *
 * Labelled layout (recommended):
 *   Title | heading     Sub title | intro     Description | text
 *   CTA | link          Open in new tab | true/false
 *   Image | Name | Page link | Selected | Open in new tab   (header row)
 *   <image> | ROYALE GLITZ | https://... | true | false   (one row per item)
 *
 * Unlabelled layout (still supported): optional heading row, then
 * image | title | link | options rows, then a description/CTA row.
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const list = document.createElement('ul');
  list.className = 'circle-filters-list';
  let heading;
  let columns;
  const settings = {};
  const before = [];
  const after = [];

  [...block.children].forEach((row) => {
    const cells = [...row.children];

    if (isHeaderRow(row)) {
      columns = cells.map((cell) => labelOf(cell, COLUMN_LABELS));
      return;
    }

    const setting = !row.querySelector('picture') && cells.length >= 2
      && labelOf(cells[0], SETTING_LABELS);
    if (setting) {
      [, settings[setting]] = cells;
      return;
    }

    if (columns) {
      const cell = (key) => cells[columns.indexOf(key)];
      const image = readImage(cell('image'));
      if (image) {
        list.append(buildItem({
          image,
          nameCell: cell('name'),
          descriptionCell: cell('description'),
          linkCell: cell('link'),
          selected: isTrue(cell('selected')),
          newTab: isTrue(cell('newTab')),
        }));
        return;
      }
    } else if (row.querySelector('picture img')) {
      const [, nameCell, linkCell, optionsCell] = cells;
      list.append(buildItem({
        image: readImage(row), nameCell, linkCell, ...readOptions(optionsCell),
      }));
      return;
    }

    const hasItems = list.children.length > 0;
    const authoredHeading = !hasItems && !heading && row.querySelector(HEADINGS);
    if (authoredHeading) {
      heading = buildHeading(authoredHeading);
      authoredHeading.remove();
    }
    if (row.textContent.trim()) {
      const nodes = cells.flatMap((c) => [...c.childNodes]);
      const area = buildTextArea(nodes, hasItems ? 'circle-filters-footer' : 'circle-filters-intro');
      (hasItems ? after : before).push(area);
    }
  });

  if (settings.title?.textContent.trim()) heading = buildHeading(settings.title);
  if (settings.subtitle?.textContent.trim()) {
    before.push(buildTextArea(toParagraphs(settings.subtitle), 'circle-filters-intro'));
  }
  const footer = [];
  if (settings.description?.textContent.trim()) footer.push(...toParagraphs(settings.description));
  const cta = settings.cta && buildCta(settings.cta);
  if (cta) footer.push(cta);
  if (footer.length) {
    after.push(buildTextArea(footer, 'circle-filters-footer', isTrue(settings.ctaNewTab)));
  }

  const scroller = document.createElement('div');
  scroller.className = 'circle-filters-scroller';
  scroller.append(list);

  const carousel = document.createElement('div');
  carousel.className = 'circle-filters-carousel';
  carousel.append(scroller);

  const panel = document.createElement('div');
  panel.className = 'circle-filters-panel';
  panel.append(...before, carousel, ...after);
  block.replaceChildren(...(heading ? [heading] : []), panel);

  if (block.classList.contains('carousel')) {
    initCarousel(carousel, scroller, list);
    list.querySelectorAll('a.circle-filters-link').forEach((link) => {
      link.addEventListener('click', () => {
        const title = link.querySelector('.circle-filters-title')?.textContent.trim();
        trackClick(title || link.querySelector('img')?.alt || '');
      });
    });
  }
}
