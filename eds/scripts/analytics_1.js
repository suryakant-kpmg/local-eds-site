/**
 * Adobe Web SDK (alloy) integration for asianpaints.com EDS pilot
 *
 * Purpose
 * -------
 * Sends analytics events from EDS pages to Adobe Edge Network → datastream →
 * existing report suite (apaintasrpprod prod / asianpaintsbeta staging).
 * Uses idMigrationEnabled so visitor identity (ECID, AAM blob) carries
 * across from AMS pages running AppMeasurement.js — reports remain
 * cumulative, no visitor inflation.
 *
 * How to wire it up
 * -----------------
 *   // scripts/scripts.js, inside loadLazy()
 *   import('./analytics.js').then(({ initAnalytics }) => initAnalytics());
 *
 * Loaded from `lazy.js` (post-LCP), NOT `delayed.js`. The 3-second
 * delayed-phase wait would miss bouncers and skew bounce/visitor metrics
 * vs. AMS pages.
 *
 * Self-host setup
 * ---------------
 *   curl -o scripts/vendor/alloy.min.js \
 *     https://cdn1.adoberesources.net/alloy/2.33.1/alloy.min.js
 *
 * PENDING ITEMS — see MIGRATION_PENDING.md
 * ----------------------------------------
 *   P0 (blocks beta):  Datastream UUIDs, AAM service decision
 *   P1 (blocks prod):  eVar51 logic, login state, meta-tag convention,
 *                      initialPercentViewed calculation
 *   P2 (defer):        Consent/CMP, prop12 intent, AppMeasurement bump
 */
import {
  SUPPRESS_ANALYTICS_FOR_THIS_PAGE,
} from './auth-callback-suppression.js';

// ============================================================
// CONFIGURATION
// ============================================================

const ORG_ID = '5FFF4CAB563CB2507F000101@AdobeOrg';

// TODO[P0]: replace placeholders after creating datastreams in
// experience.adobe.com → Data Collection → Datastreams.
//   - asianpaints-web-prod    → Analytics service → RSID apaintasrpprod
//   - asianpaints-web-staging → Analytics service → RSID asianpaintsbeta
const DATASTREAM_UUIDS = {
  'www.asianpaints.com':  'b1c04e90-7e5a-4cf7-b97f-341ac97dec1d',
  'beta.asianpaints.com': 'eab18d73-1507-436b-9655-52c600b63d9e',
  'prod2.asianpaints.com': 'eab18d73-1507-436b-9655-52c600b63d9e',
};

// Preview hosts (*.aem.page, *.aem.live, localhost) → staging datastream
//const FALLBACK_UUID = 'STAGING_DATASTREAM_UUID_TO_BE_CREATED';

const ALLOY_SRC = '/eds/scripts/vendor/alloy.min.js';
// Public CDN fallback — used only if the self-hosted copy fails to load
// (transient hosting/CDN error), so a single bad fetch doesn't silently
// leave window.alloy queuing forever with no beacon ever firing.
const ALLOY_CDN_FALLBACK_SRC = 'https://cdn1.adoberesources.net/alloy/2.33.1/alloy.min.js';
const LOGIN_SUCCESS_PENDING_KEY = 'ap_login_success_pending';

// ============================================================
// HELPERS — page identity
// ============================================================

function getCountry() {
  return (document.querySelector('meta[name="country"]')?.content || 'in').toLowerCase();
}

function getSection() {
  // TODO[P1]: confirm EDS authoring convention. Falls back to first path segment.
  const meta = document.querySelector('meta[name="section"]')?.content;
  if (meta) return meta.toLowerCase();
  const segments = location.pathname.split('/').filter(Boolean);
  return (segments[0] || '').toLowerCase();
}

function getPage() {
  const meta = document.querySelector('meta[name="pagename"]')?.content;
  if (meta) return meta.toLowerCase();
  const segments = location.pathname.split('/').filter(Boolean);
  return (segments[1] || '').toLowerCase();
}
/**
 * Builds pageName matching AMS hierarchy: `in::<path segments joined by ':'>`
 * with the `.html` extension stripped from the last segment.
 *   /                                                → 'in::'
 *   /inspiration                                     → 'in::inspiration'
 *   /colors/x                                        → 'in::colors:x'
 *   /paint-products/interior-wall-paints/royale-play.html
 *                                                    → 'in::paint-products:interior-wall-paints:royale-play'
 *
 * A `<meta name="pagename">` value takes precedence if present so
 * authors can override the URL-derived value.
 */
function getPageName() {
  const override = document.querySelector('meta[name="pagename"]')?.content?.trim();
  if (override) return override.toLowerCase();
  const country = getCountry();
  const segments = location.pathname
    .split('/')
    .filter(Boolean)
    .map((s) => s.replace(/\.html?$/i, '').toLowerCase());
  return `${country}::${segments.join(':')}`;
}

// ============================================================
// HELPERS — visitor state
// ============================================================

// Cached Web SDK ECID — populated from alloy('getIdentity') in
// initAnalytics and reused by every link-tracking beacon (sync).
let cachedEcid = '';
let ecidPromise = null; // Promise for async identity resolution

function getEcidFromIdentityCookie() {
  // Web SDK stores identity in kndctr_<ORGID>_identity (base64url protobuf).
  const orgKey = ORG_ID.replace(/@/g, '_');
  const name = `kndctr_${orgKey}_identity`;
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  if (!m) return '';
  try {
    const decoded = atob(m[1].replace(/-/g, '+').replace(/_/g, '/'));
    const idMatch = decoded.match(/\d{38}/); // ECID is a 38-digit value
    return idMatch ? idMatch[0] : '';
  } catch (e) {
    return '';
  }
}

function getECID() {
  // 1. Prefer the value resolved from alloy('getIdentity').
  if (cachedEcid) return cachedEcid;
  // 2. Web SDK identity cookie.
  cachedEcid = getEcidFromIdentityCookie();
  if (cachedEcid) return cachedEcid;
  // 3. Legacy AppMeasurement AMCV cookie (idMigration scenarios).
  const m = document.cookie.match(/MCMID(?:%7C|\|)(\d+)/);
  return m ? m[1] : '';
}

// Returns a promise that resolves when ECID is available
function getECIDAsync() {
  if (cachedEcid) return Promise.resolve(cachedEcid);
  if (!ecidPromise) {
    ecidPromise = new Promise((resolve) => {
      // Try immediately in case already cached
      const immediate = getECID();
      if (immediate) {
        resolve(immediate);
        return;
      }
      // Wait for alloy identity to resolve
      if (typeof window.alloy === 'function') {
        window.alloy('getIdentity')
          .then((res) => {
            if (res?.identity?.ECID) cachedEcid = res.identity.ECID;
            resolve(cachedEcid || getECID());
          })
          .catch(() => resolve(getECID())); // Fallback to cookie parsing
      } else {
        resolve(getECID());
      }
    });
  }
  return ecidPromise;
}

function getGAID() {
  let gaId = (document.cookie.match(/(?:^|;\s*)_ga=([^;]+)/) || [])[1] || '';
  if (gaId) {
    gaId = decodeURIComponent(gaId).replace(/^GA\d+\.\d+\./, "");
  }
  return gaId;
}

/**
 * 'Repeat' if AMCV cookie existed before alloy ran, else 'New'.
 * Must be evaluated ONCE before alloy touches the cookie.
 */
let cachedVisitorType = null;
function getVisitorType() {
  if (cachedVisitorType !== null) return cachedVisitorType;
  const hadAMCV = /AMCV_[^=]+=/.test(document.cookie);
  cachedVisitorType = hadAMCV ? 'Repeat' : 'New';
  return cachedVisitorType;
}

/**
 * Returns 'logged in' / 'not logged in' for eVar9.
 *
 * Reads Keycloak-persisted state synchronously — does NOT wait for
 * keycloak-js to finish its silent SSO check (that would defeat the
 * lazy-phase beacon timing). Reflects the last known auth state from
 * the previous page load, which is accurate for ~all real navigations.
 *
 * Sources, in priority order:
 *   1. localStorage (`keycloak-token` + `userProfile`) — set by
 *      persistKeycloakTokens() in header.js after successful auth.
 *   2. `keycloak_authToken` cookie — fallback when localStorage is
 *      blocked (incognito / privacy mode).
 */
function getLoginStatus() {
  try {
    const hasToken = !!localStorage.getItem('keycloak-token');
    const hasProfile = !!localStorage.getItem('userProfile');
    if (hasToken && hasProfile) return 'logged in';
  } catch { /* localStorage blocked — fall through to cookie check */ }
  if (/(^|;\s*)keycloak_authToken=[^;]+/.test(document.cookie)) return 'logged in';
  return 'not logged in';
}

function queuePendingLoginSuccess(eventData = {}) {
  try {
    const payload = {
      loginStatus: eventData.loginStatus || getLoginStatus() || 'logged in',
      loginFunction: eventData.loginFunction || 'login successful',
    };
    sessionStorage.setItem(LOGIN_SUCCESS_PENDING_KEY, JSON.stringify(payload));
  } catch {
    // ignore storage errors
  }
}

