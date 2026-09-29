import { getDigitalData, trackEvent } from '../../scripts/analytics_1.js';

const PINCODE_STORAGE_KEY = 'pincode';
const PINCODE_COOKIE_NAME = 'cpPincode';
const PINCODE_COOKIE_EXPIRY_DAYS = 30;

/**
 * Saves pincode to both localStorage (primary, matches AEM live site
 * ccGlobal.setLocalStoragePincode) and a cookie (secondary fallback).
 */
function savePincode(pincode) {
  if (!pincode || pincode.length < 6) return;

  try {
    localStorage.setItem(PINCODE_STORAGE_KEY, pincode);
  } catch {
    // localStorage unavailable — cookie fallback is set below
  }

  const now = new Date();
  now.setTime(now.getTime() + (PINCODE_COOKIE_EXPIRY_DAYS * 24 * 60 * 60 * 1000));
  document.cookie = `${PINCODE_COOKIE_NAME}=${encodeURIComponent(pincode)};expires=${now.toUTCString()};path=/`;
}

/**
 * Retrieves saved pincode. Priority: URL param > localStorage > cookie.
 */
function getSavedPincode() {
  try {
    const params = new URLSearchParams(window.location.search);
    const cpListing = params.get('cpListing') || '';
    if (cpListing.startsWith('pinCode:')) {
      const pin = cpListing.split(':')[1];
      if (pin && pin.length === 6 && /^[0-9]{6}$/.test(pin)) return pin;
    }
  } catch {
    // URL parsing failed — fall through
  }

  // 2. localStorage (matches AEM live site ccGlobal.getLocalStoragePincode)
  try {
    const stored = localStorage.getItem(PINCODE_STORAGE_KEY);
    if (stored && stored.length === 6 && /^[0-9]{6}$/.test(stored)) return stored;
  } catch {
    // localStorage unavailable
  }

  const cookieVal = `; ${document.cookie}`;
  const parts = cookieVal.split(`; ${PINCODE_COOKIE_NAME}=`);
  if (parts.length === 2) {
    const raw = parts.pop().split(';').shift();
    const decoded = raw ? decodeURIComponent(raw) : '';
    if (decoded && decoded.length === 6 && /^[0-9]{6}$/.test(decoded)) return decoded;
  }

  return '';
}

function handleRedirection(pincode, options = {}) {
  if (!pincode || pincode.length < 6) return;

  savePincode(pincode);

  const {
    baseUrl = '/contractor-listing-page.html',
    target = '_self',
    type = 'pincode',
  } = options;

  let url = '';
  if (type === 'pincode') {
    url = `${baseUrl}?cpListing=pinCode:${encodeURIComponent(pincode)}`;
  } else if (type === 'mobile') {
    url = `${baseUrl}?cpListing=contactNumber:${encodeURIComponent(pincode)}`;
  } else {
    url = `${baseUrl}?q=${encodeURIComponent(pincode)}`;
  }

  if (target === '_blank') {
    window.open(url, target);
  } else {
    window.location.href = url;
  }
}

