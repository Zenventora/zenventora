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

function accountUrl(view, product = "") {
  const path = view === "signup" ? "/signup" : view === "forgot" ? "/forgot" : "/login";
  const url = new URL(ACCOUNT_ORIGIN + path);
  url.searchParams.set("view", view);

  // Every sign-in/sign-up started from the website must return to the
  // exact page that initiated the flow. Accounts remains the identity owner.
  const returnTarget = product
    ? (PRODUCT_ORIGINS[product] || window.location.origin)
    : window.location.href;
  url.searchParams.set("returnTo", returnTarget);

  if (product) {
    url.searchParams.set("product", product);
    if (view === "signup") url.searchParams.set("productFlow", "signup");
  }

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

function updateAccountCtas(session) {
  document.querySelectorAll(".account-cta, [data-account-cta], .account-session-cta").forEach(element => {
    if (!(element instanceof HTMLAnchorElement)) return;

    const root = element.closest("[data-account-actions]");
    const product = element.dataset.accountProduct || root?.dataset.accountProduct || "";

    if (session?.user) {
      element.textContent = "Access Now";
      element.href = product
        ? (PRODUCT_ORIGINS[product] || window.location.origin)
        : ACCOUNT_ORIGIN + "/";
      element.dataset.accountAction = "access";
    } else {
      element.textContent = "Get Started";
      element.href = accountUrl("signup", product);
      element.dataset.accountAction = "signup";
    }
  });

  document.querySelectorAll(".account-session-signin, .account-signin-link[data-account-action=\"signin\"]").forEach(element => {
    element.hidden = Boolean(session?.user);
    element.setAttribute("aria-hidden", String(Boolean(session?.user)));
  });
}

function applySession(user) {
  const session = user ? { user } : null;
  roots.forEach(root => {
    if (user) renderSignedIn(root, user);
    else renderSignedOut(root);
  });
  updateAccountCtas(session);
}

const roots = [...document.querySelectorAll("[data-account-actions]")];

async function bootstrapAccountSession() {
  // Accounts redirects back with a one-time handoff in the URL fragment.
  // Exchange it into this site's own Supabase session storage, then remove
  // the tokens from the visible URL.
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  if (params.get("type") === "account_handoff" && params.get("access_token") && params.get("refresh_token")) {
    const { error } = await siteSupabase.auth.setSession({
      access_token: params.get("access_token"),
      refresh_token: params.get("refresh_token")
    });
    const clean = new URL(window.location.href);
    clean.hash = "";
    window.history.replaceState({}, document.title, clean.toString());
    if (error) return null;
  }

  const { data } = await siteSupabase.auth.getSession();
  return data.session?.user || null;
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
    applySession(session?.user || null);
  });
}
