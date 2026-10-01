/*
 * Warranty registration form (loaded on demand by warranty-container).
 * Three steps against the existing Asian Paints services, same endpoints and payloads as the
 * source site:
 *   1. Customer info + mobile OTP (send / verify)
 *   2. Up to 5 products from the warranty product catalogue (quantity rules, shade, undercoat)
 *   3. Invoices (1-3 files, 3 MB each) + optional dealer/contractor, then one registration
 *      call per product
 * Configuration (page or bulk metadata):
 *   warranty-api-base        origin of the services; empty = same origin (www.asianpaints.com)
 *   warranty-encryption-key  passphrase for field encryption (supplied by Asian Paints)
 */
import { getMetadata, loadCSS } from '../../scripts/aem.js';
import encryptField from '../../scripts/asianpaints-crypto.js';

const ENDPOINTS = {
  products: '/apcolourcatalogue/getProductsList/warrantyRegistration.json',
  sendOtp: '/apcolourcatalogue/ccforms.getOtp.json',
  verifyOtp: '/apcolourcatalogue/ccforms.otpVerification.json',
  register: '/apcolourcatalogue/registerWarranty.eachProductRegisteration.json',
};
const MAX_PRODUCTS = 5;
const MAX_FILES = 3;
const MAX_FILE_BYTES = 3 * 1024 * 1024;
const FILE_TYPES = /\.(pdf|jpe?g|png)$/i;
const OTP_RESEND_SECONDS = 119;

const MESSAGES = {
  required: 'Field is required',
  name: 'Use letters and spaces only',
  email: 'Please enter a valid email ID',
  pincode: 'Please enter a valid 6-digit pincode',
  mobile: 'Please enter a valid 10-digit mobile number',
  otp: 'Enter correct OTP',
  quantity: (min, unit) => `Minimum quantity is ${min} ${unit}`,
  totalQuantity: (min, unit) => `Total quantity of products must be at least ${min} ${unit}`,
  otpSendFailed: 'We could not send the OTP. Please try again.',
  otpVerifyFailed: 'We could not verify the OTP. Please try again.',
  catalogueFailed: 'We could not load the product list.',
  fileCount: `You can upload up to ${MAX_FILES} files`,
  fileSize: 'File size should not be greater than 3 MB',
  fileType: 'Upload a PDF, JPG or PNG file',
  filesRequired: 'Upload at least one invoice to continue',
  terms: 'Please accept the terms and conditions',
};

const PATTERNS = {
  name: /^[a-zA-Z ]+$/,
  email: /^[a-zA-Z0-9][a-zA-Z0-9-_.]+@([a-zA-Z]|[a-zA-Z0-9]?[a-zA-Z0-9-]+[a-zA-Z0-9])\.[a-zA-Z0-9]{2,10}(?:\.[a-zA-Z]{2,10})?$/,
  pincode: /^[0-9]{6}$/,
  mobile: /^[0-9]{10}$/,
  otp: /^[0-9]{6}$/,
};

let formInstances = 0;

/*
 * Blur validation can insert an error message; if that happens while the pointer is pressed on
 * a button below, the button moves and the click is lost. Checks triggered during a press run
 * right after the click completes instead.
 */
let pointerActive = false;
const deferred = new Set();
const flushDeferred = () => {
  pointerActive = false;
  deferred.forEach((fn) => fn());
  deferred.clear();
};
document.addEventListener('pointerdown', () => { pointerActive = true; }, true);
['pointerup', 'pointercancel'].forEach((type) => {
  document.addEventListener(type, () => setTimeout(flushDeferred, 0), true);
});
const afterPointer = (fn) => {
  if (pointerActive) deferred.add(fn);
  else fn();
};

/* ---------- small DOM helpers ---------- */

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([key, value]) => {
    if (value === undefined || value === null || value === false) return;
    if (key === 'className') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
    else node.setAttribute(key, value === true ? '' : value);
  });
  node.append(...children.flat().filter((c) => c !== null && c !== undefined && c !== false));
  return node;
}

/**
 * Builds a labelled field with an inline error linked through aria-describedby.
 * `filter` strips characters as the visitor types (digits-only, letters-only).
 */
