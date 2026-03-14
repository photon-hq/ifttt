import type { Context, Next } from "hono";

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
		const hasBearer = (c.req.header("Authorization") ?? "").startsWith(
			"Bearer ",
		);
		if (!hasServiceKey && !hasBearer) {
			return c.json({ errors: [{ message: "Unauthorized" }] }, 401);
		}
		return next();
	};
}
