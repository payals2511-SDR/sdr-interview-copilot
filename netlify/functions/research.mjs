import OpenAI from "openai";

const MODEL = process.env.OPENAI_MODEL || "gpt-5.6-luna";

// Keep this comfortably below the ~30 second timeout you're currently seeing.
const OPENAI_TIMEOUT_MS = 22000;

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: OPENAI_TIMEOUT_MS,
  maxRetries: 0,
});

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    company_name: {
      type: "string"
    },
    sources: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: {
            type: "string"
          },
          url: {
            type: "string"
          }
        },
        required: ["title", "url"]
      }
    },
    sections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: {
            type: "string"
          },
          content: {
            type: "string"
          },
          wide: {
            type: "boolean"
          }
        },
        required: ["title", "content", "wide"]
      }
    }
  },
  required: ["company_name", "sources", "sections"]
};

const SYSTEM = `
You are SDR Interview Copilot.

Your job is to quickly research a company and turn the research into practical preparation for an SDR/BDR job interview.

IMPORTANT:
- Use the web search tool.
- Prefer the company's official website and recent credible public sources.
- Do not invent facts.
- If information cannot be verified, say "Not publicly verified".
- Clearly label estimates.
- If Glassdoor, LinkedIn, Reddit, Google Reviews, or another source is inaccessible, do not pretend you saw it.
- Keep everything simple and conversational.
- This is for an SDR candidate, so focus on what would actually help them in an interview.
- Do not write huge paragraphs.
- Avoid generic corporate jargon.
- Do not repeat the same information across sections.
- Prefer recent information when discussing news, hiring, growth, leadership, products, or market activity.

Research efficiently:
- Do not try to exhaustively search the entire internet.
- Use a small number of high-value searches.
- Prioritize official company information plus a few credible independent sources.
- Look for useful signals rather than collecting dozens of links.

Return exactly these sections:

1. What the company does
Explain the company in very simple language.
Answer:
- What does it sell?
- Who buys it?
- What problem does it solve?
- How does it make money?

2. Company snapshot
Include, where available:
- Headquarters
- Approximate employee count
- Founded/year
- Business model
- Main markets/geographies
- Public/private status
- Anything important an SDR candidate should know

3. Products / services
Explain the main products/services simply.
For each important product, say who would typically buy it.

4. Work culture & employee reviews
Summarize publicly available employee sentiment.
Separate:
- Positive themes
- Negative/mixed themes
- What is actually verified
Do not invent employee-review information.

5. Market, customers & competitors
Explain:
- Target customers
- Main industries
- Market
- Known customers only if publicly verified
- Main competitors
- What differentiates the company

6. Recent signals
Focus on recent:
- Product launches
- Funding
- Partnerships
- Acquisitions
- Leadership changes
- Expansion
- Hiring/growth
- Important company news

7. What an SDR would likely sell
This is especially important.
Explain:
- Likely buyer/persona
- Typical business problem
- Why the buyer might care
- What an SDR would likely prospect about
- Likely AE handoff/discovery topics

8. Main pain points
Give 5-8 realistic buyer pain points based on the company's product and market.
Separate verified company/customer signals from reasonable sales inference.

9. Likely SDR interview questions
Give 8-12 likely questions.
For each:
- Question
- What the interviewer is testing
- Short guidance for answering

10. How to prepare
Give a practical checklist for the candidate:
- Company knowledge
- Product knowledge
- Buyer personas
- SDR metrics
- Cold-call preparation
- Discovery preparation
- Objection handling
- Questions to ask

11. Questions to ask the interviewer
Give 6-8 smart questions an SDR candidate could ask.
Avoid questions that sound generic or copied from the internet.

12. Your 60-second interview angle
Create a natural 60-second explanation covering:
- Why this company
- Why the product/market is interesting
- Why the candidate's SDR background is relevant
Do not invent candidate experience. Keep it adaptable.

13. Things to verify before the interview
List anything important that could not be confidently verified.

CONTENT STYLE:
- Short paragraphs.
- Bullets where useful.
- Plain English.
- Useful for someone preparing 30-60 minutes before an interview.
- No fluff.
`;

/**
 * Main Netlify function.
 *
 * Netlify's current web-function format passes a Request
 * and expects a Response.
 */
