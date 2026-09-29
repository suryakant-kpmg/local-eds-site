/**
 * Wall Paint Tool — a 3-step guided flow. All content is authored in DA.
 *
 * Steps are separated in the DA table by a marker row whose only text is
 * "Step 1", "Step 2" or "Step 3" (so authors are never confused about which
 * screen a row belongs to). Rows before the first marker fall into Step 1.
 *
 * STEP 1 — heading + mandatory questions
 *   image row     : desktop background | mobile background (shared by all steps)
 *   heading row   : rich text (a bold run becomes the highlighted colour text)
 *   question rows : question text | bullet list of options [| display|hide]
 *   cta row       : "CTA" | button label            (authorable button text)
 *
 * STEP 2 — lead form
 *   heading row    : rich text
 *   subheading row : plain text
 *   field labels   : Name | Email | Phone | Pincode          (column labels)
 *   field holders  : Enter your name | Enter your Email | …   (placeholders)
 *   whatsapp row   : Update me on WhatsApp | display|hide
 *   question rows  : question text | bullet list | display|hide
 *   consent row    : rich text with Terms / Privacy links
 *   cta row        : "CTA" | button label
 *
 * STEP 3 — recommendations (placeholder heading/text for now)
 *
 * @param {Element} block The block element
 */

// Normalise a label into a lowercase, hyphen-separated token.
// Used both to derive input `name`/`id`/CSS-class values and to match an
// authored label ("Semi Gloss") against a known key ("semi-gloss").
function slug(text) {
  return text.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// finish options that render as gradient swatches (gradients live in the CSS)
const SWATCH_SLUGS = ['gloss', 'semi-gloss', 'matt'];

// turn a bold/italic run authored in DA into the gold highlight span
function buildHeadingHTML(sourceEl) {
  const clone = sourceEl.cloneNode(true);
  clone.querySelectorAll('strong, b, em').forEach((el) => {
    const span = document.createElement('span');
    span.className = 'color-text';
    span.innerHTML = el.innerHTML;
    el.replaceWith(span);
  });
  return clone.innerHTML;
}

// Split the flat list of authored rows into per-step groups.
// A "Step N" marker row (a single cell reading e.g. "Step 2") starts a new
// group; every following row belongs to that step until the next marker.
// Rows that appear before any marker still form an implicit first group, so
// the block keeps working even if an author forgets the "Step 1" marker.
// Returns an array of row-arrays: [step1Rows, step2Rows, step3Rows].
function splitSteps(rows) {
  const steps = [];
  let current = null;
  rows.forEach((row) => {
    const isMarker = [...row.children].length <= 1 && /^step\s*\d+$/i.test(row.textContent.trim());
    if (isMarker) {
      current = [];
      steps.push(current);
      return;
    }
    if (!current) {
      current = [];
      steps.push(current);
    }
    current.push(row);
  });
  return steps;
}

// Read the optional visibility flag authors can put in a row's last cell.
// "display" -> render the element, "hide" -> omit it entirely.
// Returns null when the last cell is neither, so callers can tell an
// explicit flag apart from ordinary content.
function displayFlag(cells) {
  const last = cells[cells.length - 1]?.textContent.trim().toLowerCase();
  return last === 'display' || last === 'hide' ? last : null;
}

// build a radio-group fieldset from a question row
function buildQuestion(labelText, options, groupName) {
  const isSwatch = options.some((li) => SWATCH_SLUGS.includes(slug(li.textContent)));

  const fieldset = document.createElement('fieldset');
  fieldset.className = 'wallpainttool-question';
  if (isSwatch) fieldset.classList.add('wallpainttool-question-swatch');

  const legend = document.createElement('legend');
  legend.className = 'wallpainttool-question-title';
  legend.textContent = labelText;
  fieldset.append(legend);

  const optionsWrap = document.createElement('div');
  optionsWrap.className = 'wallpainttool-options';

  options.forEach((li, oIndex) => {
    const value = li.textContent.trim();
    const id = `${groupName}-o${oIndex}`;
    const optSlug = slug(value);
    // An author can wrap an option's label in a link (e.g. Wood -> the wood
    // finish tool). Selecting that option opens the link in a new tab.
    const link = li.querySelector('a');
    const href = link ? link.getAttribute('href') : '';

    const optionLabel = document.createElement('label');
    optionLabel.className = 'wallpainttool-option';
    optionLabel.setAttribute('for', id);

    const input = document.createElement('input');
    input.type = 'radio';
    input.name = groupName;
    input.id = id;
    input.value = value;
    input.required = true;
    if (href) {
      input.dataset.href = href;
      input.addEventListener('change', () => {
        if (input.checked) window.open(href, '_blank', 'noopener');
      });
    }

    optionLabel.append(input);

    if (isSwatch && SWATCH_SLUGS.includes(optSlug)) {
      const swatch = document.createElement('span');
      swatch.className = `wallpainttool-swatch wallpainttool-swatch-${optSlug}`;
      swatch.setAttribute('aria-hidden', 'true');
      optionLabel.append(swatch);
    }

    const text = document.createElement('span');
    text.className = 'wallpainttool-option-text';
    text.textContent = value;
    optionLabel.append(text);

    optionsWrap.append(optionLabel);
  });

  fieldset.append(optionsWrap);
  return fieldset;
}

/* ------------------------------------------------------------------ STEP 1 */
function buildStep1(rows) {
  let headingRow = null;
  let ctaText = 'Proceed';
  const questionRows = [];

  // Classify each authored row by what it contains, rather than by position,
  // so authors can reorder rows without breaking the block:
  //  - image row              -> skipped here (background is read at block level)
  //  - "CTA"/"Button" | label -> overrides the button text
  //  - row with a <ul>/<ol>   -> a question (label + options list)
  //  - first remaining text row -> the heading
  rows.forEach((row) => {
    if (row.querySelector('img, picture')) return; // bg handled at root level
    const cells = [...row.children];
    if (cells.length === 2 && ['cta', 'button'].includes(cells[0].textContent.trim().toLowerCase())) {
      ctaText = cells[1].textContent.trim() || ctaText;
    } else if (row.querySelector('ul, ol')) {
      questionRows.push(row);
    } else if (row.textContent.trim() && !headingRow) {
      headingRow = row;
    }
  });

  const screen = document.createElement('div');
  screen.className = 'wallpainttool-screen wallpainttool-screen-1';
  screen.dataset.step = '1';

  const left = document.createElement('div');
  left.className = 'wallpainttool-left';
  if (headingRow) {
    const source = headingRow.querySelector('p') || headingRow;
    left.innerHTML = `<div role="heading" aria-level="1" class="surface-layout-text-section" aria-label="${source.textContent.trim()}" tabindex="0"><p>${buildHeadingHTML(source)}</p></div>`;
  }

  const right = document.createElement('div');
  right.className = 'wallpainttool-right';

  const form = document.createElement('form');
  form.className = 'wallpainttool-form';
  form.setAttribute('novalidate', '');

  questionRows.forEach((row, qIndex) => {
    const cells = [...row.children];
    const optionsCell = cells[1] || cells[0];
    const options = [...optionsCell.querySelectorAll('li')];
    form.append(buildQuestion(cells[0].textContent.trim(), options, `wpt-s1-q${qIndex}`));
  });

  const proceed = document.createElement('button');
  proceed.type = 'submit';
  proceed.className = 'wallpainttool-proceed';
  proceed.disabled = true;
  proceed.innerHTML = `<span>${ctaText}</span>`;

  // Keep the CTA disabled until every question has a selected option.
  // One checked radio per group means checked-count === question-count.
  const total = questionRows.length;
  const update = () => {
    proceed.disabled = form.querySelectorAll('input[type="radio"]:checked').length < total;
  };
  form.addEventListener('change', update);
  update();

  form.append(proceed);
  right.append(form);
  screen.append(left, right);
  return { screen, form, proceed };
}

/* ------------------------------------------------------------------ STEP 2 */
// Infer the right input semantics from the authored field label so authors
// only type a label ("Phone") and get the correct type, on-screen keyboard
// (inputmode), autofill hint (autocomplete) and validation pattern for free.
// Note: pincode uses type="text" + inputmode="numeric" on purpose — type="number"
// strips leading zeros and adds unwanted spinner UI (see forms best-practices).
function fieldConfig(labelSlug) {
  if (labelSlug.includes('email')) return { type: 'email', autocomplete: 'email' };
  if (labelSlug.includes('phone') || labelSlug.includes('mobile')) {
    return {
      type: 'tel', autocomplete: 'tel-national', inputmode: 'numeric', pattern: '\\d{10}', maxlength: '10', prefix: '+91',
    };
  }
  if (labelSlug.includes('pin')) {
    return {
      type: 'text', autocomplete: 'postal-code', inputmode: 'numeric', pattern: '\\d{6}', maxlength: '6',
    };
  }
  return { type: 'text', autocomplete: 'name' };
}

function buildStep2(rows) {
  const screen = document.createElement('div');
  screen.className = 'wallpainttool-screen wallpainttool-screen-2';
  screen.dataset.step = '2';
  if (!rows || !rows.length) return { screen, form: null, skipForm: false };

  let ctaText = 'View Recommendations';
  let skipForm = false; // "Skip Form | true" bypasses Step 2 entirely
  const textRows = []; // single-cell text rows -> heading + subheading (in order)
  const gridRows = []; // multi-cell rows -> [0] field labels, [1] placeholders
  const questionRows = []; // rows containing an options list -> radio questions
  let whatsapp = null; // the "Update me on WhatsApp" opt-in row, if present
  let consentRow = null; // the legal/consent paragraph (identified by its links)

  // Bucket every row by shape/content. Order matters: the checks are arranged
  // most-specific first so, e.g., the consent paragraph (which has links) is
  // caught before the generic multi-cell "grid row" branch.
  rows.forEach((row) => {
    const cells = [...row.children];
    const flag = displayFlag(cells);
    if (cells.length === 2 && slug(cells[0].textContent) === 'skip-form') {
      skipForm = cells[1].textContent.trim().toLowerCase() === 'true';
    } else if (cells.length === 2 && ['cta', 'button'].includes(cells[0].textContent.trim().toLowerCase())) {
      ctaText = cells[1].textContent.trim() || ctaText;
    } else if (row.querySelector('ul, ol')) {
      questionRows.push({ cells, flag });
    } else if (row.querySelector('a') || row.textContent.trim().length > 120) {
      // links (Terms/Privacy) or a long paragraph => the consent text
      consentRow = row;
    } else if (flag && cells.length === 2) {
      // "<label> | display|hide" => the WhatsApp opt-in row
      whatsapp = { label: cells[0].textContent.trim(), show: flag === 'display' };
    } else if (cells.length >= 2) {
      // remaining multi-cell rows are the field labels row then placeholders row
      gridRows.push(cells);
    } else if (row.textContent.trim()) {
      textRows.push(row);
    }
  });

  const card = document.createElement('div');
  card.className = 'wallpainttool-card';

  const form = document.createElement('form');
  form.className = 'wallpainttool-form2';
  // TEMP QA: novalidate lets the empty form submit through to Step 3.
  // Remove when re-enabling validation.
  form.setAttribute('novalidate', '');

  // heading + subheading (first two single-cell text rows)
  const header = document.createElement('div');
  header.className = 'wallpainttool-form2-header';
  if (textRows[0]) {
    const src = textRows[0].querySelector('p') || textRows[0];
    header.innerHTML = `<h2 class="wallpainttool-form2-title">${buildHeadingHTML(src)}</h2>`;
  }
  if (textRows[1]) {
    const p = document.createElement('p');
    p.className = 'wallpainttool-form2-sub';
    p.textContent = textRows[1].textContent.trim();
    header.append(p);
  }

  // Build the text inputs by pairing the two grid rows column-by-column:
  // labels row supplies the accessible <label>, placeholders row supplies the
  // input placeholder. Column N of the labels row maps to column N of the
  // placeholders row (e.g. "Phone" + "Enter mobile number").
  const grid = document.createElement('div');
  grid.className = 'wallpainttool-fields';
  const labels = gridRows[0] || [];
  const holders = gridRows[1] || [];
  labels.forEach((labelCell, i) => {
    const labelText = labelCell.textContent.trim();
    const placeholder = holders[i] ? holders[i].textContent.trim() : '';
    // skip columns with no placeholder (e.g. the blank "Book FREE Site Visit" column)
    if (!labelText || !placeholder) return;
    const cfg = fieldConfig(slug(labelText));
    const name = slug(labelText) || `field-${i}`;
    const id = `wpt-f-${name}`;

    const field = document.createElement('div');
    field.className = `wallpainttool-field wallpainttool-field-${name}`;

    // The visible cue is the placeholder, but a real <label> is still emitted
    // (visually hidden) so the field remains labelled for screen readers.
    const label = document.createElement('label');
    label.className = 'wallpainttool-visually-hidden';
    label.setAttribute('for', id);
    label.textContent = labelText;

    const control = document.createElement('div');
    control.className = 'wallpainttool-control';
    if (cfg.prefix) {
      const prefix = document.createElement('span');
      prefix.className = 'wallpainttool-tel-prefix';
      prefix.textContent = cfg.prefix;
      control.append(prefix);
    }

    const input = document.createElement('input');
    input.id = id;
    input.name = name;
    input.type = cfg.type;
    input.placeholder = placeholder;
    // TEMP QA: required removed so the empty form can submit through to
    // Step 3. Restore `input.required = true;` when re-enabling validation.
    input.autocomplete = cfg.autocomplete;
    if (cfg.inputmode) input.inputMode = cfg.inputmode;
    if (cfg.pattern) input.pattern = cfg.pattern;
    if (cfg.maxlength) input.maxLength = Number(cfg.maxlength);
    control.append(input);

    field.append(label, control);
    grid.append(field);
  });

  // whatsapp opt-in checkbox (only when authored to "display")
  let whatsappEl = null;
  if (whatsapp && whatsapp.show) {
    whatsappEl = document.createElement('label');
    whatsappEl.className = 'wallpainttool-whatsapp';
    whatsappEl.innerHTML = '<input type="checkbox" name="whatsapp-optin" checked>';
    const span = document.createElement('span');
    span.textContent = whatsapp.label;
    whatsappEl.append(span);
  }

  // radio questions (only those authored to "display")
  const questionsWrap = document.createElement('div');
  questionsWrap.className = 'wallpainttool-form2-questions';
  questionRows.forEach(({ cells, flag }, qIndex) => {
    if (flag === 'hide') return;
    const optionsCell = cells[1] || cells[0];
    const options = [...optionsCell.querySelectorAll('li')];
    questionsWrap.append(buildQuestion(cells[0].textContent.trim(), options, `wpt-s2-q${qIndex}`));
  });

  // consent text (links preserved)
  let consentEl = null;
  if (consentRow) {
    consentEl = document.createElement('p');
    consentEl.className = 'wallpainttool-consent';
    const src = consentRow.querySelector('p') || consentRow;
    consentEl.innerHTML = src.innerHTML;
  }

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'wallpainttool-proceed wallpainttool-proceed-2';
  submit.innerHTML = `<span>${ctaText}</span>`;

  form.append(grid);
  if (whatsappEl) form.append(whatsappEl);
  if (questionsWrap.children.length) form.append(questionsWrap);
  if (consentEl) form.append(consentEl);
  form.append(submit);

  card.append(header, form);
  screen.append(card);
  return { screen, form, skipForm };
}

/* ------------------------------------------------------------------ STEP 3 */
// Base host for the product packshots / detail pages returned by the API
// (the API returns site-relative paths like "/content/dam/...").
const WPT_ASSET_BASE = 'https://www.asianpaints.com';

// Default endpoint; authors can override it with an "Endpoint" row.
const WPT_DEFAULT_ENDPOINT = 'https://beta.asianpaints.com/apcolourcatalogue/wallPaintTool.wallPaintRecomendation.json';

// TEMP QA fallback: used only if the live fetch fails (e.g. the API is not yet
// CORS-enabled for this origin) so Step 3 can be visually QA'd. Remove once the
// endpoint responds with the proper Access-Control-Allow-Origin header.
const WPT_SAMPLE_DATA = {
  Luxury: {
    productTwo: {
      visibleTags: ['Unmatched Stain Resistance', 'Teflon Surface Protector', '8 Years Warranty'],
      entityName: 'Royale Luxury Emulsion',
      packShot: '/content/dam/asian_paints/products/packshots/interior-walls-royale-luxury-emulsion-asian-paints.png',
      sku: '0030',
      pagePath: '/content/ap/en/home/paint-products/interior-wall-paints/plain-finishes/royale-luxury-emulsion.html',
      productPrice: '5.07',
    },
    productOne: {
      visibleTags: ['Water Beading Technology', 'Luxury with Teflon™', '8 Years Warranty'],
      entityName: 'Royale Aspira',
      packShot: '/content/dam/asian_paints/products/packshots/interior-walls-royale-aspira-luxury-emulsion-asian-paints.png',
      sku: '1058',
      pagePath: '/content/ap/en/home/paint-products/interior-wall-paints/plain-finishes/royale-aspira.html',
      productPrice: '8.42',
    },
    wfProduct: {
      visibleTags: ['5 years Warranty', 'Ready to use', 'Anti-dampness and efflorescence'],
      entityName: 'SmartCare Hydroloc Xtreme',
      packShot: '/content/dam/asian_paints/products/packshots/Smartcare-Hydfroloc-Xtreme.png',
      sku: '1B72',
      pagePath: '/content/ap/en/home/waterproofing-products/hydroloc-xtreme.html',
    },
  },
  Premium: {
    productOne: {
      visibleTags: ['Stain Guard', 'High washability', '6 Years Warranty'],
      entityName: 'Apcolite Premium Satin Emulsion',
      packShot: '/content/dam/asian_paints/products/packshots/interior-walls-apcolite-premium-satin-emulsion-asian-paints.png',
      sku: '0074',
      pagePath: '/content/ap/en/home/paint-products/interior-wall-paints/plain-finishes/apcolite-premium-satin-emulsion.html',
      productPrice: '3.37',
    },
  },
};

// Parse the authored Step 3 rows into a config object. Each row is a
// key | value pair (the key is in the first cell) so authors can label
// exactly what each piece of copy is. List values (Inputs, Tabs) use a
// bullet list in the second cell.
function parseStep3Config(rows) {
  const cfg = {
    restart: 'Restart',
    title: '',
    subtitle: '',
    inputs: [], // labels for the 3 answers, e.g. ["Area", "Seepage", "Finish"]
    downloadText: '', // may contain a {tab} placeholder
    downloadCta: 'Download PDF',
    productsTitle: 'Recommended Products',
    tabs: [], // authored tab labels, matched against API response keys
    endpoint: WPT_DEFAULT_ENDPOINT,
    // static card sub-labels (UI chrome, sensible defaults)
    keyFeatures: 'Key Features',
    priceLabel: 'Price (per sqft)',
    viewDetails: 'View product details',
    wfLabel: 'Waterproofing Product',
    viewProduct: 'View product',
  };

  (rows || []).forEach((row) => {
    const cells = [...row.children];
    if (cells.length < 2) return;
    const key = slug(cells[0].textContent);
    const valueCell = cells[1];
    const list = [...valueCell.querySelectorAll('li')].map((li) => li.textContent.trim());
    const text = valueCell.textContent.trim();
    const rich = (valueCell.querySelector('p') || valueCell).innerHTML;
    switch (key) {
      case 'restart': cfg.restart = text; break;
      case 'title': cfg.title = rich; break;
      case 'subtitle': cfg.subtitle = text; break;
      case 'inputs': cfg.inputs = list; break;
      case 'download-text': cfg.downloadText = rich; break;
      case 'download-cta': cfg.downloadCta = text; break;
      case 'products-title': cfg.productsTitle = text; break;
      case 'tabs': cfg.tabs = list; break;
      case 'endpoint': case 'api': cfg.endpoint = text; break;
      default: break;
    }
  });
  return cfg;
}

// Build one product card from an API product entry, appending the shared
// waterproofing product (wfProduct) in the footer.
function buildProductCard(product, wfProduct, cfg) {
  const card = document.createElement('article');
  card.className = 'wallpainttool-product';

  const head = document.createElement('div');
  head.className = 'wallpainttool-product-head';
  if (product.packShot) {
    const img = document.createElement('img');
    img.src = WPT_ASSET_BASE + product.packShot;
    img.alt = product.entityName || '';
    img.loading = 'lazy';
    head.append(img);
  }
  const name = document.createElement('strong');
  name.className = 'wallpainttool-product-name';
  name.textContent = product.entityName || '';
  head.append(name);
  card.append(head);

  // key features
  const kf = document.createElement('p');
  kf.className = 'wallpainttool-product-sublabel';
  kf.textContent = cfg.keyFeatures;
  card.append(kf);
  const tags = document.createElement('ul');
  tags.className = 'wallpainttool-product-tags';
  (product.visibleTags || []).forEach((t) => {
    const li = document.createElement('li');
    li.textContent = t;
    tags.append(li);
  });
  card.append(tags);

  // price (only when the API provides one)
  if (product.productPrice) {
    const priceLabel = document.createElement('p');
    priceLabel.className = 'wallpainttool-product-sublabel';
    priceLabel.textContent = cfg.priceLabel;
    card.append(priceLabel);
    const price = document.createElement('p');
    price.className = 'wallpainttool-product-price';
    price.textContent = `Rs.${product.productPrice}`;
    card.append(price);
  }

  // view details link
  if (product.pagePath) {
    const link = document.createElement('a');
    link.className = 'wallpainttool-product-link';
    link.href = WPT_ASSET_BASE + product.pagePath;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = cfg.viewDetails;
    card.append(link);
  }

  // shared waterproofing product footer
  if (wfProduct) {
    card.append(document.createElement('hr'));
    const wfLabel = document.createElement('p');
    wfLabel.className = 'wallpainttool-product-sublabel';
    wfLabel.textContent = cfg.wfLabel;
    card.append(wfLabel);

    const wf = document.createElement('div');
    wf.className = 'wallpainttool-wf';
    if (wfProduct.packShot) {
      const wfImg = document.createElement('img');
      wfImg.src = WPT_ASSET_BASE + wfProduct.packShot;
      wfImg.alt = wfProduct.entityName || '';
      wfImg.loading = 'lazy';
      wf.append(wfImg);
    }
    const wfBody = document.createElement('div');
    const wfName = document.createElement('strong');
    wfName.textContent = wfProduct.entityName || '';
    wfBody.append(wfName);
    if (wfProduct.pagePath) {
      const wfLink = document.createElement('a');
      wfLink.className = 'wallpainttool-product-link';
      wfLink.href = WPT_ASSET_BASE + wfProduct.pagePath;
      wfLink.target = '_blank';
      wfLink.rel = 'noopener';
      wfLink.textContent = cfg.viewProduct;
      wfBody.append(wfLink);
    }
    wf.append(wfBody);
    card.append(wf);
  }

  return card;
}

function buildStep3(rows) {
  const cfg = parseStep3Config(rows);

  const screen = document.createElement('div');
  screen.className = 'wallpainttool-screen wallpainttool-screen-3';
  screen.dataset.step = '3';

  // ---- LEFT column ----
  const left = document.createElement('div');
  left.className = 'wallpainttool-result-left';

  const restartBtn = document.createElement('button');
  restartBtn.type = 'button';
  restartBtn.className = 'wallpainttool-restart';
  restartBtn.innerHTML = `<span class="wallpainttool-restart-icon" aria-hidden="true"></span><span>${cfg.restart}</span>`;

  const title = document.createElement('h2');
  title.className = 'wallpainttool-result-title';
  title.innerHTML = cfg.title;

  const subtitle = document.createElement('p');
  subtitle.className = 'wallpainttool-result-subtitle';
  subtitle.textContent = cfg.subtitle;

  const inputsEl = document.createElement('ul');
  inputsEl.className = 'wallpainttool-inputs';

  const download = document.createElement('div');
  download.className = 'wallpainttool-download';
  const downloadText = document.createElement('p');
  downloadText.className = 'wallpainttool-download-text';
  const downloadCta = document.createElement('button');
  downloadCta.type = 'button';
  downloadCta.className = 'wallpainttool-proceed wallpainttool-download-cta';
  downloadCta.innerHTML = `<span>${cfg.downloadCta}</span>`;
  download.append(downloadText, downloadCta);

  left.append(restartBtn, title, subtitle, inputsEl, download);

  // ---- RIGHT column ----
  const right = document.createElement('div');
  right.className = 'wallpainttool-result-right';

  const tabsEl = document.createElement('div');
  tabsEl.className = 'wallpainttool-tabs';
  tabsEl.setAttribute('role', 'tablist');

  const productsTitle = document.createElement('h3');
  productsTitle.className = 'wallpainttool-products-title';
  productsTitle.textContent = cfg.productsTitle;

  const productsEl = document.createElement('div');
  productsEl.className = 'wallpainttool-products';

  right.append(tabsEl, productsTitle, productsEl);

  const result = document.createElement('div');
  result.className = 'wallpainttool-result';
  result.append(left, right);
  screen.append(result);

  // render the download-text with the active tab substituted for {tab}
  function renderDownloadText(tabLabel) {
    const html = (cfg.downloadText || '').replace(
      /\{tab\}/gi,
      `<span class="wallpainttool-download-tab">${(tabLabel || '').toUpperCase()}</span>`,
    );
    downloadText.innerHTML = html;
  }

  // rank the API's word-numbered product keys (productOne, productTwo, ...)
  // in natural order — a plain string sort would place "Three" before "Two".
  const WPT_ORDINALS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  const productRank = (key) => {
    const word = key.toLowerCase().replace(/^product/, '');
    const idx = WPT_ORDINALS.indexOf(word);
    return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
  };

  // render the product cards for the given tab key from the API data
  function renderProducts(data, tabKey) {
    productsEl.textContent = '';
    const group = data[tabKey] || {};
    const wfProduct = group.wfProduct || null;
    // main products are every entry except the shared waterproofing product,
    // ordered productOne, productTwo, productThree, ...
    Object.keys(group)
      .filter((k) => k !== 'wfProduct')
      .sort((a, b) => productRank(a) - productRank(b))
      .forEach((k) => productsEl.append(buildProductCard(group[k], wfProduct, cfg)));
  }

  // populate the left-column input summary from the selected answers,
  // pairing each authored label with the corresponding answer.
  function renderInputs(answers) {
    inputsEl.textContent = '';
    cfg.inputs.forEach((label, i) => {
      const li = document.createElement('li');
      li.innerHTML = `${label} - <strong>${answers[i] || ''}</strong>`;
      inputsEl.append(li);
    });
  }

  // build the tab buttons for whichever authored tabs exist in the response,
  // wire selection, and render the first available tab.
  function renderTabs(data, answers) {
    tabsEl.textContent = '';
    const available = cfg.tabs.filter((label) => Object.keys(data)
      .some((k) => k.toLowerCase() === label.toLowerCase()));
    const tabKeyFor = (label) => Object.keys(data)
      .find((k) => k.toLowerCase() === label.toLowerCase());

    const select = (label) => {
      [...tabsEl.children].forEach((b) => b.classList.toggle('is-active', b.dataset.tab === label));
      renderProducts(data, tabKeyFor(label));
      renderDownloadText(label);
    };

    available.forEach((label) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'wallpainttool-tab';
      btn.dataset.tab = label;
      btn.textContent = label;
      btn.addEventListener('click', () => select(label));
      tabsEl.append(btn);
    });

    renderInputs(answers);
    if (available.length) select(available[0]);
  }

  return { screen, restartBtn, render: renderTabs };
}

