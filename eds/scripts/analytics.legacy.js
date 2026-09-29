import { loadScript } from './aem.js';
import { getSiteConfig } from './configs.js';
import { DOMAIN_ENV, getDomainEnvironment } from './environment.js';
import { pushAdobeCtaClickEvent , pushAdobeSingleEvent } from './analytics_1.js';

const BETA_LAUNCH_URL_KEY = 'beta_launchUrl';
const PROD_LAUNCH_URL_KEY = 'prod_launchUrl';
const LEGACY_LAUNCH_URL_KEY = 'launchUrl';

/**
 * Returns the digitalData object or creates an empty one if it doesn't exist.
 * @returns {Object} The digitalData object
 */
export function getDigitalData() {
  window.digitalData = window.digitalData || {};
  return window.digitalData;
}

/**
 * Tracks a custom event. Triggers a _satellite.track call.
 * @param {string} eventName The name of the event
 * @param {Object} [eventData] Optional event data
 */
export function trackEvent(eventName, eventData = {}) {
  const normalizedEventName = typeof eventName === 'string' ? eventName.trim() : '';
  if (!normalizedEventName) return;

  getDigitalData().event = normalizedEventName;
  window._satellite && window._satellite.track(normalizedEventName, eventData);
}

/**
 * Tracks CTA link text interaction.
 * @param {string} btnTitle The CTA label
 * @param {string} ctaLink The CTA URL
 */
export function triggerCtaLinkText(btnTitle, ctaLink) {
  if (typeof window._satellite === 'undefined') return;

  trackEvent('cta_link_text', {
    cta_: btnTitle,
    param1: ctaLink,
  });

  pushAdobeCtaClickEvent({
    event: 'cta_link_text',
    cta: btnTitle,
    destinationUrl: ctaLink,
  });

}

/**
 * Tracks no result event for search journeys.
 * @param {string} searchTerm The search term (use 'Image' for image search)
 */
export function trackNoResultFound(searchTerm) {
  trackEvent('no_result', {
    search_term: searchTerm,
  });
  pushAdobeCtaClickEvent({
    event: 'no_result',
    searchTerm,
  });
}

/**
 * Tracks image search dialog open/start.
 */
export function trackImageSearchStart() {
  trackEvent('ub_imagesearch_start');
  pushAdobeSingleEvent('ub_imagesearch_start');
}

/**
 * Tracks image search dialog close.
 */
export function trackImageSearchClose() {
  trackEvent('ub_imagesearch_close');
  pushAdobeSingleEvent('ub_imagesearch_close');
}

/**
 * Tracks image search completion with total result count.
 * @param {number} totalResults Total results returned by image search
 */
export function trackImageSearchComplete(totalResults) {
  trackEvent('ub_imagesearch_complete', {
    totalResults,
  });
  pushAdobeCtaClickEvent({
    event: 'ub_imagesearch_complete',
    resultCount: totalResults,
  });
}

function toUrl(urlLike) {
  try {
    return new URL(urlLike, window.location.origin);
  } catch (e) {
    return new URL(window.location.href);
  }
}

function buildPageData(urlObj) {
  const parts = urlObj.pathname
    .split('/')
    .filter(Boolean)
    .map((s) => s.replace(/\.html?$/i, ''));

  return {
    destinationURL: urlObj.href,
    pageName: `in::${parts.join(':')}`,
    section1: parts[0] || '',
    section2: parts[1] || '',
    section3: parts[2] || '',
    section4: parts[3] || '',
  };
}

function getParam(urlObj, key) {
  return urlObj.searchParams.get(key) || '';
}

function getMcidFromCookie() {
  return window._satellite?.getVisitorId?.()?.getMarketingCloudVisitorID?.() || '';
}

function getGaIdFromCookie() {
  let gaId = (document.cookie.match(/(?:^|;\s*)_ga=([^;]+)/) || [])[1] || '';
  if (gaId) {
    gaId = decodeURIComponent(gaId).replace(/^GA\d+\.\d+\./, "");
  }
  return gaId;
}

