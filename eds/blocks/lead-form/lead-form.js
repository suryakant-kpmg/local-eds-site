/**
 * Lead Form Block
 * Supports both JSON-based form definitions and HTML table structure.
 * Special handling for "book-free-site-visit" form with WhatsApp toggle,
 * mobile prefix, and radio pill questions.
 */

import { submitLeadFromForm, getCampaignIdFromUrl } from '../../scripts/form-submit-common.js';
import { getDigitalData, trackEvent, trackFormError, ga4Implementaion, pushAdobeCtaClickEvent, pushAdobeFormEvents } from '../../scripts/analytics_1.js';
import { firePixelConversion } from '../../scripts/third-party-pixels.js';

const BOOK_FREE_SITE_VISIT_FORM = 'book-free-site-visit';
const DEFAULT_SUCCESS_MESSAGE = 'Thank you! We will contact you soon.';
const DEFAULT_ERROR_MESSAGE = 'Something went wrong. Please try again.';

// Thank you and error overlay constants
const THANK_YOU_DESKTOP_VIDEO = 'https://static.asianpaints.com/content/dam/asian_paints/forms/thank-you-gif/Thankyou-pop-up-desktop.webm';
const THANK_YOU_MOBILE_VIDEO = 'https://static.asianpaints.com/content/dam/asian_paints/forms/thank-you-gif/Thank-you-pop-up-mobile-without-x.webm';
const THANK_YOU_CTA_LINK = '/content/ap/en/home/services/interior-design-solutions.html';
const ERROR_CTA_LINK = 'https://www.asianpaints.com/services.html';
const ERROR_DOWNLOAD_LINK = '/content/dam/asian_paints/restricted/the-colour-book-asian-paints.pdf';
const THANK_YOU_TWO_DESKTOP = 'https://www.asianpaints.com/content/dam/asian_paints/forms/thank-you-gif/Thankyou-success-image-desktop.webp';
const THANK_YOU_TWO_MOB = 'https://www.asianpaints.com/content/dam/asian_paints/forms/thank-you-gif/Thankyou-success-image-mobile.webp';

let ERROR_DESKTOP_IMAGE = 'https://www.asianpaints.com/content/dam/apcolourcatalogue/asset/ap-revamp/ccformsthankyou/ExitFormSuccess.webp';
let ERROR_MOBILE_IMAGE = 'https://www.asianpaints.com/content/dam/apcolourcatalogue/asset/ap-revamp/ccformsthankyou/ExitFormSuccessMweb.webp';

/**
 * Whether to render the BHPS disclaimer questions + WhatsApp toggle (see
 * createBhpsQuestionsWrapper()) instead of the generic question-panel/
 * radio-pill + toggle-switch markup, for the "book-free-site-visit" form.
 *
 * Authored via section-metadata row "exit-intent-form-isBhps" (true/false).
 * decorateSections() (eds/scripts/aem.js) lowercases the row label and
 * turns it into a data-exit-intent-form-isbhps attribute on the section —
 * same convention modal.js already reads exit-intent-form-button-text/
 * exit-intent-form-callus-title from. Defaults to true when the row is
 * absent, since that's the pre-existing hardcoded behavior.
 */
function isBhpsForm() {
  const raw = document
    .querySelector('main [data-exit-intent-form-isbhps]')
    ?.dataset
    .exitIntentFormIsbhps
    ?.trim()
    .toLowerCase();

  if (!raw) return true;
  return raw !== 'false';
}

function normalizeText(value = '') {
  return `${value}`.replace(/\s+/g, ' ').trim();
}

function slugify(value = 'field') {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'field';
}

function toBoolean(value) {
  if (typeof value === 'boolean') return value;
  const normalized = normalizeText(value).toLowerCase();
  return ['true', 'x', 'yes', 'on'].includes(normalized);
}

function parseList(value) {
  const normalized = normalizeText(value);
  if (!normalized) return [];
  return normalized.split(',').map((entry) => normalizeText(entry)).filter(Boolean);
}

function inferInputType(rawField) {
  const rawType = normalizeText(rawField?.Type).toLowerCase() || 'text';
  if (['email', 'tel', 'hidden', 'checkbox', 'radio', 'submit', 'plaintext'].includes(rawType)) {
    return rawType;
  }
  return rawType;
}

function createField(rawField, index) {
  const name = normalizeText(rawField?.Name) || `field-${index + 1}`;
  const type = inferInputType(rawField);
  const label = normalizeText(rawField?.Label || rawField?.Name || '');
  const placeholder = normalizeText(rawField?.Placeholder);
  const description = normalizeText(rawField?.Description);
  const options = parseList(rawField?.Options);
  const optionNames = parseList(rawField?.OptionNames);
  const value = rawField?.Value ?? '';
  const maxLength = rawField?.Max !== '' && rawField?.Max != null ? Number(rawField.Max) : null;

  return {
    id: `lead-${slugify(name)}-${index + 1}`,
    name,
    type,
    label,
    placeholder,
    description,
    value,
    required: toBoolean(rawField?.Mandatory),
    checked: toBoolean(rawField?.Checked) || (type === 'checkbox' && value !== ''),
    maxLength: Number.isNaN(maxLength) ? null : maxLength,
    options: options.map((opt, i) => ({
      label: optionNames[i] || opt,
      value: opt,
    })),
  };
}

/* ========== Field Renderers ========== */

/**
 * Build a field <label>, with the "*" required marker (when shown) in its
 * own span so it can be colored independently of the label text.
 */
function createFieldLabel(field, showRequiredMarker = true) {
  const label = document.createElement('label');
  label.setAttribute('for', field.id);
  label.append(document.createTextNode(field.label));

  if (showRequiredMarker && field.required) {
    label.append(document.createTextNode(' '));
    const required = document.createElement('span');
    required.className = 'form-global__required';
    required.textContent = '*';
    label.append(required);
  }

  return label;
}

function createTextField(field, showRequiredMarker = true) {
  const wrapper = document.createElement('div');
  wrapper.className = `field-wrapper field-${field.name}`;
  wrapper.dataset.required = field.required ? 'true' : 'false';

  const label = createFieldLabel(field, showRequiredMarker);

  const input = document.createElement('input');
  let inputType = 'text';
  if (field.type === 'tel') inputType = 'tel';
  else if (field.type === 'email') inputType = 'email';
  input.type = inputType;
  input.id = field.id;
  input.name = field.name;
  input.placeholder = field.placeholder;
  input.required = field.required;
  input.autocomplete = 'off';

  if (field.maxLength) input.maxLength = field.maxLength;

  wrapper.append(label, input);
  return wrapper;
}

