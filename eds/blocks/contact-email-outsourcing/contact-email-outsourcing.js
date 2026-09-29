/**
 * Contact Us - Email Outsourcing block.
 *
 * Shows a company identifier (CIN) followed by a grid of email cards. Each
 * card pairs a short query description with an email address link. All content
 * comes from Document Authoring.
 *
 * Authoring model (rows, top to bottom):
 *   Row 1 → CIN / identifier text (e.g. "(CIN): L24220MH1945PLC004598")
 *   Each following row → one email card, either:
 *       | description text | email link |   (two cells), or
 *       a single cell holding the description text and an email link.
 */
export default function decorate(block) {
  const rows = [...block.children];

  // Row 1: CIN / identifier line.
  const cinRow = rows.shift();
  const cin = cinRow ? cinRow.textContent.trim() : '';

  // Remaining rows: email cards.
  const cards = rows.map((row) => {
    const cells = [...row.children];
    const link = row.querySelector('a[href]');
    let description = '';

    if (cells.length >= 2) {
      // | description | email | — first cell is the description.
      description = cells[0].textContent.trim();
    } else {
      // Single cell: description is the text with the link removed.
      const clone = row.cloneNode(true);
      clone.querySelectorAll('a').forEach((a) => a.remove());
      description = clone.textContent.trim();
    }

    return { description, link };
  }).filter((card) => card.description || card.link);

  // --- Build the new structure --------------------------------------------
  block.textContent = '';

  if (cin) {
    const cinWrap = document.createElement('div');
    cinWrap.className = 'contact-email-outsourcing-cin';
    const b = document.createElement('b');
    b.textContent = cin;
    cinWrap.append(b);
    block.append(cinWrap);
  }

  if (cards.length) {
    const grid = document.createElement('ul');
    grid.className = 'contact-email-outsourcing-grid';

    cards.forEach(({ description, link }) => {
      const item = document.createElement('li');
      item.className = 'contact-email-outsourcing-card';

      if (description) {
        const p = document.createElement('p');
        p.textContent = description;
        item.append(p);
      }

      if (link) {
        // Normalise the email link: derive the label from the address.
        const email = link.getAttribute('href')
          ? link.getAttribute('href').replace(/^mailto:/i, '').split('?')[0].trim()
          : link.textContent.trim();
        const label = link.textContent.trim() || email;
        if (email && !link.getAttribute('href')) {
          link.setAttribute('href', `mailto:${email}`);
        }
        link.textContent = '';
        const strong = document.createElement('b');
        strong.textContent = label;
        link.append(strong);
        link.classList.add('contact-email-outsourcing-email');
        item.append(link);
      }

      grid.append(item);
    });

    block.append(grid);
  }
}
