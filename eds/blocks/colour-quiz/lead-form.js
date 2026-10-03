import {
  ltyEncrypt, saveLead, sendToSalesforce, marketingChannel, mcvid, gaClientId, utmValues,
  rememberVisit, track,
} from './lead-api.js';

/**
 * colour-quiz lead form — the last quiz step, shown before the results.
 * Behaviour, validation and requests replicate the source quiz
 * (asianpaints.com home-colour-guide, colourconsultancy component).
 *
 * Authoring rows (first cell is the keyword; see colour-quiz.css header):
 *   form    | step label | submit label | save-lead endpoint | returning-visitor label
 *   field   | key | label | placeholder | error message
 *   choice  | key | question | options (comma separated) | error message
 *   consent | rich text (links allowed)
 * plus `config | key | value` rows read by colour-quiz.js (`lead endpoint`
 * — used when the form row has none —, `node`, `campaign id`,
 * `campaign name`, `salesforce`, `form name`).
 * Known field keys get the source's input filters and checks: `name`,
 * `email`, `phone` (10 digits, not starting 0, shown with +91) and `pincode`
 * (6 digits). Any other key is a required text field. The first choice is
 * sent as `remarks`, a second one as `answer`.
 *
 * Submit (as on the source): name split into first/last word, fields
 * AES-encrypted (lead-api.js) and POSTed to the save-lead endpoint; the
 * returned row id is later sent to Salesforce with the results PDF link.
 * The source also keeps name|email|mobile|PIN in a `CCFormFields` cookie
 * (30 days) to prefill the form, and the quiz state in localStorage
 * `storeQuizResult`. A visitor who already submitted on this page view gets
 * the button only. With no endpoint nothing is sent.
 */

const REQUIRED = 'Field is required';
const COOKIE = 'CCFormFields';
const STORE_KEY = 'storeQuizResult';

// question id -> source quiz field (storeQuizResult / recommendation request)
const QUIZ_FIELDS = {
  space: 'requestType',
  room: 'roomType',
  style: 'roomStyle',
  vibe: 'roomPersonality',
  'building-style': 'buildingStyle',
  'building-vibe': 'buildingVibe',
};

// source keydown filters (inline onkeydown on the inputs); shortcuts with
// Ctrl/Cmd and Enter/Home/End are also let through here
const NAV_KEYS = ['Tab', 'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Enter', 'Home', 'End'];
const digitsOnly = (e) => NAV_KEYS.includes(e.code) || NAV_KEYS.includes(e.key)
  || (!Number.isNaN(Number(e.key)) && e.code !== 'Space');
const lettersOnly = (e) => /[a-z, ]/i.test(e.key);

const FIELD_TYPES = {
  name: {
    type: 'text', autocomplete: 'name', maxLength: 30, filter: lettersOnly, test: (v) => /^([a-zA-Z]+\s?)*[a-zA-Z]+$/.test(v.trim()),
  },
  email: {
    type: 'text', autocomplete: 'email', inputMode: 'email', test: (v) => /^\b[A-Z0-9._%-]+@[A-Z0-9.-]+\.[A-Z]{2,4}\b$/i.test(v),
  },
  phone: {
    type: 'tel', autocomplete: 'tel-national', inputMode: 'numeric', filter: digitsOnly, test: (v) => /^[1-9]\d{9}$/.test(v),
  },
  pincode: {
    type: 'text', autocomplete: 'postal-code', inputMode: 'numeric', maxLength: 6, filter: digitsOnly, test: (v) => /^[0-9]{6}$/.test(v),
  },
};

const text = (el) => (el?.textContent || '').trim();

/**
 * Lead + quiz state for this page view (the source resets it on load):
 * `quiz` is the source's storeQuizResult with its placeholder defaults.
 */
const session = {
  submitted: false,
  rowId: '',
  lead: null,
  dbFlag: false,
  analyticsSent: false,
  quiz: {
    userName: 'userFullName',
    userEmail: 'userEmailId',
    requestType: 'intVal1',
    roomType: 'intVal2',
    roomStyle: 'intVal5',
    roomPersonality: 'intVal6',
    buildingVibe: 'extVal3',
    buildingStyle: 'extVal4',
    userPhone: 'userPhoneNum',
    userPinCode: 'userPINCode',
    userCity: 'userCity',
    formPreviouslySubmitted: false,
  },
};

function storeQuiz() {
  session.quiz.formPreviouslySubmitted = session.submitted;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(session.quiz));
  } catch (e) { /* storage unavailable */ }
}

/** Keep the source's quiz state in step with an answer (it sends this object to the API). */
export function recordAnswer(id, value) {
  const field = QUIZ_FIELDS[id];
  if (!field) return;
  session.quiz[field] = value;
  storeQuiz();
}

/** The recommendation request object (storeQuizResult). */
export const quizRequest = () => ({ ...session.quiz });

