/**
 * colour-quiz lead form — the last quiz step, shown before the results.
 *
 * Authoring rows (first cell is the keyword; see colour-quiz.css header):
 *   form    | step label | submit label | endpoint URL | returning-visitor label
 *   field   | key | label | placeholder | error message
 *   choice  | key | question | options (comma separated) | error message
 *   consent | rich text (links allowed)
 * Known field keys get the matching input type and validation: `name`,
 * `email`, `phone` (10-digit Indian mobile, shown with +91) and `pincode`
 * (6-digit PIN). Any other key is a required text field.
 *
 * Submission: when an endpoint is set, the form POSTs JSON
 * `{ data: { ...fields, ...quiz answers, page, submittedAt } }` to it. With no
 * endpoint nothing is sent and the visitor goes straight to the results.
 * Only a "submitted" flag is kept (sessionStorage) so a returning visitor in
 * the same session skips re-entering details; no personal data is stored.
 */

const REQUIRED = 'Field is required';
const STORAGE_KEY = 'colour-quiz-lead-submitted';

const FIELD_TYPES = {
  name: {
    type: 'text', autocomplete: 'name', maxLength: 30, test: (v) => /^[\p{L}][\p{L} .'-]{1,29}$/u.test(v),
  },
  email: {
    type: 'email', autocomplete: 'email', maxLength: 254, test: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v),
  },
  phone: {
    type: 'tel', autocomplete: 'tel-national', inputMode: 'numeric', maxLength: 10, test: (v) => /^[6-9]\d{9}$/.test(v),
  },
  pincode: {
    type: 'text', autocomplete: 'postal-code', inputMode: 'numeric', maxLength: 6, test: (v) => /^[1-9]\d{5}$/.test(v),
  },
};

const text = (el) => (el?.textContent || '').trim();

/** Collect lead-form rows while the block table is parsed. */
export function readLeadRow(kind, cells, lead) {
  if (kind === 'form') {
    Object.assign(lead, {
      enabled: true,
      label: text(cells[1]) || 'One last step before we recommend your colours.',
      submit: text(cells[2]) || 'View Recommendations',
      endpoint: cells[3]?.querySelector('a')?.getAttribute('href') || text(cells[3]),
      returning: text(cells[4]),
    });
  } else if (kind === 'field') {
    const id = text(cells[1]).toLowerCase();
    if (id) {
      lead.fields.push({
        id, label: text(cells[2]) || id, placeholder: text(cells[3]), error: text(cells[4]),
      });
    }
  } else if (kind === 'choice') {
    const id = text(cells[1]).toLowerCase();
    const options = text(cells[3]).split(',').map((s) => s.trim()).filter(Boolean);
    if (id && options.length) {
      lead.choices.push({
        id, question: text(cells[2]) || id, options, error: text(cells[4]),
      });
    }
  } else if (kind === 'consent') {
    lead.consent = cells[1] || null;
  }
}

export const emptyLead = () => ({
  enabled: false, fields: [], choices: [], consent: null,
});

export const leadSubmitted = () => {
  try { return sessionStorage.getItem(STORAGE_KEY) === '1'; } catch (e) { return false; }
};

function markSubmitted() {
  try { sessionStorage.setItem(STORAGE_KEY, '1'); } catch (e) { /* storage unavailable */ }
}

/**
 * Build the form card.
 * @param {object} lead parsed config
 * @param {object} opts { uid, getAnswers: () => object, onDone: () => void }
 */
