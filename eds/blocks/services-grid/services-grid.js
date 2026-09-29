import { trackEvent, ga4Implementaion, pushAdobeCtaClickEvent } from '../../scripts/analytics_1.js';

export default function decorate(block) {
  const row = block.querySelector(':scope > div');
  if (!row) return;

  const columns = [...row.children];
  if (columns.length < 4) return;

  // Column 1 = text
  const textCol = columns[0];
  textCol.classList.add('services-grid-text');
  const parentTitle = textCol.querySelector('h2, h1, h3, h4, h5, h6')?.textContent?.trim() || '';

  // Column 2 = mobile images
  const mobileCol = columns[1];

  // Column 3 = desktop images
  const desktopCol = columns[2];

  // Column 4 = links
  const linkCol = columns[3];

  const mobileImages = [...mobileCol.querySelectorAll('img')];
  const desktopImages = [...desktopCol.querySelectorAll('img')];
  const links = [...linkCol.querySelectorAll('a')];

  const serviceNames = {
    Interior: 'Interior wall paint',
    Exterior: 'Exterior wall paint',
    Waterproofing: 'Waterproofing Services',
    'Wood Finish': 'Wood Solutions',
  };

  const servicesCol = document.createElement('div');
  servicesCol.className = 'services-grid-images';

  const gridContainer = document.createElement('div');
  gridContainer.className = 'services-grid-cards';

  const totalCards = Math.max(mobileImages.length, desktopImages.length);

  for (let i = 0; i < totalCards; i += 1) {
    const mobileImg = mobileImages[i];
    const desktopImg = desktopImages[i];
    const link = links[i];

    if (!mobileImg && !desktopImg) continue;

    const referenceImg = desktopImg || mobileImg;
    const altText = referenceImg?.alt?.trim() || 'Service';
    const serviceName = serviceNames[altText] || altText;

    const card = document.createElement('a');
    card.className = 'services-grid-card';

    // Apply authored link
    card.href = link?.href || '#';
    card.addEventListener('click', () => {
      const param1 = card.href || link?.href || '#';
      trackEvent('cta_link_text', {
        cta_: serviceName,
        parentTitle,
        param1,
      });

      pushAdobeCtaClickEvent({
        cta: serviceName,
        parentTitle,
        destinationUrl: param1,
        event: 'cta_link_text',
      });

      ga4Implementaion({
        event:'services_home_needs',
        click_text:serviceName,
        click_category:parentTitle
      })
    });

    const imgContainer = document.createElement('div');
    imgContainer.className = 'services-grid-card-image';

    const picture = document.createElement('picture');

    if (mobileImg?.src) {
      const mobileSource = document.createElement('source');
      mobileSource.media = '(max-width: 767px)';
      mobileSource.srcset = mobileImg.currentSrc || mobileImg.src;
      picture.appendChild(mobileSource);
    }

    if (desktopImg?.src) {
      const desktopSource = document.createElement('source');
      desktopSource.media = '(min-width: 768px)';
      desktopSource.srcset = desktopImg.currentSrc || desktopImg.src;
      picture.appendChild(desktopSource);
    }

    const img = document.createElement('img');
    img.src =
      desktopImg?.currentSrc ||
      desktopImg?.src ||
      mobileImg?.currentSrc ||
      mobileImg?.src ||
      '';

    img.alt = altText;
    img.loading = 'lazy';
    img.width = desktopImg?.width || mobileImg?.width || 82;
    img.height = desktopImg?.height || mobileImg?.height || 104;

    picture.appendChild(img);
    imgContainer.appendChild(picture);

    const textContainer = document.createElement('div');
    textContainer.className = 'services-grid-card-text';
    textContainer.innerHTML = `<span>${serviceName}</span>`;

    const arrow = document.createElement('div');
    arrow.className = 'services-grid-card-arrow';
    arrow.innerHTML = '↗';

    card.appendChild(imgContainer);
    card.appendChild(textContainer);
    card.appendChild(arrow);

    gridContainer.appendChild(card);
  }

  servicesCol.appendChild(gridContainer);

  block.innerHTML = '';
  block.append(textCol, servicesCol);

  row.remove();
}