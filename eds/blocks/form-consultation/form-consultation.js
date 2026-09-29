export default function decorate(block) {
  // Clear existing content
  block.textContent = '';

  // Header section
  const header = document.createElement('div');
  header.className = 'form-consultation-header';

  const title = document.createElement('h2');
  title.className = 'form-consultation-title';
  title.textContent = 'Get the right assistance for all your painting needs';

  const subtitle = document.createElement('p');
  subtitle.className = 'form-consultation-subtitle';
  subtitle.textContent = 'Fill the form below to book a free site evaluation by an Asian Paints Beautiful Homes Service expert.';

  header.appendChild(title);
  header.appendChild(subtitle);
  block.appendChild(header);

  // Form element
  const form = document.createElement('form');
  form.className = 'form-consultation-form';

  // Name field
  const nameField = createInputField('text', 'Enter your name', 'name');
  form.appendChild(nameField);

  // Email field
  const emailField = createInputField('email', 'Enter your Email', 'email');
  form.appendChild(emailField);

  // Mobile field with +91 prefix
  const mobileField = createMobileField();
  form.appendChild(mobileField);

  // Pincode field
  const pincodeField = createInputField('text', 'Enter your Pincode', 'pincode');
  form.appendChild(pincodeField);

  // WhatsApp checkbox
  const whatsappWrapper = document.createElement('div');
  whatsappWrapper.className = 'form-consultation-whatsapp';

  const whatsappLabel = document.createElement('label');
  whatsappLabel.className = 'form-consultation-checkbox-wrapper';

  const whatsappCheckbox = document.createElement('input');
  whatsappCheckbox.type = 'checkbox';
  whatsappCheckbox.name = 'whatsapp';
  whatsappCheckbox.checked = true;
  whatsappCheckbox.className = 'form-consultation-checkbox';

  const whatsappText = document.createElement('span');
  whatsappText.className = 'form-consultation-checkbox-label';
  whatsappText.textContent = 'Yes, I would like to receive important updates and notifications on WhatsApp';

  whatsappLabel.appendChild(whatsappCheckbox);
  whatsappLabel.appendChild(whatsappText);
  whatsappWrapper.appendChild(whatsappLabel);
  form.appendChild(whatsappWrapper);

  // Disclaimer
  const disclaimer = document.createElement('p');
  disclaimer.className = 'form-consultation-disclaimer';
  disclaimer.textContent = 'By proceeding, you are authorizing Asian Paints and its suggested contractors to get in touch with you through calls, sms, or e-mail';
  form.appendChild(disclaimer);

  // Radio button group 1 - Construction work
  const radioGroup1 = createRadioGroup('Is any construction work going on at your house?', 'construction', [
    { value: 'yes', label: 'Yes' },
    { value: 'no', label: 'No' },
  ]);
  form.appendChild(radioGroup1);

  // Radio button group 2 - Local painter
  const radioGroup2 = createRadioGroup('Is there a local painter hired?', 'painter', [
    { value: 'yes', label: 'Yes' },
    { value: 'no', label: 'No' },
  ]);
  form.appendChild(radioGroup2);

  // Submit button
  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.className = 'form-consultation-submit';
  submitBtn.textContent = 'ENQUIRE NOW';
  form.appendChild(submitBtn);

  block.appendChild(form);

  // Form submit handler
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    // Handle form submission
    window.location.href = 'https://www.asianpaints.com/services/asian-paints-safe-painting-service.html';
  });
}

function createInputField(type, placeholder, name) {
  const wrapper = document.createElement('div');
  wrapper.className = 'form-consultation-field';

  const input = document.createElement('input');
  input.type = type;
  input.placeholder = placeholder;
  input.name = name;
  input.className = 'form-consultation-input';
  input.required = true;

  wrapper.appendChild(input);
  return wrapper;
}

function createMobileField() {
  const wrapper = document.createElement('div');
  wrapper.className = 'form-consultation-field form-consultation-mobile-field';

  const prefix = document.createElement('span');
  prefix.className = 'form-consultation-mobile-prefix';
  prefix.textContent = '+91';

  const input = document.createElement('input');
  input.type = 'tel';
  input.placeholder = 'Enter mobile number';
  input.name = 'mobile';
  input.className = 'form-consultation-input';
  input.pattern = '[0-9]{10}';
  input.maxLength = 10;
  input.required = true;

  wrapper.appendChild(prefix);
  wrapper.appendChild(input);
  return wrapper;
}

function createRadioGroup(label, name, options) {
  const wrapper = document.createElement('div');
  wrapper.className = 'form-consultation-radio-group';

  const labelEl = document.createElement('span');
  labelEl.className = 'form-consultation-radio-label';
  labelEl.textContent = label;
  wrapper.appendChild(labelEl);

  const optionsWrapper = document.createElement('div');
  optionsWrapper.className = 'form-consultation-radio-options';

  options.forEach((opt, index) => {
    const optionLabel = document.createElement('label');
    optionLabel.className = 'form-consultation-radio-option';

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = name;
    radio.value = opt.value;
    radio.className = 'form-consultation-radio';
    if (index === 0) radio.checked = true;

    const text = document.createElement('span');
    text.className = 'form-consultation-radio-text';
    text.textContent = opt.label;

    optionLabel.appendChild(radio);
    optionLabel.appendChild(text);
    optionsWrapper.appendChild(optionLabel);
  });

  wrapper.appendChild(optionsWrapper);
  return wrapper;
}
