/*
** Authoring format **
Form block
Row 1, col 1–3 → used for form-description-cell
Row 2, col 1–4 → used as form-field-label
Row 2, col 5 → used as submit button label
Row 3, col 1–4 → used as input placeholder/content

Row 4, col 1 → form-consent-text for whatsapp
Row 4, col 2 → display / hide

Row 5, col 1 → form-consent-note rich text — authored markup (incl. <a>
  links) is kept as-is; see extractConsentNoteHtml(). Links get
  styled/hardened by applyConsentLinkAttributes() (blue, opens in a new
  tab). No note is rendered at all when this row/cell is empty.

Row 6, col 1 → label ("Is it a BHPS form")
Row 6, col 2 → isBhpsForm flag ("true" / "false") — see extractIsBhpsForm()

Row 7, col 1 → form-consent-text for construction
Row 7, col 2 → display / hide

Row 8, col 1 → form-consent-text for local painter
Row 8, col 2 → display / hide

Row 9, col 1 → BHPS disclaimer question 1 text (e.g. "When do you plan
  to start with the painting?")
Row 9, col 2 → bullet list of radio option labels for question 1
Row 9, col 3 → display / hide
Row 10 → same shape as row 9, for disclaimer question 2 (e.g. "Is there
  a local painter hired?")
  — only rendered when isBhpsForm is true; see getDisclaimerQuestionConfig()

Row 11, col 1 → desktop error image
Row 11, col 2 → mobile error image

Row 12, col 1 → label (ERROR_CTA_LINK)
Row 12, col 2 → error popup CTA link

Row 13, col 1 → label (ERROR_DOWNLOAD_LINK)
Row 13, col 2 → error popup colour book download link

Row 14, col 1 → label (THANK_YOU_TWO_DESKTOP)
Row 14, col 2 → thank-you (variant 2) desktop image

Row 15, col 1 → label (THANK_YOU_TWO_MOB)
Row 15, col 2 → thank-you (variant 2) mobile image

Row 16, col 1 → label (THANK_YOU_CTA_LABEL)
Row 16, col 2 → thank-you "Book FREE site visit" CTA label

Row 17, col 1 → label (THANK_YOU_BANNER_TITLE)
Row 17, col 2 → thank-you banner title

Row 18, col 1 → label (THANK_YOU_DESKTOP_VIDEO)
Row 18, col 2 → thank-you desktop video link

Row 19, col 1 → label (THANK_YOU_MOBILE_VIDEO)
Row 19, col 2 → thank-you mobile video link

Row 20, col 1 → label (THANK_YOU_CTA_LINK)
Row 20, col 2 → thank-you "Book FREE site visit" CTA link

Form Config block
Row 1, col 1-2 → campaign ID (to pass as form parameter and for tracking)
Row 2, col 1-2 → node (to pass as form parameter node path)
Row 3, col 1-2 → BH Interested campaign ID (to pass as form parameter campaign ID)

Two variant: White form, Blue form
*/

import { submitLeadFromForm, checkCookieValues, setFormFieldsToCookie } from '../../scripts/form-submit-common.js';
import { getDigitalData, trackEvent, trackFormError , pushAdobeCtaClickEvent , pushAdobeFormEvents } from '../../scripts/analytics_1.js';
import { firePixelConversion } from '../../scripts/third-party-pixels.js';

// Thank-you "Book FREE site visit" CTA — label + banner title used for
// custom_cta_click (event132). parentTitle (eVar67) must be the banner
// heading shown in the thank-you video, not the form's own title.
// Populated from rows 15–16 of the form block in DA — see extractFormExtraLinks().
let THANK_YOU_CTA_LABEL = '';
let THANK_YOU_BANNER_TITLE = '';
// Populated from rows 17–19 of the form block in DA — see extractFormExtraLinks().
let THANK_YOU_DESKTOP_VIDEO = '';
let THANK_YOU_MOBILE_VIDEO = '';
let THANK_YOU_CTA_LINK = '';

let ERROR_DESKTOP_IMAGE = '';
let ERROR_MOBILE_IMAGE = '';
// Populated from rows 11–14 of the form block in DA — see extractFormExtraLinks().
let ERROR_CTA_LINK = '';
let ERROR_DOWNLOAD_LINK = '';
let THANK_YOU_TWO_DESKTOP = '';
let THANK_YOU_TWO_MOB = '';

let formName = "";
let campaignId = "";
let formNodePath = '';
let bhInterestedCampaignId = '';
let formStarted = false;

// When true, the default WhatsApp consent + construction/local-painter
// consent options are hidden and replaced with the BHPS (Beautiful Homes)
// WhatsApp toggle + disclaimer questions markup below. Authored in row 5,
// col 2 of the form block ("true"/"false") — see extractIsBhpsForm().
// Defaults to true when the row is absent or its value isn't recognized.
let isBhpsForm = true;

function getRowValue(row) {
  if (!row) return '';

  const cells = [...row.children];
  const preferred = cells[1]?.textContent?.trim();
  if (preferred) return preferred;

  return cells.map((cell) => cell.textContent?.trim()).filter(Boolean).join(' ').trim();
}

function getCellText(cell) {
  return cell?.textContent?.trim() || '';
}

/**
 * Read the isBhpsForm flag from row 6, col 2 ("true"/"false") and hide
 * the row. Defaults to true (the module-level default) unless the row is
 * present and its value is explicitly "false".
 */
function extractIsBhpsForm(row) {
  if (!row) return;

  const cells = [...row.children];
  const value = getCellText(cells[1]).toLowerCase();
  isBhpsForm = value !== 'false';

  row.style.display = 'none';
}

