import {
  readBlockConfig,
  toCamelCase,
  toClassName,
} from '../../scripts/aem.js';
import { AesUtil } from '../../scripts/aesUtil.module.js';
import { getDigitalData, trackEvent, trackFormError, pushAdobeCtaClickEvent, pushAdobeFormEvents } from '../../scripts/analytics_1.js';

function getAmsBase() {
  if (typeof window === 'undefined') return 'https://beta.asianpaints.com';

  const host = window.location.hostname;
  if (host === 'beta.asianpaints.com') return 'https://beta.asianpaints.com';
  if (host === 'www.asianpaints.com') return 'https://www.asianpaints.com';

  return 'https://beta.asianpaints.com';
}

const AMS_BASE = getAmsBase();

function htmlToEl(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function getUtmParams() {
  const p = new URLSearchParams(window.location.search);
  return {
    source: p.get('utm_source') || '',
    medium: p.get('utm_medium') || '',
    utmContent: p.get('utm_content') || '',
    utmId: p.get('utm_id') || '',
    campaignId: p.get('utm_campaign') || '',
    utmAdgroupName: p.get('UTM_Adgroup_Name') || '',
    utmKeyword: p.get('UTM_Keyword') || '',
    utmKeywordMatchType: p.get('UTM_Keyword_match_type') || '',
    utmCampaignSource: p.get('UTM_Campaign_Source') || '',
  };
}

export function getVisitorId() {
  // Read MCMID directly from the AMCV cookie set by Alloy (was:
  // _satellite.getVisitorId() — no longer available after Launch removal).
  const m = document.cookie.match(/MCMID(?:%7C|\|)(\d+)/);
  return m ? m[1] : '';
}

function getGaIdFromCookie() {
  let gaId = (document.cookie.match(/(?:^|;\s*)_ga=([^;]+)/) || [])[1] || '';
  if (gaId) {
    gaId = decodeURIComponent(gaId).replace(/^GA\d+\.\d+\./, "");
  }
  return gaId;
}

export function getCampaignIdFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  return (urlParams.get('utm_campaign') || '').trim();
}

function limitDigits(input, maxLen) {
  const digits = (input.value || '').replace(/[^\d]/g, '');
  input.value = digits.slice(0, maxLen);
}

function isMobileValid(v) {
  return /^[0-9]{10}$/.test((v || '').trim());
}

function isPincodeValid(v) {
  return /^[0-9]{6}$/.test((v || '').trim());
}

function setError(fieldWrap, msg) {
  const err = fieldWrap.querySelector('.error-msg');
  if (err) {
    err.textContent = msg || '';
    err.classList.toggle('d-none', !msg);
  }
  fieldWrap.classList.toggle('has-error', !!msg);
}

function setLabelTop(fieldWrap, top) {
  const label = fieldWrap.querySelector('.input-label');
  if (!label) return;
  if (top) {
    label.classList.add('top');
    label.classList.remove('d-none');
  } else {
    label.classList.remove('top');
    label.classList.add('d-none');
  }
}

