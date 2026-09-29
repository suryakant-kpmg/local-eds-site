/**
 * Header Block
 * Fetches nav.plain.html and renders a 3-tier header:
 * Row 0: Brand bar (dark blue)
 * Row 1: Main header (logo, search, action icons, CTA, hamburger)
 * Row 2: Navigation bar (home icon, main nav with megamenu, secondary nav)
 *
 * Integrations (matching original asianpaints.com):
 * - Search with location detection API + autocomplete dropdown
 * - Keycloak SSO authentication (login/profile state)
 * - MiniCart API for live cart badge count
 * - Visual search with file upload, drag-and-drop, and validation
 */

import { getMetadata, decorateIcons } from '../../scripts/aem.js';
import { getSiteConfig } from '../../scripts/configs.js';
import { DOMAIN_ENV, getDomainEnvironment } from '../../scripts/environment.js';
import {
  getDigitalData,
  trackEvent,
  trackNoResultFound,
  trackImageSearchStart,
  trackImageSearchClose,
  trackImageSearchComplete,
  triggerCTAClickWithLinkAndTitle,
  ga4Implementaion, 
  pushAdobeCtaClickEvent,
  pushAdobeAuthEvent,
  pushAdobeSingleEvent
} from '../../scripts/analytics_1.js';

const DESKTOP_BREAKPOINT = 992;
const CURRENT_ORIGIN = window.location.origin;
const DEFAULT_API_BASE = 'https://www.asianpaints.com';
const DEFAULT_UNBXD_BASE = 'https://search.unbxd.io';

const KEYCLOAK_AUTH_URLS = Object.freeze({
  [DOMAIN_ENV.BETA]: 'https://betaauth.asianpaints.com',
  [DOMAIN_ENV.PROD]: 'https://auth.asianpaints.com',
});

const UNBXD_API_KEYS = Object.freeze({
  [DOMAIN_ENV.BETA]: '9cec79cb1e6a986bf237d8d42d54456d',
  [DOMAIN_ENV.PROD]: 'decd8e031bd76ff9fa152afeadcb1773',
});

const UNBXD_SITE_KEYS = Object.freeze({
  [DOMAIN_ENV.BETA]: 'ss-unbxd-dev-asianpaints46541692795440',
  [DOMAIN_ENV.PROD]: 'ss-unbxd-prod-asianpaints46541696944854',
});

function getDefaultKeycloakAuthUrl() {
  return KEYCLOAK_AUTH_URLS[getDomainEnvironment()] || KEYCLOAK_AUTH_URLS[DOMAIN_ENV.BETA];
}

const UNBXD_HOSTED_ASSETS = Object.freeze({
  [DOMAIN_ENV.BETA]: {
    css: 'https://sandbox.unbxd.io/ss-unbxd-dev-asianpaints46541692795440_autosuggest.css',
    ua: 'https://libraries.unbxdapi.com/sdk-clients/ss-unbxd-dev-asianpaints46541692795440/ua-staging/ua.js',
    autosuggest: 'https://sandbox.unbxd.io/ss-unbxd-dev-asianpaints46541692795440_autosuggest.js',
  },
  [DOMAIN_ENV.PROD]: {
    css: 'https://libraries.unbxdapi.com/ss-unbxd-prod-asianpaints46541696944854_autosuggest.css',
    ua: 'https://libraries.unbxdapi.com/sdk-clients/ss-unbxd-prod-asianpaints46541696944854/ua/ua.js',
    autosuggest: 'https://libraries.unbxdapi.com/ss-unbxd-prod-asianpaints46541696944854_autosuggest.js',
  },
});

function getDefaultUnbxdSiteKey() {
  return UNBXD_SITE_KEYS[getDomainEnvironment()] || UNBXD_SITE_KEYS[DOMAIN_ENV.BETA];
}

function getDefaultUnbxdApiKey() {
  return UNBXD_API_KEYS[getDomainEnvironment()] || UNBXD_API_KEYS[DOMAIN_ENV.BETA];
}

const headerConfig = {
  apiBaseUrl: DEFAULT_API_BASE,
  keycloakAuthUrl: getDefaultKeycloakAuthUrl(),
  unbxdApiKey: getDefaultUnbxdApiKey(),
  unbxdSiteKey: getDefaultUnbxdSiteKey(),
  unbxdBaseUrl: DEFAULT_UNBXD_BASE,
};

const HEADER_ICON_PATHS = {
  PROFILE_LOGGED_OUT: '/eds/icons/profile-icon-gray-brown.png',
  PROFILE_LOGGED_IN: '/eds/icons/profile-icon-logged-in.svg',
  STORE: '/eds/icons/store-icon-gray-brown.png',
};

// Redirect URI — preserve current path/query so auth returns to the same page.
const AUTH_REDIRECT_URI = `${window.location.origin}${window.location.pathname}${window.location.search}`;
const SIGNED_OUT_KEY = 'ap_signed_out';
const AUTH_REDIRECTED_KEY = 'ap_auth_redirected';
const POST_LOGIN_REDIRECT_FLAG_KEY = 'redirectPostLoginFlag';
const POST_LOGIN_REDIRECT_PATH_KEY = 'redirectPostLoginPath';
const LOGIN_SUCCESS_TRACKED_KEY = 'ap_login_success_tracked';

function hasAuthCallbackHashParams() {
  try {
    const hash = window.location.hash;
    if (!hash || hash.length <= 1) return false;
    const params = new URLSearchParams(hash.slice(1));
    return ['state', 'session_state', 'iss', 'code', 'id_token']
      .some((key) => params.has(key));
  } catch {
    return false;
  }
}

function wasLoginSuccessTracked() {
  try {
    return sessionStorage.getItem(LOGIN_SUCCESS_TRACKED_KEY) === '1';
  } catch {
    return false;
  }
}

function markLoginSuccessTracked() {
  try {
    sessionStorage.setItem(LOGIN_SUCCESS_TRACKED_KEY, '1');
  } catch {
    // ignore storage errors
  }
}

function clearLoginSuccessTrackedFlag() {
  try {
    sessionStorage.removeItem(LOGIN_SUCCESS_TRACKED_KEY);
  } catch {
    // ignore storage errors
  }
}

function trackLoginSuccessfulOnce(loginFunction = 'login successful') {
  if (wasLoginSuccessTracked()) return;
  markLoginSuccessTracked();
  trackLoginSuccessful(loginFunction);
}

function persistPostLoginRedirectPath() {
  const redirectUrl = window.location.href || `${window.location.origin}/`;
  clearLoginSuccessTrackedFlag();
  try {
    localStorage.setItem(POST_LOGIN_REDIRECT_FLAG_KEY, 'true');
    localStorage.setItem(POST_LOGIN_REDIRECT_PATH_KEY, redirectUrl);
  } catch (e) {
    // ignore storage errors
  }

  try {
    sessionStorage.setItem(POST_LOGIN_REDIRECT_FLAG_KEY, 'true');
    sessionStorage.setItem(POST_LOGIN_REDIRECT_PATH_KEY, redirectUrl);
  } catch (e) {
    // ignore storage errors
  }
}

function consumePostLoginRedirectPath() {
  const read = (storage) => {
    try {
      if (storage.getItem(POST_LOGIN_REDIRECT_FLAG_KEY) === 'true') {
        return storage.getItem(POST_LOGIN_REDIRECT_PATH_KEY) || '';
      }
    } catch (e) {
      // ignore storage errors
    }
    return '';
  };

  const clear = (storage) => {
    try {
      storage.removeItem(POST_LOGIN_REDIRECT_FLAG_KEY);
      storage.removeItem(POST_LOGIN_REDIRECT_PATH_KEY);
    } catch (e) {
      // ignore storage errors
    }
  };

  const redirectPath = read(localStorage) || read(sessionStorage);
  clear(localStorage);
  clear(sessionStorage);

  if (!redirectPath) return '';

  try {
    const targetUrl = new URL(redirectPath, window.location.origin);
    if (targetUrl.origin !== window.location.origin) return '';
    return targetUrl.href;
  } catch (e) {
    return '';
  }
}

// Resolve the env-prefixed key (e.g. `api-base-url` -> `beta_api-base-url` /
// `prod_api-base-url`) so a single DA `site-config` can serve both envs.
function getEnvKey(name) {
  const prefix = getDomainEnvironment() === DOMAIN_ENV.BETA ? 'beta' : 'prod';
  return `${prefix}_${name}`;
}

async function fetchHeaderConfig() {
  try {
    const json = await getSiteConfig();
    const data = json?.data || [];
    const get = (key) => data.find((entry) => entry?.key === key)?.value;

    // Prefer env-prefixed keys; fall back to legacy unprefixed for safety during rollout.
    const apiBase = get(getEnvKey('api-base-url')) || get('api-base-url');
    const keycloak = get(getEnvKey('keycloak-auth-url')) || get('keycloak-auth-url');
    const unbxdApiKey = get(getEnvKey('unbxd-api-key')) || get('unbxd-api-key');
    const unbxdSiteKey = get(getEnvKey('unbxd-site-key')) || get('unbxd-site-key');
    const unbxdBaseUrl = get(getEnvKey('unbxd-base-url')) || get('unbxd-base-url');

    if (apiBase) headerConfig.apiBaseUrl = apiBase.replace(/\/$/, '');
    if (keycloak) headerConfig.keycloakAuthUrl = keycloak.replace(/\/$/, '');
    if (unbxdApiKey) headerConfig.unbxdApiKey = unbxdApiKey;
    headerConfig.unbxdSiteKey = unbxdSiteKey || getDefaultUnbxdSiteKey();
    if (unbxdBaseUrl) headerConfig.unbxdBaseUrl = unbxdBaseUrl.replace(/\/$/, '');
  } catch (e) {
    // use defaults
  }
}

function getApiBaseUrl() {
  return headerConfig.apiBaseUrl || DEFAULT_API_BASE;
}

function isOnAsianPaintsDomain() {
  const host = window.location.hostname.toLowerCase();
  return host === 'asianpaints.com' || host.endsWith('.asianpaints.com');
}

function getApOrigin() {
  return isOnAsianPaintsDomain() ? CURRENT_ORIGIN : getApiBaseUrl();
}

/**
 * Resolve AP paths relative on first-party domains and absolute elsewhere.
 */
function apUrl(path) {
  if (!path) return getApOrigin();
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return isOnAsianPaintsDomain() ? normalizedPath : `${getApiBaseUrl()}${normalizedPath}`;
}

/** Resolve any href to a full absolute URL for analytics eVars. */
function toAbsoluteUrl(href) {
  if (!href || href === '#' || href.startsWith('javascript:')) return '';
  try {
    return new URL(href, window.location.href).href;
  } catch {
    return href;
  }
}

function normalizeInternalPath(href) {
  if (!href) return '';
  try {
    const url = new URL(href, window.location.href);
    return url.pathname.replace(/(\.plain)?\.html$/, '');
  } catch {
    return '';
  }
}

/* eslint-disable max-len */
const AP_PATHS = {
  DETECT_LOCATION: '/apcolourcatalogue/detect-location',
  CONTRACTOR_PROFILE: '/apcolourcatalogue/contractorprofile.json',
  MINI_CART: '/apcolourcatalogue/commerce/miniCart.json',
  VISUAL_SEARCH_UPLOAD: '/apcolourcatalogue/visualSearch',
  DEALER_LOCATOR: '/content/ap/en/home/store-locator/jcr:content/root/responsivegrid_320175147/responsivegrid_242725073/storelocatorlepton_c.json',
};
/* eslint-enable max-len */

function getApApi() {
  return {
    DETECT_LOCATION: apUrl(AP_PATHS.DETECT_LOCATION),
    CONTRACTOR_PROFILE: apUrl(AP_PATHS.CONTRACTOR_PROFILE),
    MINI_CART: apUrl(AP_PATHS.MINI_CART),
    SEARCH_RESULTS: apUrl('/content/ap/en/home/searchresult.html'),
    DEALER_PAGE: apUrl('/content/ap/en/home/store-locator.html'),
    CONTRACTOR_PAGE: apUrl('/content/ap/en/home/contractor-listing-page.html'),
    KEYCLOAK_URL: headerConfig.keycloakAuthUrl || getDefaultKeycloakAuthUrl(),
    KEYCLOAK_REALM: 'asianpaintsRealm',
    KEYCLOAK_CLIENT: 'asianpaints',
    KEYCLOAK_JS: 'https://cdn.jsdelivr.net/npm/keycloak-js@22.0.3/dist/keycloak.min.js',
    KEYCLOAK_PAGE_URL: `${getApOrigin()}/content/ap/en/home/key-cloak.html`,
    PROFILE_PAGE: apUrl('/content/ap/en/home/my-profile.html'),
    WISHLIST_PAGE: apUrl('/content/ap/en/home/my-wishlist.html'),
    SHOP_URL: apUrl('/paint-products.html'),
    VISUAL_SEARCH_UPLOAD: apUrl(AP_PATHS.VISUAL_SEARCH_UPLOAD),
    UNBXD_API_KEY: headerConfig.unbxdApiKey || getDefaultUnbxdApiKey(),
    UNBXD_SITE_KEY: headerConfig.unbxdSiteKey || getDefaultUnbxdSiteKey(),
    UNBXD_BASE: headerConfig.unbxdBaseUrl || DEFAULT_UNBXD_BASE,
  };
}

const AP_GEO_PLACE = {
  API_URL: 'https://places.googleapis.com/v1/places:searchText',
  API_KEY: 'AIzaSyAbju50ovh011X-_bJKuGK7NtrnSxS5h7I',
  FIELD_MASK: 'places.location',
};

/* eslint-disable max-len */
const DEALER_LOCATOR_TYPE_FILTER = 'Beautiful Homes,Colour Ideas,EzyCR Prime,EZY CR,CR NXT Prime,CR NXT,Colour World,Non-colour world';
/* eslint-enable max-len */

