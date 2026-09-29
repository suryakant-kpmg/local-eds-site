import { trackEvent, getAdobeBasePayload } from '../../scripts/analytics_1.js';

/**
 * Extract a URL from an authored cell — an anchor href, an image src,
 * or plain text, in that order of preference.
 */
function extractLinkFromCell(cell) {
    if (!cell) return '';

    const anchor = cell.querySelector('a');
    if (anchor?.href) return anchor.href;

    const img = cell.querySelector('img');
    if (img?.src) return img.src;

    return cell.textContent?.trim() || '';
}

export default async function decorate(block) {
    // Wait for jQuery because it is no longer loaded eagerly in the page head
    await window.loadJQuery?.();
    const $ = window.jQuery;

    const rows = [...block.children];
    if (rows.length < 2) return;

    const calculatorhubContent = rows[0];
    const calculatorhubInput = rows[1];

    // Row 3, col 1 → label (TOOL_LINK), col 2 → the calculator redirect link
    const toolLinkRow = rows[2];
    const toolLinkCells = toolLinkRow ? [...toolLinkRow.children] : [];
    const toolLink = extractLinkFromCell(toolLinkCells[1]) || extractLinkFromCell(toolLinkCells[0]);
    if (toolLinkRow) toolLinkRow.style.display = 'none';

    const calculatorhubContents = [...calculatorhubContent.children];
    const calculatorhubHeadingCol = calculatorhubContents[0];

    calculatorhubContent.classList.add('tool-description');
    calculatorhubHeadingCol.classList.add('miniform-calctext');

    const heading = calculatorhubHeadingCol.children[0];
    const description = calculatorhubHeadingCol.children[1];

    if (heading) heading.classList.add('calculatorhub-heading');
    if (description) description.classList.add('calculatorhub-subheading');

    calculatorhubInput.classList.add('tool-fields');

    /* Add form wrapper */
    const formMarkup = `<form id="toolsMiniForm" class="pbc-mini-form"
    data-attr-tool-link="${toolLink}"
    data-gtm-form-interact-id="0">
    <div class="form-group project-field">
        <div tabindex="0" class="focus-visible-auto-imp project-field-heading">1. Select your type of
            project<span>*</span></div>
        <div class="project-field-inputs">
            <label tabindex="0" role="checkbox" aria-checked="false" class="focus-visible-auto-imp" for="freshPainting">
                <input class="d-none" type="radio" id="freshPainting" name="project" value="Fresh Painting"
                    data-gtm-form-interact-field-id="0" style="display: none;">
                <span class="radiobtn">
                    <div class="option-icon">
                        <img alt="Fresh Painting" title="Fresh Painting" loading="lazy" fetchpriority="auto"
                            src="https://www.asianpaints.com/content/dam/apcolourcatalogue/asset/ap-revamp/sps-revamp/mini-pbc-tool/fresh_painting_new_new.webp"
                            width="50" height="50">
                    </div>
                    <h3 class="option-title">Fresh Painting</h3>
                </span>
            </label>
            <label tabindex="0" role="checkbox" aria-checked="false" class="focus-visible-auto-imp" for="Repainting">
                <input class="d-none" type="radio" id="Repainting" name="project" value="Repainting"
                    data-gtm-form-interact-field-id="3" style="display: none;">
                <span class="radiobtn">
                    <div class="option-icon">
                        <img alt="Repainting" title="Repainting" loading="lazy" fetchpriority="auto"
                            src="https://www.asianpaints.com/content/dam/apcolourcatalogue/asset/ap-revamp/sps-revamp/mini-pbc-tool/repainting-new-desk.webp">
                    </div>
                    <h3 class="option-title">Repainting</h3>
                </span>
            </label>
        </div>
    </div>
    <div class="form-group space-field">
        <div tabindex="0" class="focus-visible-auto-imp space-field-heading">2. Select the space<span>*</span></div>
        <div class="space-field-inputs">
            <label tabindex="0" role="checkbox" aria-checked="false" class="focus-visible-auto-imp" for="Interior">
                <input class="d-none" type="radio" id="Interior" name="space" value="Interior"
                    data-gtm-form-interact-field-id="1" style="display: none;">
                <span class="radiobtn">
                    <div class="option-icon">
                        <img alt="Interior" title="Interior" loading="lazy" fetchpriority="auto"
                            src="https://www.asianpaints.com/content/dam/apcolourcatalogue/asset/ap-revamp/sps-revamp/mini-pbc-tool/interior_new.webp">
                    </div>
                    <h3 class="option-title">Interior</h3>
                </span>
            </label>
            <label tabindex="0" role="checkbox" aria-checked="false" class="focus-visible-auto-imp" for="Exterior">
                <input class="d-none" type="radio" id="Exterior" name="space" value="Exterior"
                    data-gtm-form-interact-field-id="4" style="display: none;">
                <span class="radiobtn">
                    <div class="option-icon">
                        <img alt="Exterior" title="Exterior" loading="lazy" fetchpriority="auto"
                            src="https://www.asianpaints.com/content/dam/apcolourcatalogue/asset/ap-revamp/sps-revamp/mini-pbc-tool/exterior.webp">
                    </div>
                    <h3 class="option-title">Exterior</h3>
                </span>
            </label>
        </div>
    </div>
    <div class="form-group area-field">
        <label tabindex="0" class="focus-visible-auto-imp" for="area">3. Enter total area in SQFT<span>*</span></label>
        <input type="number" id="area" placeholder="Area in SQFT" name="area" data-gtm-form-interact-field-id="2">
        <div class="error-msg" style="visibility: hidden;"></div>
    </div>
    <div class="form-actions cta animated-btn-yellow-onhover-black round-corner-radius-button">
        <button type="button" id="calculate-now" class="animated-arrow-button ctaText">Calculate now<span
                class="arrow"></span><span class="rotating saving-progress-status d-none">↻</span></button>
    </div>
</form>`;

    $('.tool-fields div').remove();
    $('.tool-fields').append(formMarkup);

    // WCAG keyboard support for option selection
    $('.project-field-inputs label, .space-field-inputs label').on('keydown', function onKeydown(event) {
        if (event.key === 'Enter') {
            $(this).find('input[type="radio"]').prop('checked', true).trigger('change');
        }
    });

    setTimeout(() => {
        $('#toolsMiniForm').trigger('reset');
    }, 100);

    $('.project-field input[name="project"]').prop('checked', false);
    $('.space-field input[name="space"]').prop('checked', false);
    $('.area-field input[name="area"]').val('');
    $('#calculate-now').attr('disabled', 'disabled');
    $('#calculate-now').attr('aria-disabled', 'true');

    const miniFormValues = {
        ProjectType: 'Val1',
        SpaceType: 'Val2',
        Area: 'Val3',
    };

    $('#toolsMiniForm .form-actions #calculate-now').click(() => {
        const project = $('.project-field input[name="project"]:checked').val();
        const space = $('.space-field input[name="space"]:checked').val();
        const area = $('.area-field input[name="area"]').val();

        miniFormValues.ProjectType = project;
        miniFormValues.SpaceType = space;
        miniFormValues.Area = area;

        localStorage.setItem('miniFormValues', JSON.stringify(miniFormValues));

        if (
            $('#toolsMiniForm .space-field input[name=space]:checked').length
            && $('#toolsMiniForm .project-field input[name=project]:checked').length
            && parseInt($('#toolsMiniForm .area-field #area').val(), 10) > 99
        ) {
            const toolURL = $('form#toolsMiniForm').attr('data-attr-tool-link');

            const userInputValues = `${miniFormValues.ProjectType}|${miniFormValues.SpaceType}|${miniFormValues.Area}`;

            calculateContinue(userInputValues);

            $('#toolsMiniForm .form-actions .saving-progress-status').removeClass('d-none');
            window.location.href = toolURL;
        }
    });

    const miniForm = $('#toolsMiniForm');
    if (!miniForm.length) return;

    let formInteraction = false;

    // Spec: fire calc_start on first click anywhere on the calculator
    block.addEventListener('click', () => {
      if (!formInteraction) {
        calculateStart();
        formInteraction = true;
      }
    }, { once: false });

    miniForm.on('change keyup', '.space-field input, .project-field input, .area-field #area', () => {
        if (!formInteraction) {
            // calculator start event fire
            calculateStart();
            formInteraction = true;
        }

        if (
            miniForm.find('.space-field input[name=space]:checked').length
            && miniForm.find('.project-field input[name=project]:checked').length
            && parseInt(miniForm.find('.area-field #area').val(), 10) > 99
        ) {
            $('#calculate-now').removeAttr('disabled');
            $('#calculate-now').removeAttr('aria-disabled');
        } else {
            $('#calculate-now').attr('disabled', 'disabled');
            $('#calculate-now').attr('aria-disabled', 'true');
        }
    });

    miniForm.on('blur keyup', '.area-field #area', function onAreaChange() {
        if (parseInt($(this).val(), 10) < 100) {
            miniForm.find('.area-field .error-msg').css('visibility', 'visible');
        } else {
            miniForm.find('.area-field .error-msg').css('visibility', 'hidden');
        }
    });

    // Ensure all option icons have width & height to prevent layout shift (LCP improvement)
    document.querySelectorAll('.option-icon img').forEach((img) => {
        if (!img.getAttribute('width')) {
            img.setAttribute('width', '50');
        }
        if (!img.getAttribute('height')) {
            img.setAttribute('height', '50');
        }

        // Ensure consistent loading strategy
        img.loading = 'lazy';
        img.decoding = 'async';
        img.setAttribute('fetchpriority', 'auto');
    });
}

