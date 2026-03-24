# Ranklore deployment: Postgres + Render + Vercel + Clerk Auth

## Postgres (database)

You need:

- **DATABASE_URL** – Postgres connection string (backend uses this).

**Production tip:** On Render, use the **Connection pooling** URI from Supabase (port **6543**) to avoid connection limits:

1. Supabase Dashboard → **Settings** → **Database**.
2. Under **Connection string**, choose **URI**.
3. Select **Connection pooling** (Session or Transaction mode).
4. Copy the URI (host like `aws-0-<region>.pooler.supabase.com`, port **6543**).
5. Set that as **DATABASE_URL** in Render (replace your current direct URL if you see connection errors).

Your app creates tables automatically on first run via `db.create_all()` when **DATABASE_URL** is set.

---

## Render (backend)

- **Root Directory:** `backend`
- **Build Command:** `pip install -r requirements.txt`
- **Start Command:** `gunicorn app:app --bind 0.0.0.0:$PORT`

**Environment variables** – set in Render dashboard (use the same values as in your local `.env`):

| Key | Required | Notes |
|-----|----------|--------|
| `DATABASE_URL` | Yes | Supabase Postgres URI (pooler port 6543 recommended) |
| `CORS_ORIGINS` | Yes (production) | Your Vercel URL, e.g. `https://ranklore-xxx.vercel.app` (comma-separated if multiple) |
| `FLASK_DEBUG` | No | Set to `false` |
| `CLERK_JWKS_URL` | Yes | Clerk JWKS URL, e.g. `https://<your-clerk-domain>/.well-known/jwks.json` |
| `CLERK_JWT_ISSUER` | No | Optional strict issuer check (from Clerk JWT template issuer) |
| `OPENAI_API_KEY` | Yes | For ChatGPT engine |
| `DEEPSEEK_API_KEY` | Yes | For DeepSeek engine |
| `PERPLEXITY_API_KEY` | Yes | For Perplexity engine |
| `CLAUDE_API_KEY` | Yes | For Claude engine |
| `GEMINI_API_KEY` | No | If you use Gemini |
| `RANKLORE_ENGINE_ORDER` | No | e.g. `chatgpt,deepseek,perplexity,claude` |
| `MAX_CONCURRENT_JOBS_PER_USER` | No | Defaults to `2` to avoid overload |

After deploy, test: `https://<your-render-service>.onrender.com/api/health`

---

## Vercel (frontend)

- **Root Directory:** `frontend`
- **Build Command:** `npm run build`
- **Output Directory:** `dist`

**Environment variables:**

| Key | Value |
|-----|--------|
| `VITE_API_BASE_URL` | `https://<your-render-service>.onrender.com/api` (no trailing slash) |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk publishable key from Clerk Dashboard API Keys |

---

## Checklist

- [ ] Supabase project created; **DATABASE_URL** (and optionally pooler URI for Render) ready.
- [ ] Render Web Service created; **Root Directory** = `backend`; all env vars set (including **CORS_ORIGINS** = your Vercel URL).
- [ ] Vercel project created; **Root Directory** = `frontend`; **VITE_API_BASE_URL** = your Render API base URL.
- [ ] `.env` is not committed (it is in `.gitignore`); use Render/Vercel dashboards for production secrets.

---

## Authentication (Clerk)

- Set `VITE_CLERK_PUBLISHABLE_KEY` in frontend env.
- Set `CLERK_JWKS_URL` in backend env.
- Optional: set `CLERK_JWT_ISSUER` for strict issuer validation.
- **Limits:** Each account is limited to **3 projects** and **10 prompts per project**. The UI shows these limits and disables create when reached.
