/**
 * rebuild_html.js — Generates EM_Interview_Guide.html
 * Reads answer sections, parses questions, emits HTML referencing
 * external styles.css and app.js.
 */
const fs = require("fs");
const path = require("path");

// ===== Section metadata =====
const sections = [
  { file: "answers_section1.md", icon: "👥", title: "Team Management & Leadership", color: "#16a34a" },
  { file: "answers_section2.md", icon: "📊", title: "Performance Management & Conflict Resolution", color: "#0078d4" },
  { file: "answers_section3.md", icon: "🎯", title: "Hiring, Onboarding & Project Delivery", color: "#f59e0b" },
  { file: "answers_section4.md", icon: "📈", title: "Metrics, KPIs & Cross-Functional Collaboration", color: "#8b5cf6" },
  { file: "answers_section5.md", icon: "🔧", title: "Technical Leadership & Architecture", color: "#ef4444" },
  { file: "answers_section6.md", icon: "🏢", title: "Product Strategy & Organizational Leadership", color: "#06b6d4" },
  { file: "answers_section7.md", icon: "💬", title: "Behavioral & Situational Questions", color: "#ec4899" },
  { file: "answers_section8.md", icon: "🏆", title: "Company-Specific Interview Questions", color: "#f97316" },
  { file: "answers_section9.md", icon: "🎓", title: "Advanced, System Thinking & Mock Scenarios", color: "#6366f1" },
];

