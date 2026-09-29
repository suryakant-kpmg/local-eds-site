import { triggerCTAClickWithLinkAndTitle } from '../../scripts/analytics_1.js';

export default function decorate(block) {
  const cards = [...block.children];

  cards.forEach((card) => {
    const [nameCell, contentCell] = card.children;

    // Get the name/title
    const name = nameCell?.textContent?.trim() || '';

    // Get content from second cell - support two images: background + packshot
    const pictures = contentCell?.querySelectorAll('picture') || [];
    const backgroundPicture = pictures[0]; // First image is background texture
    const packshotPicture = pictures[1]; // Second image is paint bucket packshot
    const paragraphs = contentCell?.querySelectorAll('p') || [];
    let description = '';
    let link = null;
    let btn = null;

    paragraphs.forEach((p) => {
      const anchor = p.querySelector('a');
      if (anchor) {
        link = anchor;
      } else if (p.textContent.trim() && !p.querySelector('picture')) {
        description = p.textContent.trim();
      }
    });

    // Clear the card
    card.innerHTML = '';
    card.className = 'cards-textures-card';

    // Create background image container (texture image)
    if (backgroundPicture) {
      const bgContainer = document.createElement('div');
      bgContainer.className = 'card-background';
      bgContainer.appendChild(backgroundPicture);
      card.appendChild(bgContainer);
    }

    // Create card name (always visible at bottom)
    const cardName = document.createElement('div');
    cardName.className = 'card-name';
    cardName.textContent = name;
    card.appendChild(cardName);

    // Create hover overlay content
    const hoverContent = document.createElement('div');
    hoverContent.className = 'card-hover-content';

    const isDesktop = window.matchMedia('(min-width: 992px)').matches;

    // 1. Paint bucket/packshot image should come first
    if (packshotPicture) {
      const bucketContainer = document.createElement('div');
      bucketContainer.className = 'card-bucket';
      bucketContainer.appendChild(packshotPicture);
      hoverContent.appendChild(bucketContainer);
    }

    // 2. Wrapper should come after card-bucket, only for desktop
    let hoverAppendTarget = hoverContent;

    if (isDesktop) {
      const hoverWrapper = document.createElement('div');
      hoverWrapper.className = 'wrapper'; // keeping your class name
      hoverContent.appendChild(hoverWrapper);

      hoverAppendTarget = hoverWrapper;
    }

    // Title in hover state
    const hoverTitle = document.createElement('h4');
    hoverTitle.className = 'card-hover-title';
    hoverTitle.textContent = name;
    hoverAppendTarget.appendChild(hoverTitle);

    // Description
    if (description) {
      const desc = document.createElement('p');
      desc.className = 'card-description';
      desc.textContent = description;
      hoverAppendTarget.appendChild(desc);
    }

    // View Details button
    if (link) {
      btn = document.createElement('a');
      btn.className = 'card-button';
      btn.href = link.href;
      btn.innerHTML = `${link.textContent} <span class="arrow"></span>`;
      hoverAppendTarget.appendChild(btn);
    }

    card.appendChild(hoverContent);

    // Make entire card clickable / mobile expand-collapse
    if (link) {
      const ctaLink = link.href;
      const btnTitle = link.textContent.trim();

      btn?.addEventListener('click', (e) => {
        e.stopPropagation();

        triggerCTAClickWithLinkAndTitle(ctaLink, btnTitle, name);
        window.location.href = ctaLink;
      });

      card.addEventListener('click', (e) => {
        const clickedCard = e.currentTarget;

        // CTA should redirect
        if (e.target.closest('.card-button')) return;

        // Mobile: card click only expands/collapses
        if (window.innerWidth < 990) {
          e.preventDefault();

          const isExpanded = clickedCard.classList.contains('child-open');

          // Close all cards first
          block.querySelectorAll('.cards-textures-card.child-open').forEach((openCard) => {
            if (openCard !== clickedCard) {
              openCard.classList.remove('child-open');
            }
          });

          // Toggle only clicked card
          clickedCard.classList.toggle('child-open', !isExpanded);
        }
      });
    }
  });
  // Open first card by default on mobile
  if (window.innerWidth < 990) {
    const firstCard = block.querySelector('.cards-textures-card');

    if (firstCard) {
      firstCard.classList.add('child-open');
    }
  }
}
