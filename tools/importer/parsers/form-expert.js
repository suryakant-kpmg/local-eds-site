/* eslint-disable */
/* global WebImporter */

/**
 * Parser for form-expert block
 *
 * Source: https://www.asianpaints.com/inspiration/ideas/colour-inspiration.html
 * Base Block: form
 *
 * Block Structure:
 * - Row 1: Form title
 * - Row 2-N: Field label | Field type
 * - Last Row: Submit button label | submit
 *
 * Source HTML Pattern:
 * <div class="ccforms">
 *   <div class="enquire-form">
 *     <form id="pdp-request-call-back-form">
 *       <input placeholder="Name" type="text">
 *       <input placeholder="Email" type="email">
 *       <input placeholder="Mobile" type="tel">
 *       <input placeholder="PIN Code" type="text">
 *       <button type="submit">Submit</button>
 *     </form>
 *   </div>
 * </div>
 *
 * Generated: 2026-01-27
 */
export default function parse(element, { document }) {
  // Extract form title
  const formTitle = element.querySelector('.form-title') ||
                    element.querySelector('h2, h3') ||
                    element.querySelector('[class*="title"]');

  // Extract form element
  const form = element.querySelector('form') ||
               element.querySelector('.form-group-global');

  // Extract input fields
  const inputs = form ? Array.from(form.querySelectorAll('input:not([type="hidden"]):not([type="submit"])')) : [];

  // Extract submit button
  const submitBtn = element.querySelector('button[type="submit"]') ||
                    element.querySelector('input[type="submit"]') ||
                    element.querySelector('.submit-btn');

  // Build cells array
  const cells = [];

  // Add title row
  const titleText = formTitle ? formTitle.textContent.trim() : 'Get the right assistance for all your painting needs';
  cells.push([titleText]);

  // Add field rows
  inputs.forEach(input => {
    const label = input.placeholder || input.getAttribute('aria-label') || input.name || 'Field';
    const type = input.type || 'text';
    cells.push([label, type]);
  });

  // Add submit row if we have a submit button
  if (submitBtn) {
    const submitText = submitBtn.textContent.trim() || submitBtn.value || 'Submit';
    cells.push([submitText, 'submit']);
  } else {
    cells.push(['Submit', 'submit']);
  }

  const block = WebImporter.Blocks.createBlock(document, { name: 'Form-Expert', cells });
  element.replaceWith(block);
}
