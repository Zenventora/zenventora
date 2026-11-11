(() => {
  const ACCOUNT_ORIGIN = "https://zenventora-accounts-bels.onrender.com";
  const BRIDGE_URL = ACCOUNT_ORIGIN + "/session-bridge.html";
  const host = document.querySelector("[data-emenu-cta]");
  if (!host) return;

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);

  const initials = (value = "") => value.trim().split(/\s+/).slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "").join("") || "Z";

  const signedOutMarkup = () => `
    <a class="btn btn-primary btn-small" href="https://zenventora.in/emenu/signup.html">Get Started Free</a>
    <a class="btn btn-secondary btn-small" href="https://zenventora-accounts-bels.onrender.com/?view=signin&amp;returnTo=https%3A%2F%2Femenu.zenventora.in%2F&amp;product=emenu">Sign In</a>`;

  function renderSignedOut() {
    host.className = "cta-area cta-area--header";
    host.innerHTML = signedOutMarkup();
  }

  function renderSignedIn(user) {
    const metadata = user.user_metadata || {};
    const name = metadata.full_name || metadata.name || metadata.company_name ||
      user.email?.split("@")[0] || "My account";
    const candidate = metadata.avatar_url || metadata.picture;
    const avatar = typeof candidate === "string" && /^https:\/\//i.test(candidate)
      ? escapeHtml(candidate) : "";
    const avatarMarkup = avatar
      ? `<img class="account-avatar" src="${avatar}" alt="" referrerpolicy="no-referrer">`
      : `<span class="account-avatar account-avatar-initials">${initials(name)}</span>`;

    host.className = "cta-area cta-area--header account-nav-actions";
    host.innerHTML = `
      <div class="account-profile-wrap">
        <button class="account-profile-trigger" type="button" aria-expanded="false" aria-haspopup="true">
          ${avatarMarkup}
          <span class="account-profile-name">${escapeHtml(name)}</span>
          <span class="account-chevron" aria-hidden="true">▾</span>
        </button>
        <div class="account-profile-card" hidden>
          <div class="account-card-heading">
            ${avatar
              ? `<img class="account-avatar account-card-avatar" src="${avatar}" alt="" referrerpolicy="no-referrer">`
              : `<span class="account-avatar account-card-avatar account-avatar-initials">${initials(name)}</span>`}
            <span><strong>${escapeHtml(name)}</strong><small>${escapeHtml(user.email || "")}</small></span>
          </div>
          <a href="${ACCOUNT_ORIGIN}/account/settings">Manage account <span aria-hidden="true">↗</span></a>
          <button type="button" data-emenu-account-signout>Sign out</button>
        </div>
      </div>`;

    const trigger = host.querySelector(".account-profile-trigger");
    const card = host.querySelector(".account-profile-card");
    trigger.addEventListener("click", () => {
      const open = card.hidden;
      card.hidden = !open;
      trigger.setAttribute("aria-expanded", String(open));
    });

    host.querySelector("[data-emenu-account-signout]").addEventListener("click", (event) => {
      const button = event.currentTarget;
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
      const button = host.querySelector("[data-emenu-account-signout]");
      if (button) {
        button.disabled = false;
        button.textContent = "Sign out";
      }
      console.error("ZenVentora sign-out failed:", message.message || "Please try again.");
    }
  });
})();
