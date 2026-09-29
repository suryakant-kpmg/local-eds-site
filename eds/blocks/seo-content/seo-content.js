/*
** Authoring format **

Default: the block is left as authored.

Variant: table-style
(block authored as "seo-content (table-style)")
Each row → one table row; the first row becomes the table header.

Variant: side-by-side
(block authored as "seo-content (side-by-side)")
Each row → one titled text section
Col 1 → Section title (e.g. "Waterproofing")
Col 2 → Description (rich text, links allowed)
Mobile shows one column; desktop flows the sections into two columns
(top-to-bottom, then the next column), in authored order.
*/

function decorateSideBySide(block) {
  const list = document.createElement('div');
  list.className = 'seo-content-list';

  [...block.children].forEach((row) => {
    const [titleCell, descCell] = row.children;
    const title = titleCell?.textContent.trim();
    if (!title && !descCell?.textContent.trim()) return;

    const item = document.createElement('section');
    item.className = 'seo-content-item';

    if (title) {
      const heading = document.createElement('h3');
      heading.className = 'seo-content-title';
      heading.textContent = title;
      item.append(heading);
    }

    if (descCell) {
      const desc = document.createElement('div');
      desc.className = 'seo-content-desc';
      // keep authored markup (paragraphs, links) but drop the wrapper cell
      desc.append(...descCell.childNodes);
      item.append(desc);
    }

    list.append(item);
  });

  block.replaceChildren(list);
}

export default function decorate(block) {
  if (block.classList.contains('side-by-side')) {
    decorateSideBySide(block);
    return;
  }

  // Only if table-style variant then below structure is expected, otherwise the block is left as is
  if (!block.classList.contains('table-style')) return;

  const rows = [...block.children];
  if (!rows.length) return;

  const table = document.createElement('table');
  table.className = 'seo-content__table';

  rows.forEach((row, rowIndex) => {
    const tr = document.createElement('tr');
    const cols = [...row.children];

    cols.forEach((col) => {
      const cell = document.createElement(rowIndex === 0 ? 'th' : 'td');
      cell.innerHTML = col.innerHTML;
      tr.appendChild(cell);
    });

    table.appendChild(tr);
  });

  block.innerHTML = '';
  block.appendChild(table);
}
