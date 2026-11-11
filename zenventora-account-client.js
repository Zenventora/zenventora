/* ZenVentora Common Account Client
 * One browser-facing identity/session layer for ZenVentora products.
 * Product databases remain product-owned; this file only handles account identity,
 * session state, account handoff, and account-aware navigation.
 */
(function () {
  "use strict";

  // Temporary production fallback while accounts.zenventora.in DNS/custom-domain mapping is unavailable.
const ACCOUNT_ORIGIN = "https://zenventora-accounts-bels.onrender.com";
  const BRIDGE_URL = ACCOUNT_ORIGIN + "/session-bridge.html";
  const PRODUCT_ORIGINS = {
    emenu: "https://emenu.zenventora.in/",
    siteradar: "https://siteradar.zenventora.in/",
    vadix: "https://vadix.zenventora.in/"
  };

  let bridge = null;
  let session = null;
  let ready = false;
  let listeners = new Set();

  function firstPartyOrigin(value) {
    try {
      const url = new URL(value);
      if (url.protocol !== "https:") return null;
      if (url.hostname !== "zenventora.in" && !url.hostname.endsWith(".zenventora.in")) return null;
      return url.origin + "/";
    } catch {
      return null;
    }
  }

  function productOrigin(product, explicitUrl) {
    return firstPartyOrigin(explicitUrl) || PRODUCT_ORIGINS[String(product || "").toLowerCase()] || null;
  }

  function authUrl(view, options) {
    options = options || {};
    const path = view === "signup" ? "/signup" : view === "forgot" ? "/forgot" : "/login";
    const url = new URL(ACCOUNT_ORIGIN + path);
    url.searchParams.set("view", view);
    if (options.product) url.searchParams.set("product", options.product);
    if (options.productFlow) url.searchParams.set("productFlow", options.productFlow);
    if (options.returnTo) url.searchParams.set("returnTo", firstPartyOrigin(options.returnTo) || "");
    else if (options.product) url.searchParams.set("returnTo", productOrigin(options.product) || window.location.origin);
    return url.toString();
  }

  function notify() {
    listeners.forEach(function (fn) {
      try { fn(session); } catch (e) { console.error("ZenVentora account listener failed", e); }
    });
    window.dispatchEvent(new CustomEvent("zenventora:session", { detail: session }));
  }

  function handleMessage(event) {
    if (event.origin !== ACCOUNT_ORIGIN || !bridge || event.source !== bridge.contentWindow) return;
    const message = event.data;
    if (!message || message.namespace !== "zenventora-account-bridge") return;

    if (message.type === "session") {
      session = message.user ? {
        user: message.user,
        accessToken: message.access_token || null,
       } : null;
      ready = true;
      notify();
    }

    if (message.type === "signed_out") {
      session = null;
      ready = true;
      notify();
    }
  }

  function init() {
    if (bridge) return;
    window.addEventListener("message", handleMessage);
    bridge = document.createElement("iframe");
    bridge.src = BRIDGE_URL;
    bridge.title = "ZenVentora account session";
    bridge.tabIndex = -1;
    bridge.setAttribute("aria-hidden", "true");
    bridge.style.cssText = "position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;border:0;clip-path:inset(50%);";
    (document.body || document.documentElement).appendChild(bridge);
    window.setTimeout(function () {
      if (!ready) {
        ready = true;
        session = null;
        notify();
      }
    }, 5000);
  }

  function getSession() {
    init();
    return new Promise(function (resolve) {
      if (ready) return resolve(session);
      const off = onSessionChange(function (value) {
        off();
        resolve(value);
      });
    });
  }

  function onSessionChange(callback) {
    listeners.add(callback);
    return function () { listeners.delete(callback); };
  }

  function requireSession(options) {
    return getSession().then(function (value) {
      if (value && value.user) return value;
      const product = options && options.product;
      const returnTo = options && options.returnTo;
      window.location.assign(authUrl("signin", { product: product, returnTo: returnTo }));
      return null;
    });
  }

  function signIn(product, returnTo) {
    window.location.assign(authUrl("signin", { product: product, returnTo: returnTo }));
  }

  function signUp(product, returnTo) {
    window.location.assign(authUrl("signup", { product: product, productFlow: "signup", returnTo: returnTo }));
  }

  function openAccount() {
    window.location.assign(ACCOUNT_ORIGIN + "/");
  }

  function signOut() {
    init();
    bridge && bridge.contentWindow && bridge.contentWindow.postMessage({ type: "zenventora:signout" }, ACCOUNT_ORIGIN);
  }

  window.ZenVentoraAccount = {
    ACCOUNT_ORIGIN: ACCOUNT_ORIGIN,
    init: init,
    getSession: getSession,
    onSessionChange: onSessionChange,
    requireSession: requireSession,
    signIn: signIn,
    signUp: signUp,
    openAccount: openAccount,
    signOut: signOut,
    authUrl: authUrl,
    productOrigin: productOrigin,
    getAccessToken: function () { return session && session.accessToken ? session.accessToken : null; }
  };

  init();
})();