function consumePendingLoginSuccess() {
  try {
    const raw = sessionStorage.getItem(LOGIN_SUCCESS_PENDING_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(LOGIN_SUCCESS_PENDING_KEY);
    const parsed = JSON.parse(raw);
    return {
      loginStatus: parsed?.loginStatus || getLoginStatus() || 'logged in',
      loginFunction: parsed?.loginFunction || 'login successful',
    };
  } catch {
    return null;
  }
}

// ============================================================
// HELPERS — UTM / campaign params
// ============================================================

/**
 * Reads utm_source/utm_medium/utm_campaign/cid from the current URL only.
 * Returns values only if they are present in the URL; does not persist
 * or read from session storage.
 */
function getUtmValues() {
  const params = new URLSearchParams(location.search);
  return {
    utmSource: params.get('utm_source') || '',
    utmMedium: params.get('utm_medium') || '',
    utmCampaign: params.get('utm_campaign') || '',
    cid: params.get('cid') || '',
  };
}

// ============================================================
// HELPERS — date formatting (matches AMS exactly)
// ============================================================

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function getDateString() {
  // Format: 'year=2026 | month=May | date=27 | day=Wednesday | time=8:19 PM'
  const d = new Date();
  const h12 = d.getHours() % 12 || 12;
  const ampm = d.getHours() >= 12 ? 'PM' : 'AM';
  const min = String(d.getMinutes()).padStart(2, '0');
  return `year=${d.getFullYear()} | month=${MONTHS[d.getMonth()]} | date=${d.getDate()} | day=${DAYS[d.getDay()]} | time=${h12}:${min} ${ampm}`;
}

// ============================================================
// HELPERS — previous page name (prop12 in AMS)
// ============================================================

const PREV_PAGE_KEY = 'ap_prev_pagename';

function getPreviousPageName() {
  try {
    return sessionStorage.getItem(PREV_PAGE_KEY) || '';
  } catch {
    return '';
  }
}

function setPreviousPageName(name) {
  try {
    sessionStorage.setItem(PREV_PAGE_KEY, name);
  } catch { /* incognito or storage disabled — fail silent */ }
}

// ============================================================
// HELPERS — scroll depth (prop13 in AMS)
// ============================================================

const scrollState = { initial: 0, highest: 0 };
const scrollDepthTracked = {
  '25': false,
  '50': false,
  '75': false,
  '100': false,
};

function calcCurrentPercent() {
  const docHeight = document.documentElement.scrollHeight || 1;
  const winHeight = window.innerHeight;
  const scrollTop = window.scrollY;
  // Match legacy formula: scrollTop / (docHeight - winHeight) * 100
  const scrollPercent = (scrollTop / (docHeight - winHeight)) * 100;
  return Math.min(100, Math.round(scrollPercent));
}

function initScrollTracking() {
  // TODO[P1]: confirm AMS calculation for initialPercentViewed.
  // Current: viewport-height / document-height at first measurement.
  scrollState.initial = calcCurrentPercent();
  scrollState.highest = scrollState.initial;

  // Initialize scroll depth thresholds based on current position
  if (scrollState.initial >= 25) scrollDepthTracked['25'] = true;
  if (scrollState.initial >= 50) scrollDepthTracked['50'] = true;
  if (scrollState.initial >= 75) scrollDepthTracked['75'] = true;
  if (scrollState.initial >= 99) scrollDepthTracked['100'] = true;

  window.addEventListener('scroll', () => {
    const pct = calcCurrentPercent();
    if (pct > scrollState.highest) scrollState.highest = pct;

    // Debug: log current scroll percentage

    // Fire scroll depth events at threshold milestones
    if (pct >= 25 && !scrollDepthTracked['25']) {
      scrollDepthTracked['25'] = true;
      // Also push to Adobe Data Layer for backward compatibility
      const dl = getAdobeBasePayload ? getAdobeBasePayload() : apDataLayer();
      dl.event = 'scroll_depth';
      dl.eventInfo.scrollDepth = '25';
      window.adobeDataLayer = window.adobeDataLayer || [];
      window.adobeDataLayer.push(dl);
    }
    if (pct >= 50 && !scrollDepthTracked['50']) {
      scrollDepthTracked['50'] = true;
      // Also push to Adobe Data Layer for backward compatibility
      const dl = getAdobeBasePayload ? getAdobeBasePayload() : apDataLayer();
      dl.event = 'scroll_depth';
      dl.eventInfo.scrollDepth = '50';
      window.adobeDataLayer = window.adobeDataLayer || [];
      window.adobeDataLayer.push(dl);
    }
    if (pct >= 75 && !scrollDepthTracked['75']) {
      scrollDepthTracked['75'] = true;

      // Also push to Adobe Data Layer for backward compatibility
      const dl = getAdobeBasePayload ? getAdobeBasePayload() : apDataLayer();
      dl.event = 'scroll_depth';
      dl.eventInfo.scrollDepth = '75';
      window.adobeDataLayer = window.adobeDataLayer || [];
      window.adobeDataLayer.push(dl);
    }
    if (pct >= 99 && !scrollDepthTracked['100']) {
      scrollDepthTracked['100'] = true;
      // Also push to Adobe Data Layer for backward compatibility
      const dl = getAdobeBasePayload ? getAdobeBasePayload() : apDataLayer();
      dl.event = 'scroll_depth';
      dl.eventInfo.scrollDepth = '100';
      window.adobeDataLayer = window.adobeDataLayer || [];
      window.adobeDataLayer.push(dl);
    }
  }, { passive: true });
}

/**
 * Document-level delegation for carousel Previous/Next clicks.
 *
 * Eight blocks on this site use Slick (carousel, carousel-categories,
 * carousel-expertise, carousel-hero-banner, carousel-trending,
 * designer-collections, royal-play-banner, testimonial-carousel,
 * tools-carousel and the *-banner variants). Rather than edit each
 * block individually, intercept the click on any .slick-prev /
 * .slick-next button and fire trackCarouselNavigation with the nearest
 * section title.
 *
 * Title resolution priority:
 *   1. Nearest ancestor's [data-carousel-title] attribute (explicit
 *      opt-in for blocks that want to override)
 *   2. Nearest ancestor heading (h2/h3/h4) text
 *   3. Empty string (event still fires, just without a title)
 *
 * Covers swiper- and generic .carousel-prev/.carousel-next button
 * patterns too, in case any non-Slick carousel ever ships.
 */
function initCarouselNavigationTracking() {
  document.addEventListener('click', (e) => {
    const prev = e.target.closest('.slick-prev, .swiper-button-prev, .carousel-prev');
    const next = e.target.closest('.slick-next, .swiper-button-next, .carousel-next');
    if (!prev && !next) return;
    const btn = prev || next;
    // Skip blocks that use bindCarouselNavigationTracking — they have
    // their own handler with the correct explicit title. Firing here too
    // would cause duplicate Navigation events.
    const block = btn.closest('.block');
    if (block?.dataset.navTrackingBound === 'true') return;
    // Walk up to find an explicit title attribute, else nearest heading
    const container = btn.closest('[data-carousel-title], .block, section');
    let title = container?.getAttribute('data-carousel-title') || '';
    if (!title) {
      // Use the first heading in the section (outside the carousel cards)
      // to avoid picking up card/tile titles.
      const section = btn.closest('.section') || container;
      const heading = section?.querySelector('h2, h3, h4');
      title = heading?.textContent?.trim() || '';
    }
    trackCarouselNavigation(prev ? 'Previous' : 'Next', title);
  }, true); // capture phase — fires even if the carousel stops propagation
}

function getScrollDepthString() {
  return `highestPercentViewed = ${scrollState.highest} | initialPercentViewed=${scrollState.initial}`;
}

// ============================================================
// HELPERS — page load time (eVar51 in AMS)
// ============================================================

/**
 * Returns page load time matching the legacy AMS s_getLoadTime() formula:
 *   Math.round((now - requestStart) / 100)
 *
 * Units: deciseconds (tenths of a second) — divides by 100, not 1000.
 * Start point: performance.timing.requestStart (falls back to
 * window.inHeadTS if timing API unavailable, matching legacy fallback).
 * Returns '' when no start reference is available (same as legacy).
 */
function getPageLoadTime() {
  const now = new Date().getTime();
  const timing = window.performance ? performance.timing : null;
  const start = timing ? timing.requestStart : (window.inHeadTS || 0);
  return start ? Math.round((now - start) / 100) : '';
}

// ============================================================
// PAYLOAD CONSTRUCTION
// ============================================================

/**
 * Build Adobe Target mbox parameters for the interact (sendEvent) call.
 * These are evaluated SERVER-SIDE on Edge during decisioning, so they
 * must be on the sendEvent payload — applyPropositions is too late
 * (decisions are already made).
 *
 * Inventory from the legacy AMS Launch container
 * (launch-ENf4c71a0706064fe7b2ffe21cbff613f3.min.js, addGlobalMboxParams
 * extension settings):
 *
 *   ENABLED on legacy (checked: true):
 *     - user.categoryId        <- %categoryID%
 *     - user.colorCategoryId   <- %ColorCategoryID%
 *
 *   DISABLED on legacy (checked: false) but plumbed below for parity
 *   so re-enabling is a meta-tag change, not a code change:
 *     - mbox3rdPartyId         <- %CA_user_email%
 *     - profile.BHSdropoff     <- %tgt_bhs_audience%
 *     - profile.HCGdropoff     <- %tgt_hcg_audience%
 *     - profile.PBCdropoff     <- %tgt_pbc_audience%
 *     - profile.WBCdropoff     <- %tgt_wbc_audience%
 *     - profile.cwapWFdropoff  <- %tgt_cwap_wf%
 *     - profile.cwapHCGdropoff <- %tgt_cwap_hcg%
 *     - profile.cwapPBCdropoff <- %tgt_cwap_pbc%
 *     - profile.cwapWBCdropoff <- %tgt_cwap_wbc%
 *     - profile.TDchannelpref  <- %tgt_td_channelpref%
 *
 * Matches the legacy at.js behaviour from the captured mbox payload —
 * every configured key is sent on every Target call, with the value
 * coming from a <meta name="target-..."> tag on the page when present,
 * falling back to an empty string otherwise. Authors only need to add
 * a meta tag for the values that should drive audience qualification
 * on that specific page.
 *
 * Special case for user.categoryId: if the meta tag is absent, the
 * value is derived from the URL by deriveCategoryIdFromUrl(), which
 * ports the legacy Launch %categoryID% data element verbatim. This
 * restores category-affinity tracking (profile.categoryAffinities)
 * for paint-products and colour-catalogue pages without each one
 * needing an explicit meta tag.
 *
 * Pattern preference for profile.* attributes:
 *   - PAGE-LEVEL constant (meta tag) — useful when the value is a
 *     property of the page itself (e.g., page category, color bucket).
 *   - EVENT-DRIVEN updates — prefer setTargetProfile() for behavioral
 *     attributes like "user dropped off the BHS form". Meta tags fire
 *     on every page load with the same value; setTargetProfile() fires
 *     once at the actual event moment with the relevant value.
 *
 * Note on response-meta-only attributes (profile.IDS_PS,
 * profile.visitedSPS, profile.DEPT_KitchenURL, etc.): these appear in
 * Target response meta but are NOT set by client code on legacy — they
 * are written by SERVER-SIDE Profile Scripts defined in Target admin
 * (Audiences → Profile Scripts). They continue to work on EDS via ECID
 * migration as long as the Profile Scripts' URL trigger conditions
 * match EDS paths. Sending these from the client would race with the
 * Profile Scripts' writes — leave them out.
 */
const TARGET_MBOX_PARAM_META = Object.freeze({
  // Enabled on legacy — actively used by audiences
  'user.categoryId':         'target-category-id',
  'user.colorCategoryId':    'target-color-category-id',
  // Target Recommendations — entity.id identifies the current item so
  // the recommendation algorithm (e.g. "viewed this / viewed that",
  // "recently viewed") receives the seed key. Read from a
  // <meta name="target-entity-id"> tag on product/detail pages; omitted
  // on pages without the tag (buildTargetMboxParams drops empty values).
  'entity.id':               'target-entity-id',
  // Disabled on legacy, sent with empty default for parity
  'mbox3rdPartyId':          'target-3rdparty-id',
  'profile.BHSdropoff':      'target-profile-bhsdropoff',
  'profile.HCGdropoff':      'target-profile-hcgdropoff',
  'profile.PBCdropoff':      'target-profile-pbcdropoff',
  'profile.WBCdropoff':      'target-profile-wbcdropoff',
  'profile.cwapWFdropoff':   'target-profile-cwapwfdropoff',
  'profile.cwapHCGdropoff':  'target-profile-cwaphcgdropoff',
  'profile.cwapPBCdropoff':  'target-profile-cwappbcdropoff',
  'profile.cwapWBCdropoff':  'target-profile-cwapwbcdropoff',
  'profile.TDchannelpref':   'target-profile-tdchannelpref',
});

/**
 * URL → category-id mapping, byte-equivalent to the legacy AMS Launch
 * data element %categoryID% (from launch-ENf4c71a0706064fe7b2ffe21cbff613f3.min.js).
 * Uses String.includes() rather than strict path matching to match
 * legacy semantics exactly — any URL containing the substring matches.
 *
 * Side effect: maintains a `target-cat-<value>` class on document.body
 * (removes any prior `target-cat-*` first). Legacy Target activities
 * and CSS may select on this class — preserving the behaviour avoids
 * silent breakage on category pages.
 */
function deriveCategoryIdFromUrl() {
  const href = window.location.href;
  let id = '';
  if (href.includes('interior-wall-paints'))                                            id = 'interior-walls';
  else if (href.includes('interior-textures') || href.includes('royale-play'))          id = 'interior-textures';
  else if (href.includes('exterior-wall-paints'))                                       id = 'exterior-walls';
  else if (href.includes('exterior-textures'))                                          id = 'exterior-textures';
  else if (href.includes('wall-coverings'))                                             id = 'wall-coverings';
  else if (href.includes('waterproofing-products') || href.includes('waterproofing-solutions')) id = 'waterproofing-solutions';
  else if (href.includes('wood-for-interior') || href.includes('wood-finish') || href.includes('wood-for-exterior')) id = 'woods';
  else if (href.includes('enamel-paints'))                                              id = 'metal-enamels';
  else if (href.includes('colour-catalogue/red-wall-colours'))                          id = 'red';
  else if (href.includes('colour-catalogue/grey-wall-colours'))                         id = 'grey';
  else if (href.includes('colour-catalogue/blue-wall-colours'))                         id = 'blue';
  else if (href.includes('colour-catalogue/brown-wall-colours'))                        id = 'brown';
  else if (href.includes('colour-catalogue/orange-wall-colours'))                       id = 'orange';
  else if (href.includes('colour-catalogue/yellow-wall-colours'))                       id = 'yellow';
  else if (href.includes('colour-catalogue/green-wall-colours'))                        id = 'green';
  else if (href.includes('colour-catalogue/purple-wall-colours'))                       id = 'purple';
  else if (href.includes('colour-catalogue/pink-wall-colours'))                         id = 'pink';
  else if (href.includes('colour-catalogue/white-wall-colours'))                        id = 'white';
  else if (href.includes('colour-catalogue/off-white-wall-colours'))                    id = 'off-white';

  // Mirror legacy's body-class hook for any Target activity / CSS that
  // selects on `body.target-cat-<value>`.
  document.body.classList.forEach((c) => {
    if (c.startsWith('target-cat-')) document.body.classList.remove(c);
  });
  if (id) document.body.classList.add(`target-cat-${id}`);

  return id;
}

/**
 * Derives the Target Recommendations entity.id (the seed key the
 * recommendation algorithm keys off) from the current URL.
 *
 * EDS pages don't author a <meta name="target-entity-id"> reliably, so
 * — like deriveCategoryIdFromUrl() for the category — we fall back to a
 * stable per-page identifier: the last non-empty path segment with any
 * file extension (.html) and query/hash stripped. For a category page
 * such as /interior-wall-paints this yields 'interior-wall-paints',
 * giving Recommendations a consistent key per page. A
 * <meta name="target-entity-id"> tag (product SKU on PDPs) always
 * overrides this in buildTargetMboxParams().
 */
function deriveEntityIdFromUrl() {
  const segments = window.location.pathname.split('/').filter(Boolean);
  const last = segments[segments.length - 1] || '';
  // Royale Play is a category landing page whose URL slug ('royale-play')
  // is not a key in the interior-textures Recommendations feed. A dummy
  // SKU seed did not resolve the recommendations issue, so omit entity.id
  // entirely on this page pending guidance from the Adobe Target team
  // (support ticket in progress). Returning '' causes buildTargetMboxParams
  // to drop the key from the request payload.
  if (last === 'royale-play') return '';
  return last.replace(/\.[^.]+$/, '');
}

function buildTargetMboxParams() {
  const params = {};
  Object.entries(TARGET_MBOX_PARAM_META).forEach(([paramKey, metaName]) => {
    const v = document.querySelector(`meta[name="${metaName}"]`)?.content?.trim();
    // Omit the key entirely when the value is empty. Mirrors the legacy
    // Adobe Launch "Don't send if empty value" checkbox that was enabled
    // for user.categoryId (and the way at.js handled the disabled rows
    // for the 10 profile.* keys — they were never sent on legacy either).
    // Sending empty strings pollutes Target's CategoryAffinity Profile
    // Script — the empty value gets pushed into profile.categoryAffinities
    // and displaces real category history, which breaks audiences that
    // read profile.categoryAffinities[0] for the visitor's top category.
    if (v) params[paramKey] = v;
  });
  // user.categoryId: meta tag overrides URL-derived value. Falling back
  // to URL derivation restores legacy's auto-detection behaviour so
  // visitors browsing paint-products + colour-catalogue pages accumulate
  // category affinity (profile.categoryAffinities) without each page
  // needing an explicit meta tag.
  if (!params['user.categoryId']) {
    const derived = deriveCategoryIdFromUrl();
    if (derived) params['user.categoryId'] = derived;
  }
  // entity.id: meta tag (product SKU on PDPs) overrides the URL-derived
  // value. Falling back to URL derivation ensures the Target
  // Recommendations request always carries a seed key even on EDS pages
  // that don't author a target-entity-id meta tag.
  if (!params['entity.id']) {
    const derivedEntityId = deriveEntityIdFromUrl();
    if (derivedEntityId) params['entity.id'] = derivedEntityId;
  }
  // Mirror user.categoryId into mbox.categoryId so Adobe Target's
  // BUILT-IN Category Affinity feature receives the signal too. The
  // built-in feature reads mbox.categoryId (not user.categoryId) and
  // maintains its own top-N category list with proper accumulation
  // and recency-decay algorithms — independent of any custom Profile
  // Script that may be reading user.categoryId.
  //
  // Defense against the observed Profile Script behaviour where
  // categoryAffinities gets OVERWRITTEN on each new category visit
  // instead of accumulated. Sending both lets either mechanism (custom
  // script OR built-in) fire, whichever is correctly wired in Target
  // admin. If both fire, they update separate attributes — no conflict.
  if (params['user.categoryId']) {
    params['mbox.categoryId'] = params['user.categoryId'];
  }
  return params;
}

function buildCommonAnalyticsContextBase() {
  const pageName = getPageName();
  const timestamp = getDateString();
  const clientId = getClientID();

  const ctx = {
    pageName,
    eVar5: timestamp,
    prop5: timestamp,
    eVar6: location.href,
    prop6: location.href,
    eVar9: getLoginStatus(),
    eVar12: getECID(),
    eVar54: pageName,
    prop54: pageName,
  };

  // eVar120 = GA client ID (the _ga cookie's <random>.<timestamp> part,
  // identical to GA's `cid`). Global on every AMS hit (v120), so include
  // it on every beacon. Omitted when the _ga cookie isn't set yet.
  if (clientId) ctx.eVar120 = clientId;
  return ctx;
  //eVar13: getGAID(), // To check the variable name and set to it.
}

function buildCommonAnalyticsContext() {
  const ctx = buildCommonAnalyticsContextBase();

  // Include UTM parameters only for page load events (not interaction events)
  const {
    utmSource, utmMedium, utmCampaign, cid,
  } = getUtmValues();

  if (utmSource) ctx.eVar38 = utmSource;
  if (utmMedium) ctx.eVar39 = utmMedium;
  if (utmCampaign) ctx.eVar87 = utmCampaign;
  if (cid) ctx.eVar0 = cid;

  return ctx;
}

async function buildAnalyticsPayload() {
  const common = buildCommonAnalyticsContext();
  const { pageName } = common;
  const section = getSection();
  const previousPageName = getPreviousPageName();

  // Wait for ECID to resolve on first page load
  const ecid = await getECIDAsync();

  const payload = {
    ...common,
    server: location.hostname,
    currencyCode: 'INR',

    // Confirmed from AMS beacons (Hit 1 & Hit 2 incognito + regular):
    eVar2:  getVisitorType(),                 // 'New' | 'Repeat'
    prop12: previousPageName,                 // PREVIOUS page name (AMS pattern)
    prop13: getScrollDepthString(),
    eVar51: getPageLoadTime(),                // deciseconds since requestStart (matches s_getLoadTime)
  };
  
  // Override eVar12 with resolved ECID (replaces sync getECID value)
  if (ecid) payload.eVar12 = ecid;

  // prop1 = section, only when not homepage (matches AMS)
  if (section) payload.prop1 = section;

  // Update session state AFTER reading previous — for next pageview
  setPreviousPageName(pageName);

  return payload;
}

// ============================================================
// ADOBE LAUNCH BOOTSTRAP
// ============================================================

const ADOBE_LAUNCH_SCRIPT = 'https://assets.adobedtm.com/ef0f7eb243a4/50bf6aad1917/launch-1fb344a8e349-development.min.js';

// Sequencing script tags can't order the two libraries' interact calls —
// Launch fires its own embedded Web SDK request from its rule engine on
// its own async timeline, well after its script tag finishes loading.
// Load both in parallel; ordering the network calls isn't controllable
// from here without a real signal from the Launch container itself.
// Preconnecting these in the static <head> competed with the LCP image
// for early bandwidth/CPU; adding them here (lazy phase, JS-driven)
// still saves the DNS+TLS handshake before Launch's own Web SDK
// instance fires, without touching the eager/LCP critical path.
function preconnectAdobeLaunchOrigins() {
  ['https://assets.adobedtm.com', 'https://apl.data.adobedc.net'].forEach((href) => {
    if (document.querySelector(`link[rel="preconnect"][href="${href}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = href;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  });
}

function bootstrapAdobeLaunch() {
  preconnectAdobeLaunchOrigins();
  const script = document.createElement('script');
  script.src = ADOBE_LAUNCH_SCRIPT;
  script.async = true;
  document.head.appendChild(script);
}

// ============================================================
// ALLOY BOOTSTRAP
// ============================================================

/**
 * Injects the alloy.min.js <script> tag, retrying against `sources` in
 * order (self-hosted copy, then Adobe's public CDN) so a single
 * transient load failure doesn't leave window.alloy's stub queuing
 * forever with no beacon ever firing.
 */
function loadAlloyScript(sources) {
  const [src, ...rest] = sources;
  if (!src) {
    // eslint-disable-next-line no-console
    console.error('[analytics] alloy.min.js failed to load from all sources');
    return;
  }

  const script = document.createElement('script');
  script.src = src;
  script.async = true;
  // Bump priority so the 151 KB alloy bundle isn't deprioritized behind
  // header/footer/lazy CSS — needed to keep beacon firing within ~1–2 s
  // of LCP instead of 10–15 s.
  script.setAttribute('fetchpriority', 'high');
  script.addEventListener('error', () => {
    script.remove();
    loadAlloyScript(rest);
  }, { once: true });
  document.head.appendChild(script);
}

function bootstrapAlloy() {
  bootstrapAdobeLaunch();
  // Standard queue stub — buffers calls until alloy.min.js loads
  !function (n, o) {
    o.forEach(function (o) {
      n[o] || ((n.__alloyNS = n.__alloyNS || []).push(o),
      n[o] = function () {
        var u = arguments;
        return new Promise(function (i, l) { n[o].q.push([i, l, u]); });
      }, n[o].q = []);
    });
  }(window, ['alloy']);

  loadAlloyScript([ALLOY_SRC, ALLOY_CDN_FALLBACK_SRC]);
}

function getEdgeConfigId() {
  return DATASTREAM_UUIDS[location.hostname] || FALLBACK_UUID;
}

// Host used by Launch's own embedded Web SDK instance for its interact
// call — observing this is the only reliable signal that Launch's Target
// activity request has actually gone out (script 'load' fires long before
// its rule engine calls sendEvent).
const LAUNCH_INTERACT_HOST = 'apl.data.adobedc.net';

/**
 * Resolves once a fetch/XHR request whose URL contains `urlSubstring` is
 * observed, or after `timeoutMs` elapses — whichever comes first — so a
 * blocked/slow/removed Launch container can never permanently stall our
 * own analytics. Restores the original fetch/XHR.open on settle.
 */
function waitForNetworkCall(urlSubstring, timeoutMs) {
  return new Promise((resolve) => {
    let settled = false;
    const originalFetch = window.fetch?.bind(window);
    const originalOpen = window.XMLHttpRequest?.prototype.open;

    const settle = () => {
      if (settled) return;
      settled = true;
      if (originalFetch) window.fetch = originalFetch;
      if (originalOpen) window.XMLHttpRequest.prototype.open = originalOpen;
      resolve();
    };

    if (originalFetch) {
      window.fetch = (...args) => {
        const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;
        if (url && url.includes(urlSubstring)) settle();
        return originalFetch(...args);
      };
    }

    if (originalOpen) {
      window.XMLHttpRequest.prototype.open = function patchedOpen(method, url, ...rest) {
        if (typeof url === 'string' && url.includes(urlSubstring)) settle();
        return originalOpen.call(this, method, url, ...rest);
      };
    }

    setTimeout(settle, timeoutMs);
  });
}

/**
 * Runs `fn` and retries once (after a short delay) if it throws/rejects,
 * so a single transient sendEvent failure (network blip, edge timeout)
 * doesn't silently drop the pageview beacon.
 */
async function withRetry(fn, retries = 1, delayMs = 1000) {
  try {
    return await fn();
  } catch (err) {
    if (retries <= 0) throw err;
    await new Promise((resolve) => { setTimeout(resolve, delayMs); });
    return withRetry(fn, retries - 1, delayMs);
  }
}

// ============================================================
// PUBLIC API
// ============================================================

export async function initAnalytics() {
  if (SUPPRESS_ANALYTICS_FOR_THIS_PAGE) return;

  // Ensure legacy digitalData context is present on every page load
  // before any analytics event is dispatched.
  setDigitalDataContext(window.location.href);
  getUtmValuesAdobe(window.location.href)

  // Keep values fresh when the page is restored from bfcache.
  window.addEventListener('pageshow', () => {
    setDigitalDataContext(window.location.href);
     getUtmValuesAdobe(window.location.href)
  });

  // Lock in visitor type BEFORE alloy modifies the cookie
  getVisitorType();

  bootstrapAlloy();
  initScrollTracking();
  initCarouselNavigationTracking();

  window.alloy('configure', {
    datastreamId: getEdgeConfigId(),
    orgId: ORG_ID,
    idMigrationEnabled: true,           // reuse AMCV cookie from AppMeasurement
    targetMigrationEnabled: false,
    thirdPartyCookiesEnabled: false,
    defaultConsent: 'in',               // TODO[P2]: switch to 'pending' if CMP gates
    clickCollectionEnabled: true,
    // Adobe Target / Web SDK personalization. Required so Alloy
    // requests decisions on sendEvent and can render VEC visual edits
    // automatically (via renderDecisions: true below).
    personalizationStorageEnabled: false,
    debugEnabled: location.hostname !== 'www.asianpaints.com',
  });

  // Replay deferred login_successful from auth-callback URLs where
  // analytics was intentionally suppressed.
  const pendingLoginSuccess = consumePendingLoginSuccess();
  if (pendingLoginSuccess) {
    trackEvent('login_successful', pendingLoginSuccess);
  }

  // Resolve the Web SDK ECID once and cache it so subsequent link-tracking
  // beacons can populate eVar12 synchronously (getECID()).
  // Also resolve the async promise for trackEvent calls.
  getECIDAsync();
  window.alloy('getIdentity')
    .then((res) => { if (res?.identity?.ECID) cachedEcid = res.identity.ECID; })
    .catch(() => { /* ignore — falls back to identity cookie parsing */ });

  try {
    // Two-phase Target apply (renderDecisions: false + applyPropositions):
    //
    // Why not renderDecisions: true? The legacy AMS Target customCode
    // (every existing activity inherited from Adobe Launch) uses
    // jQuery patterns: $(document).ready, $(selector), $.append, etc.
    // jQuery is loaded on-demand in EDS — not present when Alloy
    // first executes propositions in lazy phase. With auto-render,
    // the customCode throws "ReferenceError: $ is not defined" and
    // the Target experience silently fails.
    //
    // Instead: receive propositions, conditionally preload jQuery if
    // any customCode actually uses it (regex on the content string),
    // then hand the propositions back to Alloy via applyPropositions.
    // The Display notification (for impression reporting + A4T) still
    // fires correctly — applyPropositions emits it just like
    // renderDecisions: true would.
    //
    // Pages without Target activity: empty propositions array, no
    // jQuery preload triggered, behaviour identical to today.
    //const targetParams = buildTargetMboxParams();
    const analyticsPayload = await buildAnalyticsPayload();

    // Only the actual network call is held back — alloy is already
    // configured/ready above — so Launch's own interact call (or a 4s
    // safety timeout) lands first without delaying alloy's init.
    await waitForNetworkCall(LAUNCH_INTERACT_HOST, 4000);

    const response = await withRetry(() => window.alloy('sendEvent', {
      renderDecisions: false,
      data: {
        __adobe: {
          analytics: analyticsPayload,
          // Only include target key when at least one param has a value.
          // Sending an empty target object is harmless but cleaner to omit
          // when there's nothing for Target to act on.
          //...(Object.keys(targetParams).length && { target: targetParams }),
        },
      },
    }));

    const propositions = response?.propositions || [];
    if (propositions.length) {
      const customCodeNeedsJQuery = propositions.some((p) => p.items?.some(
        (i) => i?.data?.type === 'customCode'
          && /\$\(|jQuery/.test(i.data.content || ''),
      ));
      if (customCodeNeedsJQuery && typeof window.loadJQuery === 'function') {
        await window.loadJQuery().catch(() => { /* fall through, customCode may still fail but rest applies */ });
      }
      await window.alloy('applyPropositions', { propositions });
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[analytics] alloy sendEvent failed', err);
  }
}

/**
 * For SPA-style virtual pageviews if/when EDS pages do client-side routing.
 * Not used by initial pageview path.
 */
export async function trackVirtualPageview() {
  if (SUPPRESS_ANALYTICS_FOR_THIS_PAGE) return;
  const analyticsPayload = await buildAnalyticsPayload();
  window.alloy('sendEvent', {
    data: { __adobe: { analytics: analyticsPayload } },
  });
}

// Export async ECID getter for form/event tracking that needs valid ECID
export { getECIDAsync };

/**
 * Write Target profile attributes (sticky, server-side, persist across
 * sessions on the ECID's Target profile).
 *
 * Call from form-funnel handlers — NOT on every pageview. Each key
 * shows up in Target audiences as ${profile.<key>}.
 *
 *   import { setTargetProfile } from '/eds/scripts/analytics_1.js';
 *   onBHSFormAbandon(() => setTargetProfile({ BHSdropoff: 1 }));
 *   onBHSFormSubmit(()  => setTargetProfile({ BHSdropoff: 0 }));
 *
 * Fires its own lightweight sendEvent. No decisions are requested
 * (this isn't a pageview), so Edge just writes the attributes and
 * the next pageview's interact call qualifies any audiences that
 * read them.
 */
export function setTargetProfile(attrs) {
  if (SUPPRESS_ANALYTICS_FOR_THIS_PAGE) return;
  if (!attrs || typeof attrs !== 'object') return;
  const entries = Object.entries(attrs).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (!entries.length) return;
  const profileParams = Object.fromEntries(entries.map(([k, v]) => [`profile.${k}`, v]));
  window.alloy('sendEvent', {
    data: { __adobe: { target: profileParams } },
  });
}

// ============================================================
// EVENT TRACKING — legacy-compatible API (was in analytics.js)
// All public helpers below previously routed through Adobe Launch
// (`_satellite.track`). They now route through Alloy. Function
// signatures are unchanged so blocks need only swap the import path.
// ============================================================

/**
 * EVENT_REGISTRY — maps EDS-side event names to:
 *   - `events`: the AMS success-event ID (e.g. 'event8')
 *   - `eVars`:  per-field eventData → eVarN map
 *
 * Built from real AMS beacons captured via Adobe Experience Platform
 * Debugger on www.asianpaints.com (3 sessions, May 29 2026). Without
 * Adobe Launch in between, the code populates the AMS payload directly
 * — no server-side Processing Rules needed.
 *
 * Entries with `events: undefined` arrive at the report suite as
 * link-tracking hits with contextData populated, but don't increment
 * a specific success-event counter (gracefully degraded for
 * unconfirmed mappings).
 */
// Shared definitions for events that have both snake_case (spec) and
// titlecase (legacy code) aliases. Defining once and referencing from
// both keys avoids drift.
const FORM_START_DEF = {
  events: 'event8',
  eVars: {
    campaignId: 'eVar15',
    // formName lands in BOTH eVar17 and prop17 per spec
    formName:   ['eVar17', 'prop17'],
  },
};
const FORM_SUBMIT_DEF = {
  events: 'event9',
  eVars: {
    campaignId:     'eVar15',
    formName:       ['eVar17', 'prop17'],
    dataDestination:'eVar117',
    contruction:    'eVar73',
    whatsappOptIn:  'eVar108',
    localpainter:   'eVar110',
  },
};
const FORM_ERROR_DEF = {
  events: 'event10',
  eVars: {
    campaignId: 'eVar15',
    formName:   ['eVar17', 'prop17'],
    // formError carries pipe-joined field names per spec; lands in
    // both eVar18 and prop18.
    formError:  ['eVar18', 'prop18'],
  },
};
const HEADER_ICONS_DEF = {
  events: 'event335',
  eVars: { title: 'eVar67', parentTitle: 'eVar67', param1: 'eVar86', redirectionLink: 'eVar86' },
};
const CONTRACTOR_SEARCH_DEF = {
  events: 'event220',
  eVars: { cityPincode: 'eVar32' },
};

const EVENT_REGISTRY = {
  // Forms — both legacy titlecase keys AND spec snake_case keys map to
  // the same definition. New code should prefer the snake_case names
  // (form_start, form_submit, form_error) — they match the EDS data
  // layer spec verbatim.
  'Form start':  FORM_START_DEF,
  form_start:    FORM_START_DEF,
  'Form Submit': FORM_SUBMIT_DEF,
  form_submit:   FORM_SUBMIT_DEF,
  form_error:    FORM_ERROR_DEF,

  // Search
  'Header Search Icon Click': { events: 'event330' },
  'Search Start': { events: 'event54', eVars: { flowType: 'eVar36', category: 'eVar29', subFlow: 'eVar119' } },
  search_start:   { events: 'event54', eVars: { flowType: 'eVar36', category: 'eVar29', subFlow: 'eVar119' } },
  'Search Bar Close': { events: 'event336' },
  ub_imagesearch_start: { events: 'event312' },
  ub_imagesearch_close: { events: 'event313' },
  // Spec event ID is event314, not event174 (earlier best-guess corrected
  // against EDS data layer doc, Header sheet row 7).
  ub_imagesearch_complete: { events: 'event314', eVars: { totalResults: 'eVar28' } },

  // Auth — titlecase (legacy) + snake_case (spec); eVar6/prop6/eVar54/prop54
  // are page-level vars set globally in buildPageData() on every hit.
  'Login Icon Click': { events: 'event7' },
  login_icon:         { events: 'event7' },
  login_successful:   { events: 'event48', eVars: { loginStatus: 'eVar9', loginFunction: 'eVar46' } },

  // Cart — spec action name: mini_cart_icon_click; mini_cart_click kept as legacy alias.
  // eVar21 = value of the HybrisCart cookie (auto-read at dispatch time via def.cookies).
  mini_cart_click:      { events: 'event67', cookies: { HybrisCart: 'eVar21' } },
  mini_cart_icon_click: { events: 'event67', cookies: { HybrisCart: 'eVar21' } },
  mini_cart_item_plus_click:  { events: 'scAdd,event189', eVars: { productSKU: 'eVar59', productName: 'eVar8' } },
  mini_cart_item_minus_click: { events: 'scRemove,event199', eVars: { productSKU: 'eVar59', productName: 'eVar8' } },
  remove_product_click:       { events: 'event71,scRemove', eVars: { productSKU: 'eVar59', productName: 'eVar8' } },

  // Checkout — titlecase (legacy) + snake_case (spec); eVar6/prop6/eVar54/prop54 are global.
  'Mini_cart_checkout':  { events: 'event97' },
  mini_cart_checkout:    { events: 'event97' },

  // CTAs / navigation
  custom_cta_click: {
    events: 'event132',
    eVars: {
      cta_: 'eVar45',
      parentTitle: 'eVar67',
      redirectionLink: 'eVar86'
    },
  },
  // Header sticky CTA — mapped under the snake_case `sticky_cta_click` key
  // below (single canonical linkName). Titlecase entry removed so all
  // sticky-CTA beacons report the same linkName.
  // Header icon — legacy titlecase + spec snake_case both map here.
  // Spec adds parentTitle/redirectionLink (HEADER_ICONS_DEF supports
  // both old { title, param1 } AND new { parentTitle, redirectionLink }
  // keys so legacy callers don't break).
  'Header icons': HEADER_ICONS_DEF,
  header_icons:   HEADER_ICONS_DEF,
  sitesection_click: {
    events: 'event46',
    eVars: { siteSection: 'eVar22', redirectionLink: 'eVar86' },
  },
  subsection_one_click: {
    events: 'event113',
    eVars: { siteSection: 'eVar22', subSection: 'eVar65' },
  },
  subsection_two_click: {
    events: 'event114',
    eVars: {
      siteSection: 'eVar22',
      subSection: 'eVar65',
      subSectionTwo: 'eVar66',
      redirectionLink: 'eVar86',
    },
  },

  // Contractors / store — legacy titlecase + spec snake_case both map
  // to the same definition.
  'Contractor Search Click': CONTRACTOR_SEARCH_DEF,
  contractor_search:         CONTRACTOR_SEARCH_DEF,
  store_locator: {
    events: 'event17',
    eVars: { cityPincode: 'eVar32', cta_: 'eVar45' },
  },

  // Testimonial / video / downloads
  'Testimonial - Click to expand (Open)': {
    events: 'event298',
    eVars: { ctaText: 'eVar45' },
  },
  // Spec uses snake_case `test_open` for the same testimonial-video-play
  // event (EDS Home Page sheet row 16).
  test_open: { events: 'event298' , eVars: { testTitle: 'eVar67' }   },
  // short_video_play — spec uses videoTitle as the key (legacy code
  // passed viewsCount). Map both to eVar35.
  short_video_play: { events: 'event296', eVars: { viewsCount: 'eVar35', videoTitle: 'eVar35' } },
  download_form_pdf: { events: 'event137', eVars: { pdfName: 'eVar96' } },

  // Chat widget open/close (Salesforce placeholder + Sprinklr live chat).
  // Both event132 and event51 fire on every hit; eVar45/eVar67
  // (chatAction/chatType) differentiate open-vs-close and which widget.
  chatbot_interaction: {
    events: 'event132,event51',
    eVars: { chatAction: 'eVar45', chatType: 'eVar67' },
  },

  // Navigation arrows (Previous/Next) on home + contractor carousels.
  // Spec key is exactly "Navigation" with capital N; also accept the
  // lowercase form for safety.
  Navigation: {
    events: 'event300',
    eVars: { direction: 'eVar45', testTitle: 'eVar67', parentTitle: 'eVar67' },
  },
  // navigation: {
  //   events: 'event300',
  //   eVars: { direction: 'eVar45', testTitle: 'eVar67', parentTitle: 'eVar67' },
  // },

  // Exit-intent modal
  'Exit Intent Pop-up Impression': { events: 'event359' },
  'Exit Intent Popup Close': { events: 'event277' },

  // ============================================================
  // BEST-GUESS MAPPINGS (not yet confirmed via debugger capture).
  // Derived from:
  //   - The May 2026 AMS report (test.csv) — confirms event ID and
  //     dimension shape for events listed in that report.
  //   - The `asianpaintsbeta` report-suite event definitions — used to
  //     pick the semantically closest eventN for each linkName.
  // Reviewers: please verify each entry with a debugger capture on
  // www.asianpaints.com before relying on these IDs for reporting.
  // ============================================================

  // Splash popup
  splash_view: { events: 'event6' }, // best-guess (matches test.csv "Splash Impressions [e6]")

  splash_close: { events: 'event18' }, // best-guess (matches test.csv "Splash Close [e18]")
  
  // Header domain switch
  domain_swicth: {
    events: 'event331', // best-guess (matches test.csv "Domain Switch Tab Click [e331]")
    eVars: { destinationUrl: 'eVar86' },
  },

  // Sticky form CTA (e.g. "Book Free Site Visit"). Single canonical entry —
  // all sticky-CTA call sites (header block + delayed.js listeners) fire this
  // one snake_case linkName so reporting sees a single value. event278.
  sticky_cta_click: {
    events: 'event278', // matches test.csv "Sticky Form CTA Clicks [e278]"
    eVars: {
      cta_: 'eVar45',
      parentTitle: 'eVar67',
      redirectionLink: 'eVar86',
    },
  },

  // Carousel banner
  carousel_banner_click: {
    events: 'event96', // Painting Contractors sheet row 1 — Banner Image Click
    eVars: {
      parentTitle:          'eVar67', // "Title of the Banner"
      bannerTitle:          'eVar67', // legacy key alias
      redirectionLink:      'eVar86', // "redirection url"
      bannerDestinationUrl: 'eVar86', // legacy key alias
    },
  },

  // Inspiration category filter
  waterproofing_categories: {
    events: 'event324', // best-guess (matches test.csv "Waterproofing Categories [e324]")
    eVars: { title: 'eVar67' },
  },

  // Generic CTA-link tracking
  cta_link_text: {
    events: 'event143', // best-guess (Custom Link Click [e143])
    eVars: { cta_: 'eVar45', parentTitle: 'eVar67', param1: 'eVar86' },
  },
  custom_link_text: {
    events: 'event143', // best-guess (same as cta_link_text)
    eVars: { cta_: 'eVar45' },
  },

  // Form thank-you popup (AMS has 4 per-form variants: e38–41 by form).
  // Fires for ALL forms today — defaulting to event38 (All Services TYP)
  // until each form block passes a formType field that we can switch on.
  Form_thank_you_pop_up: {
    events: 'event38', // best-guess — refine to formType-conditional later
    eVars: { formName: 'eVar17' },
  },

  // PDF / download — spec adds Title → eVar67 (EDS Home Page row 14).
  download_multiple_pdf: {
    events: 'event134',
    eVars: { pdfName: 'eVar96', Title: 'eVar67', parentTitle: 'eVar67' },
  },

  // Search no-result
  no_result: {
    events: 'event87', // best-guess (Null Searches [e87])
    eVars: { search_term: 'eVar11' },
  },

  // Video
  video_playbotton_click: {
    events: 'event20', // best-guess (Video Played [e20])
    eVars: { videoTitle: 'eVar35' },
  },
  youtube_play: {
    events: 'event20', // Painting Contractors sheet row 10
    eVars: { url: 'eVar35', videoTitle: 'eVar35' },   // accept either key
  },
  // Spec event ID is event297 (EDS Home Page sheet row 17),
  // not event132 (earlier best-guess as a generic Custom CTA Click).
  short_video_shop: {
    events: 'event297',
    eVars: { param1: 'eVar86'},
  },

  // Product / gallery interactions — spec event ID is event293
  // (EDS Home Page sheet rows 5, 10; Painting Contractors sheet row 2),
  // not event122 (earlier best-guess as Product click on PLP).
  product_tile_click: {
    events: 'event293',
    eVars: {
      productName: 'eVar8',
      param1:      'eVar86',
      Title:       'eVar67',
      parentTitle: 'eVar67',   // accept either Title or parentTitle
    },
  },

  filter_click: { events: 'event121', eVars: { filter: 'eVar34' } },
  natural_wood_shade_click: { events: 'event158', eVars: { productName: 'eVar8' } }, // best-guess (Natural wood shade click)
  

  // Painting Contractors sheet row 5 — areas of expertise tiles.
  squarecross_click: {
    events: 'event144',
    eVars: { cta_: 'eVar45', param2: 'eVar86' },
  },

  // Calculator
  calc_start: {
    events: 'event301',
    eVars: { flowType: 'eVar36' },
  },
  calc_continue: {
    events: 'event302',
    eVars: { flowType: 'eVar36', calcType : 'eVar67', filter: 'eVar26' },
  },

  // Footer
  footer_phone_number_click: { events: 'event105' }, // best-guess (Footer contact us)
  footer_tab: {
    events: 'event107', // best-guess (Footer tab click)
    eVars: { cta_: 'eVar45' },
  },
  footer_country: {
    events: 'event109', // best-guess (Country selection)
    eVars: { cta_: 'eVar45' },
  },
  footer_socialicons: {
    events: 'event108', // best-guess (Social media icon Click)
    eVars: { platform: 'eVar52' }, // social icons report platform in eVar52 only (no eVar45)
  },

  // Contact CTAs
  SPSContactClick: { events: 'event280', eVars: { cta_: 'eVar45' } },
  contact_us_click_whatsapp: { events: 'event280', eVars: { cta_: 'eVar45' } },

  // ============================================================
  // AMS-fired linkNames our EDS code doesn't yet fire (or fires
  // partially). Adding registry entries so that, once the
  // corresponding trackEvent calls are added in block code (or as
  // EDS authors blocks that need them), the AMS event ID flows
  // automatically.
  //
  // Event IDs mapped from the asianpaintsbeta report-suite config
  // by semantic name match. All are best-guess — verify via
  // Adobe Experience Platform Debugger.
  // ============================================================

  // Footer
  footer_email_click: { events: 'event103' }, // best-guess (Footer email Subscribe)
  footer_links: {
    events: 'event143', // best-guess (Custom Link Click — generic footer-link tracking)
    eVars: { cta_: 'eVar45', parentTitle: 'eVar67', redirectionLink: 'eVar86' },
  },

  // App downloads (footer / banner)
  appstore_click: {
    events: 'event58', // best-guess (App Download Click [e58])
    eVars: { location_Id: 'eVar70' }, // eVar70 = App downloads
  },
  googleplay_click: {
    events: 'event58', // best-guess (same as appstore_click)
    eVars: { location_Id: 'eVar70' },
  },

  // Store locator
  'find a store': {
    events: 'event164', // best-guess (Store locator click [e164])
    eVars: { cta_: 'eVar45', pinCode: 'eVar32' },
  },
  share_store_location: {
    events: 'event157', // best-guess (Store Locator share click [e157])
    eVars: { shareMode: 'eVar45', storeName: 'eVar97', pinCode: 'eVar32' },
  },

  // Search
  ub_search_enter: {
    events: 'event56', // best-guess (Search Button Click [e56])
    eVars: {
      searchTerm: 'eVar11',
      parentTitle: 'eVar67',
      totalResults: 'eVar28',
      flowType: 'eVar36',
      successStatus: 'eVar55',
    },
  },

  ub_search_autoclick: {
    events: 'event308',
    eVars: {autoSearchTerm: 'eVar40', linkHead: 'eVar41', searchTerm: 'eVar11'}
  },

  // Popups
  popup_exit: { events: 'event18' }, // best-guess (Splash Popup Close [e18]) — verify per modal type

  // Guest checkout / login flow (we already have guest_login_continue/successful/error
  // mapped to event49/50/11 — adding guest_login_start as the "start" CTA click).
  guest_login_start: {
    events: 'event48', // best-guess (Login/Register CTA Click [e48])
    eVars: { checkoutType: 'eVar15', loginStatus: 'eVar9' },
  },
  guestuser_address_close: {
    events: 'event102', // best-guess (Login Popup Close [e102])
    eVars: { checkoutType: 'eVar15', loginStatus: 'eVar9' },
  },

  // Form file upload
  File_upload_successful: { events: 'event101' }, // best-guess (Registration complete-style — TBD verify)

  nc_pop_click: {
    events: 'event339',
    eVars: { Destination_URL: 'eVar86', Title: 'eVar67', PopupNumber: 'eVar13' },
  },

  nc_pop_impressions : { 
    events: 'event338', 
    eVars: { Title: 'eVar67', PopupNumber: 'eVar13' } 
  },

  nc_pop_close: {
    events: 'event340',
    eVars: { Title: 'eVar67', PopupNumber: 'eVar13' },
  },

  exit_intent_impression : { events: 'event359'},

  form_failure: { 
    events: 'event354', 
    eVars: { formName: 'eVar17', campaignId: 'eVar15' },
  },

};

/**
 * Returns the digitalData object or creates an empty one if it doesn't
 * exist. Kept as a no-op stub for backwards compatibility — many legacy
 * blocks still read from / mutate `window.digitalData.user.*` etc.
 * Alloy itself does NOT read this object; the page-load payload is built
 * from getLoginStatus / getECID / etc. above.
 *
 * @returns {Object} The digitalData object
 */
export function getDigitalData() {
  window.digitalData = window.digitalData || {};
  return window.digitalData;
}

/**
 * Resolves the visible form heading for form analytics events.
 *
 * The form block (blocks/form/form.js) passes the authored small title
 * as `formName`, but reporting standardises on the visible main heading.
 * Reads it from the DOM, preferring a form inside an open modal dialog
 * (e.g. the exit-intent "Let our experts help you!" popup) and falling
 * back to the first form on the page. Returns the large (main) title,
 * falling back to the small title.
 *
 * @returns {string} the resolved form title, or '' if none found
 */
function resolveActiveFormTitle() {
  // Only resolve a title when a modal form is open. Inline form blocks
  // (form-banner, form) already pass their own visible heading as
  // formName, so overriding them is both unnecessary and harmful:
  // scoping to `.form-description-cell` page-wide leaked the FIRST
  // on-page form's sub-description text into every form's eVar17/prop17.
  const dialog = document.querySelector('dialog[open]');
  if (!dialog) return '';

  // Modal forms (e.g. Book Free Site Visit) pass a slug as formName and
  // rely on this to surface the visible heading. Prefer an explicit
  // description-cell title inside the dialog — the "small" title is the
  // actual heading, the "large" title is a sub-description — then fall
  // back to the dialog's first visible heading.
  const cell = dialog.querySelector('.form-description-cell');
  if (cell) {
    const small = cell.querySelector('.form-title-small')?.textContent?.trim();
    const large = cell.querySelector('.form-title-large')?.textContent?.trim();
    if (small || large) return small || large;
  }

  const heading = dialog.querySelector('h1, h2, h3, h4, h5, h6')?.textContent?.trim();
  return heading || '';
}

/**
 * Tracks a custom event by sending an Alloy beacon.
 *
 * Looks up `eventName` in EVENT_REGISTRY:
 *   - sets `events` (eventN) directly on the analytics payload
 *   - maps known `eventData` keys to specific eVarN / propN fields
 *     (a registry value may be a string OR an array of strings, in
 *     which case the same value lands in every listed destination —
 *     used when spec requires e.g. formName to populate eVar17 AND
 *     prop17 simultaneously)
 *   - any unmapped keys land in `contextData`
 *
 * Every event auto-includes page-context fields (eVar6/prop6/eVar54/
 * prop54) so link-tracking beacons carry page identity the same way
 * pageview beacons do. With Web SDK each sendEvent is stateless — no
 * inherited page context — so we have to set these explicitly per
 * event. Matches the legacy AMS behaviour declared in the EDS data
 * layer spec (Header sheet rows 1, 3-8).
 *
 * Fails silently if Alloy hasn't been bootstrapped yet (a click in the
 * first ~few hundred ms before loadLazy fires `initAnalytics`).
 *
 * @param {string} eventName  AMS linkName (preserve exact case + spaces)
 * @param {Object} [eventData]
 */
export function trackEvent(eventName, eventData = {}) {
  const name = typeof eventName === 'string' ? eventName.trim() : '';
  if (SUPPRESS_ANALYTICS_FOR_THIS_PAGE) {
    if (name === 'login_successful') queuePendingLoginSuccess(eventData);
    return;
  }
  if (!name) return;
  if (typeof window.alloy !== 'function') return;

  // Mutate legacy digitalData.event for any block still reading it.
  getDigitalData().event = name;

  const def = EVENT_REGISTRY[name] || {};
  const analytics = {
    ...buildCommonAnalyticsContextBase(),
    linkName: name,
    linkType: 'o',
  };
  if (def.events) analytics.events = def.events;

  // Auto-read cookies declared in the registry def (e.g. cookies: { HybrisCart: 'eVar21' })
  if (def.cookies) {
    Object.entries(def.cookies).forEach(([cookieName, dest]) => {
      const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${cookieName}=([^;]*)`, 'i'));
      if (m) analytics[dest] = decodeURIComponent(m[1]);
    });
  }

  // Split eventData keys: known → eVarN/propN (may be array of dests);
  // unknown → contextData
  const eVarMap = def.eVars || {};

  // Form events: the form block passes the authored small title as
  // formName (e.g. "book-free-site-visit"), but reporting standardises on
  // the visible main heading (e.g. "Let our experts help you!"). Resolve
  // that from the DOM here so the correction lives entirely on the
  // analytics side.
  let data = eventData;
  if (eVarMap.formName && data.formName !== undefined) {
    const formTitle = resolveActiveFormTitle();
    if (formTitle) data = { ...data, formName: formTitle };
  }

  // Reserved Adobe Analytics variables are mapped to top-level analytics
  // properties below (not contextData), so exclude them from the loop —
  // otherwise `products` also leaks into contextData ("product syntax
  // passed as context data").
  const RESERVED_KEYS = new Set(['products']);
  const contextData = {};
  Object.entries(data).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    if (RESERVED_KEYS.has(k)) return;
    const target = eVarMap[k];
    const stringValue = String(v);
    if (target) {
      const dests = Array.isArray(target) ? target : [target];
      const mappedValue = dests.includes('eVar86') ? normalizeTrackedUrl(stringValue) : stringValue;
      dests.forEach((t) => { analytics[t] = mappedValue; });
    } else {
      contextData[k] = stringValue;
    }
  });
  if (Object.keys(contextData).length) analytics.contextData = contextData;

  // Form submissions: URL utm_campaign wins over the block's configured
  // campaignId (eVar15); falls back to the configured value when the URL
  // has none. Read live so it's never stale/persisted.
  const isFormEvent = name === 'form_submit' || name === 'Form Submit';
  if (isFormEvent) {
    const { utmCampaign } = getUtmValues();
    if (utmCampaign) analytics.eVar15 = utmCampaign;
  }

  // Pass through reserved Adobe Analytics variables set directly by the caller.
  if (data.products) analytics.products = String(data.products);

  try {
    window.alloy('sendEvent', { data: { __adobe: { analytics } } });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[analytics] trackEvent failed', err);
  }
}

