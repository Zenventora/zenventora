// ZenVentora Common Account & Session Layer
// Loaded by every ZenVentora page that uses the shared header.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ZENVENTORA_ACCOUNT_ORIGIN = "https://accounts.zenventora.in";
const ZENVENTORA_SUPABASE_URL = "https://flwzqlywdlwatycxexmk.supabase.co";
const ZENVENTORA_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_QN1aNd7wxjkb6ktD6L8GOQ_nsfV1_bY";
const zenventoraSupabase = createClient(ZENVENTORA_SUPABASE_URL, ZENVENTORA_SUPABASE_PUBLISHABLE_KEY, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: false }
});

const PRODUCT_ORIGINS = {
  emenu: "https://emenu.zenventora.in/",
  siteradar: "https://siteradar.zenventora.in/",
  vadix: "https://vadix.zenventora.in/"
};

const escapeHtml = (v = "") => String(v).replace(/[&<>"']/g, c => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[c]));
const initials = (v = "") => v.trim().split(/\s+/).slice(0,2).map(x => x[0]?.toUpperCase() || "").join("") || "Z";

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

function renderSignedOut(root, product) {
  root.innerHTML = '<a class="account-nav-link" href="' + accountUrl("signin", product) + '">Sign in</a>' +
    '<a class="btn btn-primary btn-small account-get-started" data-account-cta="signup" href="' + accountUrl("signup", product) + '">Get Started</a>';
}

function renderSignedIn(root, user, product) {
  const meta = user.user_metadata || {};
  const name = meta.full_name || meta.name || meta.company_name || user.email?.split("@")[0] || "My account";
  const candidate = meta.avatar_url || meta.picture;
  const avatar = typeof candidate === "string" && /^https:\/\//i.test(candidate) ? escapeHtml(candidate) : "";
  root.innerHTML = '<div class="account-profile-wrap">' +
    '<button class="account-profile-trigger" type="button" aria-expanded="false" aria-haspopup="true">' +
    (avatar ? '<img class="account-avatar" src="' + avatar + '" alt="" referrerpolicy="no-referrer">' : '<span class="account-avatar account-avatar-initials">' + initials(name) + '</span>') +
    '<span class="account-profile-name">' + escapeHtml(name) + '</span><span class="account-chevron" aria-hidden="true">▾</span></button>' +
    '<div class="account-profile-card" hidden><div class="account-card-heading">' +
    (avatar ? '<img class="account-avatar account-card-avatar" src="' + avatar + '" alt="" referrerpolicy="no-referrer">' : '<span class="account-avatar account-card-avatar account-avatar-initials">' + initials(name) + '</span>') +
    '<span><strong>' + escapeHtml(name) + '</strong><small>' + escapeHtml(user.email || "") + '</small></span></div>' +
    '<a href="' + ZENVENTORA_ACCOUNT_ORIGIN + '/">My Accounts <span aria-hidden="true">↗</span></a>' +
    '<button type="button" data-account-signout>Sign out</button></div></div>';

  const trigger = root.querySelector(".account-profile-trigger");
  const card = root.querySelector(".account-profile-card");
  trigger?.addEventListener("click", () => {
    const open = card.hidden;
    card.hidden = !open;
    trigger.setAttribute("aria-expanded", String(open));
  });
  root.querySelector("[data-account-signout]")?.addEventListener("click", async e => {
    e.currentTarget.disabled = true;
    e.currentTarget.textContent = "Signing out…";
    await zenventoraSupabase.auth.signOut({ scope: "global" });
  });
}

async function initZenVentoraAccount() {
  const root = document.querySelector("[data-account-actions]");
  if (!root) return;
  const product = root.dataset.accountProduct || "";
  const { data } = await zenventoraSupabase.auth.getSession();
  const session = data.session;
  if (session?.user) renderSignedIn(root, session.user, product);
  else renderSignedOut(root, product);

  document.querySelectorAll("[data-account-cta]").forEach(el => {
    if (session?.user) {
      el.textContent = "Access Now";
      el.href = product ? (PRODUCT_ORIGINS[product] || window.location.origin) : ZENVENTORA_ACCOUNT_ORIGIN + "/";
    }
  });

  zenventoraSupabase.auth.onAuthStateChange((_event, next) => {
    if (next?.user) renderSignedIn(root, next.user, product);
    else renderSignedOut(root, product);
  });
}

initZenVentoraAccount();
