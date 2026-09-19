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

  function apply() {
    document.documentElement.classList.add("relay-native");
    addStyle();
    patientRoute();
    return fixViewport();
  }

  whenRoot(function () {
    if (apply()) return;
    // The page's viewport tag arrives with the rest of <head>. Watch for it
    // rather than only retrying at DOMContentLoaded, so the safe-area insets
    // are correct on the first paint and not one frame later.
    var observer = new MutationObserver(function () {
      if (fixViewport()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    document.addEventListener("DOMContentLoaded", function () {
      fixViewport();
      observer.disconnect();
    });
  });
})();
