import { createHmac, timingSafeEqual } from "node:crypto";
import { consola } from "consola";
import { Hono } from "hono";
import { store } from "./store.js";

const MAX_DRIFT = 300;

function computeSignature(body: string, secret: string, ts: string): string {
	return `v0=${createHmac("sha256", secret).update(`v0:${ts}:${body}`).digest("hex")}`;
}

function verifyAgainstSecrets(
	body: string,
	secrets: string[],
	sig: string,
	ts: string,
): boolean {
	for (const secret of secrets) {
		const expected = computeSignature(body, secret, ts);
		if (
			expected.length === sig.length &&
			timingSafeEqual(Buffer.from(expected), Buffer.from(sig))
		) {
			return true;
		}
	}
	return false;
}

interface MappedEvent {
	_trigger: string;
	[key: string]: unknown;
}

function mapEvent(event: string, data: any): MappedEvent | null {
	const base = {
		chat_guid: data?.chatGuid ?? data?.chat?.guid ?? "",
		sender: data?.handle?.address ?? data?.sender ?? "",
		text: data?.text ?? "",
		attachments: JSON.stringify(
			(data?.attachments ?? []).map(
				(a: any) => a.transferName ?? a.fileName ?? "",
			),
		),
		created_at: new Date().toISOString(),
		message_guid: data?.guid ?? "",
		is_from_me: String(data?.isFromMe ?? false),
		group_name: data?.chat?.displayName ?? data?.groupTitle ?? "",
		error_code: "",
		error_message: "",
	};

	switch (event) {
		case "new-message":
			return data?.isFromMe
				? { ...base, _trigger: "message_sent", event_type: "message_sent" }
				: { ...base, _trigger: "new_message", event_type: "new_message" };

		case "updated-message":
			if (data?.dateRead)
				return {
					...base,
					_trigger: "new_message",
					event_type: "message.read",
				};
			if (data?.dateDelivered)
				return {
					...base,
					_trigger: "message_sent",
					event_type: "message.delivered",
				};
			return null;

		case "message-send-error":
			return {
				...base,
				_trigger: "message_failed",
				event_type: "message_failed",
				error_code: String(data?.errorCode ?? 500),
				error_message: data?.error ?? "Send failed",
			};

		case "typing-indicator":
			return {
				...base,
				_trigger: "new_message",
				event_type: data?.display ? "typing.started" : "typing.stopped",
				chat_guid: data?.guid ?? "",
			};

		case "group-name-change":
			return {
				...base,
				_trigger: "group_event",
				event_type: "group.name_changed",
			};
		case "participant-added":
			return {
				...base,
				_trigger: "group_event",
				event_type: "group.participant_added",
			};
		case "participant-removed":
			return {
				...base,
				_trigger: "group_event",
				event_type: "group.participant_removed",
			};
		case "participant-left":
			return {
				...base,
				_trigger: "group_event",
				event_type: "group.participant_left",
			};
		case "group-icon-changed":
			return {
				...base,
				_trigger: "group_event",
				event_type: "group.icon_changed",
			};
		case "group-icon-removed":
			return {
				...base,
				_trigger: "group_event",
				event_type: "group.icon_removed",
			};

		default:
			return null;
	}
}

export function createWebhookIngestRoute(iftttServiceKey?: string) {
	const app = new Hono();

	app.post("/webhooks/ingest", async (c) => {
		const sig = c.req.header("X-Photon-Signature") ?? "";
		const ts = c.req.header("X-Photon-Timestamp") ?? "";

		if (!sig || !ts) return c.json({ error: "Missing signature headers" }, 401);

		const now = Math.floor(Date.now() / 1000);
		const tsNum = Number.parseInt(ts, 10);
		if (Number.isNaN(tsNum) || Math.abs(now - tsNum) > MAX_DRIFT) {
			return c.json({ error: "Timestamp drift too large" }, 401);
		}

		const rawBody = await c.req.text();
		const secrets = store.getSigningSecrets();

		if (secrets.length === 0) {
			consola.warn("No signing secrets registered, rejecting webhook");
			return c.json({ error: "No users configured" }, 401);
		}

		if (!verifyAgainstSecrets(rawBody, secrets, sig, ts)) {
			return c.json({ error: "Invalid signature" }, 401);
		}

		let payload: { event: string; data: any };
		try {
			payload = JSON.parse(rawBody);
		} catch {
			return c.json({ error: "Invalid JSON" }, 400);
		}

		const mapped = mapEvent(payload.event, payload.data);
		if (!mapped) {
			consola.debug(`Ignoring unmapped event: ${payload.event}`);
			return c.json({ ok: true });
		}

		store.push(mapped);
		consola.info(`Ingested ${mapped.event_type} → trigger:${mapped._trigger}`);

		if (iftttServiceKey) {
			notifyRealtime(iftttServiceKey).catch(() => {});
		}

		return c.json({ ok: true });
	});

	return app;
}

async function notifyRealtime(key: string) {
	try {
		await fetch("https://realtime.ifttt.com/v1/notifications", {
			method: "POST",
			headers: {
				"IFTTT-Service-Key": key,
				"Content-Type": "application/json",
				Accept: "application/json",
				"X-Request-ID": crypto.randomUUID(),
			},
			body: JSON.stringify({ data: [] }),
		});
	} catch {
		consola.debug("IFTTT realtime notification failed");
	}
}
