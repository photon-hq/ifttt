import { Hono } from "hono";
import { encodeCredentials } from "../sdk.js";
import { store } from "../store.js";
import { requireServiceKey } from "./middleware.js";

const TEST_CREDS = {
	serverUrl: "https://test.photon.codes",
	apiKey: "test_api_key_do_not_use",
	signingSecret: "test_signing_secret",
};
const TEST_TOKEN = encodeCredentials(TEST_CREDS);

export function getTestToken() {
	return TEST_TOKEN;
}

export function isTestRequest(c: any): boolean {
	return (c.req.header("Authorization") ?? "") === `Bearer ${TEST_TOKEN}`;
}

export function createTestSetupRoute(serviceKey: string) {
	const app = new Hono();

	app.post("/ifttt/v1/test/setup", requireServiceKey(serviceKey), (c) => {
		store.seedTestData(TEST_TOKEN);

		return c.json({
			data: {
				accessToken: TEST_TOKEN,
				samples: {
					triggers: {
						new_message: {},
						message_sent: {},
						message_failed: {},
						group_event: {
							event_type: "group.name_changed",
						},
					},
					actions: {
						send_message: {
							to: "+15550001234",
							text: "Hello from IFTTT test!",
						},
						send_reaction: {
							chat_guid: "iMessage;-;+15550001234",
							message_guid: "test-msg-guid",
							reaction: "love",
						},
					},
					queries: {
						list_messages: {},
					},
				},
			},
		});
	});

	return app;
}
