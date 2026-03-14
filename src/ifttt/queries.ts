import { Hono } from "hono";
import { createSDK, decodeCredentials } from "../sdk.js";
import { store } from "../store.js";
import { getBearer, requireAuth } from "./middleware.js";
import { isTestRequest } from "./test-setup.js";

export function createQueriesRoute(serviceKey: string) {
	const app = new Hono();

	app.post(
		"/ifttt/v1/queries/list_messages",
		requireAuth(serviceKey),
		async (c) => {
			let body: any = {};
			try {
				body = await c.req.json();
			} catch {}

			const limit = body?.limit ?? 50;
			const cursor = body?.cursor ?? null;
			const offset = cursor ? Number.parseInt(cursor, 10) : 0;

			if (isTestRequest(c)) {
				const now = Math.floor(Date.now() / 1000);
				const data = [];
				const count = Math.min(limit, 3);
				for (let i = 0; i < count; i++) {
					data.push({
						message_guid: `test-msg-${offset + i}`,
						chat_guid: "iMessage;-;+918527438574",
						sender: i % 2 === 0 ? "+918527438574" : "+919968476781",
						text: `Test message ${offset + i + 1}`,
						is_from_me: "false",
						created_at: new Date(
							(now - (offset + i) * 60) * 1000,
						).toISOString(),
					});
				}
				const result: any = { data };
				if (data.length >= limit) result.cursor = String(offset + limit);
				return c.json(result);
			}

			const token = getBearer(c);
			const creds = token ? decodeCredentials(token) : null;
			if (!creds) {
				return c.json({ errors: [{ message: "Invalid credentials" }] }, 401);
			}
			if (creds.signingSecret) store.registerSigningSecret(creds.signingSecret);

			const sdk = createSDK(creds);
			try {
				const messages = await sdk.messages.getMessages({ limit, offset });
				const raw = (messages as any)?.data ?? messages ?? [];

				const data = (Array.isArray(raw) ? raw : []).map((msg: any) => ({
					message_guid: msg.guid ?? "",
					chat_guid: msg.chatGuid ?? "",
					sender: msg.handle?.address ?? msg.sender ?? "",
					text: msg.text ?? "",
					is_from_me: String(msg.isFromMe ?? false),
					created_at: msg.date ?? new Date().toISOString(),
				}));

				const result: any = { data };
				if (data.length >= limit) result.cursor = String(offset + limit);
				return c.json(result);
			} catch (err: any) {
				return c.json(
					{
						errors: [
							{
								message: `Query failed: ${err?.message ?? "Unknown error"}`,
							},
						],
					},
					500,
				);
			}
		},
	);

	return app;
}