/**
 * Row 5, col 1 → form-consent-note rich text, replacing the hardcoded
 * disclaimer copy. Authored markup (e.g. <a> links) is kept as-is, the
 * same trusted-DA-content pattern populateDescriptionCell() already uses
 * via cell.innerHTML. Returns '' when the row/cell is absent or empty —
 * callers render no consent note at all in that case (no fallback copy).
 */
function extractConsentNoteHtml(row) {
  if (!row) return '';

  const cell = row.children[0];
  const html = cell?.innerHTML?.trim();
  return html || '';
}

/**
 * Harden/style any links inside the (possibly authored) consent note:
 * open in a new tab safely, and mark them for the blue/pointer styling
 * in form.css.
 *
 * Also handles the open explicitly via window.open() instead of relying
 * solely on target="_blank" — formRow's click listener (bubbled up from
 * this same click) only runs its form_start tracking on the very first
 * click anywhere in the form, and that first call synchronously injects
 * the full GTM script (see fireGTM() in third-party-pixels.js), which
 * can itself mutate the DOM / add listeners as its tags execute. That
 * was observed to occasionally swallow the link's native navigation on
 * that first click only — explicit window.open() inside this handler is
 * unaffected by whatever else runs during the same event dispatch.
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
      const cell = link.closest('.form-row.form-attributes');

      const small = cell?.querySelector('.form-title-small')?.textContent?.trim();
      const large = cell?.querySelector('.form-title-large')?.textContent?.trim();

      const parentTitle = small || large || '';
      trackEvent('cta_link_text', {
        cta_: link.textContent?.trim(),
        parentTitle,
        param1: link ? link.href : ''
      });

      pushAdobeCtaClickEvent ({
        event : 'cta_link_text',
        parentTitle,
        cta: link.textContent?.trim(),
        destinationUrl : link ? link.href : ''
      })

    };

    // Open on pointerdown so it fires before any layout shift (blur
    // validation error line, GTM injection) can move the link out from
    // under the pointer and make the click miss.
    link.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;          // primary button only
      link.dataset.opened = 'true';
      setTimeout(() => { delete link.dataset.opened; }, 300);
      open(e);
    });

    // Keep click for keyboard (Enter), but skip it when pointerdown
    // already handled this interaction so it doesn't open twice.
    link.addEventListener('click', (e) => {
      if (link.dataset.opened === 'true') { e.preventDefault(); return; }
      open(e);
    });
  });
}

/**
 * Extract a URL from an authored cell — an anchor href, an image src,
 * or plain text, in that order of preference.
 */
function extractLinkFromCell(cell) {
  if (!cell) return '';

  const anchor = cell.querySelector('a');
  if (anchor?.href) return anchor.href;

  const img = cell.querySelector('img');
  if (img?.src) return img.src;

  return cell.textContent?.trim() || '';
}

/**
 * Row shape: col 1 = label (for authors' reference), col 2 = the link.
 */
function getRowLink(row) {
  if (!row) return '';

  const cells = [...row.children];
  return extractLinkFromCell(cells[1]) || extractLinkFromCell(cells[0]);
}

/**
 * Read error/thank-you-variant links (rows 12–15), thank-you CTA
 * label/banner title (rows 16–17), and thank-you videos/CTA link
 * (rows 18–20) from authored content, then hide those rows. Falls
 * back to the module-level defaults when a row is absent or empty.
 */
function extractFormExtraLinks(rows) {
  const [
    errorCtaRow, errorDownloadRow, thankYouTwoDesktopRow, thankYouTwoMobileRow,
    thankYouCtaLabelRow, thankYouBannerTitleRow,
    thankYouDesktopVideoRow, thankYouMobileVideoRow, thankYouCtaLinkRow,
  ] = rows.slice(11, 20);

  const errorCtaLink = getRowLink(errorCtaRow);
  if (errorCtaLink) ERROR_CTA_LINK = errorCtaLink;

  const errorDownloadLink = getRowLink(errorDownloadRow);
  if (errorDownloadLink) ERROR_DOWNLOAD_LINK = errorDownloadLink;

  const thankYouTwoDesktopLink = getRowLink(thankYouTwoDesktopRow);
  if (thankYouTwoDesktopLink) THANK_YOU_TWO_DESKTOP = thankYouTwoDesktopLink;

  const thankYouTwoMobileLink = getRowLink(thankYouTwoMobileRow);
  if (thankYouTwoMobileLink) THANK_YOU_TWO_MOB = thankYouTwoMobileLink;

  const thankYouCtaLabel = getRowValue(thankYouCtaLabelRow);
  if (thankYouCtaLabel) THANK_YOU_CTA_LABEL = thankYouCtaLabel;

  const thankYouBannerTitle = getRowValue(thankYouBannerTitleRow);
  if (thankYouBannerTitle) THANK_YOU_BANNER_TITLE = thankYouBannerTitle;

  const thankYouDesktopVideoLink = getRowLink(thankYouDesktopVideoRow);
  if (thankYouDesktopVideoLink) THANK_YOU_DESKTOP_VIDEO = thankYouDesktopVideoLink;

  const thankYouMobileVideoLink = getRowLink(thankYouMobileVideoRow);
  if (thankYouMobileVideoLink) THANK_YOU_MOBILE_VIDEO = thankYouMobileVideoLink;

  const thankYouCtaLink = getRowLink(thankYouCtaLinkRow);
  if (thankYouCtaLink) THANK_YOU_CTA_LINK = thankYouCtaLink;

  [
    errorCtaRow, errorDownloadRow, thankYouTwoDesktopRow, thankYouTwoMobileRow,
    thankYouCtaLabelRow, thankYouBannerTitleRow,
    thankYouDesktopVideoRow, thankYouMobileVideoRow, thankYouCtaLinkRow,
  ].forEach((row) => {
    if (row) row.style.display = 'none';
  });
}