/**
 * Expose analytics helpers on window so Adobe Target custom code can
 * trigger EDS analytics events without importing this ES module.
 */
function exposeAnalyticsGlobals() {
  if (typeof window === 'undefined') return;

  window.edsAnalytics = window.edsAnalytics || {};
  window.edsAnalytics.trackEvent = (eventName, eventData = {}) => {
    trackEvent(eventName, eventData);
  };
}

// Register globals at module-load time so Target custom code can call
// window.edsAnalytics.trackEvent(...) as soon as this file is loaded.
exposeAnalyticsGlobals();

/**
 * Fires Mini_cart_checkout (event97) when the user clicks the minicart
 * checkout button. Builds the Adobe Analytics products string from
 * digitalData.productDetails.item if present.
 */
export function trackMiniCartCheckout() {
  const items = getDigitalData().productDetails?.item;
  let products;
  if (Array.isArray(items) && items.length) {
    products = items.map((p) => [
      '',
      p.productSKU       || '',
      p.productQuantity  || '',
      p.productPrice     || '',
      '',
      `eVar106=${p.productQuantity || ''};eVar107=${p.productPrice || ''}`,
    ].join(';')).join(',');
  }
  trackEvent('Mini_cart_checkout', products ? { products } : {});
  pushAdobeSingleEvent('Mini_cart_checkout');
}