function createMobileField(field) {
  const wrapper = document.createElement('div');
  wrapper.className = `field-wrapper field-${field.name}`;
  wrapper.dataset.required = field.required ? 'true' : 'false';

  const label = createFieldLabel(field);

  const row = document.createElement('div');
  row.className = 'mobile-field-row';

  const prefix = document.createElement('div');
  prefix.className = 'mobile-prefix';

  const flag = document.createElement('span');
  flag.className = 'mobile-flag';
  flag.setAttribute('aria-hidden', 'true');

  const code = document.createElement('span');
  code.className = 'mobile-code';
  code.textContent = field.description || '+91';

  prefix.append(flag, code);

  const input = document.createElement('input');
  input.type = 'tel';
  input.id = field.id;
  input.name = field.name;
  input.placeholder = field.placeholder;
  input.required = field.required;
  input.autocomplete = 'off';
  input.maxLength = 10;
  input.inputMode = 'numeric';

  row.append(prefix, input);
  wrapper.append(label, row);
  return wrapper;
}

function syncWhatsAppToggle(wrapper) {
  const input = wrapper?.querySelector('input[type="checkbox"]');
  const toggle = wrapper?.querySelector('.whatsapp-toggle');
  const state = toggle?.querySelector('.toggle-state');

  if (!input || !toggle || !state) return;

  toggle.classList.toggle('is-checked', input.checked);
  wrapper.classList.toggle('whatsAppCheckbox-checked', input.checked);
  state.textContent = input.checked ? 'ON' : 'OFF';
}

function createWhatsAppField(field) {
  const wrapper = document.createElement('div');
  wrapper.className = `field-wrapper field-${field.name} whatsapp-field whatsAppConsentFormFld whatsAppCheckbox-checked`;

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.id = field.id;
  input.name = field.name;
  input.value = 'true';
  input.checked = true;
  input.defaultChecked = true;

  const label = document.createElement('label');
  label.setAttribute('for', field.id);

  const text = document.createElement('span');
  text.className = 'whatsapp-label-text';
  text.textContent = field.label || 'Update me on WhatsApp';

  const toggle = document.createElement('span');
  toggle.className = 'whatsapp-toggle is-checked';
  toggle.setAttribute('aria-hidden', 'true');

  const state = document.createElement('span');
  state.className = 'toggle-state';
  state.textContent = 'ON';
  toggle.append(state);

  label.append(text, toggle);
  wrapper.append(input, label);

  input.addEventListener('change', () => syncWhatsAppToggle(wrapper));
  syncWhatsAppToggle(wrapper);

  return wrapper;
}

function createQuestionField(field) {
  const fieldset = document.createElement('fieldset');
  fieldset.className = 'question-field';
  fieldset.dataset.required = field.required ? 'true' : 'false';

  const legend = document.createElement('legend');
  legend.textContent = field.label;
  fieldset.append(legend);

  const options = document.createElement('div');
  options.className = 'radio-pill-group';

  // Fall back to the Placeholder column's comma-separated list when there's
  // no dedicated Options column authored (e.g. the bhps_question_1/
  // bhps_question_2 rows).
  const fieldOptions = field.options.length
    ? field.options
    : parseList(field.placeholder).map((opt) => ({ label: opt, value: opt }));

  fieldOptions.forEach((option, index) => {
    const optionId = `${field.id}-${slugify(option.value)}`;
    const optionWrapper = document.createElement('div');
    optionWrapper.className = 'radio-pill';

    const input = document.createElement('input');
    input.type = 'radio';
    input.id = optionId;
    input.name = field.name;
    input.value = option.value;
    input.required = field.required;

    const label = document.createElement('label');
    label.setAttribute('for', optionId);
    label.textContent = option.label || option.value || `Option ${index + 1}`;

    optionWrapper.append(input, label);
    options.append(optionWrapper);
  });

  fieldset.append(options);
  return fieldset;
}

/**
 * Escape text for safe interpolation into innerHTML.
 */
function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

/**
 * "Immediate" and "Within a month" are business-required to submit the
 * same merged value the backend expects, even though DA authors them as
 * two distinct comma-separated options in the Placeholder column (which
 * can't express "different label, same value" on its own).
 */
function getBhpsOptionValue(label) {
  const normalized = label.trim().toLowerCase();
  if (normalized === 'immediate' || normalized === 'within a month') {
    return 'Immediate/Within 1 Month';
  }
  return label;
}

/**
 * Build one BHPS disclaimer question's markup (fieldset + radio options)
 * from its field definition — label = legend, options = comma-separated
 * list authored in the Placeholder column (DA has no separate Options
 * column for these rows). Returns '' when the field is missing or has no
 * options, so the question is simply omitted.
 */
function buildBhpsQuestionHtml(field, groupClass) {
  if (!field) return '';

  const options = parseList(field.placeholder);
  if (!field.label || !options.length) {
    // eslint-disable-next-line no-console
    console.warn(
      '[lead-form] BHPS disclaimer question skipped — missing label or options.',
      {
        name: field.name, label: field.label, placeholder: field.placeholder, options,
      },
    );
    return '';
  }

  const optionsHtml = options.map((label) => {
    const value = getBhpsOptionValue(label);
    return `
    <label class="disclaimer-radio-label" tabindex="-1">
      <input type="radio" name="${field.name}" value="${escapeHtml(value)}" tabindex="-1" class="form-radio-input__field"${field.required ? ' required' : ''}>
      <span tabindex="0" role="radio" class="form-radio-input__custom-element track_field_focus focus-visible-auto-imp" aria-label="${escapeHtml(label)}" aria-checked="false"></span>
      <span class="form-global__custom-label-text">${escapeHtml(label)}</span>
    </label>
  `;
  }).join('');

  return `
    <div class="${groupClass} disclaimer-group d-flex">
      <fieldset>
        <legend>
          ${escapeHtml(field.label)}
          ${field.required ? '<span class="form-global__required">*</span>' : ''}
        </legend>
        <div class="radio-options-wrapper">${optionsHtml}</div>
      </fieldset>
    </div>
  `;
}

/**
 * BHPS-specific disclaimer questions + WhatsApp toggle markup (see
 * eds/blocks/form/form.js), used instead of the generic question-panel/
 * radio-pill + toggle-switch rendering when isBhpsForm is true.
 * questionOneField/questionTwoField are the bhps_question_1/bhps_question_2
 * field definitions from DA (Name/Type/Label/Placeholder/Mandatory columns)
 * — their Placeholder column holds a comma-separated list of option labels.
 * The whatsapp_consent field name still matches the JSON form definition
 * so submission/tracking code needs no changes for it.
 */
