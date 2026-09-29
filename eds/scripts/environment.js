export const BETA_DOMAIN = 'beta.asianpaints.com';
export const PROD_DOMAIN = 'www.asianpaints.com';

export const DOMAIN_ENV = Object.freeze({
  BETA: 'beta',
  PROD: 'prod',
});

const PROD_DOMAIN_ALIASES = new Set([
  PROD_DOMAIN,
  'asianpaints.com',
]);

/**
 * Resolves site environment from hostname.
 * @param {string} [hostname] Optional hostname override.
 * @returns {'beta'|'prod'} Resolved environment.
 */
export function getDomainEnvironment(hostname = window.location.hostname) {
  const normalizedHostname = (hostname || '').toLowerCase();

  if (normalizedHostname === BETA_DOMAIN) {
    return DOMAIN_ENV.BETA;
  }

  if (PROD_DOMAIN_ALIASES.has(normalizedHostname)) {
    return DOMAIN_ENV.PROD;
  }

  return DOMAIN_ENV.BETA;
}

export function isBetaDomain(hostname = window.location.hostname) {
  return getDomainEnvironment(hostname) === DOMAIN_ENV.BETA;
}

export function isProdDomain(hostname = window.location.hostname) {
  return getDomainEnvironment(hostname) === DOMAIN_ENV.PROD;
}
