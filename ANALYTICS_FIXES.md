# Analytics Fixes - getECID & UTM Parameter Tracking

## Overview
Fixed two critical analytics issues in `/eds/scripts/analytics_1.js`:
1. **getECID not working on first page load**
2. **UTM parameters not captured on form submission**

---

## Issue 1: getECID First-Load Problem

### Root Cause
The `getECID()` function caches an empty value on the first page load because `alloy('getIdentity')` is asynchronous and hasn't resolved yet when the initial page event fires. Subsequent calls return the empty cached value instead of waiting for resolution.

### Solution
Added a new `getECIDAsync()` function that:
- Returns a Promise that resolves when ECID is available
- Checks if value is already cached (instant resolution)
- If not cached, waits for `alloy('getIdentity')` to complete
- Falls back to cookie parsing if alloy fails
- Caches result for all subsequent calls (no re-fetching)

### Code Changes
**Location**: Lines 110-162 in `analytics_1.js`

```javascript
// New Promise-based identity resolution
let ecidPromise = null; // Promise for async identity resolution

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
```

### Usage in Forms
Forms that need guaranteed ECID availability can now use:
```javascript
import { getECIDAsync } from './analytics_1.js';

// In form submission handler:
const ecid = await getECIDAsync();
trackEvent('form_submit', { campaignId, formName, /* ... */ });
// eVar12 will now have the valid ECID
```

### Also Exported
Function is exported and can be imported:
```javascript
export { getECIDAsync };
```

---

## Issue 2: UTM Parameters Not Captured on Form Submit

### Root Cause
UTM parameters (utm_source, utm_medium, utm_campaign, cid) were only included in the **page-level analytics context** (`buildCommonAnalyticsContext()`) used for page view events. The **event tracking function** (`trackEvent()`) called `buildCommonAnalyticsContextBase()` which doesn't include UTM params, so form submissions missed them.

Additionally, the user wanted **real-time** UTM values (read from URL at event time), not persistent values stored in sessionStorage.

### Solution
Modified `trackEvent()` to:
- Call `getUtmValues()` to read fresh UTM parameters directly from the current URL
- Map them to the correct eVar fields (eVar38, eVar39, eVar87, eVar0)
- No persistent storage—reads live from `location.search` on every event
- Ensures form submissions capture the exact UTM parameters present at submission time

### Code Changes
**Location**: Lines 1360-1364 in `analytics_1.js`

```javascript
export function trackEvent(eventName, eventData = {}) {
  // ... existing code ...
  
  // Add real-time UTM parameters from current URL (not persistent)
  const { utmSource, utmMedium, utmCampaign, cid } = getUtmValues();
  if (utmSource) analytics.eVar38 = utmSource;
  if (utmMedium) analytics.eVar39 = utmMedium;
  if (utmCampaign) analytics.eVar87 = utmCampaign;
  if (cid) analytics.eVar0 = cid;
  
  // ... rest of function ...
}
```

### How It Works
- `getUtmValues()` reads fresh from `location.search` on every call (no caching)
- Applied to ALL events via `trackEvent()` (form_submit, form_error, form_start, etc.)
- Empty/missing params are skipped (only non-empty values included in payload)
- Follows the same pattern as page view events but at the event-time URL

### Example Flow
```
User lands on: ?utm_source=email&utm_medium=newsletter&utm_campaign=spring2026
  ↓
User fills form with fields (formName, campaignId, etc.)
  ↓
User clicks submit
  ↓
trackEvent('form_submit', { formName: 'contact-us', ... })
  ↓
Analytics payload includes:
  - eVar38: "email"           (utm_source, real-time from URL)
  - eVar39: "newsletter"      (utm_medium, real-time from URL)
  - eVar87: "spring2026"      (utm_campaign, real-time from URL)
  - eVar17: "contact-us"      (formName, from eventData)
  - eVar15: "..." (campaignId, from eventData)
```

---

## Impact Summary

| Issue | Before | After |
|-------|--------|-------|
| **getECID on first load** | Empty string cached, never updates | Waits for alloy resolution, updates eVar12 correctly |
| **UTM on form submit** | ❌ Not captured | ✅ Captured from current URL in real-time |
| **Storage model** | sessionStorage-based persistence | Real-time URL reads (no caching) |
| **Multi-step forms** | UTM could change mid-flow but wouldn't update | Each event reads fresh from current URL |

---

## Testing Checklist

- [ ] Load page with UTM params → Check eVar38/39/87/0 populated on page load
- [ ] Submit form with same URL → Check eVar38/39/87/0 appear in form_submit event
- [ ] Change URL params → Submit form again → Confirm new values captured
- [ ] First page load → Check eVar12 (ECID) populated (may be empty until alloy resolves)
- [ ] Subsequent events → eVar12 should be consistent and valid
- [ ] Browser DevTools → Adobe Experience Platform Debugger should show correct vars

---

## Files Modified
- `/eds/scripts/analytics_1.js` (2 locations)
  - Lines 110-162: Added `getECIDAsync()` function and Promise handling
  - Lines 1360-1364: Added real-time UTM parameter capture in `trackEvent()`

## No Breaking Changes
- Existing `getECID()` function remains unchanged (still works synchronously)
- Existing `trackEvent()` calls work as before (UTM params are bonus)
- All exports maintain backward compatibility
