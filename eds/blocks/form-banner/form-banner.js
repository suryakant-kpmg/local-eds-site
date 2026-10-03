/*
** Authoring format **

Row 1 (Slides)
Each column → one carousel slide: desktop banner image, then mobile banner image
  (two pictures in the same cell). Columns without an image are skipped.
  More than one slide → Swiper carousel with dot pagination; the form stays put.

Row 2 (Form Labels)
Col 1 → Name label
Col 2 → Email label
Col 3 → Mobile number label
Col 4 → Pincode label
Col 5 → Submit button label

Settings rows (label | value, anywhere after Row 1)
"Form title" → form-banner__card-title text (e.g. Let our experts help you!)
"autoplay"   → true/false — auto-rotate the slides
"interval"   → milliseconds between slides when autoplay is on (default 5000)
"Update me on WhatsApp" → display/hide — show the WhatsApp opt-in (default display;
                 when hidden, the lead is submitted without WhatsApp consent)
"Is it a BHPS form"     → true/false — true shows the opt-in as a checkbox
                 ("Get updates on WhatsApp") plus the BHPS questions below;
                 false keeps the toggle and no questions (default false)
"BHPS question 1" | question text | bullet list of options (radio buttons)
"BHPS question 2" | question text | bullet list of options (radio buttons)
                 Shown only on BHPS forms; each question shown is required.
  Removed before the rows below are read, so their numbering is unchanged.

Row 3 (Input Placeholders)
Col 1 → Name placeholder
Col 2 → Email placeholder
Col 3 → Mobile number placeholder
Col 4 → Pincode placeholder

Row 4 (Consent Note)
Col 1 → form-consent-note rich text — authored markup (incl. <a> links)
  is kept as-is; see extractConsentNoteHtml(). Links get styled/hardened
  by applyConsentLinkAttributes() (blue, opens in a new tab). No note is
  rendered at all when this row/cell is empty (no hardcoded fallback).

Popup rows (label | value, read by label like the settings rows)
"Default success image"       | desktop image | mobile image
"Default error image"         | desktop image | mobile image
"Default SUCCESS_CTA_LINK"    | URL
"Default ERROR_CTA_LINK"      | URL
"Default ERROR_DOWNLOAD_LINK" | URL
"BHPS THANK_YOU_DESKTOP_VIDEO" | URL — BHPS success popup video (desktop)
"BHPS THANK_YOU_MOBILE_VIDEO"  | URL — BHPS success popup video (up to 991px)
"BHPS THANK_YOU_CTA_LINK"      | URL — "Book FREE site visit" hotspot over the video
  BHPS forms always show this video popup on success; non-BHPS forms show the
  default thank-you popup (Default success image). Same flow and styling as the
  form block's thank-you screen.

----------------------------------------

Field Behavior Notes:

Mobile Number Field:
- +91 prefix is added automatically via JS (not authored)
- User should enter only 10 digits
- Input is restricted to numeric values
- Validation: must be exactly 10 digits

----------------------------------------

Form Behavior:

- Submit triggers lead API via submitLeadFromForm
- Success → Thank you popup shown
- Error → Error popup shown

----------------------------------------

Variants:

- Same authoring works for both desktop & mobile
- Responsive image handled via <picture> element

----------------------------------------

Important:

- Do NOT include +91 in authoring
- Do NOT include validation messages in authoring
*/

import { submitLeadFromForm, checkCookieValues, setFormFieldsToCookie } from '../../scripts/form-submit-common.js';
import {
  getDigitalData, trackEvent, trackFormError, triggerCTAClickWithLinkAndTitle, pushAdobeCtaClickEvent , pushAdobeFormEvents
} from '../../scripts/analytics_1.js';

let formName = '';
let campaignId = '';
let formNodePath = '';
let formStarted = false;

function getRowValue(row) {
  if (!row) return '';

  const cells = [...row.children];
  const preferred = cells[1]?.textContent?.trim();
  if (preferred) return preferred;

  return cells.map((cell) => cell.textContent?.trim()).filter(Boolean).join(' ').trim();
}

function extractFormConfig(block) {
  const section = block.closest('.section');
  const formConfigBlock = section?.querySelector('.form-config, .form-configs');

  let configuredCampaignId = '';
  let configuredNodePath = '';

  if (formConfigBlock) {
    const configRows = [...formConfigBlock.children];
    configuredCampaignId = getRowValue(configRows[0]);
    configuredNodePath = getRowValue(configRows[1]);

    const formConfigWrapper = formConfigBlock.closest('.form-config-wrapper, .form-configs-wrapper');
    const formConfigSection = formConfigBlock.closest('.section');

    formConfigBlock.style.display = 'none';
    if (formConfigWrapper) {
      formConfigWrapper.style.display = 'none';
    }
    if (
      formConfigSection
      && formConfigSection !== section
      && !formConfigSection.querySelector('.form, .form-banner')
    ) {
      formConfigSection.style.display = 'none';
    }
  }

  configuredCampaignId = configuredCampaignId
    || block.getAttribute('data-campaign-id')?.trim()
    || '';

  configuredNodePath = configuredNodePath
    || block.getAttribute('data-node')?.trim()
    || window.location.pathname
    || '';

  // Prioritize utm_campaign from URL over configured campaign ID
  const urlParams = new URLSearchParams(window.location.search);
  const utmCampaign = urlParams.get('utm_campaign');
  
  campaignId = utmCampaign || configuredCampaignId;
  formNodePath = configuredNodePath;
}

let SUCCESS_DESKTOP_IMAGE = '';
let SUCCESS_MOBILE_IMAGE = '';
let ERROR_DESKTOP_IMAGE = '';
let ERROR_MOBILE_IMAGE = '';

/**
 * Row 4, col 1 → form-consent-note rich text — authored markup (incl. <a>
 * links) is kept as-is, the same trusted-DA-content pattern used
 * elsewhere for authored cells. '' when the row/cell is empty — no note
 * is rendered at all in that case (no hardcoded fallback copy).
 */
