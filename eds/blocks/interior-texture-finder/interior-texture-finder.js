/*
 * Interior Texture Finder
 * A multi-step recommendation journey: hero, room, light, theme, lead form and result.
 * All copy, images and settings come from the authored block table (see README.md);
 * the recommendations come from an authored sheet (json) keyed on room, light and theme.
 */

// sub-tables inside the block, recognised by their header row (first + second cell)
const TABLES = {
  type: { mode: 'content', second: 'title' },
  'form section': { mode: 'form', second: 'label' },
  'question id': { mode: 'question', second: 'question' },
  property: { mode: 'config', second: 'value' },
};

const STEPS = ['room', 'light', 'theme'];

const DEFAULT_ERRORS = {
  required: 'Field is required',
  name: 'Username is not valid',
  email: 'Email is invalid',
  mobile: 'Phone number is invalid',
  pincode: 'Enter a valid 6 digit PIN code',
};

const VALIDATORS = {
  name: (v) => /^[a-z][a-z ,.'-]{1,29}$/i.test(v),
  email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v),
  mobile: (v) => /^[6-9]\d{9}$/.test(v),
  pincode: (v) => /^[1-9]\d{5}$/.test(v),
};

// input behaviour per field type
const FIELD_TYPES = {
  name: {
    type: 'text', autocomplete: 'name', maxLength: 30, filter: /[^a-z ,.'-]/gi,
  },
  email: { type: 'email', autocomplete: 'email', maxLength: 80 },
  mobile: {
    type: 'tel', autocomplete: 'tel-national', inputMode: 'numeric', maxLength: 10, filter: /\D/g,
  },
  pincode: {
    type: 'text', autocomplete: 'postal-code', inputMode: 'numeric', maxLength: 6, filter: /\D/g,
  },
};

const text = (node) => (node ? node.textContent.trim() : '');
const norm = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
const propKey = (value) => norm(value).replace(/[\s_-]/g, '');
const isDesktop = () => window.matchMedia('(min-width: 992px)').matches;

// dark shades get light text so the shade name stays readable
function isDark(hex) {
  const match = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!match) return false;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(match[1].slice(i, i + 2), 16));
  return (r * 299 + g * 587 + b * 114) / 1000 < 140;
}

let uid = 0;
const nextId = (prefix) => {
  uid += 1;
  return `itf-${prefix}-${uid}`;
};

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([name, value]) => {
    if (value === undefined || value === null || value === false) return;
    if (name === 'class') node.className = value;
    else if (name === 'text') node.textContent = value;
    else node.setAttribute(name, value === true ? '' : value);
  });
  children.flat().forEach((child) => {
    if (child !== undefined && child !== null && child !== '') node.append(child);
  });
  return node;
}

function imageSrc(cell) {
  const img = cell && cell.querySelector('img');
  return img ? img.getAttribute('src') : '';
}

/**
 * builds an optimised url for authored (media bus) images; other urls are left as is
 */
function imageUrl(src, width, format) {
  if (!src) return '';
  const url = new URL(src, window.location.href);
  if (!url.pathname.includes('/media_')) return url.href;
  url.search = '';
  url.searchParams.set('width', width);
  url.searchParams.set('format', format);
  url.searchParams.set('optimize', 'medium');
  return url.origin === window.location.origin ? `${url.pathname}${url.search}` : url.href;
}

function fallbackFormat(src) {
  return /\.png(\?|$)/i.test(src) ? 'png' : 'jpeg';
}

/**
 * responsive picture: the desktop image from 992px, the mobile image below
 */
function buildPicture(desktop, mobile, {
  alt = '', eager = false, desktopWidth = 600, mobileWidth = 520, className,
} = {}) {
  const small = mobile || desktop;
  const large = desktop || mobile;
  const picture = el('picture', { class: className });
  if (large && large !== small) {
    picture.append(
      el('source', { media: '(min-width: 992px)', type: 'image/webp', srcset: imageUrl(large, desktopWidth, 'webply') }),
      el('source', { media: '(min-width: 992px)', srcset: imageUrl(large, desktopWidth, fallbackFormat(large)) }),
    );
  }
  picture.append(
    el('source', { type: 'image/webp', srcset: imageUrl(small, mobileWidth, 'webply') }),
    el('img', {
      src: imageUrl(small, mobileWidth, fallbackFormat(small)),
      alt,
      loading: eager ? 'eager' : 'lazy',
      fetchpriority: eager ? 'high' : undefined,
    }),
  );
  return picture;
}

