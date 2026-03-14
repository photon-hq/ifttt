import type { Context, Next } from "hono";
import { decodeCredentials } from "../sdk.js";

export function getBearer(c: Context): string | undefined {
	const h = c.req.header("Authorization") ?? "";
	return h.startsWith("Bearer ") ? h.slice(7) : undefined;
}

export function requireServiceKey(serviceKey: string) {
	return async (c: Context, next: Next) => {
		if (c.req.header("IFTTT-Service-Key") !== serviceKey) {
			return c.json(
				{ errors: [{ message: "Channel/Service key is not correct" }] },
				401,
			);
		}
		return next();
	};
}

export function requireAuth(serviceKey: string) {
	return async (c: Context, next: Next) => {
		const hasServiceKey = c.req.header("IFTTT-Service-Key") === serviceKey;
		const bearer = getBearer(c);

		if (bearer) {
			const creds = decodeCredentials(bearer);
			if (!creds) {
				return c.json({ errors: [{ message: "Invalid access token" }] }, 401);
			}
			return next();
		}

		if (hasServiceKey) {
			return next();
		}

		return c.json({ errors: [{ message: "Unauthorized" }] }, 401);
	};
}
