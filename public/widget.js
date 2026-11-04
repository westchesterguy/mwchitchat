/*
 * MW Chat: the loader the sites include.
 *
 *   <script src="https://chat.westchesterguy.com/widget.js" data-site="westchesterguy" async></script>
 *
 * data-site      "westchesterguy" or "horse"
 * data-launcher  "false" hides the round chat button (the site's own
 *                Ask Michael button can call MWChat.open() instead)
 *
 * It keeps a random visitor token in this site's localStorage, shows the
 * chat window from the chat app in a frame, and, only for someone with a
 * chat under way, reports the page they are on so Michael can see it.
 * Everything it adds to the page is prefixed mwchat- so it cannot collide
 * with the site's own styles.
 */
(function () {
  "use strict";
  if (window.MWChat && window.MWChat.loaded) return;

  var script =
    document.currentScript || document.querySelector('script[src*="/widget.js"][data-site]');
  if (!script) return;
  var base = new URL(script.src).origin;
  var site = script.getAttribute("data-site") || "westchesterguy";
  var withLauncher = script.getAttribute("data-launcher") !== "false";
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var CSS =
    ".mwchat-launcher{position:fixed;right:20px;bottom:20px;z-index:2147483001;width:60px;height:60px;" +
    "border:0;border-radius:50%;background:#002349;color:#fff;cursor:pointer;display:flex;align-items:center;" +
    "justify-content:center;box-shadow:0 8px 24px rgba(0,35,73,.32),0 2px 6px rgba(0,0,0,.12);" +
    "transition:transform .2s cubic-bezier(.2,.8,.2,1),box-shadow .2s ease;-webkit-tap-highlight-color:transparent;" +
    "animation:mwchat-pop .35s cubic-bezier(.2,.8,.2,1) both}" +
    ".mwchat-launcher:hover{transform:translateY(-2px) scale(1.04);box-shadow:0 12px 30px rgba(0,35,73,.38),0 2px 6px rgba(0,0,0,.12)}" +
    ".mwchat-launcher:active{transform:scale(.94)}" +
    ".mwchat-launcher:focus-visible{outline:3px solid #fff;outline-offset:-6px}" +
    ".mwchat-launcher svg{position:absolute;transition:transform .25s cubic-bezier(.2,.8,.2,1),opacity .2s ease}" +
    ".mwchat-launcher .mwchat-i-close{opacity:0;transform:rotate(-90deg) scale(.6)}" +
    ".mwchat-launcher.mwchat-open .mwchat-i-chat{opacity:0;transform:rotate(90deg) scale(.6)}" +
    ".mwchat-launcher.mwchat-open .mwchat-i-close{opacity:1;transform:none}" +
    ".mwchat-badge{position:absolute;top:2px;right:2px;width:14px;height:14px;border-radius:50%;background:#d23b2a;" +
    "border:2px solid #fff;display:none;animation:mwchat-pulse 1.6s ease-out infinite}" +
    ".mwchat-panel{position:fixed;z-index:2147483000;display:none;overflow:hidden;background:#f3f2ee;" +
    "box-shadow:0 24px 64px rgba(0,35,73,.28),0 4px 14px rgba(0,0,0,.12);opacity:0;" +
    "transform:translateY(16px) scale(.97);transform-origin:bottom right;" +
    "transition:opacity .22s ease,transform .28s cubic-bezier(.2,.8,.2,1)}" +
    ".mwchat-panel.mwchat-shown{opacity:1;transform:none}" +
    ".mwchat-panel iframe{border:0;width:100%;height:100%;display:block;background:#f3f2ee}" +
    "@media (max-width:640px){.mwchat-panel{transform:translateY(40px);transform-origin:bottom center}" +
    ".mwchat-panel.mwchat-shown{transform:none}}" +
    "@keyframes mwchat-pop{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:none}}" +
    "@keyframes mwchat-pulse{0%{box-shadow:0 0 0 0 rgba(210,59,42,.5)}70%{box-shadow:0 0 0 10px rgba(210,59,42,0)}100%{box-shadow:0 0 0 0 rgba(210,59,42,0)}}" +
    "@media (prefers-reduced-motion:reduce){.mwchat-launcher,.mwchat-launcher svg,.mwchat-panel{transition:none;animation:none}.mwchat-badge{animation:none}}";

  function get(store, key) {
    try { return window[store].getItem(key); } catch (e) { return null; }
  }
  function put(store, key, value) {
    try {
      if (value === null) window[store].removeItem(key);
      else window[store].setItem(key, value);
    } catch (e) {}
  }

  function newToken() {
    var bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    var s = "";
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  var token = get("localStorage", "mwchat:token");
  if (!token || !/^[A-Za-z0-9_-]{32,128}$/.test(token)) {
    token = newToken();
    put("localStorage", "mwchat:token", token);
  }

  var panel = null;
  var frame = null;
  var launcher = null;
  var badge = null;
  var isOpen = false;
  var hideTimer = null;
  var savedOverflow = null;

  function mobile() {
    return window.matchMedia("(max-width: 640px)").matches;
  }

  function layout() {
    if (!panel) return;
    var s = panel.style;
    if (mobile()) {
      s.inset = "0";
      s.width = "100%";
      s.height = "100%";
      s.borderRadius = "0";
    } else {
      s.inset = "auto 20px 96px auto";
      s.width = "384px";
      s.height = "min(640px, calc(100vh - 128px))";
      s.borderRadius = "18px";
    }
    if (launcher) launcher.style.display = isOpen && mobile() ? "none" : "flex";
    // A full-screen chat on a phone should not let the page scroll behind it.
    var lock = isOpen && mobile();
    if (lock && savedOverflow === null) {
      savedOverflow = document.documentElement.style.overflow;
      document.documentElement.style.overflow = "hidden";
    } else if (!lock && savedOverflow !== null) {
      document.documentElement.style.overflow = savedOverflow;
      savedOverflow = null;
    }
  }

  function tellFrame(message) {
    if (frame && frame.contentWindow) frame.contentWindow.postMessage(message, base);
  }

  function sendPage() {
    tellFrame({
      type: "mwchat:page",
      url: location.href,
      title: document.title,
      referrer: document.referrer,
    });
  }

  function ensureFrame() {
    if (panel) return;
    panel = document.createElement("div");
    panel.className = "mwchat-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Chat with Michael Winter");
    frame = document.createElement("iframe");
    frame.title = "Chat with Michael Winter";
    frame.src = base + "/embed?site=" + encodeURIComponent(site) + "#t=" + token;
    frame.setAttribute("allow", "clipboard-write");
    panel.appendChild(frame);
    document.body.appendChild(panel);
    layout();
  }

  function setBadge(on) {
    if (badge) badge.style.display = on ? "block" : "none";
  }

  function open() {
    ensureFrame();
    clearTimeout(hideTimer);
    isOpen = true;
    panel.style.display = "block";
    // Next frame, so the transition has a starting point.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { panel.classList.add("mwchat-shown"); });
    });
    setBadge(false);
    put("sessionStorage", "mwchat:open", "1");
    if (launcher) {
      launcher.classList.add("mwchat-open");
      launcher.setAttribute("aria-expanded", "true");
      launcher.setAttribute("aria-label", "Close chat");
    }
    layout();
    sendPage();
    tellFrame({ type: "mwchat:visible", open: true });
  }

  function close() {
    if (!panel) return;
    isOpen = false;
    panel.classList.remove("mwchat-shown");
    hideTimer = setTimeout(function () {
      if (!isOpen) panel.style.display = "none";
    }, reduceMotion ? 0 : 280);
    put("sessionStorage", "mwchat:open", null);
    if (launcher) {
      launcher.classList.remove("mwchat-open");
      launcher.setAttribute("aria-expanded", "false");
      launcher.setAttribute("aria-label", "Chat with Michael Winter");
      launcher.focus({ preventScroll: true });
    }
    layout();
    tellFrame({ type: "mwchat:visible", open: false });
  }

  function toggle() {
    isOpen ? close() : open();
  }

  // Page reporting, for visitors with a chat under way only.
  function ping() {
    if (get("localStorage", "mwchat:active") !== "1") return;
    fetch(base + "/api/v/ping", {
      method: "POST",
      mode: "cors",
      keepalive: true,
      headers: { "content-type": "application/json", "x-mwchat-token": token },
      body: JSON.stringify({ site: site, url: location.href, title: document.title }),
    })
      .then(function (r) { return r.json(); })
      .then(function (d) { if (!d.active) put("localStorage", "mwchat:active", null); })
      .catch(function () {});
  }

  window.addEventListener("message", function (e) {
    if (e.origin !== base || !e.data) return;
    switch (e.data.type) {
      case "mwchat:ready":
        sendPage();
        tellFrame({ type: "mwchat:visible", open: isOpen });
        break;
      case "mwchat:close":
        close();
        break;
      case "mwchat:started":
        put("localStorage", "mwchat:active", "1");
        ping();
        break;
      case "mwchat:ended":
        put("localStorage", "mwchat:active", null);
        break;
      case "mwchat:unread":
        // Michael replied while the window was closed: bring it back.
        if (!isOpen) {
          setBadge(true);
          open();
        }
        break;
    }
  });

  var ICONS =
    '<svg class="mwchat-i-chat" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 13.5z"/></svg>' +
    '<svg class="mwchat-i-close" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';

  function init() {
    if (!document.getElementById("mwchat-styles")) {
      var style = document.createElement("style");
      style.id = "mwchat-styles";
      style.textContent = CSS;
      document.head.appendChild(style);
    }
    if (withLauncher) {
      launcher = document.createElement("button");
      launcher.type = "button";
      launcher.className = "mwchat-launcher";
      launcher.setAttribute("aria-label", "Chat with Michael Winter");
      launcher.setAttribute("aria-expanded", "false");
      launcher.innerHTML = ICONS;
      badge = document.createElement("span");
      badge.className = "mwchat-badge";
      launcher.appendChild(badge);
      launcher.addEventListener("click", toggle);
      document.body.appendChild(launcher);
    }
    window.addEventListener("resize", layout);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && isOpen) close();
    });

    // A visitor mid-chat keeps the window loaded (hidden) so a reply can
    // bring it back, and keeps reporting where they are.
    if (get("localStorage", "mwchat:active") === "1") {
      ensureFrame();
      ping();
    }
    if (get("sessionStorage", "mwchat:open") === "1") open();

    var lastUrl = location.href;
    setInterval(function () {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        sendPage();
        ping();
      }
    }, 2000);
    setInterval(function () {
      if (document.visibilityState === "visible") ping();
    }, 30000);
  }

  // Calls made before this script loaded, e.g. MWChat.q = ["open"].
  var queued = (window.MWChat && window.MWChat.q) || [];
  window.MWChat = { loaded: true, open: open, close: close, toggle: toggle };

  function start() {
    init();
    for (var i = 0; i < queued.length; i++) {
      var call = window.MWChat[queued[i]];
      if (typeof call === "function") call();
    }
  }

  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start);
})();
