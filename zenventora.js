// ZenVentora Master Account UI
// IMPORTANT: This file only handles identity/session UI.
// It does not access or modify any product database, order data, customer data,
// inventory, billing, or application records.

const ACCOUNT_ORIGIN = "https://accounts.zenventora.in";
const SUPABASE_URL = "https://flwzqlywdlwatycxexmk.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_QN1aNd7wxjkb6ktD6L8GOQ_nsfV1_bY";
const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
const siteSupabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: false }
});

const PRODUCT_ORIGINS = {
  emenu: "https://emenu.zenventora.in/",
  siteradar: "https://siteradar.zenventora.in/",
  vadix: "https://vadix.zenventora.in/"
};

const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, char => ({
  "&":"&amp;","<":"&lt;",">":"&gt;","":"&quot;","'":"&#39;"
}[char]));

const initials = (value = "") =>
  value.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase() || "").join("") || "Z";

let currentSiteSession = null;

function accountUrl(view, product = "") {
  // Signup is product/website-owned. Accounts owns sign-in and password recovery only.
  if (view === "signup") {
    return product === "emenu"
      ? "https://zenventora.in/emenu/signup.html"
      : "https://zenventora.in/signup.html";
  }

  const path = view === "forgot" ? "/forgot" : "/login";
  const url = new URL(ACCOUNT_ORIGIN + path);
  url.searchParams.set("view", view);

  const returnTarget = product
    ? (PRODUCT_ORIGINS[product] || window.location.origin)
    : window.location.href;
  url.searchParams.set("returnTo", returnTarget);

  if (product) url.searchParams.set("product", product);
  return url.toString();
}

function renderSignedOut(root) {
  const product = root.dataset.accountProduct || "";
  root.innerHTML =
    '<a class="account-nav-link account-signin-link account-session-signin" data-account-action="signin" href="' +
    accountUrl("signin", product) + '">Sign in</a>' +
    '<a class="btn btn-primary btn-small account-get-started account-cta account-session-cta" data-account-cta="signup" data-account-action="signup" href="' +
    accountUrl("signup", product) + '">Get Started</a>';
}

function renderSignedIn(root, user) {
  const meta = user.user_metadata || {};
  const name = meta.full_name || meta.name || meta.company_name || user.email?.split("@")[0] || "My account";
  const candidate = meta.avatar_url || meta.picture;
  const avatar = typeof candidate === "string" && /^https:\/\//i.test(candidate)
    ? escapeHtml(candidate)
    : "";

  root.innerHTML =
    '<div class="account-profile-wrap">' +
      '<button class="account-profile-trigger" type="button" aria-expanded="false" aria-haspopup="true">' +
        (avatar
          ? '<img class="account-avatar" src="' + avatar + '" alt="" referrerpolicy="no-referrer">'
          : '<span class="account-avatar account-avatar-initials">' + initials(name) + '</span>') +
        '<span class="account-profile-name">' + escapeHtml(name) + '</span>' +
        '<span class="account-chevron" aria-hidden="true">▾</span>' +
      '</button>' +
      '<div class="account-profile-card" hidden>' +
        '<div class="account-card-heading">' +
          (avatar
            ? '<img class="account-avatar account-card-avatar" src="' + avatar + '" alt="" referrerpolicy="no-referrer">'
            : '<span class="account-avatar account-card-avatar account-avatar-initials">' + initials(name) + '</span>') +
          '<span><strong>' + escapeHtml(name) + '</strong><small>' + escapeHtml(user.email || "") + '</small></span>' +
        '</div>' +
        '<a class="account-manage-link" href="' + ACCOUNT_ORIGIN + '/">My Accounts <span aria-hidden="true">↗</span></a>' +
        '<button class="account-signout-button" type="button" data-account-signout>Sign out</button>' +
      '</div>' +
    '</div>';

  const trigger = root.querySelector(".account-profile-trigger");
  const card = root.querySelector(".account-profile-card");

  trigger?.addEventListener("click", () => {
    const open = card.hidden;
    card.hidden = !open;
    trigger.setAttribute("aria-expanded", String(open));
  });

  root.querySelector("[data-account-signout]")?.addEventListener("click", async event => {
    event.currentTarget.disabled = true;
    event.currentTarget.textContent = "Signing out…";

    try {
      const { error } = await siteSupabase.auth.signOut({ scope: "global" });
      if (error) throw error;
      applySession(null);
    } catch {
      event.currentTarget.disabled = false;
      event.currentTarget.textContent = "Sign out";
    }
  });
}