function resolveApLink(urlOrPath, fallback = getApApi().SHOP_URL) {
  if (!urlOrPath) return fallback;
  if (/^https?:\/\//i.test(urlOrPath)) return urlOrPath;
  return apUrl(urlOrPath.startsWith('/') ? urlOrPath : `/${urlOrPath}`);
}

async function fetchFromAp(pathOrUrl, options = {}) {
  let url = pathOrUrl;
  if (!/^https?:\/\//i.test(pathOrUrl)) {
    url = apUrl(pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`);
  }
  try {
    const response = await fetch(url, options);
    return response.ok ? response : null;
  } catch {
    return null;
  }
}

/* eslint-disable max-len */
const SEARCH_SUGGESTIONS_LINKS = [
  { text: 'Colour Inspiration', href: apUrl('/inspiration/ideas/colour-inspiration.html') },
  { text: 'Interior Textures', href: apUrl('/catalogue/interior-textures.html') },
  { text: 'Exterior Textures', href: apUrl('/catalogue/exterior-textures.html') },
  { text: 'Wallpaper', href: apUrl('/products/wall-coverings.html') },
  { text: 'Blogs', href: apUrl('/blogs.html') },
  { text: 'Shade Card', href: apUrl('/catalogue/colour-catalogue.html') },
];

/* EDS icons: use icon names matching /icons/<name>.svg (decorateIcons pattern) */
const SEARCH_QUICK_LINKS = [
  { text: 'Beautiful Homes Painting Service', href: apUrl('/services/asian-paints-safe-painting-service.html'), icon: 'ql-bh-painting' },
  { text: 'Interior Design Solution', href: apUrl('/services/beautiful-homes-service.html'), icon: 'ql-interior-design' },
  { text: 'Budget Calculators', href: apUrl('/resources/tools/paint-budget-calculator.html'), icon: 'ql-budget-calculator' },
  { text: 'Home Colour Guide', href: apUrl('/home-colour-guide.html'), icon: 'ql-home-colour-guide' },
];

const TRENDING_ARROW_SVG = '<svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6.55556 1.22217H11M11 1.22217V5.66661M11 1.22217L6.55556 5.66661L4.33333 3.44439L1 6.77772" stroke="#111827" stroke-width="1.13" stroke-linecap="round" stroke-linejoin="round"/></svg>';
/* eslint-enable max-len */

const FALLBACK_TRENDING_QUERIES = ['Beige', 'Grey', 'White', 'Cream', 'Green', 'Ivory', 'Blue', 'Exterior'];
const suggestionPreviewCache = new Map();
let suggestionPreviewToken = 0;

const SUGGESTION_CATEGORY_LABELS = {
  shade: 'Colours',
  gallery: 'Inspirations & Design Ideas',
  texture: 'Textures',
  wallpaper: 'Wallpapers',
};

const SUGGESTION_CATEGORY_ORDER = ['Colours', 'Inspirations & Design Ideas', 'Textures', 'Wallpapers'];

const VS_ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/tiff'];
const VS_MAX_SIZE_MB = 5;
const SEARCH_DEBOUNCE_MS = 80;
const SEARCH_RESULTS_DEBOUNCE_MS = 400;
const LOCATION_DETECTION_DEBOUNCE_MS = 1500;

const DEALER_KEYWORDS = [
  'dealers', 'dealer', 'store', 'stores', 'shop', 'paint shop', 'brand',
];

const CONTRACTOR_KEYWORDS = [
  'contractors', 'contractor', 'painters', 'painter', 'worker', 'service', 'expert',
];

let keycloakInstance = null;

function getUnbxdUid() {
  let uid = localStorage.getItem('unbxd-uid');
  if (!uid) {
    uid = `uid-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    localStorage.setItem('unbxd-uid', uid);
  }
  return uid;
}

// ──────────────────────────────────────────────
//  API: Unbxd Autosuggest + Search
// ──────────────────────────────────────────────

async function fetchUnbxdAutosuggest(query, options = {}) {
  const uid = getUnbxdUid();
  const api = getApApi();
  const base = `${api.UNBXD_BASE}/${api.UNBXD_API_KEY}/${api.UNBXD_SITE_KEY}`;
  const fields = options.fields
    || 'title,price,imageUrl,sku,cfType,entityCode,computed_discount,productUrl,sellingPrice,priceAfterReduction,uniqueId,id,autosuggest,doctype';
  const params = new URLSearchParams({
    q: query || '*',
    version: 'V2',
    uid,
    'inFields.count': String(options.inFieldsCount ?? 0),
    'topQueries.count': String(options.topQueriesCount ?? 8),
    'keywordSuggestions.count': '0',
    'promotedSuggestion.count': '0',
    'popularProducts.count': String(options.popularProductsCount ?? 6),
    'popularProducts.fields': fields,
    indent: 'off',
    fallback: 'true',
  });
  if (options.includeSourceFields) {
    params.set('sourceFields', 'Texture,Shade,Wallpaper,gallery');
    params.set('sourceField.Texture.count', '4');
    params.set('sourceField.Shade.count', '5');
    params.set('sourceField.Wallpaper.count', '4');
    params.set('sourceField.gallery.count', '4');
  }
  try {
    const resp = await fetch(`${base}/autosuggest?${params}`);
    if (!resp.ok) return null;
    return resp.json();
  } catch {
    return null;
  }
}

async function fetchUnbxdSearch(query) {
  const api = getApApi();
  const base = `${api.UNBXD_BASE}/${api.UNBXD_API_KEY}/${api.UNBXD_SITE_KEY}`;
  const fields = 'title,price,imageUrl,sku,cfType,entityCode,computed_discount,productUrl,sellingPrice,priceAfterReduction,uniqueId,id,autosuggest,doctype';
  const params = new URLSearchParams({
    q: query,
    fields,
    rows: '6',
    indent: 'off',
    facet: 'off',
    analytics: 'false',
    redirect: 'false',
    version: 'V2',
  });
  try {
    const resp = await fetch(`${base}/search?${params}`);
    if (!resp.ok) return null;
    return resp.json();
  } catch {
    return null;
  }
}

function containsIndianPincode(text) {
  return /\b[1-9][0-9]{5}\b/.test(text || '');
}

function findNlpEntity(query) {
  const text = (query || '').toLowerCase();
  if (!text) return '';
  if (CONTRACTOR_KEYWORDS.some((kw) => text.includes(kw))) return 'contractor';
  if (DEALER_KEYWORDS.some((kw) => text.includes(kw))) return 'dealer';
  return '';
}

function extractLocationFromQuery(query) {
  const match = (query || '').match(/\b(?:in|near|at)\s+([^,]+)$/i);
  if (!match) return '';
  return match[1].trim();
}

async function fetchDetectedLocations(query) {
  if (!query || query.length < 3) return [];
  try {
    const params = new URLSearchParams({ text: query });
    const resp = await fetchFromAp(`${AP_PATHS.DETECT_LOCATION}?${params}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'include',
    });
    if (!resp) return [];
    const data = await resp.json();
    if (!Array.isArray(data?.locations)) return [];
    return data.locations
      .map((loc) => (typeof loc === 'string' ? loc : loc?.location))
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function fetchContractorsByLocation(location) {
  if (!location) return [];
  try {
    const key = containsIndianPincode(location) ? 'pinCode' : 'area';
    const params = new URLSearchParams({ [key]: location, _: String(Date.now()) });
    const resp = await fetchFromAp(`${AP_PATHS.CONTRACTOR_PROFILE}?${params}`, { credentials: 'include' });
    if (!resp) return null;
    const data = await resp.json();
    return Array.isArray(data?.data) ? data.data : [];
  } catch {
    return null;
  }
}

const placeCoordinatesCache = new Map();

async function fetchLocationCoordinates(location) {
  const key = (location || '').trim().toLowerCase();
  if (!key) return null;
  if (placeCoordinatesCache.has(key)) return placeCoordinatesCache.get(key);

  try {
    const resp = await fetch(AP_GEO_PLACE.API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': AP_GEO_PLACE.API_KEY,
        'X-Goog-FieldMask': AP_GEO_PLACE.FIELD_MASK,
      },
      body: JSON.stringify({ textQuery: location, maxResultCount: 1 }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const coords = data?.places?.[0]?.location;
    if (coords?.latitude == null || coords?.longitude == null) return null;
    placeCoordinatesCache.set(key, coords);
    return coords;
  } catch {
    return null;
  }
}

async function fetchDealersByLocation(location) {
  if (!location) return [];
  const coords = await fetchLocationCoordinates(location);
  if (!coords) return null;

  try {
    const params = new URLSearchParams({
      latitude: String(coords.latitude),
      longitude: String(coords.longitude),
      radius: '5000',
      limit: '4',
      typeofretailer: DEALER_LOCATOR_TYPE_FILTER,
    });
    const resp = await fetchFromAp(`${AP_PATHS.DEALER_LOCATOR}?_=${Date.now()}`, {
      method: 'POST',
      body: params,
      credentials: 'include',
    });
    if (!resp) return null;
    const data = await resp.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────
//  API: MiniCart
// ──────────────────────────────────────────────

async function fetchMiniCartCount() {
  try {
    const resp = await fetchFromAp(`${getApApi().MINI_CART}?_=${Date.now()}`, { credentials: 'include' });
    if (!resp) return 0;
    const data = await resp.json();
    if (data.status === 'failure') return 0;
    return data.totalItems || data.count || 0;
  } catch {
    return 0;
  }
}

function updateCartBadge(block, count) {
  const badge = block.querySelector('.cart-badge');
  if (!badge) return;
  badge.textContent = String(count);
  badge.style.display = 'flex';
  badge.setAttribute('aria-hidden', 'false');
}

async function primeLocationContext() {
  try {
    await fetchFromAp(`${AP_PATHS.DETECT_LOCATION}?_=${Date.now()}`, { credentials: 'include' });
  } catch {
    // no-op; location enrichment is best-effort
  }
}

// ──────────────────────────────────────────────
//  API: Keycloak Authentication
// ──────────────────────────────────────────────

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function loadStylesheet(href, parent = document.head) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`link[href="${href}"]`)) {
      resolve();
      return;
    }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.onload = resolve;
    link.onerror = reject;
    parent.appendChild(link);
  });
}

let unbxdHostedAssetsPromise = null;

function ensureUnbxdHostedAssetsLoaded() {
  if (unbxdHostedAssetsPromise) return unbxdHostedAssetsPromise;

  const environment = getDomainEnvironment();
  const assets = UNBXD_HOSTED_ASSETS[environment] || UNBXD_HOSTED_ASSETS[DOMAIN_ENV.BETA];

  unbxdHostedAssetsPromise = Promise.all([
    loadStylesheet(assets.css),
    loadScript(assets.ua),
    loadScript(assets.autosuggest),
  ]).catch((error) => {
    unbxdHostedAssetsPromise = null;
    throw error;
  });

  return unbxdHostedAssetsPromise;
}

const KEYCLOAK_ID_TOKEN_STORAGE = 'keycloak-id-token';

function persistKeycloakTokens() {
  if (!keycloakInstance?.authenticated) return;
  try {
    localStorage.setItem('keycloak-token', keycloakInstance.token);
    localStorage.setItem('keycloak-refresh-token', keycloakInstance.refreshToken ?? '');
    /* OIDC RP-initiated logout requires id_token_hint to be the ID token
     * (typ: "ID"), not the access token. Store it separately so sign-out
     * can use the correct token. Sending the access token here yields
     * `400 Invalid parameter: id_token_hint` from Keycloak. */
    if (keycloakInstance.idToken) {
      localStorage.setItem(KEYCLOAK_ID_TOKEN_STORAGE, keycloakInstance.idToken);
    }
    if (keycloakInstance.idTokenParsed) {
      localStorage.setItem('userProfile', JSON.stringify(keycloakInstance.idTokenParsed));
    }
    document.cookie = `keycloak_authToken=${keycloakInstance.token}; path=/`;
  } catch (e) { /* ignore */ }
}

function clearKeycloakTokens() {
  try {
    localStorage.removeItem('keycloak-token');
    localStorage.removeItem(KEYCLOAK_ID_TOKEN_STORAGE);
    localStorage.removeItem('keycloak-refresh-token');
    localStorage.removeItem('userProfile');
    document.cookie = 'keycloak_authToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  } catch (e) { /* ignore */ }
}

/* Resolve a REAL ID token (typ: "ID") for Keycloak's id_token_hint on logout.
 * We deliberately do NOT fall back to the access token (typ: "Bearer") here -
 * Keycloak rejects access tokens as id_token_hint with `400 Invalid parameter`.
 * Returning null lets the caller decide to omit the hint (Keycloak will then
 * show its logout confirmation page) instead of guaranteeing a 400. */
function getLogoutIdTokenHint() {
  if (keycloakInstance?.authenticated && keycloakInstance.idToken) {
    return keycloakInstance.idToken;
  }
  try {
    return localStorage.getItem(KEYCLOAK_ID_TOKEN_STORAGE) || null;
  } catch {
    return null;
  }
}

/* keycloak-js doesn't fetch a fresh id_token when restoring an existing
 * session from stored access+refresh tokens, so keycloakInstance.idToken can
 * be undefined. A forced refresh hits /token with grant_type=refresh_token,
 * which returns id_token because `openid` is in scope. */
async function ensureFreshIdToken() {
  if (!keycloakInstance?.authenticated) return;
  if (keycloakInstance.idToken) return;
  if (!keycloakInstance.refreshToken && !localStorage.getItem('keycloak-refresh-token')) return;
  try {
    if (!keycloakInstance.refreshToken) {
      keycloakInstance.refreshToken = localStorage.getItem('keycloak-refresh-token') || undefined;
    }
    await keycloakInstance.updateToken(-1);
    if (keycloakInstance.idToken) {
      try {
        localStorage.setItem(KEYCLOAK_ID_TOKEN_STORAGE, keycloakInstance.idToken);
      } catch { /* ignore */ }
    }
  } catch (e) {
    /* refresh failed (e.g., refresh token expired). Caller will fall back. */
  }
}

function showWelcomeUserPopup(block, username) {
  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  if (hashParams && hashParams.get('iss') != null) {
    const greeting = block?.querySelector('.profile-greeting');
    if (greeting && username) {
      greeting.textContent = `Hello ${String(username).toUpperCase()}`;
      greeting.classList.add('visible');
      setTimeout(() => {
        greeting.classList.remove('visible');
      }, 2000);
    }
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }
}

function updateProfileUI(block, authenticated) {
  const profileBtn = block.querySelector('.action-btn.profile-btn');
  if (!profileBtn) return;

  const greeting = block.querySelector('.profile-greeting');
  const profileImg = profileBtn.querySelector('img');
  const setProfileIcon = (loggedIn) => {
    if (!profileImg) return;
    const nextSrc = loggedIn ? profileImg.dataset.loggedInSrc : profileImg.dataset.loggedOutSrc;
    if (nextSrc) profileImg.src = nextSrc;
  };

  if (authenticated && keycloakInstance?.tokenParsed) {
    const name = keycloakInstance.tokenParsed.given_name
      || keycloakInstance.tokenParsed.name
      || '';
    profileBtn.classList.add('logged-in');
    block.querySelector('.profile-dropdown-wrapper')?.classList.add('is-logged-in');
    setProfileIcon(true);
    // Shared code: showWelcomeUserPopup only when returning from auth (hash has iss)
    showWelcomeUserPopup(block, name || keycloakInstance.tokenParsed.preferred_username || '');
    try {
      const idToken = keycloakInstance.idToken ?? keycloakInstance.token;
      // eslint-disable-next-line no-use-before-define
      setUser({
        name: name || keycloakInstance.tokenParsed.preferred_username || '',
        email: keycloakInstance.tokenParsed.email || '',
        id_token: idToken,
        refresh_token: keycloakInstance.refreshToken,
      });
      persistKeycloakTokens();
    } catch (err) { /* ignore */ }
  } else {
    profileBtn.classList.remove('logged-in');
    block.querySelector('.profile-dropdown-wrapper')?.classList.remove('is-logged-in');
    setProfileIcon(false);
    if (greeting) greeting.classList.remove('visible');
    clearKeycloakTokens();
    window.dispatchEvent(new CustomEvent('keycloakLoginNotReady', {
      detail: { token: keycloakInstance?.token, userId: keycloakInstance?.subject },
    }));
  }
}

/**
 * Whether to attempt the full Keycloak auth flow. Always attempted,
 * regardless of domain, so local/preview environments behave the same
 * as production.
 * */
function shouldInitKeycloak() {
  return true;
}

function canUsePersistedAuth() {
  if (isOnAsianPaintsDomain()) return true;
  try {
    return sessionStorage.getItem(AUTH_REDIRECTED_KEY) === '1';
  } catch {
    return false;
  }
}

function refreshToken(block) {
  if (!keycloakInstance?.authenticated) return;
  keycloakInstance.updateToken(30)
    .then((refreshed) => {
      if (refreshed) {
        console.log('Token refreshed:', keycloakInstance.token);
        localStorage.setItem('keycloak-token', keycloakInstance.token);
        localStorage.setItem('keycloak-refresh-token', keycloakInstance.refreshToken ?? '');
        if (keycloakInstance.idToken) {
          localStorage.setItem(KEYCLOAK_ID_TOKEN_STORAGE, keycloakInstance.idToken);
        }
        document.cookie = `keycloak_authToken=${keycloakInstance.token}; path=/`;
      } else {
        console.log('Token still valid, no need to refresh.');
      }
    })
    .catch((error) => {
      console.error('Failed to refresh token:', error);
      updateProfileUI(block, false);
    });
}

async function initKeycloak(block) {
  if (!shouldInitKeycloak()) {
    const storedUser = (() => {
      if (keycloakInstance?.authenticated && keycloakInstance?.tokenParsed) return true;
      if (!canUsePersistedAuth()) return false;
      try {
        return !!(localStorage.getItem('userProfile') && localStorage.getItem('keycloak-token'));
      } catch {
        return false;
      }
    })();
    const profileBtn = block.querySelector('.action-btn.profile-btn');
    const profileImg = profileBtn?.querySelector('img');
    const setProfileIcon = (loggedIn) => {
      if (!profileImg) return;
      const nextSrc = loggedIn ? profileImg.dataset.loggedInSrc : profileImg.dataset.loggedOutSrc;
      if (nextSrc) profileImg.src = nextSrc;
    };
    profileBtn?.classList.toggle('logged-in', !!storedUser);
    block.querySelector('.profile-dropdown-wrapper')?.classList.toggle('is-logged-in', !!storedUser);
    setProfileIcon(!!storedUser);
    return;
  }

  try {
    await loadScript(getApApi().KEYCLOAK_JS);
    /* global Keycloak */
    if (typeof Keycloak === 'undefined') {
      updateProfileUI(block, false);
      return;
    }
    const storedToken = localStorage.getItem('keycloak-token');
    const storedRefreshToken = localStorage.getItem('keycloak-refresh-token');

    keycloakInstance = new Keycloak({
      url: getApApi().KEYCLOAK_URL,
      realm: getApApi().KEYCLOAK_REALM,
      clientId: getApApi().KEYCLOAK_CLIENT,
      enablePersistent: true,
    });

    /* Silent-check-sso target. Must be same-origin with the EDS page so the
     * iframe can postMessage back to the parent. Previously pointed at
     * `/content/ap/en/home/key-cloak.html` — a full AEM Sites page that
     * pulled ~290 KB of AMS clientlibs (including clientlib-analytics) into
     * the iframe and, because of same-origin event-loop sharing, billed
     * their parse cost to the parent's main thread (TBT ~7.1 s on PSI).
     *
     * Pointing at the minimal /eds/silent-check-sso.html keeps the keycloak-js
     * silent SSO check working (it only needs `parent.postMessage`) while
     * loading 0 clientlibs and ~0 KB of JS in the iframe. */
    const ssoRedirect = `${window.location.origin}/eds/silent-check-sso.html`;

    const authenticated = await keycloakInstance.init({
      onLoad: 'check-sso',
      pkceMethod: 'S256',
      silentCheckSsoRedirectUri: ssoRedirect,
      checkLoginIframe: false,
      enableLogging: true,
      timeSkew: 5,
      Storage: localStorage,
      token: storedToken || undefined,
      refreshToken: storedRefreshToken || undefined,
    });

    updateProfileUI(block, authenticated);

    if (typeof authenticated !== 'undefined' && authenticated) {
      const returnedFromAuth = (() => {
        try {
          return localStorage.getItem(POST_LOGIN_REDIRECT_FLAG_KEY) === 'true'
            || sessionStorage.getItem(POST_LOGIN_REDIRECT_FLAG_KEY) === 'true';
        } catch (err) {
          return false;
        }
      })();
      /* Persist tokens right after init so the id_token (when keycloak-js
       * provides one) is stored for future page loads. */
      persistKeycloakTokens();
      if (returnedFromAuth) {
        trackLoginSuccessfulOnce('login successful');
        try {
          localStorage.removeItem(SIGNED_OUT_KEY);
        } catch (err) { /* ignore */ }
      }
      window.dispatchEvent(new CustomEvent('keycloakLoginReady', {
        detail: { token: keycloakInstance.token, userId: keycloakInstance.subject },
      }));
      document.dispatchEvent(new CustomEvent('user-loggedIn'));
      const count = await fetchMiniCartCount();
      updateCartBadge(block, count);
      setTimeout(() => {
        const redirectPath = consumePostLoginRedirectPath();
        if (redirectPath && redirectPath !== window.location.href) {
          window.location.href = redirectPath;
        }
      }, 1000);
      if (localStorage.getItem('userCheckoutAction')=='true'){
          localStorage.removeItem('userCheckoutAction');
          window.headerMiniCart.checkoutRedirectLogin();
      }
    }

    keycloakInstance.onTokenExpired = () => {
      refreshToken(block);
    };

    // Periodic token refresh every 30 seconds (matches original site)
    setInterval(() => refreshToken(block), 30000);
  } catch (e) {
    console.log(e);
    console.error('Failed to initialize Keycloak', e);
    updateProfileUI(block, false);
    window.dispatchEvent(new CustomEvent('keycloakLoginNotReady', {
      detail: { token: null, userId: null },
    }));
  }
}

async function handleProfileClick(e) {
  if (keycloakInstance?.authenticated) {
    // e7 - Profile icon click must fire on every header icon click,
    // logged in or not (matches the live site). Use the 'Login Icon Click'
    // alias so the beacon Link name matches production exactly. Give the
    // beacon a brief moment before navigating to the profile page.
    trackEvent('Login Icon Click');
    await new Promise((resolve) => setTimeout(resolve, 150));
    window.location.href = getApApi().PROFILE_PAGE;
    return;
  }

  e.preventDefault();
  // e7 - Login Icon Click (must fire on header icon click)
  trackEvent('login_icon');
  ga4Implementaion({
    event: 'header_interaction',
    click_text: 'Profile Icon',
    click_category: 'click_header icons',
  });


  pushAdobeCtaClickEvent ({
    cta: 'Profile Icon',
    event: 'login_icon'
  });


  // Production: redirect to OIDC auth URL (auth.asianpaints.com)
  persistPostLoginRedirectPath();
  // eslint-disable-next-line no-use-before-define
  const url = await buildProfileAuthUrl(AUTH_REDIRECT_URI);
  // Give the analytics beacon a brief moment before navigation.
  await new Promise((resolve) => setTimeout(resolve, 150));
  window.location.href = url;
}

// ──────────────────────────────────────────────
//  Visual Search: File Validation + Upload
// ──────────────────────────────────────────────

function validateVisualSearchFile(file) {
  if (!file) return { valid: false, error: 'No file selected' };
  if (!VS_ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: 'Only JPG, JPEG and PNG file formats are allowed' };
  }
  if (file.size > VS_MAX_SIZE_MB * 1024 * 1024) {
    return { valid: false, error: `Max file size limit is ${VS_MAX_SIZE_MB}MB` };
  }
  return { valid: true, error: null };
}

function readFileAsDataUrl(file, onProgress = () => { }) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const readPercent = Math.round((event.loaded / event.total) * 30);
      onProgress(readPercent);
    };
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getCookieValue(name) {
  const escaped = String(name || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : '';
}

function setVisualUploadProgress(modal, value) {
  const progressBar = modal.querySelector('.upload-progress-section .progress-bar');
  if (!progressBar) return;
  const progressValue = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  progressBar.style.width = `${progressValue}%`;
  progressBar.setAttribute('aria-valuenow', String(progressValue));
}

function showVisualUploadProgress(modal, file) {
  const statusEl = modal.querySelector('.vs-status');
  const errorEl = modal.querySelector('.vs-error');
  const mobileErrorEl = modal.querySelector('.vs-mobile-error');
  const uploadProgressSection = modal.querySelector('.upload-progress-section');
  const selectedImageName = modal.querySelector('.selected-image-name');

  modal.classList.add('is-uploading');

  if (statusEl) {
    statusEl.textContent = '';
    statusEl.style.display = 'none';
  }

  if (errorEl) {
    errorEl.textContent = '';
    errorEl.style.display = 'none';
  }

  if (mobileErrorEl) {
    mobileErrorEl.textContent = '';
    mobileErrorEl.style.display = 'none';
  }

  if (selectedImageName) {
    selectedImageName.textContent = file?.name || '';
  }

  if (uploadProgressSection) {
    uploadProgressSection.style.display = 'flex';
  }

  setVisualUploadProgress(modal, 0);
}

function hideVisualUploadProgress(modal) {
  const uploadProgressSection = modal.querySelector('.upload-progress-section');

  modal.classList.remove('is-uploading');

  if (uploadProgressSection) {
    uploadProgressSection.style.display = 'none';
  }

  setVisualUploadProgress(modal, 0);
}


// function showVisualSearchError(modal, message) {
//   const statusEl = modal.querySelector('.vs-status');
//   const errorEl = modal.querySelector('.vs-error');

//   hideVisualUploadProgress(modal);

//   if (statusEl) {
//     statusEl.textContent = '';
//     statusEl.style.display = 'none';
//   }

//   if (errorEl) {
//     errorEl.textContent = message;
//     errorEl.style.display = 'block';
//   }
// }
function showVisualSearchError(modal, message) {
  const statusEl = modal.querySelector('.vs-status');
  const errorEl = modal.querySelector('.vs-error');
  const mobileErrorEl = modal.querySelector('.vs-mobile-error');

  hideVisualUploadProgress(modal);

  if (statusEl) {
    statusEl.textContent = '';
    statusEl.style.display = 'none';
  }

  if (errorEl) {
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  }

  if (mobileErrorEl) {
    mobileErrorEl.textContent = message;
    mobileErrorEl.style.display = 'block';
  }
}


function postVisualSearchUpload(formBody, onProgress = () => { }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open('POST', apUrl(AP_PATHS.VISUAL_SEARCH_UPLOAD), true);
    xhr.withCredentials = true;

    xhr.setRequestHeader(
      'Content-Type',
      'application/x-www-form-urlencoded; charset=UTF-8'
    );

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;

      const uploadPercent = event.loaded / event.total;

      // File read covers 0-35, upload covers 35-90
      const mappedProgress = 35 + (uploadPercent * 55);

      onProgress(mappedProgress);
    };

    xhr.onload = () => {
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        text: () => Promise.resolve(xhr.responseText || ''),
      });
    };

    xhr.onerror = () => reject(new Error('Visual search upload failed'));
    xhr.onabort = () => reject(new Error('Visual search upload aborted'));

    xhr.send(formBody.toString());
  });
}

async function uploadVisualSearchImage(file, modal) {
  const validation = validateVisualSearchFile(file);

  if (!validation.valid) {
    showVisualSearchError(modal, validation.error);
    return;
  }

  showVisualUploadProgress(modal, file);

  try {
    setVisualUploadProgress(modal, 5);

    const imageDetails = await readFileAsDataUrl(file, (progress) => {
      setVisualUploadProgress(modal, progress);
    });

    if (!imageDetails) {
      throw new Error('Unable to read image');
    }

    setVisualUploadProgress(modal, 35);

    const fileName = file.name || 'uploaded-image';

    const formBody = new URLSearchParams({
      imageDetails: encodeURIComponent(imageDetails),
      referer: document.referrer || '',
      pageUrl: window.location.href,
      uid: getCookieValue('unbxd.userId'),
      visit: getCookieValue('unbxd.visit'),
      visitId: getCookieValue('unbxd.visitId'),
    });

    const resp = await postVisualSearchUpload(formBody, (progress) => {
      setVisualUploadProgress(modal, progress);
    });

    if (resp?.ok) {
      setVisualUploadProgress(modal, 95);

      const responseText = await resp.text();

      let data = null;

      try {
        data = responseText ? JSON.parse(responseText) : null;
      } catch {
        data = responseText;
      }

      const redirectUrl = data?.redirectUrl || data?.redirectURL || data?.url;

      if (redirectUrl && /^https?:\/\//i.test(String(redirectUrl))) {
        setVisualUploadProgress(modal, 100);
        window.location.href = redirectUrl;
        return;
      }

      if (typeof data?.totalCount !== 'undefined') {
        const totalCount = Number(data.totalCount) || 0;

        trackImageSearchComplete(totalCount);

        if (totalCount === 0) {
          trackNoResultFound('Image');
        }

        localStorage.setItem(
          'uploaded-image-search-name',
          fileName.replace(/\.[^.]+$/, '')
        );

        setVisualUploadProgress(modal, 100);

        window.location.href = `${getApApi().SEARCH_RESULTS}?variantType=visualsearch&ts=${Date.now()}`;
        return;
      }

      setVisualUploadProgress(modal, 100);

      setTimeout(() => {
        hideVisualUploadProgress(modal);
      }, 800);

      return;
    }

    showVisualSearchError(modal, 'Oops file upload failed, please try again!');
  } catch {
    showVisualSearchError(modal, 'Oops file upload failed, please try again!');
  }
}
function navigateToSearchResults(query) {
  if (!query || !query.trim()) return;
  window.location.href = `${getApApi().SEARCH_RESULTS}?q=${encodeURIComponent(query.trim())}`;
}

function getSearchResultUrl(query) {
  return `${getApApi().SEARCH_RESULTS}?q=${encodeURIComponent((query || '').trim())}`;
}

function getEntityExploreUrl(entity, query, location) {
  if (!location) return getSearchResultUrl(query);
  if (entity === 'contractor') {
    const mode = containsIndianPincode(query) ? 'pinCode' : 'area';
    return `${getApApi().CONTRACTOR_PAGE}?cpListing=${mode}:${encodeURIComponent(location)}`;
  }
  if (entity === 'dealer') {
    return `${getApApi().DEALER_PAGE}?q=${encodeURIComponent(location)}`;
  }
  return getSearchResultUrl(query);
}

function setLocationResultState(dialog, state) {
  const panel = dialog.querySelector('.sd-location-results');
  const title = dialog.querySelector('.sd-location-title');
  const list = dialog.querySelector('.sd-location-list');
  const empty = dialog.querySelector('.sd-location-empty');
  const explore = dialog.querySelector('.sd-location-explore');
  if (!panel || !title || !list || !empty || !explore) return;

  panel.classList.remove('active');
  list.innerHTML = '';
  empty.style.display = 'none';
  explore.style.display = 'none';
  explore.removeAttribute('href');

  if (!state || !state.visible) return;

  panel.classList.add('active');
  title.textContent = state.title || '';
  if (state.emptyText) {
    empty.textContent = state.emptyText;
    empty.style.display = 'block';
  }
  if (state.exploreHref) {
    explore.href = state.exploreHref;
    explore.style.display = '';
  }
}

function renderContractorLocationResults(dialog, query, location, contractors) {
  const list = dialog.querySelector('.sd-location-list');
  if (!list) return;

  const exploreHref = getEntityExploreUrl('contractor', query, location);
  const locationLabel = location || 'selected location';

  if (!Array.isArray(contractors) || contractors.length === 0) {
    setLocationResultState(dialog, {
      visible: true,
      title: `Contractors near ${locationLabel}`,
      emptyText: 'Contractors not found for this location',
      exploreHref,
    });
    return;
  }

  setLocationResultState(dialog, {
    visible: true,
    title: `Contractors near ${locationLabel}`,
    exploreHref,
  });

  contractors.slice(0, 4).forEach((contractor) => {
    const card = document.createElement('a');
    card.className = 'sd-location-card';
    card.href = contractor.contractorId
      ? apUrl(`/content/ap/en/home/contractor-locator.${contractor.contractorId}.html`)
      : exploreHref;

    const name = document.createElement('div');
    name.className = 'sd-location-name';
    name.textContent = `${contractor.firstName || ''} ${contractor.lastName || ''}`.trim() || 'Contractor';

    const area = document.createElement('div');
    area.className = 'sd-location-meta';
    area.textContent = contractor.areasServiced?.[0] || locationLabel;

    const rating = document.createElement('div');
    rating.className = 'sd-location-rating';
    const avg = contractor.avgRating || '0';
    const reviews = contractor.totalRatingsCount || 0;
    rating.textContent = `★ ${avg} (${reviews} reviews)`;

    card.append(name, area, rating);
    list.appendChild(card);
  });
}

function renderDealerLocationResults(dialog, query, location, dealers = []) {
  const list = dialog.querySelector('.sd-location-list');
  if (!list) return;

  const locationLabel = location || 'selected location';
  const exploreHref = getEntityExploreUrl('dealer', query, location);

  if (!Array.isArray(dealers) || dealers.length === 0) {
    setLocationResultState(dialog, {
      visible: true,
      title: `Dealers near ${locationLabel}`,
      emptyText: 'Use Explore dealers to view nearby stores',
      exploreHref,
    });
    return;
  }

  setLocationResultState(dialog, {
    visible: true,
    title: `Dealers near ${locationLabel}`,
    exploreHref,
  });

  dealers.slice(0, 4).forEach((dealer) => {
    const card = document.createElement('a');
    card.className = 'sd-location-card';
    if (dealer.latitude && dealer.longitude) {
      card.href = `https://www.google.com/maps/dir/,/${dealer.latitude},${dealer.longitude}`;
      card.target = '_blank';
      card.rel = 'noopener noreferrer';
    } else {
      card.href = exploreHref;
    }

    const name = document.createElement('div');
    name.className = 'sd-location-name';
    name.textContent = dealer.contactname || 'Nearby Store';

    const address = document.createElement('div');
    address.className = 'sd-location-meta';
    address.textContent = dealer.address || locationLabel;

    const meta = document.createElement('div');
    meta.className = 'sd-location-rating';
    if (dealer.typeofretailer && dealer.mobileno) {
      meta.textContent = `${dealer.typeofretailer} | +91 ${dealer.mobileno}`;
    } else if (dealer.typeofretailer) {
      meta.textContent = dealer.typeofretailer;
    } else if (dealer.mobileno) {
      meta.textContent = `+91 ${dealer.mobileno}`;
    } else {
      meta.textContent = 'Store details available';
    }

    card.append(name, address, meta);
    list.appendChild(card);
  });
}

/* eslint-disable-next-line max-len */
async function handleLocationAwareSearch(dialog, query, requestToken = 0, getActiveToken = () => requestToken) {
  const isStale = () => requestToken !== getActiveToken();
  if (isStale()) return;

  const entity = findNlpEntity(query);
  if (!entity) {
    if (isStale()) return;
    setLocationResultState(dialog, { visible: false });
    return;
  }

  const locations = await fetchDetectedLocations(query);
  if (isStale()) return;
  let [location] = locations;
  if (!location && !isOnAsianPaintsDomain()) {
    location = extractLocationFromQuery(query);
  }
  if (location && location.trim().length < 3) {
    setLocationResultState(dialog, { visible: false });
    return;
  }
  if (!location) {
    if (isStale()) return;
    setLocationResultState(dialog, { visible: false });
    return;
  }

  if (entity === 'contractor') {
    const contractors = await fetchContractorsByLocation(location);
    if (isStale()) return;
    if (contractors === null) {
      const unavailableText = isOnAsianPaintsDomain()
        ? 'Contractors not found for this location'
        : 'Live contractor preview is unavailable in local mode. Use Explore contractors.';
      setLocationResultState(dialog, {
        visible: true,
        title: `Contractors near ${location}`,
        emptyText: unavailableText,
        exploreHref: getEntityExploreUrl('contractor', query, location),
      });
      return;
    }
    if (!isOnAsianPaintsDomain() && Array.isArray(contractors) && contractors.length === 0) {
      setLocationResultState(dialog, {
        visible: true,
        title: `Contractors near ${location}`,
        emptyText: 'Live contractor preview is unavailable in local mode. Use Explore contractors.',
        exploreHref: getEntityExploreUrl('contractor', query, location),
      });
      return;
    }
    renderContractorLocationResults(dialog, query, location, contractors);
    return;
  }

  const dealers = await fetchDealersByLocation(location);
  if (isStale()) return;
  if (dealers === null) {
    const unavailableText = isOnAsianPaintsDomain()
      ? 'Use Explore dealers to view nearby stores'
      : 'Live dealer preview is unavailable in local mode. Use Explore dealers.';
    setLocationResultState(dialog, {
      visible: true,
      title: `Dealers near ${location}`,
      emptyText: unavailableText,
      exploreHref: getEntityExploreUrl('dealer', query, location),
    });
    return;
  }
  if (!isOnAsianPaintsDomain() && Array.isArray(dealers) && dealers.length === 0) {
    setLocationResultState(dialog, {
      visible: true,
      title: `Dealers near ${location}`,
      emptyText: 'Live dealer preview is unavailable in local mode. Use Explore dealers.',
      exploreHref: getEntityExploreUrl('dealer', query, location),
    });
    return;
  }
  renderDealerLocationResults(dialog, query, location, dealers);
}

// ──────────────────────────────────────────────
//  Search Dialog: Full-screen overlay
// ──────────────────────────────────────────────

function normalizeImageUrl(imageUrl) {
  const value = Array.isArray(imageUrl) ? imageUrl[0] : imageUrl;
  if (!value || typeof value !== 'string') return '';
  if (value.startsWith('//')) return `https:${value}`;
  if (value.startsWith('/')) return apUrl(value);
  return value;
}

function isRenderableImageUrl(url) {
  if (!url) return false;
  const hasImageShape = /\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(url) || url.includes('/content/dam/');
  if (!hasImageShape) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    if (host.includes('.transform')) return false;
    if (host === 'localhost' || host === '127.0.0.1') return true;
    return host.endsWith('asianpaints.com')
      || host.endsWith('static.asianpaints.com')
      || host.endsWith('search.unbxd.io');
  } catch {
    return false;
  }
}

