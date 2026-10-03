/**
 * Budget Calculator (WBC) — a 3-screen waterproofing quotation calculator.
 * All copy is authored in DA; recommendations come from the waterproofing
 * endpoint. Screen 2 (the lead form) works exactly like the PBC block's.
 *
 * Authoring: every row is `key | value`. A single-cell marker row reading
 * "Step 1", "Step 2" or "Step 3" starts that screen's rows; rows before the
 * first marker (e.g. Background, Endpoint) are shared.
 *
 * Shared
 *   Background           | desktop image | mobile image
 *   Endpoint             | https://…/paintBudgetCalculator.waterproofing.json
 *   Sample Data Fallback | true | false   (use bundled responses if the API fails)
 *
 * Step 1 — project details
 *   Title | WaterProofing Calculator   Subtitle | …
 *   Surface Title | Select your surface *
 *   Surface | icon | Terrace/Roof | Terrace or Roof   (repeat; icon | label |
 *                                                       value sent to the API,
 *                                                       which defaults to the label)
 *   Question | Select your type of project * | • Fresh Construction • … | • Fresh Painting • …
 *                                              (labels | optional API values)
 *   Area Label | …   Area Placeholder | …   Minimum Area | 100   Area Error | …
 *   CTA | Calculate now
 *
 * Step 2 — lead form (skipped once it has been submitted on this browser)
 *   Title | Your estimate **is almost ready**   Subtitle | …
 *   Field | Name * | Your Full Name             (label | placeholder; the type is
 *                                               inferred from the label)
 *   WhatsApp | Get updates on WhatsApp
 *   Question | When do you plan to start with the painting? * | • … • …
 *   Consent | rich text with links
 *   Required Error | …   Invalid Error | …   CTA | …   Skip Form | true | false
 *
 * Step 3 — recommendations
 *   Calculate Again | …   Title | …   Subtitle | … (mobile)   Description | rich text + list
 *   Card Title | …   Warranty Text | … {warranty} …   Cost Label | … {area} …
 *   Per Sqft Label | …   View Product | …   Products Title | …
 *   Disclaimer | …   PDF Text | …   PDF CTA | …   Results Error | …
 *
 * PDF — generated in the browser; lists every recommended system
 *   Logo | image   Greeting | Dear   Default Name | Customer   Header Text | …
 *   Mobile Label | …   Email Label | …   Badge | Recommended Solution
 *   Warranty Logo | image   Warranty Labels | Upto | Warranty
 *   Product Subtitle | …   Cost Label | …{area}…   Steps Title | …
 *   Step Label | STEP   Coat Labels | COAT | COATS
 *   Layer Labels | PRIMER | PUTTY | FINAL LAYER   Disclaimer | …   Phone | …
 *   Call Text | … {phone}   Why Title | …   How Title | …   Plans Title | …
 *   Why Item | icon | title | description   (repeat; same for How Item)
 *   Plan | icon | name | "Included" + list, "Warranty" + list   (repeat)
 *   Plans Phone | 1800-266-2090   Plans Call Text | … {phone} …   File Name | …
 *   Systems | all (default) | selected
 *   Loading Text | …   Ready Text | …   Open Text | … (iOS)   Error Text | …
 *   Error Duration | 5 (seconds)
 */

const ASSET_HOST = 'https://www.asianpaints.com';
const DEFAULT_ENDPOINT = `${ASSET_HOST}/apcolourcatalogue/paintBudgetCalculator.waterproofing.json`;
// Fixed request parameters the waterproofing endpoint expects (from the live
// calculator); the answers add area, paint (project type) and surface.
const REQUEST_DEFAULTS = {
  category: '', language: 'en', apltype: 'APL_WEB', multiplierValue: '1',
};
const FORM_DONE_KEY = 'budget-calculator-wbc:form-submitted';
const CONTACT_KEY = 'budget-calculator-wbc:contact';
const STEP_KEYS = ['stepOne', 'stepTwo', 'stepThree', 'stepFour'];

let uid = 0;