function createField(prefix, {
  name, label, type = 'text', required = false, autocomplete, inputmode, maxlength,
  filter, validate, addon, unit, options,
}) {
  const id = `${prefix}-${name}`;
  const error = el('p', { className: 'wr-error', id: `${id}-error`, hidden: true });
  const control = options
    ? el('select', { id, name, required }, el('option', { value: '', text: options }))
    : el('input', {
      // filtered fields enforce their length after cleaning, so a pasted "98765 43210" still
      // yields 10 digits; maxlength would cut it first
      id, name, type, required, autocomplete, inputmode, maxlength: filter ? undefined : maxlength, spellcheck: type === 'email' ? 'false' : undefined,
    });
  control.setAttribute('aria-describedby', error.id);
  const labelEl = el('label', { for: id }, label, required ? '' : el('span', { className: 'wr-optional', text: ' (optional)' }));
  const input = el('div', { className: 'wr-input' }, addon ? el('span', { className: 'wr-addon', 'aria-hidden': 'true', text: addon }) : null, control, unit ? el('span', { className: 'wr-unit' }) : null);
  const wrapper = el('div', { className: `wr-field wr-field-${name}` }, labelEl, input, error);

  const field = {
    name,
    wrapper,
    control,
    touched: false,
    get value() { return control.value.trim(); },
    set value(v) { control.value = v ?? ''; },
    setUnit(text) { const u = input.querySelector('.wr-unit'); if (u) u.textContent = text || ''; },
    setError(message) {
      error.textContent = message || '';
      error.hidden = !message;
      if (message) control.setAttribute('aria-invalid', 'true');
      else control.removeAttribute('aria-invalid');
    },
    check(show = field.touched) {
      let message = '';
      if (!field.wrapper.hidden && !control.disabled) {
        if (!field.value) message = required ? MESSAGES.required : '';
        else if (validate) message = validate(field.value) || '';
      }
      if (show) {
        // once an error has been shown, keep the field live-validated as the visitor types
        field.touched = true;
        field.setError(message);
      }
      return !message;
    },
  };

  if (filter) {
    control.addEventListener('input', () => {
      const clean = filter(control.value);
      if (clean !== control.value) control.value = clean;
    });
  }
  control.addEventListener('blur', () => afterPointer(() => {
    // `quiet` lets a form keep untouched optional groups (an empty product editor) silent
    if (field.quiet?.()) return;
    field.touched = true;
    field.check();
  }));
  control.addEventListener('input', () => { if (field.touched) field.check(); });
  return field;
}

const digitsOnly = (max) => (v) => v.replace(/\D/g, '').slice(0, max);
const lettersOnly = (max) => (v) => v.replace(/[^a-zA-Z ]/g, '').slice(0, max);
const matches = (pattern, message) => (v) => (pattern.test(v) ? '' : message);

function setOptions(select, names, placeholder) {
  select.replaceChildren(el('option', { value: '', text: placeholder }), ...names.map((n) => el('option', { value: n, text: n })));
}

function parseMin(raw) {
  const text = String(raw || '1').trim();
  return { total: text.startsWith('+'), value: Number(text.replace('+', '')) || 1 };
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^;]*;base64,/, ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/* ---------- service calls ---------- */

function createApi(base) {
  const root = (base || '').replace(/\/$/, '');
  const call = async (path, { method = 'GET', params, form } = {}) => {
    const url = new URL(`${root}${path}`, window.location.href);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const response = await fetch(url, {
      method,
      credentials: 'include',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      body: form ? new URLSearchParams(form) : undefined,
    });
    if (!response.ok) throw new Error(`${path} responded ${response.status}`);
    let data = await response.text();
    // responses are JSON, sometimes JSON-encoded twice
    for (let i = 0; i < 2 && typeof data === 'string'; i += 1) {
      try { data = JSON.parse(data); } catch { break; }
    }
    return data;
  };
  return {
    products: () => call(ENDPOINTS.products),
    sendOtp: (encryptedMobile) => call(ENDPOINTS.sendOtp, {
      params: { mobileNo: encryptedMobile },
    }),
    verifyOtp: (otp, mobile) => call(ENDPOINTS.verifyOtp, { method: 'POST', form: { otpData: otp, mobileNo: mobile } }),
    register: (payload) => call(ENDPOINTS.register, { method: 'POST', form: { data: JSON.stringify(payload) } }),
  };
}

export function getRegistrationConfig() {
  return {
    apiBase: getMetadata('warranty-api-base'),
    passphrase: getMetadata('warranty-encryption-key'),
  };
}

/* ---------- the form ---------- */

/**
 * Replaces the banner content with the registration form.
 * @param {Element} container Element that will hold the form (the block's banner column)
 * @param {{apiBase: string, passphrase: string}} config Service configuration
 */
