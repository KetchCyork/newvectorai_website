# New Vector AI website

Public website for [www.newvectorai.net](https://www.newvectorai.net), hosted on GitHub Pages. Cloudflare provides DNS/proxy services and the separate waitlist/admin backend. No OpenAI hosting or ChatGPT authentication is required.

## Pages

Home, About us, Kolloq, Emerra, SecureWhisper, Readme, Privacy, launch waitlist, and a protected owner admin panel. All products remain pre-launch. The founder story is based on Chris York's LinkedIn profile supplied for this project.

## Local development

Requires Node.js 22.13+ (local SQLite adapter; tested on Node 26) and npm.

```sh
npm ci
npm run admin:setup
npm run dev
```

Open http://localhost:4173. The local server uses a separate SQLite database and the same password/session checks as production. Localhost browsers permit the secure admin cookie. Owner credentials are written to `.local/admin-access.txt`; deployment secrets are in `.local/cloudflare-secrets.json`. Both are ignored by Git with restrictive file permissions. Store the password in your password manager.

```sh
npm test
npm run deploy:check
```

## GitHub Pages deployment

The `Publish website to GitHub Pages` workflow publishes `public/` on pushes to `main`. The repository Pages source is GitHub Actions, with custom domain `www.newvectorai.net`. Cloudflare CNAME records point to `ketchcyork.github.io`. Only `/api/*` and `/admin*` are routed to the Worker. Public pages and assets are served by GitHub Pages.

## Backend deployment

`wrangler.jsonc` binds the existing `newvectorai-website` D1 database and both `newvectorai.net` and `www.newvectorai.net`. The Worker redirects apex backend requests to www and HTTP to HTTPS. Admin requests pass through the Worker so direct admin HTML paths receive the same authentication checks.

```sh
npx wrangler login
npm run db:migrate
npm run build
npx wrangler deploy --secrets-file .local/cloudflare-secrets.json
```

For later code-only deployments, `npm run deploy` preserves existing Worker secrets. Public website changes deploy automatically from main through GitHub Actions. Wrangler deploys backend changes only.

Production resources are managed in the site owner's Cloudflare account. Do not recreate or change the database ID when deploying updates. Use additive SQL migrations generated from `db/schema.ts` with `npm run db:generate`, then apply with `npm run db:migrate`.

## Owner access and email

Open `/admin/` and sign in with the generated admin password. The one-hour session uses an HttpOnly, Secure, SameSite=Strict cookie. Password verification uses salted PBKDF2; sessions are signed; login attempts and waitlist submissions have separate rate limits. Cross-origin writes are rejected.

The admin panel supports:

- Setting the notification recipient email.
- Connecting a verified Resend sender and a send-only API key.
- Viewing paginated signups and exporting up to 10,000 records to CSV.

Waitlist entries save even before email is connected. Email settings apply to future signups. Connecting a recipient alone does not enable delivery: a verified sender and Resend API key are also required. API keys are encrypted with AES-GCM before storage and never returned to the browser. The form does not automatically subscribe users to an external mailing platform.

## Secrets and recovery

Never commit `.local/`, `.dev.vars`, or real credentials. Production secrets are `ADMIN_PASSWORD_HASH`, `ADMIN_PASSWORD_SALT`, `SESSION_SECRET`, and `SETTINGS_KEY`.

To rotate the admin password, generate a new salt and PBKDF2 hash using `passwordHash` from `server/auth.js`, update the two password secrets, and rotate `SESSION_SECRET` to invalidate existing sessions. Keep `SETTINGS_KEY` unchanged after saving email settings, or stored API keys cannot be decrypted. Back up deployment secrets securely. The setup script deliberately refuses to overwrite an existing secrets file.

## Data and privacy

Signups contain email, selected interest, signup time, and notification status. Rate-limit buckets contain hashed hourly identifiers and expire after an hour; expired rows are purged on subsequent submissions. GitHub Pages hosts the public website. Cloudflare handles the backend and database storage. Resend processes notifications only when configured. Google Fonts are loaded externally. No advertising or analytics scripts are included.

The published privacy page covers this website and waitlist. Each pre-launch product will need its own policy for the behavior of the released product. To fulfill a verified deletion request, the owner can delete the matching signup through Cloudflare D1. Back up production data before schema changes.

## Source

[GitHub repository](https://github.com/KetchCyork/newvectorai_website)
