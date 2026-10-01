import { createOptimizedPicture } from '../../scripts/aem.js';
import {   trackEvent , pushAdobeCtaClickEvent } from '../../scripts/analytics_1.js';

/**
 * processshowcase — a tabbed process/step showcase with per-tab video and a
 * section call-to-action.
 *
 * Authoring model (see README in processshowcase.css header). Row 1 is the
 * header; every following row is one of three kinds, keyed off its cells:
 *   Header : [ title | subtitle ]
 *   Card   : [ tab name | image | step label | step title | description ]
 *   Video  : [ tab name | video thumbnail(s) | "video" | youtube url ]
 *   CTA    : [ "cta" | cluster image | stat count | stat label | action link
 *             | mobile action text (optional) ]
 * The video thumbnail cell may hold ONE image (used at all sizes) or TWO
 * images — the first is the mobile thumbnail, the second the desktop one; they
 * render as a responsive <picture> (desktop swaps in at >=768px).
 * Cards/videos are grouped into panels by their (case-insensitive) tab name,
 * in first-seen order. The video (if any) renders after that tab's cards.
 * The CTA row is section-level and renders once, below the panels. Its
 * optional 6th cell replaces the action text below 992px (the source shows
 * "Talk to a painting expert" on mobile, "Get a FREE Site Inspection" on
 * desktop); without it the link text shows at every size.
 *
 * Implements the WAI-ARIA Tabs pattern (roving tabindex; Left/Right/Home/End;
 * aria-selected / aria-controls) and an accessible video lightbox (focus trap,
 * Esc/backdrop close, focus restore).
 */

let uid = 0;

/**
 * A doc cell's text is wrapped by the authoring pipeline: a plain line becomes
 * a <p>, and a line the author marked as a heading becomes an <h1>-<h6>. When
 * the cell is just that single wrapper, return its inner HTML so the block can
 * place the text in its own semantic element (avoiding a heading nested inside
 * a heading). Otherwise keep the cell's markup as-is.
 */
function cellInner(cell) {
  if (!cell) return '';
  const kids = [...cell.children];
  if (kids.length === 1 && /^(P|H[1-6])$/.test(kids[0].tagName)) return kids[0].innerHTML;
  return cell.innerHTML;
}

const text = (cell) => (cell?.textContent || '').trim();

/** Pull a usable URL from a cell — an <a href> if present, else the plain text. */
function cellUrl(cell) {
  const a = cell?.querySelector('a[href]');
  if (a) return a.getAttribute('href');
  const t = text(cell);
  return t || '';
}

function activateTab(tabs, panels, index) {
  tabs.forEach((tab, i) => {
    const selected = i === index;
    tab.setAttribute('aria-selected', selected ? 'true' : 'false');
    tab.setAttribute('tabindex', selected ? '0' : '-1');
    panels[i].hidden = !selected;
  });
}

/**
 * Build the video thumbnail media.
 * - Two images -> responsive <picture>: mobile <img> with a desktop <source>
 *   (min-width: 768px), each optimized via createOptimizedPicture.
 * - One image  -> a single optimized <picture> used at all sizes.
 * @param {HTMLImageElement[]} imgs source images (mobile first, then desktop)
 * @param {string} alt
 */
function buildVideoThumb(imgs, alt) {
  const [mobileImg, desktopImg] = imgs;
  const mobile = createOptimizedPicture(mobileImg.src, alt, false, [{ width: '750' }]);
  if (!desktopImg) {
    // single image: keep the desktop breakpoint too for larger screens
    return createOptimizedPicture(
      mobileImg.src,
      alt,
      false,
      [{ media: '(min-width: 768px)', width: '1200' }, { width: '750' }],
    );
  }
  // prepend desktop <source>s (webp + fallback) so they win at >=768px
  const desktop = createOptimizedPicture(desktopImg.src, alt, false, [{ width: '1200' }]);
  [...desktop.querySelectorAll('source')].reverse().forEach((src) => {
    src.setAttribute('media', '(min-width: 768px)');
    mobile.prepend(src);
  });
  return mobile;
}

