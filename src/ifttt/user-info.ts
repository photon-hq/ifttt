import { createHash } from "node:crypto";
import { Hono } from "hono";
import { decodeCredentials } from "../sdk.js";
import { store } from "../store.js";
import { getBearer, requireAuth } from "./middleware.js";

function deriveUserId(serverUrl: string, apiKey: string): string {
	return createHash("sha256")
		.update(`${serverUrl}:${apiKey}`)
		.digest("hex")
		.slice(0, 32);
}

export function createUserInfoRoute(serviceKey: string) {
	const app = new Hono();

	app.get("/ifttt/v1/user/info", requireAuth(serviceKey), (c) => {
		const token = getBearer(c) ?? "";
		let user = store.getUser(token);

		if (!user && token) {
			const creds = decodeCredentials(token);
			if (!creds) {
				return c.json({ errors: [{ message: "Invalid access token" }] }, 401);
			}
			if (creds.signingSecret) {
				store.registerSigningSecret(creds.signingSecret);
			}
			const id = deriveUserId(creds.serverUrl, creds.apiKey);
			let label = creds.serverUrl;
			try {
				label = new URL(creds.serverUrl).hostname;
			} catch {}
			user = { id, name: `iMessage (${label})` };
			store.setUser(token, user);
		}

		if (!user) {
			return c.json({ errors: [{ message: "User not found" }] }, 404);
		}

		return c.json({
			data: { name: user.name, id: user.id, url: "https://photon.codes" },
		});
	});

	return app;
}
