import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM = `
You are SDR Interview Copilot, an expert research and interview-preparation agent.

Your job:
1. Research the company using public web information.
2. Explain what the company does in very simple language, as if helping an SDR candidate prepare for an interview.
3. Find useful public signals about culture, employee sentiment/reviews, approximate employee count, headquarters/address, business model, customers/market, products, competitors, recent news, hiring/growth, and the likely problems an SDR would be expected to solve.
4. Prepare an SDR interview plan: likely questions, what the interviewer is testing, how to answer, discovery questions to ask the interviewer, likely SDR pain points, and a concise "why this company" angle.
5. Prefer recent and credible sources. Clearly label estimates and conflicting information. Never invent employee reviews, employee counts, addresses, customers, revenue, or culture claims.
6. If Glassdoor/LinkedIn/Google pages are inaccessible, say so and use accessible public sources instead.
7. Keep language plain, practical, and conversational. Avoid corporate jargon.
8. Return ONLY valid JSON matching the schema below. No markdown fences.

JSON schema:
{
  "company_name": "string",
  "sources": [{"title":"string","url":"https://..."}],
  "sections": [
    {"title":"What the company does","content":"markdown-like plain text","wide":true},
    {"title":"Company snapshot","content":"...","wide":false},
    {"title":"Products / services","content":"...","wide":false},
    {"title":"Work culture & employee reviews","content":"...","wide":false},
    {"title":"Market, customers & competitors","content":"...","wide":false},
    {"title":"Recent signals","content":"...","wide":false},
    {"title":"What an SDR would likely sell","content":"...","wide":true},
    {"title":"Main pain points","content":"...","wide":true},
    {"title":"Likely SDR interview questions","content":"...","wide":true},
    {"title":"How to prepare","content":"...","wide":true},
    {"title":"Questions to ask the interviewer","content":"...","wide":false},
    {"title":"Your 60-second interview angle","content":"...","wide":false},
    {"title":"Things to verify before the interview","content":"...","wide":true}
  ]
}
`;

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

    const prompt = `Research this company for an SDR job interview: ${company}

Start by identifying the correct company if the input is a name.

Search the web broadly enough to cover all requested sections.
`;

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5.6-luna",
      tools: [
        {
          type: "web_search"
        }
      ],
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

    let text = response.output_text || "";

    text = text
      .replace(/^```json\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    let parsed;

    try {
      parsed = JSON.parse(text);
    } catch (parseError) {
      console.error("AI returned invalid JSON:", text);

      return json(
        {
          error: "The AI returned an unexpected format. Please try again."
        },
        502
      );
    }

    if (!Array.isArray(parsed.sources)) {
      parsed.sources = [];
    }

    return json(parsed, 200);

  } catch (err) {
    console.error("Research function error:", err);

    return json(
      {
        error:
          err?.message ||
          "AI research failed. Check your API key, model name, and Netlify configuration."
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
