import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ACCOUNT_ORIGIN = "https://accounts.zenventora.in";
const SUPABASE_URL = "https://flwzqlywdlwatycxexmk.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_QN1aNd7wxjkb6ktD6L8GOQ_nsfV1_bY";
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
});

const nav = document.querySelector("[data-nav-menu]");
const authActions = nav?.querySelector("[data-account-actions]");
if (!nav || !authActions) {
  console.error("ZenVentora account navigation mount point is missing.");
} else {
  const PRODUCT_ORIGINS = {
    emenu: "https://emenu.zenventora.in/",
    siteradar: "https://siteradar.zenventora.in/",
    vadix: "https://vadix.zenventora.in/"
  };
  const productContext = authActions.dataset.accountProduct || "";
  const productOrigin = PRODUCT_ORIGINS[productContext] || window.location.origin;
  const accountUrl = (view) => {
    // Product-branded signup pages are the canonical signup entry point.
    // Authentication itself remains centralized in ZenVentora Accounts.
    if (view === "signup" && productContext === "emenu") {
      const signup = new URL("https://zenventora.in/emenu/signup.html");
      signup.searchParams.set("product", "emenu");
      signup.searchParams.set("returnTo", productOrigin);
      return signup.toString();
    }
    const url = new URL(ACCOUNT_ORIGIN + (view === "signup" ? "/signup" : view === "forgot" ? "/forgot" : "/login"));
    if (view !== "dashboard") url.searchParams.set("view", view);
    // Standalone ZenVentora authentication must stay inside Accounts.
    // Only product-origin authentication receives a returnTo handoff.
    if (productContext) {
      url.searchParams.set("returnTo", productOrigin);
      url.searchParams.set("product", productContext);
      if (view === "signup") url.searchParams.set("productFlow", "signup");
    }
    return url.toString();
  };

  function initials(value = "") {
    return value.trim().split(/\s+/).slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "").join("") || "Z";
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
    const name = metadata.full_name || metadata.name || metadata.company_name ||
      user.email?.split("@")[0] || "My account";
    const candidate = metadata.avatar_url || metadata.picture;
    const avatar = typeof candidate === "string" && /^https:\/\//i.test(candidate)
      ? escapeHtml(candidate) : "";
    authActions.innerHTML = `
      <div class="account-profile-wrap">
        <button class="account-profile-trigger" type="button" aria-expanded="false" aria-haspopup="true">
          ${avatar
            ? `<img class="account-avatar" src="${avatar}" alt="" referrerpolicy="no-referrer">`
            : `<span class="account-avatar account-avatar-initials">${initials(name)}</span>`}
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
          <a href="${accountUrl("dashboard")}">My Accounts <span aria-hidden="true">↗</span></a>
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
    authActions.querySelector("[data-account-signout]").addEventListener("click", async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      button.textContent = "Signing out…";
      const { error } = await supabase.auth.signOut({ scope: "global" });
      if (error) {
        button.disabled = false;
        button.textContent = "Sign out";
        console.error("ZenVentora sign-out failed:", error.message);
      }
    });
  }

  // Accounts redirects here with a short-lived session handoff in the URL
  // fragment. Consume it once, persist it in this origin's Supabase session,
  // and immediately remove the credentials from the address bar/history.
  async function consumeHandoff() {
    const rawHash = window.location.hash;
    if (!rawHash) return false;
    const params = new URLSearchParams(rawHash.slice(1));
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const handoffType = params.get("type");
    if (handoffType !== "account_handoff" || !accessToken || !refreshToken) return false;

    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    });
    if (error) {
      console.error("ZenVentora account handoff failed:", error.message);
      renderSignedOut();
      return true;
    }
    return true;
  }

  function updateAccountCtas(session) {
    document.querySelectorAll('a.account-get-started, a[data-account-cta], a[href*="accounts.zenventora.in"][href*="view=signup"]').forEach((link) => {
      if (session?.user) {
        link.textContent = 'Access Now';
        link.href = productContext ? productOrigin : accountUrl('dashboard');
      } else {
        link.textContent = 'Get Started';
        link.href = accountUrl('signup');
      }
    });
  }

  renderSignedOut();
  updateAccountCtas(null);
  supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) { renderSignedIn(session.user); updateAccountCtas(session); }
    else { renderSignedOut(); updateAccountCtas(null); }
  });

  (async () => {
    try {
      const hadHandoff = await consumeHandoff();
      if (!hadHandoff) {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (data.session?.user) { renderSignedIn(data.session.user); updateAccountCtas(data.session); }
      }
    } catch (error) {
      console.error("ZenVentora account session initialization failed:", error);
      renderSignedOut();
    }
  })();
}
