# Artemis United

Artemis United is the customer self-service web app of the Artemis ecosystem. It helps groups manage themselves: view active contracts and history, see group members and roles, access financial education, and initiate product renewals/applications without relying on an agent for every step.

## How it fits in the Artemis ecosystem

Artemis has multiple apps and one shared backend:

- **Hunt (front):** agent/colector creates proposals, collects documents, submits.
- **Gate (ops UI):** operations reviews proposals and decides approve/reject.
- **Hub (gateway/host):** hosts frontends and acts as the browser gateway (CORS, routing, normalization, debugging).
- **Arise (backend):** source of truth that persists proposals, stages, decisions.

**Important:** Artemis United is a browser app and must call APIs through **Hub** (same-origin preferred). Hub forwards requests upstream to Arise.

## Environments & API base

United should use Hub as the API gateway:

- Preferred (same-origin): `fetch("/api/...")`
- Alternative: set `VITE_API_BASE="https://artemis-hub.replit.app"` and call `fetch("${VITE_API_BASE}/api/...")`

### Required environment variables

Create a `.env` locally in Replit (do not commit it):

- `VITE_API_BASE` (optional) — when not set, the app should default to same-origin calls (`""`).

Use `.env.example` as reference.

## Local development

```bash
npm install
npm run dev