function createBhpsQuestionsWrapper(questionOneField, questionTwoField) {
  const wrapper = document.createElement('div');
  wrapper.className = 'new-questions-wrapper';

  const questionOneHtml = buildBhpsQuestionHtml(questionOneField, 'disclaimer-ques-one');
  const questionTwoHtml = buildBhpsQuestionHtml(questionTwoField, 'disclaimer-ques-two');

  wrapper.innerHTML = `
    <!-- New Disclaimer Questions -->
    <div class="new-disclaimer-questions">
      ${questionOneHtml}
      ${questionTwoHtml}
    </div>

    <!-- WhatsApp Toggle -->
    <label class="form-whatsapp-consent" tabindex="-1">
      <input type="checkbox" name="whatsapp_consent" tabindex="-1" class="form-checkbox-input__field whatsAppConsentFormFld" checked>
      <span tabindex="0" role="checkbox" class="form-checkbox-input__custom--check track_field_focus whatsAppCheckbox-checked focus-visible-auto-imp" aria-label="whatsapp toggle button" aria-checked="true"></span>
      <span class="form-global__custom-label-text">Get updates on WhatsApp</span>
    </label>
  `;

  // Wire up the WhatsApp toggle: the visible control is a decorative span
  // (role="checkbox") next to a visually-hidden real checkbox input. Keep
  // both in sync and let click/keyboard (Enter/Space) toggle the state.
  // whatsAppCheckbox-checked is also toggled on the input itself (not just
  // the span) since .whatsAppConsentFormFld lives on the input and
  // trackLeadFormSubmission() reads that exact element's class list.
  const whatsappInput = wrapper.querySelector('.form-whatsapp-consent .form-checkbox-input__field');
  const whatsappCheck = wrapper.querySelector('.form-whatsapp-consent .form-checkbox-input__custom--check');

  if (whatsappInput && whatsappCheck) {
    const syncToggle = () => {
      const { checked } = whatsappInput;
      whatsappCheck.classList.toggle('whatsAppCheckbox-checked', checked);
      whatsappCheck.setAttribute('aria-checked', String(checked));
      whatsappInput.classList.toggle('whatsAppCheckbox-checked', checked);
    };

    whatsappInput.checked = true;
    syncToggle();

    whatsappInput.addEventListener('change', syncToggle);

    whatsappCheck.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      whatsappInput.checked = !whatsappInput.checked;
      whatsappInput.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  return wrapper;
}

/**
 * Find whichever replacement phrase appears earliest in `remaining`, so
 * callers can split on it. Not a closure over loop state, unlike an
 * inline arrow function would be, hence the standalone helper.
 */
function findEarliestReplacement(remaining, replacements) {
  let earliest;
  replacements.forEach((r) => {
    const index = remaining.indexOf(r.text);
    if (index === -1) return;
    if (!earliest || index < earliest.index) earliest = { ...r, index };
  });
  return earliest;
}

/**
 * Disclaimer text, with the "Terms & Conditions" and "Privacy Policy"
 * phrases turned into links when a URL for them was authored (see
 * extractDisclaimerLinks()). Built via textContent + DOM nodes (not
 * innerHTML) so the rest of the label can't be interpreted as markup.
 */
function createPlainTextField(field, links = {}) {
  const wrapper = document.createElement('div');
  wrapper.className = 'field-wrapper disclaimer-field';

  const p = document.createElement('p');
  const replacements = [
    { text: 'Terms & Conditions', href: links.terms },
    { text: 'Privacy Policy', href: links.privacy },
  ].filter((r) => r.href);

  if (!replacements.length) {
    p.textContent = field.label;
  } else {
    // Split the label on whichever phrase appears first each time, so
    // multiple replacements interleave correctly regardless of order.
    let remaining = field.label || '';
    while (remaining) {
      const next = findEarliestReplacement(remaining, replacements);

      if (!next) {
        p.append(document.createTextNode(remaining));
        break;
      }

      if (next.index > 0) {
        p.append(document.createTextNode(remaining.slice(0, next.index)));
      }
      const link = document.createElement('a');
      link.href = next.href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.className = 'disclaimer-link';
      link.textContent = next.text;
      p.append(link);

      remaining = remaining.slice(next.index + next.text.length);
    }
  }

  wrapper.append(p);
  return wrapper;
}

function createSubmitButton(field) {
  const wrapper = document.createElement('div');
  wrapper.className = 'field-wrapper submit-wrapper';

  const button = document.createElement('button');
  button.type = 'submit';
  button.textContent = field.label || 'Submit';
  button.dataset.originalText = field.label || 'Submit';

  wrapper.append(button);
  return wrapper;
}

/* ========== Form Building ========== */

function getRequiredFields(form) {
  // .disclaimer-group radios (BHPS markup) aren't wrapped in .field-wrapper,
  // so they're picked up separately alongside the usual required fields.
  return [...form.querySelectorAll(
    '.field-wrapper[data-required="true"] input, .disclaimer-group input[type="radio"]',
  )].filter((input) => input.type !== 'hidden' && !input.disabled);
}

function updateSubmitState(form) {
  const submitBtn = form.querySelector('.submit-wrapper button');
  if (!submitBtn) return;

  const isValid = getRequiredFields(form).every((input) => {
    if (input.type === 'radio') {
      const radios = form.querySelectorAll(`input[name="${input.name}"]`);
      return [...radios].some((r) => r.checked);
    }
    return input.value.trim() && input.checkValidity();
  });

  submitBtn.disabled = !isValid;
}

function wireValidation(form) {
  getRequiredFields(form).forEach((input) => {
    // Show error on blur
    input.addEventListener('blur', () => {
      validateInputField(input, true);
    });

    // Clear/update error on input if field already has error
    input.addEventListener('input', () => {
      const fieldWrapper = input.closest('.field-wrapper');
      if (fieldWrapper && fieldWrapper.classList.contains('has-error')) {
        validateInputField(input, true);
      }
    });

    // Update submit button state on change
    input.addEventListener('input', () => updateSubmitState(form));
  });
  updateSubmitState(form);
}

// Disclaimer-question field names — the current DA sheet shape
// (bhps_question_1/bhps_question_2, options in the Placeholder column) and
// the older renovating_home/hired_painter shape (options in a real Options
// column) can both be present in the same sheet at once (e.g. mid-migration,
// old rows not yet deleted). bhps_question_1/2 always win when present —
// see resolveQuestionField(). Matched case/whitespace-insensitively since
// sheet/JSON exports can alter casing.
const QUESTION_FIELD_NAMES = ['bhps_question_1', 'bhps_question_2', 'renovating_home', 'hired_painter'];
const isQuestionFieldName = (name) => QUESTION_FIELD_NAMES
  .includes(normalizeText(name).toLowerCase());

/**
 * Resolve question 1 or question 2's actual field, trying each candidate
 * name in priority order (bhps_question_N first) rather than just taking
 * whichever matching field happens to appear first in the sheet.
 */
function resolveQuestionField(fields, candidateNames) {
  for (let i = 0; i < candidateNames.length; i += 1) {
    const candidate = candidateNames[i];
    const match = fields.find((f) => normalizeText(f.name).toLowerCase() === candidate);
    if (match) return match;
  }
  return undefined;
}

// Row names for the disclaimer's link URLs — authored as regular rows in
// the same DA sheet as the fields (Name = "Terms & Conditions link" /
// "Privacy Policy link", Type column repurposed to hold the URL), rather
// than a real form field. Matched case-insensitively for the same reason
// as QUESTION_FIELD_NAMES above.
const DISCLAIMER_LINK_ROW_NAMES = {
  'terms & conditions link': 'terms',
  'privacy policy link': 'privacy',
};

function isDisclaimerLinkRowName(name) {
  return normalizeText(name).toLowerCase() in DISCLAIMER_LINK_ROW_NAMES;
}

/**
 * Pull the Terms & Conditions / Privacy Policy URLs out of the raw sheet
 * rows (before createField() mapping, so the URL's original casing is
 * preserved rather than being lowercased by inferInputType()).
 */
function extractDisclaimerLinks(rawData) {
  const links = {};
  (rawData || []).forEach((raw) => {
    const key = DISCLAIMER_LINK_ROW_NAMES[normalizeText(raw?.Name).toLowerCase()];
    if (key) links[key] = normalizeText(raw?.Type);
  });
  return links;
}

function renderBookFreeSiteVisitForm(form, fields, disclaimerLinks) {
  const questionOneField = resolveQuestionField(fields, ['bhps_question_1', 'renovating_home']);
  const questionTwoField = resolveQuestionField(fields, ['bhps_question_2', 'hired_painter']);
  const questionFields = [questionOneField, questionTwoField].filter(Boolean);
  let questionPanelRendered = false;
  const useBhpsForm = isBhpsForm();

  if (useBhpsForm && questionFields.length < 2) {
    const expectedNames = QUESTION_FIELD_NAMES.slice(0, 2).join(', ');
    const foundNames = fields.map((f) => f.name).join(', ');
    // eslint-disable-next-line no-console
    console.warn(
      `[lead-form] Expected 2 BHPS disclaimer-question fields (${expectedNames}), `
      + `found ${questionFields.length}. All field names: ${foundNames}`,
    );
  }

  fields.forEach((field) => {
    // Question panel (grouped) — when isBhpsForm is true this also covers
    // the WhatsApp toggle (bundled into the same BHPS markup), so the
    // whatsapp_consent field below is skipped.
    if (isQuestionFieldName(field.name)) {
      if (!questionPanelRendered) {
        if (useBhpsForm) {
          form.append(createBhpsQuestionsWrapper(questionOneField, questionTwoField));
        } else {
          const panel = document.createElement('div');
          panel.className = 'question-panel';
          questionFields.forEach((qf) => panel.append(createQuestionField(qf)));
          form.append(panel);
        }
        questionPanelRendered = true;
      }
      return;
    }

    // Mobile field with prefix
    if (field.name === 'mobile') {
      form.append(createMobileField(field));
      return;
    }

    // WhatsApp toggle — bundled into the BHPS questions wrapper above
    // when isBhpsForm is true.
    if (field.name === 'whatsapp_consent') {
      if (!useBhpsForm) form.append(createWhatsAppField(field));
      return;
    }

    // Disclaimer text
    if (field.type === 'plaintext') {
      form.append(createPlainTextField(field, disclaimerLinks));
      return;
    }

    // Submit button
    if (field.type === 'submit') {
      const submitEl = createSubmitButton(field);
      submitEl.querySelector('button')?.setAttribute('disabled', '');
      form.append(submitEl);
      return;
    }

    // Regular text fields
    form.append(createTextField(field));
  });

  wireValidation(form);
}

/* ========== Form Submission ========== */

function showMessage(form, type, message) {
  form.parentElement?.querySelectorAll('.form-message').forEach((el) => el.remove());

  const messageEl = document.createElement('div');
  messageEl.className = `form-message form-message-${type}`;
  messageEl.textContent = message;
  form.parentElement.insertBefore(messageEl, form);

  if (type === 'success') {
    setTimeout(() => messageEl.remove(), 5000);
  }
}

/**
 * Cleanup video element
 */
function cleanupVideo(video) {
  if (!video) return;
  video.pause();
  video.removeAttribute('src');
  video.load();
}

/**
 * Close active popup
 */
function closeActivePopup(form, overlay, video = null) {
  cleanupVideo(video);

  const dialog = overlay?.closest('dialog')
    || form?.closest('dialog')
    || overlay?.closest('[role="dialog"]')
    || form?.closest('[role="dialog"]');

  overlay?.remove();

  form.classList.remove('thank-you-active', 'error-active', 'popup-active');

  if (form.parentElement) {
    form.parentElement.classList.remove('form-popup-active');
  }

  delete form.dataset.thankYouShown;
  delete form.dataset.errorShown;

  // Close actual modal/dialog
  if (dialog) {
    dialog.close?.();
    dialog.removeAttribute('open');
  }

  document.body.classList.remove('eds-modal-open');
  window.activeModalElement = null;
}

/**
 * Create close button
 */
function createCloseButton(labelText) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'form-popup-close';
  button.setAttribute('aria-label', labelText);
  button.innerHTML = '&times;';
  return button;
}