function getSwatchFallbackUrl(product) {
  const rawCode = product?.uniqueId || product?.entityCode || product?.sku || '';
  if (typeof rawCode !== 'string') return '';
  const normalized = rawCode.startsWith('en-') ? rawCode.slice(3) : rawCode;
  if (!/^[A-Za-z0-9]+$/.test(normalized)) return '';
  return `${getApOrigin()}/content/dam/asian_paints/colours/swatches/${normalized}.png.transform/cc-width-221-height-260/image.png`;
}

function isLikelyShadeCode(value) {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();
  return /^[A-Za-z]?\d{3,4}$/.test(trimmed);
}

function trackSearchAutoclick(dialogOrContainer, autoSearchTerm, linkHead = 'POPULAR_PRODUCTS') {
  const root = dialogOrContainer?.closest?.('.search-dialog') || dialogOrContainer;
  const searchTerm = root?.querySelector?.('.sd-search-input')?.value.trim() || '';
  const normalizedAutoSearchTerm = String(autoSearchTerm || '').replace(/\s+/g, ' ').trim();

  if (!normalizedAutoSearchTerm) return;

  if (typeof window.edsAnalytics?.trackEvent === 'function') {
    window.edsAnalytics.trackEvent('ub_search_autoclick', {
      autoSearchTerm: normalizedAutoSearchTerm,
      searchTerm,
      linkHead,
    });

        pushAdobeCtaClickEvent({
      searchTerm,
      cta: normalizedAutoSearchTerm,
      event: 'ub_search_autoclick',
    })
  }
}

function renderSearchProducts(container, products, isSwatch) {
  container.innerHTML = '';
  products.slice(0, 6).forEach((p) => {
    const card = document.createElement('a');
    card.className = 'sd-product-card';
    const productUrl = Array.isArray(p.productUrl) ? p.productUrl[0] : p.productUrl;
    card.href = productUrl
      ? resolveApLink(productUrl, getSearchResultUrl(p.title))
      : getSearchResultUrl(p.title);

    /* eslint-disable max-len */
    const directImage = normalizeImageUrl(p.imageUrl);
    const fallbackSwatch = isSwatch ? getSwatchFallbackUrl(p) : '';
    const imgUrl = isRenderableImageUrl(directImage) ? directImage : fallbackSwatch;
    /* eslint-enable max-len */
    if (imgUrl) {
      const img = document.createElement('img');
      img.src = imgUrl;
      img.alt = p.title || '';
      img.loading = 'lazy';
      card.appendChild(img);
    }

    const name = document.createElement('div');
    name.className = 'sd-product-name';
    name.textContent = p.title || '';

    const code = document.createElement('div');
    code.className = 'sd-product-code';
    const candidateCode = p.entityCode || p.sku || p.uniqueId?.replace('en-', '') || '';
    const safeCode = candidateCode.includes('/') ? '' : candidateCode;
    code.textContent = isLikelyShadeCode(safeCode) ? safeCode : '';
    if (!code.textContent) code.style.display = 'none';

    card.append(name, code);

    card.addEventListener('click', () => {
      trackSearchAutoclick(container, name.textContent, 'POPULAR_PRODUCTS');
    });
    
    container.appendChild(card);
  });
}

function getLegacyTopQueries(data) {
  const topQueries = data?.response?.topQueries;
  if (Array.isArray(topQueries?.TopQuery)) return topQueries.TopQuery;
  if (Array.isArray(topQueries?.topQuery)) return topQueries.topQuery;
  if (Array.isArray(topQueries)) return topQueries;
  return [];
}

function extractAutosuggestSections(data, preferInField = false) {
  const raw = data?.response?.products;
  let products = [];
  if (Array.isArray(raw?.product)) {
    products = raw.product;
  } else if (Array.isArray(raw)) {
    products = raw;
  }

  const popularProducts = products.filter((item) => item?.doctype === 'POPULAR_PRODUCTS');
  const inFieldProducts = products.filter((item) => item?.doctype === 'IN_FIELD');
  const topSearchQueries = products
    .filter((item) => item?.doctype === 'TOP_SEARCH_QUERIES' || item?.doctype === 'TRENDING_QUERIES')
    .map((item) => item?.autosuggest)
    .filter(Boolean);

  const legacyTopQueries = getLegacyTopQueries(data)
    .map((item) => item?.autosuggest || item?.title || '')
    .filter(Boolean);

  const seen = new Set();
  const dedupedTopQueries = [...topSearchQueries, ...legacyTopQueries]
    .filter((q) => {
      const lower = q.toLowerCase();
      if (seen.has(lower)) return false;
      seen.add(lower);
      return true;
    });

  const seenSuggestionKeys = new Set();
  const suggestions = [];
  inFieldProducts.forEach((item) => {
    const text = item?.autosuggest || item?.title || '';
    const category = getSuggestionCategory(item); // eslint-disable-line no-use-before-define
    if (!text) return;
    if (!category) return;
    const key = text.toLowerCase();
    if (seenSuggestionKeys.has(key)) return;
    seenSuggestionKeys.add(key);
    suggestions.push({
      text,
      category,
    });
  });

  let bestResults;
  if (preferInField) {
    bestResults = inFieldProducts.length ? inFieldProducts : popularProducts;
  } else {
    bestResults = popularProducts.length ? popularProducts : inFieldProducts;
  }

  return {
    bestResults: bestResults.length ? bestResults : products,
    topQueries: dedupedTopQueries,
    suggestions: suggestions.slice(0, 8),
  };
}

function getSuggestionCategory(item) {
  const fromCfTypeIn = Array.isArray(item?.cfType_in) ? item.cfType_in[0] : item?.cfType_in;
  const fromCfType = Array.isArray(item?.cfType) ? item.cfType[0] : item?.cfType;
  const rawType = String(fromCfTypeIn || fromCfType || '').toLowerCase().trim();
  if (!rawType) return '';
  const normalized = rawType.replaceAll(/\s+/g, '');
  return SUGGESTION_CATEGORY_LABELS[normalized] || '';
}

function renderTrendingQueries(dialog, queries = []) {
  const trendingContainer = dialog.querySelector('.sd-trending-list');
  if (!trendingContainer) return;

  trendingContainer.innerHTML = '';
  queries.forEach((suggestedQuery) => {
    const tag = document.createElement('button');
    tag.className = 'sd-trending-tag';
    tag.type = 'button';
    const icon = document.createElement('span');
    icon.className = 'sd-trending-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = TRENDING_ARROW_SVG;
    const label = document.createElement('span');
    label.textContent = suggestedQuery;
    tag.append(icon, label);
    tag.addEventListener('click', () => {
      const query = String(suggestedQuery || '').trim();
      if (!query) return;

      const input = dialog.querySelector('.sd-search-input');
      if (input) {
        input.value = query;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      trackSearchAutoclick(dialog, query, ' Trending Queries');
      navigateToSearchResults(query);
    });
    trendingContainer.appendChild(tag);
  });
}

function renderSearchDialogResults(dialog, data, options = {}) {
  const productsContainer = dialog.querySelector('.sd-best-results-grid');
  if (!productsContainer) return;

  const parsed = extractAutosuggestSections(data, Boolean(options.preferInField));
  renderSearchProducts(productsContainer, parsed.bestResults, true);
  const trendingQ = parsed.topQueries.length
    ? parsed.topQueries : FALLBACK_TRENDING_QUERIES;
  renderTrendingQueries(dialog, trendingQ);
  // eslint-disable-next-line no-use-before-define
  renderSuggestions(dialog, parsed.suggestions, Boolean(options.queryMode), options.queryText || '');
  // eslint-disable-next-line no-use-before-define
  toggleSearchDialogQueryMode(dialog, Boolean(options.queryMode));
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function highlightSuggestionMatch(text, query) {
  const source = String(text || '');
  const q = String(query || '').trim();
  if (!q) return escapeHtml(source);

  const sourceLower = source.toLowerCase();
  const qLower = q.toLowerCase();
  let cursor = 0;
  let html = '';

  while (cursor < source.length) {
    const matchIndex = sourceLower.indexOf(qLower, cursor);
    if (matchIndex === -1) {
      html += escapeHtml(source.slice(cursor));
      break;
    }
    html += escapeHtml(source.slice(cursor, matchIndex));
    html += `<strong>${escapeHtml(source.slice(matchIndex, matchIndex + q.length))}</strong>`;
    cursor = matchIndex + q.length;
  }

  return html;
}

function extractSearchProducts(data) {
  if (Array.isArray(data?.response?.products?.product)) {
    return data.response.products.product;
  }
  if (Array.isArray(data?.response?.products)) {
    return data.response.products;
  }
  return [];
}

async function previewSuggestionResults(dialog, query) {
  const trimmed = (query || '').trim();
  const productsContainer = dialog.querySelector('.sd-best-results-grid');
  if (!productsContainer || trimmed.length < 3) return;

  suggestionPreviewToken += 1;
  const token = suggestionPreviewToken;
  const cacheKey = trimmed.toLowerCase();

  let products = suggestionPreviewCache.get(cacheKey);
  if (!products) {
    const searchData = await fetchUnbxdSearch(trimmed);
    if (!searchData) return;
    products = extractSearchProducts(searchData);
    suggestionPreviewCache.set(cacheKey, products);
  }

  if (token !== suggestionPreviewToken) return;
  renderSearchProducts(productsContainer, products, false);
  const seeAll = dialog.querySelector('.sd-see-all');
  if (seeAll) seeAll.href = getSearchResultUrl(trimmed);
}

function restoreInputResults(dialog) {
  const input = dialog.querySelector('.sd-search-input');
  const seeAll = dialog.querySelector('.sd-see-all');
  const query = (input?.value || '').trim();
  if (seeAll) {
    seeAll.href = query ? getSearchResultUrl(query) : getApApi().SEARCH_RESULTS;
  }
  if (query.length >= 3) {
    handleSearchDialogSearchResults(dialog, query); // eslint-disable-line no-use-before-define
  }
}

function renderSuggestions(dialog, suggestions = [], queryMode = false, activeQuery = '') {
  const list = dialog.querySelector('.sd-suggestions-list');
  if (!list) return;

  list.innerHTML = '';
  list.onmouseleave = null;
  list.onfocusout = null;

  if (!queryMode) {
    SEARCH_SUGGESTIONS_LINKS.forEach((link) => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = link.href;
      a.textContent = link.text;
      a.addEventListener('click', () => {
        trackSearchAutoclick(dialog, link.text, 'Suggestions');
      });
      li.appendChild(a);
      list.appendChild(li);
    });
    return;
  }

  if (!suggestions.length) return;

  list.onmouseleave = () => {
    suggestionPreviewToken += 1;
    restoreInputResults(dialog);
  };
  list.onfocusout = (event) => {
    if (!list.contains(event.relatedTarget)) {
      suggestionPreviewToken += 1;
      restoreInputResults(dialog);
    }
  };

  const grouped = new Map(SUGGESTION_CATEGORY_ORDER.map((category) => [category, []]));
  suggestions.forEach((entry) => {
    if (!entry?.category) return;
    if (!grouped.has(entry.category)) return;
    grouped.get(entry.category).push(entry);
  });

  const categoriesWithEntries = [...grouped.entries()].filter(([, entries]) => entries.length > 0);
  categoriesWithEntries.forEach(([category, entries], index) => {
    const isLastCategory = index === categoriesWithEntries.length - 1;
    const headerLi = document.createElement('li');
    headerLi.className = `sd-suggestion-category${isLastCategory ? ' sd-suggestion-category-last' : ''}`;
    headerLi.textContent = category;
    list.appendChild(headerLi);

    entries.forEach((entry) => {
      const suggestedQuery = entry.text;
      const li = document.createElement('li');
      li.className = 'sd-suggestion-item';
      const a = document.createElement('a');
      a.href = getSearchResultUrl(suggestedQuery);
      a.innerHTML = highlightSuggestionMatch(suggestedQuery, activeQuery);
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const input = dialog.querySelector('.sd-search-input');
        if (input) {
          input.value = suggestedQuery;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
      a.addEventListener('mouseenter', () => {
        previewSuggestionResults(dialog, suggestedQuery);
      });
      a.addEventListener('focus', () => {
        previewSuggestionResults(dialog, suggestedQuery);
      });
      li.appendChild(a);
      list.appendChild(li);
    });
  });
}

function toggleSearchDialogQueryMode(dialog, active) {
  dialog.classList.toggle('sd-query-mode', active);
}

async function handleSearchDialogQuery(dialog, query) {
  const trimmed = (query || '').trim();
  if (!trimmed) {
    toggleSearchDialogQueryMode(dialog, false);
    const initial = await fetchUnbxdAutosuggest('*', {
      inFieldsCount: 0,
      topQueriesCount: 8,
      popularProductsCount: 6,
      includeSourceFields: true,
    });
    if (initial) renderSearchDialogResults(dialog, initial, { preferInField: false, queryMode: false, queryText: '' });
    else {
      renderTrendingQueries(dialog, FALLBACK_TRENDING_QUERIES);
      renderSuggestions(dialog, [], false, '');
    }
    return;
  }

  toggleSearchDialogQueryMode(dialog, true);

  if (trimmed.length < 3) {
    renderSuggestions(dialog, [], true, trimmed);
    return;
  }

  const autoData = await fetchUnbxdAutosuggest(trimmed, {
    inFieldsCount: 10,
    topQueriesCount: 0,
    popularProductsCount: 6,
    includeSourceFields: true,
  });

  if (autoData) {
    renderSearchDialogResults(dialog, autoData, {
      preferInField: true, queryMode: true, queryText: trimmed,
    });
  }
}

async function handleSearchDialogSearchResults(dialog, query) {
  const productsContainer = dialog.querySelector('.sd-best-results-grid');
  if (!productsContainer || !query || query.length < 3) return;

  const searchData = await fetchUnbxdSearch(query);
  if (!searchData) return;

  const searchProducts = extractSearchProducts(searchData);
  renderSearchProducts(productsContainer, searchProducts, false);
}

function buildLoginModal() {
  const overlay = document.createElement('div');
  overlay.className = 'login-modal-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);z-index:1100;';

  const modal = document.createElement('div');
  modal.className = 'login-modal';
  modal.style.cssText = 'width:min(420px,calc(100% - 32px));background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.25);';

  const header = document.createElement('div');
  header.className = 'login-modal-header';
  header.style.cssText = 'padding:24px 24px 0;';

  const title = document.createElement('h2');
  title.className = 'login-modal-title';
  title.textContent = 'Welcome User';
  title.style.margin = '0 0 16px';
  title.style.fontSize = '1.5rem';
  title.style.lineHeight = '1.2';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'login-modal-close';
  closeBtn.innerHTML = '&times;';
  closeBtn.style.cssText = 'position:absolute;top:18px;right:18px;border:none;background:transparent;font-size:1.75rem;line-height:1;color:#333;cursor:pointer;';

  const body = document.createElement('div');
  body.className = 'login-modal-body';
  body.style.cssText = 'padding:0 24px 24px;';

  const loginBtn = document.createElement('button');
  loginBtn.type = 'button';
  loginBtn.className = 'login-modal-action login-modal-login';
  loginBtn.textContent = 'Login';
  loginBtn.style.cssText = 'width:100%;padding:14px 16px;margin-bottom:12px;border:none;border-radius:8px;background:#111;color:#fff;font-size:1rem;cursor:pointer;';

  const guestBtn = document.createElement('button');
  guestBtn.type = 'button';
  guestBtn.className = 'login-modal-action login-modal-guest';
  guestBtn.textContent = 'Continue as guest';
  guestBtn.style.cssText = 'width:100%;padding:14px 16px;border:1px solid #ddd;border-radius:8px;background:#fff;color:#111;font-size:1rem;cursor:pointer;';

  body.append(loginBtn, guestBtn);
  header.append(title, closeBtn);
  modal.append(header, body);
  overlay.appendChild(modal);

  const close = () => {
    overlay.style.display = 'none';
  };

  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  loginBtn.addEventListener('click', () => {
    close();
    window.location.href = getApApi().KEYCLOAK_PAGE_URL;
  });

  guestBtn.addEventListener('click', () => {
    close();
  });

  return overlay;
}

function openLoginModal(block) {
  const overlay = block.querySelector('.login-modal-overlay');
  if (!overlay) return;
  overlay.style.display = 'flex';
}

function openShopFallback(block) {
  const shopUrl = getApApi().SHOP_URL;
  window.location.href = shopUrl;
}

function buildSearchDialog() {
  const overlay = document.createElement('div');
  overlay.className = 'search-dialog-overlay';

  const dialog = document.createElement('div');
  dialog.className = 'search-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-label', 'Search');

  // Top: search bar row
  const topBar = document.createElement('div');
  topBar.className = 'sd-search-bar';

  const searchIcon = document.createElement('span');
  searchIcon.className = 'sd-search-icon';
  /* eslint-disable max-len */
  searchIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
  /* eslint-enable max-len */

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'sd-search-input';
  input.placeholder = 'Search';
  input.setAttribute('autocomplete', 'off');

  const cameraIcon = document.createElement('button');
  cameraIcon.className = 'sd-camera-btn';
  cameraIcon.type = 'button';
  cameraIcon.setAttribute('aria-label', 'Search by image');

  const closeBtn = document.createElement('button');
  closeBtn.className = 'sd-close-btn';
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Close search');
  closeBtn.innerHTML = '&times;';

  topBar.append(searchIcon, input, cameraIcon, closeBtn);

  // Content area: two columns
  const content = document.createElement('div');
  content.className = 'sd-content';

  // Left column
  const leftCol = document.createElement('div');
  leftCol.className = 'sd-left';

  // Trending queries
  const trendingSection = document.createElement('div');
  trendingSection.className = 'sd-section';
  trendingSection.classList.add('sd-trending-section');
  const trendingTitle = document.createElement('h3');
  trendingTitle.className = 'sd-section-title';
  trendingTitle.textContent = 'Trending Queries';
  const trendingList = document.createElement('div');
  trendingList.className = 'sd-trending-list';
  trendingSection.append(trendingTitle, trendingList);

  // Suggestions
  const sugSection = document.createElement('div');
  sugSection.className = 'sd-section';
  sugSection.classList.add('sd-suggestions-section');
  const sugTitle = document.createElement('h3');
  sugTitle.className = 'sd-section-title';
  sugTitle.textContent = 'Suggestions';
  const sugList = document.createElement('ul');
  sugList.className = 'sd-suggestions-list';
  renderSuggestions(dialog, [], false);
  sugSection.append(sugTitle, sugList);

  // Quick links
  const qlSection = document.createElement('div');
  qlSection.className = 'sd-section';
  qlSection.classList.add('sd-quicklinks-section');
  const qlTitle = document.createElement('h3');
  qlTitle.className = 'sd-section-title';
  qlTitle.textContent = 'Quick links';
  const qlGrid = document.createElement('div');
  qlGrid.className = 'sd-quicklinks-grid';
  SEARCH_QUICK_LINKS.forEach((link) => {
    const card = document.createElement('a');
    card.className = 'sd-quicklink-card';
    card.href = link.href;
    const iconSpan = document.createElement('span');
    iconSpan.className = `icon icon-${link.icon}`;
    iconSpan.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.className = 'sd-quicklink-label';
    label.textContent = link.text;
    card.addEventListener('click', () => {
      trackSearchAutoclick(dialog, link.text, 'Quick Links');
    });
    card.append(iconSpan, label);
    qlGrid.appendChild(card);
  });
  decorateIcons(qlGrid);
  qlSection.append(qlTitle, qlGrid);

  leftCol.append(trendingSection, sugSection, qlSection);

  // Right column: Best Results
  const rightCol = document.createElement('div');
  rightCol.className = 'sd-right';

  const brTitle = document.createElement('h3');
  brTitle.className = 'sd-section-title';
  brTitle.textContent = 'Best Results';

  const brGrid = document.createElement('div');
  brGrid.className = 'sd-best-results-grid';

  const seeAll = document.createElement('a');
  seeAll.className = 'sd-see-all';
  seeAll.href = getApApi().SEARCH_RESULTS;
  seeAll.textContent = 'See all results';
  const seeAllArrow = document.createElement('span');
  seeAllArrow.textContent = ' \u203A';
  seeAll.appendChild(seeAllArrow);

  rightCol.append(brTitle, brGrid, seeAll);

  const locationResults = document.createElement('section');
  locationResults.className = 'sd-location-results';
  const locationTitle = document.createElement('h3');
  locationTitle.className = 'sd-section-title sd-location-title';
  const locationList = document.createElement('div');
  locationList.className = 'sd-location-list';
  const locationEmpty = document.createElement('p');
  locationEmpty.className = 'sd-location-empty';
  const locationExplore = document.createElement('a');
  locationExplore.className = 'sd-location-explore';
  locationExplore.textContent = 'Explore more';
  locationExplore.style.display = 'none';
  locationResults.append(locationTitle, locationList, locationEmpty, locationExplore);

  content.append(leftCol, rightCol);
  dialog.append(topBar, content, locationResults);
  overlay.appendChild(dialog);

  let locationRequestToken = 0;

  // Interactions
  const closeDialog = (source = '') => {
    locationRequestToken += 1;
    overlay.classList.remove('active');
    document.body.classList.remove('search-dialog-open');
    input.value = '';
    toggleSearchDialogQueryMode(dialog, false);
    if (source === 'close-button') {
      trackEvent('Search Bar Close');
      pushAdobeSingleEvent('Search Bar Close');
    }
  };

  closeBtn.addEventListener('click', () => closeDialog('close-button'));
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeDialog();
  });

  // Search input: debounced query
  let dialogDebounce = null;
  let searchDebounce = null;
  let locationDebounce = null;
  input.addEventListener('input', () => {
    clearTimeout(dialogDebounce);
    clearTimeout(searchDebounce);
    clearTimeout(locationDebounce);
    locationRequestToken += 1;
    const currentLocationToken = locationRequestToken;
    const rawQuery = input.value;
    const query = rawQuery.trim();
    // Note: e54 Search Start fires on the magnifying glass icon click
    // (openSearchDialog), not here — avoids double-counting event54.
    dialogDebounce = setTimeout(() => {
      handleSearchDialogQuery(dialog, rawQuery);
      seeAll.href = query
        ? getSearchResultUrl(query)
        : getApApi().SEARCH_RESULTS;
    }, SEARCH_DEBOUNCE_MS);
    searchDebounce = setTimeout(() => {
      handleSearchDialogSearchResults(dialog, rawQuery);
    }, SEARCH_RESULTS_DEBOUNCE_MS);
    locationDebounce = setTimeout(() => {
      handleLocationAwareSearch(dialog, rawQuery, currentLocationToken, () => locationRequestToken);
    }, LOCATION_DETECTION_DEBOUNCE_MS);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.repeat && !e.isComposing) {
      e.preventDefault();
      const query = input.value.trim();

      if (query && typeof window.edsAnalytics?.trackEvent === 'function') {
        window.edsAnalytics.trackEvent('ub_search_enter', {
          searchTerm: query,
        });
        pushAdobeCtaClickEvent({
          searchTerm: query || '',
          cta: 'Enter',
          event: 'ub_search_enter'
        });
      }

      closeDialog();
      navigateToSearchResults(query);
    }
    if (e.key === 'Escape') closeDialog();
  });

  return overlay;
}

