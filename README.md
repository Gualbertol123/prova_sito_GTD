# TEAM GTD FINALE — realtime collaborative board

A full rebuild of the original single-file GTD + Kanban artifact as a modern
**React app with real-time multi-user collaboration**, hosted entirely on
**Azure**. Multiple people can view and edit the same board at the same time;
every change is persisted server-side and pushed live to everyone connected.

**Nothing is stored or cached in the browser** — no `localStorage`,
`sessionStorage`, IndexedDB or offline cache. The board always reflects the
authoritative server state. All usage is remote.

The look (navy `#0A1931`, gold `#C9A96E`, cream backgrounds) and fonts
(**Cinzel** display + **Inter** body) are carried over from the original.

---

## What's in the app

| Tab | What it does |
| --- | --- |
| **BOARD** | Kanban with 6 columns — Backlog · Next · In Progress · Waiting · Done · Maybe. Drag cards between columns, quick-add, per-column add, team members bar, priority distribution chart. |
| **WEEKLY** | Weekly review: auto "Fatto questa settimana" (from DONE) plus 5 retro columns — WINS · LEARNINGS · TO IMPROVE · BLOCKERS · FOCUS NEXT WEEK. |
| **CALENDARIO** | Month calendar; drag a task onto a date to set its due date. Unscheduled tasks listed alongside. |
| **TRACKING 🔒** | Password-gated (`Matusalemme`) team-load monitor: active tasks, P1 count and Ok / Carico alto / Sovraccarico status per member. |
| **ISTRUZIONI** | Reference for statuses, priorities and workflow. |

Task fields: title, description, owner, priority (P1–P4), status, notes,
subtasks (with progress), due date, waiting-since. Plus a **Mail update**
generator (DONE + FOCUS → clipboard / mail client).

---

## Architecture

```
Browser (React SPA, in-memory only)
    │  fetch /api/board (GET)           ← initial + resync
    │  fetch /api/board (POST op)       ← every edit
    │  WebSocket via Azure Web PubSub   ← live board broadcasts
    ▼
Azure Static Web Apps  ──  managed Azure Functions (/api)
                                  │
             ┌────────────────────┴────────────────────┐
             ▼                                          ▼
     Azure Cosmos DB (serverless)            Azure Web PubSub
     single "board" document,                fan-out of new board
     optimistic-concurrency writes           state to all clients
```

- **Single source of truth:** one `board` document in Cosmos DB.
- **Operation-based edits:** the client sends small operations (`moveTask`,
  `updateTask`, `weeklyAdd`, …). The server applies each op against the
  *current* document with **ETag optimistic-concurrency retries**, so two
  people editing different things at the same time merge cleanly instead of
  overwriting each other.
- **Live sync:** after every successful write the server broadcasts the new
  board to all clients over **Azure Web PubSub**. Clients also re-sync on
  reconnect, so nothing is missed if a socket drops.
- **Optimistic UI:** edits apply locally instantly, then reconcile with the
  authoritative server response.

### Repo layout

```
web/            React + Vite + TypeScript + Tailwind frontend
  src/lib/      types, constants, dates, realtime client, board reducer, hooks
  src/components/  board, calendar, weekly, tracking, instructions, modals
api/            Azure Functions (Node) — negotiate + board endpoints
  src/shared/   cosmos, web pubsub, reducer (authoritative), seed data
infra/          Bicep template provisioning all Azure resources
legacy/         the original artifact, kept for reference
staticwebapp.config.json   SWA routing + no-store headers
.github/workflows/         CI/CD to Azure Static Web Apps
```

---

## Deploy to Azure

You need the [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli)
and an Azure subscription.

### 1. Provision infrastructure (Cosmos DB + Web PubSub + Static Web App)

```bash
az login
az group create -n rg-team-gtd -l westeurope

az deployment group create \
  -g rg-team-gtd \
  -f infra/main.bicep \
  -p namePrefix=teamgtd swaLocation=westeurope webPubSubSku=Free_F1
```

The Bicep template creates a serverless Cosmos DB account, an Azure Web PubSub
(Free tier by default — fine for a small team; use `Standard_S1` for
production), a Static Web App, and **wires the Cosmos/Web PubSub connection
strings into the Static Web App's API app settings automatically**.

> Free Web PubSub allows ~20 concurrent connections and 20k messages/day.
> For a bigger team or heavier use, redeploy with `webPubSubSku=Standard_S1`.

### 2. Connect the repo (CI/CD)

Get the Static Web App deployment token and add it to GitHub:

```bash
az staticwebapp secrets list \
  -n <staticWebAppName-from-output> -g rg-team-gtd \
  --query "properties.apiKey" -o tsv
```

Add it as a repository secret named `AZURE_STATIC_WEB_APPS_API_TOKEN`
(**Settings → Secrets and variables → Actions**). Pushing to `main` then
builds and deploys automatically via
`.github/workflows/azure-static-web-apps.yml`.

Alternatively deploy manually with the SWA CLI:

```bash
npm install -g @azure/static-web-apps-cli
cd web && npm install && npm run build && cd ..
swa deploy ./web/dist --api-location ./api \
  --deployment-token <token> --env production
```

### 3. Done

Open the Static Web App URL (`staticWebAppDefaultHostname` from the Bicep
output). The board seeds itself on first load and is live for everyone.

---

## Run locally

Two terminals (frontend proxies `/api` to the Functions host on :7071):

```bash
# Terminal 1 — API
cd api
cp local.settings.json.example local.settings.json   # then fill in the values
npm install
npm start            # requires Azure Functions Core Tools v4

# Terminal 2 — frontend
cd web
npm install
npm run dev          # http://localhost:5173
```

For local runtime you still need a real Cosmos DB and Web PubSub (or the
[Cosmos DB emulator](https://learn.microsoft.com/azure/cosmos-db/local-emulator)).
Put their connection strings in `api/local.settings.json`.

Run the API unit tests:

```bash
cd api && node --test test/
```

---

## Configuration (API app settings)

| Setting | Purpose |
| --- | --- |
| `COSMOS_CONNECTION_STRING` | Cosmos DB account connection string |
| `COSMOS_DATABASE` | database name (default `gtd`) |
| `COSMOS_CONTAINER` | container name (default `board`) |
| `WEBPUBSUB_CONNECTION_STRING` | Azure Web PubSub connection string |
| `WEBPUBSUB_HUB` | hub name (default `boardhub`) |

All are set automatically by the Bicep deployment.
