import { trackEvent, triggerCTAClickWithLinkAndTitle, pushAdobeSingleEvent } from '../../scripts/analytics_1.js';

export default function decorate(block) {
  const ul = document.createElement('ul');
  ul.className = 'ql-list';

  const rows = [...block.children];

  // Inline SVG for the arrow (exactly as provided)
  const QL_ARROW_SVG = `
    <svg class="ql-arrow-svg" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" focusable="false">
      <g id="Icon">
        <g id="Icon_2">fv
          <path fill-rule="evenodd" clip-rule="evenodd"
            d="M10.2563 4.13128C10.598 3.78957 11.152 3.78957 11.4937 4.13128L16.7437 9.38128C17.0854 9.72299 17.0854 10.277 16.7437 10.6187L11.4937 15.8687C11.152 16.2104 10.598 16.2104 10.2563 15.8687C9.91457 15.527 9.91457 14.973 10.2563 14.6313L14.0126 10.875L3.875 10.875C3.39175 10.875 3 10.4832 3 10C3 9.51675 3.39175 9.125 3.875 9.125H14.0126L10.2563 5.36872C9.91457 5.02701 9.91457 4.47299 10.2563 4.13128Z"
            fill="#FF0D0D" style="mix-blend-mode:saturation"/>
          <path fill-rule="evenodd" clip-rule="evenodd"
            d="M10.2563 4.13128C10.598 3.78957 11.152 3.78957 11.4937 4.13128L16.7437 9.38128C17.0854 9.72299 17.0854 10.277 16.7437 10.6187L11.4937 15.8687C11.152 16.2104 10.598 16.2104 10.2563 15.8687C9.91457 15.527 9.91457 14.973 10.2563 14.6313L14.0126 10.875L3.875 10.875C3.39175 10.875 3 10.4832 3 10C3 9.51675 3.39175 9.125 3.875 9.125H14.0126L10.2563 5.36872C9.91457 5.02701 9.91457 4.47299 10.2563 4.13128Z"
            fill="white" style="mix-blend-mode:difference"/>
          <path fill-rule="evenodd" clip-rule="evenodd"
            d="M10.2563 4.13128C10.598 3.78957 11.152 3.78957 11.4937 4.13128L16.7437 9.38128C17.0854 9.72299 17.0854 10.277 16.7437 10.6187L11.4937 15.8687C11.152 16.2104 10.598 16.2104 10.2563 15.8687C9.91457 15.527 9.91457 14.973 10.2563 14.6313L14.0126 10.875L3.875 10.875C3.39175 10.875 3 10.4832 3 10C3 9.51675 3.39175 9.125 3.875 9.125H14.0126L10.2563 5.36872C9.91457 5.02701 9.91457 4.47299 10.2563 4.13128Z"
            fill="black" style="mix-blend-mode:saturation"/>
          <path fill-rule="evenodd" clip-rule="evenodd"
            d="M10.2563 4.13128C10.598 3.78957 11.152 3.78957 11.4937 4.13128L16.7437 9.38128C17.0854 9.72299 17.0854 10.277 16.7437 10.6187L11.4937 15.8687C11.152 16.2104 10.598 16.2104 10.2563 15.8687C9.91457 15.527 9.91457 14.973 10.2563 14.6313L14.0126 10.875L3.875 10.875C3.39175 10.875 3 10.4832 3 10C3 9.51675 3.39175 9.125 3.875 9.125H14.0126L10.2563 5.36872C9.91457 5.02701 9.91457 4.47299 10.2563 4.13128Z"
            fill="black" style="mix-blend-mode:overlay"/>
          <path fill-rule="evenodd" clip-rule="evenodd"
            d="M10.2563 4.13128C10.598 3.78957 11.152 3.78957 11.4937 4.13128L16.7437 9.38128C17.0854 9.72299 17.0854 10.277 16.7437 10.6187L11.4937 15.8687C11.152 16.2104 10.598 16.2104 10.2563 15.8687C9.91457 15.527 9.91457 14.973 10.2563 14.6313L14.0126 10.875L3.875 10.875C3.39175 10.875 3 10.4832 3 10C3 9.51675 3.39175 9.125 3.875 9.125H14.0126L10.2563 5.36872C9.91457 5.02701 9.91457 4.47299 10.2563 4.13128Z"
            fill="black" style="mix-blend-mode:overlay"/>
          <path fill-rule="evenodd" clip-rule="evenodd"
            d="M10.2563 4.13128C10.598 3.78957 11.152 3.78957 11.4937 4.13128L16.7437 9.38128C17.0854 9.72299 17.0854 10.277 16.7437 10.6187L11.4937 15.8687C11.152 16.2104 10.598 16.2104 10.2563 15.8687C9.91457 15.527 9.91457 14.973 10.2563 14.6313L14.0126 10.875L3.875 10.875C3.39175 10.875 3 10.4832 3 10C3 9.51675 3.39175 9.125 3.875 9.125H14.0126L10.2563 5.36872C9.91457 5.02701 9.91457 4.47299 10.2563 4.13128Z"
            fill="black" style="mix-blend-mode:overlay"/>
          <path fill-rule="evenodd" clip-rule="evenodd"
            d="M10.2563 4.13128C10.598 3.78957 11.152 3.78957 11.4937 4.13128L16.7437 9.38128C17.0854 9.72299 17.0854 10.277 16.7437 10.6187L11.4937 15.8687C11.152 16.2104 10.598 16.2104 10.2563 15.8687C9.91457 15.527 9.91457 14.973 10.2563 14.6313L14.0126 10.875L3.875 10.875C3.39175 10.875 3 10.4832 3 10C3 9.51675 3.39175 9.125 3.875 9.125H14.0126L10.2563 5.36872C9.91457 5.02701 9.91457 4.47299 10.2563 4.13128Z"
            fill="black" style="mix-blend-mode:overlay"/>
        </g>
      </g>
    </svg>
  `;

  rows.forEach((row) => {
    const cells = [...row.children];

    const type = (cells[0]?.textContent || '').trim().toLowerCase();
    const iconCell = cells[1];
    const headingCell = cells[2];
    const primaryTextCell = cells[3];
    const primaryLinkCell = cells[4];
    const secondaryTextCell = cells[5];

    const li = document.createElement('li');
    li.className = `ql-card ql-card--${type || 'default'}`;

    const iconUrl =
      iconCell?.querySelector('a')?.href ||
      iconCell?.querySelector('img')?.src ||
      (iconCell?.textContent || '').trim();

    const primaryText = (primaryTextCell?.textContent || '').trim();
    const primaryLink =
      primaryLinkCell?.querySelector('a')?.href ||
      (primaryLinkCell?.textContent || '').trim();

    const secondaryHtml = (secondaryTextCell?.innerHTML || '').trim();

    // ---------- HEADER ----------
    const header = document.createElement('div');
    header.className = 'ql-header';

    const iconWrap = document.createElement('div');
    iconWrap.className = 'ql-icon';

    const iconImg = document.createElement('img');
    iconImg.src = iconUrl;
    iconImg.alt = '';
    iconImg.loading = 'lazy';
    iconWrap.append(iconImg);

    const titleWrap = document.createElement('div');
    titleWrap.className = 'ql-title';
    titleWrap.innerHTML = headingCell?.innerHTML || '';

    header.append(iconWrap, titleWrap);

    // ---------- SPACER ----------
    const spacer = document.createElement('div');
    spacer.className = 'ql-spacer';

    // ---------- ACTION ROW ----------
    const actionRow = document.createElement('div');
    actionRow.className = 'ql-action-row';

    const primary = document.createElement('div');
    primary.className = 'ql-primary';

    const secondary = document.createElement('div');
    secondary.className = 'ql-secondary';

    if (type === 'call') {
      const number = document.createElement('span');
      number.className = 'ql-number';
      number.textContent = primaryText;
      primary.append(number);

      let href = primaryLink;
      if (!href) {
        const digits = primaryText.replace(/[^\d+]/g, '');
        href = `tel:${digits}`;
      }

      const overlay = document.createElement('a');
      overlay.className = 'ql-cardlink';
      overlay.href = href;
      overlay.setAttribute('aria-label', `Call ${primaryText}`);
      overlay.setAttribute('role', 'link');
      overlay.tabIndex = 0;

      overlay.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') overlay.click();
      });

      li.append(overlay);
    } else {
      const btn = document.createElement('a');
      btn.className = 'ql-btn';
      btn.href = primaryLink || '#';

      // ✅ SVG used here (instead of →)
      btn.innerHTML = `
        <span class="ql-btntext">${primaryText}</span>
        <span class="ql-arrow" aria-hidden="true">${QL_ARROW_SVG}</span>
      `;

      primary.append(btn);

      if (secondaryHtml) {
        secondary.innerHTML = secondaryHtml;
      } else {
        secondary.innerHTML = '';
        secondary.setAttribute('aria-hidden', 'true');
      }
    }

    actionRow.append(primary, secondary);

    li.append(header, spacer, actionRow);
    ul.append(li);

    row.remove();
  });

  block.textContent = '';
  block.append(ul);

  block.querySelectorAll('.ql-card--call a').forEach((link) => {
    link.addEventListener('click', () => {
      trackEvent('SPSContactClick', { cta_: 'Contact Us Component' });
      pushAdobeSingleEvent("SPSContactClick")
    });
  });

  block.querySelectorAll('.ql-card--whatsapp .ql-action-row a').forEach((link) => {
    link.addEventListener('click', () => {
      trackEvent('contact_us_click_whatsapp', { cta_: 'Contact Us - WhatsApp Component' });
      pushAdobeSingleEvent("contact_us_click_whatsapp")
    });
  });

  block.querySelectorAll('.ql-card:not(.ql-card--call):not(.ql-card--whatsapp) .ql-action-row .ql-btn').forEach((link) => {
    link.addEventListener('click', () => {
      const ctaLink = link.getAttribute('href') || '';
      const btnTitle = (link.querySelector('.ql-btntext')?.textContent || link.textContent || '').trim();
      const parentTitle = (link.closest('.ql-card')?.querySelector('.ql-title')?.textContent || '').trim();
      triggerCTAClickWithLinkAndTitle(ctaLink, btnTitle, parentTitle);
    });
  });
}