async function openSearchDialog(block) {
  const overlay = block.querySelector('.search-dialog-overlay');
  if (!overlay) return;

  ensureUnbxdHostedAssetsLoaded().catch(() => {
    // The local search experience still works without the hosted legacy assets.
  });

  overlay.classList.add('active');
  document.body.classList.add('search-dialog-open');

  const input = overlay.querySelector('.sd-search-input');
  if (input) {
    setTimeout(() => input.focus(), 100);
  }
  const dialog = overlay.querySelector('.search-dialog');
  if (!dialog) return;
  setLocationResultState(dialog, { visible: false });

  // Load initial data (trending + popular products)
  const data = await fetchUnbxdAutosuggest('*', {
    inFieldsCount: 0,
    topQueriesCount: 8,
    popularProductsCount: 6,
    includeSourceFields: true,
  });
  if (data) {
    renderSearchDialogResults(dialog, data, { queryMode: false, queryText: '' });
  }
}

// ──────────────────────────────────────────────
//  Build Functions
// ──────────────────────────────────────────────

function getAuthBase() {
  const api = getApApi();
  return `${api.KEYCLOAK_URL}/realms/${api.KEYCLOAK_REALM}/protocol/openid-connect/auth`;
}
function getAuthLogoutBase() {
  const api = getApApi();
  return `${api.KEYCLOAK_URL}/realms/${api.KEYCLOAK_REALM}/protocol/openid-connect/logout`;
}

