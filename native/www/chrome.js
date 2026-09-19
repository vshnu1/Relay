// Native shell behaviour for the Relay patient app.
//
// Injected at document start by RelayViewController (ios/App/App/AppDelegate.swift)
// as a single WKUserScript, with the stylesheet handed in as RELAY_CSS_B64. The
// page itself is served by the Relay API server and knows nothing about this,
// which is the point: the web app stays one codebase owned by one person, and
// the native-only concerns live here.
//
// At .atDocumentStart WKWebView may not have created <html> yet, so everything
// waits for the root element rather than assuming it. Getting this wrong is
// silent: the script simply does nothing and the app renders as a web page.
(function () {
  var CSS_B64 = typeof RELAY_CSS_B64 === "string" ? RELAY_CSS_B64 : "";

  function whenRoot(run) {
    if (document.documentElement) return run();
    var observer = new MutationObserver(function () {
      if (!document.documentElement) return;
      observer.disconnect();
      run();
    });
    observer.observe(document, { childList: true, subtree: true });
  }

  function decode(b64) {
    var binary = atob(b64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder("utf-8").decode(bytes);
  }

  function addStyle() {
    if (!CSS_B64 || document.getElementById("relay-native-chrome")) return;
    var style = document.createElement("style");
    style.id = "relay-native-chrome";
    style.textContent = decode(CSS_B64);
    (document.head || document.documentElement).appendChild(style);
  }

  // env(safe-area-inset-*) reports 0 unless the viewport covers the whole
  // screen, and the page asks for the default (inset) viewport. What this must
  // NOT do is add a second <meta name="viewport">: at .atDocumentStart the
  // page's own tag has not been parsed yet, and two of them leave WebKit
  // laying the page out at the wrong width, which looks like the whole app is
  // zoomed in. So this amends the page's tag once it exists and otherwise
  // waits for it.
  function fixViewport() {
    var metas = document.querySelectorAll('meta[name="viewport"]');
    if (!metas.length) return false;
    for (var i = 0; i < metas.length; i++) {
      var content = metas[i].getAttribute("content") || "";
      if (content.indexOf("viewport-fit") !== -1) continue;
      // user-scalable=no is not how a web page should behave, and the web app
      // keeps pinch zoom. In the shell it is the fix for a WebView that zooms
      // into a tapped control and stays there, which clips the left of every
      // screen. Text size still follows the system: the app is one WebView, so
      // the accessibility answer here is iOS Zoom and Dynamic Type support,
      // not pinch.
      metas[i].setAttribute(
        "content",
        (content || "width=device-width, initial-scale=1") +
          ", viewport-fit=cover, maximum-scale=1, user-scalable=no",
      );
    }
    return true;
  }

  // The app is one patient's recovery record. A native launch should never land
  // on the landing page or the ward list, whatever the last hash was.
  function patientRoute() {
    var hash = location.hash.replace(/^#\/?/, "");
    if (!hash || hash === "classic" || hash.indexOf("doctor") === 0)
      location.hash = "/patient";
  }

  // ---- Haptics -------------------------------------------------------------
  // Capacitor injects its bridge into the served page (window.Capacitor), so
  // the Haptics plugin is reachable from here. Everything is guarded: in a
  // plain browser none of this exists and the app must not notice.
  function haptics() {
    try {
      var C = window.Capacitor;
      return C && C.isNativePlatform && C.isNativePlatform() && C.Plugins
        ? C.Plugins.Haptics
        : null;
    } catch (e) {
      return null;
    }
  }
  function tap(style) {
    var h = haptics();
    if (!h) return;
    try {
      h.impact({ style: style });
    } catch (e) {
      // a haptic is never worth an error
    }
  }
  var PRIMARY =
    ".rx-p-btn.primary, .rx-ph-btn.primary, .rx-signin-button, .rx-p-text-reply-actions .rx-p-btn";
  var LIGHT =
    ".rx-navlink, .rx-p-mode-choice label, .rx-ph-hrow.clickable, .rx-ph-row, .rx-ph-sig, .rx-ph-links a, .rx-p-iconbtn, .rx-p-back, .rx-p-btn:not(.primary), .rx-p-textbtn, .rx-ph-device, input[type=checkbox], input[type=radio]";
  function installHaptics() {
    if (!haptics()) return;
    document.addEventListener(
      "pointerdown",
      function (e) {
        var t = e.target;
        if (!(t instanceof Element)) return;
        var primary = t.closest(PRIMARY);
        if (primary && !primary.disabled) return tap("MEDIUM");
        var light = t.closest(LIGHT);
        if (light) tap("LIGHT");
      },
      { passive: true },
    );
  }

  // ---- Keyboard hints --------------------------------------------------------
  // The two code fields want the "Go" return key and no autocorrect; the page
  // does not set those because a desktop browser has no use for them. React
  // leaves attributes it did not set alone, so adding them here is safe.
  var HINTS = {
    // access-code gate
    ".rx-signin-input": {
      enterkeyhint: "go",
      autocorrect: "off",
      autocapitalize: "none",
      spellcheck: "false",
    },
    // discharge code (ABC-1234)
    ".rx-p-code input": {
      enterkeyhint: "go",
      autocorrect: "off",
      spellcheck: "false",
    },
    // hospital picker: nothing to add, the native wheel handles it
  };
  function applyHints(root) {
    Object.keys(HINTS).forEach(function (selector) {
      var attrs = HINTS[selector];
      (root.querySelectorAll ? root.querySelectorAll(selector) : []).forEach(
        function (el) {
          Object.keys(attrs).forEach(function (name) {
            if (el.getAttribute(name) !== attrs[name])
              el.setAttribute(name, attrs[name]);
          });
        },
      );
    });
  }
  function installHints() {
    applyHints(document);
    new MutationObserver(function (records) {
      for (var i = 0; i < records.length; i++) {
        var added = records[i].addedNodes;
        for (var j = 0; j < added.length; j++)
          if (added[j].nodeType === 1) applyHints(added[j]);
      }
    }).observe(document.body, { childList: true, subtree: true });
  }

  // ---- Screen changes ------------------------------------------------------
  // The page scrolls to top on hashchange. Sign-in is different: the access
  // gate, the discharge form and the app itself are swapped in by state, with
  // no hash change, while the keyboard's scroll offset is still in effect. The
  // new screen then opens with its heading under the status bar. So a swap of
  // any top-level screen resets the scroll, and a route change also dismisses
  // the keyboard.
  var SCREENS = ".rx-pweb, .rx-p-auth, .rx-landing, .rx-loading";
  function installScreenHooks() {
    window.addEventListener("hashchange", function () {
      var active = document.activeElement;
      if (active && active !== document.body && active.blur) active.blur();
    });
    // On a phone the readings list sits under the chart it drives (the shell
    // reorders them; see chrome.css §12). A row far down the list would
    // otherwise change a chart that is off-screen, so the chart comes back.
    document.addEventListener("click", function (e) {
      var t = e.target;
      if (!(t instanceof Element) || !t.closest(".rx-ph-sig")) return;
      var detail = document.querySelector(".rx-ph-detail");
      if (!detail) return;
      requestAnimationFrame(function () {
        detail.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
    new MutationObserver(function (records) {
      for (var i = 0; i < records.length; i++) {
        var added = records[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          var n = added[j];
          if (n.nodeType !== 1) continue;
          if (n.matches(SCREENS) || n.querySelector(SCREENS)) {
            window.scrollTo(0, 0);
            return;
          }
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
  }

  function apply() {
    document.documentElement.classList.add("relay-native");
    addStyle();
    patientRoute();
    return fixViewport();
  }

  function onBody(run) {
    if (document.body) return run();
    document.addEventListener("DOMContentLoaded", run);
  }

  whenRoot(function () {
    var done = apply();
    onBody(function () {
      installHaptics();
      installHints();
      installScreenHooks();
    });
    if (done) return;
    // The page's viewport tag arrives with the rest of <head>. Watch for it
    // rather than only retrying at DOMContentLoaded, so the safe-area insets
    // are correct on the first paint and not one frame later.
    var observer = new MutationObserver(function () {
      if (fixViewport()) observer.disconnect();
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
    document.addEventListener("DOMContentLoaded", function () {
      fixViewport();
      observer.disconnect();
    });
  });
})();
