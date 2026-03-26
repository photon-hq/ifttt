import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import type { IMClient } from "../sdk.js";
import { createSDK, decodeCredentials } from "../sdk.js";
import { store } from "../store.js";
import { getBearer, requireAuth } from "./middleware.js";
import { isTestRequest } from "./test-setup.js";

function normalizeChatGuid(to: string): string {
	if (to.includes(";")) return to;
	return `iMessage;-;${to}`;
}

async function hasInboundMessage(
	sdk: IMClient,
	chatGuid: string,
): Promise<boolean> {
	try {
		const msgs = await sdk.chats.getChatMessages(chatGuid, { limit: 100 });
		return (Array.isArray(msgs) ? msgs : []).some((m) => !m.isFromMe);
	} catch {
		return false;
	}
}

export function createActionsRoute(serviceKey: string) {
	const app = new Hono();

	app.post(
		"/ifttt/v1/actions/send_message",
		requireAuth(serviceKey),
		async (c) => {
			let body: any = {};
			try {
				body = await c.req.json();
			} catch {}

			const fields = body?.actionFields ?? {};
			const to = fields?.to;
			const text = fields?.text ?? fields?.message ?? "";

			if (!to) {
				return c.json(
					{ errors: [{ message: "Missing required field: to" }] },
					400,
				);
			}

			if (isTestRequest(c)) {
				return c.json({ data: [{ id: randomUUID() }] });
			}

			const token = getBearer(c);
			const creds = token ? decodeCredentials(token) : null;
			if (!creds) {
				return c.json({ errors: [{ message: "Invalid credentials" }] }, 401);
			}
			if (creds.signingSecret) store.registerSigningSecret(creds.signingSecret);

			const sdk = createSDK(creds);
			const chatGuid = normalizeChatGuid(to);

			if (!(await hasInboundMessage(sdk, chatGuid))) {
				return c.json(
					{
						errors: [
							{
								message:
									"No prior inbound message from this contact. Outbound messages are only allowed to contacts who have messaged you first.",
							},
						],
					},
					400,
				);
			}

			try {
				const result = await sdk.messages.sendMessage({
					chatGuid,
					message: text,
				});
				return c.json({
					data: [{ id: (result as any)?.guid ?? randomUUID() }],
				});
			} catch (err: any) {
				return c.json(
					{
						errors: [
							{ message: `Send failed: ${err?.message ?? "Unknown error"}` },
						],
					},
					500,
				);
			}
		},
	);

	app.post(
		"/ifttt/v1/actions/send_reaction",
		requireAuth(serviceKey),
		async (c) => {
			let body: any = {};
			try {
				body = await c.req.json();
			} catch {}

			const fields = body?.actionFields ?? {};
			const chatGuid = fields?.chat_guid;
			const messageGuid = fields?.message_guid;
			const reaction = fields?.reaction ?? "love";

			if (!chatGuid || !messageGuid) {
				return c.json(
					{
						errors: [
							{
								message: "Missing required fields: chat_guid, message_guid",
							},
						],
					},
					400,
				);
			}

			if (isTestRequest(c)) {
				return c.json({ data: [{ id: randomUUID() }] });
			}

			const token = getBearer(c);
			const creds = token ? decodeCredentials(token) : null;
			if (!creds) {
				return c.json({ errors: [{ message: "Invalid credentials" }] }, 401);
			}
			if (creds.signingSecret) store.registerSigningSecret(creds.signingSecret);

			const sdk = createSDK(creds);
			try {
				await sdk.messages.sendReaction({
					chatGuid,
					messageGuid,
					reaction,
				});
				return c.json({ data: [{ id: randomUUID() }] });
			} catch (err: any) {
				return c.json(
					{
						errors: [
							{
								message: `Reaction failed: ${err?.message ?? "Unknown error"}`,
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