function normalizeKey(s) {
  return (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function getCellText(cell) {
  if (!cell) return '';
  const el = cell.querySelector('h1,h2,h3,h4,h5,p,strong,em,span,a');
  return (el ? el.textContent : cell.textContent).trim();
}

function getCellLink(cell) {
  if (!cell) return '';
  const a = cell.querySelector('a');
  if (a) {
    // Use URL to extract pathname, ensuring relative paths for cross-env compat
    try {
      const parsed = new URL(a.href, window.location.origin);
      return parsed.pathname;
    } catch {
      return a.getAttribute('href') || '';
    }
  }
  const raw = cell.textContent.trim();
  // If authored text is already a relative path or full URL, extract pathname
  try {
    if (raw.startsWith('/')) return raw;
    const parsed = new URL(raw);
    return parsed.pathname;
  } catch {
    return raw;
  }
}

function readKeyValueRows(block) {
  const rows = [...block.children];
  const map = {};
  rows.forEach((row) => {
    const cols = [...row.children];
    if (cols.length < 2) return;
    const [col0, col1] = cols;
    const k = normalizeKey(col0.textContent);
    if (!k) return;
    map[k] = col1;
  });
  return map;
}

function getPicture(cell) {
  if (!cell) return null;
  const picture = cell.querySelector('picture');
  return picture ? picture.cloneNode(true) : null;
}

function trackContractorSearch(searchKeyWord) {
  if (!searchKeyWord) return;

  getDigitalData().contractor = { cityPincode: searchKeyWord };
  trackEvent('Contractor Search Click', { cityPincode: searchKeyWord });
}

function decorateSearch(block) {
  const rows = [...block.children];
  let heading = '';
  let description = '';
  let mobileDescription = '';
  let cardTitle = 'Find a contractor near you!';
  let placeholder = 'Enter pincode';
  let redirectUrl = '';

  if (rows.length >= 1) {
    const headingEl = rows[0].querySelector('h2, h3, strong, p');
    heading = headingEl ? headingEl.textContent.trim() : rows[0].textContent.trim();
  }
  if (rows.length >= 2) {
    const descEl = rows[1].querySelector('p');
    description = descEl ? descEl.textContent.trim() : rows[1].textContent.trim();
  }
  if (rows.length >= 3) {
    mobileDescription = rows[2].innerHTML.trim();
  }
  if (rows.length >= 4) {
    const cols = [...rows[3].children];
    if (cols.length >= 1) cardTitle = cols[0].textContent.trim();
    if (cols.length >= 2) placeholder = cols[1].textContent.trim();
  }
  if (rows.length >= 5) {
    const cols = [...rows[4].children];
    const linkCell = cols.length >= 2 ? cols[1] : rows[4];
    redirectUrl = getCellLink(linkCell);
  }

  block.textContent = '';
  if (heading) {
    const h2 = document.createElement('h2');
    h2.textContent = heading;
    block.appendChild(h2);
  }
  if (description) {
    const p = document.createElement('p');
    p.textContent = description;
    block.appendChild(p);
  }
  if (mobileDescription) {
    const mobileDiv = document.createElement('div');
    mobileDiv.className = 'pincode-mobile-description';
    const temp = document.createElement('div');
    temp.innerHTML = mobileDescription;
    const cell = temp.firstElementChild;
    if (cell) {
      const parts = cell.innerHTML.trim().split(/(?:<br\s*\/?>\s*)+/).filter((p) => p.trim());
      parts.forEach((part) => {
        const p = document.createElement('p');
        p.innerHTML = part.trim();
        mobileDiv.appendChild(p);
      });
    } else {
      mobileDiv.innerHTML = mobileDescription;
    }
    block.appendChild(mobileDiv);
    block.classList.add('has-mobile-desc');
  }

  const card = document.createElement('div');
  card.className = 'pincode-search-card';

  const titleEl = document.createElement('div');
  titleEl.className = 'pincode-search-card-title';
  titleEl.textContent = cardTitle;
  card.appendChild(titleEl);

  const inputWrapper = document.createElement('div');
  inputWrapper.className = 'pincode-input-wrapper cpListing-pincode--div';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'pincode-input';
  input.placeholder = placeholder;
  input.maxLength = 6;
  input.pattern = '[0-9]*';
  input.inputMode = 'numeric';
  inputWrapper.appendChild(input);

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'pincode-search-button';
  button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="14" viewBox="0 0 16 14" fill="none"><path d="M9.11103 1.1665L14.6666 6.99984M14.6666 6.99984L9.11103 12.8332M14.6666 6.99984L1.33325 6.99984" stroke="#232426" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  button.setAttribute('aria-label', 'Search');
  inputWrapper.appendChild(button);

  card.appendChild(inputWrapper);
  block.appendChild(card);

  const onSearch = () => handleRedirection(input.value.trim(), {
    baseUrl: redirectUrl || undefined,
    type: 'pincode',
  });

  button.addEventListener('click', () => {
    trackContractorSearch(input.value.trim());
    onSearch();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') onSearch();
  });
  input.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/[^0-9]/g, '');
  });

  // Pre-populate pincode from URL param / localStorage / cookie
  const savedPincode = getSavedPincode();
  if (savedPincode) {
    input.value = savedPincode;
  }
}