/**
 * Tracks CTA link text interaction.
 * @param {string} btnTitle The CTA label
 * @param {string} ctaLink The CTA URL
 */
export function triggerCtaLinkText(btnTitle, ctaLink, parentTitle = '') {
  trackEvent('cta_link_text', {
    cta_: btnTitle,
    parentTitle,
    param1: normalizeTrackedUrl(ctaLink),
  });
  pushAdobeCtaClickEvent ({
    cta: btnTitle,
    parentTitle,
    destinationUrl: normalizeTrackedUrl(ctaLink),
    event: 'cta_link_text',
  })
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
    resultCount : totalResults,
  });
}

/**
 * Fires the Navigation event (event300) when the user clicks a
 * carousel's previous or next arrow. Per EDS data layer spec
 * (Home Page row 9, Painting Contractors row 3).
 *
 * @param {string} direction 'Previous' or 'Next'
 * @param {string} testTitle The carousel/section title
 */
export function trackCarouselNavigation(direction, testTitle) {
  trackEvent('Navigation', {
    direction,
    testTitle,
    parentTitle: testTitle, // accept either key
  });

  pushAdobeCtaClickEvent({
    selectedValue: direction,
    title: testTitle,
    parentTitle: testTitle,
    event: 'Navigation',
  });

}

