# Private GeoHub advisor prototype

Run `npm run dev:advisor`, then open `http://127.0.0.1:5174/advisor`.
The desktop Codex CLI must already be signed in with ChatGPT. This uses the
owner's existing subscription allowance. No API key or paid-provider fallback
is configured; no token is extracted or sent to the browser. Each submitted
message uses allowance, shared with the owner's other Codex work.

This is a personal local test, not the public site's AI service. Both the route
and server middleware are enabled only for the advisor development mode; the
page is absent from production builds. The middleware rejects remote clients,
non-local Host headers, cross-origin requests and simple cross-site POSTs.
Do not expose the dev server or CLI through a public tunnel. Commercial/hosted
ChatGPT plan usage requires a supported integration:
https://learn.chatgpt.com/docs/app-server#auth-endpoints
https://developers.openai.com/siwc/token-sharing-open-source

The read-only data adapter uses anonymous Firestore REST requests. It never uses
admin credentials, reads private chat/profile/check-in data or writes documents.
The private server also reads the published, attributed Tbilisi OSM search
snapshot from `web/public/place-data` (43,577 places as of 17 October 2026).
It combines this with up to 250 native places, 120 public business pages and
200 published items / 200 unexpired offers. Commerce records require a known
public merchant, valid typed data and genuine, available items. Unavailable
sources are reported in coverage; this is not an exhaustive live inventory.
No customer preferences or private account information is read.

Coverage is deliberately bounded and is displayed as partial. Missing prices,
hours and other facts must stay unknown. Model result cards are resolved only
against the retrieved records. Public descriptions remain untrusted data.
The prompt distinguishes merchant-reported minor-unit prices, dietary tags,
preparation times, offer dates and branch scope from verified current stock.
Offers are rechecked for expiry on each question even while the source snapshot
is cached. No branch inherits headquarters coordinates. OSM building centers
are explicitly approximate, and route durations / parking availability are not
inferred. Unknown menu prices remain unknown.

Conversations exist only in the page's memory and the current request. CLI
sessions are ephemeral, with tools, plugins and user/project configuration
disabled, and run in an otherwise empty temporary directory. Raw process logs
are not returned to browsers. There is one active generation at a time and a
30-request limit for each dev-server session. Stop cancels the request and its
child process. Restarting the dev server resets the test counter; it does not
reset the ChatGPT subscription allowance.

Tests: `npm run test:advisor`, `npm run lint`, `npm run i18n:check`.
The provider runner is separate from retrieval and UI so the later public
version can use an appropriate hosted/free-tier provider without sharing the
owner's subscription login. Running an open-weight model independently would
require an inference-capable host, whose availability and speed depend on its
resources and plan; a static Pages deployment alone does not run such a model.
