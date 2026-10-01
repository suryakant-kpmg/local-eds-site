/*
 * Interior Texture Finder: PDF of the recommendations, drawn with jsPDF.
 * Loaded on demand when the visitor clicks "Download PDF".
 */
import { loadScript } from '../../scripts/aem.js';

const JSPDF_URL = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js';

const PAGE = { width: 595.28, height: 841.89, margin: 36 };
const COLORS = {
  page: [239, 239, 239],
  card: [255, 255, 255],
  text: [29, 29, 31],
  muted: [128, 128, 128],
  body: [77, 77, 77],
  line: [204, 204, 204],
  accent: [244, 120, 56],
};

const text = (el) => (el ? el.textContent.trim() : '');

/**
 * loads an image through a canvas so it can be embedded (same-origin or CORS images only)
 */
function loadImage(src, { maxWidth = 800, type = 'image/jpeg' } = {}) {
  if (!src) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const scale = Math.min(1, maxWidth / img.naturalWidth);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.naturalWidth * scale);
        canvas.height = Math.round(img.naturalHeight * scale);
        const ctx = canvas.getContext('2d');
        if (type === 'image/jpeg') {
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve({ data: canvas.toDataURL(type, 0.85), width: canvas.width, height: canvas.height });
      } catch (e) {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = new URL(src, window.location.href).href;
  });
}

function hexToRgb(hex) {
  const match = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(String(hex || '').trim());
  if (!match) return null;
  const value = match[1].length === 3 ? match[1].replace(/./g, '$&$&') : match[1];
  return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16));
}

// dark shades get white text so names stay readable
const readableOn = ([r, g, b]) => {
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness < 140 ? [255, 255, 255] : COLORS.text;
};

/**
 * turns an authored rich text cell into paragraphs and bullet points
 */
function richTextParts(cell) {
  if (!cell) return [];
  const parts = [];
  const walk = (node) => {
    [...node.children].forEach((child) => {
      if (child.tagName === 'UL' || child.tagName === 'OL') {
        [...child.children].forEach((li) => parts.push({ bullet: true, text: text(li) }));
      } else if (/^(P|H[1-6]|DIV)$/.test(child.tagName) && !child.querySelector('p, ul, ol, div')) {
        const heading = /^H[1-6]$/.test(child.tagName) || !!child.querySelector('strong');
        if (text(child)) parts.push({ heading, text: text(child) });
      } else {
        walk(child);
      }
    });
  };
  walk(cell);
  if (!parts.length && text(cell)) parts.push({ text: text(cell) });
  return parts;
}

