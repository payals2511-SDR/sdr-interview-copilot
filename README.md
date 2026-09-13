# SDR Interview Copilot

A simple AI-powered web app for SDR candidates. Enter a company name or URL and the app researches public web information and produces a plain-English interview brief.

## What it does

- Company overview in simple language
- Company snapshot and approximate employee count
- Address / headquarters when publicly available
- Products and services
- Culture and public employee-review signals
- Market, customers and competitors
- Recent company signals
- Likely SDR selling motion and pain points
- Likely SDR interview questions
- Preparation guidance
- Questions to ask the interviewer
- 60-second interview angle
- Sources to verify

## Architecture

- `index.html` — page structure
- `styles.css` — production-ready CSS
- `styles.scss` — SCSS source for future customization
- `app.js` — browser UI and API call
- `netlify/functions/research.mjs` — secure server-side AI endpoint
- `netlify.toml` — Netlify configuration

The OpenAI API key is NOT placed in the browser. It is read server-side from the `OPENAI_API_KEY` environment variable.

## Deploy on Netlify (recommended)

1. Create an OpenAI API key in your OpenAI API dashboard.
2. Create a GitHub repository and upload all files in this folder.
3. Go to Netlify and choose **Add new site → Import an existing project**.
4. Connect GitHub and select the repository.
5. Build command: leave blank.
6. Publish directory: `.`
7. Deploy.
8. In Netlify, open **Site configuration → Environment variables**.
9. Add:
   - `OPENAI_API_KEY` = your OpenAI API key
   - optional `OPENAI_MODEL` = `gpt-5.6`
10. Trigger a new deploy after adding/updating the environment variable.

Your site will have a Netlify URL that you can share.

## Important security rule

Never put your OpenAI API key inside `app.js`, `index.html`, or any public GitHub file. Anyone could copy it and spend your API credits.

## GitHub Pages note

The HTML/CSS/JS front end can be hosted on GitHub Pages, but the AI endpoint cannot safely live there because GitHub Pages is static hosting. Use a serverless backend such as the included Netlify Function, or another server-side host.

## Production upgrades

For a stronger V2, add:
- Persistent user profiles
- Resume upload and resume-to-job matching
- LinkedIn / Glassdoor / Google review connectors where legally and technically permitted
- Company-specific SDR role extraction from the job description
- Interview question scoring
- Mock interview mode
- Saved research reports
- Citation display for every factual claim
- Rate limiting and abuse protection
- Usage/cost monitoring
