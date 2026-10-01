import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';
import {
  getDigitalData, trackEvent, triggerCTAClickWithLinkAndTitle, pushAdobeCtaClickEvent,
} from '../../scripts/analytics_1.js';

/*
** Authoring format **
Row 1
Col 1 → Discover
Col 2 → Collections (gradient part of the title)
Col 3 → optional line below the title
Row 2
Col 1: left text design content
Col 2: right text design content
  (heading, description, Download PDF link, optional View link;
   a picture instead of the heading is shown as a logo)
Row 3
Col 1: left images
Col 2: right images
A side whose text and image cells are both empty is left out.

Variant "single" (Discover Collections (single)): one collage led by a logo with a
Download PDF button; images are optimized, lazy and square; 4 images on mobile.
*/

export default async function decorate(block) {
  await window.loadJQuery?.();
  const $ = window.jQuery;

  const $block = $(block);
  const $rows = $block.children();

  if ($rows.length < 3) return;

  const $titleCols = $rows.eq(0).children();
  const $contentCols = $rows.eq(1).children();
  const $imageCols = $rows.eq(2).children();

  if ($titleCols.length < 2 || $contentCols.length < 2 || $imageCols.length < 2) return;

  const isSingle = $block.hasClass('single');
  $block.empty().addClass('discover-collections');

  // single: rebuild authored pictures through the media bus, keeping UE instrumentation
  function optimizePicture(picture, width) {
    const img = picture.querySelector('img');
    if (!img) return picture.cloneNode(true);
    const optimized = createOptimizedPicture(img.src, img.alt, false, [{ width }]);
    moveInstrumentation(img, optimized.querySelector('img'));
    return optimized;
  }

  function getCellContent($cell) {
    const $preferred = $cell.find('h1,h2,h3,h4,h5,h6,p,span,div').first();
    return $preferred.text().trim() || $cell.text().trim();
  }

  function getHeading($cell) {
    return $cell.find('h1,h2,h3,h4,h5,h6').first();
  }

  function getDescription($cell) {
    return $cell.find('p').filter(function hasText() {
      return $(this).text().trim();
    }).first();
  }

  function getLinks($cell) {
    return $cell.find('a');
  }

  function getPdfAnalyticsData(title, href) {
    const pdfName = href.split('/').pop()?.replace(/\.pdf$/i, '') || '';

    return {
      Title: title,
      pdfName,
    };
  }

  function getPictures($cell) {
    if (isSingle) return $cell.find('picture').get().map((picture) => optimizePicture(picture, '750'));
    return $cell.find('picture').map(function clonePicture(i) {
      const $clone = $(this).clone();
      const $img = $clone.find('img');

      if ($img.length) {
        $img.attr('loading', i < 2 ? 'eager' : 'lazy');
        $img.attr('fetchpriority', i < 2 ? 'high' : 'auto');
        $img.removeAttr('width height');
      }

      return $clone[0];
    }).get();
  }

  function createArrowIcon() {
    return $(`
      <span class="discover-collections__cta-arrow">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M3 8H13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <path d="M9 4L13 8L9 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>
    `);
  }

  function createDownloadIcon() {
    return $(`
      <span class="discover-collections__download-icon">
        <img
          src="https://www.asianpaints.com/etc.clientlibs/apcolourcatalogue/clientlibs/clientlib-global/resources/images/download-icon-shade-tool.svg"
          alt="Download"
          loading="lazy"
          height="18"
          width="18"
        />
      </span>
    `);
  }

  function createBlockHeader() {
    const first = getCellContent($titleCols.eq(0));
    const second = getCellContent($titleCols.eq(1));
    const subtitle = $titleCols.length > 2 ? getCellContent($titleCols.eq(2)) : '';

    const $header = $(`
      <div class="discover-collections__block-header">
        <h2 class="discover-collections__block-title">
          ${first ? `<span class="discover-collections__block-title-main">${first}</span>` : ''}
          ${second ? `<span class="discover-collections__block-title-gradient">${second}</span>` : ''}
        </h2>
      </div>
    `);
    // optional third cell: a line below the title
    if (subtitle) $('<p class="discover-collections__block-subtitle"></p>').text(subtitle).appendTo($header);
    return $header;
  }

  function createTextBlock($cell) {
    const $wrap = $('<div class="discover-collections__text"></div>');

    const $heading = getHeading($cell);
    const $desc = getDescription($cell);
    const $links = getLinks($cell);

    const $title = $('<h3 class="discover-collections__title"></h3>').html($heading.html() || '');
    const $subtitle = $('<p class="discover-collections__subtitle"></p>').html($desc.html() || '');

    // no heading but a picture: show it as the collection logo
    const logo = $heading.length ? null : $cell.find('picture')[0];
    let $logo = null;
    if (logo) {
      $logo = $('<div class="discover-collections__logo"></div>')
        .append(isSingle ? optimizePicture(logo, '600') : $(logo).clone());
    }
    if (isSingle) moveInstrumentation($cell[0], $wrap[0]);

    const $actions = $('<div class="discover-collections__actions"></div>');

    if ($links[0]) {
      const $download = $($links[0]).clone()
        .addClass('discover-collections__download')
        .attr('target', '_blank')
        .attr('rel', 'noopener noreferrer');

      $download.on('click', () => {
        const href = $download.attr('href') || '';
        const data = getPdfAnalyticsData($heading.text().trim(), href);

        getDigitalData().download = data;
        trackEvent('download_form_pdf', data);

        pushAdobeCtaClickEvent({
          event: 'download_form_pdf',
          title: data.pdfName,
        });
      });

      $download.prepend(createDownloadIcon());
      // single: the label already says Download PDF, so the icon is decorative
      if (isSingle) $download.find('.discover-collections__download-icon img').attr('alt', '');
      $actions.append($download);
    }

    if ($links[1]) {
      const $view = $($links[1]).clone().addClass('discover-collections__cta');

      $view.on('click', () => {
        const href = $view.attr('href') || '';
        const buttonTitle = $view.text().trim();
        const parentTitle = $heading.text().trim();

        triggerCTAClickWithLinkAndTitle(href, buttonTitle, parentTitle);
      });

      $view.append(createArrowIcon());
      $actions.append($view);
    }

    $wrap.append($logo || $title, $subtitle, $actions);
    return $wrap;
  }

  function createImageCard(picture, index) {
    return $(`
      <div class="discover-collections__image discover-collections__image--${index + 1} is-hidden-before-animation"></div>
    `).append(picture);
  }

  function createVariant($contentCell, $imageCell, variantClass) {
    // leave out a side that has no text and no images
    if (!$contentCell.text().trim() && !$contentCell.find('picture').length
      && !$imageCell.find('picture').length) return null;

    const $section = $(`<section class="discover-collections__variant ${variantClass}"></section>`);
    const $collage = $('<div class="discover-collections__collage"></div>');
    const $primaryGroup = $('<div class="discover-collections__group discover-collections__group--primary"></div>');
    const $secondaryGroup = $('<div class="discover-collections__group discover-collections__group--secondary"></div>');

    const $oneToThree = $('<div class="one-to-three"></div>');
    const $oneToThreeColOne = $('<div class="column-one"></div>');
    const $oneToThreeColTwo = $('<div class="column-two"></div>');
    const $secondaryColOne = $('<div class="column-one"></div>');
    const $secondaryColTwo = $('<div class="column-two"></div>');

    $oneToThree.append($oneToThreeColOne, $oneToThreeColTwo);
    $primaryGroup.append(createTextBlock($contentCell), $oneToThree);
    $secondaryGroup.append($secondaryColOne, $secondaryColTwo);

    const pictures = getPictures($imageCell).slice(0, 8);

    pictures.forEach((pic, i) => {
      const $card = createImageCard(pic, i);

      if (i === 0) {
        $oneToThreeColOne.append($card);
      } else if (i < 3) {
        $oneToThreeColTwo.append($card);
      } else if (i < 6) {
        $secondaryColOne.append($card);
      } else {
        $secondaryColTwo.append($card);
      }
    });

    $collage.append($primaryGroup, $secondaryGroup);
    $section.append($collage);
    return $section;
  }

  function observeImagesOnce() {
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        $block.find('.discover-collections__image').each(function animateImage() {
          const $image = $(this);

          if ($image.data('animated')) return;
          $image.data('animated', true);

          $image.removeClass('is-hidden-before-animation');
          $image.addClass('animate-grow-from-center');
        });

        obs.unobserve(entry.target);
      });
    }, {
      threshold: 0,
      rootMargin: '0px 0px -10% 0px',
    });

    observer.observe($block[0]);
  }

  const $header = createBlockHeader();

  const $left = createVariant(
    $contentCols.eq(0),
    $imageCols.eq(0),
    'discover-collections__variant--left',
  );

  const $right = createVariant(
    $contentCols.eq(1),
    $imageCols.eq(1),
    'discover-collections__variant--right',
  );

  $block.append(...[$header, $left, $right].filter(Boolean));

  observeImagesOnce();
}