/**
 * reads the block rows into content rows, form rows, questions and settings
 */
function parseBlock(block) {
  const model = {
    rows: [], form: [], questions: [], config: {},
  };
  let mode = 'content';
  [...block.children].forEach((row) => {
    const cells = [...row.children];
    const first = norm(text(cells[0]));
    const table = TABLES[first];
    if (table && norm(text(cells[1])) === table.second) {
      mode = table.mode;
      return;
    }
    if (mode === 'content') {
      model.rows.push({
        type: first,
        title: cells[1],
        description: cells[2],
        desktop: imageSrc(cells[3]),
        mobile: imageSrc(cells[4]),
        hover: imageSrc(cells[5]),
        value: text(cells[6]),
        category: norm(text(cells[7])),
      });
    } else if (mode === 'form') {
      model.form.push({
        section: first,
        label: cells[1],
        placeholder: text(cells[2]),
        validation: norm(text(cells[3])),
      });
    } else if (mode === 'question') {
      model.questions.push({ id: first, question: text(cells[1]), option: text(cells[2]) });
    } else if (mode === 'config' && first) {
      const [, valueCell] = cells;
      model.config[propKey(first)] = valueCell;
    }
  });
  return model;
}

/**
 * moves the inline content of an authored rich text cell into a new element
 */
function richText(cell, tag, className) {
  const node = el(tag, { class: className });
  if (!cell) return node;
  const blocks = [...cell.children].filter((child) => /^(P|H[1-6])$/.test(child.tagName));
  if (blocks.length) {
    blocks.forEach((child, i) => {
      if (i) node.append(el('br'));
      node.append(...child.childNodes);
    });
  } else {
    node.append(...cell.childNodes);
  }
  return node;
}

/**
 * sends analytics events to Adobe Launch (as on AEM), the data layer and a DOM event
 */
/* eslint-disable no-underscore-dangle */
function track(block, event, detail = {}) {
  try {
    if (window._satellite && typeof window._satellite.track === 'function') {
      window._satellite.track(event, detail);
    }
  } catch (e) {
    // analytics must never break the tool
  }
  if (Array.isArray(window.adobeDataLayer)) {
    window.adobeDataLayer.push({ event, eventInfo: detail });
  }
  block.dispatchEvent(new CustomEvent('itf:analytics', { bubbles: true, detail: { event, ...detail } }));
}
/* eslint-enable no-underscore-dangle */

/**
 * mobile carousel: marks the card in view as current and keeps the dots in sync;
 * refresh() rebuilds the dots when the cards change
 */
function setupCarousel(list, initialItems = [], className = '') {
  const dots = el('div', { class: `itf-dots ${className}`.trim(), 'aria-hidden': 'true' });
  let items = [];
  let dotButtons = [];
  const offset = (item) => item.offsetLeft - list.offsetLeft
    - (parseFloat(getComputedStyle(list).paddingLeft) || 0);

  const setCurrent = (index) => {
    items.forEach((item, i) => item.classList.toggle('is-current', i === index));
    dotButtons.forEach((dot, i) => dot.classList.toggle('is-active', i === index));
  };

  const refresh = (newItems) => {
    items = newItems;
    dotButtons = items.map((item) => {
      const dot = el('button', { type: 'button', class: 'itf-dot', tabindex: '-1' });
      dot.addEventListener('click', () => list.scrollTo({ left: offset(item), behavior: 'smooth' }));
      return dot;
    });
    dots.replaceChildren(...dotButtons);
    dots.hidden = items.length < 2;
    setCurrent(0);
  };

  let frame;
  list.addEventListener('scroll', () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const padding = parseFloat(getComputedStyle(list).paddingLeft) || 0;
      const start = list.getBoundingClientRect().left + padding;
      let best = 0;
      let bestDistance = Infinity;
      items.forEach((item, i) => {
        const distance = Math.abs(item.getBoundingClientRect().left - start);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = i;
        }
      });
      // at the end of the list the last card cannot reach the start edge
      if (list.scrollLeft + list.clientWidth >= list.scrollWidth - 2) best = items.length - 1;
      setCurrent(best);
    });
  }, { passive: true });

  refresh(initialItems);
  return {
    dots,
    refresh,
    reset: () => {
      list.scrollLeft = 0;
      setCurrent(0);
    },
    show: (item) => {
      if (isDesktop()) return;
      list.scrollTo({ left: offset(item), behavior: 'smooth' });
    },
  };
}

