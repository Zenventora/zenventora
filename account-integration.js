const ACCOUNT_ORIGIN = "https://accounts.zenventora.in";
const ACCOUNT_URL = ACCOUNT_ORIGIN + "/";
const BRIDGE_URL = ACCOUNT_ORIGIN + "/session-bridge.html";

const nav = document.querySelector("[data-nav-menu]");
if (!nav) throw new Error("ZenVentora navigation was not found.");

const authActions = document.createElement("div");
authActions.className = "account-nav-actions";
authActions.setAttribute("data-account-actions", "");
nav.append(authActions);

const accountUrl = (view) => {
  const url = new URL(ACCOUNT_URL);
  url.searchParams.set("view", view);
  url.searchParams.set("returnTo", window.location.origin);
  return url.toString();
};

function initials(value = "") {
  return value.trim().split(/\\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join("") || "Z";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function renderSignedOut() {
  authActions.innerHTML = `
    <a class="account-nav-link" href="${accountUrl("signin")}">Sign in</a>
    <a class="btn btn-primary btn-small account-get-started" href="${accountUrl("signup")}">Get Started</a>`;
}

function renderSignedIn(user) {
  const metadata = user.user_metadata || {};
  const name = metadata.full_name || metadata.name || metadata.company_name || user.email?.split("@")[0] || "My account";
  const avatarCandidate = metadata.avatar_url || metadata.picture;
  const avatar = typeof avatarCandidate === "string" && /^https:\\/\\//i.test(avatarCandidate) ? escapeHtml(avatarCandidate) : "";
  authActions.innerHTML = `
    <div class="account-profile-wrap">
      <button class="account-profile-trigger" type="button" aria-expanded="false" aria-haspopup="true">
        ${avatar ? `<img class="account-avatar" src="${avatar}" alt="" referrerpolicy="no-referrer">` : `<span class="account-avatar account-avatar-initials">${initials(name)}</span>`}
        <span class="account-profile-name">${escapeHtml(name)}</span><span class="account-chevron" aria-hidden="true">▾</span>
      </button>
      <div class="account-profile-card" hidden>
        <div class="account-card-heading">
          ${avatar ? `<img class="account-avatar account-card-avatar" src="${avatar}" alt="" referrerpolicy="no-referrer">` : `<span class="account-avatar account-card-avatar account-avatar-initials">${initials(name)}</span>`}
          <span><strong>${escapeHtml(name)}</strong><small>${escapeHtml(user.email || "")}</small></span>
        </div>
        <a href="${ACCOUNT_URL}">Manage account <span aria-hidden="true">↗</span></a>
        <button type="button" data-account-signout>Sign out</button>
      </div>
    </div>`;

  const trigger = authActions.querySelector(".account-profile-trigger");
  const card = authActions.querySelector(".account-profile-card");
  trigger.addEventListener("click", () => {
    const open = card.hidden;
    card.hidden = !open;
    trigger.setAttribute("aria-expanded", String(open));
  });
  authActions.querySelector("[data-account-signout]").addEventListener("click", () => {
    const button = authActions.querySelector("[data-account-signout]");
    button.disabled = true;
    button.textContent = "Signing out…";
    bridge.contentWindow?.postMessage({ type: "zenventora:signout" }, ACCOUNT_ORIGIN);
  });
}

const bridge = document.createElement("iframe");
bridge.src = BRIDGE_URL;
bridge.title = "ZenVentora account session";
bridge.tabIndex = -1;
bridge.setAttribute("aria-hidden", "true");
bridge.style.cssText = "position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;border:0;clip-path:inset(50%);";
document.body.appendChild(bridge);

window.addEventListener("message", (event) => {
  if (event.origin !== ACCOUNT_ORIGIN || event.source !== bridge.contentWindow) return;
  const message = event.data;
  if (!message || message.namespace !== "zenventora-account-bridge") return;
  if (message.type === "session" && message.user) renderSignedIn(message.user);
  if (message.type === "signed_out") renderSignedOut();
  if (message.type === "signout_error") {
    const button = authActions.querySelector("[data-account-signout]");
    if (button) {
      button.disabled = false;
      button.textContent = "Sign out";
    }
    console.error("ZenVentora sign-out failed:", message.message || "Please try again.");
  }
});

renderSignedOut();

// If this page was the Accounts portal's return target, the identity session has
// already been persisted on accounts.zenventora.in. The hidden same-site bridge
// reads that canonical session; the fragment contains no data we need to retain.
if (window.location.hash) {
  const params = new URLSearchParams(window.location.hash.slice(1));
  if (params.get("type") === "account_handoff") {
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }
}