/**
 * Attaches Previous/Next click handlers to a Slick-initialised carousel
 * (or any DOM element containing .slick-prev / .slick-next buttons) so
 * navigation interactions fire the Navigation event.
 *
 * Idempotent — safe to call multiple times on the same carousel. Uses
 * a data attribute guard to avoid double-binding.
 *
 * @param {HTMLElement|Element|JQuery} rootEl   Carousel container element
 * @param {string} title  Section title (used as testTitle on the event)
 */
export function bindCarouselNavigationTracking(rootEl, title) {
  if (!rootEl) return;
  const root = rootEl.jquery ? rootEl[0] : rootEl;
  if (!root || root.dataset.navTrackingBound === 'true') return;
  root.dataset.navTrackingBound = 'true';

  root.addEventListener('click', (e) => {
    const prev = e.target.closest('.slick-prev, [aria-label="Previous"], [aria-label^="Previous"], .swiper-button-prev, .carousel-prev, .testimonial-prev');
    const next = e.target.closest('.slick-next, [aria-label="Next"], [aria-label^="Next"], .swiper-button-next, .carousel-next, .testimonial-next');
    if (prev) trackCarouselNavigation('Previous', title);
    else if (next) trackCarouselNavigation('Next', title);
  });
}

/**
 * Fires form_error (event10) when client-side validation rejects a
 * submit attempt. Per EDS data layer spec (Home Page row 8 +
 * Painting Contractors row 8). The `formError` field carries the
 * pipe-joined names of the fields that failed validation.
 *
 * @param {Object} opts
 * @param {string} opts.campaignId
 * @param {string} opts.formName
 * @param {string|string[]} opts.formError  Either pre-joined string or array of field names
 */