/**
 * Track thank you popup CTA
 */
function trackInterestCTA(currentCampaignId, currentFormName) {
  trackEvent('Form_thank_you_pop_up', {
    cid: currentCampaignId,
    formName: currentFormName,
  });
  pushAdobeFormEvents({
    event: 'Form_thank_you_pop_up',
    formCampaignId: currentCampaignId,
    formName: currentFormName,
  });
}

/**
 * Track explore now CTA
 */
function trackExploreNowCTA(ctaLink) {
  if (!ctaLink) return;

  // eVar67 (parentTitle) must carry the real banner/form title, not a
  // fixed label. This popup lives inside the open modal, so read its
  // heading (e.g. "Let our experts help you!"). Fall back to the old
  // literal if no heading is found.
  const bannerTitle = document.querySelector('dialog[open] h1, dialog[open] h2, dialog[open] h3, dialog[open] h4')
    ?.textContent?.trim() || 'Form Thank you pop-up';

  trackEvent('cta_link_text', {
    cta_: 'Explore now',
    parentTitle: bannerTitle,
    param1: ctaLink,
    redirectionLink: ctaLink,
  });
  pushAdobeCtaClickEvent({
    cta: 'Explore now',
    parentTitle: bannerTitle,
    destinationUrl: ctaLink,
    event: 'cta_link_text',
  })
}

