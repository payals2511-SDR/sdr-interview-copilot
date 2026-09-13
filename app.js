const form = document.getElementById("researchForm");
const input = document.getElementById("companyInput");
const button = document.getElementById("researchBtn");
const loading = document.getElementById("loading");
const errorBox = document.getElementById("error");
const errorText = document.getElementById("errorText");
const landing = document.getElementById("landing");
const workspace = document.getElementById("workspace");
const resultContent = document.getElementById("resultContent");
const companyTitle = document.getElementById("companyTitle");
const sidebarCompany = document.getElementById("sidebarCompany");
const companyAvatar = document.getElementById("companyAvatar");
const sectionSubtitle = document.getElementById("sectionSubtitle");
const sourceLinks = document.getElementById("sourceLinks");
const sourceToggle = document.getElementById("sourceToggle");
const sideNav = document.getElementById("sideNav");
const mobileNav = document.getElementById("mobileNav");
const newResearch = document.getElementById("newResearch");

let currentData = null;
let sectionsById = {};

const groups = [
  { id: "overview", label: "Overview", icon: "⌂", items: ["What the company does", "Company snapshot"] },
  { id: "company", label: "Company", icon: "◈", items: ["Products / services", "Work culture & employee reviews", "Recent signals"] },
  { id: "market", label: "Market & Sales", icon: "◉", items: ["Market, customers & competitors", "What an SDR would likely sell", "Main pain points"] },
  { id: "interview", label: "Interview Prep", icon: "✦", items: ["Likely SDR interview questions", "How to prepare", "Your 60-second interview angle"] },
  { id: "finish", label: "Final Check", icon: "✓", items: ["Questions to ask the interviewer", "Things to verify before the interview"] }
];

const subtitles = {
  "What the company does": "Understand the business in plain English.",
  "Company snapshot": "The key facts to know before you interview.",
  "Products / services": "Know what the company actually sells.",
  "Work culture & employee reviews": "Look for signals about the employee experience.",
  "Recent signals": "Recent news, growth, hiring and other useful signals.",
  "Market, customers & competitors": "Know the market, buyers and alternatives.",
  "What an SDR would likely sell": "Translate the company into an SDR conversation.",
  "Main pain points": "The problems prospects may care about most.",
  "Likely SDR interview questions": "Questions you should be ready to answer.",
  "How to prepare": "A practical preparation checklist.",
  "Your 60-second interview angle": "A concise way to position yourself.",
  "Questions to ask the interviewer": "Smart questions that show preparation.",
  "Things to verify before the interview": "Facts worth double-checking before the call."
};

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const company = input.value.trim();
  if (!company) return;
  setState("loading");
  button.disabled = true;
  try {
    const response = await fetch("/.netlify/functions/research", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Research failed.");
    renderResults(data);
    setState("results");
  } catch (err) {
    errorText.textContent = err.message || "Could not complete the research.";
    setState("error");
  } finally { button.disabled = false; }
});

newResearch.addEventListener("click", () => {
  currentData = null;
  workspace.classList.add("hidden");
  landing.classList.remove("hidden");
  errorBox.classList.add("hidden");
  input.focus();
  });

sourceToggle.addEventListener("click", () => sourceLinks.classList.toggle("hidden"));
mobileNav.addEventListener("change", () => navigate(mobileNav.value));
window.addEventListener("hashchange", () => { if (currentData) navigate(location.hash.slice(1) || "what-the-company-does"); });

function setState(state) {
  landing.classList.toggle("hidden", state !== "loading" && state !== "results" && state !== "error");
  loading.classList.toggle("hidden", state !== "loading");
  errorBox.classList.toggle("hidden", state !== "error");
  workspace.classList.toggle("hidden", state !== "results");
}