export function trackFormError({ campaignId, formName, formError } = {}) {
  const errorString = Array.isArray(formError) ? formError.join('|') : (formError || '');
  if (!errorString) return; // nothing to report
  trackEvent('form_error', {
    campaignId: campaignId || '',
    formName:   formName   || '',
    formError:  errorString,
  });
  pushAdobeFormEvents({
    event: 'form_error',
    formName: formName || '',
    campaignId: campaignId || '',
    formError: errorString,
  });
}

/**
 * Fires subsection_one_click (event113) when the user clicks an L1
 * column heading inside the mega-menu dropdown. Per EDS data layer
 * spec (Header row 4).
 *
 * @param {string} siteSection  The L0 nav header (e.g., "Colours")
 * @param {string} subSection   The L1 column title (e.g., "Colour by family")
 */
export function trackSubsectionOneClick(siteSection, subSection) {
  trackEvent('subsection_one_click', {
    siteSection: siteSection || '',
    subSection:  subSection  || '',
  });
  pushAdobeCtaClickEvent({
    event: 'subsection_one_click',
    title: siteSection || '',
    subSection: subSection || ''
  });
}

// ============================================================
// LEGACY digitalData context — preserved for blocks that still read it
// ============================================================

function toUrl(urlLike) {
  try {
    return new URL(urlLike, window.location.origin);
  } catch (e) {
    return new URL(window.location.href);
  }
}

