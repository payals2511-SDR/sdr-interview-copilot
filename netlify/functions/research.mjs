import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 60000,
  maxRetries: 0
});

const SYSTEM = `
You are SDR Interview Copilot.

Research a company for someone preparing for an SDR/BDR interview.

Use public web information and keep everything concise, practical and easy to understand.

Research these areas:
1. What the company does
2. Company snapshot: HQ/address if public, approximate employee count, business model
3. Products/services
4. Work culture and employee reviews
5. Market, customers and competitors
6. Recent company signals/news
7. What an SDR would likely sell
8. Main customer/business pain points
9. Likely SDR interview questions
10. How to prepare
11. Questions to ask the interviewer
12. A 60-second interview angle
13. Things to verify before the interview

Rules:
- Identify the correct company if only a company name is provided.
- Prefer official company sources and recent credible public sources.
- Do not invent facts, customers, employee reviews, employee counts, addresses, revenue or culture claims.
- If a fact is uncertain, say "Not clearly available publicly."
- If LinkedIn, Glassdoor or another source is inaccessible, say so briefly and use accessible sources.
- Explain things in plain conversational language.
- Focus on information useful to an SDR candidate.
- Keep every section concise: normally 2-5 bullets.
- Do not write long essays.
- Return ONLY valid JSON matching the requested schema.
`;

const schema = {
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
          title: { type: "string" },
          url: { type: "string" }
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
          title: { type: "string" },
          content: { type: "string" },
          wide: { type: "boolean" }
        },
        required: ["title", "content", "wide"]
      }
    }
  },
  required: ["company_name", "sources", "sections"]
};

export default async (req) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  try {
    const body = await req.json();
    const company = String(body?.company || "").trim();

    if (!company) {
      return json(
        { error: "Please enter a company name or website." },
        400
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return json(
        { error: "OpenAI API key is not configured in Netlify." },
        500
      );
    }

    const prompt = `
Research this company for an SDR interview:

${company}

Find the correct company first if this is a company name.

Give me concise, useful information for an SDR candidate.
Prioritize official company information, recent news and credible public sources.
`;

    console.log("Starting research for:", company);

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5.6-luna",

      reasoning: {
        effort: "low"
      },

      tools: [
        {
          type: "web_search",
          search_context_size: "low"
        }
      ],

      max_output_tokens: 3000,

      text: {
        format: {
          type: "json_schema",
          name: "sdr_interview_research",
          strict: true,
          schema
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

    console.log(
      "Research completed. Output tokens:",
      response?.usage?.output_tokens ?? "unknown"
    );

    const text = response.output_text || "";

    if (!text) {
      return json(
        { error: "The AI returned an empty research result. Please try again." },
        502
      );
    }

    let parsed;

    try {
      parsed = JSON.parse(text);
    } catch (parseError) {
      console.error("Invalid JSON returned by OpenAI:", text);

      return json(
        {
          error:
            "The AI returned an unexpected format. Please try again."
        },
        502
      );
    }

    if (!Array.isArray(parsed.sources)) {
      parsed.sources = [];
    }

    if (!Array.isArray(parsed.sections)) {
      parsed.sections = [];
    }

    return json(parsed, 200);

  } catch (err) {
    console.error("Research function failed");
    console.error("Error name:", err?.name);
    console.error("Error message:", err?.message);
    console.error("OpenAI status:", err?.status);
    console.error("OpenAI error code:", err?.code);

    if (err?.status === 429 || err?.code === "rate_limit_exceeded") {
      return json(
        {
          error:
            "OpenAI rate limit reached. Please wait a little before trying again."
        },
        429
      );
    }

    if (err?.status === 401 || err?.code === "invalid_api_key") {
      return json(
        {
          error:
            "OpenAI API key is invalid or not being read by Netlify."
        },
        401
      );
    }

    if (err?.name === "APIConnectionTimeoutError" || err?.code === "ETIMEDOUT") {
      return json(
        {
          error:
            "The research took too long. Please try again."
        },
        504
      );
    }

    return json(
      {
        error:
          err?.message ||
          "AI research failed. Check your OpenAI API key and Netlify configuration."
      },
      500
    );
  }
};

function json(data, statusCode = 200) {
  return new Response(
    JSON.stringify(data),
    {
      status: statusCode,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      }
    }
  );
}