function parseJwtPayload(token) {
  try {
    const parts = String(token).split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64);
    const payload = JSON.parse(json);
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

function getUserFromAuthCookie() {
  try {
    const cookies = document.cookie.split(';');
    const match = cookies.find((cookie) => {
      const eq = cookie.trim().indexOf('=');
      if (eq <= 0) return false;
      const value = cookie.trim().slice(eq + 1).trim();
      if (!value) return false;
      const decoded = parseJwtPayload(value);
      if (!decoded) return false;
      const nameVal = decoded.name
        || decoded.given_name || decoded.preferred_username;
      const isAp = decoded.iss?.includes('auth.asianpaints.com')
        || decoded.iss?.includes('betaauth.asianpaints.com');
      return nameVal && isAp;
    });
    if (match) {
      const value = match.trim().slice(match.trim().indexOf('=') + 1).trim();
      const decoded = parseJwtPayload(value);
      const nameVal = decoded.name
        || decoded.given_name || decoded.preferred_username;
      return { name: nameVal, email: decoded.email, id_token: value };
    }
  } catch (e) {
    /* ignore */
  }
  return null;
}

function getUserFromUrlHash() {
  try {
    const { hash } = window.location;
    if (!hash) return null;
    const params = new URLSearchParams(hash.slice(1));
    // Mock auth: ?mock_login=1&mock_name=XXX (for localhost testing)
    const mockName = params.get('mock_name');
    if (params.get('mock_login') === '1' && mockName) {
      return { name: mockName, email: params.get('mock_email') || '' };
    }
    const idToken = params.get('id_token');
    if (idToken) {
      const payload = parseJwtPayload(idToken);
      if (payload) {
        const nameVal = payload.name || payload.given_name || payload.preferred_username;
        if (nameVal) {
          const authUser = { name: nameVal, email: payload.email, id_token: idToken };
          const hashRefresh = params.get('refresh_token');
          if (hashRefresh) authUser.refresh_token = hashRefresh;
          return authUser;
        }
      }
    }
  } catch (e) {
    /* ignore */
  }
  return null;
}

function getUser() {
  if (keycloakInstance?.authenticated && keycloakInstance?.tokenParsed) {
    const p = keycloakInstance.tokenParsed;
    const name = p.given_name || p.name || p.preferred_username || '';
    /* Prefer the real id_token for logout. Fall back to access token only
     * so callers other than logout still work. */
    return {
      name,
      email: p.email || '',
      id_token: getLogoutIdTokenHint(),
    };
  }
  if (!canUsePersistedAuth()) return null;
  try {
    const userProfile = localStorage.getItem('userProfile');
    if (userProfile) {
      const p = JSON.parse(userProfile);
      const name = p.given_name || p.name || p.preferred_username || '';
      const idToken = getLogoutIdTokenHint();
      return name && idToken ? { name, email: p.email || '', id_token: idToken } : null;
    }
  } catch (e) { /* ignore */ }
  return null;
}

function setUser(user) {
  try {
    localStorage.removeItem(SIGNED_OUT_KEY);
    if (user?.id_token) {
      localStorage.setItem('keycloak-token', user.id_token);
      /* The hash-flow id_token IS an actual ID token, so mirror it into
       * the dedicated id-token storage for logout. */
      localStorage.setItem(KEYCLOAK_ID_TOKEN_STORAGE, user.id_token);
      const payload = parseJwtPayload(user.id_token);
      if (payload) localStorage.setItem('userProfile', JSON.stringify(payload));
    }
    if (user?.refresh_token) {
      localStorage.setItem('keycloak-refresh-token', user.refresh_token);
    }
  } catch (e) { /* ignore */ }
}

function clearUser() {
  try {
    localStorage.setItem(SIGNED_OUT_KEY, '1');
    clearKeycloakTokens();
    clearLoginSuccessTrackedFlag();
  } catch (e) { /* ignore */ }
}

function uuid() {
  /* eslint-disable no-bitwise */
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
  /* eslint-enable no-bitwise */
}

async function sha256Base64Url(input) {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const base64 = btoa(String.fromCharCode(...new Uint8Array(hash)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function buildProfileAuthUrl(redirectUri) {
  const state = uuid();
  const nonce = uuid();
  const codeVerifier = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const codeChallenge = await sha256Base64Url(codeVerifier);

  try {
    sessionStorage.setItem('ap_code_verifier', codeVerifier);
    sessionStorage.setItem('ap_auth_state', state);
  } catch (e) {
    /* sessionStorage may be unavailable */
  }

  const params = new URLSearchParams({
    client_id: 'asianpaints',
    redirect_uri: redirectUri,
    state,
    response_mode: 'fragment',
    response_type: 'code id_token',
    scope: 'openid profile offline_access',
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
  return `${getAuthBase()}?${params.toString()}`;
}

function buildBrandBar(brandDiv) {
  const triggerDomainSwitch = (destinationUrl) => {
    const normalizedDestination = (destinationUrl || '').trim();
    if (!normalizedDestination || normalizedDestination.startsWith('javascript:void')) {
      return;
    }
    trackEvent('domain_swicth', { destinationUrl: normalizedDestination });
        pushAdobeCtaClickEvent({
      cta: 'domain_switch',
      destinationUrl: normalizedDestination,
    });
  };

  const brandBar = document.createElement('div');
  brandBar.className = 'header-brands';

  const inner = document.createElement('div');
  inner.className = 'header-brands-inner';

  // Brand logo authoring structure:
  // brandDiv > ul > li (each brand item)
  //   Each brand <li> has a label <p> (e.g. "Asian paints logo", "B2B logo")
  //   followed by a nested <ul> with 2 <li> pictures (desktop, mobile).
  //   Each image <li> may wrap its <picture> in an <a href="…"> — when
  //   present, that authored href is used as the destination.
  const brandItems = brandDiv.querySelectorAll(':scope > ul > li');

  // B2B entries are authored as "B2B logo" in the DA nav doc and render
  // as a right-aligned link (the link URL itself comes from DA).
  const isB2BLabel = (label) => /\bb2b\b/i.test(label || '');

  let brandIndex = 0;
  brandItems.forEach((brandLi) => {
    const label = brandLi.querySelector(':scope > p')?.textContent?.trim() || '';
    const imageList = brandLi.querySelector(':scope > ul');
    if (!imageList) return;

    const imageLis = imageList.querySelectorAll(':scope > li');
    const desktopPicture = imageLis[0]?.querySelector('picture');
    const mobilePicture = imageLis[1]?.querySelector('picture');

    if (!desktopPicture && !mobilePicture) return;

    // Prefer the desktop image's authored href, falling back to the mobile one.
    const authoredHref = imageLis[0]?.querySelector(':scope > a[href]')?.getAttribute('href')
      || imageLis[1]?.querySelector(':scope > a[href]')?.getAttribute('href')
      || '';

    const isB2B = isB2BLabel(label);

    const brandItem = document.createElement('a');
    if (isB2B) {
      brandItem.className = 'brand-b2b';
      brandItem.href = authoredHref || '#';
      brandItem.target = '_blank';
      brandItem.rel = 'noopener noreferrer';
      // No aria-label here — we want Adobe Activity Map to fall back to the
      // child <img alt> (e.g. "B2B logo") so the beacon's link name matches
      // the legacy asianpaints.com beacon exactly. The label is still
      // accessible via the child <img alt>.
    } else {
      brandItem.className = 'brand-item';
      if (brandIndex === 0) brandItem.classList.add('active');
      brandItem.href = authoredHref || '#';
      brandIndex += 1;
    }

    brandItem.addEventListener('click', (event) => {
      event.stopPropagation();
      if (brandItem.classList.contains('active')) return;

      const destinationUrl = toAbsoluteUrl(event.currentTarget?.href || brandItem.href || brandItem.getAttribute('href'));
      triggerDomainSwitch(destinationUrl);
    });

    const pictureWrap = document.createElement('span');
    pictureWrap.className = 'brand-item-picture-wrap';

    // For B2B, ensure the child <img alt> carries the DA label ("B2B logo")
    // even when authors leave alt empty in DA — Adobe Activity Map uses the
    // alt as the link name, and the legacy site reports "B2B logo".
    const ensureAltFromLabel = (picture) => {
      if (!isB2B || !picture) return;
      const img = picture.querySelector('img');
      if (img && !img.getAttribute('alt')) img.setAttribute('alt', label);
    };
    ensureAltFromLabel(desktopPicture);
    ensureAltFromLabel(mobilePicture);

    if (desktopPicture) {
      const desktopWrap = document.createElement('span');
      desktopWrap.className = 'brand-item-picture-desktop';
      desktopWrap.appendChild(desktopPicture.cloneNode(true));
      pictureWrap.appendChild(desktopWrap);
    }

    if (mobilePicture) {
      const mobileWrap = document.createElement('span');
      mobileWrap.className = 'brand-item-picture-mobile';
      mobileWrap.appendChild(mobilePicture.cloneNode(true));
      pictureWrap.appendChild(mobileWrap);
    }

    brandItem.appendChild(pictureWrap);

    if (isB2B) {
      // B2B is rendered on the right of the brand bar, outside the inner list.
      brandBar.appendChild(brandItem);
    } else {
      inner.appendChild(brandItem);
    }
  });

  // Prepend the inner brand list so it sits to the left of any B2B link
  // appended during iteration, regardless of authoring order in DA.
  brandBar.insertBefore(inner, brandBar.firstChild);

  return brandBar;
}

function buildMainHeader(mainDiv) {
  const mainHeader = document.createElement('div');
  mainHeader.className = 'header-main';

  const inner = document.createElement('div');
  inner.className = 'header-main-inner';
  let homeHref = '/';

  // Hamburger (mobile)
  const hamburger = document.createElement('button');
  hamburger.className = 'nav-hamburger';
  hamburger.type = 'button';
  hamburger.setAttribute('aria-controls', 'nav');
  hamburger.setAttribute('aria-label', 'Open navigation');
  hamburger.setAttribute('aria-expanded', 'false');
  hamburger.innerHTML = '<span class="hamburger-icon"></span><span class="hamburger-cross"></span>';
  inner.appendChild(hamburger);

  // Logo
  const paragraphs = mainDiv.querySelectorAll('p');
  if (paragraphs[0]) {
    const logoAnchor = paragraphs[0].querySelector('a');
    if (logoAnchor) {
      homeHref = resolveApLink(logoAnchor.getAttribute('href'));
      const logoLink = document.createElement('a');
      logoLink.className = 'header-logo';
      logoLink.href = homeHref;
      const logoImg = logoAnchor.querySelector('img');
      if (logoImg) logoLink.appendChild(logoImg.cloneNode(true));
      inner.appendChild(logoLink);
    }
  }

  // Search bar with suggestions dropdown
  const searchBar = document.createElement('div');
  searchBar.className = 'header-search';

  const searchIconSpan = document.createElement('span');
  searchIconSpan.className = 'search-icon';
  if (paragraphs[1]) {
    const imgs = paragraphs[1].querySelectorAll('img');
    if (imgs[0]) {
      const searchImg = imgs[0].cloneNode(true);
      searchImg.src = '/eds/icons/search-icon.svg';
      searchIconSpan.appendChild(searchImg);
    }
  }

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.className = 'search-input';
  searchInput.setAttribute('aria-label', 'Search');
  searchInput.setAttribute('name', 'global-search');
  searchInput.setAttribute('autocomplete', 'off');

  // Rotating placeholder (matching original site's data-search-values)
  const placeholders = [
    'Search for Wall colours',
    'Search for Interior paints',
    'Search for Colour inspiration',
    'Search for Budget calculator',
  ];
  let placeholderIdx = 0;
  [searchInput.placeholder] = placeholders;
  setInterval(() => {
    placeholderIdx = (placeholderIdx + 1) % placeholders.length;
    searchInput.placeholder = placeholders[placeholderIdx];
  }, 3000);

  const cameraBtn = document.createElement('button');
  cameraBtn.className = 'camera-btn';
  cameraBtn.type = 'button';
  cameraBtn.setAttribute('aria-label', 'Search by image');
  if (paragraphs[1]) {
    const imgs = paragraphs[1].querySelectorAll('img');
    if (imgs[1]) {
      cameraBtn.appendChild(imgs[1].cloneNode(true));
    }
  }

  searchBar.appendChild(searchIconSpan);
  searchBar.appendChild(searchInput);
  searchBar.appendChild(cameraBtn);
  inner.appendChild(searchBar);

  // Mobile search icon — created here, appended into actions container below
  const mobileSearchBtn = document.createElement('button');
  mobileSearchBtn.className = 'mobile-search-btn';
  mobileSearchBtn.type = 'button';
  mobileSearchBtn.setAttribute('aria-label', 'Search');
  if (paragraphs[1]) {
    const imgs = paragraphs[1].querySelectorAll('img');
    if (imgs[0]) {
      const mobileSearchImg = imgs[0].cloneNode(true);
      mobileSearchImg.src = '/eds/icons/search-icon.svg';
      mobileSearchBtn.appendChild(mobileSearchImg);
    }
  }

  // Action icons — from p.header-actions or <ul> in mainDiv
  const actionsContainer = document.createElement('div');
  actionsContainer.className = 'header-actions';

  // Insert mobile search icon as first item in actions (visible only on mobile)
  actionsContainer.appendChild(mobileSearchBtn);
  const actionsP = mainDiv.querySelector('p.header-actions');

  // Action icons

  const actionsUl = mainDiv.querySelector('ul');
  let actionAnchors = [];
  if (actionsP) {
    actionAnchors = [...actionsP.querySelectorAll('a')];
  } else if (actionsUl) {
    actionAnchors = actionsUl.querySelectorAll(':scope > li a');
  }

  if (actionAnchors.length) {
    actionAnchors.forEach((anchor) => {
      const actionLink = document.createElement('a');
      actionLink.className = 'action-btn';
      actionLink.href = anchor.getAttribute('href');

      const img = anchor.querySelector('img');
      if (img) {
        actionLink.appendChild(img.cloneNode(true));
        const label = img.alt || anchor.getAttribute('aria-label') || '';
        actionLink.setAttribute('aria-label', label);
      }

      const altText = (img?.alt || '').toLowerCase();

      // Profile button — save original (logged-in) icon src,
      // start with clean local icon (no green dot) for logged-out state.
      if (altText.includes('profile') || altText.includes('user') || altText.includes('login')) {
        actionLink.classList.add('profile-btn');
        const existingImg = actionLink.querySelector('img');
        if (existingImg) {
          existingImg.dataset.loggedInSrc = existingImg.src;
          existingImg.src = '/eds/icons/profile-icon.svg';
        }
        const greeting = document.createElement('span');
        greeting.className = 'profile-greeting';
        actionLink.appendChild(greeting);
      }

      // Cart badge
      if (altText.includes('cart')) {
        actionLink.classList.add('cart-btn');
        const badge = document.createElement('span');
        badge.className = 'cart-badge';
        badge.textContent = '0';
        actionLink.appendChild(badge);
      }

      if (altText.includes('store')) {
        actionLink.classList.add('store-btn');
        const storeImg = actionLink.querySelector('img');
        if (storeImg) {
          storeImg.src = HEADER_ICON_PATHS.STORE;
        }
      }

      // Profile button — dropdown when logged in, auth redirect when not
      const href = anchor.getAttribute('href') || '';
      const isProfile = (img && img.alt && img.alt.toLowerCase().includes('profile'))
        || href.includes('profile') || href.includes('my-profile');

      if (isProfile) {
        actionLink.classList.add('profile-auth-link');
        actionLink.href = '#'; // Prevent default nav; click handler shows dropdown or redirects to auth
        const profileImg = actionLink.querySelector('img');
        if (profileImg) {
          profileImg.dataset.loggedOutSrc = HEADER_ICON_PATHS.PROFILE_LOGGED_OUT;
          profileImg.dataset.loggedInSrc = HEADER_ICON_PATHS.PROFILE_LOGGED_IN;
          profileImg.src = HEADER_ICON_PATHS.PROFILE_LOGGED_OUT;
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'profile-dropdown-wrapper';
        wrapper.appendChild(actionLink);

        const profileIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M6 21V19a4 4 0 014-4h4a4 4 0 014 4v2"/></svg>';
        const wishlistIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>';

        /* Profile / Wishlist URLs resolve per environment via getApApi():
         *  - on *.asianpaints.com (beta + live) -> relative path
         *  - on aem.page          -> absolute against configured apiBaseUrl
         * The legacy AEM profile API not yet existing on beta is a backend
         * concern, not an EDS frontend concern. */
        const profileHref = getApApi().PROFILE_PAGE;
        const wishlistHref = getApApi().WISHLIST_PAGE;

        const dropdown = document.createElement('div');
        dropdown.className = 'profile-dropdown';
        dropdown.setAttribute('aria-hidden', 'true');
        dropdown.innerHTML = `
          <p class="profile-dropdown-greeting"></p>
          <a href="${profileHref}" class="profile-dropdown-item">
            <span class="profile-dropdown-icon">${profileIconSvg}</span>
            My Profile
          </a>
          <a href="${wishlistHref}" class="profile-dropdown-item">
            <span class="profile-dropdown-icon">${wishlistIconSvg}</span>
            Wishlist
          </a>
          <button type="button" class="profile-dropdown-signout">Sign out</button>
        `;
        wrapper.appendChild(dropdown);
        actionsContainer.appendChild(wrapper);
      } else {
        actionsContainer.appendChild(actionLink);
      }

      const tipLabel = actionLink.getAttribute('aria-label');
      if (tipLabel) {
        actionLink.removeAttribute('title');
        const tip = document.createElement('span');
        tip.className = 'icon-tooltip-text';
        tip.setAttribute('aria-hidden', 'true');
        const normalized = tipLabel.trim().replace(/\s+/g, ' ');
        if (/^find contractor$/i.test(normalized)) {
          tip.classList.add('icon-tooltip-text-stacked');
          const line1 = document.createElement('span');
          line1.className = 'icon-tooltip-line';
          line1.textContent = 'Find';
          const line2 = document.createElement('span');
          line2.className = 'icon-tooltip-line';
          line2.textContent = 'Contractor';
          tip.append(line1, line2);
        } else {
          tip.textContent = tipLabel;
        }
        actionLink.appendChild(tip);
      }
    });
    inner.appendChild(actionsContainer);
  }

  // CTA button
  const lastP = paragraphs[paragraphs.length - 1];
  if (lastP) {
    const ctaAnchor = lastP.querySelector('a');
    if (ctaAnchor && !ctaAnchor.querySelector('img')) {
      const defaultExitIntentPath = '/eds/forms/book-free-site-visit';
      const ctaHref = ctaAnchor.getAttribute('href') || defaultExitIntentPath;
      const ctaContainer = document.createElement('div');
      ctaContainer.className = 'header-cta';

      const ctaLink = document.createElement('a');
      ctaLink.className = 'cta-btn trigger-book-free-site-visit-modal';
      ctaLink.href = ctaHref;
      ctaLink.dataset.modalPath = ctaHref;
      ctaLink.textContent = ctaAnchor.textContent.trim();

      ctaContainer.appendChild(ctaLink);
      inner.appendChild(ctaContainer);
    }
  }

  const mobileHomeBtn = document.createElement('a');
  mobileHomeBtn.className = 'mobile-home-btn';
  mobileHomeBtn.href = homeHref;
  mobileHomeBtn.setAttribute('aria-label', 'Home');
  inner.appendChild(mobileHomeBtn);

  mainHeader.appendChild(inner);
  return mainHeader;
}

function buildMobileSearchPanel(mainDiv) {
  const panel = document.createElement('div');
  panel.className = 'mobile-search-panel';

  const paragraphs = mainDiv.querySelectorAll('p');

  const searchIcon = document.createElement('span');
  searchIcon.className = 'search-icon';
  if (paragraphs[1]) {
    const imgs = paragraphs[1].querySelectorAll('img');
    if (imgs[0]) searchIcon.appendChild(imgs[0].cloneNode(true));
  }

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'search-input';
  input.placeholder = 'Search';
  input.setAttribute('aria-label', 'Search');
  input.setAttribute('autocomplete', 'off');

  const cameraBtn = document.createElement('button');
  cameraBtn.className = 'camera-btn';
  cameraBtn.type = 'button';
  cameraBtn.setAttribute('aria-label', 'Search by image');

  const closeBtn = document.createElement('button');
  closeBtn.className = 'mobile-search-close';
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Close search');
  closeBtn.innerHTML = '&times;';

  panel.append(searchIcon, input, cameraBtn, closeBtn);
  return panel;
}

// function buildCartModal() {
//   const overlay = document.createElement('div');
//   overlay.className = 'cart-modal-overlay';

//   const modal = document.createElement('div');
//   modal.className = 'cart-modal';

//   const closeBtn = document.createElement('button');
//   closeBtn.className = 'cart-modal-close';
//   closeBtn.type = 'button';
//   closeBtn.setAttribute('aria-label', 'Close cart');
//   closeBtn.innerHTML = '&times;';

//   const iconWrap = document.createElement('img');
//   iconWrap.className = 'cart-modal-icon';
//   iconWrap.src = '/eds/icons/empty-cart-icon.webp';
//   iconWrap.alt = 'empty-cart-icon';
//   iconWrap.width = 200;
//   iconWrap.height = 200;
//   iconWrap.loading = 'lazy';

//   const cartTitle = document.createElement('h4');
//   cartTitle.className = 'cart-modal-title';
//   cartTitle.textContent = 'Your cart is empty';

//   const cartItems = document.createElement('div');
//   cartItems.className = 'cart-items-list';

//   const totalRow = document.createElement('div');
//   totalRow.className = 'cart-modal-total';

//   const shopBtn = document.createElement('a');
//   shopBtn.className = 'cart-modal-shop';
//   shopBtn.href = getApApi().SHOP_URL;
//   shopBtn.textContent = 'Shop now';

//   modal.append(closeBtn, iconWrap, cartTitle, cartItems, totalRow, shopBtn);
//   overlay.appendChild(modal);

//   const close = () => overlay.classList.remove('active');
//   closeBtn.addEventListener('click', close);
//   overlay.addEventListener('click', (e) => {
//     if (e.target === overlay) close();
//   });

//   return overlay;
// }



function buildCartModal() {
  const overlay = document.createElement('div');
  overlay.className = 'cart-modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'cart-modal';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'cart-modal-close';
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Close cart');
  closeBtn.innerHTML = '&times;';

  const iconWrap = document.createElement('img');
  iconWrap.className = 'cart-modal-icon';
  iconWrap.src = '/eds/icons/empty-cart-icon.webp';
  iconWrap.alt = 'empty-cart-icon';
  iconWrap.width = 200;
  iconWrap.height = 200;
  iconWrap.loading = 'lazy';

  const cartTitle = document.createElement('h4');
  cartTitle.className = 'cart-modal-title';
  cartTitle.textContent = 'Your cart is empty';

  const cartItems = document.createElement('div');
  cartItems.className = 'cart-items-list';

  const totalRow = document.createElement('div');
  totalRow.className = 'cart-modal-total';

  const shopBtn = document.createElement('a');
  shopBtn.className = 'cart-modal-shop';
  shopBtn.href = getApApi().SHOP_URL;
  shopBtn.textContent = 'Shop now';

  /**
   * If cart has items, show login / guest popup.
   * If cart is empty, allow normal navigation to SHOP_URL.
   */
  shopBtn.addEventListener('click', (e) => {
    const ctaText = shopBtn.textContent?.trim() || '';
    const isShopNow = ctaText.toLowerCase() === 'shop now';
    if (isShopNow) {
      const redirectionLink = toAbsoluteUrl(shopBtn.getAttribute('href') || getApApi().SHOP_URL);
      trackEvent('custom_cta_click', {
        cta_: ctaText,
        parentTitle: 'minicart',
        redirectionLink,
      });
      pushAdobeCtaClickEvent({
        cta: ctaText,
        parentTitle: 'minicart',
        destinationUrl: redirectionLink,
      });
    }

    if (!modal.classList.contains('has-items')) {
      return;
    }

    e.preventDefault();

    // event97 - Mini_cart_checkout. Fires when the user proceeds to checkout
    // from the mini cart (cart has items). Build the Adobe products string
    // from the rendered cart rows (matches buildProductString format).
    const products = [...modal.querySelectorAll('.cart-item-row')].map((row) => {
      const sku = row.dataset.productSku || row.dataset.productId || '';
      const qty = Number(row.dataset.quantity) || '';
      const price = row.dataset.productPrice || '';
      return ['', sku, qty, price, '', `eVar106=${qty};eVar107=${price}`].join(';');
    }).join(',');
    trackEvent('Mini_cart_checkout', products ? { products } : {});
    pushAdobeSingleEvent('Mini_cart_checkout');

    // Optional: close the cart modal before opening login popup.
    overlay.classList.remove('active');
    if (keycloakInstance?.authenticated) {
      if (window.headerMiniCart?.checkoutRedirectLogin) {
        window.headerMiniCart.checkoutRedirectLogin();
      }
    }else {
      localStorage.setItem("userCheckoutAction", true);
      showLoginGuestPopup();
    }
  });

  modal.append(closeBtn, iconWrap, cartTitle, cartItems, totalRow, shopBtn);

  const shade = document.createElement('div');
  shade.className = 'mini-cart-shade';
  shade.innerHTML = `
    <p class="mini-cart-shade--textArea">
      <span class="rotating">↻</span>
      <span>Processing...</span>
    </p>
  `;

  modal.append(shade);
  overlay.appendChild(modal);

  const close = () => overlay.classList.remove('active');
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  return overlay;
}

function buildLoginGuestPopup() {
  const overlay = document.createElement('div');
  overlay.className = 'login-guest-modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'login-guest-title');

  overlay.innerHTML = `
    <div class="modal-dialog login-guest-modal">
      <div class="modal-content">
        <div class="modal-header">
          <button class="close-icon track_login_close" type="button" aria-label="Close login popup">
            <span class="header-popup-close-icon" role="img" aria-label="close icon" title="close icon"></span>
          </button>
        </div>

        <div class="modal-body">
          <h2 class="modal-title" id="login-guest-title">Welcome User</h2>

          <form method="POST" id="validate-mobile" action="#" name="loginForm" novalidate autocomplete="off">
            <div class="ctaComp baseBtn">
              <button class="ctaText modal__variant-login--submit" type="submit">
                Login
                <span>
                  <img
                    loading="lazy"
                    fetchpriority="auto"
                    src="/eds/icons/arrow-icon-new.svg"
                    alt=""
                  >
                </span>
              </button>
            </div>
          </form>

          <div class="line-break-text">OR</div>

          <div class="ctaComp whiteBtn">
            <button class="ctaText continue-as-guest" type="button">
              Continue as guest
              <span>
                <img
                  loading="lazy"
                  fetchpriority="auto"
                  src="/eds/icons/arrow-icon-new.svg"
                  alt=""
                >
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  const closePopup = () => {
    overlay.classList.remove('active');
    document.body.classList.remove('modal-open');
  };

  overlay.querySelector('.track_login_close')?.addEventListener('click', closePopup);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closePopup();
  });

  overlay.querySelector('#validate-mobile')?.addEventListener('submit', (e) => {
    e.preventDefault();
    closePopup();
    persistPostLoginRedirectPath();
    buildProfileAuthUrl(AUTH_REDIRECT_URI)
      .then((url) => {
        window.location.href = url;
      })
      .catch(() => {
        window.location.href = getApApi().KEYCLOAK_PAGE_URL;
      });
  });

  // overlay.querySelector('.continue-as-guest')?.addEventListener('click', () => {
  //   closePopup();
  //   // Update this URL if guest should go to checkout instead of shop page.
  //   window.location.href = getApApi().SHOP_URL;
  // });
  overlay.querySelector('.continue-as-guest')?.addEventListener('click', () => {
    closePopup();
    // Opens "Provide a delivery address" modal
    showGuestDeliveryAddressModal();
  });

  return overlay;
}

function showLoginGuestPopup() {
  let popup = document.querySelector('.login-guest-modal-overlay');

  if (!popup) {
    popup = buildLoginGuestPopup();
    document.body.appendChild(popup);
  }

  popup.classList.add('active');
  document.body.classList.add('modal-open');

  popup.querySelector('.track_login_close')?.focus();
}


// GuestDeliveryAddressModal
function buildGuestDeliveryAddressModal() {
  const modal = document.createElement('div');
  modal.id = 'guestLoginModal';
  modal.className = 'modal modal__variant-login guest-login-modal-overlay';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'guest-delivery-title');
  modal.setAttribute('aria-hidden', 'true');

  const field = ({
    id,
    label,
    required = true,
    wrapperClass = '',
    inputAttrs = '',
  }) => `
    <div class="${['form-item', wrapperClass].filter(Boolean).join(' ')}">
      <label class="input-label" for="${id}">${label}${required ? '*' : ''}</label>
      <input
        class="form-control"
        type="text"
        name="${id}"
        id="${id}"
        autocomplete="off"
        ${inputAttrs}
      >
      ${id === 'mobileNumber' ? '<div class="default-value d-none">+91</div>' : ''}
      ${required ? '<div class="error-msg d-none"></div>' : ''}
    </div>
  `;

  modal.innerHTML = `
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <div class="heading" id="guest-delivery-title">Provide a delivery address</div>

          <button class="iconLinks iconLinks__close guest-login-close-btn" type="button" aria-label="Close">
            <span class="spriteIcon-Aprevamp closeIcon guest_login_close" aria-hidden="true"></span>
          </button>
        </div>

        <div class="modal-body">
          <div
            class="form-section"
            data-attr-emptyfielderror="Field is required"
            data-attr-mobileerror="Please enter a valid number"
            data-attr-pincodeerror="Please enter a valid pincode"
            data-attr-emailerror="Please enter a valid emailid"
          >
            <div class="step-section customer-info-section track-guest-form">
              ${field({ id: 'fullName', label: 'Fullname' })}

              ${field({ id: 'emailId', label: 'Email' })}

              ${field({
                id: 'mobileNumber',
                label: 'Mobile',
                wrapperClass: 'mobile-no-field has-default-value',
                inputAttrs: 'inputmode="numeric" maxlength="10"',
              })}

              <div class="two-column-row">
                ${field({
                  id: 'flat',
                  label: 'Flat/House No/Floor',
                  wrapperClass: 'w-50',
                })}

                ${field({
                  id: 'locality',
                  label: 'Colony/Street/Locality',
                  wrapperClass: 'w-50',
                })}
              </div>

              <div class="two-column-row">
                ${field({
                  id: 'landmark',
                  label: 'Landmark',
                  required: false,
                  wrapperClass: 'w-50',
                })}

                ${field({
                  id: 'city',
                  label: 'City',
                  wrapperClass: 'w-50',
                })}
              </div>

              ${field({
                id: 'pincode',
                label: 'Pincode',
                inputAttrs: 'inputmode="numeric" maxlength="6"',
              })}

              <div class="submit-user-info-button">
                <button class="animated-arrow-button" type="button" disabled>
                  SUBMIT
                </button>
              </div>

              <div class="info-msg guest-exist d-none">
                User already exist redirecting you for the login page
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  return modal;
}

function showGuestDeliveryAddressModal() {
  let modal = document.getElementById('guestLoginModal');

  if (!modal) {
    modal = buildGuestDeliveryAddressModal();
    document.body.appendChild(modal);
  }

  initGuestDeliveryAddressModal(modal);

  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');

  modal.querySelector('#fullName')?.focus();
}

function closeGuestDeliveryAddressModal() {
  const modal = document.getElementById('guestLoginModal');

  if (!modal) return;

  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
}

function initGuestDeliveryAddressModal(modal) {
  if (modal.dataset.initialized === 'true') return;

  modal.dataset.initialized = 'true';

  const qs = (selector) => modal.querySelector(selector);

  const formSection = qs('.form-section');
  const submitBtn = qs('.submit-user-info-button .animated-arrow-button');

  const requiredIds = [
    'fullName',
    'emailId',
    'mobileNumber',
    'flat',
    'locality',
    'city',
    'pincode',
  ];

  const requiredFields = requiredIds
    .map((id) => qs(`#${id}`))
    .filter(Boolean);

  const allInputs = Array.from(
    modal.querySelectorAll('.form-section .form-control:not(.custom-select-control)')
  );

  const messages = {
    required:
      formSection?.getAttribute('data-attr-emptyfielderror') || 'Field is required',
    mobile:
      formSection?.getAttribute('data-attr-mobileerror') || 'Please enter a valid number',
    pincode:
      formSection?.getAttribute('data-attr-pincodeerror') || 'Please enter a valid pincode',
    email:
      formSection?.getAttribute('data-attr-emailerror') || 'Please enter a valid emailid',
  };

  const isMobileNoValid = (value) => /^[0-9]{10}$/.test(value);
  const isPincodeValid = (value) => /^[0-9]{6}$/.test(value);

  const isEmailIdValid = (value) => {
    const regex = /^[a-zA-Z0-9][a-zA-Z0-9-_.]+@([a-zA-Z]|[a-zA-Z0-9]?[a-zA-Z0-9-]+[a-zA-Z0-9])\.[a-zA-Z0-9]{2,10}(?:\.[a-zA-Z]{2,10})?$/;
    return regex.test(value);
  };

  const getErrorElement = (input) => input.closest('.form-item')?.querySelector('.error-msg');

  const showError = (input, message) => {
    const errorEl = getErrorElement(input);
    const formItem = input.closest('.form-item');

    if (!errorEl) return;

    errorEl.textContent = message;
    errorEl.classList.remove('d-none');
    formItem?.classList.add('has-error');
  };

  const clearError = (input) => {
    const errorEl = getErrorElement(input);
    const formItem = input.closest('.form-item');

    if (!errorEl) return;

    errorEl.textContent = '';
    errorEl.classList.add('d-none');
    formItem?.classList.remove('has-error');
  };

  const setFloatingState = (input) => {
    const formItem = input.closest('.form-item');
    const label = formItem?.querySelector('.input-label');
    const defaultValue = formItem?.querySelector('.default-value');

    const shouldFloat = document.activeElement === input || input.value.trim().length > 0;

    label?.classList.toggle('top', shouldFloat);
    defaultValue?.classList.toggle('d-none', !shouldFloat);
  };

  const normalizeNumberInput = (input, maxLength) => {
    const normalizedValue = input.value.replace(/\D/g, '').slice(0, maxLength);

    if (input.value !== normalizedValue) {
      input.value = normalizedValue;
    }
  };

  const validateField = (input, showRequiredError = false) => {
    const value = input.value.trim();
    const isRequired = requiredFields.includes(input);

    if (isRequired && !value) {
      if (showRequiredError) {
        showError(input, messages.required);
      } else {
        clearError(input);
      }

      return false;
    }

    if (!value) {
      clearError(input);
      return true;
    }

    if (input.id === 'mobileNumber' && !isMobileNoValid(value)) {
      showError(input, messages.mobile);
      return false;
    }

    if (input.id === 'pincode' && !isPincodeValid(value)) {
      showError(input, messages.pincode);
      return false;
    }

    if (input.id === 'emailId' && !isEmailIdValid(value)) {
      showError(input, messages.email);
      return false;
    }

    clearError(input);
    return true;
  };

  const hasVisibleErrors = () =>
    requiredFields.some((input) => {
      const errorEl = getErrorElement(input);
      return errorEl && !errorEl.classList.contains('d-none');
    });

  const hasEmptyRequiredFields = () =>
    requiredFields.some((input) => input.value.trim() === '');

  const setSubmitState = () => {
    const isValid = !hasVisibleErrors() && !hasEmptyRequiredFields();

    submitBtn.disabled = !isValid;
  };

  allInputs.forEach((input) => {
    input.addEventListener('focus', () => {
      setFloatingState(input);

      if (requiredFields.includes(input) && !input.value.trim()) {
        clearError(input);
      }

      setSubmitState();
    });

    input.addEventListener('blur', () => {
      setFloatingState(input);
      validateField(input, true);
      setSubmitState();
    });

    input.addEventListener('input', () => {
      if (input.id === 'mobileNumber') {
        normalizeNumberInput(input, 10);
      }

      if (input.id === 'pincode') {
        normalizeNumberInput(input, 6);
      }

      setFloatingState(input);
      validateField(input, false);
      setSubmitState();
    });
  });

  // Handles browser autofill state.
  setTimeout(() => {
    allInputs.forEach(setFloatingState);
    setSubmitState();
  }, 0);

  qs('.guest-login-close-btn')?.addEventListener('click', closeGuestDeliveryAddressModal);

  modal.addEventListener('click', (event) => {
    if (event.target === modal) {
      closeGuestDeliveryAddressModal();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal.classList.contains('active')) {
      closeGuestDeliveryAddressModal();
    }
  });

  submitBtn.addEventListener('click', async (event) => {
    event.preventDefault();

    hideGuestInfoMessage(modal);

    let isFormValid = true;

    requiredFields.forEach((input) => {
      if (!validateField(input, true)) {
        isFormValid = false;
      }
    });

    setSubmitState();

    if (!isFormValid || submitBtn.disabled) {
      return;
    }

    await submitGuestDeliveryAddress(modal, submitBtn);
  });
}

async function submitGuestDeliveryAddress(modal, submitBtn) {
  const getValue = (id) => modal.querySelector(`#${id}`)?.value.trim() || '';

  const userEmail = getValue('emailId');

  const dataToSend = {
    userMobileNumber: getValue('mobileNumber'),
    userEmail,
    userPincode: getValue('pincode'),
    userName: getValue('fullName'),
    flatNumber: getValue('flat'),
    locality: getValue('locality'),
    landmark: getValue('landmark'),
    city: getValue('city'),
  };

  setGuestDigitalData('not logged in');

  trackGuestAnalytics('guest_login_continue', {
    checkoutUserType: window.digitalData?.user?.CheckoutUserType || 'guest',
    loginStatus: window.digitalData?.user?.loginStatus || 'not logged in',
  });

  let resetSubmitButton = true;

  try {
    submitBtn.disabled = true;
    submitBtn.classList.add('is-loading');
    submitBtn.textContent = 'SUBMITTING...';

    const fetchResponse = await fetch('/apcolourcatalogue/keycloak/guestLogin', {
      method: 'POST',

      // This matches jQuery $.ajax default form-post behavior.
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },

      body: new URLSearchParams({
        data: JSON.stringify(dataToSend),
      }),
    });

    let response = {};

    try {
      response = await fetchResponse.json();
    } catch (error) {
      response = {};
    }

    if (response.uuid) {
      setCookie('guest_UID', response.uuid);
      setCookie('guest_email', userEmail);

      setGuestDigitalData('logged in');
      trackLoginSuccessful('guest login');

      trackGuestAnalytics('guest_login_successful', {
        checkoutUserType: window.digitalData?.user?.CheckoutUserType || 'guest',
        loginStatus: window.digitalData?.user?.loginStatus || 'logged in',
      });

      closeGuestDeliveryAddressModal();

      /**
       * Legacy flow.
       * In EDS, keep this if headerMiniCart is exposed globally.
       * Otherwise listen to the custom event below and redirect from your cart module.
       */
      if (window.headerMiniCart?.checkoutRedirectLogin) {
        window.headerMiniCart.checkoutRedirectLogin();
      } else {
        document.dispatchEvent(
          new CustomEvent('guest-login-success', {
            detail: {
              response,
              dataToSend,
            },
          })
        );
      }

      resetSubmitButton = false;
      return;
    }

    if (response.status === 409 || fetchResponse.status === 409) {
      showGuestInfoMessage(
        modal,
        'User already exist redirecting you for the login page'
      );

      setTimeout(() => {
        closeGuestDeliveryAddressModal();

        persistPostLoginRedirectPath();
        buildProfileAuthUrl(AUTH_REDIRECT_URI)
          .then((url) => {
            window.location.href = url;
          })
          .catch(() => {
            window.location.href = getApApi().KEYCLOAK_PAGE_URL;
          });
      }, 1000);

      return;
    }

    showGuestError(modal);
  } catch (error) {
    console.error('Error while initiating Guest Login Flow', error);
    showGuestError(modal);
  } finally {
    if (resetSubmitButton) {
      submitBtn.classList.remove('is-loading');
      submitBtn.textContent = 'SUBMIT';
      submitBtn.disabled = false;
    }
  }
}

function showGuestError(modal) {
  setGuestDigitalData('not logged in', 'Something went wrong');

  trackGuestAnalytics('guest_login_error', {
    checkoutUserType: window.digitalData?.user?.CheckoutUserType || 'guest',
    loginError: window.digitalData?.user?.loginErrorName || 'Something went wrong',
  });

  showGuestInfoMessage(
    modal,
    'Something went wrong. Please try after sometime'
  );
}

function showGuestInfoMessage(modal, message) {
  const infoMsg = modal.querySelector('.guest-exist');

  if (!infoMsg) return;

  infoMsg.textContent = message;
  infoMsg.classList.remove('d-none');
}

function hideGuestInfoMessage(modal) {
  const infoMsg = modal.querySelector('.guest-exist');

  if (!infoMsg) return;

  infoMsg.classList.add('d-none');
}

function setGuestDigitalData(loginStatus, loginErrorName) {
  if (!window.digitalData?.user) return;

  window.digitalData.user.CheckoutUserType = 'guest';

  if (loginStatus) {
    window.digitalData.user.loginStatus = loginStatus;
  }

  if (loginErrorName) {
    window.digitalData.user.loginErrorName = loginErrorName;
  }
}

function trackGuestAnalytics(eventName, payload) {
  trackEvent(eventName, payload);
  pushAdobeAuthEvent ({
    event: eventName,
    userType: payload.checkoutUserType || 'guest',
  })
}

function trackLoginSuccessful(loginFunction = '') {
  // Analytics must never break header rendering (this runs before the
  // header DOM is built on the post-login callback page).
  try {
    // eslint-disable-next-line no-use-before-define
    trackLoginSuccessfulUnsafe(loginFunction);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('header: login_successful tracking failed', e);
  }
}

function trackLoginSuccessfulUnsafe(loginFunction = '') {
  const digitalData = getDigitalData();
  digitalData.user = digitalData.user || {};

  if (loginFunction) {
    digitalData.user.loginFunction = loginFunction;
  }
  if (!digitalData.user.loginStatus) {
    digitalData.user.loginStatus = 'logged in';
  }

  trackEvent('login_successful', {
    loginStatus: digitalData.user.loginStatus || 'logged in',
    loginFunction: digitalData.user.loginFunction || loginFunction || '',
  });

  pushAdobeAuthEvent({
    event: 'login_successful',
    loginFunction: digitalData.user.loginFunction || loginFunction || '',
  });

}

function setCookie(name, value) {
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; path=/; SameSite=Lax`;
}

function detectBrowser() {
  const ua = navigator.userAgent || '';
  if (/edg/i.test(ua)) return 'Edge';
  if (/chrome|crios/i.test(ua)) return 'Chrome';
  if (/safari/i.test(ua) && !/chrome|crios|android/i.test(ua)) return 'Safari';
  if (/firefox|fxios/i.test(ua)) return 'Firefox';
  if (/trident|msie/i.test(ua)) return 'IE';
  return 'Unknown';
}

function hideLegacyCheckoutLoadingState() {
  document.querySelectorAll('.js-rotatingMiniCartCheckout').forEach((el) => {
    el.classList.remove('saving-progress-status-buy-now');
  });
  document.querySelectorAll('.checkoutloading').forEach((el) => {
    el.style.display = 'none';
  });
}

function ensureViewCartForm() {
  let form = document.getElementById('viewCartFormId');
  if (form) return form;

  form = document.createElement('form');
  form.id = 'viewCartFormId';
  form.method = 'POST';
  form.style.display = 'none';
  form.innerHTML = `
    <input type="hidden" name="cartId" id="cartId" value="">
    <input type="hidden" name="baseSiteID" id="baseSiteID" value="">
    <input type="hidden" name="accessToken" id="accessToken" value="">
    <input type="hidden" name="guestUid" id="guestUid" value="">
    <input type="hidden" name="guestEmail" id="guestEmail" value="">
    <input type="hidden" name="userId" id="userId" value="">
    <input type="hidden" name="storefront" id="storefront" value="">
    <input type="hidden" name="CSRFToken" id="CSRFToken" value="">
    <input type="hidden" name="JSESSIONID" id="jSessionId" value="">
    <input type="hidden" name="aemRedirectUrl" id="aemRedirectUrl" value="">
    <input type="hidden" name="referrer" id="referrer" value="">
    <input type="hidden" name="eVar6" id="eVar6" value="">
    <input type="hidden" name="eVar38" id="eVar38" value="">
    <input type="hidden" name="eVar39" id="eVar39" value="">
    <input type="hidden" name="eVar87" id="eVar87" value="">
    <input type="hidden" name="Campaign" id="Campaign" value="">
  `;

  document.body.appendChild(form);
  return form;
}

function setViewCartField(form, fieldId, value) {
  const input = form.querySelector(`#${fieldId}`);
  if (input) input.value = value == null ? '' : String(value);
}

async function postTrackRedirect(payload) {
  try {
    const body = new URLSearchParams();
    Object.entries(payload).forEach(([key, value]) => {
      body.append(key, value == null ? '' : String(value));
    });
    await fetch('/apcolourcatalogue/trackredirect.json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
      credentials: 'include',
      body,
    });
  } catch (e) {
    // Best-effort tracking.
  }
}

async function checkoutRedirectLogin() {
  const userCsrfToken = '';
  const form = ensureViewCartForm();

  try {
    const miniCartResp = await fetchFromAp('/apcolourcatalogue/commerce/miniCart.json?viewCart=viewCart', {
      method: 'GET',
      cache: 'no-store',
      credentials: 'include',
    });
    if (!miniCartResp) {
      hideLegacyCheckoutLoadingState();
      return;
    }

    const response = await miniCartResp.json();
    if (response?.status !== 'success') {
      console.log('View Cart Redirection Failed.');
      hideLegacyCheckoutLoadingState();
      return;
    }

    const checkoutAction = response?.hybrisUrl || response?.aemRedirectUrl || '';
    if (checkoutAction) form.action = new URL(checkoutAction, window.location.origin).toString();

    const hybrisCartCookie = getCookieValue('HybrisCart');
    const hostUrl = window.location.href;
    const browser = detectBrowser();

    await postTrackRedirect({
      baseSiteID: response.baseSiteID,
      accessToken: response.loginToken,
      CSRFToken: userCsrfToken,
      userId: response.userId,
      storefront: response.storefront,
      cartId: response.cartId,
      jSessionId: response.jSessionId,
      aemRedirectUrl: response.aemRedirectUrl,
      action: response.hybrisUrl,
      hybrisCart: hybrisCartCookie,
      hostUrl,
      browser,
      referrer: getCookieValue('referrer'),
      eVar38: getCookieValue('eVar39'),
      eVar87: getCookieValue('eVar87'),
      Campaign: getCookieValue('Campaign'),
    });

    const guestEmail = getCookieValue('guest_email');
    const guestUid = getCookieValue('guest_UID');
    const gigyaUID = getCookieValue('gigyaUID');
    const referrer = getCookieValue('referrer');
    const eVar38 = getCookieValue('eVar38');
    const eVar39 = getCookieValue('eVar39');
    const eVar87 = getCookieValue('eVar87');
    const campaign = getCookieValue('Campaign');

    // Always set common payload fields so form submit isn't empty when no guest/gigya cookie exists.
    setViewCartField(form, 'baseSiteID', response.baseSiteID);
    setViewCartField(form, 'accessToken', response.loginToken);
    setViewCartField(form, 'CSRFToken', userCsrfToken);
    setViewCartField(form, 'userId', response.userId);
    setViewCartField(form, 'storefront', response.storefront);
    setViewCartField(form, 'cartId', response.cartId);
    setViewCartField(form, 'jSessionId', response.jSessionId);
    setViewCartField(form, 'aemRedirectUrl', response.aemRedirectUrl);
    setViewCartField(form, 'referrer', referrer);
    setViewCartField(form, 'eVar38', eVar38);
    setViewCartField(form, 'eVar39', eVar39);
    setViewCartField(form, 'eVar87', eVar87);
    setViewCartField(form, 'Campaign', campaign);

    if (gigyaUID) {
      // Common fields are already set above.
    } else if (guestEmail && guestUid) {
      setViewCartField(form, 'userId', 'anonymous');
      setViewCartField(form, 'guestUid', guestUid);
      setViewCartField(form, 'guestEmail', guestEmail);
    }

    const cookVal = getCookieValue('HybrisCart');
    if (response.cartId && cookVal && cookVal.length > 5) {
      form.submit();
    } else {
      const interval = setInterval(() => {
        const cookie = getCookieValue('HybrisCart');
        if (cookie && cookie !== 'Code=' && cookie.toLowerCase().indexOf('guid') === -1 && cookie.length > 5) {
          const cookieCartId = cookie.replace(/^Code=/, '');
          setViewCartField(form, 'cartId', cookieCartId);
          form.submit();
          clearInterval(interval);
        }
      }, 1000);
    }

    hideLegacyCheckoutLoadingState();
  } catch (error) {
    const status = error?.status || 0;
    const exception = error?.message || String(error);
    const errorValue = `status code: ${status}-&-exception: ${exception}`;
    await postTrackRedirect({ csrf: errorValue });
    hideLegacyCheckoutLoadingState();
  }
}



function buildMegamenuPanel(submenuUl, parentLabel = '') {
  const dropdown = document.createElement('div');
  dropdown.className = 'nav-dropdown';

  const dropdownInner = document.createElement('div');
  dropdownInner.className = 'dropdown-inner';

  const buildMenuLinkItem = (itemLi, subsectionNameParent) => {
    const li = document.createElement('li');
    const a = itemLi.querySelector('a');
    if (!a) return li;

    const link = document.createElement('a');
    link.href = a.getAttribute('href');
    link.textContent = a.textContent.trim();

    const text = a.textContent.trim();
    link.dataset.siteSection = parentLabel;
    link.dataset.subSection = subsectionNameParent;
    link.dataset.subSectionTwo = text;

    // Authors flag a link as new in DA by adding "(NEW)" after it, e.g. "Shade Cards (NEW)".
    const trailingText = itemLi.textContent.replace(a.textContent, '');
    if (/\(\s*new\s*\)/i.test(trailingText)) {
      const badge = document.createElement('span');
      badge.className = 'new-badge';
      badge.textContent = 'New';
      link.appendChild(badge);
    }

    li.appendChild(link);
    return li;
  };

  const topLevelItems = [...submenuUl.querySelectorAll(':scope > li')];

  topLevelItems.forEach((colLi) => {
    const column = document.createElement('div');
    column.className = 'dropdown-column';

    const headingSource = colLi.querySelector(':scope > a, :scope > p > a, :scope > strong, :scope > p > strong');
    const headingText = headingSource?.textContent.trim() || '';
    const shouldHideHeading = topLevelItems.length === 1
      && headingText
      && headingText.toLowerCase() === parentLabel.toLowerCase();
    const hasVisibleHeading = headingSource && !shouldHideHeading;

    if (hasVisibleHeading) {
      const heading = document.createElement('h4');
      heading.className = 'dropdown-title';
      heading.textContent = headingText;
      // Stash siteSection (parent menu name) + subSection (this column
      // heading) so the delegated click handler can read them without
      // walking the DOM.
      heading.dataset.siteSection = parentLabel;
      heading.dataset.subSection = headingText;
      column.appendChild(heading);
    } else {
      column.classList.add('dropdown-column-no-title');
    }

    const itemsUl = colLi.querySelector(':scope > ul');
    if (itemsUl) {
      const itemLis = [...itemsUl.querySelectorAll(':scope > li')];
      // Column has no visible <h4> (dropdown-column-no-title) — leave
      // subSection blank so click_header in the ga4 menu_interaction
      // payload is empty rather than falling back to the parent label.
      const subsectionNameParent = hasVisibleHeading ? headingText : '';

      if (itemLis.length >= 8) {
        column.classList.add('dropdown-column-wide');

        const splitLists = document.createElement('div');
        splitLists.className = 'dropdown-links-split';

        const primaryList = document.createElement('ul');
        primaryList.className = 'dropdown-links';
        const secondaryList = document.createElement('ul');
        secondaryList.className = 'dropdown-links';

        itemLis.forEach((itemLi, index) => {
          const li = buildMenuLinkItem(itemLi, subsectionNameParent);
          if (index < 7) {
            primaryList.appendChild(li);
          } else {
            secondaryList.appendChild(li);
          }
        });

        splitLists.append(primaryList, secondaryList);
        column.appendChild(splitLists);
      } else {
        const linkList = document.createElement('ul');
        linkList.className = 'dropdown-links';

        itemLis.forEach((itemLi) => {
          linkList.appendChild(buildMenuLinkItem(itemLi, subsectionNameParent));
        });

        column.appendChild(linkList);
      }
    }

    dropdownInner.appendChild(column);
  });

  dropdown.appendChild(dropdownInner);
  return dropdown;
}

function normalizeNavLabel(text) {
  return text.trim();
}

function getDisplayNavLabel(text) {
  return normalizeNavLabel(text);
}

function buildNavBar(navDiv, secondaryDiv) {
  const navBar = document.createElement('div');
  navBar.className = 'header-nav-bar';
  navBar.id = 'nav';

  const inner = document.createElement('div');
  inner.className = 'header-nav-inner';

  const navLeft = document.createElement('div');
  navLeft.className = 'nav-left';

  const mainUl = navDiv.querySelector('ul');
  if (mainUl) {
    const nav = document.createElement('nav');
    nav.className = 'main-nav';
    nav.setAttribute('aria-label', 'Main navigation');

    const navList = document.createElement('ul');
    navList.className = 'nav-list';

    mainUl.querySelectorAll(':scope > li').forEach((li, index) => {
      const navItem = document.createElement('li');
      navItem.className = 'nav-item';
      navItem.classList.add(`nav-item-${index + 1}`);

      const anchor = li.querySelector(':scope > a, :scope > p > a');

      let labelText;
      if (anchor) {
        labelText = anchor.textContent;
      } else {
        const clone = li.cloneNode(true);
        clone.querySelectorAll('ul').forEach((ul) => ul.remove());
        labelText = clone.textContent;
      }
      if (!labelText.trim()) return;

      const link = document.createElement('a');
      link.className = 'nav-link';
      const href = anchor ? anchor.getAttribute('href') : null;
      link.href = href || '#';
      link.textContent = getDisplayNavLabel(labelText);

      if (link.textContent === 'Home') {
        navItem.classList.add('nav-home');
        link.setAttribute('aria-label', 'Home');
        link.textContent = '';
      }

      const submenuUl = li.querySelector(':scope > ul');
      if (submenuUl) {
        navItem.classList.add('has-dropdown');
        const chevron = document.createElement('span');
        chevron.className = 'nav-chevron';
        link.appendChild(chevron);
      }

      navItem.appendChild(link);

      if (submenuUl) {
        navItem.appendChild(buildMegamenuPanel(submenuUl, normalizeNavLabel(labelText)));
      }

      navList.appendChild(navItem);
    });

    nav.appendChild(navList);
    navLeft.appendChild(nav);
  }

  inner.appendChild(navLeft);

  if (secondaryDiv) {
    const secUl = secondaryDiv.querySelector('ul');
    if (secUl) {
      const navRight = document.createElement('div');
      navRight.className = 'nav-right';

      const secNav = document.createElement('nav');
      secNav.className = 'secondary-nav';
      secNav.setAttribute('aria-label', 'Secondary navigation');

      const secList = document.createElement('ul');
      secList.className = 'secondary-nav-list';

      secUl.querySelectorAll(':scope > li').forEach((li) => {
        const secItem = document.createElement('li');
        const a = li.querySelector('a');
        if (a) {
          const link = document.createElement('a');
          link.href = a.getAttribute('href');
          link.textContent = a.textContent.trim();
          secItem.appendChild(link);
        }
        secList.appendChild(secItem);
      });

      secNav.appendChild(secList);
      navRight.appendChild(secNav);
      inner.appendChild(navRight);
    }
  }

  navBar.appendChild(inner);
  return navBar;
}

/* Visual search assets must come from AP origin outside first-party domains. */
/* eslint-disable max-len */
function getDragDropGifUrl() {
  return `${getApOrigin()}/content/dam/apcolourcatalogue/asset/ap-revamp/visual-search/drag-drop-gif-desktop.gif`;
}
const BROWSE_ICON_SVG = '<img loading="lazy" fetchpriority="auto" src="//static.asianpaints.com/content/dam/apcolourcatalogue/asset/ap-revamp/visual-search/browse-image-icon-desktop.png" aria-hidden="true" alt="browse-image-icon-desktop" title="browse-image-icon-desktop">';
const BROWSE_CLOSE_ICON = '<img loading="lazy" fetchpriority="auto" src="//static.asianpaints.com/etc.clientlibs/apcolourcatalogue/clientlibs/clientlib-global/resources/images/CloseIconForm.webp" aria-hidden="true" alt="" title="">'
/* eslint-enable max-len */

// ──────────────────────────────────────────────
//  Cart Modal: Refresh with live data
// ──────────────────────────────────────────────

function buildVisualSearchModal() {
  const overlay = document.createElement('div');
  overlay.className = 'vs-modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'vs-modal';

  const header = document.createElement('div');
  header.className = 'vs-modal-header';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'vs-modal-close';
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.innerHTML = BROWSE_CLOSE_ICON;
  header.appendChild(closeBtn);

  const dropZone = document.createElement('div');
  dropZone.className = 'vs-dropzone';

  const title = document.createElement('p');
  title.className = 'vs-title';
  title.textContent = 'Get recommendations for Colour inspiration, Textures, Wallpapers, Interior Design ideas, etc...';

  const uploadIcon = document.createElement('div');
  uploadIcon.className = 'vs-upload-icon';
  uploadIcon.style.setProperty('--drag-image-url', `url('${getDragDropGifUrl()}')`);

  const dragText = document.createElement('p');
  dragText.className = 'vs-drag-text';
  dragText.textContent = 'Drag & drop your image here';

  const orText = document.createElement('p');
  orText.className = 'vs-or';
  orText.textContent = 'or';

  const fileInput = document.createElement('input');
  fileInput.id = 'browseImageInput';
  fileInput.type = 'file';
  fileInput.accept = 'image/jpeg,image/png,image/tiff';
  fileInput.className = 'vs-file-input';
  fileInput.style.display = 'none';
  fileInput.setAttribute('aria-label', 'Browse an image');

  // Mobile camera input
  const captureInput = document.createElement('input');
  captureInput.id = 'captureImageInput';
  captureInput.type = 'file';
  captureInput.accept = 'image/*';
  captureInput.capture = 'camera';
  captureInput.className = 'vs-capture-input';
  captureInput.style.display = 'none';
  captureInput.setAttribute('aria-label', 'Capture an image');

  const browseBtn = document.createElement('button');
  browseBtn.className = 'vs-browse-btn';
  browseBtn.type = 'button';

  const browseLabel = document.createElement('span');
  browseLabel.className = 'vs-browse-label';
  browseLabel.textContent = 'Browse an image';
  browseBtn.appendChild(browseLabel);

  const browseIcon = document.createElement('span');
  browseIcon.className = 'vs-browse-icon';
  browseIcon.innerHTML = BROWSE_ICON_SVG;
  browseBtn.appendChild(browseIcon);

  const hint = document.createElement('p');
  hint.className = 'vs-hint';
  hint.textContent = 'JPG or PNG. 5MB Maximum';

  const statusMsg = document.createElement('p');
  statusMsg.className = 'vs-status';
  statusMsg.style.display = 'none';

  const errorMsg = document.createElement('p');
  errorMsg.className = 'vs-error';
  errorMsg.style.display = 'none';

  // Shared upload progress section for desktop + mobile
  const uploadProgressSection = document.createElement('div');
  uploadProgressSection.className = 'upload-progress-section';
  uploadProgressSection.style.display = 'none';

  const uploadProgressImageSection = document.createElement('div');
  uploadProgressImageSection.className = 'upload-progress-image-section';

  const uploadProgressImage = document.createElement('div');
  uploadProgressImage.className = 'upload-progress-image';
  uploadProgressImage.style.setProperty(
    '--upload-progress-image-url',
    "url('https://www.asianpaints.com/content/dam/apcolourcatalogue/asset/ap-revamp/visual-search/upload-progress-gif-common.gif')"
  );

  const uploadProgressTitle = document.createElement('div');
  uploadProgressTitle.className = 'upload-progress-title';
  uploadProgressTitle.textContent = 'Uploading...';

  uploadProgressImageSection.append(uploadProgressImage, uploadProgressTitle);

  const uploadProgressBarSection = document.createElement('div');
  uploadProgressBarSection.className = 'upload-progress-bar-section';

  const selectedImageName = document.createElement('div');
  selectedImageName.className = 'selected-image-name';

  const progress = document.createElement('div');
  progress.className = 'progress';

  const progressBar = document.createElement('div');
  progressBar.className = 'progress-bar';
  progressBar.style.width = '0%';
  progressBar.setAttribute('role', 'progressbar');
  progressBar.setAttribute('aria-valuemin', '0');
  progressBar.setAttribute('aria-valuemax', '100');
  progressBar.setAttribute('aria-valuenow', '0');

  progress.appendChild(progressBar);
  uploadProgressBarSection.append(selectedImageName, progress);
  uploadProgressSection.append(uploadProgressImageSection, uploadProgressBarSection);

  // Desktop content stays exactly inside vs-dropzone
  dropZone.append(
    title,
    uploadIcon,
    dragText,
    orText,
    browseBtn,
    fileInput,
    hint,
    statusMsg,
    errorMsg,
    uploadProgressSection
  );

  // Mobile-only bottom sheet content
  const mobileContainer = document.createElement('div');
  mobileContainer.className = 'mobile-container';

  mobileContainer.innerHTML = `
    <div class="search-title">Search with a photo</div>

    <div class="recm-title">
      Get recommendations for Colour inspiration, Textures, Wallpapers, Interior Design ideas, etc...
    </div>

    <div class="choose-photo-section">
      <div class="choose-photo-heading">
        <p><b>Gallery </b>- Choose an existing photo</p>
      </div>
      <div class="image-icon">
        <picture>
          <img
            loading="lazy"
            fetchpriority="auto"
            src="//static.asianpaints.com/content/dam/apcolourcatalogue/asset/ap-revamp/visual-search/gallery-photo-icon-mob.png"
            alt="gallery-photo-icon-mob"
            title="gallery-photo-icon-mob"
          >
        </picture>
      </div>
    </div>

    <div class="click-photo-section">
      <div class="click-photo-heading">
        <p><b>Camera </b>- Click a photo</p>
      </div>
      <div class="camera-icon">
        <picture>
          <img
            loading="lazy"
            fetchpriority="auto"
            src="//static.asianpaints.com/content/dam/apcolourcatalogue/asset/ap-revamp/visual-search/click-photo-icon-mob.png"
            alt="click-photo-icon-mob"
            title="click-photo-icon-mob"
          >
        </picture>
      </div>
    </div>

    <div class="image-format">JPG or PNG. 5MB Maximum</div>
    <div class="vs-mobile-error" style="display: none;"></div>
  `;

  // Do not add modal-dialog/modal-content wrappers here
  modal.append(header, dropZone, mobileContainer, captureInput);
  overlay.appendChild(modal);

  const resetState = () => {
    modal.classList.remove('is-uploading');

    statusMsg.style.display = 'none';
    errorMsg.style.display = 'none';
    uploadProgressSection.style.display = 'none';

    errorMsg.textContent = '';
    statusMsg.textContent = '';

    const mobileError = mobileContainer.querySelector('.vs-mobile-error');
    if (mobileError) {
      mobileError.textContent = '';
      mobileError.style.display = 'none';
    }

    selectedImageName.textContent = '';
    progressBar.style.width = '0%';
    progressBar.setAttribute('aria-valuenow', '0');
  };

  const close = () => {
    overlay.classList.remove('active', 'vs-mobile-open');
    resetState();
    trackImageSearchClose();
  };

  closeBtn.addEventListener('click', close);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  overlay.addEventListener('vs:open', () => {
    resetState();
  });

  browseBtn.addEventListener('click', () => {
    resetState();
    fileInput.click();
  });

  const bindMobileAction = (element, callback) => {
    if (!element) return;

    element.setAttribute('role', 'button');
    element.setAttribute('tabindex', '0');

    element.addEventListener('click', callback);

    element.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        callback();
      }
    });
  };

  // Mobile Gallery CTA
  bindMobileAction(
    mobileContainer.querySelector('.choose-photo-section'),
    () => {
      resetState();
      fileInput.click();
    }
  );

  // Mobile Camera CTA
  bindMobileAction(
    mobileContainer.querySelector('.click-photo-section'),
    () => {
      resetState();
      captureInput.click();
    }
  );

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      uploadVisualSearchImage(fileInput.files[0], modal);
    }

    fileInput.value = '';
  });

  captureInput.addEventListener('change', () => {
    if (captureInput.files.length > 0) {
      uploadVisualSearchImage(captureInput.files[0], modal);
    }

    captureInput.value = '';
  });

  // Drag & drop stays desktop-only naturally because dropzone is hidden on mobile initial view
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    resetState();

    const { files } = e.dataTransfer;

    if (files.length > 1) {
      errorMsg.textContent = 'Please upload only 1 file';
      errorMsg.style.display = 'block';
      return;
    }

    if (files.length === 1) {
      uploadVisualSearchImage(files[0], modal);
    }
  });

  return overlay;
}


