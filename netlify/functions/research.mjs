const TAVILY_URL = "https://api.tavily.com/search";

const SEARCHES = [
  {
    key: "overview",
    title: "What the company does",
    query: (c) => `${c} company what does it do products business model`,
    wide: true,
  },
  {
    key: "snapshot",
    title: "Company snapshot",
    query: (c) => `${c} headquarters address founded employee count company size`,
    wide: false,
  },
  {
    key: "products",
    title: "Products / services",
    query: (c) => `${c} products services platform features customers`,
    wide: false,
  },
  {
    key: "culture",
    title: "Work culture & employee reviews",
    query: (c) => `${c} employee reviews culture Glassdoor Indeed AmbitionBox workplace`,
    wide: false,
  },
  {
    key: "market",
    title: "Market, customers & competitors",
    query: (c) => `${c} customers market competitors alternatives industry`,
    wide: false,
  },
  {
    key: "recent",
    title: "Recent signals",
    query: (c) => `${c} latest news funding growth partnerships hiring 2026`,
    wide: false,
  },
  {
    key: "sales",
    title: "What an SDR would likely sell",
    query: (c) => `${c} sales SDR BDR account executive target customers buyer personas use cases`,
    wide: true,
  },
  {
    key: "pain",
    title: "Main pain points",
    query: (c) => `${c} customer pain points problems solved why customers buy`,
    wide: true,
  },
];

export default async (req) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  try {
    if (!process.env.TAVILY_API_KEY) {
      return json({
        error: "Tavily API key is not configured in Netlify. Add TAVILY_API_KEY under Environment variables and redeploy."
      }, 500);
    }

    const body = await req.json();
    const company = String(body?.company || "").trim();

    if (!company) {
      return json({ error: "Please enter a company name or website." }, 400);
    }

    console.log(`Starting Tavily research for: ${company}`);

    // Run searches in parallel so the app stays fast.
    const results = await Promise.all(
      SEARCHES.map((search) => runSearch(search.query(company)))
    );

    const sections = SEARCHES.map((search, index) => {
      const data = results[index];
      return {
        title: search.title,
        content: formatSearchResult(data),
        wide: search.wide,
      };
    });

    // These are useful interview-prep sections that don't require another AI call.
    sections.push({
      title: "Likely SDR interview questions",
      wide: true,
      content: buildInterviewQuestions(company, results),
    });

    sections.push({
      title: "How to prepare",
      wide: true,
      content: buildPreparation(company),
    });

    sections.push({
      title: "Questions to ask the interviewer",
      wide: false,
      content: buildQuestionsToAsk(),
    });

    sections.push({
      title: "Your 60-second interview angle",
      wide: false,
      content: buildInterviewAngle(company, results),
    });

    sections.push({
      title: "Things to verify before the interview",
      wide: true,
      content: buildVerificationChecklist(),
    });

    const sources = collectSources(results);

    return json({
      company_name: cleanCompanyName(company),
      sources,
      sections,
      search_engine: "Tavily",
      note: "Research is based on publicly available web search results. Verify important facts with the original source before using them in an interview."
    });
  } catch (error) {
    console.error("Tavily research failed:", error);
    return json({
      error: error?.message || "Web research failed. Check the Tavily API key and try again."
    }, 500);
  }
};