// ===== Parsing =====
function parseSection(content, sIdx) {
  const questions = [];
  const lines = content.split("\n");
  let currentQ = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match = null;
    // Sections 1-5: ## Question N:
    if (sIdx < 5) match = line.match(/^##\s+Question\s+\d+:\s*(.+)/i);
    // Section 6: ## heading (skip Sub-Category)
    if (sIdx === 5) {
      if (/^##\s+Sub-Category/i.test(line)) continue;
      match = line.match(/^##\s+(.+)/);
      if (match && /^(Section|Table of Contents)/i.test(match[1])) match = null;
    }
    // Section 7: ### QN.
    if (sIdx === 6) match = line.match(/^###\s+Q\d+\.\s*(.+)/i);
    // Section 8: ### N. Interview Question -
    if (sIdx === 7) match = line.match(/^###\s+\d+\.\s+Interview Question\s*[-–—]\s*(.+)/i);
    // Section 9: ### Question N:
    if (sIdx === 8) match = line.match(/^###\s+Question\s+\d+:\s*(.+)/i);

    if (match) {
      if (currentQ) questions.push(currentQ);
      currentQ = { title: match[1].trim(), body: [] };
    } else if (currentQ) {
      currentQ.body.push(line);
    }
  }
  if (currentQ) questions.push(currentQ);
  return questions;
}

// ===== Markdown → HTML (minimal, good enough) =====
function md2html(lines) {
  let html = "";
  let inList = false, inOl = false, inCode = false, codeLang = "", codeLines = [];
  let inTable = false, tableRows = [];

  function flushList() {
    if (inList)  { html += "</ul>\n"; inList = false; }
    if (inOl)    { html += "</ol>\n"; inOl = false; }
  }
  function flushTable() {
    if (!inTable) return;
    inTable = false;
    if (tableRows.length === 0) return;
    html += '<div class="table-wrap"><table>\n<thead><tr>';
    const hdr = tableRows[0];
    hdr.forEach(c => { html += "<th>" + inlinemd(c.trim()) + "</th>"; });
    html += "</tr></thead>\n<tbody>\n";
    for (let r = 1; r < tableRows.length; r++) {
      html += "<tr>";
      tableRows[r].forEach(c => { html += "<td>" + inlinemd(c.trim()) + "</td>"; });
      html += "</tr>\n";
    }
    html += "</tbody></table></div>\n";
    tableRows = [];
  }

  function inlinemd(t) {
    t = t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    t = t.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    t = t.replace(/\*(.+?)\*/g, "<em>$1</em>");
    t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
    t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    return t;
  }

  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];

    // Code fences
    if (L.startsWith("```")) {
      if (!inCode) {
        flushList(); flushTable();
        codeLang = L.slice(3).trim();
        inCode = true; codeLines = [];
      } else {
        inCode = false;
        if (codeLang === "mermaid") {
          html += '<div class="mermaid-raw">' + codeLines.join("\n") + "</div>\n";
        } else {
          html += '<pre><code class="language-' + codeLang + '">' +
                  codeLines.join("\n").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;") +
                  "</code></pre>\n";
        }
      }
      continue;
    }
    if (inCode) { codeLines.push(L); continue; }

    // Blank line
    if (L.trim() === "") { flushList(); flushTable(); continue; }

    // Table
    if (L.trim().startsWith("|")) {
      flushList();
      const cells = L.split("|").slice(1);
      if (cells.length && cells[cells.length-1].trim() === "") cells.pop();
      if (cells.every(c => /^[\s:-]+$/.test(c))) { inTable = true; continue; }
      if (inTable || tableRows.length === 0) { tableRows.push(cells); inTable = true; continue; }
      tableRows.push(cells); inTable = true; continue;
    } else {
      flushTable();
    }

    // HR
    if (/^---+$/.test(L.trim())) { flushList(); html += "<hr>\n"; continue; }

    // Headings
    const hm = L.match(/^(#{1,6})\s+(.+)/);
    if (hm) { flushList(); const lv = hm[1].length; html += `<h${lv}>${inlinemd(hm[2])}</h${lv}>\n`; continue; }

    // Blockquote
    if (L.startsWith("> ")) { flushList(); html += "<blockquote><p>" + inlinemd(L.slice(2)) + "</p></blockquote>\n"; continue; }

    // Unordered list
    const ulm = L.match(/^(\s*)[-*]\s+(.+)/);
    if (ulm) { flushTable(); if (!inList) { html += "<ul>\n"; inList = true; } html += "<li>" + inlinemd(ulm[2]) + "</li>\n"; continue; }

    // Ordered list
    const olm = L.match(/^(\s*)\d+\.\s+(.+)/);
    if (olm) { flushTable(); if (!inOl) { html += "<ol>\n"; inOl = true; } html += "<li>" + inlinemd(olm[2]) + "</li>\n"; continue; }

    // Paragraph
    flushList();
    html += "<p>" + inlinemd(L) + "</p>\n";
  }
  flushList(); flushTable();
  return html;
}

// ===== Build =====
let totalQ = 0;
const parsed = sections.map((s, idx) => {
  const content = fs.readFileSync(path.join(__dirname, s.file), "utf-8");
  const qs = parseSection(content, idx);
  totalQ += qs.length;
  return qs;
});

console.log(`Parsed ${totalQ} total questions across ${sections.length} sections`);

// Generate HTML
let navHTML = "";
let bodyHTML = "";

sections.forEach((sec, si) => {
  const qs = parsed[si];
  const sectionId = "section-" + si;

  // Nav item
  navHTML += `<div class="nav-section">
    <div class="nav-section-header" data-target="${sectionId}">
      <span class="nav-icon">${sec.icon}</span>
      <span class="nav-title">${sec.title}</span>
      <span class="nav-badge">${qs.length}</span>
    </div>
  </div>\n`;

  // Section body
  bodyHTML += `<div id="${sectionId}" class="content-section">
    <div class="section-header" style="--section-color: ${sec.color}">
      <span class="section-icon">${sec.icon}</span>
      <div class="section-info">
        <div class="section-title">${sec.title}</div>
        <div class="section-count">${qs.length} Questions</div>
      </div>
      <button class="expand-all-btn">Expand All</button>
    </div>
    <div class="questions-grid">\n`;

  qs.forEach((q, qi) => {
    const contentHTML = md2html(q.body);
    bodyHTML += `<div class="question-card">
      <button class="question-header" aria-expanded="false">
        <span class="q-number">${qi + 1}</span>
        <span class="q-title">${q.title.replace(/&/g,"&amp;").replace(/</g,"&lt;")}</span>
        <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      <div class="question-body">
        <div class="question-content">${contentHTML}</div>
      </div>
    </div>\n`;
  });

  bodyHTML += `</div></div>\n`;
});

// Full page
const fullHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">
  <title>Engineering Manager Interview Guide</title>
  <script>
    (()=>{const p=new URLSearchParams(window.location.search).get("clawpilotTheme");
    const t=p||(window.matchMedia("(prefers-color-scheme:dark)").matches?"dark":"light");
    document.documentElement.setAttribute("data-theme",t);})();
  </script>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"><\/script>
  <link rel="stylesheet" href="styles.css">
</head>
<body>

<!-- ===== TOP BAR (mobile only, shown via CSS) ===== -->
<div class="topbar" id="topbar">
  <button class="topbar-menu-btn" id="topbarMenuBtn" aria-label="Open menu">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M3 12h18M3 6h18M3 18h18"/>
    </svg>
  </button>
  <div class="topbar-title">EM Interview <span>Guide</span></div>
  <button class="topbar-theme-btn" id="topbarThemeBtn" aria-label="Toggle theme">🌙</button>
</div>

<!-- ===== MOBILE SEARCH ===== -->
<div class="mobile-search" id="mobileSearchBar">
  <div class="search-wrapper">
    <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
    </svg>
    <input type="text" class="search-input" id="mobileSearchInput" placeholder="Search questions…">
  </div>
</div>

<!-- ===== SIDEBAR OVERLAY ===== -->
<div class="sidebar-overlay" id="sidebarOverlay"></div>

<!-- ===== PROGRESS BAR ===== -->
<div class="progress-bar"><div class="progress-fill" id="progressFill"></div></div>

<div class="app-layout">
  <!-- ===== SIDEBAR ===== -->
  <aside class="sidebar" id="sidebar">
    <div class="sidebar-header">
      <div class="sidebar-logo">📋 EM Interview <span>Guide</span></div>
      <div class="sidebar-subtitle">${totalQ} Questions · 9 Sections</div>
    </div>
    <div class="search-box">
      <div class="search-wrapper">
        <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input type="text" class="search-input" id="searchInput" placeholder="Search questions…">
      </div>
    </div>
    <nav class="sidebar-nav">
      ${navHTML}
    </nav>
    <div class="sidebar-footer">
      <label>Dark Mode</label>
      <button class="toggle-switch" id="themeToggle" aria-label="Toggle dark mode"></button>
    </div>
  </aside>

  <!-- ===== MAIN CONTENT ===== -->
  <main class="main-content">
    <div class="hero">
      <h1>Engineering Manager<br>Interview <span>Guide</span></h1>
      <p>Comprehensive preparation toolkit with ${totalQ} expert-crafted answers, frameworks, and strategic insights.</p>
      <div class="hero-stats">
        <div class="hero-stat"><div class="number">${totalQ}</div><div class="label">Questions</div></div>
        <div class="hero-stat"><div class="number">9</div><div class="label">Sections</div></div>
        <div class="hero-stat"><div class="number">200+</div><div class="label">Diagrams</div></div>
      </div>
    </div>

    <div class="content-wrapper">
      ${bodyHTML}
      <div id="noResults" class="no-results" style="display:none">
        <div class="emoji">🔍</div>
        <p>No questions match your search. Try different keywords.</p>
      </div>
    </div>
  </main>
</div>

<!-- ===== SCROLL TO TOP ===== -->
<button class="scroll-top" id="scrollTopBtn" aria-label="Scroll to top">
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
    <path d="M18 15l-6-6-6 6"/>
  </svg>
</button>

<script src="app.js"><\/script>
</body>
</html>`;

fs.writeFileSync(path.join(__dirname, "EM_Interview_Guide.html"), fullHTML, "utf-8");
const sizeKB = Math.round(fullHTML.length / 1024);
console.log(`Generated EM_Interview_Guide.html (${sizeKB} KB)`);
sections.forEach((s, i) => console.log(`  ${s.icon} ${s.title}: ${parsed[i].length} questions`));