async function refreshCartModal(block) {
  const modal = block.querySelector('.cart-modal');
  if (!modal) return;

  const titleEl = modal.querySelector('.cart-modal-title');
  const itemsList = modal.querySelector('.cart-items-list');
  const totalRow = modal.querySelector('.cart-modal-total');
  const shopBtn = modal.querySelector('.cart-modal-shop');
  const setShopState = () => {
    modal.classList.remove('has-items');
    if (titleEl) titleEl.textContent = 'Your cart is empty';
    if (itemsList) itemsList.innerHTML = '';
    if (totalRow) {
      totalRow.classList.remove('visible');
      totalRow.innerHTML = '';
    }
    if (shopBtn) {
      shopBtn.style.display = '';
      shopBtn.textContent = 'Shop now';
      shopBtn.href = getApApi().SHOP_URL;
    }
  };

  try {
    const resp = await fetchFromAp(`${getApApi().MINI_CART}?_=${Date.now()}`, { credentials: 'include' });
    if (!resp) {
      setShopState();
      return;
    }
    const data = await resp.json();


    // Check for entries in various possible properties
    const entries = data.entries || data.cartEntries || data.items || [];
    // console.log('Found entries:', entries.length, entries); // Debug log
    
    if (data.status === 'failure' || !entries || entries.length === 0) {
      // console.log('Setting shop state - no entries found'); // Debug log
      setShopState();
      return;
    }

    const count = entries.length;
    modal.classList.add('has-items');
    // console.log('Added has-items class to modal, count:', count); // Debug log
    if (titleEl) {
      titleEl.textContent = `You have ${count} item${count !== 1 ? 's' : ''}`;
      // console.log('Set title to:', titleEl.textContent); // Debug log
    }
    if (itemsList) {
      itemsList.innerHTML = '';
      entries.forEach((entry, index) => {
        // console.log(`Entry ${index}:`, entry); // Debug log
        const product = entry.product || {};
        console.log(`Entry ${index} product:`, product); // Debug log
        console.log('Product properties:', { name: product.name, code: product.code, productUrl: product.productUrl, productImage: product.productImage }); // Debug log
        const row = document.createElement('div');
        row.className = 'cart-item-row';
        const entryId = (entry.entryNumber !== undefined && entry.entryNumber !== null) ? entry.entryNumber : (entry.entryId || entry.id || '');
        // console.log('Entry ID:', entryId); // Debug log
        const productId = product.code || product.productSKU || product.hybrisProductId || entry.productCode || entry.sku || '';
        const productPrice = entry.totalPrice?.value || entry.basePrice?.value || product.price?.value || entry.price || '';
        row.dataset.entryId = entryId;
        row.dataset.quantity = String(entry.quantity || 1);
        row.dataset.productId = String(productId || '');
        row.dataset.productSku = String(productId || '');
        row.dataset.productName = String(product.name || '');
        row.dataset.productPrice = String(productPrice || '');

        const imgSrc =
          product.productImage ||
          product.productThumbnailImg?.url ||
          product.hybrisProductId ||
          '';

        const productUrl = product.productUrl || product.url || '#';

        // console.log('Creating row HTML for entryId:', entryId, 'quantity:', entry.quantity); // Debug log
        
        row.innerHTML = `
    <a class="cart-item-image" href="${productUrl}">
      <img src="${imgSrc}" alt="${product.name || 'Product'}" loading="lazy">
    </a>

    <div class="cart-item-details">
      <a class="cart-item-name" href="${productUrl}">
        ${product.name || 'Product'}
      </a>

      <span class="cart-item-price">
        ₹ ${entry.totalPrice?.value || ''}
      </span>
    </div>

    <button class="cart-item-remove" type="button" aria-label="Remove item"></button>

    <div class="cart-item-qty-control">
      <button type="button" class="cart-qty-minus">-</button>
      <span>${entry.quantity || 1}</span>
      <button type="button" class="cart-qty-plus">+</button>
    </div>
  `;

        itemsList.appendChild(row);
      });
    }
    if (totalRow) {

      const rawTotal = data.totalPriceWithTax?.value || data.totalPrice?.value || data.totalprice || data.totalPrice || data.total || '';
      // console.log('Total price data:', { totalPriceWithTax: data.totalPriceWithTax, totalPrice: data.totalPrice, totalprice: data.totalprice, total: data.total, rawTotal }); // Debug log

      const totalPrice =
        typeof rawTotal === 'object'
          ? rawTotal.value || rawTotal.amount || ''
          : rawTotal;

      if (totalPrice) {
        totalRow.classList.add('visible');
        totalRow.innerHTML = ''
          + '<div class="cart-total-info">'
          + '<span class="total-label">Total Amount</span>'
          + `<span class="total-price">\u20B9 ${totalPrice}</span>`
          + '</div>';
      } else {
        totalRow.classList.remove('visible');
      }
    }

    if (shopBtn) {
      const hasItems = entries && entries.length > 0;

      if (hasItems) {
        const cartPathOrUrl = data.cartUrl || data.redirectUrl || data.cartPageUrl || data.url;

        shopBtn.style.display = '';
        shopBtn.textContent = 'Checkout';
        shopBtn.href = cartPathOrUrl ? resolveApLink(cartPathOrUrl) : getApApi().SHOP_URL;

        totalRow.appendChild(shopBtn);
      } else {
        shopBtn.style.display = ''; // show
        shopBtn.textContent = 'Shop now';
        shopBtn.href = getApApi().SHOP_URL;
      }
    }
  } catch {
    setShopState();
  }
}

