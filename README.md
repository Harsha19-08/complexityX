# ComplexityX

Paste a DSA solution (Java, C++, Python, JavaScript) and get time and space complexity, the reasoning, code hotspots, a growth chart, DSA patterns, alternative approaches, optimized code and a before/after comparison. Learning mode gives hints first and hides the answer until you ask.

Analysis is static and theoretical. Nothing is executed or benchmarked.

## Run it

```bash
npm install
cp .env.example .env.local   # optional
npm run dev                  # http://localhost:3000
```

With no configuration the app uses a built-in offline rule-based engine. Four built-in examples return reviewed, hand-written analyses instantly.

## AI provider (optional)

Set these in `.env.local`. Any OpenAI-compatible `/chat/completions` endpoint works.

| Variable | Purpose |
| --- | --- |
| `AI_PROVIDER` | `openrouter`, `groq`, `gemini`, `together`, `ollama` or `custom` |
| `AI_API_KEY` | Provider key (not needed for `ollama`) |
| `AI_MODEL` / `AI_BASE_URL` | Override the preset defaults; required for `custom` |
| `AI_JSON_MODE` | `false` if the model rejects `response_format` |
| `AI_TIMEOUT_MS`, `AI_TEMPERATURE` | Request tuning |
| `ALLOW_CLIENT_KEYS` | Let visitors paste their own key in Settings (kept in their browser) |
| `RATE_LIMIT_PER_MINUTE` | Per-IP limit on `/api/analyze` (default 20) |

OpenRouter, Groq and Gemini all have free tiers. If the provider fails, the UI offers to fall back to the offline engine.

## Layout

- `lib/` complexity math, schema validation, provider abstraction, prompts, offline engine, curated examples, pattern library
- `app/api/analyze` the single API route
- `components/` editor, results sections, dialogs
- `scripts/test-engine.ts` engine checks: `npx tsx scripts/test-engine.ts`

## Deploy

Works on Vercel or any Node host: set the env vars, run `npm run build && npm start`. History and settings live in the browser's localStorage.