export default async function openRegistration(container, config) {
  formInstances += 1;
  const prefix = `wr-${formInstances}`;
  const api = createApi(config.apiBase);
  const encrypt = (value) => encryptField(value, config.passphrase);
  await loadCSS(`${window.hlx.codeBasePath}/blocks/warranty-container/warranty-registration.css`);

  const state = {
    step: 0,
    otpSent: false,
    verified: false,
    catalogue: null,
    products: [],
    editing: null,
    files: [],
    results: [],
  };

  let root;
  const track = (name, data = {}) => {
    try {
      // Adobe Launch, when the page has it (event names match the source site)
      // eslint-disable-next-line no-underscore-dangle
      window._satellite?.track?.(name, data);
    } catch { /* analytics must never break the form */ }
    root?.dispatchEvent(new CustomEvent('warranty-registration', { bubbles: true, detail: { name, ...data } }));
  };

  const status = el('p', { className: 'wr-sr-only', role: 'status', 'aria-live': 'polite' });
  const announce = (message) => { status.textContent = ''; setTimeout(() => { status.textContent = message; }, 50); };

  const stepNames = ['Customer Info', 'Product Info', 'Billing Info'];
  const stepItems = stepNames.map((name, i) => el('li', { className: 'wr-step' }, el('span', { className: 'wr-step-number', 'aria-hidden': 'true', text: String(i + 1) }), el('span', { text: name }), el('span', { className: 'wr-sr-only wr-step-state' })));
  const progress = el('ol', { className: 'wr-steps', 'aria-label': 'Registration steps' }, stepItems);
  const title = el('h2', { className: 'wr-title', tabindex: '-1', text: 'Warranty Registration' });

  /* ---- step 1: customer ---- */
  const c = (opts) => createField(`${prefix}-c`, opts);
  const customer = {
    fullName: c({
      name: 'fullName', label: 'Full Name', required: true, autocomplete: 'name', maxlength: 30, filter: lettersOnly(30), validate: matches(PATTERNS.name, MESSAGES.name),
    }),
    emailId: c({
      name: 'emailId', label: 'Email ID', type: 'email', required: true, autocomplete: 'email', validate: matches(PATTERNS.email, MESSAGES.email),
    }),
    address: c({
      name: 'address', label: 'Address', required: true, autocomplete: 'street-address',
    }),
    city: c({
      name: 'city', label: 'City', required: true, autocomplete: 'address-level2', maxlength: 30, filter: lettersOnly(30), validate: matches(PATTERNS.name, MESSAGES.name),
    }),
    pincode: c({
      name: 'pincode', label: 'Pincode', required: true, autocomplete: 'postal-code', inputmode: 'numeric', maxlength: 6, filter: digitsOnly(6), validate: matches(PATTERNS.pincode, MESSAGES.pincode),
    }),
    mobileNumber: c({
      name: 'mobileNumber', label: 'Mobile number', type: 'tel', required: true, autocomplete: 'tel-national', inputmode: 'numeric', maxlength: 10, addon: '+91', filter: digitsOnly(10), validate: matches(PATTERNS.mobile, MESSAGES.mobile),
    }),
  };
  const otp = c({
    name: 'otp', label: 'OTP', required: true, autocomplete: 'one-time-code', inputmode: 'numeric', maxlength: 6, filter: digitsOnly(6), validate: matches(PATTERNS.otp, MESSAGES.otp),
  });
  const verifiedBadge = el('p', { className: 'wr-verified', hidden: true, text: 'Mobile number verified' });
  customer.mobileNumber.wrapper.append(verifiedBadge);
  const resend = el('button', { type: 'button', className: 'wr-link-button', disabled: true });
  const otpGroup = el('div', { className: 'wr-otp', hidden: true }, otp.wrapper, resend);
  const getOtp = el('button', {
    type: 'button', className: 'wr-button wr-primary', text: 'Get OTP',
  });
  const toProducts = el('button', {
    type: 'submit', className: 'wr-button wr-primary', text: 'Next',
  });
  const customerForm = el(
    'form',
    { className: 'wr-panel', noValidate: true, 'aria-labelledby': `${prefix}-h-0` },
    el('h3', { id: `${prefix}-h-0`, tabindex: '-1', text: 'Customer Info' }),
    customer.fullName.wrapper,
    customer.emailId.wrapper,
    customer.address.wrapper,
    el('div', { className: 'wr-row' }, customer.city.wrapper, customer.pincode.wrapper),
    customer.mobileNumber.wrapper,
    otpGroup,
    el('div', { className: 'wr-actions' }, getOtp, toProducts),
  );
  customerForm.noValidate = true;

  const customerValid = (show = false) => Object.values(customer)
    .map((f) => f.check(show)).every(Boolean);

  let timer;
  const startResendTimer = () => {
    clearInterval(timer);
    let left = OTP_RESEND_SECONDS;
    const tick = () => {
      if (left <= 0) {
        clearInterval(timer);
        resend.disabled = false;
        resend.textContent = 'Resend OTP';
        return;
      }
      resend.disabled = true;
      resend.textContent = `Resend OTP in ${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`;
      left -= 1;
    };
    tick();
    timer = setInterval(tick, 1000);
  };

  const sendOtp = async () => {
    if (!customerValid(true)) {
      customerForm.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }
    getOtp.disabled = true;
    resend.disabled = true;
    try {
      await api.sendOtp(await encrypt(customer.mobileNumber.value));
      state.otpSent = true;
      otpGroup.hidden = false;
      getOtp.hidden = true;
      otp.value = '';
      otp.setError('');
      startResendTimer();
      announce(`OTP sent to +91 ${customer.mobileNumber.value}`);
      otp.control.focus();
      track('BHS_AA_Phoneno', { flowType: 'Warranty' });
    } catch {
      announce(MESSAGES.otpSendFailed);
      (state.otpSent ? otp : customer.mobileNumber).setError(MESSAGES.otpSendFailed);
      getOtp.disabled = false;
      resend.disabled = false;
    }
  };

  const verifyOtp = async () => {
    if (!PATTERNS.otp.test(otp.value)) return;
    try {
      const result = await api.verifyOtp(otp.value, customer.mobileNumber.value);
      if (result && (result.verified === true || result.verified === 'true')) {
        state.verified = true;
        clearInterval(timer);
        otpGroup.hidden = true;
        customer.mobileNumber.control.readOnly = true;
        verifiedBadge.hidden = false;
        announce('Mobile number verified');
        track('BHS_AA_OTP', { flowType: 'Warranty' });
        toProducts.focus();
      } else {
        otp.setError(MESSAGES.otp);
      }
    } catch {
      otp.setError(MESSAGES.otpVerifyFailed);
    }
  };

  const resetOtp = () => {
    if (!state.otpSent || state.verified) return;
    state.otpSent = false;
    clearInterval(timer);
    otpGroup.hidden = true;
    getOtp.hidden = false;
    getOtp.disabled = false;
    otp.value = '';
    otp.setError('');
  };

  getOtp.addEventListener('click', sendOtp);
  resend.addEventListener('click', () => { otp.value = ''; sendOtp(); });
  otp.control.addEventListener('input', () => { if (otp.value.length === 6) verifyOtp(); });
  customer.mobileNumber.control.addEventListener('input', resetOtp);
  customer.fullName.control.addEventListener('focus', () => track('form_start', { formName: 'Warranty Registration Form', campaignId: '' }), { once: true });

  /* ---- step 2: products ---- */
  const p = (opts) => createField(`${prefix}-p`, opts);
  const editor = {
    category: p({
      name: 'category', label: 'Category', required: true, options: 'Select category',
    }),
    product: p({
      name: 'product', label: 'Product', required: true, options: 'Select product',
    }),
    quantity: p({
      name: 'quantity', label: 'Quantity', required: true, inputmode: 'numeric', maxlength: 3, unit: true, filter: digitsOnly(3),
    }),
    shadeCode: p({ name: 'shadeCode', label: 'Shade code', maxlength: 20 }),
    undercoat: p({
      name: 'undercoat', label: 'Undercoat', required: true, options: 'Select undercoat',
    }),
    undercoatQuantity: p({
      name: 'undercoatQuantity', label: 'Undercoat quantity', required: true, inputmode: 'numeric', maxlength: 3, unit: true, filter: digitsOnly(3),
    }),
  };
  const totalError = el('p', { className: 'wr-error', id: `${prefix}-total-error`, hidden: true });
  const productHeading = el('h4', { className: 'wr-product-heading', text: 'Product 1' });
  const savedList = el('ol', { className: 'wr-saved', 'aria-label': 'Added products' });
  const addAnother = el('button', { type: 'button', className: 'wr-button wr-secondary', text: '+ Add another product' });
  const removeCurrent = el('button', {
    type: 'button', className: 'wr-link-button', hidden: true, text: 'Delete this product',
  });
  const terms = el('input', {
    type: 'checkbox', id: `${prefix}-terms`, name: 'terms', required: true, 'aria-describedby': `${prefix}-terms-error`,
  });
  const termsError = el('p', { className: 'wr-error', id: `${prefix}-terms-error`, hidden: true });
  const toBilling = el('button', { type: 'submit', className: 'wr-button wr-primary', text: 'Next' });
  const catalogueStatus = el('p', { className: 'wr-note', hidden: true });
  const productForm = el(
    'form',
    { className: 'wr-panel', 'aria-labelledby': `${prefix}-h-1`, hidden: true },
    el('h3', { id: `${prefix}-h-1`, tabindex: '-1', text: 'Product Info' }),
    savedList,
    el('fieldset', { className: 'wr-product' }, el('legend', { className: 'wr-sr-only', text: 'Product details' }), productHeading, catalogueStatus, editor.category.wrapper, editor.product.wrapper, el('div', { className: 'wr-row' }, editor.quantity.wrapper, editor.shadeCode.wrapper), editor.undercoat.wrapper, editor.undercoatQuantity.wrapper, totalError, removeCurrent),
    addAnother,
    el('div', { className: 'wr-terms' }, terms, el('label', { for: terms.id }, 'Please accept ', el('a', {
      href: 'https://www.asianpaints.com/footer-links/terms-and-conditions.html', target: '_blank', rel: 'noopener', text: 'terms and conditions',
    }), el('span', { className: 'wr-sr-only', text: ' (opens in a new tab)' })), termsError),
    el('div', { className: 'wr-actions' }, toBilling),
  );
  productForm.noValidate = true;

  const productEntry = () => state.catalogue?.[editor.category.value]?.[editor.product.value];
  const undercoatEntry = () => productEntry()?.Undercoat?.[editor.undercoat.value];

  const syncEditor = () => {
    const entry = productEntry();
    const undercoats = entry?.Undercoat ? Object.keys(entry.Undercoat) : [];
    editor.product.control.disabled = !editor.category.value;
    editor.quantity.control.disabled = !entry;
    editor.quantity.setUnit(entry?.Unit || 'L');
    editor.shadeCode.wrapper.hidden = entry?.ShowShadeCode !== 'Y';
    editor.undercoat.wrapper.hidden = !undercoats.length;
    editor.undercoatQuantity.wrapper.hidden = !undercoats.length;
    editor.undercoatQuantity.control.disabled = !undercoatEntry();
    editor.undercoatQuantity.setUnit(undercoatEntry()?.Unit || 'Pcs.');
  };

  const editorEmpty = () => !editor.category.value && !editor.product.value;
  Object.values(editor).forEach((f) => { f.quiet = editorEmpty; });

  [editor.quantity, editor.undercoatQuantity].forEach((f) => {
    f.control.setAttribute('aria-describedby', `${f.control.getAttribute('aria-describedby')} ${totalError.id}`);
  });

  /**
   * Quantity rules from the catalogue: "N" is a per-field minimum, "+N" is a minimum for the
   * product and undercoat quantities combined.
   */
  const editorValid = (show = false) => {
    let ok = Object.values(editor).map((f) => f.check(show)).every(Boolean);
    let totalMessage = '';
    const entry = productEntry();
    if (entry) {
      const rows = [[editor.quantity, entry]];
      if (!editor.undercoatQuantity.wrapper.hidden && undercoatEntry()) {
        rows.push([editor.undercoatQuantity, undercoatEntry()]);
      }
      const sum = rows.reduce((total, [f]) => total + (Number(f.value) || 0), 0);
      rows.forEach(([f, item]) => {
        const min = parseMin(item.Quantity);
        const amount = Number(f.value) || 0;
        const visible = show || f.touched;
        if (!amount) {
          ok = false;
          if (visible && f.value) f.setError(MESSAGES.required);
        } else if (min.total) {
          if (sum < min.value) {
            ok = false;
            totalMessage = MESSAGES.totalQuantity(min.value, item.Unit);
          }
        } else if (amount < min.value) {
          ok = false;
          if (visible) f.setError(MESSAGES.quantity(min.value, item.Unit));
        }
      });
    }
    const showTotal = Boolean(totalMessage) && (show || editor.quantity.touched);
    totalError.textContent = showTotal ? totalMessage : '';
    totalError.hidden = !showTotal;
    return ok;
  };

  const resetEditor = () => {
    Object.values(editor).forEach((f) => {
      f.value = '';
      f.touched = false;
      f.setError('');
    });
    setOptions(editor.product.control, [], 'Select product');
    setOptions(editor.undercoat.control, [], 'Select undercoat');
    totalError.hidden = true;
    syncEditor();
  };

  const loadEditor = (item) => {
    editor.category.value = item.category;
    setOptions(editor.product.control, Object.keys(state.catalogue[item.category] || {}), 'Select product');
    editor.product.value = item.product;
    const undercoats = Object.keys(productEntry()?.Undercoat || {});
    setOptions(editor.undercoat.control, undercoats, 'Select undercoat');
    editor.undercoat.value = item.undercoat;
    editor.quantity.value = item.productQuantity;
    editor.shadeCode.value = item.shadeCode;
    editor.undercoatQuantity.value = item.undercoatQuantity;
    syncEditor();
  };

  const snapshot = () => {
    const entry = productEntry();
    const undercoat = !editor.undercoat.wrapper.hidden ? undercoatEntry() : null;
    return {
      category: editor.category.value,
      product: editor.product.value,
      productCode: entry.SKU_Code,
      productQuantity: editor.quantity.value,
      productQuantityUnit: entry.Unit,
      shadeCode: editor.shadeCode.wrapper.hidden ? '' : editor.shadeCode.value,
      undercoat: undercoat ? editor.undercoat.value : '',
      undercoatCode: undercoat?.SKU_Code || '',
      undercoatQuantity: undercoat ? editor.undercoatQuantity.value : '',
      undercoatQuantityUnit: undercoat?.Unit || '',
    };
  };

  const renderProducts = () => {
    savedList.replaceChildren(...state.products.map((item, i) => el(
      'li',
      { className: i === state.editing ? 'wr-editing' : '' },
      el('span', { className: 'wr-saved-name' }, el('span', { className: 'wr-saved-number', text: `Product ${i + 1}` }), item.product),
      el('button', {
        type: 'button',
        className: 'wr-link-button',
        'aria-label': `Edit product ${i + 1}, ${item.product}`,
        text: i === state.editing ? 'Editing' : 'Edit',
        disabled: i === state.editing,
        onclick: () => {
          // keep what is in the editor before switching
          if (!editorEmpty() && !editorValid(true)) return;
          if (!editorEmpty()) {
            if (state.editing !== null) state.products[state.editing] = snapshot();
            else state.products.push(snapshot());
          }
          state.editing = i;
          loadEditor(state.products[i]);
          renderProducts();
          editor.category.control.focus();
        },
      }),
    )));
    savedList.hidden = !state.products.length;
    const number = state.editing !== null ? state.editing + 1 : state.products.length + 1;
    productHeading.textContent = `Product ${number}`;
    removeCurrent.hidden = state.editing === null;
    const full = state.editing === null && state.products.length >= MAX_PRODUCTS;
    productForm.querySelector('.wr-product').hidden = full;
    addAnother.textContent = state.editing !== null ? 'Save product' : '+ Add another product';
    addAnother.hidden = state.editing === null && state.products.length >= MAX_PRODUCTS - 1;
  };

  /** Saves the editor into the list. Returns false (with errors shown) when it is invalid. */
  const commitEditor = () => {
    if (!editorValid(true)) {
      productForm.querySelector('[aria-invalid="true"]')?.focus();
      return false;
    }
    if (state.editing !== null) state.products[state.editing] = snapshot();
    else state.products.push(snapshot());
    state.editing = null;
    resetEditor();
    renderProducts();
    return true;
  };

  editor.category.control.addEventListener('change', () => {
    setOptions(editor.product.control, Object.keys(state.catalogue?.[editor.category.value] || {}), 'Select product');
    setOptions(editor.undercoat.control, [], 'Select undercoat');
    ['quantity', 'shadeCode', 'undercoatQuantity'].forEach((k) => { editor[k].value = ''; editor[k].setError(''); });
    syncEditor();
  });
  editor.product.control.addEventListener('change', () => {
    setOptions(editor.undercoat.control, Object.keys(productEntry()?.Undercoat || {}), 'Select undercoat');
    ['quantity', 'shadeCode', 'undercoatQuantity'].forEach((k) => { editor[k].value = ''; editor[k].setError(''); });
    syncEditor();
  });
  editor.undercoat.control.addEventListener('change', () => {
    editor.undercoatQuantity.value = '';
    syncEditor();
  });
  productForm.addEventListener('input', () => editorValid(false));
  // runs after the field's own blur check, so minimum-quantity errors show on leaving a field
  productForm.addEventListener('focusout', () => afterPointer(() => {
    if (!editorEmpty()) editorValid(false);
  }));

  addAnother.addEventListener('click', () => {
    const adding = state.editing === null;
    if (commitEditor()) {
      announce(adding ? `Product ${state.products.length} added` : 'Product saved');
      if (adding) track('warranty_add_product');
      editor.category.control.focus();
    }
  });
  removeCurrent.addEventListener('click', () => {
    const removed = state.products.splice(state.editing, 1)[0];
    state.editing = null;
    resetEditor();
    renderProducts();
    announce(`${removed.product} removed`);
    editor.category.control.focus();
  });

  const loadCatalogue = async () => {
    if (state.catalogue) return;
    catalogueStatus.hidden = false;
    catalogueStatus.replaceChildren('Loading products…');
    editor.category.control.disabled = true;
    try {
      state.catalogue = await api.products();
      setOptions(editor.category.control, Object.keys(state.catalogue), 'Select category');
      catalogueStatus.hidden = true;
      editor.category.control.disabled = false;
    } catch {
      catalogueStatus.replaceChildren(`${MESSAGES.catalogueFailed} `, el('button', {
        type: 'button', className: 'wr-link-button', text: 'Try again', onclick: loadCatalogue,
      }));
    }
    syncEditor();
  };

  /* ---- step 3: billing ---- */
  const b = (opts) => createField(`${prefix}-b`, opts);
  const billing = {
    dealerName: b({
      name: 'dealerName', label: 'Dealer name', maxlength: 30, filter: lettersOnly(30), validate: matches(PATTERNS.name, MESSAGES.name),
    }),
    dealerMobileNo: b({
      name: 'dealerMobileNo', label: 'Dealer mobile number', type: 'tel', inputmode: 'numeric', maxlength: 10, addon: '+91', filter: digitsOnly(10), validate: matches(PATTERNS.mobile, MESSAGES.mobile),
    }),
    contractorName: b({
      name: 'contractorName', label: 'Contractor name', maxlength: 30, filter: lettersOnly(30), validate: matches(PATTERNS.name, MESSAGES.name),
    }),
    contractorMobileNo: b({
      name: 'contractorMobileNo', label: 'Contractor mobile number', type: 'tel', inputmode: 'numeric', maxlength: 10, addon: '+91', filter: digitsOnly(10), validate: matches(PATTERNS.mobile, MESSAGES.mobile),
    }),
  };
  const fileHint = el('p', { className: 'wr-note', id: `${prefix}-file-hint`, text: `PDF, JPG or PNG, up to 3 MB each, ${MAX_FILES} files maximum. At least one invoice is required.` });
  const fileError = el('p', { className: 'wr-error', id: `${prefix}-file-error`, hidden: true });
  const fileInput = el('input', {
    type: 'file', id: `${prefix}-files`, className: 'wr-file-input', accept: '.pdf,.jpeg,.jpg,.png', multiple: true, 'aria-describedby': `${fileHint.id} ${fileError.id}`,
  });
  const fileList = el('ul', { className: 'wr-files', 'aria-label': 'Uploaded invoices' });
  const submit = el('button', { type: 'submit', className: 'wr-button wr-primary', text: 'Submit' });
  const billingForm = el(
    'form',
    { className: 'wr-panel', 'aria-labelledby': `${prefix}-h-2`, hidden: true },
    el('h3', { id: `${prefix}-h-2`, tabindex: '-1', text: 'Billing Info' }),
    el('div', { className: 'wr-upload' }, fileInput, el('label', { for: fileInput.id }, el('span', { className: 'wr-upload-title', text: 'Upload invoice' })), fileHint, fileError),
    fileList,
    billing.dealerName.wrapper,
    billing.dealerMobileNo.wrapper,
    billing.contractorName.wrapper,
    billing.contractorMobileNo.wrapper,
    el('div', { className: 'wr-actions' }, submit),
  );
  billingForm.noValidate = true;

  // `invalid` only for the required-invoice error; rejected-file notices are informational
  const setFileError = (message, invalid = false) => {
    fileError.textContent = message;
    fileError.hidden = !message;
    if (invalid) fileInput.setAttribute('aria-invalid', 'true');
    else fileInput.removeAttribute('aria-invalid');
  };

  const renderFiles = () => {
    fileList.replaceChildren(...state.files.map((file, i) => el(
      'li',
      {},
      el('span', { className: 'wr-file-name', text: file.name }),
      el('span', { className: 'wr-file-date', text: file.date }),
      el('button', {
        type: 'button',
        className: 'wr-link-button',
        'aria-label': `Remove ${file.name}`,
        text: 'Remove',
        onclick: () => {
          state.files.splice(i, 1);
          renderFiles();
          announce(`${file.name} removed`);
          fileInput.focus();
        },
      }),
    )));
    fileList.hidden = !state.files.length;
    fileInput.disabled = state.files.length >= MAX_FILES;
  };

  fileInput.addEventListener('change', async () => {
    const errors = [];
    const accepted = [];
    [...fileInput.files].forEach((file) => {
      if (state.files.length + accepted.length >= MAX_FILES) {
        if (!errors.includes(MESSAGES.fileCount)) errors.push(MESSAGES.fileCount);
      } else if (!FILE_TYPES.test(file.name)) errors.push(`${file.name}: ${MESSAGES.fileType}`);
      else if (file.size > MAX_FILE_BYTES) errors.push(`${file.name}: ${MESSAGES.fileSize}`);
      else accepted.push(file);
    });
    const contents = await Promise.all(accepted.map(readFile));
    accepted.forEach((file, i) => {
      state.files.push({
        name: file.name, date: new Date().toLocaleDateString(), content: contents[i],
      });
    });
    fileInput.value = '';
    renderFiles();
    setFileError(errors.join('. '));
    if (accepted.length) {
      announce(`${accepted.length} file${accepted.length > 1 ? 's' : ''} added`);
      track('warranty_doc_uploaded', { numberOfDocs: state.files.length });
    }
  });

  /* ---- result ---- */
  const result = el('div', { className: 'wr-panel wr-result', hidden: true });

  /* ---- navigation ---- */
  const panels = [customerForm, productForm, billingForm];
  const goTo = (step) => {
    state.step = step;
    panels.forEach((panel, i) => { panel.hidden = i !== step; });
    result.hidden = true;
    progress.hidden = false;
    stepItems.forEach((item, i) => {
      item.classList.toggle('wr-done', i < step);
      if (i === step) item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
      item.querySelector('.wr-step-state').textContent = i < step ? ' (completed)' : '';
    });
    panels[step].querySelector('h3').focus();
  };

  const backButton = (step) => el('button', {
    type: 'button', className: 'wr-button wr-secondary', text: 'Back', onclick: () => goTo(step),
  });
  productForm.querySelector('.wr-actions').prepend(backButton(0));
  billingForm.querySelector('.wr-actions').prepend(backButton(1));

  customerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!customerValid(true)) {
      customerForm.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }
    if (!state.verified) {
      if (state.otpSent) {
        otp.setError(MESSAGES.otp);
        otp.control.focus();
      } else {
        customer.mobileNumber.setError('Verify your mobile number with an OTP to continue');
        getOtp.focus();
      }
      return;
    }
    track('warranty_step1');
    track('form_submit', {
      formName: 'Warranty Registration Form', pincode: customer.pincode.value, whatsappOptIn: '', contruction: '', localpainter: '', campaignId: '',
    });
    goTo(1);
    loadCatalogue();
  });

  productForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const canSkipEditor = editorEmpty() && state.editing === null && state.products.length;
    if (!canSkipEditor && !commitEditor()) return;
    if (!terms.checked) {
      termsError.textContent = MESSAGES.terms;
      termsError.hidden = false;
      terms.setAttribute('aria-invalid', 'true');
      terms.focus();
      return;
    }
    track('warranty_step2', { warrantyStep2Details: `${state.products.length} || ${state.products.map((i) => i.product).join(' | ')}` });
    goTo(2);
  });
  terms.addEventListener('change', () => {
    if (terms.checked) {
      termsError.hidden = true;
      terms.removeAttribute('aria-invalid');
    }
  });

  const productLines = (item) => [
    item.productCode && {
      Product_Code: item.productCode, Quantity: item.productQuantity, Shade_Code: item.shadeCode || '', isPrimary: 'true', Unit: item.productQuantityUnit,
    },
    item.undercoatCode && {
      Product_Code: item.undercoatCode, Quantity: item.undercoatQuantity, Shade_Code: '', isPrimary: 'false', Unit: item.undercoatQuantityUnit,
    },
  ].filter(Boolean);

  const showResult = () => {
    const done = state.results.every((r) => r?.ok);
    const name = customer.fullName.value;
    panels.forEach((panel) => { panel.hidden = true; });
    progress.hidden = true;
    const heading = el('h3', { tabindex: '-1', text: done ? 'Registration complete' : 'Registration failed' });
    const ids = state.results.filter((r) => r?.id);
    result.className = `wr-panel wr-result ${done ? 'wr-success' : 'wr-failure'}`;
    result.replaceChildren(
      heading,
      el('p', { className: 'wr-strong', text: `Dear ${name},` }),
      ...(done ? [
        el('p', { text: 'Thank you for choosing Asian Paints. We’re delighted to have you as a valued customer.' }),
        el('p', { text: 'Your warranty registration has been successfully submitted and is currently under the verification process.' }),
        el('p', { text: 'You will receive an update on the same within 48 working hours.' }),
      ] : [
        el('p', { text: 'Some error occurred during submission, please try again.' }),
      ]),
      ids.length ? el('ul', { className: 'wr-ids', 'aria-label': 'Warranty numbers' }, ids.map((r) => el('li', {}, `${r.product}: `, el('strong', { text: r.id })))) : null,
      done ? el('p', {}, 'For more information, please visit our website ', el('a', { href: 'https://www.asianpaints.com', text: 'www.asianpaints.com' }), ' or call ', el('a', { href: 'tel:18002095678', text: '1800-209-5678' }), '.') : el('div', { className: 'wr-actions' }, el('button', {
        type: 'button', className: 'wr-button wr-primary', text: 'Try again', onclick: () => goTo(2),
      })),
    );
    result.hidden = false;
    heading.focus();
    announce(done ? 'Registration complete' : 'Registration failed');
  };

  billingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fieldsOk = Object.values(billing).map((f) => f.check(true)).every(Boolean);
    if (!state.files.length) setFileError(MESSAGES.filesRequired, true);
    if (!fieldsOk || !state.files.length) {
      billingForm.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }
    submit.disabled = true;
    submit.setAttribute('aria-busy', 'true');
    submit.textContent = 'Submitting…';
    announce('Submitting your registration');
    try {
      const plain = [
        customer.mobileNumber, customer.emailId, customer.fullName, customer.address,
        customer.city, customer.pincode, billing.dealerName, billing.dealerMobileNo,
        billing.contractorName, billing.contractorMobileNo,
      ].map((f) => f.value);
      const [
        phone, email, customerName, street, city, postalCode,
        dealerName, dealerPhone, contractorName, contractorPhone,
      ] = await Promise.all(plain.map(encrypt));
      const base = {
        Phone: phone,
        Email: email,
        Customer_Name: customerName,
        street,
        city,
        state: '',
        Country: 'India',
        Postal_Code: postalCode,
        Source: 'Website',
        Dealer_Name: dealerName,
        Dealer_Phone: dealerPhone,
        Contractor_Name: contractorName,
        Contractor_Phone: contractorPhone,
        file: state.files.map((f) => ({ FileContent: f.content, FileName: f.name })),
      };
      // one call per product; on retry only the products that failed are sent again
      await Promise.all(state.products.map(async (item, i) => {
        if (state.results[i]?.ok) return;
        try {
          const response = await api.register({
            ...base, Serial_No: String(i), product: productLines(item),
          });
          const id = response?.Warranty_Id;
          state.results[i] = { ok: Boolean(id), id, product: item.product };
        } catch {
          state.results[i] = { ok: false, product: item.product };
        }
      }));
      state.results.length = state.products.length;
    } catch {
      state.products.forEach((item, i) => {
        state.results[i] = state.results[i] || { ok: false, product: item.product };
      });
    }
    track('warranty_complete');
    submit.disabled = false;
    submit.removeAttribute('aria-busy');
    submit.textContent = 'Submit';
    showResult();
  });

  /* ---- mount ---- */
  root = el(
    'section',
    { className: 'warranty-registration', 'aria-labelledby': `${prefix}-title` },
    title,
    progress,
    status,
    customerForm,
    productForm,
    billingForm,
    result,
  );
  title.id = `${prefix}-title`;
  container.replaceChildren(root);
  container.classList.add('warranty-container-banner-form');
  resetEditor();
  renderProducts();
  renderFiles();
  goTo(0);
  title.focus();
  // fetch the catalogue early so step 2 is ready, as the source does
  loadCatalogue();
}