/**
 * Turn a YouTube watch/embed/short URL into an embeddable, autoplaying src.
 * Falls back to the original string if no id can be parsed.
 */
function toEmbedUrl(url) {
  if (!url) return '';
  const idMatch = url.match(/(?:youtu\.be\/|\/embed\/|[?&]v=)([\w-]{6,})/);
  const id = idMatch ? idMatch[1] : null;
  const base = id ? `https://www.youtube.com/embed/${id}` : url;
  return `${base}${base.includes('?') ? '&' : '?'}autoplay=1&rel=0`;
}

/** Build one lightbox for the block. Returns { modal, open }. */
function createVideoModal(uidLocal) {
  const modal = document.createElement('div');
  modal.className = 'processshowcase-modal';
  modal.id = `processshowcase-${uidLocal}-modal`;
  modal.hidden = true;
  modal.innerHTML = `
    <div class="processshowcase-modal-backdrop" data-close></div>
    <div class="processshowcase-modal-dialog" role="dialog" aria-modal="true" aria-label="Process video">
      <button class="processshowcase-modal-close" type="button" data-close aria-label="Close video">&times;</button>
      <div class="processshowcase-modal-frame"></div>
    </div>`;

  const frame = modal.querySelector('.processshowcase-modal-frame');
  const dialog = modal.querySelector('.processshowcase-modal-dialog');
  const closeBtn = modal.querySelector('.processshowcase-modal-close');
  let lastFocused = null;

  const close = () => {
    modal.hidden = true;
    frame.replaceChildren();
    document.documentElement.style.removeProperty('overflow');
    if (lastFocused) lastFocused.focus();
  };

  const open = (embedUrl, triggerEl) => {
    lastFocused = triggerEl || document.activeElement;
    const iframe = document.createElement('iframe');
    iframe.src = embedUrl;
    iframe.title = 'Process video';
    iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
    iframe.setAttribute('allowfullscreen', '');
    frame.replaceChildren(iframe);
    modal.hidden = false;
    document.documentElement.style.setProperty('overflow', 'hidden');
    closeBtn.focus();
  };

  modal.addEventListener('click', (e) => {
    if (e.target.hasAttribute('data-close')) close();
  });
  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      close();
    } else if (e.key === 'Tab') {
      // simple focus trap — only the close button is focusable inside
      e.preventDefault();
      closeBtn.focus();
    }
  });
  // keep focus within the dialog
  dialog.addEventListener('keydown', (e) => e.stopPropagation());

  return { modal, open };
}

