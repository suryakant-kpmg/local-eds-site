import { triggerCTAClickWithLinkAndTitle } from '../../scripts/analytics_1.js';

export default function decorate(block) {

  /* =========================
       STEP 1: FIND SECTION + SIBLINGS
    ========================= */

  const section = block.closest(".section");
  if (!section) return;

  const defaultContent = section.querySelector(".default-content-wrapper");
  const iconsWrapper = block.closest(".homepage-icons-container-wrapper");

  if (!defaultContent || !iconsWrapper) return;

  const parentTitle = defaultContent
    .querySelector("h1, h2, h3, h4, h5, h6")
    ?.textContent
    ?.trim() || "";

  /* =========================
       STEP 2: WRAP BOTH (ONCE)
    ========================= */

  if (!section.querySelector(".home-icon-content-wrapper")) {
    const parent = document.createElement("div");
    parent.className = "home-icon-content-wrapper";

    section.insertBefore(parent, defaultContent);
    parent.appendChild(defaultContent);
    parent.appendChild(iconsWrapper);
  }

  /* =========================
       STEP 3: TRANSFORM ITEMS
    ========================= */

  const rows = [...block.children];
  block.innerHTML = "";

  rows.forEach((row) => {
    const cols = [...row.children];

    const titleEls = cols[0]?.querySelectorAll("p") || [];
    const desktopSvg = cols[1]?.querySelector("a")?.href;
    const mobileSvg = cols[2]?.querySelector("a")?.href;
    const link = cols[3]?.querySelector("a")?.href;

    if (!desktopSvg || !mobileSvg || !link) return;

    const first = titleEls[0]?.textContent?.trim() || "";
    const last = titleEls[1]?.textContent?.trim() || "";
    const btnTitle = [first, last].filter(Boolean).join(" ");

    /* ===== CREATE LINK ===== */

    const a = document.createElement("a");
    a.href = link;
    a.className = "icon-item banner-icon";
    a.title = btnTitle;
    a.target = "_self";
    a.addEventListener("click", () => {
      triggerCTAClickWithLinkAndTitle(link, btnTitle, parentTitle);
    });

    /* ===== FIGURE ===== */

    const figure = document.createElement("figure");

    const iconWrapper = document.createElement("div");
    iconWrapper.className = "icon-wrapper";

    const picture = document.createElement("picture");

    const sourceDesktop = document.createElement("source");
    sourceDesktop.media = "(min-width:992px)";
    sourceDesktop.srcset = desktopSvg;

    const sourceMobile = document.createElement("source");
    sourceMobile.media = "(min-width:320px)";
    sourceMobile.srcset = mobileSvg;

    const img = document.createElement("img");
    img.src = desktopSvg;
    img.alt = `${first}-${last}`.toLowerCase().replace(/\s+/g, "-");
    img.width = 50;
    img.height = 50;

    picture.append(sourceDesktop, sourceMobile, img);
    iconWrapper.appendChild(picture);

    /* ===== CAPTION ===== */

    const figcaption = document.createElement("figcaption");
    figcaption.innerHTML = `${first} <span class="last-word">${last}</span>`;

    /* ===== ASSEMBLE ===== */

    figure.appendChild(iconWrapper);
    figure.appendChild(figcaption);
    a.appendChild(figure);

    block.appendChild(a);
  });
}
