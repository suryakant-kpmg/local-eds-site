// eslint-disable-next-line import/no-unresolved
import { toClassName, decorateBlocks } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

export default async function decorate(block) {
  // build tablist
  const tablist = document.createElement('div');
  tablist.className = 'tabs-list';
  tablist.setAttribute('role', 'tablist');

  // decorate tabs and tabpanels
  const tabs = [...block.children].map((child) => child.firstElementChild);
  tabs.forEach((tab, i) => {
    const id = toClassName(tab.textContent);

    // decorate tabpanel
    const tabpanel = block.children[i];
    tabpanel.className = 'tabs-panel';
    tabpanel.id = `tabpanel-${id}`;
    tabpanel.setAttribute('aria-hidden', !!i);
    tabpanel.setAttribute('aria-labelledby', `tab-${id}`);
    tabpanel.setAttribute('role', 'tabpanel');

    // build tab button
    const button = document.createElement('button');
    button.className = 'tabs-tab';
    button.id = `tab-${id}`;

    moveInstrumentation(tab.parentElement, tabpanel.lastElementChild);
    button.innerHTML = tab.innerHTML;

    button.setAttribute('aria-controls', `tabpanel-${id}`);
    button.setAttribute('aria-selected', !i);
    button.setAttribute('role', 'tab');
    button.setAttribute('type', 'button');
    button.addEventListener('click', () => {
      block.querySelectorAll('[role=tabpanel]').forEach((panel) => {
        panel.setAttribute('aria-hidden', true);
      });
      tablist.querySelectorAll('button').forEach((btn) => {
        btn.setAttribute('aria-selected', false);
      });
      tabpanel.setAttribute('aria-hidden', false);
      button.setAttribute('aria-selected', true);
    });
    tablist.append(button);
    tab.remove();
    moveInstrumentation(button.querySelector('p'), null);
  });

  block.prepend(tablist);

  // Decorate any nested blocks within tab panels
  decorateBlocks(block);

  // Add accordion functionality to ALL h2 headings within tab panels
  const tabPanels = block.querySelectorAll('.tabs-panel');
  const tabButtons = block.querySelectorAll('.tabs-tab');

  tabPanels.forEach((panel, index) => {
    // Add panel title (same as tab button text)
    const panelTitle = document.createElement('h3');
    panelTitle.className = 'panel-title';
    panelTitle.textContent = tabButtons[index]?.textContent?.trim() || '';
    panel.prepend(panelTitle);

    const headings = [...panel.querySelectorAll('h2')];

    // All h2s become accordions (no panel title)
    headings.forEach((heading) => {
      // Wrap content between this heading and next heading (or end) in a div
      const contentWrapper = document.createElement('div');
      contentWrapper.className = 'accordion-content';

      let nextElement = heading.nextElementSibling;
      const contentElements = [];

      while (nextElement && nextElement.tagName !== 'H2') {
        contentElements.push(nextElement);
        nextElement = nextElement.nextElementSibling;
      }

      contentElements.forEach((el) => contentWrapper.appendChild(el));
      heading.after(contentWrapper);

      // Add click handler to toggle accordion
      heading.addEventListener('click', () => {
        const isActive = heading.classList.contains('active');

        // Close all accordions in this panel
        headings.forEach((h) => h.classList.remove('active'));
        panel.querySelectorAll('.accordion-content').forEach((c) => c.classList.remove('active'));

        // Open clicked accordion if it wasn't active
        if (!isActive) {
          heading.classList.add('active');
          contentWrapper.classList.add('active');
        }
      });
    });

    // Open first accordion item by default
    const firstAccordion = headings[0];
    if (firstAccordion) {
      firstAccordion.classList.add('active');
      firstAccordion.nextElementSibling?.classList.add('active');
    }
  });
}
