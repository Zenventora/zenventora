const EMENU_PRODUCT_URL = 'https://emenu.zenventora.in/';
const EMENU_SIGNUP_URL = 'https://zenventora.in/emenu/signup.html';

const ctaMarkup = (authenticated) => authenticated
  ? `<a class="btn btn-primary" href="${EMENU_PRODUCT_URL}">Access Now <span aria-hidden="true">→</span></a>`
  : `<a class="btn btn-primary" href="${EMENU_SIGNUP_URL}">Get Started Free</a>`;

function renderCtas(authenticated) {
  document.querySelectorAll('[data-emenu-cta]').forEach((area) => {
    area.innerHTML = ctaMarkup(authenticated);
    area.dataset.sessionReady = 'true';
  });
}

// Legacy E-menu CTA helper. Authentication itself is owned by the
// ZenVentora Accounts service; this helper never renders a product sign-in UI.
async function checkEMenuLogin() {
  try {
    const response = await fetch(EMENU_PRODUCT_URL + 'api/auth/me', { credentials: 'include' });
    renderCtas(response.ok);
    return response.ok;
  } catch (error) {
    console.error('E-menu session check failed:', error);
    renderCtas(false);
    return false;
  }
}

checkEMenuLogin();
