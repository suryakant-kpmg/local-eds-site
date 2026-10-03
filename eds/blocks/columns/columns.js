/**
 * Columns block
 *
 * Authoring format (DA):
 *
 * | columns                                                              |
 * |----------------------------------------------------------------------|
 * | Title | Roots of Royal play                                          |
 * | Desktop image | Mobile image | Title | Subtitle | CTA Label |         |
 * |   Open in new tab | Redirection or Download | Link                   |
 * | <img> | <img> | <text> | <text> | Download PDF | false | Redirection |
 * |   /catalogue/interior-textures.html?f=...                            |
 * | ...one row per item, same 8 columns...                               |
 *
 * Row 1 (2 cols)  : "Title" label + section title.
 * Row 2 (8 cols)  : Header labels (for authors only).
 * Row 3+ (8 cols) : One item per row:
 *   1. Desktop image   - picture shown at desktop widths
 *   2. Mobile image    - picture shown at mobile widths
 *   3. Title           - item title (optional)
 *   4. Subtitle        - item description text
 *   5. CTA Label       - button text, e.g. "Download PDF"
 *   6. Open in new tab - "true" opens the link in a new tab, "false" in the same tab
 *   7. Redirection or Download - "Redirection" navigates to the link,
 *                                "Download" downloads the linked file
 *   8. Link            - CTA target URL / asset path
 *
 * Variants:
 *   (default)           - title is all black
 *   color-title-variant - author as "columns (color title variant)".
 *                         The last 2 words of the title get the gradient, the
 *                         rest stays black: "Roots of Royale Play" ->
 *                         "Roots of" black, "Royale Play" gradient.
 *                         If the author bolds words, those are used instead.
 */

const ITEM_CELLS = 8;
const DESKTOP_MEDIA = '(min-width: 900px)';
const COLOR_TITLE_WORDS = 2;

const cellText = (cell) => cell?.textContent.trim() || '';

/**
 * Merges desktop and mobile pictures into one responsive picture, so only
 * the image for the current viewport is downloaded.
 * @param {Element} desktopCell cell holding the desktop picture
 * @param {Element} mobileCell cell holding the mobile picture
 * @returns {Element|null} the picture element
 */
function buildPicture(desktopCell, mobileCell) {
  const desktop = desktopCell?.querySelector('picture');
  const mobile = mobileCell?.querySelector('picture');
  if (!desktop || !mobile) return desktop || mobile || null;

  const desktopImg = desktop.querySelector('img');
  const desktopSources = [...desktop.querySelectorAll('source')];
  if (!desktopSources.length && desktopImg) {
    const source = document.createElement('source');
    source.srcset = desktopImg.currentSrc || desktopImg.src;
    desktopSources.push(source);
  }
  desktopSources.reverse().forEach((source) => {
    source.media = DESKTOP_MEDIA;
    mobile.prepend(source);
  });

  const mobileImg = mobile.querySelector('img');
  if (mobileImg && !mobileImg.alt && desktopImg?.alt) mobileImg.alt = desktopImg.alt;
  return mobile;
}

/**
 * Builds the CTA link for an item.
 * @param {string} label CTA label
 * @param {Element} linkCell cell holding the link
 * @param {boolean} newTab open in new tab
 * @param {boolean} isDownload download instead of redirect
 * @returns {Element|null} the CTA container
 */
function buildCta(label, linkCell, newTab, isDownload) {
  const href = linkCell?.querySelector('a')?.href || cellText(linkCell);
  if (!href || !label) return null;

  const link = document.createElement('a');
  link.href = href;
  link.className = `button ${isDownload ? 'columns-cta-download' : 'columns-cta-redirect'}`;
  link.textContent = label;
  link.title = label;
  if (newTab) {
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  }
  if (isDownload) link.setAttribute('download', '');

  const container = document.createElement('p');
  container.className = 'button-container';
  container.append(link);
  return container;
}

/**
 * Builds the block title from the "Title" row.
 * @param {Element} block the block element
 * @param {Element} cell cell holding the title
 * @returns {Element} the title wrapper
 */
function buildTitle(block, cell) {
  const source = cell.children.length === 1 && cell.firstElementChild.tagName === 'P'
    ? cell.firstElementChild
    : cell;
  const heading = document.createElement('h2');
  heading.append(...source.childNodes);

  // color-title-variant: highlight the last words, unless the author bolded some
  if (block.classList.contains('color-title-variant') && !heading.querySelector('strong')) {
    const words = heading.textContent.trim().split(/\s+/);
    const highlight = document.createElement('strong');
    highlight.textContent = words.splice(-COLOR_TITLE_WORDS).join(' ');
    heading.replaceChildren(words.length ? `${words.join(' ')} ` : '', highlight);
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'columns-title';
  wrapper.append(heading);
  return wrapper;
}

/**
 * Builds one column (picture, title, subtitle, CTA) from an item row.
 * @param {Element[]} cells the 8 item cells
 * @returns {Element} the column element
 */
function buildColumn(cells) {
  const [desktopCell, mobileCell, titleCell, subtitleCell,
    ctaCell, newTabCell, typeCell, linkCell] = cells;
  const col = document.createElement('div');

  const picture = buildPicture(desktopCell, mobileCell);
  if (picture) {
    const p = document.createElement('p');
    p.append(picture);
    col.append(p);
  }

  const title = cellText(titleCell);
  if (title) {
    const p = document.createElement('p');
    const strong = document.createElement('strong');
    strong.textContent = title;
    p.append(strong);
    col.append(p);
  }

  if (cellText(subtitleCell)) {
    const hasParagraphs = [...subtitleCell.children].some((el) => el.tagName === 'P');
    if (hasParagraphs) {
      col.append(...subtitleCell.childNodes);
    } else {
      const p = document.createElement('p');
      p.append(...subtitleCell.childNodes);
      col.append(p);
    }
  }

  const cta = buildCta(
    cellText(ctaCell),
    linkCell,
    cellText(newTabCell).toLowerCase() === 'true',
    cellText(typeCell).toLowerCase() === 'download',
  );
  if (cta) col.append(cta);

  return col;
}

/**
 * loads and decorates the block
 * Each item row becomes one column of a single row.
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const row = document.createElement('div');
  let title = null;

  [...block.children].forEach((authoredRow) => {
    const cells = [...authoredRow.children];

    if (cells.length !== ITEM_CELLS) {
      if (cellText(cells[0]).toLowerCase() === 'title' && cellText(cells[1])) {
        title = buildTitle(block, cells[1]);
      }
      return;
    }

    // header row with author-facing labels
    if (cellText(cells[0]).toLowerCase() === 'desktop image') return;

    row.append(buildColumn(cells));
  });

  block.classList.add(`columns-${row.children.length}-cols`);
  block.replaceChildren(...(title ? [title] : []), row);
}
