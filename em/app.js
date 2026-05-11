/* ===================================================================
   EM Interview Guide — app.js
   Sidebar nav, search, theme toggle, Mermaid rendering, scroll-to-top
   =================================================================== */

(function () {
  "use strict";

  // ===== DOM refs =====
  const sidebar      = document.getElementById("sidebar");
  const overlay       = document.getElementById("sidebarOverlay");
  const topbarMenuBtn = document.getElementById("topbarMenuBtn");
  const topbarTheme   = document.getElementById("topbarThemeBtn");
  const themeToggle   = document.getElementById("themeToggle");
  const searchInput   = document.getElementById("searchInput");
  const mobileSearch  = document.getElementById("mobileSearchInput");
  const progressFill  = document.getElementById("progressFill");
  const scrollTopBtn  = document.getElementById("scrollTopBtn");
  const noResults     = document.getElementById("noResults");

  const allCards      = document.querySelectorAll(".question-card");
  const allSections   = document.querySelectorAll(".content-section");
  const navHeaders    = document.querySelectorAll(".nav-section-header");

  // ===== Sidebar toggle (mobile) =====
  function openSidebar()  {
    sidebar.classList.add("open");
    overlay.classList.add("visible");
    document.body.style.overflow = "hidden";
  }
  function closeSidebar() {
    sidebar.classList.remove("open");
    overlay.classList.remove("visible");
    document.body.style.overflow = "";
  }

  topbarMenuBtn.addEventListener("click", function () {
    sidebar.classList.contains("open") ? closeSidebar() : openSidebar();
  });
  overlay.addEventListener("click", closeSidebar);

  // Close sidebar when a nav link is clicked (mobile)
  navHeaders.forEach(function (h) {
    h.addEventListener("click", function () {
      if (window.innerWidth <= 768) {
        setTimeout(closeSidebar, 200);
      }
    });
  });

  // ===== Theme toggle =====
  function isDark() {
    return document.documentElement.getAttribute("data-theme") === "dark";
  }
  function setTheme(dark) {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    themeToggle.classList.toggle("active", dark);
    // Update topbar theme icon
    topbarTheme.textContent = dark ? "☀️" : "🌙";
    try { localStorage.setItem("em-theme", dark ? "dark" : "light"); } catch (e) {}
  }
  // Init theme state
  themeToggle.classList.toggle("active", isDark());
  topbarTheme.textContent = isDark() ? "☀️" : "🌙";

  themeToggle.addEventListener("click", function () { setTheme(!isDark()); });
  topbarTheme.addEventListener("click", function () { setTheme(!isDark()); });

  // ===== Navigation scroll =====
  navHeaders.forEach(function (h) {
    h.addEventListener("click", function () {
      var target = document.getElementById(h.dataset.target);
      if (target) {
        var offset = window.innerWidth <= 768 ? 120 : 20;
        var y = target.getBoundingClientRect().top + window.pageYOffset - offset;
        window.scrollTo({ top: y, behavior: "smooth" });
      }
      // Active state
      navHeaders.forEach(function (n) { n.classList.remove("active"); });
      h.classList.add("active");
    });
  });

  // ===== Intersection Observer — highlight nav on scroll =====
  if ("IntersectionObserver" in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var sectionId = entry.target.id;
          navHeaders.forEach(function (n) {
            n.classList.toggle("active", n.dataset.target === sectionId);
          });
        }
      });
    }, { rootMargin: "-30% 0px -60% 0px" });

    allSections.forEach(function (s) { observer.observe(s); });
  }

  // ===== Expand / Collapse cards =====
  allCards.forEach(function (card) {
    var header = card.querySelector(".question-header");
    header.addEventListener("click", function () {
      var wasOpen = card.classList.contains("open");
      card.classList.toggle("open");
      if (!wasOpen) renderMermaidInCard(card);
    });
  });

  // Expand All / Collapse All
  document.querySelectorAll(".expand-all-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var sectionEl = btn.closest(".content-section");
      var cards = sectionEl.querySelectorAll(".question-card");
      var anyCollapsed = false;
      cards.forEach(function (c) { if (!c.classList.contains("open")) anyCollapsed = true; });

      if (anyCollapsed) {
        cards.forEach(function (c) { c.classList.add("open"); renderMermaidInCard(c); });
        btn.textContent = "Collapse All";
      } else {
        cards.forEach(function (c) { c.classList.remove("open"); });
        btn.textContent = "Expand All";
      }
    });
  });

  // ===== Mermaid on-demand rendering =====
  var mermaidReady = false;
  function initMermaid() {
    if (mermaidReady) return;
    if (typeof mermaid !== "undefined") {
      mermaid.initialize({
        startOnLoad: false,
        theme: isDark() ? "dark" : "default",
        securityLevel: "loose",
        flowchart: { useMaxWidth: true, htmlLabels: true, curve: "basis" },
        themeVariables: isDark()
          ? { primaryColor: "#fd8ea1", primaryTextColor: "#dedede",
              primaryBorderColor: "#5f5f5f", lineColor: "#919191",
              secondaryColor: "#3d3b3a", tertiaryColor: "#343231" }
          : { primaryColor: "#b11f4b", primaryTextColor: "#242424",
              primaryBorderColor: "#dedede", lineColor: "#5c5c5c",
              secondaryColor: "#f7f4ef", tertiaryColor: "#fcfbf8" }
      });
      mermaidReady = true;
    }
  }

  var mermaidCounter = 0;
  function renderMermaidInCard(card) {
    var codes = card.querySelectorAll("pre code.language-mermaid, .mermaid-raw");
    codes.forEach(function (block) {
      if (block.dataset.rendered === "true") return;
      initMermaid();
      if (typeof mermaid === "undefined") return;
      var code = block.textContent;
      var container = document.createElement("div");
      container.className = "mermaid";
      var id = "mermaid-" + (++mermaidCounter);
      try {
        mermaid.render(id, code).then(function (result) {
          container.innerHTML = result.svg;
          // replace the pre or the raw div
          var parent = block.closest("pre") || block;
          parent.parentNode.replaceChild(container, parent);
        }).catch(function () {
          block.dataset.rendered = "true";
        });
      } catch (e) {
        block.dataset.rendered = "true";
      }
    });
  }

  // ===== Search =====
  function doSearch(query) {
    query = query.trim().toLowerCase();
    var visibleCount = 0;

    allCards.forEach(function (card) {
      if (!query) {
        card.classList.remove("search-hidden");
        visibleCount++;
        return;
      }
      var title = card.querySelector(".q-title").textContent.toLowerCase();
      var content = card.querySelector(".question-content")
        ? card.querySelector(".question-content").textContent.toLowerCase()
        : "";
      if (title.indexOf(query) !== -1 || content.indexOf(query) !== -1) {
        card.classList.remove("search-hidden");
        visibleCount++;
      } else {
        card.classList.add("search-hidden");
      }
    });

    // Show/hide sections if all their cards are hidden
    allSections.forEach(function (sec) {
      var cards = sec.querySelectorAll(".question-card");
      var anyVisible = false;
      cards.forEach(function (c) { if (!c.classList.contains("search-hidden")) anyVisible = true; });
      sec.classList.toggle("search-hidden", !anyVisible);
    });

    // No results message
    noResults.style.display = (query && visibleCount === 0) ? "block" : "none";
  }

  // Sync both search inputs
  if (searchInput) searchInput.addEventListener("input", function () {
    if (mobileSearch) mobileSearch.value = this.value;
    doSearch(this.value);
  });
  if (mobileSearch) mobileSearch.addEventListener("input", function () {
    if (searchInput) searchInput.value = this.value;
    doSearch(this.value);
  });

  // ===== Progress bar =====
  function updateProgress() {
    var scrolled = window.pageYOffset;
    var docHeight = document.documentElement.scrollHeight - window.innerHeight;
    var pct = docHeight > 0 ? (scrolled / docHeight) * 100 : 0;
    progressFill.style.width = Math.min(pct, 100) + "%";
  }

  // ===== Scroll-to-top =====
  function updateScrollTop() {
    scrollTopBtn.classList.toggle("visible", window.pageYOffset > 400);
  }
  scrollTopBtn.addEventListener("click", function () {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // Throttled scroll handler
  var ticking = false;
  window.addEventListener("scroll", function () {
    if (!ticking) {
      window.requestAnimationFrame(function () {
        updateProgress();
        updateScrollTop();
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });

  // ===== Stagger entrance animations =====
  allCards.forEach(function (card, i) {
    card.style.animationDelay = Math.min(i * 0.03, 0.6) + "s";
  });

  // ===== Handle resize: close sidebar when moving to desktop =====
  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (window.innerWidth > 768) closeSidebar();
    }, 150);
  });

  // ===== Keyboard: Escape closes sidebar =====
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && sidebar.classList.contains("open")) closeSidebar();
  });

  // Init
  updateProgress();
  updateScrollTop();
})();
