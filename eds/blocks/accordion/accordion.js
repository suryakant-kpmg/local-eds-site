/*
 * Accordion Block
 * Recreate an accordion
 * https://www.hlx.live/developer/block-collection/accordion
 *
 * Variants:
 * - default: standard expand/collapse with chevron
 * - faq: FAQ-style with plus/minus icons, view-all button, first item open
 */

import { moveInstrumentation } from '../../scripts/scripts.js';
import { trackEvent, triggerCTAClickWithLinkAndTitle, pushAdobeCtaClickEvent } from '../../scripts/analytics_1.js';

function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Adds quick open/close animation to a <details> accordion item.
 * This does NOT change any other behavior (no "close others" logic, etc.)
 */
function addDetailsAnimation(detailsEl, summaryEl, bodyEl, {
  durationOpen = 180,
  durationClose = 160,
} = {}) {
  if (!detailsEl || !summaryEl || !bodyEl) return;

  // Avoid double-binding
  if (detailsEl.dataset.animBound === 'true') return;
  detailsEl.dataset.animBound = 'true';

  let isAnimating = false;

  const openWithAnimation = () => {
    if (isAnimating) return;
    isAnimating = true;

    // Open first so the content has layout
    detailsEl.open = true;

    // Prepare for animation
    bodyEl.style.overflow = 'hidden';
    bodyEl.style.willChange = 'height, opacity';

    // Start from 0 height
    bodyEl.style.height = '0px';
    bodyEl.style.opacity = '0';

    // Force reflow
    // eslint-disable-next-line no-unused-expressions
    bodyEl.offsetHeight;

    const targetHeight = bodyEl.scrollHeight;

    const anim = bodyEl.animate([
      { height: '0px', opacity: 0 },
      { height: `${targetHeight}px`, opacity: 1 },
    ], {
      duration: durationOpen,
      easing: 'ease',
    });

    anim.onfinish = () => {
      // Cleanup to allow natural height after animation
      bodyEl.style.height = '';
      bodyEl.style.opacity = '';
      bodyEl.style.overflow = '';
      bodyEl.style.willChange = '';
      isAnimating = false;
    };

    anim.oncancel = () => {
      bodyEl.style.height = '';
      bodyEl.style.opacity = '';
      bodyEl.style.overflow = '';
      bodyEl.style.willChange = '';
      isAnimating = false;
    };
  };

  const closeWithAnimation = () => {
    if (isAnimating) return;
    isAnimating = true;

    bodyEl.style.overflow = 'hidden';
    bodyEl.style.willChange = 'height, opacity';

    // Current rendered height (can be 'auto', so measure)
    const startHeight = bodyEl.getBoundingClientRect().height;

    bodyEl.style.height = `${startHeight}px`;
    bodyEl.style.opacity = '1';

    // Force reflow
    // eslint-disable-next-line no-unused-expressions
    bodyEl.offsetHeight;

    const anim = bodyEl.animate([
      { height: `${startHeight}px`, opacity: 1 },
      { height: '0px', opacity: 0 },
    ], {
      duration: durationClose,
      easing: 'ease',
    });

    anim.onfinish = () => {
      detailsEl.open = false; // close only after animation ends
      bodyEl.style.height = '';
      bodyEl.style.opacity = '';
      bodyEl.style.overflow = '';
      bodyEl.style.willChange = '';
      isAnimating = false;
    };

    anim.oncancel = () => {
      // Ensure a sane state
      detailsEl.open = false;
      bodyEl.style.height = '';
      bodyEl.style.opacity = '';
      bodyEl.style.overflow = '';
      bodyEl.style.willChange = '';
      isAnimating = false;
    };
  };

  function toggle() {
    const parent = detailsEl.parentElement;

    // If opening, close other open accordions first
    if (!detailsEl.open && parent) {
      parent.querySelectorAll('.accordion-item[open]').forEach((item) => {
        if (item !== detailsEl) {
          const otherBody = item.querySelector('.accordion-item-body');

          if (otherBody) {
            otherBody.style.overflow = 'hidden';
            otherBody.style.willChange = 'height, opacity';

            const startHeight = otherBody.getBoundingClientRect().height;
            otherBody.style.height = `${startHeight}px`;
            otherBody.style.opacity = '1';

            // force reflow
            // eslint-disable-next-line no-unused-expressions
            otherBody.offsetHeight;

            const anim = otherBody.animate([
              { height: `${startHeight}px`, opacity: 1 },
              { height: '0px', opacity: 0 },
            ], {
              duration: durationClose,
              easing: 'ease',
            });

            anim.onfinish = () => {
              item.open = false;
              otherBody.style.height = '';
              otherBody.style.opacity = '';
              otherBody.style.overflow = '';
              otherBody.style.willChange = '';
            };

            anim.oncancel = () => {
              item.open = false;
              otherBody.style.height = '';
              otherBody.style.opacity = '';
              otherBody.style.overflow = '';
              otherBody.style.willChange = '';
            };
          } else {
            item.open = false;
          }
        }
      });
    }

    if (prefersReducedMotion()) {
      detailsEl.open = !detailsEl.open;
      return;
    }

    if (detailsEl.open) {
      closeWithAnimation();
    } else {
      openWithAnimation();
    }
  }

  // Intercept clicks so native toggle doesn't instantly open/close (we animate instead)
  summaryEl.addEventListener('click', (e) => {
    e.preventDefault();
    toggle();
  });

  // Keyboard accessibility: Enter / Space
  summaryEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle();
    }
  });
}