/**
 * Create thank you overlay
 */
function createThankYouScreen(form) {
  const overlay = document.createElement('div');
  overlay.className = 'form-popup-overlay form-popup-overlay--success';

  const isMobile = window.matchMedia('(max-width: 991px)').matches;
  const videoSrc = isMobile ? THANK_YOU_MOBILE_VIDEO : THANK_YOU_DESKTOP_VIDEO;

  const closeBtn = createCloseButton('Close thank you popup');

  const video = document.createElement('video');
  video.className = 'form-popup-success-video';
  video.setAttribute('playsinline', '');
  video.setAttribute('autoplay', '');
  video.setAttribute('muted', '');
  video.setAttribute('preload', 'auto');
  video.setAttribute('aria-label', 'thank-you');
  video.src = videoSrc;
  video.loop = false;

  const cta = document.createElement('a');
  cta.className = 'form-popup-success-cta';
  cta.href = THANK_YOU_CTA_LINK;
  cta.target = '_blank';
  cta.rel = 'noopener noreferrer';
  cta.setAttribute('aria-label', 'Explore now');
  cta.addEventListener('click', () => {
    trackExploreNowCTA(THANK_YOU_CTA_LINK);
  });

  const ins = document.createElement('a');
  ins.className = 'intereseted-cta';
  ins.href = 'javascript:void(0)';
  ins.setAttribute('aria-label', 'Yes I am Interseted');
  ins.addEventListener('click', () => {
    trackInterestCTA(getBhInterestFormCampaignId(form), form.dataset.formName || 'lead-form');
    submitLeadFromForm(form, {
      resourcePath: getFormNode(form),
      campaignId: getBhInterestFormCampaignId(form),
      selectors: getLeadInputSelectors(form),
    });
    const parent = ins.closest('.form-popup-overlay');
    if (!parent) return;

    const videoEl = parent.querySelector('video');
    const ctaEl = parent.querySelector('.form-popup-success-cta');
    const insEl = parent.querySelector('.intereseted-cta');

    if (videoEl) videoEl.style.display = 'none';
    if (ctaEl) ctaEl.style.display = 'none';
    if (insEl) insEl.style.display = 'none';

    const wrapper = document.createElement('div');
    wrapper.className = 'thank-you-pop-two';

    wrapper.innerHTML = `
      <img class="thank-img-desk" src="${THANK_YOU_TWO_DESKTOP}" alt="thank you" />
      <img class="thank-img-mob" src="${THANK_YOU_TWO_MOB}" alt="thank you" />
      <a class="explore-now-rewamp" href="${THANK_YOU_CTA_LINK}" target="_blank">
        Explore Now
      </a>
    `;

    const rewampCta = wrapper.querySelector('.explore-now-rewamp');
    rewampCta?.addEventListener('click', () => {
      trackExploreNowCTA(THANK_YOU_CTA_LINK);
    });

    parent.appendChild(wrapper);
  });

  video.addEventListener('ended', () => {
    video.pause();
  });

  closeBtn.addEventListener('click', () => {
    closeActivePopup(form, overlay, video);

  });

  overlay.append(closeBtn, video, cta, ins);

  return overlay;
}

/**
 * Create error overlay
 */
function createErrorScreen(form) {
  const overlay = document.createElement('div');
  overlay.className = 'form-popup-overlay form-popup-overlay--error';

  const closeBtn = createCloseButton('Close error popup');

  overlay.innerHTML = `
    <div class="form-error-popup">
      <div class="form-error-popup__left">
        <div class="form-error-popup__copy">
          <h2 class="form-error-popup__title">Try again!</h2>
          <p class="form-error-popup__text">
            Oops! Something went wrong. We couldn't process your request. Please try again?
          </p>
        </div>
      </div>

      <div class="form-error-popup__right">
        <div
          class="form-error-popup__media"
          style="
            --form-error-image-desktop: url('${ERROR_DESKTOP_IMAGE}');
            --form-error-image-mobile: url('${ERROR_MOBILE_IMAGE}');
          "
        >
          <div class="form-error-popup__content">
            <p class="form-error-popup__content-title">
              Are you looking for home interiors?
            </p>
            <p class="form-error-popup__content-subtitle">
              Get expert execution for your dream home from Beautiful Homes Interior Design service by asian paints.
            </p>
            <div class="form-error-popup__actions">
              <a
                href="${ERROR_CTA_LINK}"
                target="_self"
                class="form-error-popup__button trackCTA"
              >
                Get FREE Design Consultation
              </a>
            </div>
            <a
              class="form-error-popup__download"
              href="${ERROR_DOWNLOAD_LINK}"
              download
            >
              Download the asianpaints colour books
            </a>
          </div>
        </div>
      </div>
    </div>
  `;

  overlay.prepend(closeBtn);

  closeBtn.addEventListener('click', () => {
    closeActivePopup(form, overlay);
  });

  return overlay;
}

/**
 * Show thank you overlay
 */
/**
 * Show thank you overlay
 */
function showThankYouScreen(form) {
  if (!form || form.dataset.thankYouShown === 'true') return;

  const dialog = form.closest('[role="dialog"]') || form.closest('dialog');
  const existingOverlay = form.querySelector('.form-popup-overlay--success')
    || dialog?.querySelector('.modal-content .form-popup-overlay--success');
  if (existingOverlay) {
    form.dataset.thankYouShown = 'true';
    form.classList.add('thank-you-active', 'popup-active');
    return;
  }

  const overlay = createThankYouScreen(form);
  const container = dialog?.querySelector('.modal-content') || form;
  container.appendChild(overlay);
  form.dataset.thankYouShown = 'true';
  form.classList.add('thank-you-active', 'popup-active');

  // Hide close button and form container in modal
  if (dialog) {
    dialog.classList.add('modal-success-active');
    const closeBtn = dialog.querySelector('.close-button');
    if (closeBtn) closeBtn.style.display = 'none';

    const formContainer = dialog.querySelector('.section.lead-form-container');
    if (formContainer) formContainer.style.display = 'none';
  }
  if (form.parentElement) {
    form.parentElement.classList.add('form-popup-active');
  }
}