function extractConsentNoteHtml(row) {
  if (!row) return '';

  const cell = row.children[0];
  const html = cell?.innerHTML?.trim();
  return html || '';
}

/**
 * Harden/style any links inside the authored consent note: open in a new
 * tab safely, and mark them for the blue/pointer styling in CSS.
 *
 * Opens explicitly via window.open() on pointerdown rather than relying
 * solely on a click + target="_blank" — mirrors form.js's
 * applyConsentLinkAttributes() fix for the same bug there: a click can
 * miss if a layout shift (blur validation error line, GTM injection,
 * etc.) moves the link out from under the pointer between press and
 * release. pointerdown fires before that shift; click is kept only as a
 * keyboard (Enter) fallback, guarded so it doesn't double-open.
 */
function applyConsentLinkAttributes(container) {
  container?.querySelectorAll('a').forEach((link) => {
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.classList.add('form-consent-note-link');

    const open = (e) => {
      if (!link.href) return;
      e.preventDefault();
      window.open(link.href, '_blank', 'noopener,noreferrer');
      const formCard = link.closest('.form-banner__card');
      const parentTitle = formCard?.querySelector('.form-banner__card-title')?.textContent?.trim() || '';

      trackEvent('cta_link_text', {
        cta_: link.textContent?.trim(),
        parentTitle,
        param1: link.href,
      });

        pushAdobeCtaClickEvent ({
        event : 'cta_link_text',
        parentTitle,
        destinationUrl : link ? link.href : '',
        cta: link.textContent?.trim()
      })
    };

    link.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      link.dataset.opened = 'true';
      setTimeout(() => { delete link.dataset.opened; }, 300);
      open(e);
    });

    link.addEventListener('click', (e) => {
      if (link.dataset.opened === 'true') { e.preventDefault(); return; }
      open(e);
    });
  });
}

let SUCCESS_CTA_LINK = '';
// BHPS success popup: thank-you video + "Book FREE site visit" hotspot
let BHPS_THANK_YOU_DESKTOP_VIDEO = '';
let BHPS_THANK_YOU_MOBILE_VIDEO = '';
let BHPS_THANK_YOU_CTA_LINK = '';
let ERROR_CTA_LINK = '';
let ERROR_DOWNLOAD_LINK = '';
// Popup content title (rendered as a <p>, not a heading) — used as
// parentTitle (eVar67) for the popup's CTA click. Must NOT be resolved via
// block.querySelector('h1..h6'): the original form heading (e.g. "Let our
// experts help you!") stays in the DOM (just visually hidden) after the
// popup is shown, so that query was wrongly matching the form's own title
// instead of this popup's banner text.
const POPUP_BANNER_TITLE = 'Are you looking for home painting services?';

function getPicturesFromCell(cell) {
  if (!cell) return [];
  return [...cell.querySelectorAll('picture')];
}

function cloneSourcesToPicture(targetPicture, sourcePicture, mediaQuery) {
  if (!sourcePicture) return;

  [...sourcePicture.querySelectorAll('source')].forEach((sourceEl) => {
    const source = document.createElement('source');

    if (sourceEl.type) source.type = sourceEl.type;
    if (sourceEl.srcset) source.srcset = sourceEl.srcset;

    if (mediaQuery) {
      source.media = mediaQuery;
    } else if (sourceEl.media) {
      source.media = sourceEl.media;
    }

    targetPicture.appendChild(source);
  });
}

function createResponsivePicture(desktopPicture, mobilePicture, altText = '', eager = true) {
  const desktopImg = desktopPicture?.querySelector('img');
  const mobileImg = mobilePicture?.querySelector('img');

  if (!desktopImg && !mobileImg) return null;

  const picture = document.createElement('picture');
  picture.className = 'form-banner__picture';

  cloneSourcesToPicture(picture, mobilePicture, '(max-width: 767px)');
  cloneSourcesToPicture(picture, desktopPicture, '(min-width: 768px)');

  const img = document.createElement('img');
  img.src = mobileImg?.src || desktopImg?.src || '';
  img.alt = mobileImg?.alt || desktopImg?.alt || altText;
  img.loading = eager ? 'eager' : 'lazy';
  img.decoding = 'async';
  if (eager) img.setAttribute('fetchpriority', 'high');

  if (desktopImg?.width) img.width = desktopImg.width;
  if (desktopImg?.height) img.height = desktopImg.height;

  picture.appendChild(img);
  return picture;
}

/**
 * Create inline error message element
 */
function createErrorMessageElement() {
  const error = document.createElement('div');
  error.className = 'form-field-error';
  error.setAttribute('aria-live', 'polite');
  return error;
}

/**
 * Show field error
 */
function showFieldError(field, input, message) {
  if (!field || !input) return;

  let errorEl = field.querySelector('.form-field-error');
  if (!errorEl) {
    errorEl = createErrorMessageElement();
    field.appendChild(errorEl);
  }

  errorEl.textContent = message;
  field.classList.add('has-error');
  input.classList.add('is-invalid');
  input.setAttribute('aria-invalid', 'true');
}

/**
 * Clear field error
 */
function clearFieldError(field, input) {
  if (!field || !input) return;

  const errorEl = field.querySelector('.form-field-error');
  if (errorEl) {
    errorEl.textContent = '';
  }

  field.classList.remove('has-error');
  input.classList.remove('is-invalid');
  input.removeAttribute('aria-invalid');
  input.setCustomValidity('');
}

/**
 * Restrict numeric-only inputs
 */
function bindNumericInputFilter(input) {
  if (!input) return;

  input.addEventListener('input', () => {
    const numericValue = input.value.replace(/\D/g, '');

    if (input.value !== numericValue) {
      input.value = numericValue;
    }
  });
}

// Lead API field names for the two BHPS questions (read by form-submit-common.js)
const BHPS_FIELD_NAMES = [
  'NEW_CUSTOM_CHECKBOX_customer_response_one',
  'NEW_CUSTOM_CHECKBOX_customer_response_two',
];