export default function decorate(block) {
  const allRows = [...block.children];
  if (!allRows.length) return;

  // Background images are authored once (as the image row under Step 1) but
  // shared by every step, so they are read from the block and exposed as CSS
  // custom properties. First <img> = desktop, second = mobile; the "?"-strip
  // drops any DA rendition query so the source stays crisp.
  const imgs = [...block.querySelectorAll('img')];
  const desktopSrc = imgs[0] ? (imgs[0].currentSrc || imgs[0].src).split('?')[0] : '';
  const mobileSrc = imgs[1] ? (imgs[1].currentSrc || imgs[1].src).split('?')[0] : desktopSrc;

  // Build each step's DOM subtree from its authored rows.
  const steps = splitSteps(allRows);
  const step1 = buildStep1(steps[0] || []);
  const step2 = buildStep2(steps[1] || []);
  const step3 = buildStep3(steps[2] || []);
  const cfg = parseStep3Config(steps[2] || []);

  // Once the form has been completed at least once we skip Step 2 on
  // subsequent Proceeds (the "Restart" flow lets users tweak Step 1 answers
  // and jump straight back to the results).
  let formCompleted = false;

  // Read the three Step 1 answers (area, seepage, finish) in order.
  const step1Answers = () => [...step1.form.querySelectorAll('input[type="radio"]:checked')]
    .map((r) => r.value);

  // Fetch recommendations and show the results screen.
  async function showResults() {
    const [area, seepage, finish] = step1Answers();
    const params = new URLSearchParams({ area, seepage, finish });
    const url = `${cfg.endpoint}?${params.toString()}`;
    block.dataset.loading = 'true';
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      step3.render(data, [area, seepage, finish]);
      block.dataset.screen = '3';
    } catch (err) {
      // TEMP QA: the live API isn't reachable from the browser yet (CORS), so
      // fall back to sample data to let Step 3 be QA'd. Remove WPT_SAMPLE_DATA
      // and this fallback once the endpoint is CORS-enabled.
      // eslint-disable-next-line no-console
      console.warn('wallpainttool recommendation request failed; using sample data', err);
      step3.render(WPT_SAMPLE_DATA, [area, seepage, finish]);
      block.dataset.screen = '3';
    } finally {
      block.dataset.loading = 'false';
    }
  }

  // Navigation is driven by a single `data-screen` attribute on the block;
  // the CSS shows only the matching step and hides the rest. All three steps
  // stay in the DOM so form state is preserved when moving between them.
  step1.form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (step1.proceed.disabled) return; // guard: questions not all answered
    // Skip Step 2 when authored to (Skip Form = true) or once the lead form
    // has already been completed; otherwise show the lead form.
    if (step2.skipForm || formCompleted) {
      showResults();
    } else {
      block.dataset.screen = '2';
    }
  });

  if (step2.form) {
    step2.form.addEventListener('submit', (e) => {
      e.preventDefault();
      // TODO: validation temporarily disabled for testing screen 3 —
      // re-enable step2.form.checkValidity()/reportValidity() before launch.
      formCompleted = true;
      showResults();
    });
  }

  // Restart returns to Step 1 with the previous answers preserved so the
  // user can adjust them; the lead form is skipped on the next Proceed.
  if (step3.restartBtn) {
    step3.restartBtn.addEventListener('click', () => {
      block.dataset.screen = '1';
    });
  }

  // Replace the authored table with the assembled steps and start on step 1.
  block.textContent = '';
  if (desktopSrc) block.style.setProperty('--wpt-bg-desktop', `url("${desktopSrc}")`);
  if (mobileSrc) block.style.setProperty('--wpt-bg-mobile', `url("${mobileSrc}")`);
  block.dataset.screen = '1';
  block.append(step1.screen, step2.screen, step3.screen);
}