/**
 * Show error overlay
 */
function showErrorScreen(form) {
  if (!form || form.dataset.errorShown === 'true') return;

  const dialog = form.closest('[role="dialog"]') || form.closest('dialog');
  const existingOverlay = form.querySelector('.form-popup-overlay--error')
    || dialog?.querySelector('.modal-content .form-popup-overlay--error');
  if (existingOverlay) {
    form.dataset.errorShown = 'true';
    form.classList.add('error-active', 'popup-active');
    return;
  }

  const overlay = createErrorScreen(form);
  const container = dialog?.querySelector('.modal-content') || form;
  container.appendChild(overlay);
  form.dataset.errorShown = 'true';
  form.classList.add('error-active', 'popup-active');

  // Hide close button and form container in modal
  if (dialog) {
    dialog.classList.add('modal-error-active');
    const closeBtn = dialog.querySelector('.close-button');
    if (closeBtn) closeBtn.style.display = 'none';

    const formContainer = dialog.querySelector('.section.lead-form-container');
    if (formContainer) formContainer.style.display = 'none';
  }
  if (form.parentElement) {
    form.parentElement.classList.add('form-popup-active');
  }
}

function toAttrSelector(name = '') {
  const escaped = `${name}`.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `[name="${escaped}"]`;
}

function getLeadInputSelectors(form) {
  const controls = [...form.querySelectorAll('input, textarea')].filter((el) => el.name && !el.disabled);
  const selectorByMatcher = (matcher) => {
    const match = controls.find((control) => matcher(control));
    return match ? toAttrSelector(match.name) : undefined;
  };

  // Question 1/2 field names, whichever naming convention is actually
  // present (see QUESTION_FIELD_NAMES) — order-based since both questions
  // share a generic radio "type", not a distinguishable one.
  const [questionOneName, questionTwoName] = [...new Set(
    controls.filter((el) => isQuestionFieldName(el.name)).map((el) => el.name),
  )];

  const campaignId = form.getAttribute('data-campaign-id') || form.dataset.campaignId || 'SPS_ORGANIC';
  const node = form.getAttribute('data-node') || form.dataset.node || '';

  return {
    name: selectorByMatcher((el) => /name/i.test(el.name)),
    email: selectorByMatcher((el) => el.type === 'email' || /email/i.test(el.name)),
    mobile: selectorByMatcher((el) => el.type === 'tel' || /mobile|phone|contact/i.test(el.name)),
    pincode: selectorByMatcher((el) => /pin|zip|postal/i.test(el.name)),
    whatsappConsent: '.whatsAppConsentFormFld',
    constructionWorkGoingOn: questionOneName ? toAttrSelector(questionOneName) : undefined,
    localPainterHired: questionTwoName ? toAttrSelector(questionTwoName) : undefined,
    // BHPS markup uses radios instead of a single checkbox, so
    // buildLeadPayload needs the checked option's own value rather than a
    // boolean off the first matching element — see
    // constructionWorkGoingOnRadio/localPainterHiredRadio in
    // form-submit-common.js. undefined is a harmless no-op there.
    constructionWorkGoingOnRadio: questionOneName ? `${toAttrSelector(questionOneName)}:checked` : undefined,
    localPainterHiredRadio: questionTwoName ? `${toAttrSelector(questionTwoName)}:checked` : undefined,
    campaignId,
    node,
  };
}

function getCampaignId(form = null) {
  // Prioritize utm_campaign from URL over form attributes
  const urlCampaignId = getCampaignIdFromUrl();
  if (urlCampaignId) return urlCampaignId;
  
  return form?.getAttribute('data-campaign-id')
    || form?.dataset?.campaignId
    || '';
}

function getFormCampaignId(form) {
  return getCampaignId(form);
}

function getBhInterestFormCampaignId(form) {
  return form?.getAttribute('data-attr-bhsInterestedCampaignId')?.trim()
    || 'DECOR_ORGANIC_AP.com';
}

function getFormNode(form) {
  return form.getAttribute('data-node') || form.dataset.node || form.dataset.action || window.location.pathname || '';
}

function getRadioOrCheckboxValue(form, name) {
  const checked = form.querySelector(`input[name="${name}"]:checked`);
  if (checked) {
    // Use the checked radio's original authored label (aria-label on its
    // custom-element span), not its `value` attribute — getBhpsOptionValue()
    // collapses "Immediate"/"Within a month" into one merged backend value
    // ("Immediate/Within 1 Month"), which would otherwise hide the actual
    // selection from analytics (eVar73).
    const labelSpan = checked.closest('.disclaimer-radio-label')
      ?.querySelector('.form-radio-input__custom-element');
    return labelSpan?.getAttribute('aria-label') || checked.value;
  }

  const toggle = form.querySelector(`input[name="${name}"]`);
  if (!toggle) return '';
  return toggle.checked ? 'Yes' : 'No';
}

/**
 * Question 1/2's actual field name in this form — bhps_question_1/
 * bhps_question_2 (current DA shape) or renovating_home/hired_painter
 * (older shape), whichever is actually present, in document order.
 */
function getBhpsQuestionFieldName(form, index) {
  const names = [...new Set(
    [...form.querySelectorAll('input[type="radio"]')]
      .map((el) => el.name)
      .filter((name) => isQuestionFieldName(name)),
  )];
  return names[index];
}

function normalizeYesNo(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return '';
  if (['yes', 'y', 'true', '1'].includes(normalized)) return 'Yes';
  if (['no', 'n', 'false', '0'].includes(normalized)) return 'No';
  return value;
}

function trackLeadFormStart(form) {
  if (form.dataset.formStarted === 'true') return;

  form.dataset.formStarted = 'true';
  const formName = document.querySelector('h2#let-our-experts-help-you')?.textContent?.trim() || form.dataset.formName || 'lead-form';
  const campaignId = getCampaignId(form);
  trackEvent('Form start', { formName, campaignId });
  pushAdobeFormEvents({
    event: 'form_start',
    formName : formName,
    formCampaignId: campaignId,
  });
  // Mirror to marketing pixels (FB, GA4, Google Ads) via image beacons.
  // No SDK library load required — the beacon URL carries the event.
  firePixelConversion('form_start', { event_category: formName, campaign: campaignId });
}