/**
 * Analytics answer for a BHPS question: the authored label of the checked option.
 * @param {Element} form The form
 * @param {number} index The question index (0 or 1)
 * @returns {string|undefined} undefined when the question is not on the form
 */
function getBhpsAnswer(form, index) {
  const name = BHPS_FIELD_NAMES[index];
  if (!form.querySelector(`[name="${name}"]`)) return undefined;
  const checked = form.querySelector(`[name="${name}"]:checked`);
  return checked?.dataset.label || checked?.value || '';
}

function yesNo(checked) {
  return checked ? 'Yes' : 'No';
}

function trackFormSubmission(form) {
  const isWhatsappChecked = form.querySelector('[name="updateMeOnWhatsapp"]')?.checked;

  // Only include contruction/localpainter when the corresponding
  // question actually exists on this form. Previously `?.checked ? 'Yes'
  // : 'No'` collapsed a missing field (undefined) to 'No', leaking a
  // phantom eVar73="No"/eVar110="No" on forms (like this inline banner)
  // that have no renovating/painter questions. undefined values are
  // skipped by trackEvent, so absent questions send nothing.
  const constructionField = form.querySelector('[name="constructionWorkGoingOn"]');
  const localPainterField = form.querySelector('[name="localPainterHired"]');

  // BHPS forms answer these as radio questions instead
  const contruction = constructionField
    ? yesNo(constructionField.checked) : getBhpsAnswer(form, 0);
  const localpainter = localPainterField
    ? yesNo(localPainterField.checked) : getBhpsAnswer(form, 1);

  const formData = {
    formName,
    campaignId,
    // Send explicit 'unchecked' (not undefined) so eVar108 always reflects the
    // real opt-in state on the beacon instead of being dropped by trackEvent's
    // undefined-filter. QA relies on the presence of the value for reporting.
    whatsappOptIn: isWhatsappChecked ? 'checked' : 'unchecked',
    dataDestination: form.dataset.dataDestination || 'both',
    contruction,
    localpainter,
  };

  getDigitalData().form = formData;
  trackEvent('Form Submit', {
    formName: form.dataset.formName || 'form-banner',
    campaignId: 'TCS_AP.com',
    ...formData,
  });
  pushAdobeFormEvents({
    formCampaignId: campaignId,
    formName: formName,
    event : 'form_submit',
    whatsappOptIn: isWhatsappChecked ? 'checked' : 'unchecked',
    contruction,
    localpainter,
    dataDestination: form.dataset?.dataDestination || 'both'
  });


}

/**
 * Get custom validation message for input
 */