/** "Type : Interior | RoomType : … " filter string used by the source analytics. */
function quizFilter() {
  const q = session.quiz;
  if (q.requestType === 'Interior') return `Type : ${q.requestType} | RoomType : ${q.roomType} | RoomStyle : ${q.roomStyle} | RoomVibe : ${q.roomPersonality}`;
  if (q.requestType === 'Exterior') return `Type : ${q.requestType} | BuildingStyle : ${q.buildingStyle} | BuildingVibe : ${q.buildingVibe}`;
  return '';
}

function trackSubmit() {
  const filter = quizFilter();
  const ga4 = { event: 'colour_quiz_submit' };
  const [space, rooms, style, vibe] = filter.split('|').map((part) => (part.split(':')[1] || '').trim());
  if (space) ga4.select_space = space;
  if (rooms) ga4.select_rooms = rooms;
  if (style) ga4.select_style = style;
  if (vibe) ga4.preferred_vibe = vibe;
  track('HCG_submit', { filter, flowType: '' }, { ga4 });
}

function readCookie() {
  const raw = document.cookie.split('; ').find((c) => c.startsWith(`${COOKIE}=`));
  if (!raw) return null;
  const [name, email, phone, pincode, city] = decodeURIComponent(raw.slice(COOKIE.length + 1)).split('|');
  const ok = (v) => (v && v !== 'undefined' ? v : '');
  return {
    name: ok(name), email: ok(email), phone: ok(phone), pincode: ok(pincode), city: ok(city),
  };
}

function writeCookie(values) {
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();
  // fName + " " + lName | email | mobile | PIN | city — the source's format
  // (an unset city or last name is written as "undefined" / empty)
  const body = `${values.fName} ${values.lName}|${values.email}|${values.phone}|${values.pincode}|${values.city}`;
  document.cookie = `${COOKIE}=${body};expires=${expires};path=/`;
}

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

/** Already submitted on this page view (the source then shows the button only). */
export const leadSubmitted = () => session.submitted;

const allowedOrigin = () => ['www.asianpaints.com', 'beta.asianpaints.com', 'localhost'].includes(window.location.hostname);

/**
 * After the results PDF is uploaded (or the results failed): send the lead
 * row to Salesforce with the PDF link, then the one-time form_submit event —
 * the source's leadstosalesforce step.
 * @param {object} settings block config (`salesforce`, `form name`, `page path`)
 * @param {string} pdfUrl uploaded PDF link ('' when none)
 */
export async function completeLead(settings, pdfUrl) {
  const url = settings.get('salesforce');
  if (!session.rowId || !session.lead || !url) return;
  const salesforce = await sendToSalesforce(url, session.lead, session.rowId, pdfUrl);
  const pagePath = settings.get('page path') || '';
  if (session.analyticsSent || !(session.dbFlag || salesforce)) return;
  if (!(pagePath.includes('/content/ap/en/') || allowedOrigin())) return;
  session.analyticsSent = true;
  let destination = 'Both';
  if (!salesforce) destination = 'DB';
  else if (!session.dbFlag) destination = 'Salesforce';
  track('form_submit', {
    formName: settings.get('form name') || '',
    pincode: session.lead.plainPin,
    whatsappOptIn: '',
    contruction: session.lead.remarks || '',
    localpainter: session.lead.answer || '',
    campaignId: session.lead.campaignId,
    dataDestination: destination,
    filterValue: '',
    flowType: '',
    language: '',
    GSTNo: '',
    shopAdress: '',
    userType: '',
  });
}

/**
 * Build the form card.
 * @param {object} lead parsed config
 * @param {object} opts { uid, settings: Map, onDone: () => Promise }
 */
