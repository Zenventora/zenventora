const EMENU_AUTH_URL = 'https://emenu.zenventora.in/api/auth/me';
const EMENU_PRODUCT_URL = 'https://emenu.zenventora.in/';
const EMENU_SIGNUP_URL = `${EMENU_PRODUCT_URL}?signup=true`;

const ctaMarkup = (authenticated) => authenticated
  ? `<a class="btn btn-primary" href="${EMENU_PRODUCT_URL}">Access Now <span aria-hidden="true">→</span></a>`
  : `<a class="btn btn-primary" href="${EMENU_SIGNUP_URL}">Get Started Free <span aria-hidden="true">→</span></a><a class="btn btn-secondary" href="${EMENU_PRODUCT_URL}">Sign In</a>`;

function renderCtas(authenticated) {
  document.querySelectorAll('[data-emenu-cta]').forEach((area) => {
    area.innerHTML = ctaMarkup(authenticated);
    area.dataset.sessionReady = 'true';
  });
}

async function checkEMenuLogin() {
  try {
    const response = await fetch(EMENU_AUTH_URL, { credentials: 'include' });
    renderCtas(response.ok);
    return response.ok;
  } catch (error) {
    console.error('E-menu session check failed:', error);
    renderCtas(false);
    return false;
  }
}

checkEMenuLogin();
