/**
 * Author label rows: a block table can contain rows of column labels (e.g.
 * "Tab title | Desktop image | Mobile image (optional)") so authors know
 * what to put in each cell. They are removed before the block renders.
 *
 * A row is a label row when it has no image and every non-empty cell matches
 * one of the block's labels (case-insensitive, ignoring a trailing note in
 * brackets such as "(optional)" or "(1440 x 545)").
 */

const normalize = (text) => text
  .replace(/\s*\([^)]*\)\s*$/, '')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

/**
 * @param {Element} row block row
 * @param {string[]} labels the block's label texts
 */
export function isLabelRow(row, labels) {
  if (row.querySelector('picture, img')) return false;
  const known = new Set(labels.map(normalize));
  const texts = [...row.children].map((cell) => cell.textContent.trim()).filter(Boolean);
  return texts.length > 0 && texts.every((text) => known.has(normalize(text)));
}

/**
 * Removes label rows from a block.
 * @param {Element} block
 * @param {string[]} labels the block's label texts
 */
export default function removeLabelRows(block, labels) {
  [...block.children].forEach((row) => {
    if (isLabelRow(row, labels)) row.remove();
  });
}
