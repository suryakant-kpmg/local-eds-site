import { loadFragment } from '../fragment/fragment.js';
import {
  buildBlock, decorateBlock, loadBlock, loadCSS,
} from '../../scripts/aem.js';
import { getCookieValues } from '../../scripts/form-submit-common.js';
import { trackEvent } from '../../scripts/analytics_1.js';
/*
  This is not a traditional block, so there is no decorate function.
  Instead, links to a /modals/ path are automatically transformed into a modal.
  Other blocks can also use the createModal() and openModal() functions.
*/

export async function createModal(contentNodes) {
  await loadCSS(`${window.hlx.codeBasePath}/blocks/modal/modal.css`);
  const dialog = document.createElement('dialog');
  const dialogContent = document.createElement('div');
  dialogContent.classList.add('modal-content');
  dialogContent.append(...contentNodes);

  const isBookFreeSiteVisitModal = dialogContent.querySelector(
    '.book-free-site-visit-modal, .book-free-site-visit-form'
  );

  const exitIntentButtonText = document
    .querySelector('main [data-exit-intent-form-button-text]')
    ?.dataset
    .exitIntentFormButtonText
    ?.trim();

  const exitIntentCallUsTitle = document
    .querySelector('main [data-exit-intent-form-callus-title]')
    ?.dataset
    .exitIntentFormCallusTitle
    ?.trim();

  // Same section-metadata convention/default as isBhpsForm() in
  // lead-form.js — defaults to true unless the authored row is
  // explicitly "false".
  const isBhpsForm = (document
    .querySelector('main [data-exit-intent-form-isbhps]')
    ?.dataset
    .exitIntentFormIsbhps
    ?.trim()
    .toLowerCase()) !== 'false';

  const updateExitIntentSubmitText = () => {
    if (!isBookFreeSiteVisitModal || !exitIntentButtonText) return false;
    const submitButton = dialogContent.querySelector(
      '.book-free-site-visit-modal button[type="submit"], .book-free-site-visit-form button[type="submit"], .lead-form-fields.submit-wrapper button[type="submit"]'
    );
    if (!submitButton) return false;
    submitButton.textContent = exitIntentButtonText;
    submitButton.setAttribute('data-original-text', exitIntentButtonText);
    return true;
  };

  // exitintent title change
  const updateExitIntentCallUsContent = () => {
    if (!isBookFreeSiteVisitModal) return false;

    const callUsText = dialogContent.querySelector(
      '.lead-form-container .default-content-wrapper p'
    );

    if (!callUsText) return false;

    // Avoid updating same paragraph again
    if (callUsText.dataset.exitPopupCallUsUpdated === 'true') return true;

    const existingText = callUsText.textContent.trim();

    const phoneMatch = existingText.match(/\b\d{4}[-\s]?\d{3}[-\s]?\d{4}\b/);
    const displayPhone = phoneMatch?.[0] || '1800-209-5678';
    const telPhone = displayPhone.replace(/[^\d+]/g, '');

    const defaultCallUsTitle = phoneMatch
      ? existingText.replace(phoneMatch[0], '').trim()
      : 'Call us for Painting Services';

    const titleText = exitIntentCallUsTitle || defaultCallUsTitle;
    const titleSpan = document.createElement('span');
    titleSpan.classList.add('title');
    titleSpan.textContent = titleText;

    const iconWrapper = document.createElement('span');
    iconWrapper.classList.add('exit-popup-call-us--title--icon');

    const phoneLink = document.createElement('a');
    phoneLink.setAttribute('tabindex', '0');
    phoneLink.href = `tel:${telPhone}`;

    let phoneIcon;
    if (isBhpsForm) {
      phoneIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      phoneIcon.setAttribute('width', '14');
      phoneIcon.setAttribute('height', '14');
      phoneIcon.setAttribute('viewBox', '0 0 14 14');
      phoneIcon.setAttribute('fill', 'none');
      phoneIcon.classList.add('call-img');
      phoneIcon.innerHTML = '<path d="M12.3888 11.1937C12.3888 11.1937 11.6164 11.9524 11.4271 12.1748C11.1187 12.5039 10.7554 12.6593 10.2791 12.6593C10.2333 12.6593 10.1845 12.6593 10.1387 12.6562C9.23189 12.5983 8.38923 12.2449 7.75723 11.9432C6.02916 11.1084 4.51175 9.92314 3.25081 8.42102C2.20969 7.16875 1.51358 6.01093 1.05255 4.7678C0.768613 4.00912 0.664806 3.41802 0.710603 2.86044C0.741134 2.50396 0.878525 2.20841 1.13194 1.95552L2.17305 0.916525C2.32266 0.776368 2.48142 0.700195 2.63713 0.700195C2.82948 0.700195 2.98519 0.815977 3.08289 0.913478C3.08594 0.916525 3.08899 0.919572 3.09205 0.922619C3.27829 1.09629 3.45537 1.27606 3.64161 1.46801C3.73626 1.56551 3.83396 1.66301 3.93166 1.76356L4.76516 2.59536C5.08879 2.91833 5.08879 3.21693 4.76516 3.5399C4.67662 3.62826 4.59113 3.71662 4.50259 3.80193C4.24613 4.06397 4.4476 3.86291 4.18197 4.10057C4.17587 4.10666 4.16976 4.10971 4.16671 4.1158C3.90414 4.37784 3.95299 4.63377 4.00794 4.80745C4.011 4.81659 4.01405 4.82573 4.0171 4.83487C4.23388 5.35893 4.53919 5.85253 5.00327 6.44058L5.00632 6.44363C5.84898 7.47957 6.73745 8.287 7.7175 8.90552C7.84268 8.98474 7.97091 9.04872 8.09304 9.10966C8.20295 9.1645 8.30675 9.2163 8.3953 9.27115C8.40751 9.27724 8.41972 9.28638 8.43193 9.29247C8.53574 9.34427 8.63344 9.36865 8.73419 9.36865C8.9876 9.36865 9.14637 9.21021 9.19827 9.15841L9.79672 8.56118C9.90053 8.45759 10.0654 8.33266 10.2577 8.33266C10.447 8.33266 10.6028 8.45149 10.6974 8.55509C10.7005 8.55813 10.7005 8.55813 10.7035 8.56118L12.3858 10.24C12.7003 10.5508 12.3888 11.1937 12.3888 11.1937Z" stroke="#2BA45B" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>';
    } else {
      phoneIcon = document.createElement('img');
      phoneIcon.classList.add('call-img');
      phoneIcon.loading = 'lazy';
      phoneIcon.src = '//static.asianpaints.com/content/dam/whatsapp/whatsapp-animated-icon.gif';
      phoneIcon.width = 38;
      phoneIcon.height = 38;
      phoneIcon.alt = 'To paint your home, please give us a call at';
      phoneIcon.title = 'phone-call-desktop';
    }

    const phoneNumber = document.createElement('span');
    phoneNumber.classList.add('mob-num');
    phoneNumber.textContent = displayPhone;

    phoneLink.append(phoneIcon, phoneNumber);
    iconWrapper.append(phoneLink);

    callUsText.replaceChildren(titleSpan, iconWrapper);
    callUsText.dataset.exitPopupCallUsUpdated = 'true';

    return true;
  };

  const isValidCookieValue = (value) => (
    value
    && value !== ''
    && value !== 'undefined'
    && value !== 'null'
  );

  const setLeadFieldValue = (container, selector, value) => {
    if (!isValidCookieValue(value)) return false;

    const field = container.querySelector(selector);

    if (!field) return false;

    field.value = value;

    field.parentElement?.classList.add('focussed');

    field.closest(
      '.field-wrapper, .input-wrapper, .form-field, .lead-form-fields'
    )?.classList.add('focussed');

    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
    field.dispatchEvent(new Event('blur', { bubbles: true }));

    return true;
  };

  const prefillBookFreeSiteVisitCookies = () => {
    if (!isBookFreeSiteVisitModal) return true;

    const cachedFieldVal = getCookieValues('CCFormFields');

    if (!cachedFieldVal) return true;

    const cachedValues = cachedFieldVal.split('|');

    const leadForm = dialogContent.querySelector(
      '.book-free-site-visit-form, .book-free-site-visit-modal, .lead-form-container'
    );

    if (!leadForm) return false;

    if (leadForm.dataset.cookiePrefilled === 'true') return true;

    const hasLeadFields = leadForm.querySelector(
      '#lead-name-1, #lead-email-2, #lead-mobile-3, #lead-pincode-4'
    );

    if (!hasLeadFields) return false;

    setLeadFieldValue(leadForm, '#lead-name-1', cachedValues[0]);
    setLeadFieldValue(leadForm, '#lead-email-2', cachedValues[1]);
    setLeadFieldValue(leadForm, '#lead-mobile-3', cachedValues[2]);
    setLeadFieldValue(leadForm, '#lead-pincode-4', cachedValues[3]);

    leadForm.dataset.cookiePrefilled = 'true';

    return true;
  };

  const prefillLeadFormFromCookies = () => {
    if (!isBookFreeSiteVisitModal) return true;

    const cachedFieldVal = getCookieValues('CCFormFields');

    // No cookie available, so no need to wait for fields
    if (!cachedFieldVal) return true;

    const leadFormContainer = dialogContent.querySelector(
      '.lead-form-container, .book-free-site-visit-form, .book-free-site-visit-modal'
    );

    if (!leadFormContainer) return false;

    const hasCookieFields = leadFormContainer.querySelector(
      '#enquire-name, #enquire-email, #enquire-mobile, #enquire-pincode'
    );

    if (!hasCookieFields) return false;

    // Avoid running again and again
    if (leadFormContainer.dataset.cookiePrefilled === 'true') return true;

    checkCookieValues(leadFormContainer);

    // Trigger validations / floating label logic / CTA enable-disable logic
    leadFormContainer
      .querySelectorAll('#enquire-name, #enquire-email, #enquire-mobile, #enquire-pincode')
      .forEach((field) => {
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
        field.dispatchEvent(new Event('blur', { bubbles: true }));
      });

    leadFormContainer.dataset.cookiePrefilled = 'true';

    return true;
  };

  let modalContentObserver;

  if (isBookFreeSiteVisitModal) {
    dialog.classList.add('book-free-site-visit-dialog');

    const applyBookFreeSiteVisitUpdates = () => {
      const buttonUpdated = !exitIntentButtonText || updateExitIntentSubmitText();
      const callUsUpdated = updateExitIntentCallUsContent();
      const cookiesPrefilled = prefillBookFreeSiteVisitCookies();

      return buttonUpdated && callUsUpdated && cookiesPrefilled;
    };

    // Try immediately
    if (!applyBookFreeSiteVisitUpdates()) {
      // If form/content loads later, observe modal content
      modalContentObserver = new MutationObserver(() => {
        if (applyBookFreeSiteVisitUpdates()) {
          modalContentObserver.disconnect();
        }
      });

      modalContentObserver.observe(dialogContent, {
        childList: true,
        subtree: true,
      });
    }
  }

  dialog.append(dialogContent);
  window.activeModalElement = dialog;

  const closeButton = document.createElement('button');
  closeButton.classList.add('close-button');
  closeButton.setAttribute('aria-label', 'Close');
  closeButton.type = 'button';
  closeButton.innerHTML = '<span class="icon icon-close"></span>';
  closeButton.addEventListener('click', () => dialog.close());
  dialogContent.prepend(closeButton);

  const block = buildBlock('modal', '');
  document.querySelector('main').append(block);
  decorateBlock(block);
  await loadBlock(block);

  dialog.addEventListener('click', (e) => {
    const {
      left, right, top, bottom,
    } = dialog.getBoundingClientRect();
    const { clientX, clientY } = e;
    if (clientX < left || clientX > right || clientY < top || clientY > bottom) {
      dialog.close();
    }
  });

  dialog.addEventListener('close', () => {
    // e277 - Exit Intent Popup Close (only when this is the exit-intent modal)
    if (isBookFreeSiteVisitModal) {
      trackEvent('Exit Intent Popup Close');
    }

    document.body.classList.remove('eds-modal-open');
    block.classList.remove('modal-open');
    window.activeModalElement = null;

    if (modalContentObserver) {
      modalContentObserver.disconnect();
    }

    block.remove();
  });

  block.innerHTML = '';
  block.append(dialog);
  block.addEventListener('click', (e) => {
    if (e.target === block) {
      dialog.close();
    }
  });

  return {
    block,
    showModal: (options = {}) => {
      // Apply again when modal opens, in case button text got reset
      if (isBookFreeSiteVisitModal) {
        updateExitIntentSubmitText();
        updateExitIntentCallUsContent();
        prefillLeadFormFromCookies();
        // e359 - Exit Intent pop-up impression. Only fire when the modal
        // is opened by a GENUINE exit-intent trigger. When the same modal
        // is opened via a CTA (e.g. the sticky "Book Free Site Visit"
        // button, which already fires sticky_cta_click / event278), this
        // impression must NOT fire — otherwise the click produces two
        // events. The caller signals intent via trackExitIntentImpression.
        if (options.trackExitIntentImpression) {
          trackEvent('Exit Intent Pop-up Impression');
        }
      }

      dialog.show();
      block.classList.add('modal-open');
      setTimeout(() => {
        block.scrollTop = 0;
        if (isBookFreeSiteVisitModal) {
          prefillLeadFormFromCookies();
        }
      }, 0);
      document.body.classList.add('eds-modal-open');
    },
  };
}

export async function openModal(fragmentUrl, options = {}) {
  const path = fragmentUrl.startsWith('http')
    ? new URL(fragmentUrl, window.location).pathname
    : fragmentUrl;

  const fragment = await loadFragment(path);
  const { showModal } = await createModal(fragment.childNodes);
  showModal(options);
}
