// ZenVentora shared account/session UI.
// Signup is owned by the website/product pages.
// Sign-in and password recovery are owned by accounts.zenventora.in.

const ACCOUNT_ORIGIN = "https://accounts.zenventora.in";
const SUPABASE_URL = "https://flwzqlywdlwatycxexmk.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_QN1aNd7wxjkb6ktD6L8GOQ_nsfV1_bY";

const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
const siteSupabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
});

const PRODUCT_ORIGINS = {
  emenu: "https://emenu.zenventora.in/",
  siteradar: "https://siteradar.zenventora.in/",
  vadix: "https://vadix.zenventora.in/"
};

const escapeHtml = (value = "") => String(value).replace(/[&<>"]/g, char => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;"
}[char]));

const initials = (value = "") =>
  value.trim().split(/\s+/).slice(0, 2)
    .map(part => part[0]?.toUpperCase() || "")
    .join("") || "Z";

let currentSiteSession = null;
let sessionBridgeFrame = null;
let sessionBridgeReady = false;

function accountUrl(view, product = "") {
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

async function activateProductSession(product, session) {
  if (!session?.access_token || !session?.refresh_token) {
    throw new Error("No active ZenVentora session.");
  }

  const origin = PRODUCT_ORIGINS[product] || window.location.origin;
  const response = await fetch(origin + "/api/auth/common/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    cache: "no-store",
    body: JSON.stringify({
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      productFlow: "signin",
      provisionOnly: false
    })
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || "Could not connect this product.");
  }

  window.location.assign(new URL("/dashboard", origin).toString());
}

function renderSignedIn(root, user) {
  const meta = user.user_metadata || {};
  const name =
    meta.full_name ||
    meta.name ||
    meta.company_name ||
    user.email?.split("@")[0] ||
    "My account";

  const avatarCandidate = meta.avatar_url || meta.picture;
  const avatar = typeof avatarCandidate === "string" && /^https:\/\//i.test(avatarCandidate)
    ? escapeHtml(avatarCandidate)
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
    const open = card?.hidden;
    if (card) card.hidden = !open;
    trigger.setAttribute("aria-expanded", String(Boolean(open)));
  });

  root.querySelector("[data-account-signout]")?.addEventListener("click", async event => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = "Signing out…";

    try {
      const { error } = await siteSupabase.auth.signOut({ scope: "global" });
      if (error) throw error;
      currentSiteSession = null;
      applySession(null);
    } catch {
      button.disabled = false;
      button.textContent = "Sign out";
    }
  });
}

function renderSignedOut(root) {
  const product = root.dataset.accountProduct || "";
  root.innerHTML =
    '<a class="account-nav-link account-signin-link account-session-signin" data-account-action="signin" href="' +
      accountUrl("signin", product) + '">Sign in</a>' +
    '<a class="btn btn-primary btn-small account-get-started account-cta account-session-cta" data-account-cta="signup" data-account-action="signup" href="' +
      accountUrl("signup", product) + '">Get Started</a>';
}

function updateCtas(session) {
  const signedIn = Boolean(session?.user);
  document.documentElement.dataset.accountSignedIn = signedIn ? "true" : "false";

  document.querySelectorAll(".account-cta, [data-account-cta], .account-session-cta").forEach(element => {
    if (!(element instanceof HTMLAnchorElement)) return;

    const actionsRoot = element.closest("[data-account-actions]");
    const product =
      element.dataset.accountProduct ||
      actionsRoot?.dataset.accountProduct ||
      (window.location.pathname.startsWith("/emenu") ? "emenu" : "");

    if (signedIn) {
      element.textContent = "Access Now";
      element.href = product
        ? productHandoffUrl(product, session)
        : ACCOUNT_ORIGIN + "/";
      element.dataset.accountAction = "access";
      if (product) element.dataset.accountProduct = product;
    } else {
      element.textContent = element.dataset.accountCta === "signup"
        ? (element.closest(".cta-area") ? "Get Started Free →" : "Get Started")
        : "Get Started";
      element.href = accountUrl("signup", product);
      element.dataset.accountAction = "signup";
    }
  });

  document.querySelectorAll(".account-session-signin, .account-signin-link").forEach(element => {
    if (!(element instanceof HTMLElement)) return;
    const hide = signedIn;
    element.hidden = hide;
    element.setAttribute("aria-hidden", String(hide));
    element.style.display = hide ? "none" : "";
  });
}