async function attachCartItemListeners(block, cartModal) {
  if (!cartModal) return;
  const shadeClass = 'mini-cart-shade--show';

  const showShade = () => cartModal.classList.add(shadeClass);
  const hideShade = () => cartModal.classList.remove(shadeClass);

  const normalizeQty = (value) => {
    const qty = Number(value);
    return Number.isFinite(qty) && qty > 0 ? qty : 1;
  };

  const getRowProduct = (row) => ({
    entryId: row?.dataset.entryId || '',
    productId: row?.dataset.productId || row?.dataset.productSku || '',
    productSKU: row?.dataset.productSku || row?.dataset.productId || '',
    productName: row?.dataset.productName || '',
    productPrice: row?.dataset.productPrice || '',
    quantity: normalizeQty(row?.dataset.quantity),
  });

  const buildProductString = (item) => [
    '',
    item.productId || item.productSKU || '',
    item.quantity || '',
    item.productPrice || '',
    '',
    `eVar106=${item.quantity || ''};eVar107=${item.productPrice || ''}`,
  ].join(';');

  const buildCartItemsFromDom = ({ mutateEntryId = '', mutateQuantity = null } = {}) => {
    const items = [];
    cartModal.querySelectorAll('.cart-item-row').forEach((row) => {
      const item = getRowProduct(row);
      if (!item.productId && !item.productName) return;

      if (mutateEntryId && item.entryId === mutateEntryId) {
        if (mutateQuantity === null || mutateQuantity <= 0) {
          return;
        }
        item.quantity = mutateQuantity;
      }

      items.push(item);
    });
    return items;
  };

  const setMiniCartDigitalData = ({ cartItems = [], product = null } = {}) => {
    const digitalData = getDigitalData();
    digitalData.cart = digitalData.cart || {};
    digitalData.product = digitalData.product || {};
    digitalData.cart.item = cartItems.map((item) => ({
      productId: item.productId || item.productSKU || '',
      quantity: item.quantity,
      productPrice: item.productPrice || '',
    }));

    if (product) {
      digitalData.product.productSKU = product.productSKU || product.productId || '';
      digitalData.product.productName = product.productName || '';
      digitalData.product.productPrice = product.productPrice || '';
      digitalData.product.productQuantity = product.quantity;
    }
  };

  const trackMiniCartMutation = ({ eventName, product, mutateQuantity }) => {
    if (!eventName || !product) return;

    const cartItems = buildCartItemsFromDom({
      mutateEntryId: product.entryId,
      mutateQuantity,
    });
    setMiniCartDigitalData({ cartItems, product: { ...product, quantity: mutateQuantity || product.quantity } });

    const payload = {
      productSKU: product.productSKU || product.productId || '',
      productName: product.productName || '',
    };

    if (eventName === 'remove_product_click') {
      // Full delete (link "Mini-cart-Removal", event71,scRemove) reports the
      // ENTIRE line being removed: full quantity + line-total price. Matches
      // prod: ;SKU;4;1000;;eVar106=4;eVar107=1000 (4 units @ 250 = 1000).
      payload.products = buildProductString(product);
    } else if (eventName === 'mini_cart_item_plus_click'
      || eventName === 'mini_cart_item_minus_click') {
      // scAdd (+1) / scRemove (-1) report only the DELTA for the clicked
      // product: quantity 1 at the UNIT price — not the cumulative cart
      // quantity/line-total and not the full cart list. `productPrice` holds
      // the line total (entry.totalPrice), so derive the unit price.
      const origQty = Number(product.quantity) || 1;
      const lineTotal = Number(product.productPrice) || 0;
      const unitPrice = origQty > 0 ? lineTotal / origQty : lineTotal;
      payload.products = buildProductString({
        ...product,
        quantity: 1,
        productPrice: String(unitPrice),
      });
    } else {
      payload.products = cartItems.map(buildProductString).join(',');
    }

    trackEvent(eventName, payload);
  };

  cartModal.addEventListener('click', async (e) => {
    const button = e.target.closest('button');
    if (!button) return;

    const row = button.closest('.cart-item-row');
    if (!row) return;

    const entryId = row.dataset.entryId;
    const currentQuantity = Number(row.dataset.quantity) || 1;
    const currentProduct = getRowProduct(row);
    let success = false;
    let analyticsEvent = '';
    let quantityAfterAction = currentQuantity;

    showShade();
    try {
      if (button.classList.contains('cart-item-remove')) {
        button.disabled = true;
        success = await deleteCartEntry(entryId);
        analyticsEvent = 'remove_product_click';
        quantityAfterAction = 0;
        button.disabled = false;
      } else if (button.classList.contains('cart-qty-minus')) {
        button.disabled = true;
        const newQuantity = currentQuantity - 1;
        if (newQuantity < 1) {
          success = await deleteCartEntry(entryId);
          quantityAfterAction = 0;
        } else {
          success = await setCartEntryQuantity(entryId, newQuantity);
          quantityAfterAction = newQuantity;
        }
        analyticsEvent = 'mini_cart_item_minus_click';
        button.disabled = false;
      } else if (button.classList.contains('cart-qty-plus')) {
        button.disabled = true;
        success = await setCartEntryQuantity(entryId, currentQuantity + 1);
        analyticsEvent = 'mini_cart_item_plus_click';
        quantityAfterAction = currentQuantity + 1;
        button.disabled = false;
      }

      if (success) {
        trackMiniCartMutation({
          eventName: analyticsEvent,
          product: currentProduct,
          mutateQuantity: quantityAfterAction,
        });
        await refreshCartModal(block);
        const totalCount = await fetchMiniCartCount();
        updateCartBadge(block, totalCount);
      }
    } finally {
      hideShade();
    }
  }, { once: false });
}

async function deleteCartEntry(entryId) {
  if (!entryId) return false;
  const url = `apcolourcatalogue/commerce/deleteCartEntry.${encodeURIComponent(entryId)}.json?_=${Date.now()}`;
  try {
    const resp = await fetchFromAp(url, { method: 'DELETE', credentials: 'include' });
    return resp?.ok === true;
  } catch {
    return false;
  }
}

async function setCartEntryQuantity(entryId, quantity) {
  if (!entryId || quantity < 1) return false;
  const url = `apcolourcatalogue/commerce/deleteCartEntry.${encodeURIComponent(entryId)}.${encodeURIComponent(quantity)}.json?_=${Date.now()}`;
  try {
    const resp = await fetchFromAp(url, {
      method: 'PUT',
      credentials: 'include',
    });
    return resp?.ok === true;
  } catch {
    return false;
  }
}

// ──────────────────────────────────────────────
//  Interactions
// ──────────────────────────────────────────────

function closeMobilePanel(block) {
  const navInner = block.querySelector('.header-nav-inner');
  block.querySelectorAll('.nav-item.has-dropdown.active').forEach((item) => {
    item.classList.remove('active');
  });
  if (navInner) navInner.classList.remove('has-active-panel');
}

function openMobilePanel(block, item) {
  const navInner = block.querySelector('.header-nav-inner');
  block.querySelectorAll('.nav-item.has-dropdown.active').forEach((other) => {
    if (other !== item) other.classList.remove('active');
  });
  item.classList.add('active');
  if (navInner) navInner.classList.add('has-active-panel');
}

