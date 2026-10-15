const navToggle=document.querySelector('[data-nav-toggle]');
const navMenu=document.querySelector('[data-nav-menu]');
navToggle?.addEventListener('click',()=>{const open=navMenu.classList.toggle('open');navToggle.setAttribute('aria-expanded',String(open));});
navMenu?.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>{navMenu.classList.remove('open');navToggle?.setAttribute('aria-expanded','false');}));

/* Desktop Services dropdown opens on hover only. Touch layouts retain native tap-to-toggle. */
(() => {
  const desktopHover = window.matchMedia('(hover: hover) and (min-width: 961px)');
  document.querySelectorAll('.nav-dropdown').forEach((dropdown) => {
    const summary = dropdown.querySelector(':scope > summary');
    if (!summary) return;
    const applyMode = () => {
      if (desktopHover.matches) {
        summary.addEventListener('click', preventDesktopToggle);
      } else {
        summary.removeEventListener('click', preventDesktopToggle);
        dropdown.removeAttribute('open');
      }
    };
    function preventDesktopToggle(event) { event.preventDefault(); }
    dropdown.addEventListener('mouseenter', () => {
      if (desktopHover.matches) dropdown.setAttribute('open', '');
    });
    dropdown.addEventListener('mouseleave', () => {
      if (desktopHover.matches) dropdown.removeAttribute('open');
    });
    dropdown.addEventListener('focusin', () => {
      if (desktopHover.matches) dropdown.setAttribute('open', '');
    });
    dropdown.addEventListener('focusout', (event) => {
      if (desktopHover.matches && !dropdown.contains(event.relatedTarget)) dropdown.removeAttribute('open');
    });
    applyMode();
    desktopHover.addEventListener('change', applyMode);
  });
})();
/* Shared currency handling for all public pricing pages.
   India visitors see INR; visitors outside India see USD on every page. */
(() => {
  const INR_PRICES = [1999, 3999];
  const USD_FALLBACK_RATE = 42 / 3999;

  const replacePriceText = (root, replacements) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) {
      if (node.parentElement && !['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(node.parentElement.tagName) &&
          INR_PRICES.some((price) => node.nodeValue.includes('₹' + price.toLocaleString('en-IN')))) {
        nodes.push(node);
      }
    }
    nodes.forEach((textNode) => {
      INR_PRICES.forEach((price) => {
        const original = '₹' + price.toLocaleString('en-IN');
        textNode.nodeValue = textNode.nodeValue.replaceAll(original, replacements[price]);
      });
    });
  };

  const updateMeta = (replacements) => {
    document.title = INR_PRICES.reduce((title, price) =>
      title.replaceAll('₹' + price.toLocaleString('en-IN'), replacements[price]), document.title);
    document.querySelectorAll('meta[content]').forEach((meta) => {
      INR_PRICES.forEach((price) => {
        const original = '₹' + price.toLocaleString('en-IN');
        if (meta.content.includes(original)) meta.content = meta.content.replaceAll(original, replacements[price]);
      });
    });
  };

  const showInternationalPrices = (usdRate) => {
    const replacements = Object.fromEntries(INR_PRICES.map((price) => [
      price,
      String.fromCharCode(36) + Math.max(1, Math.ceil(price * usdRate)).toLocaleString('en-US')
    ]));
    replacePriceText(document.body, replacements);
    updateMeta(replacements);
    document.documentElement.dataset.pricingCountry = 'international';
    document.documentElement.dataset.pricingCurrency = 'USD';
  };

  const showIndiaPrices = () => {
    document.documentElement.dataset.pricingCountry = 'IN';
    document.documentElement.dataset.pricingCurrency = 'INR';
  };

  const detectPricing = async () => {
    let country = '';
    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 2500);
      try {
        const countryResponse = await fetch('https://ipapi.co/country/', {
          method: 'GET', cache: 'no-store', signal: controller.signal
        });
        if (countryResponse.ok) country = (await countryResponse.text()).trim().toUpperCase();
      } finally {
        window.clearTimeout(timeout);
      }
    } catch (_) {
      // If country detection fails, use the same international fallback on both pricing pages.
    }

    if (country === 'IN') {
      showIndiaPrices();
      return;
    }

    let usdRate = USD_FALLBACK_RATE;
    try {
      const rateResponse = await fetch('https://open.er-api.com/v6/latest/INR', {
        method: 'GET', cache: 'no-store'
      });
      const rateData = await rateResponse.json();
      if (rateData && Number.isFinite(rateData?.rates?.USD) && rateData.rates.USD > 0) {
        usdRate = rateData.rates.USD;
      }
    } catch (_) {
      // Keep the same approximate USD fallback for both price points.
    }
    showInternationalPrices(usdRate);
  };

  const isPricingPage = INR_PRICES.some((price) =>
    document.body.innerText.includes('₹' + price.toLocaleString('en-IN')));
  if ((window.location.hostname === 'zenventora.in' || window.location.hostname.endsWith('.zenventora.in')) && isPricingPage) {
    detectPricing();
  }
})();