function trackLeadFormSubmission(form) {
  const isWhatsappChecked = form.querySelector('.whatsAppConsentFormFld')?.classList.contains('whatsAppCheckbox-checked');
  // Send explicit 'unchecked' (not undefined) so eVar108 always reflects the
  // real opt-in state instead of being dropped by trackEvent's undefined-filter.
  const whatsappConsent = isWhatsappChecked ? 'checked' : 'unchecked';

  const formData = {
    formName: form.dataset.formName || 'lead-form',
    campaignId: getCampaignId(form),
    whatsappOptIn: whatsappConsent,
    contruction: normalizeYesNo(getRadioOrCheckboxValue(form, getBhpsQuestionFieldName(form, 0) || 'renovating_home')),
    localpainter: normalizeYesNo(getRadioOrCheckboxValue(form, getBhpsQuestionFieldName(form, 1) || 'hired_painter')),
    // Spec field — default to 'both' per the EDS data layer doc
    // (forms write to AMS + Salesforce). Form authoring can override
    // by setting <form data-data-destination="<value>">.
    dataDestination: form.dataset.dataDestination || 'both',
  };

  getDigitalData().form = formData;
  trackEvent('Form Submit', {
    formName: form.dataset.formName || 'lead-form',
    campaignId: getCampaignId(form),
    ...formData,
  });

  pushAdobeFormEvents({
    event: 'form_submit',
    formName: form.dataset.formName || 'lead-form',
    formCampaignId: getCampaignId(form),
    whatsappOptIn: whatsappConsent,
    contruction: formData.contruction,
    localpainter: formData.localpainter,
    dataDestination: formData.dataDestination,
  });

  // GA4 tracking only for book-free-site-visit form
  if (form.dataset.formName === BOOK_FREE_SITE_VISIT_FORM) {
    ga4Implementaion({
      event: 'confirm_free_site_visit',
      click_text: 'Book free site visit',
      click_category: 'click_header'
    });
  }

  // Mirror to marketing pixels (FB Pixel as 'Lead', GA4 as 'form_submit',
  // Google Ads as 'form_submit' conversion). Image beacons — no SDK load.
  firePixelConversion('form_submit', {
    event_category: formData.formName,
    value: 1,
    currency: 'INR',
  });
}

function bindDisclaimerLinkTracking(form) {
  form?.querySelectorAll('.disclaimer-field .disclaimer-link').forEach((link) => {
    link.target = '_blank';
    link.rel = 'noopener noreferrer';

    const open = (event) => {
      if (!link.href) return;
      event.preventDefault();
      window.open(link.href, '_blank', 'noopener,noreferrer');

      const dialogTitle = form.closest('dialog, [role="dialog"]')
        ?.querySelector('h1, h2, h3, h4, h5, h6')
        ?.textContent?.trim();
      const parentTitle = dialogTitle || form.dataset.formName || 'lead-form';

      trackEvent('cta_link_text', {
        cta_: link.textContent?.trim(),
        parentTitle,
        param1: link.href,
      });

      pushAdobeCtaClickEvent({
        event: "cta_link_text",
        cta: link.textContent?.trim(),
        parentTitle,
        destinationUrl : link.href

      })


    };

    link.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      link.dataset.opened = 'true';
      setTimeout(() => { delete link.dataset.opened; }, 300);
      open(event);
    });

    link.addEventListener('click', (event) => {
      if (link.dataset.opened === 'true') {
        event.preventDefault();
        return;
      }
      open(event);
    });
  });
}

/* ========== Field Validation ========== */

/**
 * Create error message element
 */
function createErrorMessageElement() {
  const error = document.createElement('div');
  error.className = 'field-error';
  error.setAttribute('aria-live', 'polite');
  return error;
}

/**
 * Show field error
 */
function showFieldError(fieldWrapper, input, message) {
  if (!fieldWrapper || !input) return;

  let errorEl = fieldWrapper.querySelector('.field-error');
  if (!errorEl) {
    errorEl = createErrorMessageElement();
    fieldWrapper.appendChild(errorEl);
  }

  errorEl.textContent = message;
  fieldWrapper.classList.add('has-error');
  input.classList.add('is-invalid');
  input.setAttribute('aria-invalid', 'true');
}

/**
 * Clear field error
 */
function clearFieldError(fieldWrapper, input) {
  if (!fieldWrapper || !input) return;

  const errorEl = fieldWrapper.querySelector('.field-error');
  if (errorEl) {
    errorEl.textContent = '';
  }

  fieldWrapper.classList.remove('has-error');
  input.classList.remove('is-invalid');
  input.removeAttribute('aria-invalid');
}

/**
 * Get custom validation message for input
 */
function getValidationMessage(input) {
  if (!input) return '';

  const value = input.value.trim();
  const fieldName = `${input.name || ''} ${input.id || ''}`.toLowerCase();

  const isEmail = fieldName.includes('email');
  const isPincode = fieldName.includes('pincode') || fieldName.includes('pin') || fieldName.includes('zip');
  const isMobile = fieldName.includes('mobile') || fieldName.includes('phone');

  if (!value) {
    return 'Field is required';
  }

  if (isEmail) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return 'Email is invalid';
    }
  }

  if (isPincode) {
    if (!/^\d{6}$/.test(value)) {
      return 'Enter a valid 6 digit Zip Code';
    }
  }

  if (isMobile) {
    if (!/^\d{10}$/.test(value)) {
      return 'Phone number is invalid';
    }
  }

  return '';
}

/**
 * Validate single input field and optionally show error
 */
function validateInputField(input, showError = true) {
  if (!input) return true;

  const fieldWrapper = input.closest('.field-wrapper');
  if (!fieldWrapper) return true;

  const message = getValidationMessage(input);

  if (message) {
    input.setCustomValidity(message);

    if (showError) {
      showFieldError(fieldWrapper, input, message);
    }

    return false;
  }

  // Clear custom validity when field is valid
  input.setCustomValidity('');
  clearFieldError(fieldWrapper, input);
  return true;
}

