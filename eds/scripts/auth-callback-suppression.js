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

// Evaluate once at module load so later history.replaceState calls don't
// alter suppression for this page lifecycle.
export const SUPPRESS_ANALYTICS_FOR_THIS_PAGE = hasAuthCallbackHashParams();