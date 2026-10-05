const navToggle=document.querySelector('[data-nav-toggle]');
const navMenu=document.querySelector('[data-nav-menu]');
navToggle?.addEventListener('click',()=>{const open=navMenu.classList.toggle('open');navToggle.setAttribute('aria-expanded',String(open));});
navMenu?.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>{navMenu.classList.remove('open');navToggle?.setAttribute('aria-expanded','false');}));
/* Campaign pricing: show INR only to visitors whose public IP is in India.
   International visitors see the USD equivalent of the INR 3,999 starting value. */
(() => {
  const INR_PRICE = 3999;
  const USD_FALLBACK = 42;

  const replacePriceText = (root, displayPrice) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) {
      if (node.parentElement && !['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(node.parentElement.tagName) && node.nodeValue.includes('₹3,999')) {
        nodes.push(node);
      }
    }
    nodes.forEach((textNode) => {
      textNode.nodeValue = textNode.nodeValue.replaceAll('₹3,999', displayPrice);
    });
  };

  const updateMeta = (displayPrice) => {
    document.title = document.title.replaceAll('₹3,999', displayPrice);
    document.querySelectorAll('meta[content]').forEach((meta) => {
      if (meta.content.includes('₹3,999')) {
        meta.content = meta.content.replaceAll('₹3,999', displayPrice);
      }
    });
  };

  const showInternationalPrice = (usdRate) => {
    const usdPrice = Math.max(1, Math.round(INR_PRICE * usdRate));
    const displayPrice = '$' + usdPrice.toLocaleString('en-US');
    replacePriceText(document.body, displayPrice);
    updateMeta(displayPrice);
    document.documentElement.dataset.pricingCountry = 'international';
    document.documentElement.dataset.pricingCurrency = 'USD';
  };

  const showIndiaPrice = () => {
    document.documentElement.dataset.pricingCountry = 'IN';
    document.documentElement.dataset.pricingCurrency = 'INR';
  };

  const detectPricing = async () => {
    try {
      const countryResponse = await fetch('https://ipapi.co/country/', {
        method: 'GET',
        cache: 'no-store'
      });
      const country = (await countryResponse.text()).trim().toUpperCase();

      if (country === 'IN') {
        showIndiaPrice();
        return;
      }

      let usdRate = 0.0105;
      try {
        const rateResponse = await fetch('https://open.er-api.com/v6/latest/INR', {
          method: 'GET',
          cache: 'no-store'
        });
        const rateData = await rateResponse.json();
        if (rateData && Number.isFinite(rateData?.rates?.USD) && rateData.rates.USD > 0) {
          usdRate = rateData.rates.USD;
        }
      } catch (_) {
        // Keep the safe approximate USD fallback when the exchange-rate service is unavailable.
        usdRate = USD_FALLBACK / INR_PRICE;
      }

      showInternationalPrice(usdRate);
    } catch (_) {
      // Preserve the indexed/default INR campaign copy if IP detection is unavailable.
      showIndiaPrice();
    }
  };

  if (window.location.hostname === 'zenventora.in' || window.location.hostname.endsWith('.zenventora.in')) {
    detectPricing();
  }
})();