function decorateCta(block) {
  const cfg = readKeyValueRows(block);
  const picture = getPicture(cfg.image);
  const titleText = getCellText(cfg.title);
  const placeholderText = getCellText(cfg['input placeholder']) || 'Enter pincode';
  const ctaText = getCellText(cfg['cta text']) || 'Search';
  const ctaLink = getCellLink(cfg['cta link']) || getCellLink(cfg['redirect url']);
  const ctaTarget = getCellText(cfg['cta target']) || '_self';

  const wrapper = document.createElement('div');
  wrapper.className = 'swapimagewithcta baseCTSpace imageWithRightTextComp imageLeftAligned';

  const swapImgWraper = document.createElement('div');
  swapImgWraper.className = 'swap-img-wraper';

  const imgWrap = picture || document.createElement('div');
  imgWrap.className = 'img-wrapper img-left';

  const rightWrap = document.createElement('div');
  rightWrap.className = 'righttext-wrapper text-align-right';

  const headingWrap = document.createElement('div');
  headingWrap.className = 'righttext-heading';
  if (titleText) {
    const rte = document.createElement('div');
    rte.className = 'rte text section';

    const h2 = document.createElement('h2');
    const mobileWeight = document.createElement('span');
    mobileWeight.className = 'mob-weight-800';
    const desktopWeight = document.createElement('span');
    desktopWeight.className = 'desk-weight-800';
    const mobileSize = document.createElement('span');
    mobileSize.className = 'mob-extra-bold-32';
    const desktopSize = document.createElement('span');
    desktopSize.className = 'desk-extra-bold-54';
    desktopSize.textContent = titleText;

    mobileSize.appendChild(desktopSize);
    desktopWeight.appendChild(mobileSize);
    mobileWeight.appendChild(desktopWeight);
    h2.appendChild(mobileWeight);
    rte.appendChild(h2);
    headingWrap.appendChild(rte);
  }
  rightWrap.appendChild(headingWrap);

  const findWrap = document.createElement('div');
  findWrap.className = 'findcontractor-wraper';

  const pinWrap = document.createElement('div');
  pinWrap.className = 'pin-code-city-search-wp';

  const inputWithCta = document.createElement('div');
  inputWithCta.className = 'input-with-cta cpListing-pincode--div';

  const inputWp = document.createElement('div');
  inputWp.className = 'pincode-input-wp';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'pincode-input ctaPincode';
  input.placeholder = placeholderText;
  input.maxLength = 6;
  input.pattern = '[0-9]*';
  input.inputMode = 'numeric';
  inputWp.appendChild(input);

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'pincode-cta-button js-pincode-cta';
  button.innerHTML = `${ctaText} <svg xmlns="http://www.w3.org/2000/svg" width="16" height="14" viewBox="0 0 16 14" fill="none"><path d="M9.11103 1.1665L14.6666 6.99984M14.6666 6.99984L9.11103 12.8332M14.6666 6.99984L1.33325 6.99984" stroke="#232426" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  inputWithCta.appendChild(inputWp);
  inputWithCta.appendChild(button);
  pinWrap.appendChild(inputWithCta);
  findWrap.appendChild(pinWrap);
  rightWrap.appendChild(findWrap);
  swapImgWraper.appendChild(imgWrap);
  swapImgWraper.appendChild(rightWrap);
  wrapper.appendChild(swapImgWraper);

  const onGo = () => handleRedirection(input.value.trim(), {
    baseUrl: ctaLink || undefined,
    target: ctaTarget,
    type: 'pincode',
  });

  button.addEventListener('click', () => {
    trackContractorSearch(input.value.trim());
    onGo();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') onGo();
  });
  input.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/[^0-9]/g, '');
  });
  
  const savedPincode = getSavedPincode();
  if (savedPincode) {
    input.value = savedPincode;
  }

  block.textContent = '';
  block.appendChild(wrapper);
}

export default function decorate(block) {
  if (block.classList.contains('cta')) {
    decorateCta(block);
    return;
  }
  decorateSearch(block);
}