function findNearestFormConfigBlock(block) {
  const section = block.closest('.section');
  if (!section) return null;

  const inCurrentSection = section.querySelector('.form-config, .form-configs');
  if (inCurrentSection) return inCurrentSection;

  // Blue form pages may author form-config in a nearby sibling section.
  let previous = section.previousElementSibling;
  while (previous) {
    const candidate = previous.querySelector?.('.form-config, .form-configs');
    if (
      candidate &&
      !previous.classList.contains('form-banner-container')
    ) {
      return candidate;
    }
    previous = previous.previousElementSibling;
  }

  let next = section.nextElementSibling;
  while (next) {
    const candidate = next.querySelector?.('.form-config, .form-configs');
    if (
      candidate &&
      !next.classList.contains('form-banner-container')
    ) {
      return candidate;
    }
    next = next.nextElementSibling;
  }

  return null;
}

function extractFormConfig(block) {
  const section = block.closest('.section');
  const formConfigBlock = findNearestFormConfigBlock(block);

  let configuredCampaignId = '';
  let configuredNodePath = '';
  let configuredBhInterestedCampaignId = '';

  if (formConfigBlock) {
    const configRows = [...formConfigBlock.children];
    configuredCampaignId = getRowValue(configRows[0]);
    configuredNodePath = getRowValue(configRows[1]);
    configuredBhInterestedCampaignId = getRowValue(configRows[2]);

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

  configuredBhInterestedCampaignId = configuredBhInterestedCampaignId
    || block.getAttribute('data-attr-bhsInterestedCampaignId')?.trim()
    || 'DECOR_ORGANIC_AP.com';

  // Prioritize utm_campaign from URL over configured campaign ID
  const urlParams = new URLSearchParams(window.location.search);
  const utmCampaign = urlParams.get('utm_campaign');
  
  campaignId = utmCampaign || configuredCampaignId;
  formNodePath = configuredNodePath;
  bhInterestedCampaignId = configuredBhInterestedCampaignId;
}

/**
 * Ensure bootstrap utility classes where useful
 */
function applyBootstrapHelpers(block) {
  const section = block.closest('.section.form-container');
  const wrapper = block.closest('.form-wrapper');

  // section?.classList.add('bg-transparent');
  wrapper?.classList.add('m-0', 'p-0', 'w-100');
  block.classList.add('position-relative', 'overflow-hidden', 'w-100');
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
 * Show/clear a "Field is required" error for a disclaimer radio group
 * (BHPS form only) — mirrors showFieldError/clearFieldError above, but
 * targets a fieldset-based radio group instead of a single .form-field.
 */
function showDisclaimerGroupError(group) {
  if (!group) return;

  let errorEl = group.querySelector('.form-field-error');
  if (!errorEl) {
    errorEl = createErrorMessageElement();
    // Append inside the fieldset (after the radio row), not as a sibling
    // of it — .disclaimer-group is a flex row, so a sibling would sit
    // beside the fieldset instead of stacking below the radio buttons.
    (group.querySelector('fieldset') || group).appendChild(errorEl);
  }

  errorEl.textContent = 'Field is required';
  group.classList.add('has-error');
}

function clearDisclaimerGroupError(group) {
  if (!group) return;

  const errorEl = group.querySelector('.form-field-error');
  if (errorEl) {
    errorEl.textContent = '';
  }

  group.classList.remove('has-error');
}

/**
 * Validate a disclaimer radio group — valid when one of its radios is
 * checked.
 */
function validateDisclaimerGroup(group, showError = true) {
  if (!group) return true;

  const isChecked = !!group.querySelector('.form-radio-input__field:checked');

  if (!isChecked) {
    if (showError) showDisclaimerGroupError(group);
    return false;
  }

  clearDisclaimerGroupError(group);
  return true;
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
 * Create default form field
 */
function createDefaultField(cell, rowIdx, cellIdx, labelText, placeholderText) {
  const field = document.createElement('div');
  field.className = 'form-field position-relative w-100';

  let inputId = `form-input-${rowIdx}-${cellIdx}`;

  // Map common labels to specific ids
  const lowerLabel = (labelText || '').toLowerCase();
  const isPincode = lowerLabel.includes('pincode') || lowerLabel.includes('pin');
  if (lowerLabel.includes('name')) {
    inputId = 'enquire-name';
  } else if (lowerLabel.includes('email')) {
    inputId = 'enquire-email';
  } else if (lowerLabel.includes('mobile') || lowerLabel.includes('phone')) {
    inputId = 'enquire-mobile';
  } else if (lowerLabel.includes('pincode') || lowerLabel.includes('pin')) {
    inputId = 'enquire-pincode';
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

  label.innerHTML = `${displayLabel}<span class="form-field-required">*</span>`;

  const input = document.createElement('input');
  let inputType = 'text';

  if (labelText) {
    const lowerLabel = labelText.toLowerCase();
    if (lowerLabel.includes('phone') || lowerLabel.includes('mobile')) {
      inputType = 'tel';
    } else if (lowerLabel.includes('email')) {
      inputType = 'email';
    }
  }

  input.type = inputType;
  input.id = inputId;
  input.name = labelText || placeholderText;
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

  updateFieldState();

  input.addEventListener('focus', () => {
    field.classList.add('show-label');
  });

  input.addEventListener('blur', () => {
    updateFieldState();
    validateInputField(input, true);
  });

  input.addEventListener('input', () => {
    updateFieldState();

    if (field.classList.contains('has-error')) {
      validateInputField(input, true);
    }
  });

  field.append(label, input, errorEl);

  cell.textContent = '';
  cell.appendChild(field);
}

/**
 * Build consent config from authoring rows
 */
function getConsentConfig(consentRows = []) {
  const [whatsappRow, constructionRow, localPainterRow] = consentRows;

  const getConsentItem = (row, fallbackText) => {
    const cells = [...(row?.children || [])];
    const text = getCellText(cells[0]) || fallbackText;
    const visibility = (getCellText(cells[1]) || 'display').toLowerCase();
    const isHidden = visibility === 'hide';

    return {
      text,
      isHidden,
    };
  };

  return {
    whatsapp: getConsentItem(whatsappRow, 'Update me on WhatsApp'),
    construction: getConsentItem(constructionRow, 'Construction work going on at my house'),
    localPainter: getConsentItem(localPainterRow, 'Local painter hired'),
  };
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
 * Read one BHPS disclaimer question (row shape: col 1 = question text,
 * col 2 = bullet list of radio options, col 3 = display/hide) from
 * authoring. Falls back to no options (question is skipped) when the row
 * is absent or has no options authored.
 */
function getDisclaimerQuestionConfig(row) {
  if (!row) return null;

  const cells = [...row.children];
  const question = getCellText(cells[0]);
  const options = [...(cells[1]?.querySelectorAll('li') || [])]
    .map((li) => li.textContent?.trim())
    .filter(Boolean);
  const visibility = (getCellText(cells[2]) || 'display').toLowerCase();
  const isHidden = visibility === 'hide';

  if (!question || !options.length) return null;

  return { question, options, isHidden };
}

/**
 * Build one disclaimer question's markup (fieldset + radio options) from
 * its authored config. Returns '' when the config is missing/hidden, so
 * the question is simply omitted from the form.
 */
function buildDisclaimerQuestionHtml(config, groupClass, fieldName, getValue = (label) => label) {
  if (!config || config.isHidden) return '';

  const optionsHtml = config.options.map((label) => {
    const value = getValue(label);
    return `
    <label class="disclaimer-radio-label" tabindex="-1">
      <input type="radio" name="${fieldName}" value="${escapeHtml(value)}" tabindex="-1" class="form-radio-input__field">
      <span tabindex="0" role="radio" class="form-radio-input__custom-element track_field_focus focus-visible-auto-imp" aria-label="${escapeHtml(label)}" aria-checked="false"></span>
      <span class="form-global__custom-label-text">${escapeHtml(label)}</span>
    </label>
  `;
  }).join('');

  return `
    <div class="${groupClass} disclaimer-group d-flex">
      <fieldset>
        <legend>
          ${escapeHtml(config.question)}
          <span class="form-global__required">*</span>
        </legend>
        <div class="radio-options-wrapper">${optionsHtml}</div>
      </fieldset>
    </div>
  `;
}

/**
 * Create BHPS-specific WhatsApp toggle + disclaimer questions markup,
 * shown instead of the default consent options when isBhpsForm is true.
 * disclaimerConfig: { questionOne, questionTwo } — each either a config
 * object from getDisclaimerQuestionConfig() or null (row 8/9 in DA).
 */
function createBhpsQuestionsWrapper(disclaimerConfig = {}) {
  const { questionOne, questionTwo } = disclaimerConfig;

  const wrapper = document.createElement('div');
  wrapper.className = 'new-questions-wrapper';

  // "Immediate" and "Within a month" are business-required to submit the
  // same merged value the backend expects, even though DA authors them as
  // two distinct option labels (a bullet list can't express "different
  // label, same value" on its own).
  const questionOneValue = (label) => {
    const normalized = label.trim().toLowerCase();
    if (normalized === 'immediate' || normalized === 'within a month') {
      return 'Immediate/Within 1 Month';
    }
    return label;
  };

  const questionOneHtml = buildDisclaimerQuestionHtml(
    questionOne,
    'disclaimer-ques-one',
    'NEW_CUSTOM_CHECKBOX_customer_response_one',
    questionOneValue,
  );
  const questionTwoHtml = buildDisclaimerQuestionHtml(
    questionTwo,
    'disclaimer-ques-two',
    'NEW_CUSTOM_CHECKBOX_customer_response_two',
  );

  wrapper.innerHTML = `
    <!-- WhatsApp Toggle -->
    <label class="form-whatsapp-consent" tabindex="-1">
      <input type="checkbox" name="CUSTOM_CHECKBOX" tabindex="-1" class="form-checkbox-input__field whatsAppConsentFormFld">
      <span tabindex="0" role="checkbox" class="form-checkbox-input__custom--check track_field_focus whatsAppCheckbox-checked focus-visible-auto-imp" aria-label="whatsapp toggle button" aria-checked="true"></span>
      <span class="form-global__custom-label-text">Get updates on WhatsApp</span>
    </label>

    <!-- New Disclaimer Questions (rows 8–9 in DA) -->
    <div class="new-disclaimer-questions">
      ${questionOneHtml}
      ${questionTwoHtml}
    </div>
  `;

  // Wire up the WhatsApp toggle: the visible control is a decorative span
  // (role="checkbox") next to a visually-hidden real checkbox input. Keep
  // both in sync and let click/keyboard (Enter/Space) toggle the state.
  const whatsappInput = wrapper.querySelector('.form-whatsapp-consent .form-checkbox-input__field');
  const whatsappCheck = wrapper.querySelector('.form-whatsapp-consent .form-checkbox-input__custom--check');

  if (whatsappInput && whatsappCheck) {
    const syncWhatsAppToggle = () => {
      const { checked } = whatsappInput;
      whatsappCheck.classList.toggle('whatsAppCheckbox-checked', checked);
      whatsappCheck.setAttribute('aria-checked', String(checked));
    };

    whatsappInput.checked = true;
    syncWhatsAppToggle();

    whatsappInput.addEventListener('change', syncWhatsAppToggle);

    whatsappCheck.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      whatsappInput.checked = !whatsappInput.checked;
      whatsappInput.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  // Clear a disclaimer group's "Field is required" error as soon as the
  // user picks an option in it (submit-time validation shows it — see
  // validateDisclaimerGroup / bindSubmitHandler).
  wrapper.querySelectorAll('.disclaimer-group .form-radio-input__field').forEach((radio) => {
    radio.addEventListener('change', () => {
      clearDisclaimerGroupError(radio.closest('.disclaimer-group'));
    });
  });

  return wrapper;
}

/**
 * Create consent / checkbox area
 */
function createConsentArea(consentConfig, disclaimerConfig, consentNoteHtml) {
  const consentArea = document.createElement('div');
  consentArea.className = 'form-consent-area d-flex flex-column';

  consentArea.innerHTML = `
    <div class="form-consent-options d-flex flex-wrap align-items-center">
      <label class="form-consent-item form-consent-item--toggle" data-consent="whatsapp">
        <input
          type="checkbox"
          class="form-consent-input whatsAppConsentFormFld"
          name="updateMeOnWhatsapp"
          value="true"
        />
        <span class="form-consent-toggle" aria-hidden="true"></span>
        <span class="form-consent-text form-consent-text-whatsapp">${consentConfig?.whatsapp?.text || 'Update me on WhatsApp'}</span>
      </label>

      <div class="form-consent-options-right">
        <label class="form-consent-item" data-consent="construction">
          <input
            type="checkbox"
            class="form-consent-input"
            name="constructionWorkGoingOn"
            value="true"
          />
          <span class="form-consent-box" aria-hidden="true"></span>
          <span class="form-consent-text">${consentConfig?.construction?.text || 'Construction work going on at my house'}</span>
        </label>

        <label class="form-consent-item" data-consent="localPainter">
          <input
            type="checkbox"
            class="form-consent-input"
            name="localPainterHired"
            value="true"
          />
          <span class="form-consent-box" aria-hidden="true"></span>
          <span class="form-consent-text">${consentConfig?.localPainter?.text || 'Local painter hired'}</span>
        </label>
      </div>
    </div>

  `;

  if (consentNoteHtml) {
    const consentNote = document.createElement('div');
    consentNote.className = 'form-consent-note';
    consentNote.innerHTML = consentNoteHtml;
    consentArea.append(consentNote);
    applyConsentLinkAttributes(consentNote);
  }

  const whatsappItem = consentArea.querySelector('[data-consent="whatsapp"]');
  const constructionItem = consentArea.querySelector('[data-consent="construction"]');
  const localPainterItem = consentArea.querySelector('[data-consent="localPainter"]');
  const rightWrapper = consentArea.querySelector('.form-consent-options-right');

  if (consentConfig?.whatsapp?.isHidden && whatsappItem) {
    whatsappItem.classList.add('d-none');
    whatsappItem.hidden = true;
  }

  if (consentConfig?.construction?.isHidden && constructionItem) {
    constructionItem.classList.add('d-none');
    constructionItem.hidden = true;
  }

  if (consentConfig?.localPainter?.isHidden && localPainterItem) {
    localPainterItem.classList.add('d-none');
    localPainterItem.hidden = true;
  }

  // Hide the right-side wrapper completely when both right consent items are hidden
  const isConstructionHidden = !!consentConfig?.construction?.isHidden;
  const isLocalPainterHidden = !!consentConfig?.localPainter?.isHidden;

  if (isConstructionHidden && isLocalPainterHidden && rightWrapper) {
    rightWrapper.classList.add('d-none');
    rightWrapper.hidden = true;
  }

  if (isBhpsForm) {
    // Hide the default WhatsApp consent + construction/local-painter options...
    if (whatsappItem) {
      whatsappItem.classList.add('d-none');
      whatsappItem.hidden = true;
      // Strip the tracking hook so buildLeadPayload's form.querySelector
      // ('.whatsAppConsentFormFld') resolves to the live BHPS toggle below
      // instead of this hidden, unused checkbox (first match wins).
      whatsappItem.querySelector('.whatsAppConsentFormFld')?.classList.remove('whatsAppConsentFormFld');
    }
    if (rightWrapper) {
      rightWrapper.classList.add('d-none');
      rightWrapper.hidden = true;
    }

    // ...and show the BHPS WhatsApp toggle + disclaimer questions instead,
    // inserted above the consent note so the note stays the last item.
    const consentNote = consentArea.querySelector('.form-consent-note');
    consentArea.insertBefore(createBhpsQuestionsWrapper(disclaimerConfig), consentNote);
  }

  return consentArea;
}

/**
 * Add a fixed +91 prefix inside the phone input without changing
 * the actual input value submitted to the backend.
 *
 * DOM after enhancement:
 * .form-field
 *   label
 *   .form-input-prefix-wrap
 *      span.form-input-prefix
 *      input.form-input
 *   .form-field-error
 *
 * This keeps the prefix visible both with placeholder and while typing.
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

/**
 * Apply field-specific attributes
 *
 * Note:
 * - Keep only one applyFieldConfig function in this file.
 * - The phone field gets a visual +91 prefix, but input value remains
 *   only the 10-digit number expected by validation/submission logic.
 */
function applyFieldConfig(input, headerCell, content, block) {
  if (!input || !headerCell) return;

  const headerLabel = headerCell.textContent.toLowerCase();

  input.placeholder = content;
  input.required = true;

  if (headerLabel.includes('phone')) {
    input.type = 'tel';
    input.id = 'enquire-mobile';
    input.name = 'ENQUIRE_MOBILE';
    input.inputMode = 'numeric';
    input.pattern = '[0-9]{10}';
    input.maxLength = 10;
    bindNumericInputFilter(input);

    const field = input.closest('.form-field');
    const isBlueForm = block.classList.contains('blue-form');
    if (isBlueForm) {
      applyPhonePrefix(field, input);
      input.classList.add('form-input--with-prefix');
    }
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
 * Create one description item inside description cell
 */
function createDescriptionItem(cell, className) {
  const item = document.createElement('div');
  item.className = className;
  item.innerHTML = cell?.innerHTML || '';
  return item;
}

/**
 * Populate description cell using row 1 col 1, 2, 3
 */
function populateDescriptionCell(cell, descriptionCells) {
  cell.textContent = '';

  const smallTitle = createDescriptionItem(descriptionCells[0], 'form-title-small');
  const largeTitle = createDescriptionItem(descriptionCells[1], 'form-title-large');
  const subtitle = createDescriptionItem(descriptionCells[2], 'form-subtitle');

  const smallText = descriptionCells[0]?.innerHTML?.trim() ? smallTitle.textContent?.trim() : '';
  const largeText = descriptionCells[1]?.innerHTML?.trim() ? largeTitle.textContent?.trim() : '';
  const resolvedFormName = smallText && largeText ? `${smallText} ${largeText}` : largeText;
  if (resolvedFormName) {
    formName = resolvedFormName;
  }

  if (descriptionCells[0]?.innerHTML?.trim()) {
    cell.appendChild(smallTitle);
  }

  if (descriptionCells[1]?.innerHTML?.trim()) {
    cell.appendChild(largeTitle);
  }

  if (descriptionCells[2]?.innerHTML?.trim()) {
    cell.appendChild(subtitle);
  }
}

/**
 * Cleanup video
 */
function cleanupVideo(video) {
  if (!video) return;
  video.pause();
  video.removeAttribute('src');
  video.load();
}

/**
 * Previously locked page scroll behind the full-screen mobile popup modal
 * (see .form.block.popup-active in form.css, <=600px) while it was open.
 * Now a deliberate no-op: the page must stay scrollable behind the
 * success/error popup on mobile even without closing it first. Kept (with
 * unlockBodyScroll) so call sites don't need to change.
 */
function lockBodyScroll() {
  // Intentionally does not lock document.body.style.overflow anymore.
}

function unlockBodyScroll() {
  document.body.style.overflow = '';
}

/**
 * Close active popup
 */
function closeActivePopup(block, overlay, video = null) {
  cleanupVideo(video);
  overlay?.remove();
  block.classList.remove('thank-you-active', 'error-active', 'popup-active');
  delete block.dataset.thankYouShown;
  delete block.dataset.errorShown;
  unlockBodyScroll();
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

function trackInterestCTA(currentCampaignId, currentFormName) {
  trackEvent('Form_thank_you_pop_up', {
    cid: currentCampaignId,
    formName: currentFormName,
  });
  pushAdobeFormEvents({
    formCampaignId: currentCampaignId,
    formName: currentFormName,
    event : 'Form_thank_you_pop_up'
  });
}

function trackExploreNowCTA(ctaLink) {
  if (!ctaLink) return;

  // eVar67 (parentTitle) must carry the real banner/form title, not a
  // fixed label. This inline form already resolves its visible heading
  // into the module-level `formName` (e.g. "Looking For Expert Guidance
  // To Design Your Dream Home?"). Fall back to the old literal if empty.
  const bannerTitle = formName || 'Form Thank you pop-up';

  trackEvent('cta_link_text', {
    cta_: 'Explore now',
    parentTitle: bannerTitle,
    param1: ctaLink,
    redirectionLink: ctaLink,
  });
  pushAdobeCtaClickEvent({
    cta_: 'Explore now',
    parentTitle: bannerTitle,
    destinationUrl: ctaLink,
    event : 'cta_link_text'
  });
}

/**
 * Create thank you overlay
 */
function createThankYouScreen(block, row) {
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
  cta.setAttribute('aria-label', THANK_YOU_CTA_LABEL);
  cta.addEventListener('click', () => {
    // Thank-you "Book FREE site visit" CTA fires custom_cta_click (event132):
    // cta_ -> eVar45, parentTitle -> eVar67 (the banner title, not the form
    // title), redirectionLink -> eVar86.
    trackEvent('custom_cta_click', {
      cta_: THANK_YOU_CTA_LABEL,
      parentTitle: THANK_YOU_BANNER_TITLE,
      redirectionLink: THANK_YOU_CTA_LINK,
    });
    pushAdobeCtaClickEvent({
      cta_: THANK_YOU_CTA_LABEL,
      parentTitle: THANK_YOU_BANNER_TITLE,
      destinationUrl: THANK_YOU_CTA_LINK,
      event : 'custom_cta_click'
    });
  });

  const ins = document.createElement('a');
  ins.className = 'intereseted-cta';
  ins.href = 'javascript:void(0)';
  ins.setAttribute('aria-label', 'Yes I am Interseted');
  ins.addEventListener('click', () => {
    trackInterestCTA(bhInterestedCampaignId, formName);
    //Added chnages for form submission on click of interested CTA and BHPS campaignID need to pass
    submitLeadFromForm(row, {
      resourcePath: row.getAttribute('data-attr-resourcePath') || formNodePath || window.location.pathname || '',
      campaignId: bhInterestedCampaignId});
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
    closeActivePopup(block, overlay, video);
  });

  overlay.append(closeBtn, video, cta, ins);

  return overlay;
}

/**
 * Create error overlay
 */
function createErrorScreen(block) {
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
    closeActivePopup(block, overlay);
  });

  return overlay;
}

/**
 * Show thank you overlay
 */
function showThankYouScreen(block, row) {
  if (!block || block.dataset.thankYouShown === 'true') return;

  const existingOverlay = block.querySelector('.form-popup-overlay--success');
  if (existingOverlay) {
    block.dataset.thankYouShown = 'true';
    block.classList.add('thank-you-active', 'popup-active');
    lockBodyScroll();
    return;
  }

  const overlay = createThankYouScreen(block, row);
  block.appendChild(overlay);
  block.dataset.thankYouShown = 'true';
  block.classList.add('thank-you-active', 'popup-active');
  lockBodyScroll();
}

/**
 * Resolve a disclaimer question's answer for analytics (eVar73/eVar110):
 * the checked radio's original authored label (e.g. "Immediate",
 * "Within a month", "After 1 month") via its custom-element aria-label,
 * NOT its `value` attribute — questionOneValue() collapses "Immediate"
 * and "Within a month" into one merged backend value ("Immediate/Within
 * 1 Month"), which would otherwise hide which option was actually picked.
 * Falls back to the legacy plain checkbox (non-BHPS forms) when the
 * radio group isn't present.
 */
function getDisclaimerAnswer(form, radioName, checkboxName) {
  const checkedRadio = form.querySelector(`[name="${radioName}"]:checked`);
  if (checkedRadio) {
    const labelSpan = checkedRadio.closest('.disclaimer-radio-label')
      ?.querySelector('.form-radio-input__custom-element');
    return labelSpan?.getAttribute('aria-label') || checkedRadio.value;
  }

  const checkbox = form.querySelector(`[name="${checkboxName}"]`);
  return checkbox ? (checkbox.checked ? 'Yes' : 'No') : 'No';
}

function trackFormSubmission(form) {
  // BHPS forms (isBhpsForm, the default) render the WhatsApp toggle as
  // .whatsAppConsentFormFld rather than [name="updateMeOnWhatsapp"] — see
  // createConsentArea(), which strips that class off the hidden default
  // checkbox and moves it onto the live BHPS input so this selector
  // always resolves to whichever toggle is actually visible.
  const isWhatsappChecked = form.querySelector('.whatsAppConsentFormFld')?.checked;
  const contruction = getDisclaimerAnswer(form, 'NEW_CUSTOM_CHECKBOX_customer_response_one', 'constructionWorkGoingOn');
  const localpainter = getDisclaimerAnswer(form, 'NEW_CUSTOM_CHECKBOX_customer_response_two', 'localPainterHired');
  const formData = {
    "formName": formName,
    "campaignId": campaignId,
    // Send explicit 'unchecked' (not undefined) so eVar108 always reflects the
    // real opt-in state on the beacon instead of being dropped by trackEvent's
    // undefined-filter. QA relies on the presence of the value for reporting.
    "whatsappOptIn": isWhatsappChecked ? 'checked' : 'unchecked',
    "contruction": contruction,
    "localpainter": localpainter,
    // Spec field — see lead-form.js for rationale. Default 'both'.
    "dataDestination": form.dataset?.dataDestination || 'both'
  };
  getDigitalData().form = formData;
  trackEvent("Form Submit", {
    formName,
    campaignId,
    ...formData,
  });
  pushAdobeFormEvents({
    formCampaignId: campaignId,
    formName: formName,
    event : 'form_submit',
    whatsappOptIn: isWhatsappChecked ? 'checked' : 'unchecked',
    construction: contruction,
    language: 'en',
    localPainter: localpainter,
    dataDestination: form.dataset?.dataDestination || 'both'
  });
  // Mirror to marketing pixels via image beacons — no SDK library load
  firePixelConversion('form_submit', {
    event_category: formName,
    value: 1,
    currency: 'INR',
  });
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
    lockBodyScroll();
    return;
  }

  const overlay = createErrorScreen(block);
  block.appendChild(overlay);
  block.dataset.errorShown = 'true';
  block.classList.add('error-active', 'popup-active');
  lockBodyScroll();
}

/**
 * Bind submit handler
 */
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

    const fieldNameMap = {
      ENQUIRE_NAME: 'Name',
      ENQUIRE_EMAIL: 'Email',
      ENQUIRE_MOBILE: 'MobileNumber',
      ENQUIRE_PINCODE: 'PINCode',
    };

    inputs.forEach((input) => {
      const validField = validateInputField(input, true);
      if (!validField) {
        isValid = false;
        const label = fieldNameMap[input.name] || input.name || input.id || input.getAttribute('aria-label') || 'unknown';
        failedFields.push(label);
      }
    });

    // BHPS form: each disclaimer question (radio group) is required too.
    row.querySelectorAll('.disclaimer-group').forEach((group) => {
      const validGroup = validateDisclaimerGroup(group, true);
      if (!validGroup) {
        isValid = false;
        const label = group.querySelector('legend')?.firstChild?.textContent?.trim() || 'disclaimer question';
        failedFields.push(label);
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
        showThankYouScreen(block, row);
        trackFormSubmission(row);
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('Default form submission failed', err);
        showErrorScreen(block);
      })
      .finally(() => {
        row.dataset.submitting = 'false';
        submitBtn.disabled = false;
        loaderEl?.classList.add('d-none');
      });
  });
}

/**
 * Render form block
 */
function renderForm(block) {
  extractFormConfig(block);

  const rows = [...block.children];
  if (rows.length < 3) return;

  const descriptionRow = rows[0];
  const labelsRow = rows[1];
  const inputsRow = rows[2];

  if (!descriptionRow || !labelsRow || !inputsRow) return;

  const descriptionCells = [...descriptionRow.children];
  const labelCells = [...labelsRow.children];
  const inputCellsSource = [...inputsRow.children];

  // Row 5, col 1 — form-consent-note rich text (replaces the hardcoded
  // default), and hide the row.
  const consentNoteHtml = extractConsentNoteHtml(rows[4]);
  if (rows[4]) rows[4].style.display = 'none';

  // Row 6 (col 2) — sets the module-level isBhpsForm flag.
  extractIsBhpsForm(rows[5]);

  // Consent rows now come from authoring. Row 6 (the isBhpsForm flag,
  // handled above) sits between the whatsapp row and the construction/
  // local-painter rows, so this is no longer a contiguous slice.
  const consentRows = [rows[3], rows[6], rows[7]];
  const consentConfig = getConsentConfig(consentRows);

  // Rows 9–10: BHPS disclaimer questions (question text, bullet-list of
  // radio options, display/hide) — only meaningful when isBhpsForm is
  // true, but harmless to read/hide otherwise.
  const disclaimerConfig = {
    questionOne: getDisclaimerQuestionConfig(rows[8]),
    questionTwo: getDisclaimerQuestionConfig(rows[9]),
  };
  [rows[8], rows[9]].forEach((row) => {
    if (row) row.style.display = 'none';
  });

  // Extract error images from row 11
  if (rows.length >= 11) {
    const errorImagesRow = rows[10];
    const errorImagesCells = [...errorImagesRow.children];

    const desktopImgEl = errorImagesCells[0]?.querySelector('img');
    const desktopLinkEl = errorImagesCells[0]?.querySelector('a');
    const desktopErrorImage = desktopImgEl?.src || desktopLinkEl?.href || errorImagesCells[0]?.textContent?.trim();

    if (desktopErrorImage) {
      ERROR_DESKTOP_IMAGE = desktopErrorImage;
    }

    const mobileImgEl = errorImagesCells[1]?.querySelector('img');
    const mobileLinkEl = errorImagesCells[1]?.querySelector('a');
    const mobileErrorImage = mobileImgEl?.src || mobileLinkEl?.href || errorImagesCells[1]?.textContent?.trim();

    if (mobileErrorImage) {
      ERROR_MOBILE_IMAGE = mobileErrorImage;
    }

    errorImagesRow.style.display = 'none';
  }

  // Rows 12–20: error popup CTA/download links, thank-you (variant 2) images,
  // thank-you CTA label/banner title, and thank-you videos/CTA link
  extractFormExtraLinks(rows);

  descriptionRow.style.display = 'none';
  labelsRow.style.display = 'none';
  inputsRow.style.display = 'none';

  consentRows.forEach((row) => {
    if (row) row.style.display = 'none';
  });

  const formRow = document.createElement('div');
  formRow.className = 'form-row form-attributes';
  formRow.setAttribute('data-attr-resourcePath', formNodePath || window.location.pathname || '');

  const descriptionCell = document.createElement('div');
  descriptionCell.className = 'form-description-cell';
  populateDescriptionCell(descriptionCell, descriptionCells);

  const fieldsArea = document.createElement('div');
  fieldsArea.className = 'form-fields-area d-flex flex-column';

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

    if (input && labelCell) {
      applyFieldConfig(input, labelCell, content, block);
    }

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
      <span class="form-submit__arrow" aria-hidden="true"></span>
      <span class="rotating d-none" aria-hidden="true">↻</span>
    `;
    buttonCell.appendChild(button);
  }

  if (!inputsGrid.children.length) return;

  fieldsArea.appendChild(inputsGrid);

  const consentArea = createConsentArea(consentConfig, disclaimerConfig, consentNoteHtml);
  fieldsArea.appendChild(consentArea);

  // Check WhatsApp by default only if the field is visible
  const whatsappCheckbox = consentArea.querySelector('[name="updateMeOnWhatsapp"]');
  const whatsappWrapper = whatsappCheckbox?.closest('.form-consent-item');
  if (whatsappCheckbox && whatsappWrapper && !whatsappWrapper.classList.contains('d-none')) {
    whatsappCheckbox.checked = true;
    whatsappCheckbox.classList.toggle('whatsAppCheckbox-checked');
  }

  if (buttonCell.children.length) {
    fieldsArea.appendChild(buttonCell);
  }

  // BHPS form: the consent note lives inside .form-consent-area while the
  // submit button is a separate sibling, so they stack on their own lines
  // by default. Pull the note out and pair it with the button in a shared
  // row so they can sit side by side on desktop (see .form-bhps-footer).
  if (isBhpsForm) {
    const consentNote = consentArea.querySelector('.form-consent-note');
    if (consentNote && buttonCell.children.length) {
      const footerRow = document.createElement('div');
      footerRow.className = 'form-bhps-footer';
      fieldsArea.insertBefore(footerRow, buttonCell);
      footerRow.appendChild(consentNote);
      footerRow.appendChild(buttonCell);
    }
  }

  formRow.appendChild(descriptionCell);
  formRow.appendChild(fieldsArea);

  formRow.addEventListener('focusin', function (e) {
    if (!formStarted && e.target.tagName === 'INPUT') {
      formStarted = true;
      trackEvent("Form start", {
        "formName": formName,
        "campaignId": campaignId
      });
      pushAdobeFormEvents({
        formCampaignId: campaignId,
        formName: formName,
        event : 'form_start'
      });
      // Mirror to marketing pixels via image beacons — no SDK library load
      firePixelConversion('form_start', {
        event_category: formName,
        campaign: campaignId,
      });
    }
  });

  // Spec: form_start must fire when the user clicks ANYWHERE on the form
  // to start (not only when an input gains focus). Guarded by the same
  // formStarted flag so it never double-fires with the focusin handler.
  formRow.addEventListener('click', function () {
    if (!formStarted) {
      formStarted = true;
      trackEvent("Form start", {
        "formName": formName,
        "campaignId": campaignId
      });
      pushAdobeFormEvents({
        formCampaignId: campaignId,
        formName: formName,
        event : 'Form start'
      });
      // Mirror to marketing pixels via image beacons — no SDK library load
      firePixelConversion('form_start', {
        event_category: formName,
        campaign: campaignId,
      });
    }
  });

  block.appendChild(formRow);

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
}

export default function decorate(block) {
  applyBootstrapHelpers(block);
  renderForm(block);
}