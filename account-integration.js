import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ACCOUNT_URL = "https://accounts.zenventora.in/";
const SUPABASE_URL = "https://flwzqlywdlwatycxexmk.supabase.co";
const SUPABASE_KEY = "sb_publishable_QN1aNd7wxjkb6ktD6L8GOQ_nsfV1_bY";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: false }
});

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
  return value.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join("") || "Z";
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
  const avatar = typeof avatarCandidate === "string" && /^https:\/\//i.test(avatarCandidate) ? escapeHtml(avatarCandidate) : "";
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
  authActions.querySelector("[data-account-signout]").addEventListener("click", async () => {
    const button = authActions.querySelector("[data-account-signout]");
    button.disabled = true;
    button.textContent = "Signing out…";
    const { error } = await supabase.auth.signOut({ scope: "global" });
    if (error) {
      button.disabled = false;
      button.textContent = "Sign out";
      console.error("ZenVentora sign-out failed:", error.message);
      return;
    }
    renderSignedOut();
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

async function acceptAccountHandoff() {
  const pageParams = new URLSearchParams(window.location.search);
  if (pageParams.get("account_signed_out") === "1") {
    await supabase.auth.signOut({ scope: "local" });
    window.history.replaceState(null, "", window.location.pathname);
    return;
  }
  const params = new URLSearchParams(window.location.hash.slice(1));
  if (params.get("type") !== "account_handoff") return;
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
  if (!access_token || !refresh_token) return;
  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) console.error("Could not complete ZenVentora account sign-in:", error.message);
}

renderSignedOut();
await acceptAccountHandoff();
const { data: { session } } = await supabase.auth.getSession();
if (session?.user) renderSignedIn(session.user);
supabase.auth.onAuthStateChange((_event, nextSession) => {
  if (nextSession?.user) renderSignedIn(nextSession.user);
  else renderSignedOut();
});
