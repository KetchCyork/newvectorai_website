# New Vector AI

A dark, responsive brand website with a Kolloq product page, education section, product previews, privacy policy, Readme page, social links, and an owner-only waitlist admin panel.

## Local development

Requires Node.js 24 or newer (uses built-in SQLite for local development).

```sh
npm ci
npm run build
npm run dev
```

Open http://localhost:4173. The local server binds only to loopback, uses a separate SQLite database in ignored `.local/`, and identifies the local preview user as the administrator. This development identity override is **not** included in the deployed Worker. Rebuild and restart the preview after edits.

## Routes

- `/`: brand homepage, products, education, and launch waitlist
- `/kolloq/`: dedicated Kolloq product page
- `/emerra/`: planned research, preparation, and recovery experience based on the owner-provided functional specification
- `/readme`: visitor guide
- `/privacy`: website privacy policy
- `/admin`: owner-only settings, saved signups, and CSV export

## Production

The server targets Cloudflare Workers through OpenAI Sites, with a logical D1 `DB` binding. `npm run build` bundles public assets into `dist/server/index.js`, with hosting metadata and generated Drizzle migrations. The source of truth is `public/`, `server/`, and `db/schema.ts`.

Configure runtime secrets through the hosting platform:

- `ADMIN_EMAIL`: owner email checked against the platform-authenticated identity on every admin request
- `SETTINGS_KEY`: a stable base64-encoded 32-byte AES-GCM key for encrypted email-service credentials

Never change the encryption key without migrating stored credentials. Never host this Worker behind a proxy that permits visitors to forge `oai-authenticated-user-*` headers. Sites supplies and controls these identity headers.

The initial publication is owner-private. Changing the site's audience is a separate owner action. The admin route remains restricted by server-side email authorization.

## Email setup

Signups are saved without an email provider. In `/admin`, set the destination email address. To enable notifications, expand **Connect email delivery**, enter a sender address from a Resend-verified domain, and save a send-only Resend API key. API keys are encrypted before storage and are never returned to the browser.

Only future signups trigger notifications. Delivery failure does not discard a signup. The admin table reports notification status; `Accepted` means the email provider accepted the message, not that it reached the inbox. Existing records can be exported, up to 10,000 at a time. Outbound delivery requires the owner's provider configuration and has not been tested with a real account.

## Validation

```sh
npm test
```

Tests cover persistent signups, duplicate handling, consent validation, origin checks, owner-only access, encryption, CSV formula neutralization, and rate limiting. Local SQLite tests exercise the Worker logic; deployment also applies the generated schema to D1.

## Content sources and status

Product descriptions were grounded in the owner-provided repository READMEs and the owner's confirmation that all three products are pre-launch. Company-specific SecureWhisper pilot details are intentionally excluded. Product features may change before launch.

The website privacy policy covers the website and waitlist only. Separate product policies are needed before product release. Waitlist removal requests are directed to the brand's LinkedIn page until a dedicated privacy address is supplied.