async function handleSubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const submitBtn = form.querySelector('button[type="submit"]');

  // Validate all required fields and show errors
  const requiredFields = getRequiredFields(form);
  let isValid = true;
  const failedFields = [];

  requiredFields.forEach((input) => {
    if (!validateInputField(input, true)) {
      isValid = false;
      // Field-name fallback chain to produce a meaningful pipe-joined
      // error string (e.g., "Email|MobileNumber|PINCode") per spec.
      failedFields.push(input.name || input.id || input.getAttribute('aria-label') || 'unknown');
    }
  });

  if (!isValid) {
    trackFormError({
      campaignId: getCampaignId(form),
      formName: form.dataset.formName || 'lead-form',
      formError: failedFields,
    });
    return;
  }
  if (form.dataset.submitting === 'true') return;

  form.dataset.submitting = 'true';
  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting...';

  try {
    await submitLeadFromForm(form, {
      resourcePath: getFormNode(form),
      campaignId: getFormCampaignId(form),
      selectors: getLeadInputSelectors(form),
    });

    trackLeadFormSubmission(form);

    // Use overlay screens for book-free-site-visit form, simple message for others
    if (form.dataset.formName === BOOK_FREE_SITE_VISIT_FORM) {
      showThankYouScreen(form);
    } else {
      showMessage(form, 'success', DEFAULT_SUCCESS_MESSAGE);
      form.reset();
      form.querySelectorAll('.whatsapp-field').forEach(syncWhatsAppToggle);
      updateSubmitState(form);
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Form submission error:', error);

    // Use overlay screens for book-free-site-visit form, simple message for others
    if (form.dataset.formName === BOOK_FREE_SITE_VISIT_FORM) {
      showErrorScreen(form);
    } else {
      showMessage(form, 'error', DEFAULT_ERROR_MESSAGE);
    }
  } finally {
    form.dataset.submitting = 'false';
    submitBtn.disabled = false;
    submitBtn.textContent = submitBtn.dataset.originalText;
  }
}

/* ========== Form Definition Loading ========== */

async function fetchFormDefinition(pathname) {
  let path = pathname;
  if (!path.endsWith('.json')) {
    path = `${path.replace(/\.html$/, '')}.json`;
  }

  // 'no-cache' (not 'no-store') — always revalidates with the server so a
  // published content change is picked up immediately, while still letting
  // the browser skip re-downloading the body on a 304. A plain fetch() here
  // let stale, pre-publish copies of this form's field definitions linger
  // in the browser cache after DA content changes.
  const response = await fetch(path, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Unable to fetch form: ${path}`);

  return response.json();
}

function parseHTMLStructure(block) {
  // Parse simple HTML table structure: Col1 = labels, Col2 = placeholders
  const rows = block.children;
  if (rows.length < 2) return null;

  const col1 = rows[0];
  const col2 = rows[1];
  const labelCells = [...col1.children];
  const placeholderCells = [...col2.children];

  const data = [];
  let headerFound = false;

  labelCells.forEach((cell, index) => {
    const text = cell.textContent.trim();
    const placeholder = placeholderCells[index]?.textContent.trim() || '';
    const link = cell.querySelector('a');
    const strong = cell.querySelector('strong');

    // Submit button (link)
    if (link) {
      data.push({ Name: 'submit', Type: 'submit', Label: link.textContent.trim() });
      return;
    }

    // Header (first long text)
    if (!headerFound && text.length > 30) {
      headerFound = true;
      return; // Skip header, handled separately
    }

    // Field label
    if (strong) {
      const label = strong.textContent.trim();
      if (!label) return;

      let type = 'text';
      const lowerLabel = label.toLowerCase();
      if (lowerLabel.includes('email')) type = 'email';
      if (lowerLabel.includes('phone') || lowerLabel.includes('mobile')) type = 'tel';

      data.push({
        Name: slugify(label),
        Type: type,
        Label: label,
        Placeholder: placeholder,
        Mandatory: 'true',
      });
    }
  });

  return data.length > 0 ? { name: 'simple-form', data } : null;
}

/* ========== Main Decorator ========== */

export default async function decorate(block) {
  let formDefinition = null;
  let actionPath = '';

  // Try to find a link to JSON form definition
  const link = block.querySelector('a[href$=".json"], a[href$=".html"]');

  if (link) {
    try {
      const { pathname } = new URL(link.href, window.location.href);
      actionPath = pathname.replace(/\.json$/, '').replace(/\.html$/, '');
      formDefinition = await fetchFormDefinition(pathname);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('Lead form: Could not load form definition', error);
    }
  }

  // Fallback to HTML structure parsing
  if (!formDefinition) {
    const htmlData = parseHTMLStructure(block);
    if (htmlData) {
      formDefinition = htmlData;
    }
  }

  if (!formDefinition || !formDefinition.data?.length) {
    // eslint-disable-next-line no-console
    console.warn('Lead form: No valid form definition found');
    return;
  }

  // Build form. The Terms & Conditions / Privacy Policy link rows are
  // metadata for the disclaimer text, not real fields — extract their
  // URLs, then exclude them before mapping the rest to fields.
  const disclaimerLinks = extractDisclaimerLinks(formDefinition.data);
  const fields = formDefinition.data
    .filter((raw) => !isDisclaimerLinkRowName(raw?.Name))
    .map((raw, i) => createField(raw, i));
  // Derive form name from definition or URL path
  // (AEM sheets don't include custom top-level props)
  const formName = normalizeText(formDefinition.name)
    || actionPath.split('/').pop().replace(/\.json$|\.html$/, '');

  const form = document.createElement('form');
  form.className = 'lead-form-fields';
  form.method = 'post';
  form.noValidate = true;
  form.dataset.action = actionPath;
  form.dataset.formName = formName;
  form.dataset.node = actionPath;
  form.dataset.campaignId = "SPS_ORGANIC";

  if (formName === BOOK_FREE_SITE_VISIT_FORM) {
    renderBookFreeSiteVisitForm(form, fields, disclaimerLinks);
  } else {
    // Generic form rendering
    fields.forEach((field) => {
      if (field.type === 'submit') {
        form.append(createSubmitButton(field));
      } else if (field.type === 'plaintext') {
        form.append(createPlainTextField(field, disclaimerLinks));
      } else {
        form.append(createTextField(field));
      }
    });

    wireValidation(form);
  }

  form.addEventListener('focusin', (e) => {
    if (e.target.matches('input, textarea, select')) {
      trackLeadFormStart(form);
    }
  });

  bindDisclaimerLinkTracking(form);

  form.addEventListener('submit', handleSubmit);

  // Replace block content
  block.textContent = '';
  block.append(form);
}
