function getCellText(cell) {
  return (cell?.textContent || '').trim();
}

function getCellLink(cell) {
  const link = cell?.querySelector('a[href]');
  return link?.getAttribute('href') || '';
}

function isLikelyUrl(value) {
  return /^(https?:\/\/|\/)/i.test((value || '').trim());
}

function toCellData(cell) {
  return {
    label: getCellText(cell),
    href: getCellLink(cell) || '',
  };
}

function getRowCells(block) {
  return [...block.querySelectorAll(':scope > div')]
    .map((row) => [...row.querySelectorAll(':scope > div')].map(toCellData))
    .filter((row) => row.length);
}

function fromColumnWiseRows(rows) {
  if (rows.length !== 2) return [];
  const [first, second] = rows;
  if (!first.length || first.length !== second.length) return [];

  const firstRowLooksLikeLabels = first.every((cell) => !isLikelyUrl(cell.href || cell.label));
  const hasExplicitLinks = second.some((cell) => isLikelyUrl(cell.href || cell.label));
  const urlLikeCount = second.filter((cell) => isLikelyUrl(cell.href || cell.label)).length;
  const looksColumnWise = firstRowLooksLikeLabels
    && (hasExplicitLinks || (urlLikeCount >= Math.ceil(second.length / 2)));
  if (!looksColumnWise) return [];

  return first
    .map((cell, idx) => {
      const { label } = cell;
      const href = second[idx].href || second[idx].label;
      return label ? { label, href } : null;
    })
    .filter(Boolean);
}

function fromRowWiseRows(rows) {
  return rows
    .map((cells) => {
      if (cells.length === 1) {
        const [{ label, href }] = cells;
        return label ? { label, href } : null;
      }
      const [{ label }, secondCell] = cells;
      const href = secondCell.href || secondCell.label;
      return label ? { label, href } : null;
    })
    .filter(Boolean);
}

function fromStackedSingleCells(rows) {
  if (rows.length < 2 || rows.some((cells) => cells.length !== 1)) return [];

  const items = [];
  for (let i = 0; i < rows.length; i += 2) {
    const labelCell = rows[i]?.[0];
    const linkCell = rows[i + 1]?.[0];
    if (labelCell?.label) {
      const href = linkCell ? (linkCell.href || linkCell.label) : '';
      items.push({ label: labelCell.label, href });
    }
  }
  return items;
}

function getRows(block) {
  const rows = getRowCells(block);
  if (!rows.length) return [];

  const stacked = fromStackedSingleCells(rows);
  if (stacked.length > 1) return stacked;

  if (rows.length > 2) return fromRowWiseRows(rows);

  const columnWise = fromColumnWiseRows(rows);
  return columnWise.length ? columnWise : fromRowWiseRows(rows);
}

export default function decorate(block) {
  const items = getRows(block);
  if (!items.length) return;

  const nav = document.createElement('nav');
  nav.setAttribute('aria-label', 'Breadcrumb');

  const slashIcon = document.createElement('div');
  slashIcon.className = 'slash-icon';

  const list = document.createElement('ul');

  items.forEach((item, index) => {
    const li = document.createElement('li');
    const positionMeta = document.createElement('meta');
    positionMeta.setAttribute('itemprop', 'position');
    positionMeta.setAttribute('content', String(index + 1));

    const isLast = index === items.length - 1;
    if (item.href && !isLast) {
      const a = document.createElement('a');
      a.className = 'focus-visible-auto-imp';
      a.href = item.href;
      a.textContent = item.label;
      li.appendChild(a);
    } else {
      const span = document.createElement('span');
      span.textContent = item.label;
      span.setAttribute('aria-current', isLast ? 'page' : 'false');
      li.appendChild(span);
    }

    li.appendChild(positionMeta);
    list.appendChild(li);
  });

  slashIcon.appendChild(list);
  nav.appendChild(slashIcon);

  block.textContent = '';
  block.appendChild(nav);
}