export default async function decorate(block) {
  const model = parseBlock(block);
  const cfgCell = (name) => model.config[propKey(name)];
  const cfg = (name, fallback = '') => text(cfgCell(name)) || fallback;
  const cfgHref = (name) => {
    const cell = cfgCell(name);
    const link = cell && cell.querySelector('a[href]');
    return link ? link.getAttribute('href') : text(cell);
  };
  const rowsOf = (category, type) => model.rows
    .filter((row) => row.category === category && (!type || row.type === type));
  const rowOf = (category, type) => rowsOf(category, type)[0];

  const storageKey = `itf:${window.location.pathname}`;
  let saved = {};
  try {
    saved = JSON.parse(sessionStorage.getItem(storageKey)) || {};
  } catch (e) {
    saved = {};
  }

  const state = {
    step: 'hero',
    room: saved.room || '',
    light: saved.light || '',
    theme: saved.theme || '',
    labels: saved.labels || {},
    leadSubmitted: !!saved.leadSubmitted,
    fields: saved.fields || {},
    category: '',
  };
  const persist = () => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({
        room: state.room,
        light: state.light,
        theme: state.theme,
        labels: state.labels,
        leadSubmitted: state.leadSubmitted,
        fields: state.fields,
      }));
    } catch (e) {
      // storage can be unavailable (private mode); the tool still works
    }
  };

  const steps = {};
  const stepOrder = ['hero', ...STEPS, 'form', 'result'];

  /* ---------- background ---------- */
  const bgRow = rowOf('hero', 'background') || rowsOf('hero').find((row) => row.desktop || row.mobile);
  const background = bgRow
    ? buildPicture(bgRow.desktop, bgRow.mobile, {
      eager: true, desktopWidth: 2000, mobileWidth: 750, className: 'itf-background',
    })
    : null;

  /* ---------- step 1: hero ---------- */
  const introRow = rowOf('hero', 'intro') || rowOf('hero', 'title') || rowOf('hero', 'content');
  const ctaRow = rowOf('hero', 'cta');
  const heroTitleCell = introRow && introRow.title;
  const authoredHeading = heroTitleCell && heroTitleCell.querySelector('h1, h2, h3');
  const heroTitle = richText(heroTitleCell, authoredHeading ? authoredHeading.tagName.toLowerCase() : 'h2', 'itf-hero-title');
  heroTitle.tabIndex = -1;
  const heroText = richText(introRow && introRow.description, 'p', 'itf-hero-text');
  const startButton = el('button', { type: 'button', class: 'itf-btn itf-btn-primary itf-start' }, text(ctaRow && ctaRow.title) || 'Let’s get started');
  steps.hero = el(
    'div',
    { class: 'itf-step itf-hero', 'data-step': 'hero' },
    el('div', { class: 'itf-hero-content' }, heroTitle, heroText.textContent ? heroText : '', startButton),
  );

  /* ---------- steps 2-4: room, light, theme ---------- */
  const questions = {};
  const lightImages = {};
  rowsOf('light').filter((row) => ['light-image', 'room-image', 'image'].includes(row.type)).forEach((row) => {
    lightImages[`${norm(text(row.title))}|${norm(row.value)}`] = row;
  });

  const goTo = (step, { focus = true } = {}) => {
    state.step = step;
    stepOrder.forEach((name) => {
      if (steps[name]) steps[name].hidden = name !== step;
    });
    block.dataset.step = step;
    if (!focus) return;
    const heading = steps[step].querySelector('[tabindex="-1"]');
    if (heading) heading.focus({ preventScroll: true });
    if (block.getBoundingClientRect().top < 0) block.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  const updateLightImages = () => {
    const q = questions.light;
    if (!q) return;
    q.options.forEach((option) => {
      const image = lightImages[`${norm(state.room)}|${norm(option.value)}`];
      if (!image) return;
      const media = option.label.querySelector('.itf-option-media');
      media.querySelector('picture').replaceWith(buildPicture(image.desktop, image.mobile));
    });
  };

  STEPS.forEach((key, index) => {
    const questionRow = rowOf(key, 'question');
    const optionRows = rowsOf(key, 'option');
    if (!optionRows.length) return;

    const headingId = nextId(`${key}-question`);
    const heading = el('h2', {
      id: headingId, class: 'itf-question-text', tabindex: '-1',
    }, text(questionRow && questionRow.title));
    const number = el('p', { class: 'itf-step-number' }, (questionRow && questionRow.value) || String(index + 1).padStart(2, '0'));
    const list = el('div', { class: 'itf-options', role: 'radiogroup', 'aria-labelledby': headingId });
    const name = nextId(key);

    const options = optionRows.map((row) => {
      const label = text(row.title);
      const value = row.value || label;
      const id = nextId(`${key}-option`);
      const input = el('input', {
        type: 'radio', class: 'itf-option-input', id, name, value,
      });
      const media = el('span', { class: 'itf-option-media', 'data-label': label }, buildPicture(row.desktop, row.mobile));
      if (row.hover) {
        media.append(buildPicture(row.hover, row.hover, { className: 'itf-option-hover' }));
        media.classList.add('has-hover');
      }
      const card = el('label', { for: id, class: 'itf-option-card' }, media, el('span', { class: 'itf-option-name' }, label));
      const wrapper = el('div', { class: 'itf-option' }, input, card);
      list.append(wrapper);
      return {
        input, label: card, wrapper, value, text: label,
      };
    });

    const prev = el('button', { type: 'button', class: 'itf-btn itf-btn-outline itf-prev' }, cfg('previousLabel', 'Previous'));
    const next = el('button', { type: 'button', class: 'itf-btn itf-btn-outline itf-next', disabled: true }, cfg('nextLabel', 'Next'));

    const selectOption = (option) => {
      state[key] = option.value;
      state.labels[key] = option.text;
      next.disabled = false;
      if (key === 'room') updateLightImages();
      persist();
    };

    options.forEach((option) => {
      option.input.addEventListener('change', () => {
        selectOption(option);
      });
      if (norm(state[key]) === norm(option.value)) {
        option.input.checked = true;
        next.disabled = false;
      }
    });

    prev.addEventListener('click', () => {
      track(block, 'custom_cta_click', { cta_: text(prev), parentTitle: text(heading) });
      goTo(index ? STEPS[index - 1] : 'hero');
    });

    next.addEventListener('click', () => {
      if (!state[key]) return;
      track(block, `tool_step${index + 1}`, {
        filter: `${text(heading)}|${state[key]}`,
        toolType: 'Interior Texture Tool',
      });
      if (index < STEPS.length - 1) {
        goTo(STEPS[index + 1]);
        // eslint-disable-next-line no-use-before-define
      } else if (state.leadSubmitted) showResults();
      else goTo('form');
    });

    questions[key] = {
      options, next, heading,
    };
    steps[key] = el(
      'div',
      { class: `itf-step itf-question itf-step-${key}`, 'data-step': key, hidden: true },
      el('div', { class: 'itf-question-head' }, number, heading),
      el(
        'div',
        { class: 'itf-options-wrap' },
        list,
        el('div', { class: 'itf-nav' }, prev, next),
      ),
    );
  });
  updateLightImages();

  startButton.addEventListener('click', () => {
    track(block, 'Texturetool_start');
    goTo(STEPS.find((key) => steps[key]) || 'form');
  });

  /* ---------- step 5: lead form ---------- */
  const formRow = (section) => model.form.find((row) => row.section === section);
  const errors = { ...DEFAULT_ERRORS };
  model.form.filter((row) => row.section === 'error').forEach((row) => {
    errors[row.validation || 'required'] = text(row.label);
  });

  const form = el('form', { class: 'itf-form', novalidate: true });
  const fieldWrap = el('div', { class: 'itf-form-fields' });
  const fields = [];
  const fieldRows = model.form.filter((row) => FIELD_TYPES[row.section]);
  (fieldRows.length ? fieldRows : ['name', 'email', 'mobile', 'pincode'].map((section) => ({ section, validation: section })))
    .forEach((row) => {
      const kind = row.section;
      const spec = FIELD_TYPES[kind];
      const id = nextId(kind);
      const errorId = `${id}-error`;
      const labelText = text(row.label) || kind;
      const input = el('input', {
        id,
        name: kind,
        type: spec.type,
        class: 'itf-input',
        autocomplete: spec.autocomplete,
        inputmode: spec.inputMode,
        maxlength: spec.maxLength,
        placeholder: row.placeholder || labelText,
        'aria-describedby': errorId,
        required: !(row.validation || '').includes('optional'),
      });
      if (state.fields[kind]) input.value = state.fields[kind];
      const control = el('div', { class: 'itf-field-control' });
      if (kind === 'mobile') {
        control.append(el('span', { class: 'itf-prefix', 'aria-hidden': 'true' }, el('span', { class: 'itf-flag' }), cfg('countryCode', '+91')));
      }
      control.append(input);
      const error = el('p', { class: 'itf-field-error', id: errorId });
      const field = el(
        'div',
        { class: `itf-field itf-field-${kind}` },
        el('label', { for: id, class: 'itf-field-label' }, labelText, el('span', { class: 'itf-required', 'aria-hidden': 'true' }, ' *')),
        control,
        error,
      );
      fieldWrap.append(field);
      const rule = (row.validation || kind).split(/\s+/).find((token) => VALIDATORS[token]) || kind;
      const check = () => {
        const value = input.value.trim();
        let message = '';
        if (!value && input.required) message = errors.required;
        else if (value && VALIDATORS[rule] && !VALIDATORS[rule](value)) {
          message = errors[rule] || errors.required;
        }
        error.textContent = message;
        field.classList.toggle('is-invalid', !!message);
        input.setAttribute('aria-invalid', message ? 'true' : 'false');
        return !message;
      };
      input.addEventListener('input', () => {
        if (spec.filter) {
          const clean = input.value.replace(spec.filter, '');
          if (clean !== input.value) input.value = clean;
        }
        field.classList.toggle('has-value', !!input.value);
        if (field.classList.contains('is-invalid')) check();
      });
      input.addEventListener('blur', () => {
        if (input.value) check();
      });
      field.classList.toggle('has-value', !!input.value);
      fields.push({
        kind, input, check, label: labelText,
      });
    });

  // radio questions (question table): options are grouped by question id
  const questionGroups = [];
  model.questions.forEach((row) => {
    let group = questionGroups.find((g) => g.id === row.id);
    if (!group) {
      group = { id: row.id, question: '', options: [] };
      questionGroups.push(group);
    }
    if (row.question && !group.question) group.question = row.question;
    if (row.option) group.options.push(row.option);
  });

  const questionWrap = el('div', { class: 'itf-form-questions' });
  const radios = questionGroups.map((group) => {
    const errorId = nextId(`${group.id}-error`);
    const name = nextId(group.id);
    const error = el('p', { class: 'itf-field-error', id: errorId });
    const legend = el('legend', { class: 'itf-radio-question' }, group.question, el('span', { class: 'itf-required', 'aria-hidden': 'true' }, ' *'));
    const fieldset = el('fieldset', {
      class: 'itf-radio-group', 'aria-describedby': errorId, 'data-question': group.id,
    }, legend);
    const optionWrap = el('div', { class: 'itf-radio-options' });
    group.options.forEach((option) => {
      const id = nextId(`${group.id}-opt`);
      const input = el('input', {
        type: 'radio', id, name, value: option, class: 'itf-radio-input', required: true,
      });
      input.addEventListener('change', () => {
        error.textContent = '';
        fieldset.classList.remove('is-invalid');
      });
      optionWrap.append(el('div', { class: 'itf-radio' }, input, el('label', { for: id }, option)));
    });
    fieldset.append(optionWrap, error);
    questionWrap.append(fieldset);
    const value = () => {
      const checked = fieldset.querySelector('input:checked');
      return checked ? checked.value : '';
    };
    return {
      group,
      value,
      fieldset,
      check: () => {
        const ok = !!value();
        error.textContent = ok ? '' : errors.required;
        fieldset.classList.toggle('is-invalid', !ok);
        return ok;
      },
    };
  });

  const consentRow = formRow('consent');
  const consent = consentRow ? richText(consentRow.label, 'p', 'itf-consent') : '';
  if (consent) {
    consent.querySelectorAll('a[href]').forEach((link) => {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    });
  }
  const submitLabel = text(formRow('submit') && formRow('submit').label) || 'View recommendations';
  const submit = el('button', { type: 'submit', class: 'itf-btn itf-btn-primary itf-submit' }, el('span', {}, submitLabel), el('span', { class: 'itf-spinner', 'aria-hidden': 'true' }));
  const status = el('p', { class: 'itf-form-status', role: 'status', 'aria-live': 'polite' });
  form.append(fieldWrap, radios.length ? questionWrap : '', consent, el('div', { class: 'itf-form-actions' }, submit), status);

  const failureRow = formRow('failure');
  const restartAgain = el('button', { type: 'button', class: 'itf-btn itf-btn-outline-dark itf-error-back' }, text(formRow('back') && formRow('back').label) || 'Restart again');
  const errorPanel = el(
    'div',
    { class: 'itf-form-failure', hidden: true, role: 'alert' },
    el('p', { class: 'itf-failure-heading' }, text(failureRow && failureRow.label) || 'Sorry!'),
    el('p', { class: 'itf-failure-text' }, (failureRow && failureRow.placeholder) || 'Some error occurred, please try again later.'),
    restartAgain,
  );

  const formTitle = el('h2', { class: 'itf-form-title', tabindex: '-1' }, text(formRow('title') && formRow('title').label) || 'One last step before we recommend you textures.');
  const formSubtitleText = text(formRow('subtitle') && formRow('subtitle').label);
  steps.form = el(
    'div',
    { class: 'itf-step itf-form-step', 'data-step': 'form', hidden: true },
    el('div', { class: 'itf-form-header' }, formTitle, formSubtitleText ? el('p', { class: 'itf-form-subtitle' }, formSubtitleText) : ''),
    el('div', { class: 'itf-form-card' }, form, errorPanel),
  );

  /* ---------- step 6: result ---------- */
  const headingRow = rowOf('result', 'heading');
  const resultTitle = richText(headingRow && headingRow.title, 'h2', 'itf-result-title');
  if (!resultTitle.textContent) resultTitle.textContent = 'Top interior texture recommendations.';
  resultTitle.tabIndex = -1;
  const labelRows = rowsOf('result', 'label');
  const inputLabels = STEPS.map((key) => {
    const row = labelRows.find((r) => norm(r.value) === key);
    return { key, label: text(row && row.title) || key.charAt(0).toUpperCase() + key.slice(1) };
  });
  const inputsList = el('ul', { class: 'itf-inputs-list' });
  const inputs = el(
    'div',
    { class: 'itf-inputs' },
    el('p', { class: 'itf-inputs-title' }, text(headingRow && headingRow.description) || 'Based on your inputs -'),
    inputsList,
  );

  const restartRow = rowOf('result', 'restart');
  const restart = el('button', { type: 'button', class: 'itf-restart' }, text(restartRow && restartRow.title) || 'Restart');
  const downloadRow = rowOf('result', 'download');
  const downloadText = el('p', { class: 'itf-download-text' });
  const downloadTemplate = text(downloadRow && downloadRow.description) || 'Download the PDF to get more details about the {category} Textures.';
  const pdfButton = el('button', { type: 'button', class: 'itf-btn itf-btn-outline itf-pdf' }, el('span', {}, text(downloadRow && downloadRow.title) || cfg('downloadLabel', 'Download PDF')), el('span', { class: 'itf-spinner', 'aria-hidden': 'true' }));
  const download = el('div', { class: 'itf-download' }, downloadText, pdfButton);

  const tabs = el('div', { class: 'itf-tabs', role: 'tablist', 'aria-label': cfg('tabsLabel', 'Texture types') });
  const panelId = nextId('panel');
  const cardList = el('ul', { class: 'itf-cards' });
  const panel = el('div', {
    class: 'itf-tabpanel', role: 'tabpanel', id: panelId, tabindex: '0',
  }, cardList);
  const emptyMessage = el('p', { class: 'itf-empty', hidden: true }, cfg('emptyMessage', 'No recommendations are available for this combination yet.'));
  const cardCarousel = setupCarousel(cardList, [], 'itf-card-dots');
  panel.append(cardCarousel.dots);
  const cardsArea = el('div', { class: 'itf-result-cards' }, tabs, panel, emptyMessage);

  steps.result = el(
    'div',
    { class: 'itf-step itf-result', 'data-step': 'result', hidden: true },
    restart,
    resultTitle,
    inputs,
    download,
    cardsArea,
  );

  /* ---------- recommendations data ---------- */
  let dataPromise;
  const loadData = () => {
    if (!dataPromise) {
      const source = cfgHref('recommendations') || rowOf('result', 'data')?.value || '/texture-recommendations.json';
      dataPromise = fetch(source)
        .then((resp) => (resp.ok ? resp.json() : { data: [] }))
        .then((json) => {
          if (Array.isArray(json.data)) return json.data;
          return (json.data && json.data.data) || [];
        })
        .catch(() => []);
    }
    return dataPromise;
  };

  const categoryOrder = cfg('categories', 'Non-metallic, Metallic').split(',').map((c) => c.trim()).filter(Boolean);
  let results = {};
  let categories = [];

  const renderCards = () => {
    const textures = results[state.category] || [];
    cardList.textContent = '';
    textures.forEach((t) => {
      const swatch = (label, name, code, hex) => el(
        'div',
        { class: 'itf-shade' },
        el('p', { class: 'itf-shade-label' }, label),
        el('div', {
          class: `itf-shade-swatch${isDark(hex) ? ' is-dark' : ''}`,
          style: `--shade: ${/^#[0-9a-f]{3,8}$/i.test(hex) ? hex : 'transparent'}`,
        }, el('span', {}, name), el('span', {}, code)),
      );
      const media = el('div', { class: 'itf-card-media' });
      if (t.swatch) {
        media.append(el('img', {
          src: imageUrl(t.swatch, 500, fallbackFormat(t.swatch)), alt: '', loading: 'lazy', width: '240', height: '200',
        }));
      }
      media.append(el('h3', { class: 'itf-card-title' }, t.finish));
      const link = t.link ? el('a', {
        class: 'itf-card-link', href: t.link, target: '_blank', rel: 'noopener',
      }, cfg('detailsLabel', 'View texture details'), el('span', { class: 'itf-sr-only' }, ` – ${t.finish} (opens in a new tab)`)) : '';
      if (link) {
        link.addEventListener('click', () => track(block, 'calct_product_view', {
          filter: `${state.room}|${state.light}|${state.theme}`,
          calcType: 'Texture tool',
          productDetails: `${t.product}|${t.productCode}`,
          Productcatogary: state.category,
        }));
      }
      cardList.append(el(
        'li',
        { class: 'itf-card' },
        media,
        el(
          'div',
          { class: 'itf-card-body' },
          el('div', { class: 'itf-card-product' }, el('p', { class: 'itf-card-label' }, cfg('productUsedLabel', 'Product used')), el('p', { class: 'itf-card-value' }, t.product), el('p', { class: 'itf-card-value' }, t.productCode)),
          el(
            'div',
            { class: 'itf-card-shades' },
            el('p', { class: 'itf-card-shades-title' }, cfg('shadesUsedLabel', 'Shades used')),
            el(
              'div',
              { class: 'itf-shades' },
              swatch(cfg('topCoatLabel', 'Top coat'), t.topCoatName, t.topCoatCode, t.topCoatHex),
              swatch(cfg('baseCoatLabel', 'Base coat'), t.baseCoatName, t.baseCoatCode, t.baseCoatHex),
            ),
          ),
        ),
        link,
      ));
    });
    cardList.scrollLeft = 0;
    cardCarousel.refresh([...cardList.children]);
    const highlight = el('strong', {}, state.category);
    const [before, after = ''] = downloadTemplate.split('{category}');
    downloadText.replaceChildren(before, highlight, after);
    pdfButton.dataset.category = state.category;
  };

  const selectTab = (category, focus) => {
    state.category = category;
    [...tabs.children].forEach((tab) => {
      const active = tab.dataset.category === category;
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
      tab.tabIndex = active ? 0 : -1;
      if (active) {
        panel.setAttribute('aria-labelledby', tab.id);
        if (focus) tab.focus();
      }
    });
    renderCards();
  };

  tabs.addEventListener('keydown', (e) => {
    const index = categories.indexOf(state.category);
    let target;
    if (e.key === 'ArrowRight') target = categories[(index + 1) % categories.length];
    else if (e.key === 'ArrowLeft') target = categories[(index - 1 + categories.length) % categories.length];
    else if (e.key === 'Home') [target] = categories;
    else if (e.key === 'End') target = categories[categories.length - 1];
    if (target) {
      e.preventDefault();
      selectTab(target, true);
    }
  });

  const showResults = async () => {
    inputsList.replaceChildren(...inputLabels.map(({ key, label }) => el('li', {}, `${label} - `, el('strong', {}, state.labels[key] || state[key]))));
    const rows = await loadData();
    const match = rows.filter((row) => norm(row.room) === norm(state.room)
      && norm(row.light) === norm(state.light)
      && norm(row.theme) === norm(state.theme));
    results = {};
    match.forEach((row) => {
      const category = (row.category || 'Recommended').trim();
      results[category] = results[category] || [];
      results[category].push(row);
    });
    const order = (row) => Number(row.order) || 0;
    Object.values(results).forEach((list) => list.sort((a, b) => order(a) - order(b)));
    categories = [
      ...categoryOrder.filter((c) => results[c]),
      ...Object.keys(results).filter((c) => !categoryOrder.includes(c)),
    ];
    tabs.replaceChildren(...categories.map((category) => {
      const tab = el('button', {
        type: 'button', role: 'tab', class: 'itf-tab', id: nextId('tab'), 'aria-controls': panelId, 'data-category': category,
      }, category);
      tab.addEventListener('click', () => selectTab(category));
      return tab;
    }));
    const hasResults = categories.length > 0;
    emptyMessage.hidden = hasResults;
    panel.hidden = !hasResults;
    download.hidden = !hasResults;
    if (hasResults) selectTab(categories[0]);
    goTo('result');
    track(block, 'Texturetool_submit', {
      filter: `${state.room}|${state.light}|${state.theme}`,
      calcType: 'Texture tool',
    });
  };

  /* ---------- form submit ---------- */
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fieldsOk = fields.map((f) => f.check());
    const radiosOk = radios.map((r) => r.check());
    const invalid = [
      ...fields.filter((f, i) => !fieldsOk[i]).map((f) => f.input),
      ...radios.filter((r, i) => !radiosOk[i]).map((r) => r.fieldset.querySelector('input')),
    ];
    if (invalid.length) {
      invalid[0].focus();
      status.textContent = cfg('formErrorMessage', 'Please correct the highlighted fields.');
      track(block, 'form_error', { formName: 'Interior Texture Tool', fields: invalid.map((input) => input.name).join('|') });
      return;
    }
    status.textContent = '';
    const values = {};
    fields.forEach((f) => {
      values[f.kind] = f.input.value.trim();
    });
    state.fields = values;
    const answers = radios.map((r) => ({ question: r.group.question, answer: r.value() }));

    const submitUrl = cfgHref('submitUrl');
    submit.disabled = true;
    submit.classList.add('is-loading');
    let ok = true;
    if (submitUrl) {
      try {
        const resp = await fetch(submitUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data: {
              ...values,
              answers: answers.map((a) => `${a.question}: ${a.answer}`).join(' | '),
              room: state.room,
              light: state.light,
              theme: state.theme,
              campaignId: new URLSearchParams(window.location.search).get('utm_campaign') || cfg('campaignId'),
              page: window.location.href,
            },
          }),
        });
        ok = resp.ok;
      } catch (err) {
        ok = false;
      }
    }
    submit.disabled = false;
    submit.classList.remove('is-loading');
    if (!ok) {
      form.hidden = true;
      errorPanel.hidden = false;
      restartAgain.focus();
      return;
    }
    state.leadSubmitted = true;
    persist();
    showResults();
  });

  restartAgain.addEventListener('click', () => {
    errorPanel.hidden = true;
    form.hidden = false;
    goTo('hero');
  });

  /* ---------- restart and pdf ---------- */
  restart.addEventListener('click', () => {
    track(block, 'Texturetool_recalculate');
    STEPS.forEach((key) => {
      state[key] = '';
      if (!questions[key]) return;
      questions[key].options.forEach((option) => {
        option.input.checked = false;
      });
      questions[key].next.disabled = true;
    });
    state.labels = {};
    persist();
    goTo(STEPS.find((key) => steps[key]) || 'hero');
  });

  pdfButton.addEventListener('click', async () => {
    track(block, 'calct_download', {
      filter: `${state.room}|${state.light}|${state.theme}`,
      calcType: 'Texture tool',
      Productcatogary: state.category,
    });
    pdfButton.disabled = true;
    pdfButton.classList.add('is-loading');
    try {
      const { default: createPdf } = await import('./interior-texture-finder-pdf.js');
      await createPdf({
        library: cfgHref('pdfLibrary'),
        fileName: cfg('fileName', 'Interior_Texture_Recommendations'),
        logo: imageSrc(cfgCell('logo')),
        serviceImage: imageSrc(cfgCell('serviceImage')),
        headerDescription: cfgCell('headerDescription'),
        serviceDescription: cfgCell('serviceDescription'),
        footer: cfgCell('footer'),
        greeting: cfg('greeting', 'Dear'),
        mobileLabel: cfg('mobileLabel', 'Mobile no'),
        emailLabel: cfg('emailLabel', 'Email'),
        heading: cfg('recommendedHeading', 'Recommended Textures'),
        labels: {
          productUsed: cfg('productUsedLabel', 'Product used'),
          shadesUsed: cfg('shadesUsedLabel', 'Shades used'),
          topCoat: cfg('topCoatLabel', 'Top coat'),
          baseCoat: cfg('baseCoatLabel', 'Base coat'),
          product: cfg('productLabel', 'Product'),
          shade: cfg('shadeLabel', 'Shade'),
        },
        user: state.fields,
        category: state.category,
        selections: inputLabels.map(({ key, label }) => ({
          label, value: state.labels[key] || state[key],
        })),
        textures: results[state.category] || [],
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Interior texture finder: PDF could not be created', err);
    }
    pdfButton.disabled = false;
    pdfButton.classList.remove('is-loading');
  });

  /* ---------- render ---------- */
  block.replaceChildren(...[background, ...stepOrder.map((name) => steps[name])].filter(Boolean));
  goTo('hero', { focus: false });
}