function getValidationMessage(input) {
  if (!input) return '';

  const value = input.value.trim();
  const fieldName = `${input.name || ''} ${input.id || ''}`.toLowerCase();

  const isEmail = fieldName.includes('email');
  const isPincode = fieldName.includes('pincode') || fieldName.includes('pin');
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
 * Validate single input
 */
function validateInputField(input, showError = true) {
  if (!input) return true;

  const field = input.closest('.form-field');
  const message = getValidationMessage(input);

  if (message) {
    input.setCustomValidity(message);

    if (showError) {
      showFieldError(field, input, message);
    }

    return false;
  }

  clearFieldError(field, input);
  return true;
}

/**
 * Add a fixed +91 prefix inside the mobile number input.
 * The prefix is purely visual; the submitted input value remains only the 10-digit number.
 */
function applyPhonePrefix(field, input) {
  if (!field || !input || field.querySelector('.form-input-prefix-wrap')) return;

  const inputWrap = document.createElement('div');
  inputWrap.className = 'form-input-prefix-wrap';

  const prefix = document.createElement('span');
  prefix.className = 'form-input-prefix';
  prefix.setAttribute('aria-hidden', 'true');
  prefix.textContent = '+91';

  field.insertBefore(inputWrap, input);
  inputWrap.appendChild(prefix);
  inputWrap.appendChild(input);
}

function createDefaultField(cell, rowIdx, cellIdx, labelText, placeholderText) {
  const field = document.createElement('div');
  field.className = 'form-field position-relative w-100';

  let inputId = `form-banner-input-${rowIdx}-${cellIdx}`;
  let inputName = labelText || placeholderText;

  // Map common labels to specific ids and names
  const lowerLabel = (labelText || '').toLowerCase();
  const isPincode = lowerLabel.includes('pincode') || lowerLabel.includes('pin');
  if (lowerLabel.includes('name')) {
    inputId = 'enquire-name';
    inputName = 'ENQUIRE_NAME';
  } else if (lowerLabel.includes('email')) {
    inputId = 'enquire-email';
    inputName = 'ENQUIRE_EMAIL';
  } else if (lowerLabel.includes('mobile') || lowerLabel.includes('phone')) {
    inputId = 'enquire-mobile';
    inputName = 'ENQUIRE_MOBILE';
  } else if (lowerLabel.includes('pincode') || lowerLabel.includes('pin')) {
    inputId = 'enquire-pincode';
    inputName = 'ENQUIRE_PINCODE';
  }

  const label = document.createElement('label');
  label.className = 'form-field-label';
  label.setAttribute('for', inputId);
  const displayLabel =
    lowerLabel.includes('phone') || lowerLabel.includes('mobile')
      ? 'Mobile Number'
      : lowerLabel.includes('pincode') || lowerLabel.includes('pin')
        ? 'PIN Code'
        : (labelText || placeholderText);

  label.innerHTML = `${displayLabel}`;


  const input = document.createElement('input');
  let inputType = 'text';

  if (labelText) {
    const lowerLabel = labelText.toLowerCase();
    if (lowerLabel.includes('phone') || lowerLabel.includes('mobile')) {
      inputType = 'tel';
      input.inputMode = 'numeric';
      input.pattern = '[0-9]{10}';
      input.maxLength = 10;
      bindNumericInputFilter(input);
      input.classList.add('form-input--with-prefix');
    } else if (lowerLabel.includes('email')) {
      inputType = 'email';
    } else if (lowerLabel.includes('pincode') || lowerLabel.includes('pin')) {
      inputType = 'text';
      input.inputMode = 'numeric';
      input.pattern = '[0-9]{6}';
      input.maxLength = 6;
      bindNumericInputFilter(input);
    } else if (lowerLabel.includes('name')) {
      inputType = 'text';
      input.pattern = '[A-Za-z ]{2,}';
    }
  }

  input.type = inputType;
  input.id = inputId;
  input.name = inputName;
  input.placeholder = placeholderText;
  input.className = 'form-input form-control';
  input.required = true;
  input.noValidate = true;

  const errorEl = createErrorMessageElement();


const updateFieldState = () => {
  const isFocused = document.activeElement === input;
  const hasValue = !!input.value.trim();

  field.classList.toggle('is-focused', isFocused);
  field.classList.toggle('has-value', hasValue);

  if (hasValue) {
    field.classList.add('show-label');
  }
};

input.addEventListener('focus', () => {
  field.classList.add('show-label');
});

   input.addEventListener('focus', () => {
    field.classList.add('show-label');
    updateFieldState();
  });

  input.addEventListener('blur', () => {
    // updateFieldState();
    validateInputField(input, true);
  });

  input.addEventListener('input', () => {
    updateFieldState();

    if (field.classList.contains('has-error')) {
      validateInputField(input, true);
    }
  });

  field.append(label, input, errorEl);

  // Apply phone prefix if mobile
  if (lowerLabel.includes('phone') || lowerLabel.includes('mobile')) {
    applyPhonePrefix(field, input);
  }

  cell.textContent = '';
  cell.appendChild(field);
}

/**
 * Reads a BHPS question row: label | question text | bullet list of options.
 * @param {Element} [row] The authored row
 * @returns {{question: string, options: string[]}|null} null when incomplete
 */
function getBhpsQuestion(row) {
  if (!row) return null;
  const cells = [...row.children];
  const question = cells[1]?.textContent?.trim() || '';
  const options = [...(cells[2]?.querySelectorAll('li') || [])]
    .map((li) => li.textContent.trim())
    .filter(Boolean);
  return question && options.length ? { question, options } : null;
}

/**
 * The backend expects "Immediate" and "Within a month" as one merged value for
 * question 1 (same mapping as the form block); the authored label is kept for analytics.
 * @param {string} label The authored option label
 * @param {number} index The question index (0 or 1)
 * @returns {string} The value to submit
 */
function bhpsOptionValue(label, index) {
  const normalized = label.trim().toLowerCase();
  if (index === 0 && (normalized === 'immediate' || normalized === 'within a month')) {
    return 'Immediate/Within 1 Month';
  }
  return label;
}

function clearBhpsGroupError(group) {
  group.classList.remove('has-error');
  group.querySelector('.form-field-error')?.remove();
}

/**
 * Builds the BHPS questions as required radio groups.
 * @param {Array<object|null>} questions Configs from getBhpsQuestion
 * @returns {HTMLDivElement|null} The questions, or null when none are authored
 */
function buildBhpsQuestions(questions) {
  const groups = questions.map((config, index) => {
    if (!config) return null;
    const group = document.createElement('div');
    group.className = 'disclaimer-group';
    const fieldset = document.createElement('fieldset');
    const legend = document.createElement('legend');
    legend.append(config.question, ' ');
    const required = document.createElement('span');
    required.className = 'form-global__required';
    required.setAttribute('aria-hidden', 'true');
    required.textContent = '*';
    legend.append(required);

    const options = document.createElement('div');
    options.className = 'radio-options-wrapper';
    config.options.forEach((label) => {
      const option = document.createElement('label');
      option.className = 'disclaimer-radio-label';
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = BHPS_FIELD_NAMES[index];
      input.value = bhpsOptionValue(label, index);
      input.required = true;
      input.dataset.label = label;
      input.className = 'form-radio-input__field';
      input.addEventListener('change', () => clearBhpsGroupError(group));
      const circle = document.createElement('span');
      circle.className = 'form-radio-input__custom-element';
      circle.setAttribute('aria-hidden', 'true');
      const text = document.createElement('span');
      text.className = 'form-global__custom-label-text';
      text.textContent = label;
      option.append(input, circle, text);
      options.append(option);
    });

    fieldset.append(legend, options);
    group.append(fieldset);
    return group;
  }).filter(Boolean);

  if (!groups.length) return null;
  const wrapper = document.createElement('div');
  wrapper.className = 'new-disclaimer-questions';
  wrapper.append(...groups);
  return wrapper;
}

/**
 * Required check for a BHPS radio group; shows "Field is required" when empty.
 * @param {Element} group The .disclaimer-group
 * @returns {boolean} Whether an option is selected
 */
function validateBhpsGroup(group) {
  if (group.querySelector('.form-radio-input__field:checked')) {
    clearBhpsGroupError(group);
    return true;
  }
  if (!group.querySelector('.form-field-error')) {
    const error = createErrorMessageElement();
    error.textContent = 'Field is required';
    group.querySelector('fieldset').append(error);
  }
  group.classList.add('has-error');
  return false;
}

/**
 * @param {string} consentNoteHtml Authored consent note markup
 * @param {object} [options]
 * @param {boolean} [options.showWhatsapp] Whether to render the WhatsApp opt-in
 * @param {boolean} [options.isBhps] BHPS forms show a checkbox instead of the toggle
 * @param {Array<object|null>} [options.questions] BHPS questions (from getBhpsQuestion)
 */
function createConsentArea(consentNoteHtml, {
  showWhatsapp = true,
  isBhps = false,
  questions = [],
} = {}) {
  const consentArea = document.createElement('div');
  consentArea.className = 'form-consent-area d-flex flex-column';

  if (showWhatsapp) {
    const control = isBhps
      ? `<span class="form-consent-check" aria-hidden="true"></span>
        <span class="form-consent-text">Get updates on WhatsApp</span>`
      : `<span class="form-consent-toggle" aria-hidden="true"></span>
        <span class="form-consent-text">Update me on WhatsApp</span>`;
    consentArea.innerHTML = `
    <div class="form-consent-options d-flex flex-wrap align-items-center">
      <label class="form-consent-item ${isBhps ? 'form-consent-item--checkbox' : 'form-consent-item--toggle'}">
        <input
          type="checkbox"
          class="form-consent-input whatsAppConsentFormFld"
          name="updateMeOnWhatsapp"
          value="true"
        />
        ${control}
      </label>
    </div>
  `;
  }

  if (isBhps) {
    const questionsEl = buildBhpsQuestions(questions);
    if (questionsEl) consentArea.append(questionsEl);
  }

  if (consentNoteHtml) {
    const consentNote = document.createElement('div');
    consentNote.className = 'form-consent-note';
    consentNote.innerHTML = consentNoteHtml;
    consentArea.append(consentNote);
    applyConsentLinkAttributes(consentNote);
  }

  return consentArea;
}

function applyFieldConfig(input, headerCell, content) {
  if (!input || !headerCell) return;

  const headerLabel = headerCell.textContent.toLowerCase();

  input.placeholder = content;
  input.required = true;

  if (headerLabel.includes('phone') || headerLabel.includes('mobile')) {
    input.type = 'tel';
    input.id = 'enquire-mobile';
    input.name = 'ENQUIRE_MOBILE';
    input.inputMode = 'numeric';
    input.pattern = '[0-9]{10}';
    input.maxLength = 10;
    bindNumericInputFilter(input);

    const field = input.closest('.form-field');
    applyPhonePrefix(field, input);
    input.classList.add('form-input--with-prefix');
  } else if (headerLabel.includes('email')) {
    input.type = 'email';
    input.id = 'enquire-email';
    input.name = 'ENQUIRE_EMAIL';
  } else if (headerLabel.includes('pin')) {
    input.type = 'text';
    input.id = 'enquire-pincode';
    input.name = 'ENQUIRE_PINCODE';
    input.inputMode = 'numeric';
    input.pattern = '[0-9]{6}';
    input.maxLength = 6;
    bindNumericInputFilter(input);
  } else if (headerLabel.includes('name')) {
    input.type = 'text';
    input.id = 'enquire-name';
    input.name = 'ENQUIRE_NAME';
    input.pattern = '[A-Za-z ]{2,}';
  }
}

/**
 * Read authored link URL from a cell (col 2 of a link config row).
 * Supports either an authored anchor or a plain-text URL.
 */
function getAuthoredLinkFromCell(cell) {
  if (!cell) return '';

  const link = cell.querySelector('a');
  if (link?.href) return link.href;

  return cell.textContent?.trim() || '';
}

/**
 * Read authored image URL from a cell
 */
function getAuthoredImageFromCell(cell) {
  if (!cell) return '';

  const img = cell.querySelector('img');
  if (img?.getAttribute('src')) return img.getAttribute('src');

  const source = cell.querySelector('source');
  const sourceSrcset = source?.getAttribute('srcset');
  if (sourceSrcset) {
    return sourceSrcset.split(',')[0].trim().split(' ')[0];
  }

  const link = cell.querySelector('a');
  if (link?.href) return link.href;

  return cell.textContent?.trim() || '';
}

/**
 * Close active popup
 */
function closeActivePopup(block, overlay) {
  const video = overlay?.querySelector('video');
  if (video) {
    video.pause();
    video.removeAttribute('src');
    video.load();
  }
  overlay?.remove();
  block.classList.remove('success-active', 'error-active', 'popup-active');
  delete block.dataset.successShown;
  delete block.dataset.errorShown;
}

/**
 * Create close button
 */
function createCloseButton(labelText) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'form-popup-close';
  // mbutton.className = 'form-popup-close m-close'; 
  button.setAttribute('aria-label', labelText);
  button.innerHTML = '&times;<img src="/eds/icons/CloseIconForm.webp" alt="" class="CloseIconForm" aria-hidden="true">';
  return button;
}