function slug(text) {
  return text.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Rich text from a DA cell; bold/italic runs become the highlight colour.
function highlightHTML(cell) {
  const clone = (cell.querySelector('p') || cell).cloneNode(true);
  clone.querySelectorAll('strong, b, em').forEach((b) => {
    const span = el('span', 'budget-calculator-wbc-highlight');
    span.innerHTML = b.innerHTML;
    b.replaceWith(span);
  });
  return clone.innerHTML;
}

// Label text with a trailing "*" wrapped so it can be styled separately.
function labelWithMark(node, text) {
  const match = text.match(/^(.*?)\s*\*$/);
  node.textContent = match ? `${match[1]} ` : text;
  if (match) node.append(el('span', 'budget-calculator-wbc-mark', '*'));
  return node;
}

function fill(template, values) {
  return template.replace(/\{(\w+)\}/g, (m, key) => (key in values ? values[key] : m));
}

function toAssetUrl(path, page) {
  const clean = (path || '').trim();
  if (!clean) return '';
  if (/^https?:\/\//.test(clean)) return clean;
  // Product paths from the API sometimes omit ".html" and 404 without it.
  const withExt = page && !/\.html$/.test(clean) ? `${clean}.html` : clean;
  return ASSET_HOST + withExt;
}

/* ------------------------------------------------------------ authoring */

function splitSteps(rows) {
  const groups = {
    shared: [], 1: [], 2: [], 3: [], pdf: [],
  };
  let current = 'shared';
  rows.forEach((row) => {
    const text = row.textContent.trim();
    const marker = row.children.length <= 1 && text.match(/^(?:step\s*(\d)|(pdf))$/i);
    if (marker) {
      current = marker[1] || 'pdf';
      return;
    }
    (groups[current] || groups.shared).push(row);
  });
  return groups;
}

const listItems = (cell) => (cell ? [...cell.querySelectorAll('li')].map((li) => li.textContent.trim()) : []);

// Reads `key | value [| value]` rows. Repeatable keys (Question, Surface,
// Field and the PDF's Why Item / How Item / Plan) are collected as lists;
// everything else keeps the last authored value.
function readRows(rows) {
  const cfg = {
    questions: [], surfaces: [], fields: [], 'why-item': [], 'how-item': [], plan: [],
  };
  rows.forEach((row) => {
    const cells = [...row.children];
    if (cells.length < 2) return;
    const key = slug(cells[0].textContent);
    const value = cells[1];
    if (key === 'question') {
      // Options show the labels; an optional third list holds the values the
      // API expects, in the same order (e.g. "Fresh Construction" is sent as
      // "Fresh Painting").
      const values = listItems(cells[3]);
      const options = listItems(cells[2]).map((label, i) => ({ label, value: values[i] || label }));
      cfg.questions.push({ label: value.textContent.trim(), options });
    } else if (key === 'surface') {
      // | Surface | icon | label | API value (optional, defaults to the label) |
      const label = cells[2] ? cells[2].textContent.trim() : '';
      if (label) {
        cfg.surfaces.push({
          icon: value.querySelector('img'),
          label,
          value: (cells[3] && cells[3].textContent.trim()) || label,
        });
      }
    } else if (key === 'field') {
      cfg.fields.push({ label: value.textContent.trim(), placeholder: cells[2] ? cells[2].textContent.trim() : '' });
    } else if (key === 'background') {
      cfg.background = cells.slice(1).map((c) => c.querySelector('img')).filter(Boolean);
    } else if (key in cfg && Array.isArray(cfg[key])) {
      // | Why Item / How Item / Plan | icon | title | description (rich) |
      cfg[key].push({
        icon: value.querySelector('img'),
        title: cells[2] ? cells[2].textContent.trim() : '',
        body: cells[3] || null,
      });
    } else {
      cfg[key] = { text: value.textContent.trim(), cell: value, cells: cells.slice(1) };
    }
  });
  return cfg;
}

const copy = (cfg, key, fallback = '') => (cfg[key] && cfg[key].text) || fallback;

/* ------------------------------------------------------------ form parts */

// Label, arrow icon and the loader shown in place of the arrow while busy.
function ctaContent(label) {
  const icon = el('span', 'budget-calculator-wbc-cta-icon');
  const spinner = el('span', 'budget-calculator-wbc-cta-spinner');
  icon.setAttribute('aria-hidden', 'true');
  spinner.setAttribute('aria-hidden', 'true');
  return [el('span', 'budget-calculator-wbc-cta-label', label), icon, spinner];
}

function buildRadioGroup(question, name) {
  const group = el('fieldset', 'budget-calculator-wbc-radio-group');
  group.append(labelWithMark(el('legend', 'budget-calculator-wbc-radio-title'), question.label));
  const options = el('div', 'budget-calculator-wbc-radio-options');
  question.options.forEach(({ label, value }) => {
    uid += 1;
    const id = `wbc-${name}-${uid}`;
    const option = el('label', 'budget-calculator-wbc-radio');
    option.htmlFor = id;
    const input = el('input');
    Object.assign(input, {
      type: 'radio', name, id, value, required: true,
    });
    option.append(input, el('span', 'budget-calculator-wbc-radio-text', label));
    options.append(option);
  });
  group.append(options);
  return group;
}

// Surface choice: a row of tiles (icon + label), each a radio button. The
// radio itself is visually hidden; the tile shows the checked state.
function buildSurfaceGroup(title, surfaces, name) {
  const group = el('fieldset', 'budget-calculator-wbc-radio-group budget-calculator-wbc-surfaces');
  group.append(labelWithMark(el('legend', 'budget-calculator-wbc-radio-title'), title));
  const options = el('div', 'budget-calculator-wbc-surface-options');
  surfaces.forEach(({ icon, label, value }) => {
    uid += 1;
    const id = `wbc-${name}-${uid}`;
    const tile = el('label', 'budget-calculator-wbc-surface');
    tile.htmlFor = id;
    const input = el('input', 'budget-calculator-wbc-surface-input');
    Object.assign(input, {
      type: 'radio', name, id, value, required: true,
    });
    const media = el('span', 'budget-calculator-wbc-surface-icon');
    if (icon) {
      const img = el('img');
      img.className = 'budget-calculator-wbc-surface-img';
      Object.assign(img, { src: icon.currentSrc || icon.src, alt: '', loading: 'lazy' });
      media.append(img);
    }
    tile.append(input, media, el('span', 'budget-calculator-wbc-surface-label', label));
    options.append(tile);
  });
  group.append(options);
  return group;
}

function fieldConfig(labelSlug) {
  if (labelSlug.includes('email')) {
    return { type: 'email', autocomplete: 'email', pattern: '[^@\\s]+@[^@\\s]+\\.[^@\\s]+' };
  }
  if (labelSlug.includes('mobile') || labelSlug.includes('phone')) {
    return {
      type: 'tel', autocomplete: 'tel-national', inputMode: 'numeric', pattern: '[6-9]\\d{9}', maxLength: 10, prefix: '+91',
    };
  }
  if (labelSlug.includes('pin')) {
    return {
      type: 'text', autocomplete: 'postal-code', inputMode: 'numeric', pattern: '\\d{6}', maxLength: 6,
    };
  }
  return { type: 'text', autocomplete: 'name' };
}

function buildField({ label, placeholder }) {
  const cfg = fieldConfig(slug(label));
  uid += 1;
  const id = `wbc-field-${uid}`;
  const field = el('div', 'budget-calculator-wbc-field');
  const control = el('div', 'budget-calculator-wbc-control');
  // The label floats onto the border once the field is focused or filled.
  const floating = labelWithMark(el('label', 'budget-calculator-wbc-float-label'), label);
  floating.htmlFor = id;
  if (cfg.prefix) control.append(el('span', 'budget-calculator-wbc-prefix', cfg.prefix));
  const input = el('input');
  input.id = id;
  input.name = slug(label.replace('*', '')) || id;
  input.type = cfg.type;
  input.placeholder = placeholder || ' ';
  input.required = true;
  input.autocomplete = cfg.autocomplete;
  if (cfg.inputMode) input.inputMode = cfg.inputMode;
  if (cfg.pattern) input.pattern = cfg.pattern;
  if (cfg.maxLength) input.maxLength = cfg.maxLength;
  if (cfg.inputMode === 'numeric') {
    input.addEventListener('input', () => { input.value = input.value.replace(/\D/g, ''); });
  }
  const error = el('p', 'budget-calculator-wbc-error');
  error.id = `${id}-error`;
  input.setAttribute('aria-describedby', error.id);
  control.append(input, floating);
  field.append(control, error);
  return field;
}

// Height covered at the top of the viewport by fixed or sticky elements
// (the site header and nav bars), found by probing down from the top edge
// until a point is no longer covered by one.
function pinnedBottom(y, block) {
  let bottom = 0;
  [0.1, 0.5, 0.9].forEach((x) => {
    document.elementsFromPoint(window.innerWidth * x, y).forEach((node) => {
      for (let n = node; n && n !== document.body && !n.contains(block); n = n.parentElement) {
        const { position } = getComputedStyle(n);
        if (position === 'fixed' || position === 'sticky') {
          bottom = Math.max(bottom, n.getBoundingClientRect().bottom);
          break;
        }
      }
    });
  });
  return bottom;
}

function headerOverlap(block) {
  let bottom = 0;
  for (let probe = 0; probe < 5; probe += 1) {
    const next = pinnedBottom(bottom + 1, block);
    if (next <= bottom) break;
    bottom = next;
  }
  return Math.min(bottom, window.innerHeight / 2);
}

/* -------------------------------------------------------------- screen 1 */

function buildScreen1(cfg) {
  const screen = el('section', 'budget-calculator-wbc-screen budget-calculator-wbc-details');
  screen.dataset.screen = '1';

  const intro = el('div', 'budget-calculator-wbc-intro');
  if (cfg.title) {
    const title = el('h2', 'budget-calculator-wbc-title');
    title.innerHTML = highlightHTML(cfg.title.cell);
    title.tabIndex = -1;
    intro.append(title);
  }
  if (cfg.subtitle) intro.append(el('p', 'budget-calculator-wbc-subtitle', cfg.subtitle.text));

  const form = el('form', 'budget-calculator-wbc-details-form');
  form.noValidate = true;
  if (cfg['step-indicator']) form.append(el('p', 'budget-calculator-wbc-step', cfg['step-indicator'].text));

  // The surface tiles come first, then the project type (sent as "paint").
  const names = ['surface'];
  if (cfg.surfaces.length) {
    form.append(buildSurfaceGroup(copy(cfg, 'surface-title', 'Select your surface *'), cfg.surfaces, 'surface'));
  }
  cfg.questions.forEach((q, i) => {
    const name = i === 0 ? 'paint' : `question-${i}`;
    names.push(name);
    form.append(buildRadioGroup(q, name));
  });
  if (!cfg.surfaces.length) names.shift();

  const min = Number(copy(cfg, 'minimum-area', '100')) || 100;
  uid += 1;
  const areaId = `wbc-area-${uid}`;
  const area = el('div', 'budget-calculator-wbc-area');
  const areaLabel = labelWithMark(el('label', 'budget-calculator-wbc-area-label'), copy(cfg, 'area-label', 'Enter area for waterproofing in SQFT *'));
  areaLabel.htmlFor = areaId;
  const areaInput = el('input', 'budget-calculator-wbc-area-input');
  Object.assign(areaInput, {
    id: areaId,
    name: 'area',
    type: 'text',
    inputMode: 'numeric',
    required: true,
    placeholder: copy(cfg, 'area-placeholder', 'Area in SQFT'),
  });
  const areaError = el('p', 'budget-calculator-wbc-error', '');
  areaError.id = `${areaId}-error`;
  areaInput.setAttribute('aria-describedby', areaError.id);
  area.append(areaLabel, areaInput, areaError);
  form.append(area);

  const cta = el('button', 'budget-calculator-wbc-cta');
  cta.type = 'submit';
  cta.disabled = true;
  cta.append(...ctaContent(copy(cfg, 'cta', 'Calculate now')));
  form.append(cta);

  const areaValue = () => Number(areaInput.value || 0);
  const update = () => {
    areaInput.value = areaInput.value.replace(/\D/g, '');
    const tooSmall = areaInput.value !== '' && areaValue() < min;
    areaError.textContent = tooSmall
      ? copy(cfg, 'area-error', `To calculate, please enter a minimum of ${min} sqft.`) : '';
    areaInput.setAttribute('aria-invalid', String(tooSmall));
    const answered = names.every((name) => form.querySelector(`input[name="${name}"]:checked`));
    cta.disabled = !(answered && areaValue() >= min);
  };
  form.addEventListener('input', update);
  form.addEventListener('change', update);

  const answers = () => ({
    area: String(areaValue()),
    paint: form.querySelector('input[name="paint"]:checked')?.value || '',
    surface: form.querySelector('input[name="surface"]:checked')?.value || '',
  });

  screen.append(intro, form);
  return {
    screen, form, cta, answers,
  };
}

/* -------------------------------------------------------------- screen 2 */

function buildScreen2(cfg) {
  const screen = el('section', 'budget-calculator-wbc-screen budget-calculator-wbc-lead');
  screen.dataset.screen = '2';

  const intro = el('div', 'budget-calculator-wbc-intro');
  if (cfg.title) {
    const title = el('h2', 'budget-calculator-wbc-title');
    title.innerHTML = highlightHTML(cfg.title.cell);
    title.tabIndex = -1;
    intro.append(title);
  }
  if (cfg.subtitle) intro.append(el('p', 'budget-calculator-wbc-subtitle', cfg.subtitle.text));

  const form = el('form', 'budget-calculator-wbc-lead-form');
  form.noValidate = true;

  const fields = el('div', 'budget-calculator-wbc-fields');
  cfg.fields.forEach((f) => fields.append(buildField(f)));
  form.append(fields);

  if (cfg.whatsapp) {
    const optin = el('label', 'budget-calculator-wbc-checkbox');
    const box = el('input');
    Object.assign(box, { type: 'checkbox', name: 'whatsapp-optin', checked: true });
    optin.append(box, el('span', '', cfg.whatsapp.text));
    form.append(optin);
  }

  if (cfg.questions.length) {
    const questions = el('div', 'budget-calculator-wbc-lead-questions');
    cfg.questions.forEach((q, i) => {
      const group = buildRadioGroup(q, `lead-question-${i}`);
      group.append(el('p', 'budget-calculator-wbc-error'));
      questions.append(group);
    });
    form.append(questions);
  }

  if (cfg.consent) {
    const consent = el('p', 'budget-calculator-wbc-consent');
    consent.innerHTML = (cfg.consent.cell.querySelector('p') || cfg.consent.cell).innerHTML;
    consent.querySelectorAll('a').forEach((a) => { a.target = '_blank'; a.rel = 'noopener noreferrer'; });
    form.append(consent);
  }

  const cta = el('button', 'budget-calculator-wbc-cta budget-calculator-wbc-cta-submit');
  cta.type = 'submit';
  cta.append(...ctaContent(copy(cfg, 'cta', 'View recommendations')));
  form.append(cta);

  const required = copy(cfg, 'required-error', 'Field is required');
  const invalid = copy(cfg, 'invalid-error', 'Please enter a valid value');
  const setError = (holder, message) => {
    const error = holder.querySelector(':scope > .budget-calculator-wbc-error');
    if (error) error.textContent = message;
    holder.classList.toggle('is-invalid', Boolean(message));
  };

  // Checks one text field and shows (or clears) its error in place.
  const validateField = (field) => {
    const input = field.querySelector('input');
    let message = '';
    if (!input.value.trim()) message = required;
    else if (!input.checkValidity()) message = invalid;
    setError(field, message);
    input.setAttribute('aria-invalid', String(Boolean(message)));
    return !message;
  };

  // Validates every field and question, showing each error in place.
  const validate = () => {
    let firstInvalid = null;
    form.querySelectorAll('.budget-calculator-wbc-field').forEach((field) => {
      if (!validateField(field) && !firstInvalid) firstInvalid = field.querySelector('input');
    });
    form.querySelectorAll('.budget-calculator-wbc-lead-questions .budget-calculator-wbc-radio-group').forEach((group) => {
      const checked = group.querySelector('input:checked');
      setError(group, checked ? '' : required);
      if (!checked && !firstInvalid) firstInvalid = group.querySelector('input');
    });
    if (firstInvalid) firstInvalid.focus();
    return !firstInvalid;
  };

  // A field is checked as soon as the user leaves it, and while it shows an
  // error it is re-checked on every keystroke, so the error clears once fixed.
  form.addEventListener('focusout', (e) => {
    const field = e.target.closest('.budget-calculator-wbc-field');
    if (field) validateField(field);
  });
  form.addEventListener('input', (e) => {
    const field = e.target.closest('.budget-calculator-wbc-field');
    if (field && field.classList.contains('is-invalid')) validateField(field);
  });
  form.addEventListener('change', (e) => {
    const group = e.target.closest('.budget-calculator-wbc-radio-group');
    if (group) setError(group, '');
  });

  const data = () => Object.fromEntries(new FormData(form).entries());

  screen.append(intro, form);
  return {
    screen, form, cta, validate, data, skip: copy(cfg, 'skip-form').toLowerCase() === 'true',
  };
}

/* -------------------------------------------------------------- screen 3 */

function parseStep(raw) {
  if (!raw || !raw.trim()) return null;
  const parts = raw.split('|').map((p) => p.trim());
  const [, coats, name] = parts[0].match(/^(\d+)\s+(.*)$/) || [null, '', parts[0]];
  return {
    name,
    coats: Number(coats) || 0,
    image: toAssetUrl(parts[1]),
    link: toAssetUrl(parts[2], true),
  };
}

// The waterproofing endpoint prices a system by its MRP; bhpsCost and
// totalCostPerSqFt are used when present, as on the live calculator.
function systemCost(system) {
  return {
    cost: Number(system.bhpsCost || system.mrp) || 0,
    perSqft: Number(system.totalCostPerSqFt || system.pricePerSqFt) || 0,
  };
}

function buildScreen3(cfg, onPdf) {
  const screen = el('section', 'budget-calculator-wbc-screen budget-calculator-wbc-results');
  screen.dataset.screen = '3';

  const again = el('button', 'budget-calculator-wbc-again');
  again.type = 'button';
  again.append(el('span', '', copy(cfg, 'calculate-again', 'Calculate again')));

  const info = el('div', 'budget-calculator-wbc-info');
  const title = el('h2', 'budget-calculator-wbc-info-title', copy(cfg, 'title', 'Our expert recommendation'));
  title.tabIndex = -1;
  info.append(title);
  if (cfg.subtitle) info.append(el('p', 'budget-calculator-wbc-info-subtitle', cfg.subtitle.text));
  const description = cfg.description ? cfg.description.cell.innerHTML : '';
  if (description) {
    const desc = el('div', 'budget-calculator-wbc-info-description');
    desc.innerHTML = description;
    info.append(desc);
  }

  const aside = el('div', 'budget-calculator-wbc-info-column');
  aside.append(again.cloneNode(true), info);

  const carousel = el('div', 'budget-calculator-wbc-carousel');
  carousel.setAttribute('aria-roledescription', 'carousel');
  const prev = el('button', 'budget-calculator-wbc-nav budget-calculator-wbc-nav-prev');
  prev.type = 'button';
  prev.setAttribute('aria-label', 'Previous recommendation');
  const next = el('button', 'budget-calculator-wbc-nav budget-calculator-wbc-nav-next');
  next.type = 'button';
  next.setAttribute('aria-label', 'Next recommendation');
  const stack = el('div', 'budget-calculator-wbc-stack');
  const status = el('p', 'budget-calculator-wbc-sr-only');
  status.setAttribute('aria-live', 'polite');
  const mobileNav = el('div', 'budget-calculator-wbc-mobile-nav');
  mobileNav.append(again);
  carousel.append(prev, stack, next, mobileNav, status);

  screen.append(aside, carousel);

  const L = {
    card: copy(cfg, 'card-title', 'Best recommended solution'),
    warranty: copy(cfg, 'warranty-text', 'Get waterproofing with upto {warranty} warranty'),
    cost: copy(cfg, 'cost-label', 'Total Estimated cost for {area} sqft'),
    perSqft: copy(cfg, 'per-sqft-label', 'Per SQFT cost'),
    view: copy(cfg, 'view-product', 'View product'),
    products: copy(cfg, 'products-title', 'Products included in this solution'),
    disclaimer: copy(cfg, 'disclaimer', 'The total estimated product cost may vary based on the chosen shade and finish.'),
    pdfText: copy(cfg, 'pdf-text', 'Download the PDF to get more details about the waterproofing process & products.'),
    pdfCta: copy(cfg, 'pdf-cta', 'Download PDF'),
    error: copy(cfg, 'results-error', 'We couldn’t load your recommendations. Please try again.'),
  };

  const viewLink = (href) => {
    const a = el('a', 'budget-calculator-wbc-view', L.view);
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    return a;
  };

  function buildCard(system, area) {
    const card = el('article', 'budget-calculator-wbc-card');
    const name = system.entityName || system.title || '';
    const { cost, perSqft } = systemCost(system);

    card.append(el('h3', 'budget-calculator-wbc-card-title', L.card));

    const media = el('div', 'budget-calculator-wbc-card-media');
    if (system.swatchImage) {
      const img = el('img');
      Object.assign(img, { src: toAssetUrl(system.swatchImage), alt: name, loading: 'lazy' });
      media.append(img);
    }
    card.append(media, el('p', 'budget-calculator-wbc-card-name', name));
    // Warranty line, e.g. "Get waterproofing with upto 05 Years warranty".
    // Without a warranty the line keeps its space so cards line up.
    const warranty = el('p', 'budget-calculator-wbc-card-warranty', system.warranty ? fill(L.warranty, { warranty: system.warranty }) : '');
    if (!system.warranty) warranty.classList.add('is-empty');
    card.append(warranty);

    const prices = el('dl', 'budget-calculator-wbc-prices');
    const row = (label, value, mark) => {
      const dd = el('dd', '', value);
      if (mark) dd.append(el('span', 'budget-calculator-wbc-mark', '*'));
      prices.append(el('dt', '', label), dd);
    };
    row(fill(L.cost, { area }), `Rs.${cost.toFixed(2)}`, true);
    row(L.perSqft, `Rs.${perSqft.toFixed(2)}`);
    card.append(prices);

    if (system.pageUrl) card.append(viewLink(toAssetUrl(system.pageUrl, true)));

    // Products in the solution, in application order: name, packshot and link.
    const steps = STEP_KEYS.map((k) => parseStep(system[k])).filter(Boolean);
    if (steps.length) {
      const products = el('div', 'budget-calculator-wbc-products');
      products.append(el('h4', 'budget-calculator-wbc-products-title', L.products));
      const list = el('ol', 'budget-calculator-wbc-products-list');
      steps.forEach((step) => {
        const item = el('li', 'budget-calculator-wbc-product');
        if (step.coats) item.dataset.coats = step.coats;
        item.append(el('p', 'budget-calculator-wbc-product-name', step.name));
        const packshot = el('div', 'budget-calculator-wbc-product-media');
        if (step.image) {
          const img = el('img');
          Object.assign(img, { src: step.image, alt: '', loading: 'lazy' });
          packshot.append(img);
        }
        item.append(packshot);
        if (step.link) item.append(viewLink(step.link));
        list.append(item);
      });
      products.append(list);
      card.append(products);
    }

    const disclaimer = el('p', 'budget-calculator-wbc-disclaimer');
    disclaimer.append(el('span', 'budget-calculator-wbc-mark', '*'), L.disclaimer);
    card.append(disclaimer);

    // The Step 3 description is repeated inside the card for mobile.
    if (description) {
      const includes = el('div', 'budget-calculator-wbc-card-includes');
      includes.innerHTML = description;
      card.append(includes);
    }

    // Download PDF: generates a PDF from this card's recommendation. While it
    // is prepared, a small spinner shows inside the button, next to the icon.
    const pdf = el('div', 'budget-calculator-wbc-pdf');
    pdf.append(el('p', '', system.pdfText || L.pdfText));
    const pdfButton = el('button', 'budget-calculator-wbc-pdf-cta');
    pdfButton.type = 'button';
    const icon = el('span', 'budget-calculator-wbc-pdf-icon');
    const spinner = el('span', 'budget-calculator-wbc-pdf-spinner');
    icon.setAttribute('aria-hidden', 'true');
    spinner.setAttribute('aria-hidden', 'true');
    pdfButton.append(el('span', 'budget-calculator-wbc-pdf-label', system.pdfCtaText || L.pdfCta), icon, spinner);
    pdfButton.addEventListener('click', () => onPdf(system, pdfButton));
    const pdfStatus = el('p', 'budget-calculator-wbc-sr-only');
    pdfStatus.setAttribute('aria-live', 'polite');
    pdf.append(pdfButton, el('p', 'budget-calculator-wbc-pdf-error'), pdfStatus);
    card.append(pdf);
    return card;
  }

  let index = 0;
  let cards = [];

  // Every card is as tall as the tallest one, so moving between cards never
  // changes the layout height (which made the results screen jump).
  function normalizeHeights() {
    if (!cards.length) {
      stack.style.height = '';
      return;
    }
    stack.classList.add('is-measuring');
    const tallest = Math.max(...cards.map((card) => card.offsetHeight));
    stack.classList.remove('is-measuring');
    if (tallest) stack.style.height = `${tallest}px`;
  }

  // Re-measure when the stack's width changes: on resize, and when the
  // results screen is shown (its width goes from 0 while hidden).
  let stackWidth = -1;
  new ResizeObserver(([entry]) => {
    const { width } = entry.contentRect;
    if (width === stackWidth) return;
    stackWidth = width;
    if (width) normalizeHeights();
  }).observe(stack);
  if (document.fonts) document.fonts.ready.then(normalizeHeights);

  // Position every card relative to the active one: the two after it peek
  // out beneath it and the rest wait "out" below the stack. Moving between
  // these states is animated in CSS, so the incoming card rises from the
  // bottom of the stack. Inactive cards are inert.
  function show(i) {
    index = Math.max(0, Math.min(i, cards.length - 1));
    cards.forEach((card, n) => {
      const offset = n - index;
      card.dataset.position = offset >= 0 && offset < 3 ? String(offset) : 'out';
      card.inert = offset !== 0;
    });
    prev.disabled = index === 0;
    next.disabled = index >= cards.length - 1;
    status.textContent = cards.length ? `${index + 1} of ${cards.length}` : '';
  }
  prev.addEventListener('click', () => show(index - 1));
  next.addEventListener('click', () => show(index + 1));

  // Swipe between cards on touch screens.
  let touchX = null;
  stack.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  stack.addEventListener('touchend', (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 40) show(index + (dx < 0 ? 1 : -1));
    touchX = null;
  });

  function render(systems, area) {
    stack.textContent = '';
    cards = [...systems]
      .sort((a, b) => (Number(a.systemRank) || 0) - (Number(b.systemRank) || 0))
      .map((s) => buildCard(s, Number(area)));
    if (!cards.length) {
      stack.append(el('p', 'budget-calculator-wbc-results-error', L.error));
    }
    stack.append(...cards);
    carousel.classList.toggle('is-single', cards.length < 2);
    show(0);
    normalizeHeights();
  }

  function renderError() {
    cards = [];
    stack.textContent = '';
    stack.append(el('p', 'budget-calculator-wbc-results-error', L.error));
    show(0);
    normalizeHeights();
  }

  return {
    screen, againButtons: [again, aside.querySelector('.budget-calculator-wbc-again')], render, renderError, labels: L,
  };
}

/* ----------------------------------------------------------------- data */

// TEMP QA: the waterproofing endpoint only allows the www.asianpaints.com
// origin (CORS), so on EDS preview hosts the request fails. When "Sample Data
// Fallback" is true, real responses captured at 1200 sqft are scaled to the
// requested area (the MRP is linear in area; the per sqft cost is not
// affected). Remove once the endpoint allows the EDS origins.
async function sampleResponse({ area, paint, surface }) {
  const res = await fetch(`${window.hlx.codeBasePath}/blocks/budget-calculator-wbc/sample-response.json`);
  if (!res.ok) throw new Error(`sample HTTP ${res.status}`);
  const { baseArea, responses } = await res.json();
  const ratio = Number(area) / baseArea;
  return (responses[`${paint}|${surface}`] || []).map((s) => ({
    ...s, mrp: (Number(s.mrp) * ratio).toFixed(2),
  }));
}

async function fetchSystems(endpoint, answers, useSample) {
  const params = new URLSearchParams({ ...REQUEST_DEFAULTS, ...answers });
  try {
    const res = await fetch(`${endpoint}?${params}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error('unexpected response');
    return data;
  } catch (err) {
    if (!useSample) throw err;
    // eslint-disable-next-line no-console
    console.warn('budget-calculator-wbc: live request failed, using sample data', err);
    return sampleResponse(answers);
  }
}

function formDone() {
  try { return localStorage.getItem(FORM_DONE_KEY) === 'true'; } catch (e) { return false; }
}

function markFormDone() {
  try { localStorage.setItem(FORM_DONE_KEY, 'true'); } catch (e) { /* storage unavailable */ }
}

// Like the existing AEM tool (its CCFormFields cookie), the name, email and
// mobile from the lead form are remembered on this browser so later PDFs,
// made after the form is skipped, are still personalised. Nothing else from
// the form is kept, and it is never sent anywhere.
function savedContact() {
  try { return JSON.parse(localStorage.getItem(CONTACT_KEY)) || null; } catch (e) { return null; }
}

function saveContact(data) {
  const contact = Object.fromEntries(Object.entries(data)
    .filter(([key]) => /name|email|mobile|phone/.test(key)));
  try {
    localStorage.setItem(CONTACT_KEY, JSON.stringify(contact));
  } catch (e) { /* storage unavailable */ }
  return contact;
}

/* ----------------------------------------------------------------- block */

export default function decorate(block) {
  const groups = splitSteps([...block.children]);
  const shared = readRows(groups.shared);
  const pdfConfig = readRows(groups.pdf);
  // The lead's contact details personalise the PDF (greeting, mobile, email).
  let lead = savedContact();
  let results = { systems: [], area: '' };
  let step3 = null;

  // Download PDF on a card: the PDF module and its libraries load on demand.
  async function onPdf(system, button) {
    const { default: downloadPdf } = await import('./pdf.js');
    downloadPdf({
      block,
      button,
      system,
      systems: results.systems,
      area: results.area,
      config: pdfConfig,
      labels: step3.labels,
      lead,
    });
  }

  const step1 = buildScreen1(readRows(groups[1]));
  const step2 = buildScreen2(readRows(groups[2]));
  step3 = buildScreen3(readRows(groups[3]), onPdf);

  const endpoint = copy(shared, 'endpoint', DEFAULT_ENDPOINT);
  const useSample = copy(shared, 'sample-data-fallback').toLowerCase() === 'true';

  // Changing screens scrolls the block's top into view, just below any
  // fixed or sticky site header, so no part of the new screen is hidden.
  const go = (n) => {
    block.dataset.screen = String(n);
    const target = block.querySelector(`.budget-calculator-wbc-screen[data-screen="${n}"] [tabindex="-1"]`);
    if (target) target.focus({ preventScroll: true });
    const top = block.getBoundingClientRect().top + window.scrollY - headerOverlap(block);
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  };

  async function showResults(button) {
    const answers = step1.answers();
    button.disabled = true;
    button.classList.add('is-loading');
    block.setAttribute('aria-busy', 'true');
    try {
      const systems = await fetchSystems(endpoint, answers, useSample);
      results = { systems, area: answers.area };
      step3.render(systems, answers.area);
    } catch (err) {
      step3.renderError();
    } finally {
      button.disabled = false;
      button.classList.remove('is-loading');
      block.removeAttribute('aria-busy');
      go(3);
    }
  }

  step1.form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (step1.cta.disabled) return;
    if (step2.skip || formDone()) showResults(step1.cta);
    else go(2);
  });

  step2.form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!step2.validate()) return;
    markFormDone();
    lead = saveContact(step2.data());
    // Integration hook: the lead data is handed to whoever listens for it.
    block.dispatchEvent(new CustomEvent('budget-calculator-wbc:lead', {
      bubbles: true, detail: { ...step2.data(), ...step1.answers() },
    }));
    showResults(step2.cta);
  });

  step3.againButtons.forEach((btn) => btn.addEventListener('click', () => go(1)));

  const [desktopImg, mobileImg] = shared.background || [];
  const src = (img) => (img ? (img.currentSrc || img.src).split('?')[0] : '');
  block.textContent = '';
  if (desktopImg) block.style.setProperty('--bg-image-desktop', `url("${src(desktopImg)}")`);
  if (mobileImg || desktopImg) block.style.setProperty('--bg-image-mobile', `url("${src(mobileImg || desktopImg)}")`);
  block.dataset.screen = '1';
  block.append(step1.screen, step2.screen, step3.screen);
}
