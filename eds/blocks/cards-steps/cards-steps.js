/*
 * Cards Steps Block
 * Full-width blue gradient section with logo/CTAs on left and steps on right
 *
 * Expected structure from markdown:
 * Row 1: Logo (left) | Heading (right - **text**)
 * Row 2: CTA link (left) | empty (right)
 * Row 3: CTA link (left) | empty (right)
 * Row 4+: Step image (left) | Step title + description (right)
 */

export default async function decorate(block) {
  const rows = [...block.children];

  // Create main container
  const container = document.createElement('div');
  container.className = 'cards-steps-container';

  // Create left section (logo + CTAs)
  const leftSection = document.createElement('div');
  leftSection.className = 'cards-steps-intro';

  // Create right section (heading + steps)
  const rightSection = document.createElement('div');
  rightSection.className = 'cards-steps-right';

  let headingText = '';
  const ctaLinks = [];
  const steps = [];

  let headerProcessed = false;

  rows.forEach((row) => {
    const cols = [...row.children];
    if (cols.length < 2) return;

    const leftCol = cols[0];
    const rightCol = cols[1];

    const leftPicture = leftCol.querySelector('picture');
    const leftLink = leftCol.querySelector('a');
    const rightStrong = rightCol.querySelector('strong');
    const strongText = rightStrong ? rightStrong.textContent.trim() : '';

    // Check if this is the header row (logo + main heading)
    // Header row: has picture + strong text with "Professional" or "Services" (not "Step X:")
    if (!headerProcessed && leftPicture && rightStrong && !strongText.match(/^Step \d/i)) {
      // Logo in left column
      const logo = document.createElement('div');
      logo.className = 'cards-steps-logo';
      logo.appendChild(leftPicture.cloneNode(true));
      leftSection.appendChild(logo);

      // CTAs are also in the left column (same cell as logo)
      const leftLinks = leftCol.querySelectorAll('a');
      leftLinks.forEach((link) => {
        ctaLinks.push({
          href: link.href,
          text: link.textContent.trim(),
        });
      });

      // Heading for right side
      headingText = strongText;
      headerProcessed = true;
    } else if (leftPicture && rightStrong && strongText.match(/^Step \d/i)) {
      // Step item (image in left, title + desc in right)
      const title = strongText;
      const fullText = rightCol.textContent.trim();
      const desc = fullText.replace(title, '').trim();

      steps.push({
        picture: leftPicture.cloneNode(true),
        title,
        desc,
      });
    }
  });

  // Build CTAs in left section
  if (ctaLinks.length > 0) {
    const ctaContainer = document.createElement('div');
    ctaContainer.className = 'cards-steps-ctas';

    ctaLinks.forEach((link) => {
      const cta = document.createElement('a');
      cta.href = link.href;
      cta.className = 'cards-steps-cta';
      cta.textContent = link.text;
      ctaContainer.appendChild(cta);
    });

    leftSection.appendChild(ctaContainer);
  }

  // Build right section with heading and steps
  if (headingText) {
    const heading = document.createElement('h2');
    heading.className = 'cards-steps-right-heading';
    heading.textContent = headingText;
    rightSection.appendChild(heading);
  }

  if (steps.length > 0) {
    const stepsContainer = document.createElement('div');
    stepsContainer.className = 'cards-steps-list';

    steps.forEach((step) => {
      const stepEl = document.createElement('div');
      stepEl.className = 'cards-steps-step';

      const stepImage = document.createElement('div');
      stepImage.className = 'cards-steps-step-image';
      stepImage.appendChild(step.picture);

      const stepContent = document.createElement('div');
      stepContent.className = 'cards-steps-step-content';

      const stepTitle = document.createElement('h3');
      stepTitle.textContent = step.title;
      stepContent.appendChild(stepTitle);

      if (step.desc) {
        const stepDesc = document.createElement('p');
        stepDesc.textContent = step.desc;
        stepContent.appendChild(stepDesc);
      }

      stepEl.appendChild(stepImage);
      stepEl.appendChild(stepContent);
      stepsContainer.appendChild(stepEl);
    });

    rightSection.appendChild(stepsContainer);
  }

  // Clear block and add structured content
  block.textContent = '';
  container.appendChild(leftSection);
  container.appendChild(rightSection);
  block.appendChild(container);
}