export function buildLeadForm(lead, { uid, getAnswers, onDone }) {
  const card = document.createElement('div');
  card.className = 'colour-quiz-form';
  const form = document.createElement('form');
  form.noValidate = true;
  form.setAttribute('aria-labelledby', `colour-quiz-${uid}-q`);
  card.append(form);

  const controls = [];
  const setError = (wrap, input, message) => {
    let msg = wrap.querySelector('.colour-quiz-field-message');
    wrap.classList.toggle('colour-quiz-field-error', !!message);
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
    if (!message) { msg?.remove(); return; }
    if (!msg) {
      msg = document.createElement('p');
      msg.className = 'colour-quiz-field-message';
      msg.id = `${input.id || wrap.dataset.id}-error`;
      wrap.append(msg);
    }
    msg.textContent = message;
    input.setAttribute('aria-describedby', msg.id);
  };

  // text inputs
  const inputs = document.createElement('div');
  inputs.className = 'colour-quiz-form-fields';
  lead.fields.forEach((field) => {
    const spec = FIELD_TYPES[field.id] || { type: 'text', test: (v) => v.length > 0 };
    const wrap = document.createElement('div');
    wrap.className = `colour-quiz-field colour-quiz-field-${field.id}`;
    const inputId = `colour-quiz-${uid}-${field.id}`;
    const label = document.createElement('label');
    label.htmlFor = inputId;
    label.innerHTML = '<span class="colour-quiz-field-label"></span><span class="colour-quiz-required" aria-hidden="true">*</span>';
    label.firstChild.textContent = field.label.replace(/\s*\*$/, '');
    const input = document.createElement('input');
    Object.assign(input, {
      id: inputId, name: field.id, type: spec.type, required: true, placeholder: field.placeholder || '',
    });
    if (spec.autocomplete) input.autocomplete = spec.autocomplete;
    if (spec.inputMode) input.inputMode = spec.inputMode;
    if (spec.maxLength) input.maxLength = spec.maxLength;
    const control = document.createElement('div');
    control.className = 'colour-quiz-field-control';
    if (field.id === 'phone') {
      const prefix = document.createElement('span');
      prefix.className = 'colour-quiz-field-prefix';
      prefix.innerHTML = '<span class="colour-quiz-flag" aria-hidden="true"></span><span>+91</span>';
      input.setAttribute('aria-label', `${label.firstChild.textContent} (+91)`);
      control.append(prefix);
    }
    control.append(input);
    wrap.append(label, control);
    inputs.append(wrap);

    const validate = () => {
      if (spec.inputMode === 'numeric') input.value = input.value.replace(/\D/g, '');
      const value = input.value.trim();
      let message = '';
      if (!value) message = REQUIRED;
      else if (!spec.test(value)) message = field.error || `${label.firstChild.textContent} is invalid`;
      setError(wrap, input, message);
      return !message;
    };
    input.addEventListener('blur', validate);
    input.addEventListener('input', () => {
      if (wrap.classList.contains('colour-quiz-field-error')) validate();
    });
    controls.push({
      validate, focus: () => input.focus(), value: () => input.value.trim(), id: field.id,
    });
  });
  form.append(inputs);

  // single-choice questions (pill radios)
  lead.choices.forEach((choice) => {
    const set = document.createElement('fieldset');
    set.className = 'colour-quiz-choice';
    set.dataset.id = `colour-quiz-${uid}-${choice.id}`;
    const legend = document.createElement('legend');
    legend.textContent = choice.question;
    const pills = document.createElement('div');
    pills.className = 'colour-quiz-choice-options';
    const radios = choice.options.map((opt) => {
      const label = document.createElement('label');
      const radio = document.createElement('input');
      Object.assign(radio, { type: 'radio', name: `${uid}-${choice.id}`, value: opt });
      const span = document.createElement('span');
      span.textContent = opt;
      label.append(radio, span);
      pills.append(label);
      return radio;
    });
    set.append(legend, pills);
    form.append(set);
    const validate = () => {
      const ok = radios.some((r) => r.checked);
      setError(set, radios[0], ok ? '' : (choice.error || REQUIRED));
      set.setAttribute('aria-invalid', ok ? 'false' : 'true');
      if (ok) set.removeAttribute('aria-describedby');
      else set.setAttribute('aria-describedby', `${set.dataset.id}-error`);
      return ok;
    };
    radios.forEach((r) => r.addEventListener('change', validate));
    controls.push({
      validate,
      focus: () => radios[0].focus(),
      value: () => radios.find((r) => r.checked)?.value || '',
      id: choice.id,
    });
  });

  if (lead.consent && text(lead.consent)) {
    const consent = document.createElement('div');
    consent.className = 'colour-quiz-consent';
    consent.innerHTML = lead.consent.innerHTML;
    consent.querySelectorAll('a[href]').forEach((a) => {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    });
    form.append(consent);
  }

  const formError = document.createElement('p');
  formError.className = 'colour-quiz-form-error';
  formError.setAttribute('role', 'alert');

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'colour-quiz-submit';
  submit.innerHTML = '<span class="colour-quiz-submit-label"></span><span class="colour-quiz-spinner" aria-hidden="true"></span>';
  submit.firstChild.textContent = lead.submit;
  form.append(formError, submit);

  let busy = false;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;
    formError.textContent = '';
    const results = controls.map((c) => c.validate());
    const firstBad = results.indexOf(false);
    if (firstBad > -1) { controls[firstBad].focus(); return; }

    if (lead.endpoint) {
      const data = Object.fromEntries(controls.map((c) => [c.id, c.value()]));
      if (data.phone) data.phone = `+91${data.phone}`;
      Object.entries(getAnswers()).forEach(([id, v]) => { data[`quiz-${id}`] = v; });
      data.page = window.location.href;
      data.submittedAt = new Date().toISOString();
      busy = true;
      submit.disabled = true;
      submit.setAttribute('aria-busy', 'true');
      try {
        const resp = await fetch(lead.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data }),
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      } catch (err) {
        formError.textContent = 'Something went wrong. Please try again.';
        return;
      } finally {
        busy = false;
        submit.disabled = false;
        submit.removeAttribute('aria-busy');
      }
    }
    markSubmitted();
    onDone();
  });

  // returning visitor (already submitted this session): button only
  const again = document.createElement('div');
  again.className = 'colour-quiz-form colour-quiz-form-returning';
  const againBtn = document.createElement('button');
  againBtn.type = 'button';
  againBtn.className = 'colour-quiz-submit';
  againBtn.textContent = lead.submit;
  againBtn.addEventListener('click', onDone);
  again.append(againBtn);

  return { card, returningCard: again };
}
