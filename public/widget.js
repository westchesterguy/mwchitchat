/*
 * MW Chat: the loader the sites include.
 *
 *   <script src="https://CHAT-APP/widget.js" data-site="westchesterguy" async></script>
 *
 * data-site      "westchesterguy" or "horse"
 * data-launcher  "false" hides the round chat button (the site's own
 *                Ask Michael button can call MWChat.open() instead)
 *
 * It keeps a random visitor token in this site's localStorage, shows the
 * chat window from the chat app in a frame, and, only for someone with a
 * chat under way, reports the page they are on so Michael can see it.
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
  var NAVY = "#002349";

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
      s.inset = "auto 20px 92px auto";
      s.width = "380px";
      s.height = "min(620px, calc(100vh - 120px))";
      s.borderRadius = "6px";
    }
    if (launcher) launcher.style.display = isOpen && mobile() ? "none" : "flex";
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
    panel.setAttribute("data-mwchat", "panel");
    panel.style.cssText =
      "position:fixed;z-index:2147483000;display:none;overflow:hidden;background:#fff;" +
      "box-shadow:0 12px 40px rgba(0,0,0,.25);";
    frame = document.createElement("iframe");
    frame.title = "Chat with Michael Winter";
    frame.src = base + "/embed?site=" + encodeURIComponent(site) + "#t=" + token;
    frame.style.cssText = "border:0;width:100%;height:100%;display:block;background:#fff;";
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
    isOpen = true;
    panel.style.display = "block";
    setBadge(false);
    put("sessionStorage", "mwchat:open", "1");
    if (launcher) launcher.setAttribute("aria-expanded", "true");
    layout();
    sendPage();
    tellFrame({ type: "mwchat:visible", open: true });
  }

  function close() {
    isOpen = false;
    if (panel) panel.style.display = "none";
    put("sessionStorage", "mwchat:open", null);
    if (launcher) {
      launcher.setAttribute("aria-expanded", "false");
      launcher.focus();
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
        if (!isOpen) open();
        break;
    }
  });

  function buildLauncher() {
    launcher = document.createElement("button");
    launcher.type = "button";
    launcher.setAttribute("aria-label", "Chat with Michael Winter");
    launcher.setAttribute("aria-expanded", "false");
    launcher.style.cssText =
      "position:fixed;right:20px;bottom:20px;z-index:2147483001;width:58px;height:58px;" +
      "border:0;border-radius:50%;background:" + NAVY + ";color:#fff;cursor:pointer;" +
      "display:flex;align-items:center;justify-content:center;" +
      "box-shadow:0 6px 20px rgba(0,0,0,.25);";
    launcher.innerHTML =
      '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M4 5h16v11H9l-5 4z"/></svg>';
    badge = document.createElement("span");
    badge.style.cssText =
      "position:absolute;top:4px;right:4px;width:12px;height:12px;border-radius:50%;" +
      "background:#d23b2a;border:2px solid #fff;display:none;";
    launcher.appendChild(badge);
    launcher.addEventListener("click", toggle);
    document.body.appendChild(launcher);
  }

  function init() {
    if (withLauncher) buildLauncher();
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