function setDigitalDataContext(destinationUrl = window.location.href) {
  const currentUrl = toUrl(window.location.href);
  const targetUrl = toUrl(destinationUrl);
  const digitalData = getDigitalData();

  const source = getParam(currentUrl, 'utm_source') || getParam(currentUrl, 'source')
    || getParam(targetUrl, 'utm_source') || getParam(targetUrl, 'source');
  const medium = getParam(currentUrl, 'utm_medium') || getParam(currentUrl, 'medium')
    || getParam(targetUrl, 'utm_medium') || getParam(targetUrl, 'medium');
  const campaign = getParam(currentUrl, 'utm_campaign') || getParam(currentUrl, 'campaign')
    || getParam(targetUrl, 'utm_campaign') || getParam(targetUrl, 'campaign');
  const cid = getParam(currentUrl, 'cid') || getParam(targetUrl, 'cid') || 'null';

  digitalData.page = buildPageData(targetUrl);
  digitalData.utmValues = {
    source,
    medium,
    campaign,
    cid,
  };
  digitalData.product = {
    productName: '',
    productCode: '',
    productPrice: '',
    productQuantity: 1,
    relatedProduct: '',
  };
  digitalData.skuCodeList = {
    skuCodes: '',
  };
  digitalData.device = {
    deviceType: navigator.userAgent,
  };
  digitalData.user = {
    loginStatus: digitalData.user?.loginStatus || 'not logged in',
    mcid: digitalData.user?.mcid || getMcidFromCookie(),
    gaID: digitalData.user?.gaID || getGaIdFromCookie(),
    ipAddress: digitalData.user?.ipAddress || '',
    emailId: digitalData.user?.emailId || '',
    mobileNumber: digitalData.user?.mobileNumber || '',
    loginFunction: digitalData.user?.loginFunction || '',
  };
  digitalData.event = digitalData.event || '';
}

/**
 * Tracks CTA click interaction based on link type.
 * @param {string} ctaLink The CTA URL
 * @param {string} btnTitle The CTA label
 * @param {string} parentTitle The parent card/section title
 */
export function triggerCTAClickWithLinkAndTitle(ctaLink, btnTitle, parentTitle) {
  if (!ctaLink) return;

  setDigitalDataContext(ctaLink);
  
  if (ctaLink.indexOf('javascript:void') > -1) {
    trackEvent('custom_cta_click', {
      cta_: btnTitle,
    });
    pushAdobeCtaClickEvent({
      event: 'custom_cta_click',
      cta: btnTitle,
    });
  } else if (ctaLink.indexOf('tel:') > -1) {
    trackEvent('SPSContactClick', { cta_: 'Contact Us Component' });
    pushAdobeCtaClickEvent({
      event: 'SPSContactClick',
      cta: 'Contact Us Component',
    });
  } else {
    trackEvent('custom_cta_click', {
      cta_: btnTitle,
      redirectionLink: ctaLink,
      parentTitle,
    });
    pushAdobeCtaClickEvent({
      event: 'custom_cta_click',
      cta: btnTitle,
      parentTitle,
      destinationUrl: ctaLink,
    });
  }
}

function getTrackingLinkValue(link) {
  const href = link.getAttribute('href') || '';
  const redirectionLink = link.getAttribute('data-redirection-link') || '';

  if (href.indexOf('javascript:void') > -1 && redirectionLink) {
    return redirectionLink;
  }

  return href || redirectionLink;
}
function getButtonContainerParentTitle(link) {
  const section = link.closest('.section');
  const block = link.closest('.block');
  const scopedContainer = block || section || link.closest('main') || document;

  const titleInBlock = block?.querySelector('h1, h2, h3, h4, h5, h6');
  if (titleInBlock?.textContent?.trim()) {
    return titleInBlock.textContent.trim();
  }

  const sectionHeading = section?.querySelector(':scope > .section-metadata + div h1, :scope > .section-metadata + div h2, :scope > .section-metadata + div h3, :scope > .section-metadata + div h4, :scope > .section-metadata + div h5, :scope > .section-metadata + div h6, h1, h2, h3, h4, h5, h6');
  if (sectionHeading?.textContent?.trim()) {
    return sectionHeading.textContent.trim();
  }

  const nearestText = scopedContainer.querySelector('h1, h2, h3, h4, h5, h6, p');
  return nearestText?.textContent?.trim() || '';
}