function applySession(session) {
  currentSiteSession = session || null;

  document.querySelectorAll("[data-account-actions]").forEach(root => {
    if (session?.user) renderSignedIn(root, session.user);
    else renderSignedOut(root);
  });

  updateCtas(session);
}

function installAccessNowHandler() {
  document.addEventListener("click", async event => {
    const target = event.target instanceof Element
      ? event.target.closest('a.account-cta[data-account-action="access"], a.account-session-cta[data-account-action="access"]')
      : null;

    if (!(target instanceof HTMLAnchorElement)) return;
    event.preventDefault();

    const product =
      target.dataset.accountProduct ||
      target.closest("[data-account-actions]")?.dataset.accountProduct ||
      (window.location.pathname.startsWith("/emenu") ? "emenu" : "");

    const { data } = await siteSupabase.auth.getSession();
    const session = data.session || currentSiteSession;

    if (!session?.user) {
      requestAccountsSession();
      window.setTimeout(async () => {
        const retry = (await siteSupabase.auth.getSession()).data.session || currentSiteSession;
        if (retry?.user) {
          try {
            await activateProductSession(product, retry);
          } catch (error) {
            console.error("Product session activation failed:", error);
            window.location.assign(accountUrl("signin", product));
          }
        } else {
          window.location.assign(accountUrl("signin", product));
        }
      }, 400);
      return;
    }

    try {
      await activateProductSession(product, session);
    } catch (error) {
      console.error("Product session activation failed:", error);
      window.location.assign(accountUrl("signin", product));
    }
  }, true);
}

function ensureSessionBridge() {
  if (sessionBridgeFrame) return;

  sessionBridgeFrame = document.createElement("iframe");
  sessionBridgeFrame.src = ACCOUNT_ORIGIN + "/session-bridge.html";
  sessionBridgeFrame.title = "ZenVentora account session bridge";
  sessionBridgeFrame.setAttribute("aria-hidden", "true");
  sessionBridgeFrame.style.cssText =
    "position:fixed;width:1px;height:1px;left:-9999px;top:-9999px;border:0;opacity:0;pointer-events:none;";
  document.body.appendChild(sessionBridgeFrame);
}

function requestAccountsSession() {
  if (!sessionBridgeFrame?.contentWindow) {
    ensureSessionBridge();
  }

  sessionBridgeFrame?.contentWindow?.postMessage(
    { type: "zenventora:request-session" },
    ACCOUNT_ORIGIN
  );
}

window.addEventListener("message", async event => {
  if (event.origin !== ACCOUNT_ORIGIN) return;
  if (event.source !== sessionBridgeFrame?.contentWindow) return;
  if (event.data?.type !== "zenventora:account-session") return;

  const session = event.data.session;

  if (!session?.access_token || !session?.refresh_token) {
    currentSiteSession = null;
    applySession(null);
    return;
  }

  const { data, error } = await siteSupabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token
  });

  if (error || !data.session) {
    currentSiteSession = null;
    applySession(null);
    return;
  }

  currentSiteSession = data.session;
  applySession(data.session);
});

siteSupabase.auth.onAuthStateChange((_event, session) => {
  currentSiteSession = session || null;
  applySession(session || null);
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}

function init() {
  ensureSessionBridge();
  installAccessNowHandler();

  // First request immediately, then retry after the bridge has loaded.
  requestAccountsSession();
  window.setTimeout(requestAccountsSession, 500);
  window.setTimeout(requestAccountsSession, 1500);
  window.setTimeout(requestAccountsSession, 3000);

  // Render the existing state immediately; the bridge will upgrade it to signed-in.
  siteSupabase.auth.getSession().then(({ data }) => {
    if (data.session) applySession(data.session);
    else updateCtas(null);
  });
}
