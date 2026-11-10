// ZenVentora Common Account & Session Layer
// Master auth UI for every ZenVentora page. Product pages add data-account-product.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ZENVENTORA_ACCOUNT_ORIGIN = "https://accounts.zenventora.in";
const ZENVENTORA_SUPABASE_URL = "https://flwzqlywdlwatycxexmk.supabase.co";
const ZENVENTORA_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_QN1aNd7wxjkb6ktD6L8GOQ_nsfV1_bY";

const zenventoraSupabase = createClient(
  ZENVENTORA_SUPABASE_URL,
  ZENVENTORA_SUPABASE_PUBLISHABLE_KEY,
  { auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: false } }
);

const PRODUCT_ORIGINS = {
  emenu: "https://emenu.zenventora.in/",
  siteradar: "https://siteradar.zenventora.in/",
  vadix: "https://vadix.zenventora.in/"
};

const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, char => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",""":"&quot;","'":"&#39;"
}[char]));
const initials = (value = "") => value.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase() || "").join("") || "Z";

function accountUrl(view, product = "") {
  const path = view === "signup" ? "/signup" : view === "forgot" ? "/forgot" : "/login";
  const url = new URL(ZENVENTORA_ACCOUNT_ORIGIN + path);
  url.searchParams.set("view", view);
  if (product) {
    url.searchParams.set("product", product);
    url.searchParams.set("returnTo", PRODUCT_ORIGINS[product] || window.location.origin);
    if (view === "signup") url.searchParams.set("productFlow", "signup");
  }
  return url.toString();
}

function renderSignedOut(root) {
  const product = root.dataset.accountProduct || "";
  root.innerHTML =
    '<a class="account-nav-link account-signin-link" data-account-action="signin" href="' + accountUrl("signin", product) + '">Sign in</a>' +
    '<a class="btn btn-primary btn-small account-get-started account-cta" data-account-cta="signup" data-account-action="signup" href="' + accountUrl("signup", product) + '">Get Started</a>';
}

function renderSignedIn(root, user) {
  const meta = user.user_metadata || {};
  const name = meta.full_name || meta.name || meta.company_name || user.email?.split("@")[0] || "My account";
  const candidate = meta.avatar_url || meta.picture;
  const avatar = typeof candidate === "string" && /^https:\/\//i.test(candidate) ? escapeHtml(candidate) : "";
  root.innerHTML =
    '<div class="account-profile-wrap">' +
      '<button class="account-profile-trigger" type="button" aria-expanded="false" aria-haspopup="true">' +
        (avatar ? '<img class="account-avatar" src="' + avatar + '" alt="" referrerpolicy="no-referrer">' : '<span class="account-avatar account-avatar-initials">' + initials(name) + '</span>') +
        '<span class="account-profile-name">' + escapeHtml(name) + '</span><span class="account-chevron" aria-hidden="true">▾</span>' +
      '</button>' +
      '<div class="account-profile-card" hidden>' +
        '<div class="account-card-heading">' +
          (avatar ? '<img class="account-avatar account-card-avatar" src="' + avatar + '" alt="" referrerpolicy="no-referrer">' : '<span class="account-avatar account-card-avatar account-avatar-initials">' + initials(name) + '</span>') +
          '<span><strong>' + escapeHtml(name) + '</strong><small>' + escapeHtml(user.email || "") + '</small></span>' +
        '</div>' +
        '<a class="account-manage-link" href="' + ZENVENTORA_ACCOUNT_ORIGIN + '/">My Accounts <span aria-hidden="true">↗</span></a>' +
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
    const { error } = await zenventoraSupabase.auth.signOut({ scope: "global" });
    if (error) {
      event.currentTarget.disabled = false;
      event.currentTarget.textContent = "Sign out";
      console.error("ZenVentora sign-out failed:", error);
    }
  });
}

function updateAccountCtas(session) {
  document.querySelectorAll(".account-cta, [data-account-cta]").forEach(element => {
    if (!(element instanceof HTMLAnchorElement)) return;
    const root = element.closest("[data-account-actions]");
    const product = element.dataset.accountProduct || root?.dataset.accountProduct || "";
    if (session?.user) {
      element.textContent = "Access Now";
      element.href = product ? (PRODUCT_ORIGINS[product] || window.location.origin) : ZENVENTORA_ACCOUNT_ORIGIN + "/";
      element.dataset.accountAction = "access";
    } else if (element.dataset.accountAction === "signup" || element.dataset.accountCta === "signup") {
      element.textContent = "Get Started";
      element.href = accountUrl("signup", product);
    }
  });
}

async function initZenVentoraAccount() {
  const roots = [...document.querySelectorAll("[data-account-actions]")];
  if (!roots.length) return;
  const { data } = await zenventoraSupabase.auth.getSession();
  const session = data.session;
  roots.forEach(root => session?.user ? renderSignedIn(root, session.user) : renderSignedOut(root));
  updateAccountCtas(session);
  zenventoraSupabase.auth.onAuthStateChange((_event, nextSession) => {
    roots.forEach(root => nextSession?.user ? renderSignedIn(root, nextSession.user) : renderSignedOut(root));
    updateAccountCtas(nextSession);
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initZenVentoraAccount, { once: true });
else initZenVentoraAccount();