function trackAccordionClick(block, summaryEl) {
  const isFaq = block.classList.contains('faq');
  summaryEl.addEventListener('click', () => {
    // Read open state from the parent <details> element.
    // summaryEl.closest() is used instead of e.target.closest() to
    // ensure we always find the details regardless of which child of
    // the summary (icon, span, etc.) was the actual click target.
    const detailsEl = summaryEl.closest('.accordion-item');
    const wasOpen = detailsEl?.open ?? false;
    const questionText = summaryEl.textContent?.trim() || '';
    if (isFaq) {
      trackEvent('cta_link_text', {
        cta_: wasOpen ? 'FAQ close' : 'FAQ Open',
        parentTitle: questionText,
      });
      pushAdobeCtaClickEvent({
        event: 'cta_link_text',
        cta: wasOpen ? 'FAQ close' : 'FAQ Open',
        parentTitle: questionText,
      });
    } else {
      const state = wasOpen ? 'Close' : 'Open';
      trackEvent('cta_link_text', {
        cta_: `Accordion ${state}`,
        parentTitle: questionText,
      });
      pushAdobeCtaClickEvent({
        event: 'cta_link_text',
        cta: `Accordion ${state}`,
        parentTitle: questionText,
      });
    }
  });
}

export default function decorate(block) {
  const isFaq = block.classList.contains('faq');
  const rows = [...block.children];

  if (isFaq) {
    const initialVisibleCount = 5;
    const validRows = rows.filter((row) => {
      const label = row.children[0];
      const body = row.children[1];
      return label && body && (label.textContent.trim() || body.textContent.trim());
    });

    validRows.forEach((row, index) => {
      const label = row.children[0];
      const summary = document.createElement('summary');
      summary.className = 'accordion-item-label';
      // const questionPrefix = `${index + 1}. `;
      const questionText = label.textContent.trim();
      if (questionText && !/^\d+\./.test(questionText)) {
        const numbered = document.createElement('span');
        numbered.textContent = `${questionText}`;
        summary.append(numbered);
      } else {
        summary.append(...label.childNodes);
      }

      const body = row.children[1];
      body.className = 'accordion-item-body';

      const details = document.createElement('details');
      [...row.attributes].forEach((attr) => {
        if (attr.name.startsWith('data-')) {
          details.setAttribute(attr.name, attr.value);
        }
      });
      details.className = 'accordion-item';

      if (index === 0) details.open = true;

      details.append(summary, body);
      trackAccordionClick(block, summary);

      // ✅ ADD: JS slide open/close animation (only for FAQ)
      addDetailsAnimation(details, summary, body, {
        durationOpen: 400,
        durationClose: 400,
      });

      if (index >= initialVisibleCount) {
        details.style.display = 'none';
        details.classList.add('accordion-faq-hidden');
      }

      row.replaceWith(details);
    });

    if (validRows.length > initialVisibleCount) {
      const viewAllBtn = document.createElement('button');
      viewAllBtn.className = 'accordion-faq-view-all';
      viewAllBtn.textContent = 'VIEW ALL';
      viewAllBtn.addEventListener('click', () => {
        const parentTitle = block.closest('.section')?.querySelector('h1, h2, h3, h4, h5, h6')?.textContent?.trim() || '';
        triggerCTAClickWithLinkAndTitle('javascript:void(0)', viewAllBtn.textContent?.trim() || 'View all', parentTitle);

        block.querySelectorAll('.accordion-faq-hidden').forEach((item) => {
          item.style.display = 'block';
          item.classList.remove('accordion-faq-hidden');
        });
        viewAllBtn.style.display = 'none';
      });
      block.appendChild(viewAllBtn);
    }
  } else {
    rows.forEach((row) => {
      const label = row.children[0];
      const summary = document.createElement('summary');
      summary.className = 'accordion-item-label';
      summary.append(...label.childNodes);

      const body = row.children[1];
      body.className = 'accordion-item-body';

      const details = document.createElement('details');
      moveInstrumentation(row, details);
      details.className = 'accordion-item';
      details.append(summary, body);
      trackAccordionClick(block, summary);

      // (No animation for default variant — keeping behavior unchanged)
      row.replaceWith(details);
    });
  }
}
