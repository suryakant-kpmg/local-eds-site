import { createOptimizedPicture } from '../../scripts/aem.js';
import { trackEvent, pushAdobeCtaClickEvent } from '../../scripts/analytics_1.js';

// plan colours are picked by plan name, falling back to the plan's position
const PLAN_KEYS = ['classic', 'gold', 'platinum'];

// labelled option rows: "Heading | text" and "Sub heading | text"
const OPTIONS = {
  heading: 'heading',
  subheading: 'subheading',
};

/**
 * @param {Element[]} cells the cells of a row
 * @returns {string|null} the option a two-cell row sets, if any
 */
function optionName(cells) {
  if (cells.length !== 2) return null;
  const label = cells[0].textContent.trim().toLowerCase().replace(/[\s:_-]/g, '');
  return OPTIONS[label] || null;
}

/**
 * @param {string} name the plan name
 * @param {number} index position of the plan
 * @returns {string} classic, gold or platinum
 */
function planKey(name, index) {
  const text = name.toLowerCase();
  return PLAN_KEYS.find((key) => text.includes(key)) || PLAN_KEYS[index % PLAN_KEYS.length];
}

/**
 * builds the plan header: an optional header image with the plan name
 * @param {Element} cell the plan name cell
 * @returns {HTMLDivElement}
 */
function buildHeader(cell) {
  const header = document.createElement('div');
  header.className = 'choose-plan-header';

  const img = cell.querySelector('img');
  if (img) {
    const image = document.createElement('div');
    image.className = 'choose-plan-header-image';
    // decorative: the plan name is shown as text on top of it
    image.append(createOptimizedPicture(img.src, '', false, [{ width: '750' }]));
    header.append(image);
    (img.closest('picture') || img).remove();
    header.classList.add('has-image');
  }

  let heading = cell.querySelector('h1, h2, h3, h4, h5, h6');
  if (!heading) {
    heading = document.createElement('h3');
    heading.textContent = cell.textContent.trim();
  }
  header.append(heading);
  return header;
}

/**
 * loads and decorates the choose-plan block
 * @param {Element} block The choose-plan block element
 */
export default function decorate(block) {
  const intro = document.createElement('div');
  intro.className = 'choose-plan-intro';

  const plans = document.createElement('div');
  plans.className = 'choose-plan-plans';

  [...block.children].forEach((row) => {
    const cells = [...row.children];

    // "Heading" and "Sub heading" option rows
    const option = optionName(cells);
    if (option) {
      const text = cells[1].textContent.trim();
      if (text) {
        const el = document.createElement(option === 'heading' ? 'h2' : 'p');
        el.className = `choose-plan-${option}`;
        el.textContent = text;
        intro.append(el);
      }
      return;
    }

    // a row with a single cell is the intro (heading + description)
    if (cells.length <= 1) {
      if (cells[0]) intro.append(...cells[0].childNodes);
      return;
    }

    // otherwise the row is a plan: name (+ optional image) | features | optional cta
    const [nameCell, features, cta] = cells;
    const card = document.createElement('div');
    card.className = 'choose-plan-plan';

    const header = buildHeader(nameCell);
    card.classList.add(`plan-${planKey(header.textContent, plans.children.length)}`);
    card.append(header);

    if (features) {
      features.className = 'choose-plan-features';
      // lines starting with * are footnotes (e.g. availability notes)
      features.querySelectorAll('li, p').forEach((item) => {
        if (item.textContent.trim().startsWith('*')) item.classList.add('choose-plan-footnote');
      });
      card.append(features);
    }

    const authoredLink = cta && cta.querySelector('a[href]');
    if (authoredLink) {
      // clone drops the global bindButtonContainerTracking listener so the click isn't tracked twice
      const link = authoredLink.cloneNode(true);
      authoredLink.replaceWith(link);
      cta.className = 'choose-plan-cta';
      link.className = 'button choose-plan-button';
      link.addEventListener('click', () => {
        const btnTitle = link.textContent.trim();
        const planName = card.querySelector('.choose-plan-header h3')?.textContent?.trim() || '';
        const parentTitle = block.querySelector('h1, h2, h3, h4, h5, h6')?.textContent?.trim() || '';

        trackEvent('custom_cta_click', {
          cta_: `${btnTitle} - ${planName}`,
          parentTitle,
        });
        pushAdobeCtaClickEvent({
          cta: `${btnTitle} - ${planName}`,
          parentTitle,
          event: 'custom_cta_click',
        });
      });
      card.append(cta);
    }

    plans.append(card);
  });

  // keep the heading above the sub heading whatever order the rows were authored in
  const heading = intro.querySelector(':scope > .choose-plan-heading');
  if (heading) intro.prepend(heading);

  block.replaceChildren(...(intro.childNodes.length ? [intro] : []), plans);
}
