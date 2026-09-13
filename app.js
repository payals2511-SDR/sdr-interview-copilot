const form = document.getElementById("researchForm");
const input = document.getElementById("companyInput");
const button = document.getElementById("researchBtn");
const loading = document.getElementById("loading");
const errorBox = document.getElementById("error");
const errorText = document.getElementById("errorText");
const results = document.getElementById("results");
const resultGrid = document.getElementById("resultGrid");
const companyTitle = document.getElementById("companyTitle");
const sourceLinks = document.getElementById("sourceLinks");
const newResearch = document.getElementById("newResearch");

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
  } finally {
    button.disabled = false;
  }
});

newResearch.addEventListener("click", () => {
  results.classList.add("hidden");
  input.focus();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

function setState(state) {
  loading.classList.toggle("hidden", state !== "loading");
  errorBox.classList.toggle("hidden", state !== "error");
  results.classList.toggle("hidden", state !== "results");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function inlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

function markdownToHtml(md) {
  if (!md) return "";
  const lines = md.replace(/\r/g, "").split("\n");
  let html = "", inUl = false, inOl = false;

  const closeLists = () => {
    if (inUl) { html += "</ul>"; inUl = false; }
    if (inOl) { html += "</ol>"; inOl = false; }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { closeLists(); continue; }

    if (/^###\s+/.test(line)) {
      closeLists(); html += `<h4>${inlineMarkdown(line.replace(/^###\s+/, ""))}</h4>`; continue;
    }
    if (/^##\s+/.test(line)) {
      closeLists(); html += `<h3>${inlineMarkdown(line.replace(/^##\s+/, ""))}</h3>`; continue;
    }
    if (/^#\s+/.test(line)) {
      closeLists(); html += `<h3>${inlineMarkdown(line.replace(/^#\s+/, ""))}</h3>`; continue;
    }
    if (/^[-*]\s+/.test(line)) {
      if (!inUl) { closeLists(); html += "<ul>"; inUl = true; }
      html += `<li>${inlineMarkdown(line.replace(/^[-*]\s+/, ""))}</li>`; continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      if (!inOl) { closeLists(); html += "<ol>"; inOl = true; }
      html += `<li>${inlineMarkdown(line.replace(/^\d+\.\s+/, ""))}</li>`; continue;
    }
    if (/^>\s+/.test(line)) {
      closeLists(); html += `<div class="quote">${inlineMarkdown(line.replace(/^>\s+/, ""))}</div>`; continue;
    }
    html += `<p>${inlineMarkdown(line)}</p>`;
  }
  closeLists();
  return html;
}

function renderResults(data) {
  companyTitle.textContent = data.company_name || "Company research";
  sourceLinks.innerHTML = (data.sources || []).map(s =>
    `<a href="${escapeHtml(s.url)}" target="_blank" rel="noopener">${escapeHtml(s.title || s.url)}</a>`
  ).join("");

  const sections = data.sections || [];
  resultGrid.innerHTML = sections.map((section, i) => `
    <article class="result-card ${section.wide ? "wide" : ""}">
      <h3>${escapeHtml(section.title || `Section ${i + 1}`)}</h3>
      ${markdownToHtml(section.content || "")}
    </article>
  `).join("");
}