export function buildLeadForm(lead, { uid, settings, onDone }) {
  rememberVisit();
  const utm = utmValues();
  const endpoint = lead.endpoint || settings.get('lead endpoint');
  const prefill = readCookie();

  const card = document.createElement('div');
  card.className = 'colour-quiz-form';
  const form = document.createElement('form');
  form.noValidate = true;
  form.setAttribute('aria-labelledby', `colour-quiz-${uid}-q`);
  card.append(form);

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'colour-quiz-submit';
  submit.innerHTML = '<span class="colour-quiz-submit-label"></span><span class="colour-quiz-spinner" aria-hidden="true"></span>';
  submit.firstChild.textContent = lead.submit;

  const fieldControls = [];
  const choiceControls = [];
  const setError = (wrap, input, message) => {
    let msg = wrap.querySelector('.colour-quiz-field-message');
    wrap.classList.toggle('colour-quiz-field-error', !!message);
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
    if (!message) {
      msg?.remove();
      input.removeAttribute('aria-describedby');
      return;
    }
    if (!msg) {
      msg = document.createElement('p');
      msg.className = 'colour-quiz-field-message';
      msg.id = `${input.id || wrap.dataset.id}-error`;
      wrap.append(msg);
    }
    msg.textContent = message;
    input.setAttribute('aria-describedby', msg.id);
  };

  // the source greys the button out while any text field shows an error
  const inputs = document.createElement('div');
  const syncSubmit = () => {
    const blocked = !!inputs.querySelector('.colour-quiz-field-error');
    submit.classList.toggle('colour-quiz-submit-disabled', blocked);
    submit.setAttribute('aria-disabled', String(blocked));
  };

  // text inputs
  inputs.className = 'colour-quiz-form-fields';
  lead.fields.forEach((field) => {
    const spec = FIELD_TYPES[field.id] || { type: 'text', test: (v) => v.trim().length > 0 };
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
    if (prefill?.[field.id]) input.value = prefill[field.id];
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

    // source: required check, then the field's format check, on blur;
    // any key press clears the field's error until the next blur
    const validate = () => {
      const { value } = input;
      let message = '';
      if (!value.length) message = REQUIRED;
      else if (!spec.test(value)) message = field.error || `${label.firstChild.textContent} is invalid`;
      setError(wrap, input, message);
      syncSubmit();
      return !message;
    };
    input.addEventListener('blur', validate);
    input.addEventListener('keydown', (e) => {
      if (spec.filter && !e.ctrlKey && !e.metaKey && !spec.filter(e)) e.preventDefault();
      if (wrap.classList.contains('colour-quiz-field-error')) {
        setError(wrap, input, '');
        syncSubmit();
      }
    });
    fieldControls.push({
      validate, focus: () => input.focus(), value: () => input.value, id: field.id,
    });
  });
  form.append(inputs);

  // single-choice questions (pill radios); nothing is preselected
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
    choiceControls.push({
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
  form.append(submit);

  const value = (id) => fieldControls.find((c) => c.id === id)?.value() || '';
  const choice = (i) => choiceControls[i]?.value();

  let busy = false;
  const setBusy = (on, btn) => {
    busy = on;
    btn.toggleAttribute('disabled', on);
    if (on) btn.setAttribute('aria-busy', 'true');
    else btn.removeAttribute('aria-busy');
  };

  /** Save the lead (first submit on this page view), then show the results. */
  const proceed = async (btn) => {
    const name = value('name').trim();
    const [fName, lName = ''] = name.includes(' ') ? name.split(' ') : [name];
    const values = {
      fName,
      lName,
      email: value('email').trim(),
      phone: value('phone'),
      pincode: value('pincode'),
      city: undefined,
    };
    writeCookie(values);
    trackSubmit();

    // storeQuizResult as the source fills it on submit (it reads the mobile
    // number from the exterior form, which is only filled by the cookie
    // prefill on the interior branch)
    const exterior = session.quiz.requestType === 'Exterior';
    session.quiz.userPinCode = values.pincode;
    delete session.quiz.userCity;
    session.quiz.userPhone = exterior ? values.phone : (prefill?.phone || '');
    storeQuiz();

    setBusy(true, btn);
    try {
      if (!session.submitted && endpoint) {
        const node = settings.get('node') || '';
        const lt = await Promise.all([fName, lName, values.email, values.phone, values.pincode]
          .map((v) => ltyEncrypt(v)));
        session.lead = {
          pageUrl: window.location.href,
          node,
          remarks: choice(0) ?? '',
          answer: choice(1) ?? '',
          fName: lt[0],
          lName: lt[1],
          email: lt[2],
          mobileNo: lt[3],
          pinCode: lt[4],
          plainPin: values.pincode,
          city: values.city,
          visitorId: mcvid(),
          gaId: gaClientId(),
          campaignId: utm.campaign || settings.get('campaign id') || '',
          campaignName: utm.campaign || settings.get('campaign name') || '',
          channel: marketingChannel(),
          utm,
        };
        const saved = await saveLead(endpoint, session.lead);
        session.dbFlag = saved.ok;
        if (saved.ok && saved.rowId) {
          session.rowId = saved.rowId;
          session.submitted = true;
          storeQuiz();
        } else if (!saved.ok && node.includes('/ap/en/') && settings.get('salesforce')) {
          // source: leads the database rejected still go to Salesforce
          sendToSalesforce(settings.get('salesforce'), session.lead, `${Date.now()}-nondblead`, '');
        }
      }
      await onDone();
    } finally {
      setBusy(false, btn);
    }
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;
    const fieldsOk = fieldControls.map((c) => c.validate());
    const choicesOk = choiceControls.map((c) => c.validate());
    const firstBad = [...fieldsOk, ...choicesOk].indexOf(false);
    if (firstBad > -1) {
      [...fieldControls, ...choiceControls][firstBad].focus();
      return;
    }
    if (submit.classList.contains('colour-quiz-submit-disabled')) return;
    await proceed(submit);
  });

  // returning visitor (already submitted on this page view): button only
  const again = document.createElement('div');
  again.className = 'colour-quiz-form colour-quiz-form-returning';
  const againBtn = document.createElement('button');
  againBtn.type = 'button';
  againBtn.className = 'colour-quiz-submit';
  againBtn.innerHTML = '<span class="colour-quiz-submit-label"></span><span class="colour-quiz-spinner" aria-hidden="true"></span>';
  againBtn.firstChild.textContent = lead.submit;
  againBtn.addEventListener('click', () => { if (!busy) proceed(againBtn); });
  again.append(againBtn);

  return { card, returningCard: again };
}