async function postFormUrlEncoded(url, data) {
  const body = new URLSearchParams();
  Object.entries(data).forEach(([k, v]) => body.append(k, v ?? ''));
  const res = await fetch(url, {
    method: 'POST',
    mode: 'cors',
    credentials: 'omit',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      Accept: '*/*',
    },
    body,
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function buildMarkup(cfg) {
  const thankyouCta = (cfg.exploreCtaLink && cfg.exploreCtaLabel)
    ? `
      <div class="cta animated-btn-yellow-onhover-black round-corner-radius-button">
        <a href="${cfg.exploreCtaLink}" class="animated-arrow-button explore-painting-btn" target="_self"
          aria-label="${cfg.exploreCtaLabel}">
          ${cfg.exploreCtaLabel}<span class="arrow"></span>
        </a>
      </div>`
    : '';

  return `
    <div class="miniform hero-miniform">
      <div class="find-contractor-form-container ${cfg.alignment || ''} track_field_focus"
        data-attr-respath="${cfg.node || ' '}"
        data-attr-campaignId="${cfg.campaignId || ''}"
        data-attr-emptyFieldError="${cfg.emptyFieldErrorMessage || 'Field is required'}"
        data-attr-mobileError="${cfg.mobileNumberErrorMessage || 'Phone number is invalid'}"
        data-attr-pincodeError="${cfg.pincodeErrorMessage || 'Enter a valid 6 digit Zip Code'}"
        data-attr-redirection="${cfg.redirectionUrl || ''}">
        <div class="title-section">
          ${cfg.formTitle || '<p>Let our experts help you!</p>'}
        </div>
        <form class="hero-form-contact" novalidate>
          <div class="mobile-input-section">
            <label class="input-label d-none" for="mobile-number">Mobile Number*</label>
            <input type="tel" inputmode="numeric" autocomplete="tel"
              name="mobile-number" id="mobile-number" placeholder="Enter mobile number" />
            <div class="error-msg d-none"></div>
          </div>
          <div class="pincode-input-section">
            <label class="input-label d-none" for="pincode">Pincode*</label>
            <input type="tel" inputmode="numeric" autocomplete="postal-code"
              name="pincode" id="pincode" placeholder="Enter pincode" />
            <div class="error-msg d-none"></div>
          </div>
          <div class="whatsapp-update-consent-section">
            <input type="checkbox" id="whatsapp-consent-input" name="whatsapp-consent-input" checked />
            <label class="whatsapp-consent-label" for="whatsapp-consent-input">
              ${cfg.whatsappConsentText || 'Update me on WhatsApp'}
            </label>
            <span class="whatsapp-consent-checkmark" tabindex="0" role="checkbox"
              aria-label="${cfg.whatsappConsentText || 'Update me on WhatsApp'}"></span>
          </div>
          <div class="disclaimer-section">
            ${cfg.disclaimerHtml || ''}
          </div>
          <div class="cta animated-btn-yellow-onhover-black round-corner-radius-button">
            <button type="submit" class="get-contractors-button hero-form-submit animated-arrow-button">
              ${cfg.ctaLabel || 'Get recommended contractor'}
              <span class="arrow"></span>
              <span class="rotating js-rotatingLeadForm get-contractor-progress-status d-none">↻</span>
            </button>
          </div>
        </form>
      </div>

      <div class="mf-thankyou-revamp-container" style="display:none">
        <div class="mf__dismissible-container--head" role="button" tabindex="0" aria-label="Close">
          <img loading="lazy" id="mf-close-icon" src="https://www.asianpaints.com/etc.clientlibs/apcolourcatalogue/clientlibs/clientlib-global/resources/images/cross-icon.svg" alt="closeIcon"/>
        </div>
        <div class="row no-gutters mf-revamp-thankyou">
          <div class="mf-revamp-thankyou-left">
            <div class="mf-thank-you-left-content" style="display:block">
              <h2>${cfg.thankYouLeftSuccessHeading || ''}</h2>
              <p>${cfg.thankYouLeftSuccessDescription || ''}</p>
            </div>
            <div class="mf-error-left-content" style="display:none">
              <h2>${cfg.thankYouLeftErrorHeading || ''}</h2>
              <p>${cfg.thankYouLeftErrorDescription || ''}</p>
            </div>
          </div>
          <div class="mf-revamp-thankyou-right">
            <picture class="thankyou-bg-picture">
              <source media="(min-width: 992px)" srcset="${cfg.thankYouBgDesktop || ''}">
              <img src="${cfg.thankYouBgMobile || cfg.thankYouBgDesktop || ''}" alt="Thank You Background" class="thankyou-bg-img">
            </picture>
            <div class="mf-thank-you-message" style="display:block">
              <div class="mf-thank-you-message-title">${cfg.thankYouRightHeading || ''}</div>
              <div class="mf-thank-you-message-subtitle">${cfg.thankYouRightSubHeadingOne || ''}</div>
              <div class="mf-thank-you-message-subtitle">${cfg.thankYouRightSubHeadingTwo || ''}</div>
              ${thankyouCta}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function buildBasePayload() {
  return {
    pageUrl: window.location.href,
    node: '',
    landMark: '',
    thirdAddress: '',
    buildingName: '',
    houseNo: '',
    organizationName: '',
    segment: '',
    street: '',
    designation: '',
    secondAddress: '',
    state: '',
    remarks: '',
    projectType: '',
    lName: '',
    city: '',
    phoneNo: '',
    pinCode: '',
    email: '',
    firstAddress: '',
    floorNo: '',
    salutations: '',
    mobileNo: '',
    fName: '',
    skuChosen: '',
    measurementNeeded: '',
    dealerName: '',
    dealerCode: '',
    answer: '',
    sampleFinish: '',
    datePicker: '',
    customField: '',
    visitorId: '',
    gaId: '',
    description: '',
    whatsAppConsent: '',
    source: '',
    medium: '',
    utmContent: '',
    utmId: '',
    campaignId: '',
    imageUrl: '',
    referrerId: '',
    marketingChannel: '',
    rowId: '',
    utmAdgroupName: '',
    utmKeyword: '',
    utmKeywordMatchType: '',
    utmCampaignSource: '',
  };
}

function getTextFromHtml(html = '') {
  const temp = document.createElement('div');
  temp.innerHTML = html;
  return temp.textContent?.trim() || '';
}

function trackFormSubmission(formName, campaignId, whatsappOptIn, extraData = {}) {
  const formData = {
    formName,
    campaignId,
    // Send explicit 'unchecked' (not undefined) so eVar108 always reflects the
    // real opt-in state on the beacon instead of being dropped by trackEvent's
    // undefined-filter. QA relies on the presence of the value for reporting.
    whatsappOptIn: whatsappOptIn ? 'checked' : 'unchecked',
    dataDestination: extraData.dataDestination || 'both',
    contruction: extraData.contruction || '',
    localpainter: extraData.localpainter || '',
  };

  getDigitalData().form = formData;
  trackEvent('Form Submit', formData);
  pushAdobeFormEvents({
    event: 'form_submit',
    formName,
    formCampaignId: campaignId,
    whatsappOptIn: whatsappOptIn ? 'checked' : 'unchecked',
    dataDestination: extraData.dataDestination || 'both',
    contruction: extraData.contruction || '',
    localpainter: extraData.localpainter || '',
  });
}

export default function decorate(block) {
  const config = readBlockConfig(block);
  const ds = block.dataset;

  // Normalize config keys to camelCase and merge with dataset
  const cfg = {};
  Object.keys(config).forEach((key) => {
    cfg[toCamelCase(key)] = config[key];
  });

  // Special handling for RichText fields to preserve HTML
  const richTextFields = [
    'formTitle', 'disclaimerHtml', 'thankYouRightHeading',
    'thankYouRightSubHeadingOne', 'thankYouRightSubHeadingTwo',
    'thankYouRightHeadingSubOne',
  ];
  block.querySelectorAll(':scope > div').forEach((row) => {
    const name = toCamelCase(toClassName(row.children[0]?.textContent));
    if (richTextFields.includes(name)) {
      cfg[name] = row.children[1]?.innerHTML;
    }
    // Better image extraction: check for <img> first, then fallback to text
    if (['heroBgDesktop', 'heroBgMobile', 'thankYouBgDesktop', 'thankYouBgMobile', 'thankYouBackgroundDesktop', 'thankYouBackgroundMobile', 'heroBackgroundDesktop', 'heroBackgroundMobile'].includes(name)) {
      const img = row.children[1]?.querySelector('img');
      if (img) {
        cfg[name] = img.src;
      } else {
        const text = row.children[1]?.textContent?.trim();
        if (text) cfg[name] = text;
      }
    }
  });

  // Normalize specific long labels to standard keys
  if (cfg.thankYouBackgroundDesktop) cfg.thankYouBgDesktop = cfg.thankYouBackgroundDesktop;
  if (cfg.thankYouBackgroundMobile) cfg.thankYouBgMobile = cfg.thankYouBackgroundMobile;
  if (cfg.heroBackgroundDesktop) cfg.heroBgDesktop = cfg.heroBackgroundDesktop;
  if (cfg.heroBackgroundMobile) cfg.heroBgMobile = cfg.heroBackgroundMobile;

  // Mapping for subtitle variant labels
  if (cfg.thankYouRightHeadingSubOne) {
    cfg.thankYouRightSubHeadingOne = cfg.thankYouRightHeadingSubOne;
  }
  if (cfg.thankYouRightSubheadingOne) {
    cfg.thankYouRightSubHeadingOne = cfg.thankYouRightSubheadingOne;
  }

  // Apply fallback from dataset and set defaults for all expected fields
  [
    'classes', 'alignment', 'campaignId', 'redirectionUrl', 'heroBgDesktop',
    'heroBgMobile', 'heroBgAlt', 'formTitle', 'ctaLabel', 'whatsappConsentText',
    'disclaimerHtml', 'emptyFieldErrorMessage', 'mobileNumberErrorMessage',
    'pincodeErrorMessage', 'thankYouLeftSuccessHeading',
    'thankYouLeftSuccessDescription', 'thankYouLeftErrorHeading',
    'thankYouLeftErrorDescription', 'thankYouRightHeading', 'thankYouRightSubHeadingOne',
    'thankYouRightSubHeadingTwo', 'thankYouBgDesktop', 'thankYouBgMobile',
    'exploreCtaLabel', 'exploreCtaLink', 'node',
  ].forEach((f) => {
    if (!cfg[f]) {
      cfg[f] = ds[f.toLowerCase()] || ds[f] || '';
    }
    // Set back to dataset for visibility in dev tools
    if (cfg[f]) ds[f] = cfg[f];
  });

  // Default values and final overrides
  cfg.node = cfg.node || window.location.pathname || ' ';
  cfg.campaignId = cfg.campaignId || getCampaignIdFromUrl();

  block.innerHTML = '';

  const bgContainer = document.createElement('div');
  bgContainer.className = 'hero-form-background';

  if (cfg.heroBgDesktop || cfg.heroBgMobile) {
    const pic = document.createElement('picture');

    if (cfg.heroBgDesktop) {
      const s = document.createElement('source');
      s.media = '(min-width:992px)';
      s.srcset = cfg.heroBgDesktop;
      pic.appendChild(s);
    }

    if (cfg.heroBgMobile) {
      const s = document.createElement('source');
      s.media = '(max-width:991px)';
      s.srcset = cfg.heroBgMobile;
      pic.appendChild(s);
    }

    const img = document.createElement('img');
    img.src = cfg.heroBgDesktop || cfg.heroBgMobile;
    img.alt = cfg.heroBgAlt || '';
    img.loading = 'eager';
    // This is the LCP element on hero-form pages. scripts.js's
    // preloadLcpImage() already fires a fetchpriority=high preload for this
    // same URL in the eager phase (before decorate() runs), but the actual
    // <img> Lighthouse inspects as the LCP element still needs the attribute
    // itself for the "fetchpriority=high should be applied" check.
    img.setAttribute('fetchpriority', 'high');
    pic.appendChild(img);
    bgContainer.appendChild(pic);
  }

  block.appendChild(bgContainer);

  const formWrapper = document.createElement('div');
  formWrapper.className = 'hero-form-panel-wrapper';
  formWrapper.appendChild(htmlToEl(buildMarkup(cfg)));
  block.appendChild(formWrapper);

  // Harden any links authored inside the disclaimer (cfg.disclaimerHtml,
  // injected verbatim into .disclaimer-section above): open safely in a
  // new tab regardless of how the author set (or didn't set) href/target.
  block.querySelectorAll('.disclaimer-section a').forEach((link) => {
    link.target = '_blank';
    link.rel = 'noopener noreferrer';

    const open = (e) => {
      if (!link.href) return;
      e.preventDefault();
      window.open(link.href, '_blank', 'noopener,noreferrer');

      const cell = link.closest('.miniform.hero-miniform');
      const parentTitle = cell?.querySelector('.title-section')?.textContent?.trim() || '';

      trackEvent('cta_link_text', {
        cta_: link.textContent?.trim(),
        parentTitle,
        param1: link.href,
      });
    };

    link.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      link.dataset.opened = 'true';
      setTimeout(() => { delete link.dataset.opened; }, 300);
      open(e);
    });

    link.addEventListener('click', (e) => {
      if (link.dataset.opened === 'true') {
        e.preventDefault();
        return;
      }
      open(e);
    });
  });

  const container = block.querySelector('.find-contractor-form-container');
  const form = block.querySelector('.hero-form-contact');
  const mobileWrap = block.querySelector('.mobile-input-section');
  const pinWrap = block.querySelector('.pincode-input-section');
  const mobileInput = block.querySelector('#mobile-number');
  const pinInput = block.querySelector('#pincode');
  const consentSection = block.querySelector('.whatsapp-update-consent-section');
  const consentInput = block.querySelector('#whatsapp-consent-input');
  const checkmark = block.querySelector('.whatsapp-consent-checkmark');
  const spinner = block.querySelector('.get-contractor-progress-status');
  const thankyou = block.querySelector('.mf-thankyou-revamp-container');
  const closeBtn = thankyou?.querySelector('.mf__dismissible-container--head');
  const currentFormName = getTextFromHtml(cfg.formTitle) || 'hero-form';
  const configuredCampaignId = (cfg.campaignId || container?.getAttribute('data-attr-campaignId') || '').trim();
  const currentCampaignId = configuredCampaignId || getCampaignIdFromUrl();
  let formStarted = false;
  let thankYouTracked = false;

  const fieldIsReqMsg = container?.getAttribute('data-attr-emptyFieldError') || 'Field is required';
  const validMobNoMsg = container?.getAttribute('data-attr-mobileError') || 'Phone number is invalid';
  const validPincodeMsg = container?.getAttribute('data-attr-pincodeError') || 'Enter a valid 6 digit Zip Code';

  function onFocus(fieldWrap) {
    setError(fieldWrap, '');
    setLabelTop(fieldWrap, true);
  }

  function onBlur(fieldWrap, input) {
    if (!input.value.trim()) {
      setError(fieldWrap, fieldIsReqMsg);
      setLabelTop(fieldWrap, false);
    }
  }

  function onChange(fieldWrap, input) {
    if (input.value.trim()) {
      setLabelTop(fieldWrap, true);
    }
  }

  mobileInput?.addEventListener('focus', () => onFocus(mobileWrap));
  mobileInput?.addEventListener('blur', () => onBlur(mobileWrap, mobileInput));
  mobileInput?.addEventListener('input', () => {
    limitDigits(mobileInput, 10);
    onChange(mobileWrap, mobileInput);
    if (mobileInput.value.trim() && !isMobileValid(mobileInput.value)) {
      setError(mobileWrap, validMobNoMsg);
    } else setError(mobileWrap, '');
  });

  pinInput?.addEventListener('focus', () => onFocus(pinWrap));
  pinInput?.addEventListener('blur', () => onBlur(pinWrap, pinInput));
  pinInput?.addEventListener('input', () => {
    limitDigits(pinInput, 6);
    onChange(pinWrap, pinInput);
    if (pinInput.value.trim() && !isPincodeValid(pinInput.value)) {
      setError(pinWrap, validPincodeMsg);
    } else setError(pinWrap, '');
  });

  function syncWhatsappConsentState() {
    if (!consentInput || !checkmark || !consentSection) return;

    consentSection.classList.toggle('is-checked', consentInput.checked);
    checkmark.setAttribute('aria-checked', consentInput.checked ? 'true' : 'false');
  }

  checkmark?.addEventListener('click', () => consentInput?.click());
  checkmark?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      consentInput?.click();
    }
  });
  consentInput?.addEventListener('change', syncWhatsappConsentState);
  syncWhatsappConsentState();

  form?.addEventListener('focusin', (evt) => {
    if (formStarted || evt.target.tagName !== 'INPUT') return;
    formStarted = true;
    trackEvent('Form start', {
      formName: currentFormName,
      campaignId: currentCampaignId,
    });
    pushAdobeFormEvents({
      event: 'form_start',
      formName: currentFormName,
      formCampaignId: currentCampaignId,
    })
  });

  function isFormValid() {
    const m = mobileInput.value.trim();
    const p = pinInput.value.trim();
    let ok = true;

    if (!m) {
      setError(mobileWrap, fieldIsReqMsg);
      ok = false;
    } else if (!isMobileValid(m)) {
      setError(mobileWrap, validMobNoMsg);
      ok = false;
    }

    if (!p) {
      setError(pinWrap, fieldIsReqMsg);
      ok = false;
    } else if (!isPincodeValid(p)) {
      setError(pinWrap, validPincodeMsg);
      ok = false;
    }

    return ok;
  }

  function showThankYou(success) {
    if (!thankyou || !container) return;

    block.classList.add('is-thankyou');
    container.style.display = 'none';
    bgContainer.style.display = 'none';
    thankyou.style.display = 'block';

    const okLeft = thankyou.querySelector('.mf-thank-you-left-content');
    const errLeft = thankyou.querySelector('.mf-error-left-content');

    if (okLeft && errLeft) {
      okLeft.style.display = success ? 'block' : 'none';
      errLeft.style.display = success ? 'none' : 'block';
    }

    if (success && !thankYouTracked) {
      thankYouTracked = true;
      // Direct/inline hero-form → fire "Form Submit" (event9) on success.
      // "Form_thank_you_pop_up" (event38) belongs to the popup lead-form
      // block only, so it is intentionally not fired here.
      trackFormSubmission(currentFormName, currentCampaignId, consentInput?.checked, {
        dataDestination: cfg.dataDestination || 'both',
        contruction: cfg.contruction || '',
        localpainter: cfg.localpainter || '',
      });
    }
  }

  function resetFromThankYou() {
    if (!thankyou || !container) return;
    block.classList.remove('is-thankyou');
    thankyou.style.display = 'none';
    bgContainer.style.display = '';
    container.style.display = '';
    // Allow the Form Submit event to fire again on subsequent successful
    // submissions after the user has closed the thank-you popup.
    thankYouTracked = false;
  }

  // Closing the thank-you popup must NOT fire an analytics event —
  // matches prod behaviour on painting-contractors. Previously we fired
  // a 'close' link event on both click and Enter, which QA flagged as
  // an extra beacon that does not exist on the legacy AMS page.
  closeBtn?.addEventListener('click', () => {
    resetFromThankYou();
  });
  closeBtn?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      resetFromThankYou();
    }
  });

  // Track custom CTA clicks for animated-btn-yellow-onhover-black buttons
  block.addEventListener('click', (e) => {
    const ctaBtn = e.target.closest('.animated-btn-yellow-onhover-black');
    // Two buttons here share the animated-btn styling class but own their
    // own analytics, so exclude them to avoid double-firing custom_cta_click:
    //  - the form submit button (.hero-form-submit) fires form_submit/form_error
    //  - the thank-you Explore CTA (.explore-painting-btn) fires cta_link_text
    if (ctaBtn
      && !e.target.closest('.hero-form-submit')
      && !e.target.closest('.explore-painting-btn')) {
      const ctaText = ctaBtn.querySelector('.animated-arrow-button')?.textContent?.trim() || 'CTA Button';
      trackEvent('custom_cta_click', {
        ctaText,
        campaignId: currentCampaignId,
        formName: currentFormName,
      });
      pushAdobeCtaClickEvent({
        cta: ctaText,
        parentTitle: 'Hero Form',
      })
    }
  });

  // Thank-you "Explore" CTA — fire cta_link_text (event143), matching the
  // Explore-CTA tracking in the popup lead-form/form blocks. Without this the
  // link navigates but reports no analytics.
  const exploreCta = thankyou?.querySelector('.explore-painting-btn');
  exploreCta?.addEventListener('click', () => {
    const ctaLink = exploreCta.getAttribute('href') || '';
    trackEvent('cta_link_text', {
      cta_: exploreCta.textContent?.trim() || 'Explore now',
      parentTitle: 'Form Thank you pop-up',
      param1: ctaLink,
      redirectionLink: ctaLink,
    });

    pushAdobeCtaClickEvent({
      cta: exploreCta.textContent?.trim() || 'Explore now',
      parentTitle: 'Form Thank you pop-up',
      destinationUrl: ctaLink,
      event: 'cta_link_text',
    })

  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!isFormValid()) {
      const failedFields = [];
      const m = mobileInput?.value?.trim() || '';
      const p = pinInput?.value?.trim() || '';
      if (!m || !isMobileValid(m)) failedFields.push('MobileNumber');
      if (!p || !isPincodeValid(p)) failedFields.push('PINCode');
      trackFormError({
        campaignId: currentCampaignId,
        formName: currentFormName,
        formError: failedFields.length ? failedFields : ['required'],
      });
      return;
    }

    spinner?.classList.remove('d-none');

    if (!window.CryptoJS) {
      showThankYou(false);
      spinner?.classList.add('d-none');
      return;
    }

    const utm = getUtmParams();
    const whatsAppConsent = consentInput?.checked ? 'Y' : 'N';
    const aesUtil = new AesUtil(128, 1000);

    const fNameEnc = aesUtil.ltyEncrypt('NA');
    const lNameEnc = aesUtil.ltyEncrypt('NA');
    const mobileEnc = aesUtil.ltyEncrypt(mobileInput.value.trim());
    const pinEnc = aesUtil.ltyEncrypt(pinInput.value.trim());
    const email = `${mobileInput.value.trim()}na@asianpaints.com`;

    const campaignId = currentCampaignId;

    const payload = buildBasePayload();
    payload.pageUrl = window.location.href;
    payload.node = (cfg.node || window.location.pathname || ' ').trim();
    payload.campaignId = campaignId;
    payload.marketingChannel = 'Direct';
    payload.visitorId = getVisitorId();
    payload.gaId = getGaIdFromCookie();
    payload.whatsAppConsent = whatsAppConsent;

    payload.fName = fNameEnc;
    payload.lName = lNameEnc;
    payload.mobileNo = mobileEnc;
    payload.pinCode = pinEnc;
    payload.email = email;

    payload.source = utm.source;
    payload.medium = utm.medium;
    payload.utmContent = utm.utmContent;
    payload.utmId = utm.utmId;
    payload.utmAdgroupName = utm.utmAdgroupName;
    payload.utmKeyword = utm.utmKeyword;
    payload.utmKeywordMatchType = utm.utmKeywordMatchType;
    payload.utmCampaignSource = utm.utmCampaignSource;

    try {
      const dbResp = await postFormUrlEncoded(
        `${AMS_BASE}/apcolourcatalogue/ccforms.saveleadform.json`,
        payload,
      );

      if (dbResp && dbResp.Status === 'SUCCESS' && dbResp.rowID) {
        const sfPayload = {
          ...payload,
          visitorId: payload.gaId,
          rowId: dbResp.rowID,
        };
        delete sfPayload.gaId;
        const sfResp = await postFormUrlEncoded(
          `${AMS_BASE}/apcolourcatalogue/ccforms/salesforce.leadstosalesforce.json`,
          sfPayload,
        );

        const ok = sfResp && (sfResp.returnCode === 201 || sfResp.returnCode === '201');
        const redirect = container.getAttribute('data-attr-redirection');

        if (ok && redirect) {
          window.location.href = redirect;
        } else {
          showThankYou(!!ok);
        }
      } else {
        showThankYou(false);
      }
    } catch (err) {
      showThankYou(false);
    } finally {
      spinner?.classList.add('d-none');
    }
  });
}
