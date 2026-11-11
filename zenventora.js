// ZenVentora Master Account UI
// IMPORTANT: This file only handles identity/session UI.
// It does not access or modify any product database, order data, customer data,
// inventory, billing, or application records.

const ACCOUNT_ORIGIN = "https://accounts.zenventora.in";
const BRIDGE_URL = ACCOUNT_ORIGIN + "/session-bridge.html";

let sessionBridge = null;

const PRODUCT_ORIGINS = {
  emenu: "https://emenu.zenventora.in/",
  siteradar: "https://siteradar.zenventora.in/",
  vadix: "https://vadix.zenventora.in/"
};

function isZenVentoraOrigin(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      (url.hostname === "zenventora.in" || url.hostname.endsWith(".zenventora.in"));
  } catch {
    return false;
  }
}

function resolveProductOrigin(product, explicitUrl) {
  const explicit = String(explicitUrl || "").trim();
  if (explicit && isZenVentoraOrigin(explicit)) return new URL(explicit).origin + "/";
  return PRODUCT_ORIGINS[String(product || "").toLowerCase()] || null;
}

const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, char => ({
  "&":"&amp;","<":"&lt;",">":"&gt;","":"&quot;","'":"&#39;"
}[char]));

const initials = (value = "") =>
  value.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase() || "").join("") || "Z";

function accountUrl(view, product = "") {
  const path = view === "signup" ? "/signup" : view === "forgot" ? "/forgot" : "/login";
  const url = new URL(ACCOUNT_ORIGIN + path);
  url.searchParams.set("view", view);

  // Standalone ZenVentora auth stays inside Accounts.
  // Product-context auth gets an explicit product handoff.
  if (product) {
    url.searchParams.set("product", product);
    url.searchParams.set("returnTo", resolveProductOrigin(product) || window.location.origin);
    if (view === "signup") url.searchParams.set("productFlow", "signup");
  }

  return url.toString();
}

function renderSignedOut(root) {
  const product = root.dataset.accountProduct || "";
  root.innerHTML =
    '<a class="account-nav-link account-signin-link" data-account-action="signin" href="' +
    accountUrl("signin", product) + '">Sign in</a>' +
    '<a class="btn btn-primary btn-small account-get-started account-cta" data-account-cta="signup" data-account-action="signup" href="' +
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
      sessionBridge?.contentWindow?.postMessage({ type: "zenventora:signout" }, ACCOUNT_ORIGIN);
    } catch {
      event.currentTarget.disabled = false;
      event.currentTarget.textContent = "Sign out";
    }
  });
}

function updateAccountCtas(session) {
  document.querySelectorAll(".account-cta, [data-account-cta]").forEach(element => {
    if (!(element instanceof HTMLAnchorElement)) return;

    const root = element.closest("[data-account-actions]");
    const product = element.dataset.accountProduct || root?.dataset.accountProduct || "";
    const productUrl = element.dataset.accountProductUrl || root?.dataset.accountProductUrl || "";

    if (session?.user) {
      element.textContent = "Access Now";
      element.href = product
        ? (resolveProductOrigin(product, productUrl) || window.location.origin)
        : ACCOUNT_ORIGIN + "/";
      element.dataset.accountAction = "access";
    } else {
      element.textContent = "Get Started";
      element.href = accountUrl("signup", product);
      element.dataset.accountAction = "signup";
    }
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

if (roots.length) {
  // Cross-origin localStorage is intentionally not used.
  // Accounts owns the session; this page reads it through the read-only session bridge.
  sessionBridge = document.createElement("iframe");
  sessionBridge.src = BRIDGE_URL;
  sessionBridge.title = "ZenVentora account session";
  sessionBridge.tabIndex = -1;
  sessionBridge.setAttribute("aria-hidden", "true");
  sessionBridge.style.cssText =
    "position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;border:0;clip-path:inset(50%);";
  document.body.appendChild(sessionBridge);

  let resolved = false;
  const fallbackTimer = window.setTimeout(() => {
    if (!resolved) {
      resolved = true;
      applySession(null);
    }
  }, 5000);

  window.addEventListener("message", event => {
    if (event.origin !== ACCOUNT_ORIGIN || event.source !== sessionBridge.contentWindow) return;

    const message = event.data;
    if (!message || message.namespace !== "zenventora-account-bridge") return;

    if (message.type === "session") {
      resolved = true;
      window.clearTimeout(fallbackTimer);
      applySession(message.user || null);
    }

    if (message.type === "signed_out") {
      applySession(null);
    }
  });
}
