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
 *
 * Once per visit, after a few seconds (8 unless changed on the developer
 * page) or half a page of scrolling, a ring spreads from the button and a
 * short greeting from Michael slides out beside it. Closing it keeps it
 * away for a week. The developer page can also hide the button on a site.
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
    // White with a navy edge, so it shows on a dark photo and a light page alike.
    ".mwchat-ring{position:absolute;inset:0;border-radius:50%;border:2px solid rgba(255,255,255,.9);" +
    "box-shadow:0 0 0 2px rgba(0,35,73,.5),inset 0 0 0 1px rgba(0,35,73,.25);opacity:0;pointer-events:none}" +
    ".mwchat-launcher.mwchat-ripple .mwchat-ring{animation:mwchat-ring 1.7s cubic-bezier(.2,.6,.35,1) 2}" +
    "@keyframes mwchat-ring{0%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(1.9)}}" +
    ".mwchat-teaser,.mwchat-teaser *{box-sizing:border-box}" +
    ".mwchat-teaser{position:fixed;right:20px;bottom:94px;z-index:2147483001;width:292px;max-width:calc(100vw - 40px);" +
    "background:#fff;color:#17181a;border-radius:18px;font-size:14px;line-height:1.45;text-align:left;" +
    "box-shadow:0 18px 48px rgba(0,35,73,.22),0 3px 10px rgba(0,0,0,.08);opacity:0;" +
    "transform:translateY(10px) scale(.96);transform-origin:calc(100% - 30px) 100%;" +
    "transition:opacity .3s ease,transform .45s cubic-bezier(.2,.8,.2,1)}" +
    ".mwchat-teaser.mwchat-shown{opacity:1;transform:none}" +
    ".mwchat-teaser:after{content:'';position:absolute;right:24px;bottom:-6px;width:14px;height:14px;background:#fff;" +
    "transform:rotate(45deg);border-radius:0 0 3px 0;box-shadow:3px 3px 5px rgba(0,35,73,.05)}" +
    ".mwchat-teaser-body{position:relative;z-index:1;display:flex;gap:12px;align-items:flex-start;width:100%;margin:0;" +
    "padding:14px 40px 15px 14px;border:0;border-radius:18px;background:transparent;color:inherit;font:inherit;" +
    "text-align:left;cursor:pointer;-webkit-tap-highlight-color:transparent}" +
    ".mwchat-teaser-body:focus-visible{outline:2px solid #002349;outline-offset:2px}" +
    ".mwchat-teaser-photo{position:relative;flex:none;width:44px;height:44px}" +
    ".mwchat-teaser-photo img,.mwchat-teaser-photo b{display:flex;width:44px;height:44px;border-radius:50%;object-fit:cover;" +
    "background:#002349;color:#fff;font-size:15px;font-weight:600;align-items:center;justify-content:center}" +
    ".mwchat-teaser-dot{position:absolute;right:0;bottom:1px;width:12px;height:12px;border-radius:50%;background:#23864f;border:2px solid #fff}" +
    ".mwchat-teaser-copy{display:block;min-width:0;padding-top:1px}" +
    ".mwchat-teaser-name{display:block;font-size:13px;font-weight:600;color:#002349;letter-spacing:.01em}" +
    ".mwchat-teaser-text{display:block;margin-top:2px;font-size:14.5px;color:#17181a}" +
    ".mwchat-teaser-text.mwchat-in{animation:mwchat-in .4s ease both}" +
    "@keyframes mwchat-in{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:none}}" +
    ".mwchat-typing{display:inline-flex;gap:4px;margin-top:6px;padding:8px 11px;border-radius:12px;background:#f1efea}" +
    ".mwchat-typing i{display:block;width:6px;height:6px;border-radius:50%;background:#8f8c84;animation:mwchat-typing 1s ease-in-out infinite}" +
    ".mwchat-typing i:nth-child(2){animation-delay:.15s}.mwchat-typing i:nth-child(3){animation-delay:.3s}" +
    "@keyframes mwchat-typing{0%,60%,100%{opacity:.45;transform:none}30%{opacity:1;transform:translateY(-3px)}}" +
    ".mwchat-teaser-close{position:absolute;z-index:2;top:8px;right:8px;width:28px;height:28px;margin:0;padding:0;border:0;" +
    "border-radius:50%;background:transparent;color:#8f8c84;cursor:pointer;display:flex;align-items:center;justify-content:center}" +
    ".mwchat-teaser-close:hover{background:#f1efea;color:#17181a}" +
    "@media (prefers-reduced-motion:reduce){.mwchat-launcher,.mwchat-launcher svg,.mwchat-panel,.mwchat-teaser{transition:none;animation:none}" +
    ".mwchat-badge,.mwchat-ring,.mwchat-typing i,.mwchat-teaser-text.mwchat-in{animation:none}}";

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
  var teaser = null;
  var teased = false;
  var teaserTimers = [];
  var teaserHide = null;
  var chatOpened = false;
  var greeting = null;
  var launcherAllowed = false;

  function mobile() {
    return window.matchMedia("(max-width: 640px)").matches;
  }

  function layout() {
    // The button first: it exists before the chat window is ever made.
    if (launcher) launcher.style.display = !launcherAllowed || (isOpen && mobile()) ? "none" : "flex";
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
    teased = true;
    chatOpened = true;
    hideTeaser(false);
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

  // The greeting beside the button.
  var DAY = 24 * 60 * 60 * 1000;

  function later(fn, ms) {
    teaserTimers.push(setTimeout(fn, ms));
  }

  function quiet() {
    // Not while the chat is open or under way, and not again once closed.
    if (isOpen || get("localStorage", "mwchat:active") === "1") return true;
    var off = Number(get("localStorage", "mwchat:teaser-off") || 0);
    return off > 0 && Date.now() - off < 7 * DAY;
  }

  function hideTeaser(dismissed) {
    for (var i = 0; i < teaserTimers.length; i++) clearTimeout(teaserTimers[i]);
    teaserTimers = [];
    clearTimeout(teaserHide);
    if (launcher) launcher.classList.remove("mwchat-ripple");
    if (dismissed) put("localStorage", "mwchat:teaser-off", String(Date.now()));
    if (!teaser) return;
    var t = teaser;
    teaser = null;
    t.classList.remove("mwchat-shown");
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, reduceMotion ? 0 : 320);
  }

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text) node.textContent = text;
    return node;
  }

  function buildTeaser(d, photoOk) {
    var box = el("div", "mwchat-teaser");
    var body = el("button", "mwchat-teaser-body");
    body.type = "button";
    body.setAttribute("aria-label", "Chat with " + d.name + ": " + d.text);
    var photo = el("span", "mwchat-teaser-photo");
    if (photoOk) {
      var img = el("img");
      img.src = d.photo;
      img.alt = "";
      photo.appendChild(img);
    } else {
      photo.appendChild(el("b", "", "MW"));
    }
    if (d.online) photo.appendChild(el("span", "mwchat-teaser-dot"));
    var copy = el("span", "mwchat-teaser-copy");
    copy.appendChild(el("span", "mwchat-teaser-name", d.name));
    var text = el("span", "mwchat-teaser-text", d.text);
    text.setAttribute("aria-live", "polite");
    if (reduceMotion) {
      copy.appendChild(text);
    } else {
      var dots = el("span", "mwchat-typing");
      dots.appendChild(el("i"));
      dots.appendChild(el("i"));
      dots.appendChild(el("i"));
      copy.appendChild(dots);
      later(function () {
        if (dots.parentNode) dots.parentNode.replaceChild(text, dots);
        text.className += " mwchat-in";
      }, 1500);
    }
    body.appendChild(photo);
    body.appendChild(copy);
    body.addEventListener("click", function () { open(); });

    var x = el("button", "mwchat-teaser-close");
    x.type = "button";
    x.setAttribute("aria-label", "Dismiss");
    x.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    x.addEventListener("click", function () { hideTeaser(true); });

    box.appendChild(body);
    box.appendChild(x);
    return box;
  }

  /**
   * If the greeting would sit on one of the page's own links or buttons
   * (the homepage's Browse Listings, say) and a small lift clears it, lift
   * it. A bigger overlap is left alone: the greeting goes away on its own.
   */
  function clearOfPage(box) {
    if (!document.elementsFromPoint) return;
    var w = box.offsetWidth;
    var h = box.offsetHeight + 24; // room for the line that replaces the dots
    var right = window.innerWidth - 20;
    var bottom = window.innerHeight - 94;
    var lift = 0;
    for (var x = right - w + 6; x <= right - 6; x += 22) {
      for (var y = bottom - 4; y >= bottom - h; y -= 14) {
        var hits = document.elementsFromPoint(x, y);
        for (var i = 0; i < hits.length; i++) {
          var hit = hits[i];
          if (hit === box || box.contains(hit) || (launcher && launcher.contains(hit))) continue;
          var target = hit.closest && hit.closest("a,button,input,select,textarea,[role=button]");
          if (!target) continue;
          var top = target.getBoundingClientRect().top;
          lift = Math.max(lift, bottom - top + 10);
          break;
        }
      }
    }
    if (lift > 0 && lift <= 72) box.style.bottom = 94 + lift + "px";
  }

  function showTeaser(d, photoOk) {
    if (quiet() || teaser || chatOpened) return;
    put("sessionStorage", "mwchat:teased", "1");
    teaser = buildTeaser(d, photoOk);
    document.body.appendChild(teaser);
    clearOfPage(teaser);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { if (teaser) teaser.classList.add("mwchat-shown"); });
    });
    // It stays a while, longer while the visitor is pointing at it.
    var autoHide = function (ms) {
      clearTimeout(teaserHide);
      teaserHide = setTimeout(function () { hideTeaser(false); }, ms);
    };
    teaser.addEventListener("mouseenter", function () { clearTimeout(teaserHide); });
    teaser.addEventListener("mouseleave", function () { autoHide(6000); });
    autoHide(mobile() ? 15000 : 25000);
  }

  /** Whether to show the button here, and the greeting. Null if the chat app can't be reached. */
  function loadConfig() {
    return fetch(base + "/api/v/widget?site=" + encodeURIComponent(site) + "&path=" + encodeURIComponent(location.pathname), {
      mode: "cors",
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  function tease() {
    if (teaser || quiet() || !launcher || !launcherAllowed) return;
    var ready = greeting
      ? Promise.resolve(greeting)
      : loadConfig().then(function (c) { return c && c.greeting; });
    ready
      .then(function (d) {
        if (!d || !d.text || quiet()) return;
        // The ring first; the greeting follows once the photo is ready.
        if (!reduceMotion) {
          launcher.classList.remove("mwchat-ripple");
          void launcher.offsetWidth;
          launcher.classList.add("mwchat-ripple");
          later(function () { if (launcher) launcher.classList.remove("mwchat-ripple"); }, 3600);
        }
        var shown = false;
        var go = function (ok) {
          if (shown) return;
          shown = true;
          later(function () { showTeaser(d, ok); }, reduceMotion ? 0 : 900);
        };
        var probe = new Image();
        probe.onload = function () { go(true); };
        probe.onerror = function () { go(false); };
        probe.src = d.photo;
        setTimeout(function () { go(probe.complete && probe.naturalWidth > 0); }, 1500);
      })
      .catch(function () {});
  }

  /** After the set delay, or once half the page has been scrolled after 3 seconds. */
  function scheduleTeaser(delay) {
    if (!launcher || quiet() || get("sessionStorage", "mwchat:teased") === "1") return;
    var since = Date.now();
    var timer = null;
    function fire() {
      if (teased) return;
      if (document.visibilityState !== "visible") {
        timer = setTimeout(fire, 2000);
        return;
      }
      teased = true;
      clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
      tease();
    }
    function onScroll() {
      var doc = document.documentElement;
      var room = doc.scrollHeight - window.innerHeight;
      if (room > 0 && window.scrollY / room >= 0.5 && Date.now() - since > Math.min(3000, delay)) fire();
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    timer = setTimeout(fire, delay);
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
      launcher.appendChild(el("span", "mwchat-ring"));
      badge = document.createElement("span");
      badge.className = "mwchat-badge";
      launcher.appendChild(badge);
      launcher.addEventListener("click", toggle);
      launcher.style.display = "none";
      document.body.appendChild(launcher);
      // The button shows once the chat app says it is on for this site, or
      // if the app can't be reached (better a button than none).
      loadConfig().then(function (c) {
        launcherAllowed = !c || c.launcher !== false;
        greeting = (c && c.greeting) || null;
        layout();
        if (greeting) scheduleTeaser(Math.max(2, Number(greeting.delay) || 8) * 1000);
      });
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
    // "Continue the chat" in an email of Michael's reply links to the page with #mwchat.
    if (location.hash === "#mwchat") {
      open();
      try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
    }

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
  window.MWChat = { loaded: true, open: open, close: close, toggle: toggle, tease: tease };

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
