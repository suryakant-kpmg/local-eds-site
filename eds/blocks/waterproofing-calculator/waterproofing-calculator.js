function splitList(value) {
  return (value || '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

function getConfig(block) {
  // UE renders each field in its own div, often grouped by prefixes.
  // We defensively query by data-name if present, else fallback to block children.
  const byName = (name) => block.querySelector(`[data-name="${name}"]`) || [...block.children].find((d) => d.textContent?.includes(name)) || null;

  const title = block.querySelector('h1, h2, h3, p') ? null : null; // not relied on

  // Preferred: read direct div order as UE outputs a div per field.
  const divs = [...block.querySelectorAll(':scope > div')];

  // Heuristic mapping based on our model field order:
  const config = {
    titleHTML: divs[0]?.innerHTML?.trim() || '',
    surfaces: divs[1]?.textContent?.trim() || '',
    projectTypes: divs[2]?.textContent?.trim() || '',
    areaUnit: divs[3]?.textContent?.trim() || 'SQFT',
    primaryCtaText: divs[4]?.textContent?.trim() || 'Calculate',
    endpoint: divs[5]?.textContent?.trim() || ''
  };

  // Clean titleHTML: UE may wrap richtext in extra tags; keep as-is.
  return config;
}

async function postEstimate(endpoint, payload) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Estimate API failed: ${res.status}`);
  return res.json().catch(() => ({}));
}

function placeholderEstimate({ surface, projectType, area }) {
  // Placeholder only. Replace with your real pricing logic/service.
  const base = 10; // arbitrary
  const surfaceFactor = {
    'Terrace/Roof': 1.6,
    Bathroom: 1.2,
    'Exterior Walls': 1.4,
    'Interior Walls': 1.1,
    Tank: 1.3,
  }[surface] || 1.0;

  const projectFactor = projectType === 'Fresh Construction' ? 1.0 : 1.15;

  return Math.round(area * base * surfaceFactor * projectFactor);
}

export default async function decorate(block) {
  const cfg = getConfig(block);

  const surfaces = splitList(cfg.surfaces);
  const projectTypes = splitList(cfg.projectTypes);

  // Render UI
  block.innerHTML = `
    <div class="wpcalc">
      <div class="wpcalc__header">${cfg.titleHTML || ''}</div>

      <form class="wpcalc__form">
        <label>
          <span>1. Select your surface</span>
          <select name="surface" required>
            ${surfaces.map((s) => `<option value="${s}">${s}</option>`).join('')}
          </select>
        </label>

        <label>
          <span>2. Select the type of project</span>
          <select name="projectType" required>
            ${projectTypes.map((t) => `<option value="${t}">${t}</option>`).join('')}
          </select>
        </label>

        <label>
          <span>3. Enter total area in ${cfg.areaUnit || 'SQFT'}</span>
          <input name="area" type="number" min="1" step="1" inputmode="numeric" required />
        </label>

        <label>
          <span>PIN Code</span>
          <input name="pin" type="text" inputmode="numeric" maxlength="6" pattern="\\d{6}" placeholder="6-digit PIN" required />
        </label>

        <button type="submit" class="wpcalc__cta">${cfg.primaryCtaText || 'Calculate now'}</button>

        <div class="wpcalc__result" aria-live="polite"></div>
      </form>
    </div>
  `;

  const form = block.querySelector('.wpcalc__form');
  const result = block.querySelector('.wpcalc__result');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    result.textContent = 'Calculating…';

    const data = Object.fromEntries(new FormData(form).entries());
    const payload = {
      surface: data.surface,
      projectType: data.projectType,
      area: Number(data.area),
      pin: data.pin,
      source: 'eds-waterproofing-calculator',
    };

    try {
      if (cfg.endpoint) {
        const apiRes = await postEstimate(cfg.endpoint, payload);
        // Expecting API to return something like { estimate: number, currency: "INR", ... }
        const est = apiRes.estimate ?? apiRes.price ?? apiRes.amount;
        result.textContent = est != null
          ? `Estimated budget: ${est} ${apiRes.currency || ''}`.trim()
          : 'Estimate generated (API response received).';
      } else {
        const est = placeholderEstimate(payload);
        result.textContent = `Estimated budget (placeholder): ${est}`;
      }
    } catch (err) {
      result.textContent = 'Sorry—could not calculate right now.';
      // Optional: console for debugging
      // eslint-disable-next-line no-console
      console.error(err);
    }
  });
}