export default async (req) => {
  const requestStarted = Date.now();

  console.log("Research function started");

  if (req.method !== "POST") {
    return json(
      {
        error: "Method not allowed. Use POST."
      },
      405
    );
  }

  try {
    // -----------------------------
    // 1. Validate request
    // -----------------------------

    let body;

    try {
      body = await req.json();
    } catch {
      return json(
        {
          error: "Invalid request body."
        },
        400
      );
    }

    const company = String(body?.company || "").trim();

    if (!company) {
      return json(
        {
          error: "Please enter a company name or website."
        },
        400
      );
    }

    // Prevent accidentally sending an enormous prompt.
    const companyInput = company.slice(0, 500);

    console.log("Company:", companyInput);
    console.log("Model:", MODEL);
    console.log("API key configured:", Boolean(process.env.OPENAI_API_KEY));

    // -----------------------------
    // 2. Check API key
    // -----------------------------

    if (!process.env.OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY is missing");

      return json(
        {
          error:
            "OpenAI API key is not configured in Netlify. Check OPENAI_API_KEY in Environment variables."
        },
        500
      );
    }

    // -----------------------------
    // 3. Build focused research prompt
    // -----------------------------

    const prompt = `
Research this company for an SDR interview:

${companyInput}

If the input is a company name:
- First identify the correct company.
- Prefer the company's official website to confirm identity.

If the input is a website:
- Treat that website as the primary company source.

Search the web efficiently and prioritize:
1. Official company website
2. Product/service pages
3. About/company pages
4. Recent company news
5. Credible business/technology publications
6. Public employee-review information where accessible

The final answer should be concise enough to return quickly while still covering all 13 sections.
`;

    console.log("Starting OpenAI request");

    // -----------------------------
    // 4. OpenAI Responses API
    // -----------------------------

    const response = await client.responses.create({
      model: MODEL,

      // Smaller web-search context = faster/cheaper research.
      tools: [
        {
          type: "web_search",
          search_context_size: "low"
        }
      ],

      // Keep the generated answer reasonably compact.
      max_output_tokens: 6500,

      // Structured Outputs prevents the model from breaking
      // the JSON format expected by the frontend.
      text: {
        format: {
          type: "json_schema",
          name: "sdr_interview_research",
          strict: true,
          schema: RESPONSE_SCHEMA
        }
      },

      input: [
        {
          role: "system",
          content: SYSTEM
        },
        {
          role: "user",
          content: prompt
        }
      ]
    });

    const elapsed = Date.now() - requestStarted;

    console.log(`OpenAI request completed in ${elapsed} ms`);

    // -----------------------------
    // 5. Get model output
    // -----------------------------

    const text = String(response.output_text || "").trim();

    if (!text) {
      console.error("OpenAI returned empty output");

      return json(
        {
          error:
            "The AI completed the research but returned an empty result. Please try again."
        },
        502
      );
    }

    // -----------------------------
    // 6. Parse structured JSON
    // -----------------------------

    let parsed;

    try {
      parsed = JSON.parse(text);
    } catch (parseError) {
      console.error("Structured output parsing failed:", parseError);
      console.error("Raw AI output:", text.slice(0, 2000));

      return json(
        {
          error:
            "The AI returned an unexpected format. Please try the research again."
        },
        502
      );
    }

    // -----------------------------
    // 7. Basic safety checks
    // -----------------------------

    if (!parsed.company_name) {
      parsed.company_name = companyInput;
    }

    if (!Array.isArray(parsed.sources)) {
      parsed.sources = [];
    }

    if (!Array.isArray(parsed.sections)) {
      parsed.sections = [];
    }

    console.log(
      `Research completed successfully in ${Date.now() - requestStarted} ms`
    );

    return json(parsed, 200);

  } catch (err) {
    const elapsed = Date.now() - requestStarted;

    console.error(`Research function failed after ${elapsed} ms`);
    console.error("Error name:", err?.name);
    console.error("Error message:", err?.message);

    if (err?.status) {
      console.error("OpenAI status:", err.status);
    }

    if (err?.code) {
      console.error("OpenAI error code:", err.code);
    }

    // -----------------------------
    // Timeout-specific message
    // -----------------------------

    const message = String(err?.message || "");

    if (
      err?.name === "APIConnectionTimeoutError" ||
      message.toLowerCase().includes("timeout") ||
      message.toLowerCase().includes("timed out")
    ) {
      return json(
        {
          error:
            "The research took too long. Please try again. The search has been intentionally limited to keep the app fast."
        },
        504
      );
    }

    // -----------------------------
    // Authentication
    // -----------------------------

    if (err?.status === 401) {
      return json(
        {
          error:
            "OpenAI rejected the API key. Check OPENAI_API_KEY in Netlify Environment variables."
        },
        502
      );
    }

    // -----------------------------
    // Rate limit / billing
    // -----------------------------

    if (err?.status === 429) {
      return json(
        {
          error:
            "OpenAI rate limit or billing limit reached. Check your OpenAI API usage/billing."
        },
        429
      );
    }

    // -----------------------------
    // Model error
    // -----------------------------

    if (err?.status === 400 && message.toLowerCase().includes("model")) {
      return json(
        {
          error:
            `The OpenAI model "${MODEL}" was rejected. Check OPENAI_MODEL in Netlify or remove that variable to use the default model.`
        },
        502
      );
    }

    // -----------------------------
    // Generic error
    // -----------------------------

    return json(
      {
        error:
          message ||
          "AI research failed. Check the Netlify function logs."
      },
      500
    );
  }
};


/**
 * Return a JSON Response.
 */
function json(data, statusCode = 200) {
  return new Response(
    JSON.stringify(data),
    {
      status: statusCode,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      }
    }
  );
}
