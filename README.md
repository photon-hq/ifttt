# IFTTT iMessage Service

IFTTT service for iMessage powered by [Photon](https://photon.codes). Triggers via [webhook.photon.codes](https://webhook.photon.codes), actions and queries via the [Advanced iMessage Kit](https://github.com/photon-hq/advanced-imessage-kit) SDK.

## How It Works

```
webhook.photon.codes                    IFTTT Platform
        │                                      │
        │ POST /webhooks/ingest                │ polls /ifttt/v1/triggers/*
        │ (HMAC-signed events)                 │ POST  /ifttt/v1/actions/*
        ▼                                      ▼
┌─────────────────────────────────────────────────┐
│              IFTTT Shim Server                   │
│                                                  │
│  Webhook Ingest → In-Memory Store ← IFTTT Polls  │
│                                                  │
│  Actions/Queries → iMessage Kit SDK (per-user)   │
└─────────────────────────────────────────────────┘
```

1. **Connect** — User enters their API key + server endpoint from photon.codes during IFTTT OAuth flow
2. **Triggers** — webhook.photon.codes pushes HMAC-signed iMessage events to us, IFTTT polls for them
3. **Actions** — IFTTT sends action requests, we forward them to the user's iMessage server via the SDK

## User Flow

1. User finds "Photon iMessage" on IFTTT
2. IFTTT redirects to `/oauth/authorize`
3. User enters their **server URL** and **API key** (from photon.codes)
4. On token exchange, we register with webhook.photon.codes (server URL + API key + our ingest URL) and receive a **per-user signing secret**
5. Credentials + signing secret are encoded into the Bearer token
6. User builds applets using triggers + actions below

**Per-user signing secrets:** Each user gets their own signing secret from webhook.photon.codes when they connect. Incoming webhooks are verified against all known secrets. Secrets are re-registered from the Bearer token on every IFTTT API call, so they survive server restarts.

## Triggers

| Slug | Name | Description | Ingredients |
|------|------|-------------|-------------|
| `new_message` | New Message | Fires when an iMessage is received | chat_guid, sender, text, attachments, message_guid, created_at |
| `message_sent` | Message Sent | Fires when a message you sent is confirmed | chat_guid, sender, text, message_guid, created_at |
| `message_failed` | Message Failed | Fires when a message fails to send | chat_guid, error_code, error_message, message_guid, created_at |
| `group_event` | Group Chat Event | Fires on group changes (name, participants, icon) | chat_guid, event_type, group_name, sender, created_at |

The `group_event` trigger has a dynamic dropdown field `event_type` to filter by specific group event.

## Actions

| Slug | Name | Fields | Description |
|------|------|--------|-------------|
| `send_message` | Send Message | `to` (required), `text` | Send a text message to a phone number or email |
| `send_reaction` | Send Reaction | `chat_guid`, `message_guid`, `reaction` | Send a tapback (love, like, dislike, laugh, emphasize, question) |

## Query

| Slug | Name | Description |
|------|------|-------------|
| `list_messages` | List Messages | Paginated message history via SDK |

## Setup

```bash
bun install
cp .env.example .env
# Fill in IFTTT_SERVICE_KEY and PUBLIC_URL
bun run dev
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `IFTTT_SERVICE_KEY` | Yes | From IFTTT Platform → Details tab |
| `PUBLIC_URL` | Yes | Public URL of this server (e.g. `https://ifttt.photon.codes`) — used to register webhook endpoints with webhook.photon.codes |
| `PORT` | No | Server port (default: 3000) |
| `HOST` | No | Server host (default: 0.0.0.0) |

## IFTTT Platform Config

**Authentication:** OAuth2 — credentials encoded into Bearer token

| URL | Value |
|-----|-------|
| Authorization URL | `https://your-domain/oauth/authorize` |
| Token URL | `https://your-domain/oauth/token` |

## Endpoints

```
GET  /ifttt/v1/status                                           — Health check
GET  /ifttt/v1/user/info                                        — User identity
POST /ifttt/v1/test/setup                                       — Test seed data

POST /ifttt/v1/triggers/new_message                             — New message trigger
POST /ifttt/v1/triggers/message_sent                            — Message sent trigger
POST /ifttt/v1/triggers/message_failed                          — Message failed trigger
POST /ifttt/v1/triggers/group_event                             — Group event trigger
POST /ifttt/v1/triggers/group_event/fields/event_type/options   — Group event type options

POST /ifttt/v1/actions/send_message                             — Send message
POST /ifttt/v1/actions/send_reaction                            — Send reaction

POST /ifttt/v1/queries/list_messages                            — List messages

POST /ifttt/v1/webhooks/:type/:event                            — IFTTT connection webhooks
GET  /oauth/authorize                                           — OAuth authorize page
POST /oauth/token                                               — OAuth token exchange
POST /webhooks/ingest                                           — Photon webhook receiver
```

## Deploy (Dokploy)

```bash
docker network create dokploy-network  # if not exists
docker-compose up --build
```

Or deploy directly on Dokploy pointing to this repo.

## Files

```
src/
├── index.ts              # Entry point — Hono server
├── config.ts             # Env validation (Zod)
├── store.ts              # In-memory event store
├── sdk.ts                # Credential encode/decode + SDK factory
├── webhook-ingest.ts     # POST /webhooks/ingest (HMAC verify + event mapping)
└── ifttt/
    ├── middleware.ts      # Auth middleware (service key + bearer)
    ├── status.ts          # GET /ifttt/v1/status
    ├── user-info.ts       # GET /ifttt/v1/user/info
    ├── test-setup.ts      # POST /ifttt/v1/test/setup
    ├── triggers.ts        # 4 triggers (new_message, message_sent, message_failed, group_event)
    ├── actions.ts         # 2 actions (send_message, send_reaction)
    ├── queries.ts         # 1 query (list_messages)
    ├── webhooks.ts        # IFTTT connection webhooks
    └── oauth.ts           # OAuth2 authorize + token exchange
```

## License

MIT
