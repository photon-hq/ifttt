import { consola } from "consola";
import { Hono } from "hono";
import { loadConfig } from "./config.js";
import { createActionsRoute } from "./ifttt/actions.js";
import { createOAuthRoutes } from "./ifttt/oauth.js";
import { createQueriesRoute } from "./ifttt/queries.js";
import { createStatusRoute } from "./ifttt/status.js";
import { createTestSetupRoute } from "./ifttt/test-setup.js";
import { createTriggersRoute } from "./ifttt/triggers.js";
import { createUserInfoRoute } from "./ifttt/user-info.js";
import { createIFTTTWebhooksRoute } from "./ifttt/webhooks.js";
import { createWebhookIngestRoute } from "./webhook-ingest.js";

const config = loadConfig();
const app = new Hono();

app.route("", createWebhookIngestRoute(config.IFTTT_SERVICE_KEY));
app.route("", createStatusRoute(config.IFTTT_SERVICE_KEY));
app.route("", createUserInfoRoute(config.IFTTT_SERVICE_KEY));
app.route("", createTestSetupRoute(config.IFTTT_SERVICE_KEY));
app.route("", createTriggersRoute(config.IFTTT_SERVICE_KEY));
app.route("", createActionsRoute(config.IFTTT_SERVICE_KEY));
app.route("", createQueriesRoute(config.IFTTT_SERVICE_KEY));
app.route("", createIFTTTWebhooksRoute(config.IFTTT_SERVICE_KEY));
app.route("", createOAuthRoutes(config.PUBLIC_URL));

app.get("/", (c) =>
	c.json({ service: "ifttt-imessage", version: "2.0.0", status: "ok" }),
);

consola.info(`Starting on ${config.HOST}:${config.PORT}`);

export default {
	port: config.PORT,
	hostname: config.HOST,
	fetch: app.fetch,
};
