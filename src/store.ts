import { randomUUID } from "node:crypto";

export interface TriggerItem {
	[key: string]: unknown;
	meta: { id: string; timestamp: number };
}

const MAX_EVENTS = 1000;

class EventStore {
	private events: TriggerItem[] = [];
	private users = new Map<string, { id: string; name: string }>();
	private authCodes = new Map<string, string>();
	private signingSecrets: string[] = [];

	push(data: Record<string, unknown>): TriggerItem {
		const item: TriggerItem = {
			...data,
			meta: { id: randomUUID(), timestamp: Math.floor(Date.now() / 1000) },
		};
		this.events.unshift(item);
		if (this.events.length > MAX_EVENTS) this.events.length = MAX_EVENTS;
		return item;
	}

	query(
		trigger: string,
		limit = 50,
		filterField?: string,
		filterValue?: string,
	): TriggerItem[] {
		const out: TriggerItem[] = [];
		for (const item of this.events) {
			if (out.length >= limit) break;
			if (item._trigger !== trigger) continue;
			if (filterField && filterValue && item[filterField] !== filterValue)
				continue;
			out.push(item);
		}
		return out;
	}

	setUser(token: string, user: { id: string; name: string }) {
		this.users.set(token, user);
	}
	getUser(token: string) {
		return this.users.get(token);
	}

	storeAuthCode(code: string, token: string) {
		this.authCodes.set(code, token);
	}
	exchangeCode(code: string): string | undefined {
		const token = this.authCodes.get(code);
		if (token) this.authCodes.delete(code);
		return token;
	}

	registerSigningSecret(secret: string) {
		if (!this.signingSecrets.includes(secret)) {
			this.signingSecrets.push(secret);
		}
	}

	getSigningSecrets(): string[] {
		return this.signingSecrets;
	}

	seedTestData(token: string) {
		this.setUser(token, { id: "test-user-1", name: "Test User" });
		this.registerSigningSecret("test_signing_secret");
		const now = Math.floor(Date.now() / 1000);

		const triggers = [
			"new_message",
			"message_sent",
			"message_failed",
			"group_event",
		];
		for (let i = 0; i < 3; i++) {
			for (const trigger of triggers) {
				this.events.unshift({
					_trigger: trigger,
					event_type:
						trigger === "group_event" ? "group.name_changed" : trigger,
					chat_guid: `iMessage;-;+91852743857${i}`,
					sender: i % 2 === 0 ? `+918527438574` : `+919968476781`,
					text: `Test ${trigger} #${i + 1}`,
					attachments: "",
					message_guid: randomUUID(),
					is_from_me: trigger === "message_sent" ? "true" : "false",
					group_name: trigger === "group_event" ? "Test Group" : "",
					error_code: trigger === "message_failed" ? "500" : "",
					error_message: trigger === "message_failed" ? "Delivery failed" : "",
					created_at: new Date((now - i * 60) * 1000).toISOString(),
					meta: { id: randomUUID(), timestamp: now - i * 60 },
				});
			}
		}
	}
}

export const store = new EventStore();