export function trackPdfDownload(target) {
  const pdfName = (target?.textContent || '').trim();
  trackEvent('download_form_pdf', {
    pdfName,
  });
  pushAdobeCtaClickEvent({
    event: 'download_form_pdf',
    title: pdfName,
  });
}

export function bindReadTermsPdfTracking(element) {
  element.querySelectorAll('.button-container a.button').forEach((cta) => {
    if (cta.dataset.readTermsPdfAnalyticsBound === 'true') return;

    const ctaLink = (cta.getAttribute('href') || '').toLowerCase();
    const btnTitle = (cta.textContent || '').trim().toLowerCase();
    if (btnTitle !== 'read t&c' || ctaLink.indexOf('.pdf') === -1) return;

    cta.dataset.readTermsPdfAnalyticsBound = 'true';
    cta.dataset.analyticsBound = 'true';

    cta.addEventListener('click', () => {
      trackPdfDownload(cta);
    });
  });
}

export function bindButtonContainerTracking(element) {
  element.querySelectorAll('.button-container a.button').forEach((cta) => {
    if (cta.closest('.explore-split')) return;
    if (cta.dataset.analyticsBound === 'true') return;

    cta.dataset.analyticsBound = 'true';
    cta.addEventListener('click', () => {
      const ctaLink = cta.getAttribute('href') || '';
      const btnTitle = cta.textContent.trim();
      const parentTitle = getButtonContainerParentTitle(cta);

      triggerCTAClickWithLinkAndTitle(ctaLink, btnTitle, parentTitle);
    });
  });
}

export function bindTrackCTALinkTextTracking(element) {
  if (!element || element.dataset.trackCtaLinkTextBound === 'true') return;

  element.dataset.trackCtaLinkTextBound = 'true';
  element.addEventListener('click', (event) => {
    const cta = event.target.closest('a.trackCTA');
    if (!cta || !element.contains(cta)) return;

    const btnTitle = cta.textContent.trim();
    const ctaLink = getTrackingLinkValue(cta);
    triggerCtaLinkText(btnTitle, ctaLink);
  });
}

export function royalePlayAnimatedImageTracking(element) {
  if (!element || element.dataset.royalePlayAnimatedTrackingBound === 'true') return;

  element.dataset.royalePlayAnimatedTrackingBound = 'true';
  element.addEventListener('click', (event) => {
    const cta = event.target.closest('.default-content-wrapper a[href]');
    if (!cta || !element.contains(cta)) return;

    const href = cta.getAttribute('href') || '';
    if (href.indexOf('interior-textures.html') === -1 || href.toLowerCase().indexOf('play') === -1) return;

    const btnTitle = cta.querySelector('img')?.alt?.trim() || 'Royale Play Playlist';
    triggerCTAClickWithLinkAndTitle(href, btnTitle, 'default-content-wrapper');
  });
}

function getLaunchUrlKey(hostname = window.location.hostname) {
  if (getDomainEnvironment(hostname) === DOMAIN_ENV.BETA) {
    return BETA_LAUNCH_URL_KEY;
  }

  return PROD_LAUNCH_URL_KEY;
}

/**
 * Initializes the data layer and loads the Adobe Launch script.
 */
export async function initAnalytics() {
  // Load the Launch script
  const siteConfig = await getSiteConfig();

  const launchUrlKey = getLaunchUrlKey();
  const launchUrl = siteConfig?.data?.find((entry) => entry?.key === launchUrlKey)?.value
    || siteConfig?.data?.find((entry) => entry?.key === LEGACY_LAUNCH_URL_KEY)?.value;
  if (!launchUrl) {
    return;
  }
  await loadScript(launchUrl, { async: true });
  setDigitalDataContext(window.location.href);
}