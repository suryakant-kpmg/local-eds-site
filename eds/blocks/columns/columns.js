export default function decorate(block) {
  const cols = [...block.firstElementChild.children];
  block.classList.add(`columns-${cols.length}-cols`);

  const isSplit = block.classList.contains('split');

  if (isSplit) {
    const hasImageCol = cols.some((col) => col.querySelector('picture'));
    const buttonLink = block.querySelector('a.button');

    if (hasImageCol && buttonLink) {
      const blockLink = document.createElement('a');
      blockLink.href = buttonLink.href;
      blockLink.target = buttonLink.target || '_self';
      blockLink.className = 'columns-split-link';
      blockLink.setAttribute('aria-label', buttonLink.textContent.trim());

      const buttonSpan = document.createElement('span');
      buttonSpan.className = buttonLink.className;
      buttonSpan.textContent = buttonLink.textContent;
      buttonLink.replaceWith(buttonSpan);

      const row = block.firstElementChild;
      while (row.firstChild) {
        blockLink.appendChild(row.firstChild);
      }
      row.appendChild(blockLink);
    }
  }

  [...block.children].forEach((row) => {
    [...row.children].forEach((col) => {
      const pic = col.querySelector('picture');
      if (pic) {
        const picWrapper = pic.closest('div');
        if (picWrapper && picWrapper.children.length === 1) {
          picWrapper.classList.add('columns-img-col');
        }
      }
    });
  });

  if (isSplit) {
    const heading = block.querySelector('h2');
    if (heading && heading.textContent.includes('Popular Shades')) {
      heading.innerHTML = heading.innerHTML.replace(
        'Popular Shades',
        'Popular <span class="gradient-text">Shades</span>',
      );
    }

    const contentCol = block.querySelector(`.columns-${cols.length}-cols > div > div:last-child`)
      || block.querySelector('div > div > div:last-child');
    if (contentCol) {
      const paragraph = contentCol.querySelector('p');
      const link = paragraph?.querySelector('a');
      if (paragraph && link) {
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'columns-split-button-container';
        link.classList.add('button');
        buttonContainer.appendChild(link);
        paragraph.after(buttonContainer);
      }
    }
  }
}