/**
 * Create popup screen for success / error
 */
function createPopupScreen(block, type = 'success') {
  const overlay = document.createElement('div');
  overlay.className = `form-popup-overlay form-popup-overlay--${type}`;

  const closeBtn = createCloseButton(type === 'success' ? 'Close thank you popup' : 'Close error popup');

  const desktopImage = type === 'success' ? SUCCESS_DESKTOP_IMAGE : ERROR_DESKTOP_IMAGE;
  const mobileImage = type === 'success' ? SUCCESS_MOBILE_IMAGE : ERROR_MOBILE_IMAGE;

  const title = type === 'success' ? 'Thank you!' : 'Try again!';
  const text = type === 'success'
    ? 'We value your interest in Asian Paints Beautiful Homes. We will get in touch with you shortly.'
    : "Oops! Something went wrong. We couldn't process your request. Please try again?";

  const actionLabel = 'Book FREE site visit';
  const actionLink = type === 'success' ? SUCCESS_CTA_LINK : ERROR_CTA_LINK;
  const downloadMarkup = `
    <a
      class="form-error-popup__download"
      href="${ERROR_DOWNLOAD_LINK}"
      download
    >
      Download the asianpaints colour book
    </a>
  `;

  overlay.innerHTML = `
    <div class="form-error-popup">
      <div class="form-error-popup__left">
        <div class="form-error-popup__copy">
          <h2 class="form-error-popup__title">${title}</h2>
          <p class="form-error-popup__text">
            ${text}
          </p>
        </div>
      </div>

      <div class="form-error-popup__right">
        <div
          class="form-error-popup__media"
          style="
            --form-error-image-desktop: url('${desktopImage}');
            --form-error-image-mobile: url('${mobileImage}');
          "
        >
          <div class="form-error-popup__content">
            <p class="form-error-popup__content-title">
              Are you looking for home painting services?
            </p>
            <p class="form-error-popup__content-subtitle">
             Get expert execution for your dream home from beautiful homes painting service by asian paints.
            </p>
            <div class="form-error-popup__actions">
              <a
                href="${actionLink}"
                target="_self"
                class="form-error-popup__button trackCTA"
              >
                ${actionLabel}
                <span class="arrow"></span>
              </a>
              ${downloadMarkup}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  overlay.prepend(closeBtn);

  closeBtn.addEventListener('click', () => {
    closeActivePopup(block, overlay);
  });

  const trackCtaLink = overlay.querySelector('a.trackCTA');
  if (trackCtaLink) {
    trackCtaLink.addEventListener('click', () => {
      const btnTitle = trackCtaLink.textContent.trim();
      const ctaLink = trackCtaLink.getAttribute('href') || '';
      // e132 custom_cta_click: cta_->eVar45, parentTitle->eVar67,
      // redirectionLink->eVar86 (per Thank You Popup spec).
      triggerCTAClickWithLinkAndTitle(ctaLink, btnTitle, POPUP_BANNER_TITLE);
    });
  }

  // e137 download_form_pdf: pdfName->eVar96. The thank-you/error popup
  // download link had no analytics handler, so downloads weren't tracked.
  const downloadLink = overlay.querySelector('.form-error-popup__download');
  if (downloadLink) {
    downloadLink.addEventListener('click', () => {
      const href = downloadLink.getAttribute('href') || '';
      const fileBase = href.split('/').pop().replace(/\.[^.]+$/, '');
      const pdfName = fileBase || downloadLink.textContent.trim();
      trackEvent('download_form_pdf', { pdfName });
      pushAdobeCtaClickEvent({
        destinationUrl: href,
        title: pdfName,
        eventName: 'download_form_pdf',
      });

    });
  }

  return overlay;
}

/**
 * BHPS success popup (same as the form block's thank-you screen): the
 * thank-you video for the viewport, with a transparent "Book FREE site visit"
 * link laid over the button drawn in the video.
 */
function createBhpsThankYouScreen(block) {
  const overlay = document.createElement('div');
  overlay.className = 'form-popup-overlay form-popup-overlay--success form-popup-overlay--bhps';

  const closeBtn = createCloseButton('Close thank you popup');
  closeBtn.addEventListener('click', () => {
    closeActivePopup(block, overlay);
  });

  const isMobile = window.matchMedia('(max-width: 991px)').matches;
  const video = document.createElement('video');
  video.className = 'form-popup-success-video';
  video.muted = true;
  video.playsInline = true;
  video.autoplay = true;
  video.preload = 'auto';
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
  video.setAttribute('aria-label', 'thank-you');
  video.src = (isMobile ? BHPS_THANK_YOU_MOBILE_VIDEO : BHPS_THANK_YOU_DESKTOP_VIDEO)
    || BHPS_THANK_YOU_DESKTOP_VIDEO || BHPS_THANK_YOU_MOBILE_VIDEO;

  overlay.append(closeBtn, video);

  if (BHPS_THANK_YOU_CTA_LINK) {
    const ctaLabel = 'Book FREE site visit';
    const cta = document.createElement('a');
    cta.className = 'form-popup-success-cta';
    cta.href = BHPS_THANK_YOU_CTA_LINK;
    cta.target = '_blank';
    cta.rel = 'noopener noreferrer';
    cta.setAttribute('aria-label', ctaLabel);
    cta.addEventListener('click', () => {
      triggerCTAClickWithLinkAndTitle(BHPS_THANK_YOU_CTA_LINK, ctaLabel, POPUP_BANNER_TITLE);
    });
    overlay.append(cta);
  }

  return overlay;
}

/**
 * Show success overlay
 */
function showSuccessScreen(block) {
  if (!block || block.dataset.successShown === 'true') return;

  const existingOverlay = block.querySelector('.form-popup-overlay--success');
  if (existingOverlay) {
    block.dataset.successShown = 'true';
    block.classList.add('success-active', 'popup-active');
    return;
  }

  // BHPS forms get the thank-you video popup; other forms the default image popup
  const overlay = block.classList.contains('bhps-form')
    ? createBhpsThankYouScreen(block)
    : createPopupScreen(block, 'success');
  block.appendChild(overlay);
  block.dataset.successShown = 'true';
  block.classList.add('success-active', 'popup-active');
}

/**
 * Show error overlay
 */
function showErrorScreen(block) {
  if (!block || block.dataset.errorShown === 'true') return;

  const existingOverlay = block.querySelector('.form-popup-overlay--error');
  if (existingOverlay) {
    block.dataset.errorShown = 'true';
    block.classList.add('error-active', 'popup-active');
    return;
  }

  const overlay = createPopupScreen(block, 'error');
  block.appendChild(overlay);
  block.dataset.errorShown = 'true';
  block.classList.add('error-active', 'popup-active');
}

function bindSubmitHandler(block, row, buttonCell) {
  const submitBtn = buttonCell?.querySelector('button.form-submit');
  if (!submitBtn || submitBtn.dataset.submitBound === 'true') return;

  const loaderEl = submitBtn.querySelector('.rotating');
  submitBtn.dataset.submitBound = 'true';

  submitBtn.addEventListener('click', (event) => {
    event.preventDefault();

    if (row.dataset.submitting === 'true') return;

    const inputs = row.querySelectorAll('.form-input');
    let isValid = true;
    const failedFields = [];

    inputs.forEach((input) => {
      const validField = validateInputField(input, true);
      if (!validField) {
        isValid = false;
        failedFields.push(input.name || input.id || 'field');
      }
    });

    // BHPS questions are required too
    row.querySelectorAll('.disclaimer-group').forEach((group) => {
      if (!validateBhpsGroup(group)) {
        isValid = false;
        const question = group.querySelector('legend')?.firstChild?.textContent?.trim();
        failedFields.push(question || 'BHPS question');
      }
    });

    if (!isValid) {
      trackFormError({ campaignId, formName, formError: failedFields });
      return;
    }

    row.dataset.submitting = 'true';
    submitBtn.disabled = true;
    loaderEl?.classList.remove('d-none');

    submitLeadFromForm(row, {
      resourcePath: row.getAttribute('data-attr-resourcePath') || formNodePath || window.location.pathname || '',
      campaignId,
      selectors: {
        name: '#enquire-name',
        email: '#enquire-email',
        mobile: '#enquire-mobile',
        pincode: '#enquire-pincode',
      },
    })
      .then(() => {
        setFormFieldsToCookie(row);
        trackFormSubmission(row);
        showSuccessScreen(block);
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('Form banner submission failed', err);
        showErrorScreen(block);
      })
      .finally(() => {
        row.dataset.submitting = 'false';
        submitBtn.disabled = false;
        loaderEl?.classList.add('d-none');
      });
  });
}

function buildFormCard(block, labelsRow, inputsRow, consentNoteHtml, cardTitle, consentOptions) {
  const labelCells = [...labelsRow.children];
  const inputCellsSource = [...inputsRow.children];

  const formCard = document.createElement('div');
  formCard.className = 'form-banner__card';

  const title = document.createElement('h3');
  title.className = 'form-banner__card-title';
  title.textContent = cardTitle || 'Let our experts help you!';
  formName = title.textContent?.trim() || 'Form Banner';

  const formRow = document.createElement('div');
  formRow.className = 'form-banner__form form-attributes';
  formRow.setAttribute('data-attr-resourcePath', formNodePath || window.location.pathname || '');

  const inputsGrid = document.createElement('div');
  inputsGrid.className = 'form-inputs-grid';

  for (let i = 0; i < 4; i += 1) {
    const labelCell = labelCells[i];
    const inputSourceCell = inputCellsSource[i];
    const content = inputSourceCell?.textContent.trim();

    if (!content) continue;

    const inputCell = document.createElement('div');
    inputCell.className = 'form-input-cell';

    const headerText = labelCell ? labelCell.textContent.trim() : '';
    createDefaultField(inputCell, 2, i, headerText, content);

    const input = inputCell.querySelector('.form-input');

    inputsGrid.appendChild(inputCell);
  }

  const buttonCell = document.createElement('div');
  buttonCell.className = 'form-button-cell';

  const buttonLabelCell = labelCells[4];
  const buttonLabel = buttonLabelCell?.textContent.trim();

  if (buttonLabel) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'form-submit btn';
    button.innerHTML = `
      <span class="form-submit__label">${buttonLabel}</span>
      <span class="form-submit__arrow" aria-hidden="true">
        <img src="/eds/icons/arrow-icon-new.svg" alt="arrow icon" class="link-icon">
      </span>
      <span class="rotating d-none" aria-hidden="true">↻</span>
    `;
    buttonCell.appendChild(button);
  }

  formRow.appendChild(inputsGrid);

  const consentArea = createConsentArea(consentNoteHtml, consentOptions);
  formRow.appendChild(consentArea);

  // Keep toggle ON by default on page load
  const whatsappToggle = consentArea.querySelector('[name="updateMeOnWhatsapp"]');
  if (whatsappToggle) {
    whatsappToggle.checked = true;
    whatsappToggle.classList.add('whatsAppCheckbox-checked');

    whatsappToggle.addEventListener('change', () => {
      whatsappToggle.classList.toggle(
        'whatsAppCheckbox-checked',
        whatsappToggle.checked
      );
    });
  }

  if (buttonCell.children.length) {
    formRow.appendChild(buttonCell);
  }

  formCard.appendChild(title);
  formCard.appendChild(formRow);

  formRow.addEventListener('focusin', (e) => {
    if (!formStarted && e.target.tagName === 'INPUT') {
      formStarted = true;
      trackEvent('Form start', {
        formName,
        campaignId,
      });
      pushAdobeFormEvents({
        formCampaignId: campaignId,
        formName: formName,
        event : 'form_start'
      });
    }
  });

  if (buttonCell.children.length) {
    bindSubmitHandler(block, formRow, buttonCell);
  }

  // Prefill form fields from cookies
  checkCookieValues(formRow);
  formRow.querySelectorAll('.form-input').forEach((input) => {
  if (input.value.trim()) {
    input.closest('.form-field')?.classList.add('show-label');
    input.closest('.form-field')?.classList.add('has-value');
  }
});

  return formCard;
}

// first-column labels of the label | value settings rows
const SETTING_LABELS = [
  'form title', 'autoplay', 'interval', 'update me on whatsapp', 'is it a bhps form',
  'bhps question 1', 'bhps question 2',
  'default success image', 'default error image',
  'default success_cta_link', 'default error_cta_link', 'default error_download_link',
  'bhps thank_you_desktop_video', 'bhps thank_you_mobile_video', 'bhps thank_you_cta_link',
];

/**
 * Builds the banner media: a single picture, or a Swiper carousel with dot
 * pagination when there is more than one slide.
 * @param {HTMLPictureElement[]} pictures One picture per slide
 * @returns {HTMLDivElement} The media element
 */
function buildMedia(pictures) {
  const media = document.createElement('div');
  media.className = 'form-banner__media';
  if (pictures.length < 2) {
    media.append(pictures[0]);
    return media;
  }

  media.classList.add('swiper');
  const track = document.createElement('div');
  track.className = 'swiper-wrapper';
  pictures.forEach((picture, i) => {
    const slide = document.createElement('div');
    slide.className = 'swiper-slide form-banner__slide';
    slide.setAttribute('aria-label', `${i + 1} / ${pictures.length}`);
    slide.append(picture);
    track.append(slide);
  });

  // static dots until Swiper loads and renders its own, so nothing shifts
  const pagination = document.createElement('div');
  pagination.className = 'swiper-pagination form-banner__pagination';
  pictures.forEach((_, i) => {
    const dot = document.createElement('span');
    dot.className = 'swiper-pagination-bullet';
    if (i === 0) dot.classList.add('swiper-pagination-bullet-active');
    pagination.append(dot);
  });

  media.append(track, pagination);
  return media;
}

/**
 * Starts the carousel. Swiper loads on the first interaction with the banner,
 * or on a timer, to keep it out of LCP/TBT. With autoplay the timer is the
 * interval itself, and the first slide change happens right at init.
 * @param {HTMLDivElement} media The media element built by buildMedia
 * @param {number} [autoplayDelay] Milliseconds between slides; 0 turns autoplay off
 */
function initCarousel(media, autoplayDelay = 0) {
  if (!media.classList.contains('swiper')) return;

  let started = false;
  const start = async (fromTimer = false) => {
    if (started) return;
    started = true;
    // later slides were lazy; fetch them now so they are ready when shown
    media.querySelectorAll('img[loading="lazy"]').forEach((img) => { img.loading = 'eager'; });
    try {
      const Swiper = window.Swiper || await window.loadSwiper?.();
      if (!Swiper) return;
      const swiper = new Swiper(media, {
        slidesPerView: 1,
        rewind: true,
        speed: 600,
        autoplay: autoplayDelay ? {
          delay: autoplayDelay,
          disableOnInteraction: false,
          pauseOnMouseEnter: true,
        } : false,
        pagination: {
          el: media.querySelector('.form-banner__pagination'),
          clickable: true,
        },
      });
      // the first interval already passed while waiting on the timer
      if (fromTimer && autoplayDelay) swiper.slideNext();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('form-banner: Swiper init failed', e);
    }
  };

  ['pointerenter', 'touchstart', 'focusin'].forEach((evt) => {
    media.addEventListener(evt, () => start(), { once: true, passive: true });
  });
  setTimeout(() => start(true), autoplayDelay || 6000);
}

export default function decorate(block) {
  extractFormConfig(block);
  formStarted = false;
  formName = '';

  // label | value settings rows: read them, then drop them so the rows below keep their positions
  const settings = {};
  const settingRows = {};
  const rows = [...block.children].filter((row) => {
    // compare without whitespace: DA labels can be split by <br> or across <p>s
    // ("Default<br>ERROR_CTA_LINK" reads as "DefaultERROR_CTA_LINK")
    const text = (row.children[0]?.textContent || '').toLowerCase().replace(/\s+/g, '');
    const label = SETTING_LABELS.find((l) => l.replace(/\s+/g, '') === text);
    if (!label) return true;
    settings[label] = row.children[1]?.textContent?.trim() || '';
    settingRows[label] = row;
    return false;
  });
  const cardTitle = settings['form title'] || '';
  const autoplay = /^(true|yes)$/i.test(settings.autoplay || '');
  const interval = Math.max(1000, parseInt(settings.interval, 10) || 5000);
  const consentOptions = {
    showWhatsapp: !/^hide$/i.test(settings['update me on whatsapp'] || ''),
    isBhps: /^true$/i.test(settings['is it a bhps form'] || ''),
    questions: [
      getBhpsQuestion(settingRows['bhps question 1']),
      getBhpsQuestion(settingRows['bhps question 2']),
    ],
  };
  if (rows.length < 3) return;

  const imageRow = rows[0];
  const labelsRow = rows[1];
  const inputsRow = rows[2];

  // Row 1 -> one slide per column that has an image (desktop picture, then mobile)
  const slidePictures = [...imageRow.children]
    .map((cell) => getPicturesFromCell(cell))
    .filter((pictures) => pictures.length)
    .map((pictures, i) => createResponsivePicture(
      pictures[0],
      pictures[1] || pictures[0],
      'Form banner background',
      i === 0,
    ))
    .filter(Boolean);

  if (!slidePictures.length) return;

  // Row 4, col 1 -> form-consent-note rich text
  const consentNoteHtml = extractConsentNoteHtml(rows[3]);

  // popup images: label | desktop image | mobile image
  const successCells = [...(settingRows['default success image']?.children || [])];
  SUCCESS_DESKTOP_IMAGE = getAuthoredImageFromCell(successCells[1]);
  SUCCESS_MOBILE_IMAGE = getAuthoredImageFromCell(successCells[2]);

  const errorCells = [...(settingRows['default error image']?.children || [])];
  ERROR_DESKTOP_IMAGE = getAuthoredImageFromCell(errorCells[1]);
  ERROR_MOBILE_IMAGE = getAuthoredImageFromCell(errorCells[2]);

  // popup links: label | URL (keep the built-in default when not authored)
  const linkFrom = (label) => getAuthoredLinkFromCell(settingRows[label]?.children[1]);
  SUCCESS_CTA_LINK = linkFrom('default success_cta_link') || SUCCESS_CTA_LINK;
  ERROR_CTA_LINK = linkFrom('default error_cta_link') || ERROR_CTA_LINK;
  ERROR_DOWNLOAD_LINK = linkFrom('default error_download_link') || ERROR_DOWNLOAD_LINK;
  BHPS_THANK_YOU_DESKTOP_VIDEO = linkFrom('bhps thank_you_desktop_video');
  BHPS_THANK_YOU_MOBILE_VIDEO = linkFrom('bhps thank_you_mobile_video');
  BHPS_THANK_YOU_CTA_LINK = linkFrom('bhps thank_you_cta_link');

  block.innerHTML = '';
  block.classList.add('form-banner');
  // BHPS-only styles are scoped to this class (see form-banner.css)
  if (consentOptions.isBhps) block.classList.add('bhps-form');

  const wrapper = document.createElement('div');
  wrapper.className = 'form-banner__wrapper';

  const media = buildMedia(slidePictures);

  const overlay = document.createElement('div');
  overlay.className = 'form-banner__overlay';

  const formCard = buildFormCard(
    block,
    labelsRow,
    inputsRow,
    consentNoteHtml,
    cardTitle,
    consentOptions,
  );

  overlay.appendChild(formCard);
  wrapper.append(media, overlay);
  block.appendChild(wrapper);
  initCarousel(media, autoplay ? interval : 0);
}