function normalizeTrackedUrl(urlLike) {
  const value = typeof urlLike === 'string' ? urlLike.trim() : '';
  if (!value) return '';

  // Keep non-http link targets as authored.
  if (/^(?:javascript:|tel:|mailto:|#)/i.test(value)) return value;

  return toUrl(value).href;
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

// Read MCMID directly from the AMCV cookie (was: _satellite.getVisitorId()…
// which is no longer available after the Launch removal).
function getMcidFromCookie() {
  const m = document.cookie.match(/MCMID(?:%7C|\|)(\d+)/);
  return m ? m[1] : '';
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
  digitalData.utmValues = { source, medium, campaign, cid };
  digitalData.product = {
    productName: '',
    productCode: '',
    productPrice: '',
    productQuantity: 1,
    relatedProduct: '',
  };
  digitalData.skuCodeList = { skuCodes: '' };
  digitalData.device = { deviceType: navigator.userAgent };
  digitalData.user = {
    loginStatus: digitalData.user?.loginStatus || getLoginStatus(),
    mcid: digitalData.user?.mcid || getMcidFromCookie(),
    gaID: digitalData.user?.gaID || getGAID(),
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
  const normalizedLink = normalizeTrackedUrl(ctaLink);
  setDigitalDataContext(normalizedLink || ctaLink);

  if (ctaLink.indexOf('javascript:void') > -1) {
    trackEvent('custom_cta_click', { cta_: btnTitle });
    pushAdobeCtaClickEvent({
      cta: btnTitle,
      event: 'custom_cta_click',
    });
  } else if (ctaLink.indexOf('tel:') > -1) {
    trackEvent('SPSContactClick', { cta_: 'Contact Us Component' });
    pushAdobeCtaClickEvent({
      cta: 'Contact Us Component',
      event: 'SPSContactClick',
    });
  } else {
    trackEvent('custom_cta_click', {
      cta_: btnTitle,
      // redirectionLink (eVar86) must be a fully-qualified absolute URL.
      redirectionLink: normalizedLink,
      parentTitle: parentTitle,
      event: 'custom_cta_click',
    });
    pushAdobeCtaClickEvent({
      cta: btnTitle,
      parentTitle,
      destinationUrl: normalizedLink,
      event: 'custom_cta_click',
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
  if (titleInBlock?.textContent?.trim()) return titleInBlock.textContent.trim();

  const sectionHeading = section?.querySelector(':scope > .section-metadata + div h1, :scope > .section-metadata + div h2, :scope > .section-metadata + div h3, :scope > .section-metadata + div h4, :scope > .section-metadata + div h5, :scope > .section-metadata + div h6, h1, h2, h3, h4, h5, h6');
  if (sectionHeading?.textContent?.trim()) return sectionHeading.textContent.trim();

  const nearestText = scopedContainer.querySelector('h1, h2, h3, h4, h5, h6, p');
  return nearestText?.textContent?.trim() || '';
}

export function trackPdfDownload(target) {
  const pdfName = (target?.textContent || '').trim();
  trackEvent('download_form_pdf', { pdfName });
  pushAdobeCtaClickEvent({
    cta: pdfName,
    destinationUrl: pdfName,
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

/**
 * Watches Sprinklr's chat widget for open/close and tracks it, derived
 * from a small state machine rather than a single element's attribute:
 *
 * - The chat panel itself (including its in-panel "Close chat" (X)
 *   button) renders inside a same-origin <iframe> Sprinklr injects into
 *   the page. Clicks inside that iframe never bubble to this document's
 *   click listeners, so a click-based approach can never see the
 *   in-panel close control users actually use most — only a DOM
 *   observer catches it.
 * - #spr-chat__trigger-button (outside that iframe) is the reliable
 *   signal: its aria-label flips "Open chat "/"Close chat" describing
 *   the action a click on it would take next — but (verified live)
 *   Sprinklr removes that button from the DOM entirely while the panel
 *   is open, re-creating it (always labelled "Open chat") the moment the
 *   user closes for the first time. So "no button" and "label" both
 *   have to be read together as one open/closed state, not diffed as a
 *   single attribute in isolation.
 * - Sprinklr's own bootstrap (widget script load → auto-open) briefly
 *   flashes the button in/out before settling into the real open state;
 *   a short grace window after the placeholder-triggered auto-open
 *   swallows that startup noise instead of reporting a phantom
 *   close+reopen pair.
 */
let sprinklrChatState = null; // null (unknown) | 'open' | 'closed'
let sprinklrBootstrapGraceUntil = 0;

function deriveSprinklrChatState() {
  const btn = document.querySelector('#spr-chat__trigger-button');
  if (!btn) return sprinklrChatState === null ? null : 'open';
  const label = (btn.getAttribute('aria-label') || '').trim();
  if (label === 'Close chat') return 'open';
  if (label === 'Open chat') return 'closed';
  return sprinklrChatState;
}

function watchSprinklrTriggerButton() {
  const check = () => {
    const newState = deriveSprinklrChatState();
    if (newState === null || newState === sprinklrChatState) return;

    const isFirstObservation = sprinklrChatState === null;
    const isBootstrapNoise = Date.now() < sprinklrBootstrapGraceUntil;
    sprinklrChatState = newState;
    if (isFirstObservation || isBootstrapNoise) return;

    trackEvent('chatbot_interaction', {
      chatAction: newState === 'open' ? 'Chat Open' : 'Chat Close',
      chatType: 'Sprinklr Chatbot',
    });
  };

  new MutationObserver(check).observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-label'],
  });
  check();
}

/**
 * Tracks chat widget open/close: a click on the static Salesforce
 * placeholder icon (.helpButton, see initChatPlaceholder() in
 * scripts.js) opens chat directly and is tracked here via delegation
 * (it's inserted into the DOM well after this module loads); the
 * Sprinklr widget's own open/close afterwards is tracked separately by
 * watchSprinklrTriggerButton() since it can't rely on click bubbling.
 */
export function bindChatbotInteractionTracking() {
  if (document.documentElement.dataset.chatbotAnalyticsBound === 'true') return;
  document.documentElement.dataset.chatbotAnalyticsBound = 'true';

  document.addEventListener('click', (event) => {
    const salesforceChat = event.target.closest('.helpButton')
      || event.target.closest('[aria-label="chat Bot"]');
    if (!salesforceChat) return;

    sprinklrChatState = 'open';
    sprinklrBootstrapGraceUntil = Date.now() + 5000;
    trackEvent('chatbot_interaction', { chatAction: 'Chat Open', chatType: 'Normal Chatbot' });
  });

  watchSprinklrTriggerButton();
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

function getClientID() {
    const gaCookie = document.cookie.split('; ').find(row => row.startsWith('_ga='))
  if(!gaCookie) return;
  const gaValue =gaCookie.split("=")[1];
  const parts = gaValue.split('.');
return parts.length > 2 ? parts[2] + '.' + parts[3] : null;
}

export function ga4Implementaion({
  event = '',
  ...extraFields
}={}) {
  if (SUPPRESS_ANALYTICS_FOR_THIS_PAGE) return;

  if(!event) return ;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event,
    userID:getClientID(),
    user_status:getLoginStatus() === 'logged in' ? 'Yes' : 'No',
    ...extraFields
  })

}


//WEBSDK- 2.0
//WEBSDK ACDL

window.adobeDataLayer = window.adobeDataLayer || [];

function apDataLayer() {
    return {
        "event": "",
        "eventInfo": {
            "category": "",
            "cta": "",
            "destinationUrl": "",
            "detail": "",
            "detail2": "",
            "errorCode": "",
            "errorMessage": "",
            "filter": "",
            "flowType": "",
            "location": "",
            "output": "",
            "parentTitle": "",
            "rating": "",
            "resultCount": "",
            "searchTerm": "",
            "selectedValue": "",
            "shadeCode": "",
            "shadeName": "",
            "shareType": "",
            "status": "",
            "stepDetails1": "",
            "stepDetails2": "",
            "stepDetails3": "",
            "stepDetails4": "",
            "subFlow": "",
            "title": "",
            "subSection": "",
            "subSectionOne":"",
            "subSectionTwo" : "",
            "target": "",
            "toolType":"",
            "pdfName": ""
        },
        "login": {
            "loginFunction": "",
            "loginMethod": "",
            "loginStatus": "",
            "loginType": "",
            "registrationSource": "",
            "userId": "",
            "userType": ""
        },
        "form": {
            "address1": "",
            "address2": "",
            "construction": "",
            "dataDestination": "",
            "defect": "",
            "formCampaignId": "",
            "formError": "",
            "formName": "",
            "gstNo": "",
            "landmark": "",
            "language": "",
            "localPainter": "",
            "pincode": "",
            "selectedDate": "",
            "selectedServices": "",
            "selectedTime": "",
            "shopAddress": "",
            "userType": "",
            "whatsappOptIn": ""
        },
        "product": {
            "productInfo": [
                {
                    "category": "",
                    "price": "",
                    "productCoat": "",
                    "productCode": "",
                    "productName": "",
                    "productSku": "",
                    "quantity": "",
                    "subProduct": ""
                }
            ],
            "Product": "",
            "date": "",
            "mcvid": "",
            "productList": "",
            "productUrl": "",
            "productdetails": "",
            "promoCode": "",
            "time": "",
            "topProducts": "",
            "totalPrice": "",
            "transactionId": ""
        },
        "page": {
            "pageName": "",
            "pageURL": "",
            "referringUrl": "",
            "pageType": "",
            "section1": "",
            "section2": "",
            "section3": "",
            "section4": "",
            "timestamp": "",
            "checkPincodeDelivery": ""
        },
        "user": {
            "loginStatus": "",
            "loginId": "",
            "loginFunction": "",
            "mcid": "",
            "gaID": "",
            "ipAddress": ""
        },
        "device": {
            "deviceType": "",
            "channel": ""
        },
        "utmValues": {
            "source": "",
            "medium": "",
            "campaign": "",
            "cid": "",
            "icid": ""
        }
    };
}

// Export and expose apDataLayer globally for third-party scripts
export { apDataLayer };
window.apDataLayer = apDataLayer;

// Expose getAdobeBasePayload globally for third-party scripts
window.getAdobeBasePayload = getAdobeBasePayload;

function getUtmValuesAdobe(destinationUrl = window.location.href) {

  const currentUrl = toUrl(window.location.href);
  const targetUrl = toUrl(destinationUrl);
  const digitalData = getDigitalData();
  
  const source = getParam(currentUrl, 'utm_source') || getParam(currentUrl, 'source') || getParam(targetUrl, 'utm_source') || getParam(targetUrl, 'source');
  const medium = getParam(currentUrl, 'utm_medium') || getParam(currentUrl, 'medium') || getParam(targetUrl, 'utm_medium') || getParam(targetUrl, 'medium');
  const campaign =  getParam(currentUrl, 'utm_campaign') || getParam(currentUrl, 'campaign') || getParam(targetUrl, 'utm_campaign') || getParam(targetUrl, 'campaign');
  const cid = getParam(currentUrl, 'cid') || getParam(targetUrl, 'cid');
  const pageSection = buildPageData(targetUrl);

  return {
    source,
    medium,
    campaign,
    cid , 
    pageSection
  };
}

export function getAdobeBasePayload() {
  // const utmValues = {source, medium, campaign, cid }
  const adobePayload = apDataLayer();
  const utmValues = getUtmValuesAdobe(window.location.href);
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
     adobePayload.utmValues = {
        "source": utmValues.source || "",
        "medium": utmValues.medium || "",
        "campaign": utmValues.campaign || "",
        "cid": utmValues.cid || "",
    };
     adobePayload.user = {
        "loginStatus": getLoginStatus() || "",
        "loginId": "",
        "mcid":  getMcidFromCookie() || "",
        "gaID":  getGAID() || "",
        "ipAddress":   ""
    };
        adobePayload.device = {
        "deviceType": isMobile ? "Mobile" : "Desktop",
        "channel": "Web"
    };

       adobePayload.page = {
        "pageName": utmValues.pageSection.pageName || "",
        "pageURL": utmValues.pageSection.destinationURL || "" ,
        "referringUrl": document.referrer || "", 
        "pageType": "" ,
        "section1": utmValues.pageSection.section1 || "" ,
        "section2": utmValues.pageSection.section2 || "" ,
        "section3":  utmValues.pageSection.section3 || "" ,
        "section4": utmValues.pageSection.section4 || "" ,
        "timestamp": new Date().toISOString(),
    };

    return adobePayload;
}



export function pushAdobeCtaClickEvent(config) {
  var eventConfig = config || {};
  var dl = getAdobeBasePayload ? getAdobeBasePayload() : apDataLayer();
  dl.event = eventConfig.event || "";
  if (eventConfig.cta !== undefined) {
    dl.eventInfo.cta = eventConfig.cta || "";
  }
  if (eventConfig.parentTitle !== undefined) {
    dl.eventInfo.parentTitle = eventConfig.parentTitle || "";
  }

  if (eventConfig.destinationUrl !== undefined) {
    dl.eventInfo.destinationUrl = eventConfig.destinationUrl || "";
  }

  if (eventConfig.title !== undefined) {
    dl.eventInfo.title = eventConfig.title || "";
  }

  if (eventConfig.selectedValue !== undefined) {
    dl.eventInfo.selectedValue = eventConfig.selectedValue || "";
  }
    if (eventConfig.resultCount !== undefined) {
    dl.eventInfo.resultCount = eventConfig.resultCount || "";
  }

  if (eventConfig.searchTerm !== undefined) {
    dl.eventInfo.searchTerm = eventConfig.searchTerm || "";
  }

        if (eventConfig.detail !== undefined) {
        dl.eventInfo.detail = eventConfig.detail || "";
    }

         if (eventConfig.detail2 !== undefined) {
        dl.eventInfo.detail2 = eventConfig.detail2 || "";
    }

    if (eventConfig.subSection !== undefined) {
        dl.eventInfo.subSection = eventConfig.subSection || "";
    }
    if (eventConfig.subSectionOne !== undefined ) {
      dl.eventInfo.subSectionOne = eventConfig.subSectionOne || "";
    }
    if (eventConfig.subSectionTwo !== undefined) {
        dl.eventInfo.subSectionTwo = eventConfig.subSectionTwo || "";
    }

  window.adobeDataLayer = window.adobeDataLayer || [];
  window.adobeDataLayer.push(dl);

}

//Login & Registratio related Event Push to Adobe Data Layer
export function pushAdobeAuthEvent (config) {
    var eventConfig = config || {};
    var dl = getAdobeBasePayload ? getAdobeBasePayload() : apDataLayer();

    dl.event = eventConfig.event || "";
    if (eventConfig.loginFunction !== undefined) {
        dl.login.loginFunction = eventConfig.loginFunction || "";
    }

    if (eventConfig.loginMethod !== undefined) {
        dl.login.loginMethod = eventConfig.loginMethod || "mobile_otp";
    }

    dl.login.loginStatus = getLoginStatus() || "";

    if (eventConfig.loginType !== undefined) {
        dl.login.loginType = eventConfig.loginType || "";
    }

    if (eventConfig.registrationSource !== undefined) {
        dl.login.registrationSource = eventConfig.registrationSource || "";
    }
    if (eventConfig.userId !== undefined) {
        dl.login.userId = eventConfig.userId || "";
    }
    if (eventConfig.errorCode !== undefined) {
        dl.eventInfo.errorCode = eventConfig.errorCode;
    }
    if (eventConfig.errorMessage !== undefined) {
        dl.eventInfo.errorMessage = eventConfig.errorMessage;
    }

    if (eventConfig.userType !== undefined) {
        dl.eventInfo.userType = eventConfig.userType;
    }



    window.adobeDataLayer = window.adobeDataLayer || [];
    window.adobeDataLayer.push(dl);
};


export function pushAdobeProductTitleClick(config) {
  var eventConfig = config || {};
  var dl = getAdobeBasePayload ? getAdobeBasePayload() : apDataLayer();
  dl.event = eventConfig.event || "";
  if (eventConfig.productName !== undefined) {
    dl.product.productInfo[0].productName = eventConfig.productName || "";
  }

    if (eventConfig.productSku !== undefined) {
    dl.product.productInfo[0].productSku = eventConfig.productSku || "";
  }

  if (eventConfig.detail !== undefined) {
    dl.eventInfo.detail = eventConfig.detail || "";
  }

  if (eventConfig.title !== undefined) {
    dl.eventInfo.title = eventConfig.title || "";
  }

    if (eventConfig.destinationUrl !== undefined) {
    dl.eventInfo.destinationUrl = eventConfig.destinationUrl || "";
  }
  window.adobeDataLayer = window.adobeDataLayer || [];
  window.adobeDataLayer.push(dl)

}

export function pushAdobeSingleEvent(eventName) {
    var dl = getAdobeBasePayload ? getAdobeBasePayload() : apDataLayer();
    dl.event = eventName || "";
    window.adobeDataLayer = window.adobeDataLayer || [];
    window.adobeDataLayer.push(dl);
}


//Form related Event Push to Adobe Data Layer
export function pushAdobeFormEvents(config) {
    var formConfig = config || {};
    var dl = getAdobeBasePayload ? getAdobeBasePayload() : apDataLayer();
    dl.event = formConfig.event || "";
    if(formConfig.formName !== undefined) {
        dl.form.formName= formConfig.formName || "";
    }
    if(formConfig.formPincode !== undefined) {
    dl.form.formPincode = formConfig.formPincode || "";
    }

    if(formConfig.whatsappOptIn !== undefined) {
    dl.form.whatsappOptIn = formConfig.whatsappOptIn || "";
    }

    if (formConfig.language !== undefined) {
        dl.form.language = formConfig.language || "";
    }
    if (formConfig.localPainter !== undefined) {
        dl.form.localPainter = formConfig.localPainter || "";
    }
    if (formConfig.construction !== undefined) {
        dl.form.construction = formConfig.construction || "";
    }
    if (formConfig.formCampaignId !== undefined) {
        dl.form.formCampaignId = formConfig.formCampaignId || "";
    }
    if (formConfig.dataDestination !== undefined) {
        dl.form.dataDestination = formConfig.dataDestination || "";
    }
    if (formConfig.gstNo !== undefined) {
        dl.form.gstNo = formConfig.gstNo || "";
    }
    if (formConfig.shopAddress !== undefined) {
        dl.form.shopAddress = formConfig.shopAddress || "";
    }
    if (formConfig.userType !== undefined) {
        dl.form.userType = formConfig.userType || "";
    }
    if (formConfig.filterValue !== undefined) {
        dl.eventInfo.filter = formConfig.filterValue || "";
    }
    if (formConfig.flowType !== undefined) {
        dl.eventInfo.flowType = formConfig.flowType || "";
    }
    if(formConfig.formError !== undefined) {
        dl.form.formError = formConfig.formError || "";
    }

    window.adobeDataLayer = window.adobeDataLayer || [];
    window.adobeDataLayer.push(dl);
};


// PAGELOAD (global context, once per page)
(function pushAdobePageLoad() {

    var pushPageLoad = function() {
        const pageLoadEvent = getAdobeBasePayload();
        pageLoadEvent.event = "pageLoad";
        window.adobeDataLayer = window.adobeDataLayer || [];
        window.adobeDataLayer.push(pageLoadEvent);
    };

    pushPageLoad();
}())

// WEBSDK ACDL -> CTAClickWithLinkANdTitle