function slugify(value) { return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""); }
function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
function inlineMarkdown(text) { return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>").replace(/`(.+?)`/g, "<code>$1</code>"); }

function markdownToHtml(md) {
  if (!md) return "<p class=\"empty-state\">No information was returned for this section.</p>";
  const lines = md.replace(/\r/g, "").split("\n"); let html = "", inUl = false, inOl = false;
  const closeLists = () => { if (inUl) { html += "</ul>"; inUl = false; } if (inOl) { html += "</ol>"; inOl = false; } };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { closeLists(); continue; }
    if (/^###\s+/.test(line)) { closeLists(); html += `<h4>${inlineMarkdown(line.replace(/^###\s+/, ""))}</h4>`; continue; }
    if (/^##\s+/.test(line)) { closeLists(); html += `<h3>${inlineMarkdown(line.replace(/^##\s+/, ""))}</h3>`; continue; }
    if (/^#\s+/.test(line)) { closeLists(); html += `<h3>${inlineMarkdown(line.replace(/^#\s+/, ""))}</h3>`; continue; }
    if (/^[-*]\s+/.test(line)) { if (!inUl) { closeLists(); html += "<ul>"; inUl = true; } html += `<li>${inlineMarkdown(line.replace(/^[-*]\s+/, ""))}</li>`; continue; }
    if (/^\d+\.\s+/.test(line)) { if (!inOl) { closeLists(); html += "<ol>"; inOl = true; } html += `<li>${inlineMarkdown(line.replace(/^\d+\.\s+/, ""))}</li>`; continue; }
    if (/^>\s+/.test(line)) { closeLists(); html += `<div class="quote">${inlineMarkdown(line.replace(/^>\s+/, ""))}</div>`; continue; }
    html += `<p>${inlineMarkdown(line)}</p>`;
  }
  closeLists(); return html;
}

function renderResults(data) {
  currentData = data;
  companyTitle.textContent = data.company_name || "Company research";
  sidebarCompany.textContent = data.company_name || "Company";
  companyAvatar.textContent = (data.company_name || "C").trim().charAt(0).toUpperCase();
  sourceLinks.innerHTML = (data.sources || []).map(s => `<a href="${escapeHtml(s.url)}" target="_blank" rel="noopener">${escapeHtml(s.title || s.url)}</a>`).join("") || "<span class=\"no-sources\">No source links returned.</span>";

  sectionsById = {};
  (data.sections || []).forEach((section, i) => { sectionsById[slugify(section.title || `section-${i + 1}`)] = section; });
  buildNavigation();
  const first = groups[0].items.map(slugify).find(id => sectionsById[id]) || Object.keys(sectionsById)[0];
  navigate(location.hash.slice(1) && sectionsById[location.hash.slice(1)] ? location.hash.slice(1) : first, true);
}

function buildNavigation() {
  sideNav.innerHTML = groups.map(group => {
    const validItems = group.items.filter(item => sectionsById[slugify(item)]);
    if (!validItems.length) return "";
    return `<div class="nav-group" data-group="${group.id}"><button class="group-btn" data-group-target="${group.id}"><span class="group-icon">${group.icon}</span><span>${group.label}</span><span class="chevron">⌄</span></button><div class="subnav">${validItems.map(item => `<button class="subnav-btn" data-section="${slugify(item)}">${escapeHtml(item)}</button>`).join("")}</div></div>`;
  }).join("");
  document.querySelectorAll(".group-btn").forEach(btn => btn.addEventListener("click", () => btn.parentElement.classList.toggle("collapsed")));
  document.querySelectorAll(".subnav-btn").forEach(btn => btn.addEventListener("click", () => navigate(btn.dataset.section)));
  mobileNav.innerHTML = groups.flatMap(group => group.items.filter(item => sectionsById[slugify(item)]).map(item => `<option value="${slugify(item)}">${escapeHtml(group.label)} — ${escapeHtml(item)}</option>`)).join("");
}

function navigate(id, replace = false) {
  if (!sectionsById[id]) return;
  const section = sectionsById[id];
  resultContent.innerHTML = `<article class="section-card"><div class="section-kicker">${escapeHtml(groupFor(section.title))}</div><h1>${escapeHtml(section.title)}</h1><p class="section-subtitle">${escapeHtml(subtitles[section.title] || "Your focused interview research.")}</p><div class="section-body">${markdownToHtml(section.content || "")}</div></article>`;
  sectionSubtitle.textContent = subtitles[section.title] || "Your focused interview research.";
  document.querySelectorAll(".subnav-btn").forEach(btn => btn.classList.toggle("active", btn.dataset.section === id));
  document.querySelectorAll(".nav-group").forEach(group => group.classList.toggle("active-group", group.querySelector(`[data-section="${CSS.escape(id)}"]`) !== null));
  if (mobileNav.options.length) mobileNav.value = id;
  if (replace) history.replaceState(null, "", `#${id}`); else if (location.hash !== `#${id}`) history.pushState(null, "", `#${id}`);
  resultContent.querySelectorAll("a").forEach(a => a.setAttribute("target", "_blank"));
  }

function groupFor(title) { const group = groups.find(g => g.items.includes(title)); return group ? group.label : "Interview brief"; }
