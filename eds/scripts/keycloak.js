import { loadScript } from './aem.js';

// public Keycloak client settings, as used by www.asianpaints.com
const KEYCLOAK_CONFIG = {
  url: 'https://auth.asianpaints.com',
  realm: 'asianpaintsRealm',
  clientId: 'asianpaints',
};
const KEYCLOAK_JS = 'https://cdn.jsdelivr.net/npm/keycloak-js@22.0.3/dist/keycloak.min.js';

let initPromise;

/**
 * Loads keycloak-js and initialises window.keycloak (once). No SSO check on
 * load; a login callback in the URL (after keycloak.login()) is processed.
 * @returns {Promise<object|undefined>} the keycloak instance
 */
export function initKeycloak() {
  if (!initPromise) {
    initPromise = (async () => {
      await loadScript(KEYCLOAK_JS);
      if (!window.keycloak && window.Keycloak) {
        window.keycloak = new window.Keycloak(KEYCLOAK_CONFIG);
      }
      try {
        await window.keycloak?.init({ pkceMethod: 'S256', checkLoginIframe: false });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('keycloak init failed', e);
      }
      return window.keycloak;
    })();
  }
  return initPromise;
}

/** true when the Keycloak login callback is in the URL */
export const hasLoginCallback = () => /[#&?](state|code)=/.test(window.location.hash);

export function isKeycloakAuthenticated() {
  return !!window.keycloak?.authenticated;
}

/**
 * Same logic as the AEM showLogin(): login analytics, then Keycloak login.
 */
export function showLogin() {
  const { ccAnalytics, _satellite: satellite, keycloak } = window;
  if (typeof ccAnalytics?.satelliteCheck === 'function' && ccAnalytics.satelliteCheck()) {
    satellite?.track?.('login_icon', {});
    ccAnalytics.adobeLoginIconCLick?.();
  }
  if (typeof keycloak !== 'undefined' && typeof keycloak.idToken === 'undefined') {
    keycloak.login();
  }
}
