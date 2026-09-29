/*
** Authoring format **

Row 1 (Images)
Col 1 → Desktop banner image (picture)
Col 2 → Mobile banner image (picture)

Row 2 (Form Labels)
Col 1 → Name label
Col 2 → Email label
Col 3 → Mobile number label
Col 4 → Pincode label
Col 5 → Submit button label

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

Row 5 (Success Popup Images)
Col 1 → Desktop success image
Col 2 → Mobile success image

Row 6 (Error Popup Images)
Col 1 → Desktop error image
Col 2 → Mobile error image

Row 7 (Success CTA Link)
Col 1 → Label (e.g. SUCCESS_CTA_LINK)
Col 2 → URL

Row 8 (Error CTA Link)
Col 1 → Label (e.g. ERROR_CTA_LINK)
Col 2 → URL

Row 9 (Error Download Link)
Col 1 → Label (e.g. ERROR_DOWNLOAD_LINK)
Col 2 → URL

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

function createResponsivePicture(desktopPicture, mobilePicture, altText = '') {
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
  img.loading = 'eager';
  img.decoding = 'async';
  img.setAttribute('fetchpriority', 'high');

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

  const formData = {
    formName,
    campaignId,
    // Send explicit 'unchecked' (not undefined) so eVar108 always reflects the
    // real opt-in state on the beacon instead of being dropped by trackEvent's
    // undefined-filter. QA relies on the presence of the value for reporting.
    whatsappOptIn: isWhatsappChecked ? 'checked' : 'unchecked',
    dataDestination: form.dataset.dataDestination || 'both',
    contruction: constructionField ? yesNo(constructionField.checked) : undefined,
    localpainter: localPainterField ? yesNo(localPainterField.checked) : undefined,
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
    contruction: constructionField ? yesNo(constructionField.checked) : undefined,
    localpainter: localPainterField ? yesNo(localPainterField.checked) : undefined,
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

function createConsentArea(consentNoteHtml) {
  const consentArea = document.createElement('div');
  consentArea.className = 'form-consent-area d-flex flex-column';

  consentArea.innerHTML = `
    <div class="form-consent-options d-flex flex-wrap align-items-center">
      <label class="form-consent-item form-consent-item--toggle">
        <input
          type="checkbox"
          class="form-consent-input whatsAppConsentFormFld"
          name="updateMeOnWhatsapp"
          value="true"
        />
        <span class="form-consent-toggle" aria-hidden="true"></span>
        <span class="form-consent-text">Update me on WhatsApp</span>
      </label>
    </div>
  `;

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

  const overlay = createPopupScreen(block, 'success');
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

function buildFormCard(block, labelsRow, inputsRow, consentNoteHtml) {
  const labelCells = [...labelsRow.children];
  const inputCellsSource = [...inputsRow.children];

  const formCard = document.createElement('div');
  formCard.className = 'form-banner__card';

  const title = document.createElement('h3');
  title.className = 'form-banner__card-title';
  title.textContent = 'Let our experts help you!';
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

  const consentArea = createConsentArea(consentNoteHtml);
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

export default function decorate(block) {
  extractFormConfig(block);
  formStarted = false;
  formName = '';

  const rows = [...block.children];
  if (rows.length < 3) return;

  const imageRow = rows[0];
  const labelsRow = rows[1];
  const inputsRow = rows[2];

  const imageCell = imageRow.children[0];
  if (!imageCell) return;

  const pictures = getPicturesFromCell(imageCell);

  const desktopPicture = pictures[0] || null;
  const mobilePicture = pictures[1] || pictures[0] || null;

  const responsivePicture = createResponsivePicture(
    desktopPicture,
    mobilePicture,
    'Form banner background',
  );

  if (!responsivePicture) return;

  // Row 4, col 1 -> form-consent-note rich text
  const consentNoteHtml = extractConsentNoteHtml(rows[3]);

  // Row 5 -> success popup images
  if (rows[4]) {
    const successRowCells = [...rows[4].children];
    SUCCESS_DESKTOP_IMAGE = getAuthoredImageFromCell(successRowCells[0]);
    SUCCESS_MOBILE_IMAGE = getAuthoredImageFromCell(successRowCells[1]);
  }

  // Row 6 -> error popup images
  if (rows[5]) {
    const errorRowCells = [...rows[5].children];
    ERROR_DESKTOP_IMAGE = getAuthoredImageFromCell(errorRowCells[0]);
    ERROR_MOBILE_IMAGE = getAuthoredImageFromCell(errorRowCells[1]);
  }

  // Row 7 -> success CTA link (col 1: label, col 2: URL)
  if (rows[6]) {
    const successLinkCells = [...rows[6].children];
    SUCCESS_CTA_LINK = getAuthoredLinkFromCell(successLinkCells[1]) || SUCCESS_CTA_LINK;
  }

  // Row 8 -> error CTA link (col 1: label, col 2: URL)
  if (rows[7]) {
    const errorLinkCells = [...rows[7].children];
    ERROR_CTA_LINK = getAuthoredLinkFromCell(errorLinkCells[1]) || ERROR_CTA_LINK;
  }

  // Row 9 -> error download link (col 1: label, col 2: URL)
  if (rows[8]) {
    const downloadLinkCells = [...rows[8].children];
    ERROR_DOWNLOAD_LINK = getAuthoredLinkFromCell(downloadLinkCells[1]) || ERROR_DOWNLOAD_LINK;
  }

  block.innerHTML = '';
  block.classList.add('form-banner');

  const wrapper = document.createElement('div');
  wrapper.className = 'form-banner__wrapper';

  const media = document.createElement('div');
  media.className = 'form-banner__media';
  media.appendChild(responsivePicture);

  const overlay = document.createElement('div');
  overlay.className = 'form-banner__overlay';

  const formCard = buildFormCard(block, labelsRow, inputsRow, consentNoteHtml);

  overlay.appendChild(formCard);
  wrapper.append(media, overlay);
  block.appendChild(wrapper);
}