function productHandoffUrl(product, session) {
  if (!session?.access_token || !session?.refresh_token) return accountUrl("signin", product);
  const target = new URL(PRODUCT_ORIGINS[product] || window.location.origin);
  target.hash = new URLSearchParams({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    type: "account_handoff",
    product
  }).toString();
  return target.toString();
}

function updateAccountCtas(session) {
  const signedIn = Boolean(session?.user);
  document.documentElement.dataset.accountSignedIn = signedIn ? "true" : "false";

  document.querySelectorAll(".account-cta, [data-account-cta], .account-session-cta").forEach(element => {
    if (!(element instanceof HTMLAnchorElement)) return;

    const root = element.closest("[data-account-actions]");
    const product = element.dataset.accountProduct
      || root?.dataset.accountProduct
      || (window.location.pathname.startsWith("/emenu") ? "emenu" : "")
      || "";

    if (signedIn) {
      element.textContent = "Access Now";
      element.href = product
        ? productHandoffUrl(product, currentSiteSession)
        : ACCOUNT_ORIGIN + "/";
      element.dataset.accountAction = "access";
      element.dataset.accountProduct = product;
    } else {
      element.textContent = "Get Started";
      element.href = accountUrl("signup", product);
      element.dataset.accountAction = "signup";
    }
  });

  document.querySelectorAll(".account-session-signin, .account-signin-link[data-account-action="signin"]").forEach(element => {
    const hidden = signedIn;
    if (element instanceof HTMLElement) {
      element.hidden = hidden;
      element.setAttribute("aria-hidden", String(hidden));
      element.style.display = hidden ? "none" : "";
    }
  });
}

let accountCtaClickHandlerInstalled = false;
function installAccountCtaClickHandler() {
  if (accountCtaClickHandlerInstalled) return;
  accountCtaClickHandlerInstalled = true;

  document.addEventListener("click", async event => {
    const target = event.target instanceof Element
      ? event.target.closest('a.account-cta[data-account-action="access"], a.account-session-cta[data-account-action="access"]')
      : null;
    if (!(target instanceof HTMLAnchorElement)) return;

    event.preventDefault();

    // The session may have just arrived through the Accounts iframe bridge.
    // Give that bridge a short chance to deliver the current tokens before
    // deciding that the user needs to sign in.
    let session = currentSiteSession;
    if (!session?.user) {
      requestAccountsSession();
      await new Promise(resolve => window.setTimeout(resolve, 250));
      const { data } = await siteSupabase.auth.getSession();
      session = data.session || currentSiteSession;
    }

    if (!session?.user) {
      // No verified session really exists, so the normal signed-out flow is valid.
      window.location.assign(accountUrl("signin", target.dataset.accountProduct || "emenu"));
      return;
    }

    const product = target.dataset.accountProduct
      || target.closest("[data-account-actions]")?.dataset.accountProduct
      || (window.location.pathname.startsWith("/emenu") ? "emenu" : "");

    if (!product) return;
    currentSiteSession = session;
    window.location.assign(productHandoffUrl(product, session));
  }, true);
}

if (roots.length) {
  mountAccountsSessionBridge();
  window.setTimeout(() => requestAccountsSession(), 1000);
  window.setTimeout(() => requestAccountsSession(), 3000);
}

if (roots.length) {
  let resolved = false;

  bootstrapAccountSession().then(user => {
    resolved = true;
    applySession(user);
  }).catch(() => {
    resolved = true;
    applySession(null);
  });

  window.setTimeout(() => {
    if (!resolved) applySession(null);
  }, 5000);

  siteSupabase.auth.onAuthStateChange((_event, session) => {
    currentSiteSession = session || null;
    applySession(session?.user || null);
  });
}
