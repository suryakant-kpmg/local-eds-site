# Header Integration and Functionalities

This document describes the migrated header in this EDS repo, with implementation-level detail for integrations, runtime behavior, and parity notes against `https://www.asianpaints.com/`.

Primary implementation files:
- `blocks/header/header.js`
- `blocks/header/header.css`

## 1) Scope and Objectives

### Scope

This header implementation covers:
- 3-tier header rendering from `nav.plain.html`
- Search overlay with Unbxd autosuggest/search
- Location-aware contractor/dealer handling
- Mini-cart badge and cart modal refresh
- Keycloak auth-aware profile behavior
- Visual search upload flow
- Desktop/mobile navigation interaction parity

### Objectives

- Match high-value interaction patterns from original site header integrations.
- Keep behavior stable across:
  - Production-style domains (`*.asianpaints.com`)
  - Migration/dev environments (`localhost`, `aem.page`, `aem.live`)
- Fail safely: no hard crashes when APIs fail or are blocked.

### Icons (EDS pattern)

Search dialog icons follow the [AEM Icons](https://www.aem.live/developer/block-collection/icons) pattern where possible:
- **Quick links** (Beautiful Homes, Interior Design, etc.): Use `span.icon.icon-<name>` with icons in `/icons/` (e.g. `ql-bh-painting.svg`). `decorateIcons()` loads SVG via `icons/<name>.svg`.
- **Block-specific UI icons** (search magnifier, camera, trending arrow, close): Kept as inline SVG in JS/CSS. Per AEM docs, icons that are intrinsic to block behavior may remain in code.

### Non-goals (current implementation)

- Reproducing all analytics beacons from legacy jQuery/Vue stack.
- Reproducing all legacy background prefetch noise (for example, preload color searches).
- Re-implementing old DOM/class structure 1:1; behavior parity is prioritized.

## 2) Runtime Architecture

## 2.1 Origin-aware URL strategy

The header uses domain-aware URL resolution:

- On `*.asianpaints.com`
  - API and page URLs resolve to relative paths.
  - Browser stays first-party; existing session cookies work naturally.
- On non-Asian Paints domains (for example `http://localhost:3000`)
  - URLs resolve to `AP_PRODUCTION_ORIGIN`.
  - Current configured fallback origin in code: `https://beta.asianpaints.com/`.
  - Useful for migration testing, with known browser CORS constraints for credentialed calls.

Implemented via:
- `apUrl(path)`
- `isOnAsianPaintsDomain()`
- `fetchFromAp(pathOrUrl, options)`
- `AP_API` constant map

## 2.2 API endpoints used

`AP_API` includes:

- `DETECT_LOCATION`: `/apcolourcatalogue/detect-location`
- `CONTRACTOR_PROFILE`: `/apcolourcatalogue/contractorprofile.json`
- `MINI_CART`: `/apcolourcatalogue/commerce/miniCart.json`
- `SEARCH_RESULTS`: `/content/ap/en/home/searchresult.html`
- `DEALER_PAGE`: `/content/ap/en/home/store-locator.html`
- `CONTRACTOR_PAGE`: `/content/ap/en/home/contractor-listing-page.html`
- `PROFILE_PAGE`: `/content/ap/en/home/my-profile.html`
- `WISHLIST_PAGE`: `/content/ap/en/home/my-wishlist.html`
- `SHOP_URL`: `/paint-products.html`
- `VISUAL_SEARCH_UPLOAD`: `/apcolourcatalogue/visualSearch`
- Unbxd:
  - `UNBXD_BASE`
  - `UNBXD_API_KEY`
  - `UNBXD_SITE_KEY`
- Keycloak:
  - `KEYCLOAK_URL`
  - `KEYCLOAK_REALM`
  - `KEYCLOAK_CLIENT`
  - `KEYCLOAK_JS`
  - `KEYCLOAK_PAGE_URL`

## 2.3 Header render lifecycle

At block decorate time:

1. Read `nav` metadata (fallback `/nav`).
2. Fetch `nav.plain.html`.
3. Parse top-level rows and build:
   - Brand bar
   - Main header
   - Navigation bar
4. Append support overlays/modals:
   - Cart modal
   - Visual search modal
   - Search dialog overlay
5. Bind interactions.
6. Start non-blocking integrations (`initIntegrations`):
   - Prime location context
   - Fetch mini-cart count
   - Initialize Keycloak (depending on domain/flag)

## 3) Search Integration (Detailed)

## 3.1 Search surfaces

- Desktop: clicking `.header-search` opens overlay dialog.
- Mobile: clicking `.mobile-search-btn` opens same overlay dialog.

Dialog sections:
- Trending Queries
- Suggestions
- Quick links
- Best Results
- Location-aware result panel (contractor/dealer)

## 3.2 Debounce model

Current constants:

- `SEARCH_DEBOUNCE_MS = 80`
- `SEARCH_RESULTS_DEBOUNCE_MS = 400`
- `LOCATION_DETECTION_DEBOUNCE_MS = 1500`

Input pipeline on each keystroke:

1. Fast debounce (`80ms`)
   - `handleSearchDialogQuery(rawQuery)`
   - Updates autosuggest/trending and “See all” URL
2. Mid debounce (`400ms`)
   - `handleSearchDialogSearchResults(rawQuery)`
   - Fetches and paints search product results
3. Slow debounce (`1500ms`)
   - `handleLocationAwareSearch(rawQuery)`
   - Detects location + contractor/dealer context panel

Why split this way:
- Keeps autosuggest responsive and close to legacy cadence.
- Prevents high-frequency full search calls on every keystroke.
- Matches original “location-intent after pause” behavior.

## 3.3 Unbxd request behavior

Autosuggest request:
- Endpoint: `.../autosuggest`
- Key params:
  - `q`
  - `version=V2`
  - `uid=<stable local uid>`
  - `inFields.count`
  - `topQueries.count`
  - `keywordSuggestions.count=0`
  - `promotedSuggestion.count=0`
  - `popularProducts.count`
  - `popularProducts.fields`
  - `sourceFields` and `sourceField.*.count` (enabled when configured)
  - `indent=off`
  - `fallback=true`

Search request:
- Endpoint: `.../search`
- Key params:
  - `q`
  - `fields`
  - `rows=6`
  - `facet=off`
  - `analytics=false`
  - `redirect=false`
  - `version=V2`

UID behavior:
- `getUnbxdUid()` persists generated uid in `localStorage` under `unbxd-uid`.

## 3.4 Search result rendering rules

- Initial/open state:
  - Query empty => autosuggest `*` request to populate trending + popular cards.
- Short query:
  - `< 3` chars does not trigger full query autosuggest/search replacement flow.
- Product cards:
  - Built from autosuggest/search product payloads.
- Trending tags:
  - Clicking a tag writes into input and re-triggers input pipeline.
- See-all link:
  - Dynamic: `searchresult.html?q=<trimmed-query>`
  - Empty query falls back to bare search results page.

## 3.5 Submit and URL parity

Enter behavior:
- Enter captures current input value.
- Dialog closes.
- Redirects via `navigateToSearchResults`.

Result URL format:
- `https://www.asianpaints.com/searchresult.html?q=<query>`

This matches original query-parameter shape (`q`, not `query`).

## 3.6 Legacy parity note

Original site often emits extra search calls when opening search (legacy pre-warm/trending patterns). Current implementation intentionally does not replicate all of that noise.

## 4) Location-aware Contractor/Dealer Flow

## 4.1 Intent entity detection

`findNlpEntity(query)` maps query text to one of:
- `contractor`
- `dealer`
- empty (no entity)

Keyword sets:
- Contractor: `contractors`, `contractor`, `painters`, `painter`, `worker`, `service`, `expert`
- Dealer: `dealers`, `dealer`, `store`, `stores`, `shop`, `paint shop`, `brand`

## 4.2 Location detection

Primary call:
- `GET /apcolourcatalogue/detect-location?text=<query>`

Expected response shape:
- `{ locations: [...] }`
- Accepts string entries and object entries with `location` field.

## 4.3 Localhost fallback extraction

If detect-location yields no location and domain is not `*.asianpaints.com`, fallback parser runs:
- `extractLocationFromQuery(query)`
- Pattern: `\b(?:in|near|at)\s+([^,]+)$`

Example:
- `contractors in mumbai` -> `mumbai`

Purpose:
- Keep migration/testing flow usable when cross-origin response cannot be read due CORS.
- Does not alter production-domain path.

## 4.4 Contractor API path

When entity is `contractor` and location is available:

- Determine mode using pin code regex:
  - `containsIndianPincode(location)`
  - regex: `\b[1-9][0-9]{5}\b`
- Call:
  - `/apcolourcatalogue/contractorprofile.json?area=<location>&_=<ts>`
  - or `/apcolourcatalogue/contractorprofile.json?pinCode=<pincode>&_=<ts>`

Dialog rendering:
- Title: `Contractors near <location>`
- Up to 4 cards rendered
- Card link:
  - `/content/ap/en/home/contractor-locator.<contractorId>.html`
- Explore link:
  - `/content/ap/en/home/contractor-listing-page.html?cpListing=<area|pinCode>:<location>`

## 4.5 Dealer API/redirect path

When entity is `dealer` and location is available:
- Dealer panel shown with title `Dealers near <location>`.
- Explore link:
  - `/content/ap/en/home/store-locator.html?q=<location>`

Current implementation keeps dealer behavior redirect-oriented in overlay context.

## 4.6 Location panel states

`setLocationResultState` drives deterministic panel behavior:
- Hidden state
- Active state with title
- Empty text state
- Explore link state
- List reset between requests

## 5) MiniCart Integration (Detailed)

## 5.1 Badge count flow

- On init: `fetchMiniCartCount()` calls mini-cart API.
- On success:
  - Uses `totalItems` or fallback count fields.
- On failure/error:
  - Returns `0`.
- Badge rendering:
  - Shown only if count > 0.

## 5.2 Cart modal flow

On cart icon click:
1. `refreshCartModal(block)` executes.
2. Modal fetches fresh mini-cart payload.
3. If empty/failure/non-2xx:
   - Reset to empty state
   - CTA: `Shop now` -> `SHOP_URL`
4. If entries exist:
   - Title updates with item count
   - Item rows rendered (`name`, `qty`)
   - CTA behavior:
     - If cart URL available (`cartUrl|redirectUrl|cartPageUrl|url`):
       - `View cart`
     - Else:
       - `Shop now`

This prevents stale CTA state and matches expected fallback behavior.

## 6) Keycloak Authentication Integration (Detailed)

## 6.1 Initialization policy

`shouldInitKeycloak()`:
- True on `*.asianpaints.com`.
- False on other domains unless URL has `?keycloak=force`.

## 6.2 Init behavior

- Loads Keycloak script dynamically.
- Initializes client with `check-sso`.
- Uses silent SSO redirect:
  - AP domain: AP keycloak page URL
  - non-AP domain: local equivalent path

## 6.3 Profile behavior

- Authenticated:
  - Profile button gets logged-in state
  - Greeting bubble shown (`Hello <name>`) then auto-hides
  - Click opens profile page
- Not authenticated:
  - Click triggers `keycloak.login({ redirectUri: currentUrl })` when possible
  - Safe fallback to profile page if instance unavailable

## 7) Visual Search Integration (Detailed)

## 7.1 Entry points

Visual search modal can open from:
- Header camera button
- Search dialog camera button

## 7.2 File validation

Allowed MIME types:
- `image/png`
- `image/jpeg`
- `image/jpg`
- `image/tiff`

Max size:
- `5MB`

Validation errors surface inline before upload call.

## 7.3 Upload flow

- On `*.asianpaints.com`: `POST /apcolourcatalogue/visualSearch`
- On non-Asian Paints domains (for example `http://localhost:3000`): `POST https://beta.asianpaints.com/apcolourcatalogue/visualSearch`
- Body: `application/x-www-form-urlencoded`
  - `imageDetails` (base64 data URL, URI-encoded)
  - `referer`
  - `pageUrl`
  - `uid`
  - `visit`
  - `visitId`
- `credentials: include`

Response handling:
- If `redirectUrl` present: browser navigates there.
- Else if `totalCount` present: browser navigates to search results with `variantType=visualsearch`.
- Else success message shown.
- Any failed response/network error shows user-facing failure message.

## 7.4 Drag/drop behavior

- Drag-over visual state handled.
- Multiple files are blocked with explicit message.
- Single dropped file follows same validation/upload path as file picker.

## 8) Navigation, Megamenu, and Responsive Interactions

## 8.1 Desktop behavior

- Hover-based megamenu activation for nav items with children.
- Delayed close on mouseleave.
- Outside click closes active menus.

## 8.2 Mobile behavior

- Hamburger toggles nav open/close state and body lock classes.
- Dropdown items open panel-style views.
- Auto-inserted back button per mobile submenu panel.
- Resize listener resets mobile/desktop state transitions cleanly.

## 8.3 Search on mobile

- Mobile uses same search overlay experience as desktop for parity.

## 9) Resilience and Error Handling

Design principles applied:
- All external calls wrapped with try/catch.
- Safe defaults when APIs fail:
  - empty arrays
  - count zero
  - hidden panels
  - reset cart state
- UI state reset is explicit before re-render to prevent stale mixed content.

## 10) Parity with Original Header

## 10.1 Areas with strong parity

- Search submit URL format (`?q=`)
- Typeahead autosuggest cadence and params
- Delayed location detection behavior
- Contractor path switch (`area` vs `pinCode`)
- Contractor listing/dealer explore redirection patterns
- Cart empty/non-empty CTA behavior

## 10.2 Known acceptable differences

- Original emits additional legacy background search warmup requests.
- Implementation is modernized (no old jQuery/Vue internals) while preserving functional outcomes.

## 10.3 Environment caveat

On `*.asianpaints.com`, API calls stay relative and first-party.

On non-Asian Paints domains, AP routes are resolved against `AP_PRODUCTION_ORIGIN` (currently `https://beta.asianpaints.com/`):
- `/apcolourcatalogue/*`
- store-locator JSON endpoint

This avoids accidental `POST` requests to local `aem up` routes such as `/apcolourcatalogue/visualSearch`.

Local/dev environments can still hit browser CORS restrictions for credentialed cross-origin calls, so some API-backed features may return empty states or upload failures unless the backend explicitly allows that origin.

## 11) Validation Playbook

## 11.1 Manual end-to-end check

1. Open migrated page: `http://localhost:3000/painting-contractors`
2. Open search overlay
3. Type: `contractors in mumbai`
4. Verify network:
   - Unbxd autosuggest requests during typing
   - detect-location after pause
   - contractorprofile call after location resolution
5. Press Enter
6. Verify final redirect:
   - `https://www.asianpaints.com/searchresult.html?q=contractors%20in%20mumbai`
7. Repeat on original page and compare behavior:
   - `https://www.asianpaints.com/`

## 11.2 Target request signals for parity

For query `contractors in mumbai`, expected key signals on both pages:
- final autosuggest includes `q=contractors in mumbai`
- final search includes `q=contractors in mumbai`
- detect-location includes `text=contractors in mumbai`
- contractor API call includes `area=mumbai` (or `pinCode` for pincode query)

## 11.3 Linting checks

Run before commit:

```sh
npx eslint blocks/header/header.js
npx stylelint blocks/header/header.css
```

## 12) Troubleshooting Guide

## 12.1 Search dialog opens but no dynamic results

Potential causes:
- Unbxd call blocked by network/CSP
- Typing below minimum threshold for search replacement

Checks:
- Verify autosuggest calls are firing in network tab
- Verify console for blocked requests

## 12.2 Location panel does not appear

Potential causes:
- Query lacks dealer/contractor intent keywords
- detect-location did not return a location
- Cross-origin response restrictions in local environment

Checks:
- Use query with explicit intent and location: `contractors in mumbai`
- Inspect detect-location response
- Confirm fallback extraction in non-AP environments

## 12.3 Contractor cards show empty state

Potential causes:
- Contractor API response blocked/unreadable due CORS in local env
- No contractors for returned location

Checks:
- Confirm contractor request is fired
- Compare behavior on `https://www.asianpaints.com`

## 12.4 Cart modal shows wrong CTA

Expected behavior:
- `View cart` only if cart URL field exists
- Otherwise `Shop now`

Checks:
- Inspect mini-cart response fields: `cartUrl|redirectUrl|cartPageUrl|url`

## 12.5 Profile click does not launch login in local

Expected behavior:
- Keycloak init is skipped locally by default
- Add `?keycloak=force` to opt-in test flow

## 13) Extension Guidelines

If extending this header, follow these rules:

- Keep network calls wrapped with safe fallbacks.
- Preserve debounced split model for search:
  - fast autosuggest
  - slower full-search
  - slowest location detection
- Do not change `?q=` search URL format unless upstream contract changes.
- Keep non-AP-domain fallbacks guarded so production behavior stays canonical.
- Prefer additive API parsing (accept variant payload shapes) over brittle strict assumptions.

## 14) Quick Function Index (for maintainers)

Search and location:
- `fetchUnbxdAutosuggest`
- `fetchUnbxdSearch`
- `handleSearchDialogQuery`
- `handleSearchDialogSearchResults`
- `findNlpEntity`
- `fetchDetectedLocations`
- `fetchContractorsByLocation`
- `handleLocationAwareSearch`
- `navigateToSearchResults`

Cart:
- `fetchMiniCartCount`
- `updateCartBadge`
- `refreshCartModal`

Auth:
- `shouldInitKeycloak`
- `initKeycloak`
- `updateProfileUI`
- `handleProfileClick`

Visual search:
- `validateVisualSearchFile`
- `uploadVisualSearchImage`

Structure and interactions:
- `buildMainHeader`
- `buildNavBar`
- `buildSearchDialog`
- `addInteractions`
- `initIntegrations`
- `decorate`