let calculateStart = function () {
    let miniFormValues = window.localStorage.miniFormValues;
    try { miniFormValues = miniFormValues ? JSON.parse(miniFormValues) : null; } catch (e) { miniFormValues = null; }
    let flowType;
    if (miniFormValues && miniFormValues.Area != 'Val3') {
        if ($(".calculatorhub .pbc-mini-form").length > 0 || $(".budgetcalculator .pbcCalculator").length > 0) {
            flowType = "SPS_PBC_Miniform";
        } else if ($(".calculatorhub .wbc-mini-form").length > 0 || $(".budgetcalculator .wbcCalculator").length > 0) {
            flowType = "SPS_WBC_Miniform";
        } else {
            flowType = "SPS_PBC_Miniform";
        }
    }
    else {
        // Default on first interaction before form values are in localStorage
        flowType = $(".calculatorhub .wbc-mini-form").length > 0 ? "SPS_WBC_Miniform" : "SPS_PBC_Miniform";
    }
    trackEvent("calc_start", { flowType: flowType });

    // Adobe Analytics: push calc_start event to ACDL
    var dl = getAdobeBasePayload();
    dl.event = 'calc_start';
    dl.eventInfo.flowType = flowType || '';
    window.adobeDataLayer = window.adobeDataLayer || [];
    window.adobeDataLayer.push(dl);

}

let calculateContinue = function (userInput) {
    let miniFormValues = window.localStorage.miniFormValues;
    let flowType;
    if ($(".calculatorhub .pbc-mini-form").length > 0 || $(".budgetcalculator .pbcCalculator").length > 0) {
        flowType = "SPS_PBC_Miniform";
    } else if ($(".calculatorhub .wbc-mini-form").length > 0 || $(".budgetcalculator .wbcCalculator").length > 0) {
        flowType = "SPS_WBC_Miniform";
    } else {
        flowType = "SPS_PBC_Miniform";
    }
    trackEvent("calc_continue", {
        filter: userInput, //Pass all selected filters separated by "|"
        calcType: "Basic", // Hard Coded
        flowType: flowType
    });
      var dl = getAdobeBasePayload();
  dl.event = 'calc_continue';
  dl.eventInfo.filter = userInput || '';
  dl.eventInfo.flowType = flowType || '';
  window.adobeDataLayer = window.adobeDataLayer || [];
  window.adobeDataLayer.push(dl);

}