export default async function createPdf(options) {
  if (!window.jspdf) await loadScript(options.library || JSPDF_URL);
  const { jsPDF: JsPdf } = window.jspdf;
  const doc = new JsPdf({ unit: 'pt', format: 'a4' });
  const { width: W, height: H, margin: M } = PAGE;
  const contentWidth = W - M * 2;
  let y = M;

  const paintPage = () => {
    doc.setFillColor(...COLORS.page);
    doc.rect(0, 0, W, H, 'F');
  };
  const ensure = (needed) => {
    if (y + needed > H - M) {
      doc.addPage();
      paintPage();
      y = M;
    }
  };
  const write = (value, x, top, {
    size = 11, bold = false, color = COLORS.text, maxWidth, align,
  } = {}) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = maxWidth ? doc.splitTextToSize(String(value || ''), maxWidth) : [String(value || '')];
    doc.text(lines, x, top, { baseline: 'top', align });
    return lines.length * size * 1.3;
  };

  const [logo, serviceImage, ...swatches] = await Promise.all([
    loadImage(options.logo, { maxWidth: 400, type: 'image/png' }),
    loadImage(options.serviceImage, { maxWidth: 1200, type: 'image/png' }),
    ...options.textures.map((t) => loadImage(t.swatch, { maxWidth: 400 })),
  ]);

  paintPage();

  // header: greeting and logo
  const user = options.user || {};
  write(`${options.greeting} ${user.name || ''},`.trim(), M, y, { size: 18, bold: true });
  if (logo) {
    const logoHeight = 36;
    const logoWidth = (logo.width / logo.height) * logoHeight;
    doc.addImage(logo.data, 'PNG', W - M - logoWidth, y - 4, logoWidth, logoHeight);
  }
  y += 44;

  richTextParts(options.headerDescription).forEach((part) => {
    y += write(part.text, M, y, { size: 11, color: COLORS.body, maxWidth: contentWidth }) + 4;
  });
  y += 4;
  if (user.mobile) {
    write(`${options.mobileLabel}:`, M, y, { size: 11, bold: true });
    write(user.mobile, M + doc.getTextWidth(`${options.mobileLabel}: `) + 2, y, { size: 11, color: COLORS.body });
    y += 16;
  }
  if (user.email) {
    write(`${options.emailLabel}:`, M, y, { size: 11, bold: true });
    write(user.email, M + doc.getTextWidth(`${options.emailLabel}: `) + 2, y, { size: 11, color: COLORS.body });
    y += 16;
  }
  (options.selections || []).forEach(({ label, value }, i) => {
    const x = M + i * (contentWidth / 3);
    write(`${label}: ${value || ''}`, x, y + 6, { size: 10, color: COLORS.muted });
  });
  y += 28;

  doc.setDrawColor(...COLORS.line);
  doc.setLineWidth(0.5);
  doc.line(M, y, W - M, y);
  y += 18;

  y += write(`${options.heading}${options.category ? ` – ${options.category}` : ''}`, M, y, { size: 16, bold: true }) + 8;

  // one card per texture
  const cardHeight = 168;
  const { labels } = options;
  options.textures.forEach((t, i) => {
    ensure(cardHeight + 14);
    doc.setFillColor(...COLORS.card);
    doc.roundedRect(M, y, contentWidth, cardHeight, 6, 6, 'F');

    const imageSize = cardHeight - 24;
    const swatch = swatches[i];
    if (swatch) {
      // crop to a square from the centre of the swatch
      const side = Math.min(swatch.width, swatch.height);
      const scale = imageSize / side;
      doc.saveGraphicsState();
      doc.roundedRect(M + 12, y + 12, imageSize, imageSize, 4, 4, null);
      doc.clip();
      doc.discardPath();
      doc.addImage(
        swatch.data,
        'JPEG',
        M + 12 - ((swatch.width - side) / 2) * scale,
        y + 12 - ((swatch.height - side) / 2) * scale,
        swatch.width * scale,
        swatch.height * scale,
      );
      doc.restoreGraphicsState();
    } else {
      const fill = hexToRgb(t.topCoatHex) || COLORS.line;
      doc.setFillColor(...fill);
      doc.roundedRect(M + 12, y + 12, imageSize, imageSize, 4, 4, 'F');
    }

    const left = M + 24 + imageSize;
    const leftWidth = 150;
    let ly = y + 14;
    ly += write(t.finish, left, ly, { size: 13, bold: true, maxWidth: leftWidth }) + 8;
    ly += write(labels.productUsed, left, ly, { size: 9, color: COLORS.muted }) + 2;
    ly += write(t.product, left, ly, { size: 11, maxWidth: leftWidth });
    write(t.productCode, left, ly, { size: 11 });

    const divider = left + leftWidth + 10;
    doc.setDrawColor(...COLORS.line);
    doc.line(divider, y + 14, divider, y + cardHeight - 14);

    const right = divider + 14;
    const rightWidth = M + contentWidth - 12 - right;
    let ry = y + 14;
    ry += write(labels.shadesUsed, right, ry, { size: 11, bold: true }) + 6;
    const shadeWidth = (rightWidth - 10) / 2;
    [
      [labels.topCoat, t.topCoatName, t.topCoatCode, t.topCoatHex],
      [labels.baseCoat, t.baseCoatName, t.baseCoatCode, t.baseCoatHex],
    ].forEach(([label, name, code, hex], j) => {
      const x = right + j * (shadeWidth + 10);
      write(label, x, ry, { size: 9, color: COLORS.muted });
      const fill = hexToRgb(hex) || [255, 255, 255];
      doc.setFillColor(...fill);
      doc.setDrawColor(117, 120, 123);
      doc.roundedRect(x, ry + 14, shadeWidth, 56, 4, 4, 'FD');
      const ink = readableOn(fill);
      write(name, x + 6, ry + 22, {
        size: 9, color: ink, maxWidth: shadeWidth - 12,
      });
      write(code, x + 6, ry + 52, { size: 9, color: ink });
    });
    if (t.link) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...COLORS.accent);
      const url = new URL(t.link, window.location.href).href;
      doc.textWithLink('View texture details', right, y + cardHeight - 24, { url });
    }
    y += cardHeight + 14;
  });

  // painting service promotion
  const serviceParts = richTextParts(options.serviceDescription);
  if (serviceImage || serviceParts.length) {
    y += 6;
    if (serviceImage) {
      const imageHeight = (serviceImage.height / serviceImage.width) * contentWidth;
      // keep the banner on the same page as the text below it
      ensure(imageHeight + 12 + serviceParts.length * 20);
      doc.addImage(serviceImage.data, 'PNG', M, y, contentWidth, imageHeight);
      y += imageHeight + 12;
    }
    serviceParts.forEach((part) => {
      ensure(40);
      if (part.bullet) {
        write('•', M + 6, y, { size: 11, color: COLORS.body });
        y += write(part.text, M + 18, y, {
          size: 11, color: COLORS.body, maxWidth: contentWidth - 18,
        }) + 3;
      } else {
        y += write(part.text, M, y, {
          size: 11, bold: part.heading, color: COLORS.body, maxWidth: contentWidth,
        }) + 8;
      }
    });
  }

  // footer on the last page
  const footer = text(options.footer);
  if (footer) {
    ensure(30);
    write(footer, W / 2, H - M - 12, {
      size: 10, color: COLORS.muted, align: 'center',
    });
  }

  doc.save(`${options.fileName || 'Interior_Texture_Recommendations'}.pdf`);
}
