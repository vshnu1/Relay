// Behaviour for the public landing page at /welcome/. Kept in its own file
// because the server's Content Security Policy allows scripts only from this
// origin, not inline. Everything here is progressive: the page reads fine
// with JavaScript off.
(function () {
  // Opts the page into the scroll reveal. Without this class the CSS shows
  // everything at once, so a blocked script never hides the content.
  document.documentElement.classList.add("js");
  var top = document.getElementById("top");
  var menuBtn = document.getElementById("menu-btn");
  var links = document.querySelectorAll("#links a");
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Border under the nav once the page has moved.
  var onScroll = function () {
    top.classList.toggle("scrolled", window.scrollY > 8);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  // The pulse line behind the hero is placed by CSS as a share of the hero's
  // height, which meets the main button only at some window widths. In the
  // two-column layout, pin its flat run to the centre of that button, and keep
  // it there when the copy reflows (a font arriving, the window changing size).
  // offsetTop rather than a bounding box, so a transform never skews it.
  var hero = document.querySelector(".hero");
  var pulse = document.querySelector(".hero-bg svg");
  var heroBtn = document.querySelector(".hero-actions .btn.primary");
  var twoColumn = window.matchMedia("(min-width: 1041px)");
  var FLAT_RUN = 90 / 160; // where the flat run sits in the drawing's viewBox
  var alignPulse = function () {
    if (!hero || !pulse || !heroBtn) return;
    if (!twoColumn.matches) {
      pulse.style.top = "";
      return;
    }
    var y = heroBtn.offsetHeight / 2;
    for (var el = heroBtn; el && el !== hero; el = el.offsetParent)
      y += el.offsetTop;
    if (!el) return;
    var height = pulse.getBoundingClientRect().height;
    pulse.style.top = Math.round(y - height * FLAT_RUN) + "px";
  };
  alignPulse();
  window.addEventListener("load", alignPulse);
  window.addEventListener("resize", alignPulse);
  if ("ResizeObserver" in window)
    new ResizeObserver(alignPulse).observe(
      document.querySelector(".hero-copy") || hero,
    );

  // Menu on narrow screens.
  var closeMenu = function () {
    top.classList.remove("open");
    menuBtn.setAttribute("aria-expanded", "false");
    menuBtn.setAttribute("aria-label", "Open menu");
  };
  menuBtn.addEventListener("click", function () {
    var open = top.classList.toggle("open");
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeMenu();
  });

  // In-page links scroll themselves. The nav is sticky, so the target lands
  // below it (scroll-padding-top in the CSS), and the hash still updates so
  // the address can be copied.
  var scrollToId = function (id) {
    var target = document.getElementById(id);
    if (!target) return false;
    target.scrollIntoView({
      behavior: reduced ? "auto" : "smooth",
      block: "start",
    });
    if (history.pushState) history.pushState(null, "", "#" + id);
    else location.hash = id;
    return true;
  };
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener("click", function (e) {
      var id = a.getAttribute("href").slice(1);
      if (id === "top") {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
        if (history.pushState) history.pushState(null, "", location.pathname);
        closeMenu();
        return;
      }
      if (scrollToId(id)) {
        e.preventDefault();
        closeMenu();
      }
    });
  });

  // Reveal on scroll, and highlight the section in view.
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.08 },
    );
    reveals.forEach(function (el) {
      io.observe(el);
    });

    var byId = {};
    links.forEach(function (a) {
      byId[a.getAttribute("href").slice(1)] = a;
    });
    var spy = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          links.forEach(function (a) {
            a.classList.remove("active");
          });
          var a = byId[entry.target.id];
          if (a) a.classList.add("active");
        });
      },
      { rootMargin: "-40% 0px -55% 0px", threshold: 0 },
    );
    Object.keys(byId).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) spy.observe(el);
    });
  } else {
    reveals.forEach(function (el) {
      el.classList.add("in");
    });
  }

  // App tour tabs, with arrow-key movement per the WAI-ARIA tabs pattern.
  var tabs = Array.prototype.slice.call(
    document.querySelectorAll('[role="tab"]'),
  );
  var select = function (tab) {
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      var panel = document.getElementById(t.getAttribute("aria-controls"));
      panel.hidden = !on;
      panel.classList.toggle("on", on);
    });
  };
  tabs.forEach(function (tab, i) {
    tab.addEventListener("click", function () {
      select(tab);
    });
    tab.addEventListener("keydown", function (e) {
      var next = null;
      if (e.key === "ArrowDown" || e.key === "ArrowRight")
        next = tabs[(i + 1) % tabs.length];
      if (e.key === "ArrowUp" || e.key === "ArrowLeft")
        next = tabs[(i - 1 + tabs.length) % tabs.length];
      if (e.key === "Home") next = tabs[0];
      if (e.key === "End") next = tabs[tabs.length - 1];
      if (next) {
        e.preventDefault();
        select(next);
        next.focus();
      }
    });
  });
})();