function isDesktopViewport() {
  return window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`).matches;
}

function getNavSectionName(navItem, navLink) {
  if (!navItem || !navLink) return '';

  let sectionName = navLink.querySelector('span')?.textContent?.trim() || '';
  if (!sectionName) sectionName = navLink.textContent?.trim() || '';
  if (!sectionName) sectionName = navLink.querySelector('.menu-title')?.textContent?.trim() || '';
  if (!sectionName && navItem.classList.contains('nav-home')) sectionName = 'Home';
  if (!sectionName) sectionName = navLink.getAttribute('aria-label')?.trim() || '';

  return sectionName;
}

function trackSubsectionTwoClick(sectionName, subsectionNameParent, subsectionName, redirectionLink) {
  if (!sectionName && !subsectionNameParent && !subsectionName) return;

  const sectionData = {
    siteSection: sectionName,
    subSection: subsectionNameParent,
    subSectionTwo: subsectionName,
    redirectionLink,
  };

  getDigitalData().section = sectionData;
  trackEvent('subsection_two_click', sectionData);
  pushAdobeCtaClickEvent({
    event: 'subsection_two_click',
    parentTitle: sectionName,
    destinationUrl: redirectionLink,
    subSection:subsectionNameParent , 
    subSectionTwo : subsectionName
  })
}

function bindDropdownLinkAnalytics(block) {
  block.querySelectorAll('.dropdown-title').forEach((heading) => {
    if (heading.dataset.analyticsBound === 'true') return;
    heading.dataset.analyticsBound = 'true';
    heading.addEventListener('click', () => {
      const siteSection = heading.dataset.siteSection || '';
      const subSection = heading.dataset.subSection || '';
      if (!siteSection && !subSection) return;
      getDigitalData().section = { siteSection, subSection };
      trackEvent('subsection_one_click', { siteSection, subSection });
      pushAdobeCtaClickEvent({
        event: 'subsection_one_click',
        parentTitle: siteSection,
        subSectionOne : subSection
      })
    });
  });

  block.querySelectorAll('.dropdown-links li a').forEach((link) => {
    if (link.dataset.analyticsBound === 'true') return;

    link.dataset.analyticsBound = 'true';
    link.addEventListener('click', (event) => {
      const sectionName = link.dataset.siteSection || '';
      const subsectionNameParent = link.dataset.subSection || '';
      const subsectionName = link.dataset.subSectionTwo || link.textContent?.trim() || '';
      const redirectionLink = toAbsoluteUrl(link.getAttribute('href'));

      trackSubsectionTwoClick(sectionName, subsectionNameParent, subsectionName, redirectionLink);
      ga4Implementaion({
        event: 'menu_interaction',
        click_text:subsectionName,
        click_header:subsectionNameParent,
        click_category:sectionName
      }) 
      const isModifiedClick = event.defaultPrevented
        || event.button !== 0
        || event.metaKey
        || event.ctrlKey
        || event.shiftKey
        || event.altKey
        || link.target === '_blank';

      if (isModifiedClick) return;

      const href = link.getAttribute('href');
      if (!href || href.startsWith('#')) return;

      event.preventDefault();
      window.setTimeout(() => {
        window.location.assign(href);
      }, 150);
    });
  });
}

/**
 * Wire click tracking on each L1 column heading inside the mega-menu
 * (.dropdown-title). Fires subsection_one_click (event113) per EDS
 * data layer spec (Header sheet row 4). The heading itself isn't a
 * link — this only emits the analytics event, no navigation.
 */
function bindDropdownTitleAnalytics(block) {
  block.querySelectorAll('.dropdown-title').forEach((heading) => {
    if (heading.dataset.analyticsBound === 'true') return;
    heading.dataset.analyticsBound = 'true';
    heading.addEventListener('click', () => {
      const siteSection = heading.dataset.siteSection || '';
      const subSection = heading.dataset.subSection || heading.textContent?.trim() || '';
      trackEvent('subsection_one_click', { siteSection, subSection });
      pushAdobeCtaClickEvent({
        event: 'subsection_one_click',
        parentTitle: siteSection,
        subSectionOne: subSection
      })
    });
  });
}

function trackSiteSectionClick(siteSection, redirectionLink) {
  if (!siteSection && !redirectionLink) return;

  const digitalData = getDigitalData();
  digitalData.section = {
    siteSection,
    redirectionLink,
  };

  trackEvent('sitesection_click', {
    siteSection,
    redirectionLink,
  });

  pushAdobeCtaClickEvent({
    event: 'sitesection_click',
    parentTitle: siteSection,
    destinationUrl: redirectionLink
  })
}

function bindMainNavAnalytics(block) {
  const navList = block.querySelector('.main-nav .nav-list');
  if (!navList) return;

  navList.addEventListener('click', (event) => {
    const navItem = event.target.closest('.nav-item');
    const navLink = event.target.closest('.nav-link');
    if (!navItem || !navLink || !navList.contains(navItem)) return;

    const redirectionLink = toAbsoluteUrl(navLink.getAttribute('href'));

    // Home icon is rendered as a nav item (.nav-home) inside the main
    // nav list, but on the live site it fires Custom CTA Click (e132),
    // NOT Sitesection Click (e46). Match that — same event the mobile
    // home button and header logo fire (cta_ = 'Home',
    // parentTitle = 'Menu Header').
    if (navItem.classList.contains('nav-home')) {
      triggerCTAClickWithLinkAndTitle(redirectionLink, 'Home', 'Menu Header');
      ga4Implementaion({
        event: 'menu_interaction',
        click_text: 'Home',
      });
      return;
    }

    const siteSection = getNavSectionName(navItem, navLink);

    trackSiteSectionClick(siteSection, redirectionLink);
     ga4Implementaion({
        event: 'menu_interaction',
        click_text:siteSection,
      })
  });
}

function bindSecondaryNavAnalytics(block) {
  const secondaryNavList = block.querySelector('.secondary-nav .secondary-nav-list');
  if (!secondaryNavList) return;

  secondaryNavList.addEventListener('click', (event) => {
    const navLink = event.target.closest('a');
    if (!navLink || !secondaryNavList.contains(navLink)) return;

    const navItem = navLink.closest('li');
    const siteSection = getNavSectionName(navItem, navLink) || navLink.textContent?.trim() || '';
    const redirectionLink = toAbsoluteUrl(navLink.getAttribute('href'));

    trackSiteSectionClick(siteSection, redirectionLink);
    ga4Implementaion({
      event: 'menu_interaction',
      click_text: siteSection,
    });
  });
}

function bindHeaderScrollState(block) {
  let ticking = false;

  const updateScrollState = () => {
    ticking = false;

    const scrollTop = window.scrollY || window.pageYOffset || 0;
    const isScrolled = scrollTop > 8;

    if (isDesktopViewport()) {
      block.classList.remove('mobile-scrolled');
      block.classList.toggle('desktop-scrolled', isScrolled);
      return;
    }

    block.classList.remove('desktop-scrolled');
    block.classList.toggle('mobile-scrolled', isScrolled);
  };

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(updateScrollState);
  };

  updateScrollState();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', updateScrollState, { passive: true });
}

function addInteractions(block) {
  const hamburger = block.querySelector('.nav-hamburger');
  const navBar = block.querySelector('.header-nav-bar');

  bindHeaderScrollState(block);
  bindMainNavAnalytics(block);
  bindSecondaryNavAnalytics(block);
  bindDropdownLinkAnalytics(block);
  bindDropdownTitleAnalytics(block);

  // Mobile hamburger toggle
  if (hamburger && navBar) {
    hamburger.addEventListener('click', () => {
      const expanded = hamburger.getAttribute('aria-expanded') === 'true';
      hamburger.setAttribute('aria-expanded', String(!expanded));
      hamburger.setAttribute('aria-label', expanded ? 'Open navigation' : 'Close navigation');
      hamburger.classList.toggle('is-open', !expanded);
      navBar.classList.toggle('mobile-open', !expanded);
      document.body.classList.toggle('nav-open', !expanded);
      if (expanded) closeMobilePanel(block);
    });

    navBar.addEventListener('click', (e) => {
      const link = e.target.closest('.nav-link');
      const item = link?.parentElement;
      if (!link || !item?.classList.contains('has-dropdown')) return;
      if (isDesktopViewport()) return;
      e.preventDefault();
      openMobilePanel(block, item);
    }, true);
  }

  // Back buttons for mobile dropdown panels
  block.querySelectorAll('.nav-item.has-dropdown').forEach((item) => {
    const dropdown = item.querySelector('.nav-dropdown');
    const link = item.querySelector('.nav-link');
    if (!dropdown || !link) return;

    const backBtn = document.createElement('div');
    backBtn.className = 'dropdown-back';
    const arrow = document.createElement('span');
    arrow.className = 'back-arrow';
    arrow.textContent = '\u2039';
    backBtn.appendChild(arrow);
    backBtn.appendChild(document.createTextNode(` ${link.textContent.trim()}`));
    dropdown.insertBefore(backBtn, dropdown.firstChild);

    backBtn.addEventListener('click', () => {
      closeMobilePanel(block);
    });
  });

  // Desktop megamenu hover
  block.querySelectorAll('.nav-item.has-dropdown').forEach((item) => {
    let hoverTimeout;

    item.addEventListener('mouseenter', () => {
      if (!isDesktopViewport()) return;
      clearTimeout(hoverTimeout);
      block.querySelectorAll('.nav-item.has-dropdown.active').forEach((other) => {
        if (other !== item) other.classList.remove('active');
      });
      item.classList.add('active');
    });

    item.addEventListener('mouseleave', () => {
      if (!isDesktopViewport()) return;
      hoverTimeout = setTimeout(() => {
        item.classList.remove('active');
      }, 100);
    });

    const link = item.querySelector('.nav-link');
    if (link) {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        if (!isDesktopViewport()) {
          openMobilePanel(block, item);
        }
      });
    }
  });

  // Click outside closes megamenu
  document.addEventListener('click', (e) => {
    if (!block.contains(e.target)) {
      block.querySelectorAll('.nav-item.has-dropdown.active').forEach((item) => {
        item.classList.remove('active');
      });
    }
  });

  // Cart modal + live cart data fetch
  const cartBtn = block.querySelector('.cart-btn');
  const cartModalOverlay = block.querySelector('.cart-modal-overlay');
  const cartModal = cartModalOverlay?.querySelector('.cart-modal');
  if (cartBtn && cartModal && cartModalOverlay) {
    const positionCartModal = () => {
      const rect = cartBtn.getBoundingClientRect();
      const modalW = 440;
      let rightPos = window.innerWidth - rect.right - 10;
      const minR = 12;
      const maxR = window.innerWidth - modalW - 12;
      rightPos = Math.max(minR, Math.min(rightPos, maxR));
      let isMobile = window.innerWidth <= 991;
      if (isMobile) {
        cartModal.style.setProperty('--cart-top', `${rect.bottom + 2}px`);
        cartModal.style.setProperty('--cart-right', `${rightPos}px`);
      } else {
        cartModal.style.setProperty('--cart-top', `${rect.bottom + 13}px`);
        cartModal.style.setProperty('--cart-right', `${rightPos + 15}px`);
      }
    };

    cartBtn.addEventListener('click', (e) => {
      e.preventDefault();
      // e67 - Mini Cart Icon Click
      trackEvent('mini_cart_icon_click');
      ga4Implementaion({
        event: 'header_interaction',
        click_text: 'Cart',
        click_category: 'click_header icons',
      });
      pushAdobeCtaClickEvent({
        event: 'mini_cart_icon_click',
        parentTitle: 'Cart',
      })
      refreshCartModal(block);
      positionCartModal();
      cartModalOverlay.classList.add('active');
    });

    attachCartItemListeners(block, cartModal);
  }

  // Profile — dropdown when logged in, auth redirect when not
  const profileWrapper = block.querySelector('.profile-dropdown-wrapper');
  if (profileWrapper) {
    const profileLink = profileWrapper.querySelector('.profile-auth-link');
    const dropdown = profileWrapper.querySelector('.profile-dropdown');
    const greeting = dropdown?.querySelector('.profile-dropdown-greeting');
    const signOutBtn = dropdown?.querySelector('.profile-dropdown-signout');

    const updateDropdown = () => {
      const user = getUser();
      if (user && greeting) {
        greeting.textContent = `Hello ${user.name.toUpperCase()}`;
        greeting.style.display = '';
      }
    };

    const updateProfileButton = () => {
      const user = getUser();
      profileWrapper?.classList.toggle('is-logged-in', !!user);
    };

    const closeDropdown = () => {
      dropdown?.classList.remove('active');
      dropdown?.setAttribute('aria-hidden', 'true');
    };

    const openDropdown = () => {
      block.querySelectorAll('.profile-dropdown').forEach((d) => d.classList.remove('active'));
      dropdown?.classList.add('active');
      dropdown?.setAttribute('aria-hidden', 'false');
      updateDropdown();
    };

    profileLink?.addEventListener('click', async (e) => {
      e.preventDefault();
      const user = getUser();
      if (user) {
        // e7 - Profile icon click must fire on every header icon click,
        // logged in or not (matches the live site). Use the 'Login Icon
        // Click' alias so the beacon Link name matches production exactly.
        // Logged-in click opens the dropdown, but the event still fires.
        trackEvent('Login Icon Click');
        openDropdown();
      } else {
        // e7 - Login Icon Click (must fire on header icon click)
        trackEvent('login_icon');
        pushAdobeCtaClickEvent({
          event: 'login_icon',
          parentTitle: 'Profile Icon',
        })
        // Production: redirect to OIDC auth URL (auth.asianpaints.com)
        persistPostLoginRedirectPath();
        const url = await buildProfileAuthUrl(AUTH_REDIRECT_URI);
        ga4Implementaion({
          event: 'header_interaction',
          click_text: 'Profile Icon',
          click_category: 'click_header icons',
        });
        // Give the analytics beacon a brief moment before navigation.
        await new Promise((resolve) => setTimeout(resolve, 150));
        window.location.href = url;
      }
    });

    signOutBtn?.addEventListener('click', async () => {
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      /* Ensure a real id_token is available before building the logout URL.
       * Without this, users who logged in via a prior page load have only an
       * access token in storage, and Keycloak rejects access tokens as
       * id_token_hint (400 Invalid parameter). */
      await ensureFreshIdToken();
      const idToken = getLogoutIdTokenHint();
      clearUser();
      try {
        sessionStorage.removeItem(AUTH_REDIRECTED_KEY);
      } catch (err) { /* ignore */ }
      closeDropdown();
      updateProfileButton();
      if (!isLocalhost) {
        const params = new URLSearchParams({
          client_id: 'asianpaints',
          post_logout_redirect_uri: AUTH_REDIRECT_URI,
        });
        if (idToken) {
          params.set('id_token_hint', idToken);
        }
        window.location.href = `${getAuthLogoutBase()}?${params.toString()}`;
      }
    });

    document.addEventListener('click', (e) => {
      if (profileWrapper && !profileWrapper.contains(e.target)) {
        closeDropdown();
      }
    });
  }

  // Visual search modal (from header camera buttons AND search dialog camera button)
  const vsModal = block.querySelector('.vs-modal-overlay');
  if (vsModal) {
    block.querySelectorAll('.camera-btn, .sd-camera-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Close search dialog if open
        const sdOverlay = block.querySelector('.search-dialog-overlay');
        if (sdOverlay?.classList.contains('active')) {
          sdOverlay.classList.remove('active');
          document.body.classList.remove('search-dialog-open');
        }
        trackImageSearchStart();

        vsModal.classList.toggle('vs-mobile-open', !isDesktopViewport());
        vsModal.dispatchEvent(new CustomEvent('vs:open'));
        vsModal.classList.add('active');
      });
    });
  }

  // Desktop search: clicking search bar opens the search dialog
  const searchBarEl = block.querySelector('.header-search');
  if (searchBarEl) {
    searchBarEl.addEventListener('click', () => {
      trackEvent('Header Search Icon Click');
      trackEvent('search_start');
      pushAdobeSingleEvent('search_start');
      ga4Implementaion({
        event: 'search_icon_click',
      })

      openSearchDialog(block);
    });

    searchBarEl.style.cursor = 'pointer';
    const searchInput = searchBarEl.querySelector('.search-input');
    if (searchInput) searchInput.style.cursor = 'pointer';
  }

  const headerLogoEl = block.querySelector('.header-logo');
  if (headerLogoEl) {
    headerLogoEl.addEventListener('click', () => {
      const ctaLink = headerLogoEl.getAttribute('href') || '';
      const isHomeIcon = headerLogoEl.classList.contains('home_icon');
      const btnTitle = isHomeIcon ? 'Home' : 'Home logo';
      const parentTitle = isHomeIcon ? 'Menu Header' : 'Header';
      triggerCTAClickWithLinkAndTitle(ctaLink, btnTitle, parentTitle);
    });
  }

  // Home icon (mobile) — e132 Custom CTA Click
  // cta_ = 'Home', parentTitle = 'Menu Header', redirectionLink = href
  const mobileHomeBtnEl = block.querySelector('.mobile-home-btn');
  if (mobileHomeBtnEl) {
    mobileHomeBtnEl.addEventListener('click', () => {
      const ctaLink = mobileHomeBtnEl.getAttribute('href') || '';
      triggerCTAClickWithLinkAndTitle(ctaLink, 'Home', 'Menu Header');
    });
  }

  block.querySelectorAll('.action-btn').forEach((actionBtn) => {
    actionBtn.addEventListener('click', (e) => {
      if (actionBtn.classList.contains('cart-btn')) return;
      // Profile button fires its own Login Icon Click (event7) via
      // handleProfileClick / the profile-dropdown auth link. The live
      // site (asianpaints.com) fires ONLY event7 on the profile icon —
      // NOT Header icons (event335). Skip it here so the click doesn't
      // double-fire two beacons with two different events.
      if (actionBtn.classList.contains('profile-btn')) return;

      const rawTitle = actionBtn.getAttribute('aria-label')
        || actionBtn.querySelector('.icon-tooltip-text')?.textContent
        || actionBtn.textContent
        || '';
      const title = rawTitle.replace(/\s+/g, ' ').trim();
      const rawHref = actionBtn.getAttribute('href') || '';
      const isRealLink = rawHref && rawHref !== '#' && !rawHref.startsWith('javascript:void');
      const param1 = isRealLink ? toAbsoluteUrl(rawHref) : '';

      trackEvent('Header icons', { title, param1 });

      //Header Icons GA4 Events
      const ga4EventName = 'header_interaction'
      const clickCategory = 'click_header icons'
      if (isRealLink) {
        e.preventDefault();
        ga4Implementaion({
          event: ga4EventName,
          click_text: title,
          click_category: clickCategory
        });
        setTimeout(() => { window.location.assign(rawHref); }, 300);
      } else {
        ga4Implementaion({
          event: ga4EventName,
          click_text: title,
          click_category: clickCategory
        });
      }

    });
  });

  // Mobile search: open search dialog instead of inline panel
  const mobileSearchBtn = block.querySelector('.mobile-search-btn');
  if (mobileSearchBtn) {
    mobileSearchBtn.addEventListener('click', () => {
      trackEvent('Header Search Icon Click');
      trackEvent('search_start');
      pushAdobeSingleEvent('search_start');
      openSearchDialog(block);
    });
  }

  // The .header-cta .cta-btn click tracking (Sticky Form CTA Click /
  // book_free_site_visit) also lives in scripts/delayed.js as a
  // document-level capture-phase listener, but that script isn't imported
  // until ~8s after the lazy phase completes (see loadDelayed in
  // scripts.js). On a cold/guest-mode load, a click on this CTA before
  // delayed.js has attached its listener used to fall through to this
  // handler WITHOUT firing analytics (the modal still opened, so the miss
  // went unnoticed until GA4 data was checked) — the event only fired on a
  // second click once delayed.js's capture listener was live. Firing the
  // same tracking here too closes that gap: once delayed.js's capture
  // listener IS attached, it calls stopImmediatePropagation() and this
  // bubble-phase handler never runs, so tracking still only ever fires once.
  block.querySelectorAll('.header-cta .cta-btn.trigger-book-free-site-visit-modal[data-modal-path]').forEach((ctaBtn) => {
    ctaBtn.addEventListener('click', async (e) => {
      const { modalPath } = ctaBtn.dataset;
      if (!modalPath || ctaBtn.dataset.loading === 'true') return;

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      const btnTitle = ctaBtn.textContent.trim();
      trackEvent('sticky_cta_click', {
        cta_: btnTitle,
        parentTitle: 'Header',
        redirectionLink: ctaBtn.href,
      });
      pushAdobeCtaClickEvent({
        event: 'sticky_cta_click',
        parentTitle: 'Header',
        destinationUrl: ctaBtn.href
      })
      ga4Implementaion({
        event: 'book_free_site_visit',
        click_text: btnTitle || ctaBtn.href,
        click_category: 'click_header',
      });

      ctaBtn.dataset.loading = 'true';

      document.querySelector('.cart-modal-overlay')?.classList.remove('active');
      document.querySelector('.login-guest-modal-overlay')?.classList.remove('active');
      document.querySelector('#guestLoginModal')?.classList.remove('active');

      try {
        const { openModal } = await import('../modal/modal.js');
        await openModal(modalPath);
      } catch {
        window.location.assign(ctaBtn.href);
      } finally {
        delete ctaBtn.dataset.loading;
      }
    });
  });

  // Profile button: when profileWrapper exists, profileLink handler manages click
  // (dropdown when logged in, auth redirect when not). Only use handleProfileClick
  // when there is no dropdown (legacy/fallback).
  const profileBtn = block.querySelector('.action-btn.profile-btn');
  const hasProfileDropdown = !!block.querySelector('.profile-dropdown-wrapper');
  if (profileBtn && !hasProfileDropdown) {
    profileBtn.addEventListener('click', handleProfileClick);
  }

  // Viewport resize handler
  const mql = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`);
  mql.addEventListener('change', (e) => {
    if (e.matches) {
      if (hamburger) {
        hamburger.setAttribute('aria-expanded', 'false');
        hamburger.setAttribute('aria-label', 'Open navigation');
        hamburger.classList.remove('is-open');
      }
      if (navBar) navBar.classList.remove('mobile-open');
      document.body.classList.remove('nav-open');
      closeMobilePanel(block);
      const searchPanel = block.querySelector('.mobile-search-panel');
      if (searchPanel) searchPanel.classList.remove('active');
    } else {
      block.querySelectorAll('.nav-item.has-dropdown.active').forEach((li) => li.classList.remove('active'));
    }
  });
}

// ──────────────────────────────────────────────
//  Async Integrations Init (non-blocking)
//
//  Heavy fetches (commerce/miniCart.json, apcolourcatalogue/detect-
//  location) were previously fired here on requestIdleCallback. PSI
//  showed both ending up on the critical path (3.3 s + 3.8 s
//  respectively) because synthetic audits never report idle during
//  the load window, so the 2 s idle-timeout fires and the fetches
//  race the LCP image for bandwidth — pushing LCP to 6.9 s on the
//  beta.asianpaints.com homepage.
//
//  Fix: gate each fetch to a real user-intent signal:
//   - miniCart.json — fetched only on cart-icon hover / first user
//     interaction. PSI never interacts → fetch never runs → bandwidth
//     stays free for LCP image.
//   - primeLocationContext (warm-up for autocomplete) — fired on the
//     same first-interaction signal. No LCP value, can wait.
//   - Keycloak init — KEPT on idle so the profile icon shows the
//     correct logged-in/out state without waiting for interaction.
// ──────────────────────────────────────────────

/**
 * Run `callback` exactly once, on whichever happens first:
 *  - The user's first real interaction (pointerdown / keydown / scroll / touch)
 *  - A safety timeout (default 15 s) — for tabs that the user opens and
 *    walks away from
 *
 * Returns a `cancel()` function for cases where the callback no longer
 * needs to run (e.g., the underlying need was satisfied another way).
 */
function onFirstInteraction(callback, safetyTimeoutMs = 15000) {
  let fired = false;
  const events = ['pointerdown', 'keydown', 'scroll', 'touchstart'];
  const fire = () => {
    if (fired) return;
    fired = true;
    events.forEach((evt) => window.removeEventListener(evt, fire, true));
    clearTimeout(safetyTimer);
    try { callback(); } catch (e) { /* eslint-disable-next-line no-console */ console.error(e); }
  };
  events.forEach((evt) => window.addEventListener(evt, fire, { capture: true, passive: true }));
  const safetyTimer = setTimeout(fire, safetyTimeoutMs);
  return () => {
    if (fired) return;
    fired = true;
    events.forEach((evt) => window.removeEventListener(evt, fire, true));
    clearTimeout(safetyTimer);
  };
}

async function initIntegrations(block) {
  // Keycloak runs on idle — needed early so the profile button
  // shows the right icon for logged-in vs not. Doesn't hit
  // /miniCart.json or /detect-location itself.
  initKeycloak(block);

  // Warm the location-search context only on first user interaction.
  // primeLocationContext() just pings detect-location to seed a cookie
  // for later autocomplete suggestions — no UI uses it pre-interaction.
  onFirstInteraction(() => primeLocationContext());

  // Cart count badge — fetch on cart-icon hover/focus (desktop user
  // intent) OR first interaction (mobile fallback). PSI's synthetic
  // audit never interacts, so the fetch is skipped entirely under
  // Lighthouse — bandwidth stays free for the LCP image.
  let cartFetched = false;
  const fetchAndUpdateCartCount = async () => {
    if (cartFetched) return;
    cartFetched = true;
    const count = await fetchMiniCartCount();
    updateCartBadge(block, count);
  };
  const cartBtn = block.querySelector('.cart-btn');
  if (cartBtn) {
    cartBtn.addEventListener('pointerenter', fetchAndUpdateCartCount, { once: true });
    cartBtn.addEventListener('focus', fetchAndUpdateCartCount, { once: true });
    onFirstInteraction(fetchAndUpdateCartCount);
  }
}

// ──────────────────────────────────────────────
//  Main Decorate
// ──────────────────────────────────────────────

export default async function decorate(block) {
  await fetchHeaderConfig();

  const hasSignedOut = typeof localStorage !== 'undefined' && localStorage.getItem(SIGNED_OUT_KEY) === '1';

  // 1. Real login: user returned from auth with token in URL hash
  let authUser = getUserFromUrlHash();
  if (authUser) {
    setUser(authUser);
    trackLoginSuccessfulOnce('login successful');
    const postLoginRedirectUrl = consumePostLoginRedirectPath();
    const currentPageUrl = `${window.location.origin}${window.location.pathname}${window.location.search}`;
    const redirectPageUrl = postLoginRedirectUrl ? postLoginRedirectUrl.split('#')[0] : '';
    if (redirectPageUrl && redirectPageUrl !== currentPageUrl) {
      window.location.replace(postLoginRedirectUrl);
      return;
    }
    /* Same document (only the fragment differs): location.replace() would be a
     * fragment-only navigation with no reload, leaving the header undecorated.
     * Strip the auth hash in place and continue rendering instead. */
    window.history.replaceState(null, '', postLoginRedirectUrl || currentPageUrl);
  }

  // 2. Real login: JWT from cookie (live asianpaints.com integration)
  if (!getUser() && !hasSignedOut) {
    authUser = getUserFromAuthCookie();
    if (authUser) {
      setUser(authUser);
      // Avoid duplicate login_successful beacons on auth callback pages.
      if (hasAuthCallbackHashParams()) trackLoginSuccessfulOnce('login successful');
      else trackLoginSuccessful('login successful');
    }
  }

  // 3. Auth redirect return: clear flags only (no mock user)
  if (!getUser()) {
    try {
      if (sessionStorage.getItem(AUTH_REDIRECTED_KEY) === '1') {
        sessionStorage.removeItem(AUTH_REDIRECTED_KEY);
        localStorage.removeItem(SIGNED_OUT_KEY);
      }
    } catch (err) { /* ignore */ }
  }

  // Standard EDS nav fetch: read path from metadata, fallback to /nav

  const navMeta = getMetadata('nav');
  const navPath = navMeta ? new URL(navMeta, window.location).pathname : '/nav';
  const resp = await fetch(`${navPath}.plain.html`);
  if (!resp.ok) {
    console.warn(`header: ${navPath}.plain.html returned ${resp.status}; header left empty`);
    return;
  }

  const html = await resp.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Nav section-metadata (authored in DA) — read config, then strip the
  // blocks so they don't render or shift the brand/main/nav/secondary order.
  const navConfig = {};
  doc.querySelectorAll('.section-metadata').forEach((metaBlock) => {
    [...metaBlock.children].forEach((row) => {
      const [keyCell, valueCell] = row.children;
      const key = keyCell?.textContent.trim().toLowerCase();
      if (key) navConfig[key] = valueCell?.textContent.trim().toLowerCase() || '';
    });
    metaBlock.remove();
  });
  // .plain.html delivers section-metadata as data-* attributes on the section
  const hideMiniCart = navConfig['hide-mini-cart-header'] === 'true'
    || [...doc.body.querySelectorAll(':scope > div[data-hide-mini-cart-header]')]
      .some((div) => div.dataset.hideMiniCartHeader.trim().toLowerCase() === 'true');

  const divs = [...doc.body.querySelectorAll(':scope > div')]
    .filter((div) => div.children.length || div.textContent.trim());
  if (divs.length < 4) {
    console.warn(`header: ${navPath}.plain.html has ${divs.length} section(s), expected 4 (brand, main, nav, secondary); header left empty`);
    return;
  }

  const [brandDiv, mainDiv, navDiv, secondaryDiv] = divs;

  block.textContent = '';

  // Row 0: Brand bar
  block.appendChild(buildBrandBar(brandDiv));

  // Sticky wrapper for rows 1 + 2
  const stickyWrapper = document.createElement('div');
  stickyWrapper.className = 'header-sticky';

  // Row 1: Main header
  stickyWrapper.appendChild(buildMainHeader(mainDiv));

  // Row 2: Navigation bar
  stickyWrapper.appendChild(buildNavBar(navDiv, secondaryDiv));

  block.appendChild(stickyWrapper);

  if (hideMiniCart) {
    block.querySelectorAll('.cart-btn').forEach((btn) => btn.remove());
  }

  // Mobile search panel
  block.appendChild(buildMobileSearchPanel(mainDiv));

  // Cart modal
  block.appendChild(buildCartModal());

  // Visual search modal
  block.appendChild(buildVisualSearchModal());

  // Login popup (local auth/test fallback)
  block.appendChild(buildLoginModal());

  // Search dialog (full-screen overlay)
  block.appendChild(buildSearchDialog());

  window.headerMiniCart = window.headerMiniCart || {};
  window.headerMiniCart.checkoutRedirectLogin = checkoutRedirectLogin;

  // Wire up all UI interactions
  addInteractions(block);

  // Defer integrations (cart, Keycloak) to avoid blocking LCP — run when idle
  const runIntegrations = () => initIntegrations(block);
  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(runIntegrations, { timeout: 2000 });
  } else {
    setTimeout(runIntegrations, 0);
  }
}