export default function decorate(block) {
  uid += 1;
  const rows = [...block.children];
  const headerRow = rows.shift();

  // --- header (title + subtitle) ---
  const header = document.createElement('div');
  header.className = 'processshowcase-header';
  if (headerRow) {
    const [titleCell, subtitleCell] = headerRow.children;
    if (titleCell && titleCell.textContent.trim()) {
      const h2 = document.createElement('h2');
      h2.className = 'processshowcase-title';
      h2.innerHTML = cellInner(titleCell);
      header.append(h2);
    }
    if (subtitleCell && subtitleCell.textContent.trim()) {
      const p = document.createElement('p');
      p.className = 'processshowcase-subtitle';
      p.innerHTML = cellInner(subtitleCell);
      header.append(p);
    }
  }

  // --- classify rows: cards + video grouped by tab; a single section CTA ---
  const groups = [];
  const byName = new Map();
  let cta = null;

  const groupFor = (name) => {
    const key = name.toLowerCase();
    let group = byName.get(key);
    if (!group) {
      group = { name, cards: [], video: null };
      byName.set(key, group);
      groups.push(group);
    }
    return group;
  };

  rows.forEach((row) => {
    const cells = [...row.children];
    const first = text(cells[0]);
    if (!first) return;

    if (first.toLowerCase() === 'cta') {
      cta = {
        imageCell: cells[1],
        count: text(cells[2]),
        label: text(cells[3]),
        actionCell: cells[4],
        mobileLabel: text(cells[5]),
      };
      return;
    }

    // tab-scoped row: video if the 3rd cell flags it, else a step card
    if (text(cells[2]).toLowerCase() === 'video') {
      groupFor(first).video = {
        imageCell: cells[1],
        url: cellUrl(cells[3]),
      };
      return;
    }

    groupFor(first).cards.push({
      imageCell: cells[1],
      label: text(cells[2]),
      titleCell: cells[3],
      descCell: cells[4],
    });
  });

  // --- build tablist + panels ---
  const tablist = document.createElement('div');
  tablist.className = 'processshowcase-tabs';
  tablist.setAttribute('role', 'tablist');
  const titleEl = header.querySelector('.processshowcase-title');
  tablist.setAttribute('aria-label', titleEl ? titleEl.textContent.trim() : 'Process stages');

  const panelsWrap = document.createElement('div');
  panelsWrap.className = 'processshowcase-panels';

  const tabs = [];
  const panels = [];
  const { modal, open: openVideo } = createVideoModal(uid);
  let hasVideo = false;

  groups.forEach((group, i) => {
    const tabId = `processshowcase-${uid}-tab-${i}`;
    const panelId = `processshowcase-${uid}-panel-${i}`;

    const tab = document.createElement('button');
    tab.className = 'processshowcase-tab';
    tab.type = 'button';
    tab.id = tabId;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', panelId);
    tab.textContent = group.name;
    tablist.append(tab);
    tabs.push(tab);

    const panel = document.createElement('div');
    panel.className = 'processshowcase-panel';
    panel.id = panelId;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tabId);
    panel.setAttribute('tabindex', '0');

    const list = document.createElement('ul');
    list.className = 'processshowcase-cards';

    group.cards.forEach((card) => {
      const li = document.createElement('li');
      li.className = 'processshowcase-card';

      const imgEl = card.imageCell?.querySelector('img');
      if (imgEl) {
        const imgWrap = document.createElement('div');
        imgWrap.className = 'processshowcase-card-image';
        imgWrap.append(createOptimizedPicture(
          imgEl.src,
          imgEl.alt || text(card.titleCell) || '',
          false,
          [{ media: '(min-width: 768px)', width: '480' }, { width: '300' }],
        ));
        li.append(imgWrap);
      }

      const body = document.createElement('div');
      body.className = 'processshowcase-card-body';
      if (card.label) {
        const span = document.createElement('span');
        span.className = 'processshowcase-step';
        span.textContent = card.label;
        body.append(span);
      }
      if (text(card.titleCell)) {
        const h3 = document.createElement('h3');
        h3.className = 'processshowcase-card-title';
        h3.innerHTML = cellInner(card.titleCell);
        body.append(h3);
      }
      if (text(card.descCell)) {
        const p = document.createElement('p');
        p.className = 'processshowcase-card-desc';
        p.innerHTML = cellInner(card.descCell);
        body.append(p);
      }
      li.append(body);
      list.append(li);
    });

    panel.append(list);

    // per-tab video thumbnail that opens the lightbox. The image cell may hold
    // one image (all sizes) or two (mobile first, desktop second).
    const vImgs = [...(group.video?.imageCell?.querySelectorAll('img') || [])];
    if (vImgs.length && group.video.url) {
      hasVideo = true;
      const trigger = document.createElement('button');
      trigger.className = 'processshowcase-video';
      trigger.type = 'button';
      trigger.setAttribute('aria-label', `Play video: ${group.name}`);
      const alt = vImgs[0].alt || `${group.name} video`;
      trigger.append(buildVideoThumb(vImgs, alt));
      const embed = toEmbedUrl(group.video.url);
      trigger.addEventListener('click', () => {
        openVideo(embed, trigger);

        trackEvent('video_playbotton_click', {
          videoTitle: titleEl?.textContent?.trim() || '',
        });

        pushAdobeCtaClickEvent({
          title: titleEl?.textContent?.trim() || '',
          event: 'video_playbotton_click',
        });

      });
      panel.append(trigger);
    }

    panelsWrap.append(panel);
    panels.push(panel);
  });

  // --- keyboard navigation (roving tabindex) ---
  tablist.addEventListener('keydown', (e) => {
    const current = tabs.indexOf(document.activeElement);
    if (current < 0) return;
    let next = -1;
    if (e.key === 'ArrowRight') next = (current + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (current - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    if (next >= 0) {
      e.preventDefault();
      activateTab(tabs, panels, next);
      tabs[next].focus();
    }
  });

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => {
      activateTab(tabs, panels, i);

      const btnTitle = tab.textContent.trim();
      const parentTitle = titleEl?.textContent?.trim() || '';

      trackEvent('custom_cta_click', {
        cta_: btnTitle,
        parentTitle,
        event: 'custom_cta_click',
      });
      pushAdobeCtaClickEvent({
        cta: btnTitle,
        parentTitle,
        event: 'custom_cta_click',
      });
    });
  });

  // --- section CTA ---
  let ctaEl = null;
  if (cta && (cta.count || cta.label || text(cta.actionCell))) {
    ctaEl = document.createElement('div');
    ctaEl.className = 'processshowcase-cta';

    const stats = document.createElement('div');
    stats.className = 'processshowcase-cta-stats';
    if (cta.count || cta.label) {
      const statText = document.createElement('div');
      statText.className = 'processshowcase-cta-text';
      if (cta.count) {
        const c = document.createElement('span');
        c.className = 'processshowcase-cta-count';
        c.textContent = cta.count;
        statText.append(c);
      }
      if (cta.label) {
        const l = document.createElement('span');
        l.className = 'processshowcase-cta-label';
        l.textContent = cta.label;
        statText.append(l);
      }
      stats.append(statText);
    }
    const clusterImg = cta.imageCell?.querySelector('img');
    if (clusterImg) {
      const cluster = document.createElement('span');
      cluster.className = 'processshowcase-cta-cluster';
      cluster.append(createOptimizedPicture(
        clusterImg.src,
        clusterImg.alt || '',
        false,
        [{ width: '360' }],
      ));
      stats.append(cluster);
    }
    ctaEl.append(stats);

    const actionLink = cta.actionCell?.querySelector('a[href]');
    const actionLabel = text(cta.actionCell);
    if (actionLink || actionLabel) {
      const action = document.createElement('a');
      action.className = 'processshowcase-cta-action';
      action.href = actionLink ? actionLink.getAttribute('href') : '#';
      const label = document.createElement('span');
      label.className = 'processshowcase-cta-action-label';
      label.textContent = actionLink ? actionLink.textContent.trim() : actionLabel;
      action.append(label);
      // optional mobile text: only one label is displayed (and announced) at a time
      if (cta.mobileLabel && cta.mobileLabel !== label.textContent) {
        label.classList.add('processshowcase-cta-action-label-desktop');
        const mobile = document.createElement('span');
        mobile.className = 'processshowcase-cta-action-label processshowcase-cta-action-label-mobile';
        mobile.textContent = cta.mobileLabel;
        action.append(mobile);
      }
      ctaEl.append(action);
    }
  }

  // --- assemble ---
  block.textContent = '';
  if (header.children.length) block.append(header);
  block.append(tablist, panelsWrap);
  if (ctaEl) block.append(ctaEl);
  if (hasVideo) block.append(modal);

  if (tabs.length) activateTab(tabs, panels, 0);
}