async function runSearch(query) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(TAVILY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
      },
      body: JSON.stringify({
        query,
        search_depth: "basic",
        topic: "general",
        max_results: 4,
        include_answer: "basic",
        include_raw_content: false,
        include_images: false,
      }),
      signal: controller.signal,
    });

    const text = await response.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Tavily returned an invalid response (${response.status}).`);
    }

    if (!response.ok) {
      const message = data?.detail || data?.message || `Tavily request failed (${response.status}).`;
      throw new Error(message);
    }

    return data;
  } finally {
    clearTimeout(timer);
  }
}

function formatSearchResult(data) {
  if (!data) return "No information was returned for this section.";

  const parts = [];

  if (data.answer) {
    parts.push(data.answer.trim());
  }

  const results = Array.isArray(data.results) ? data.results : [];

  if (results.length) {
    parts.push("\n**Useful sources found:**");
    for (const result of results.slice(0, 4)) {
      const title = result.title || result.url || "Source";
      const content = (result.content || "").trim();
      parts.push(`- **${title}**${content ? ` — ${content}` : ""}`);
    }
  }

  return parts.join("\n\n") || "No useful public information was returned for this section.";
}

function collectSources(allResults) {
  const seen = new Set();
  const sources = [];

  for (const data of allResults) {
    for (const result of data?.results || []) {
      if (!result?.url || seen.has(result.url)) continue;
      seen.add(result.url);
      sources.push({
        title: result.title || result.url,
        url: result.url,
      });
      if (sources.length >= 30) return sources;
    }
  }

  return sources;
}

function buildInterviewQuestions(company, results) {
  const sales = results[6]?.answer || "the company's product, target buyers and sales motion";
  return [
    `1. What do you understand about ${company} and the problem it solves?`,
    `2. Who do you think the ideal customer is, and why would they care about this product?`,
    `3. Based on your research, who would you prospect first and what would you say to them?`,
    `4. How would you research an account before making a cold call?`,
    `5. Give me a cold-call opener for a relevant prospect at ${company}.`,
    `6. How would you handle “send me an email” or “we already have a solution”?`,
    `7. How do you qualify whether a meeting is worth passing to an AE?`,
    `8. What would you do if your activity is high but meetings are low?`,
    `9. What would you do if you missed your monthly target?`,
    `10. Why ${company}, and why this SDR role?`,
    `\n**Research clue:** ${sales.slice(0, 700)}`,
  ].join("\n");
}

function buildPreparation(company) {
  return [
    `- Learn the **one-sentence explanation** of ${company}: what it sells, who buys it and what problem it solves.`,
    `- Pick **2–3 buyer personas** and understand the pain each one feels.`,
    `- Know **2 competitors or alternatives** and one reason a buyer might choose ${company}.`,
    `- Prepare one **30-second cold-call opener** using a real problem rather than a product pitch.`,
    `- Prepare examples for **target achievement, prospecting, objection handling, qualification and pipeline management**.`,
    `- Be ready to explain why your previous experience makes you relevant to this company's sales motion.`,
    `- Verify important company facts from the original sources before quoting numbers in the interview.`,
  ].join("\n");
}

function buildQuestionsToAsk() {
  return [
    `- What does a strong SDR achieve in the first 90 days?`,
    `- Which personas and segments are the biggest priority for the team right now?`,
    `- Where do most qualified opportunities currently come from?`,
    `- What are the biggest reasons prospects say no?`,
    `- How do SDRs and AEs work together after a meeting is booked?`,
    `- What separates your top SDRs from the rest of the team?`,
  ].join("\n");
}

function buildInterviewAngle(company, results) {
  const overview = results[0]?.answer || "the company's product and customer problem";
  const sales = results[6]?.answer || "the company's target customers";

  return [
    `**Why ${company}:**`,
    `“From my research, ${company} is focused on ${shorten(overview, 280)}. What interests me is that the SDR role is not just about activity — it is about finding the right accounts, understanding the buyer's problem and creating a relevant conversation.”`,
    `\n**What I would emphasize:** consultative selling, account research, relevant outreach, discovery, qualification and clean AE handoffs.`,
    `\n**Sales clue:** ${shorten(sales, 400)}`,
  ].join("\n");
}

function buildVerificationChecklist() {
  return [
    `- Exact employee count`,
    `- Current headquarters / office locations`,
    `- Current leadership`,
    `- Latest funding / revenue claims`,
    `- Current SDR/BDR openings and territory`,
    `- Exact target market and buyer personas`,
    `- Compensation and quota`,
    `- Working hours / territory coverage`,
    `- Whether the role is inbound, outbound or mixed`,
    `- Whether Glassdoor/employee-review information is current enough to rely on`,
  ].join("\n");
}

function shorten(value, max) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}…`;
}

function cleanCompanyName(value) {
  return String(value)
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/$/, "")
    .trim();
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
