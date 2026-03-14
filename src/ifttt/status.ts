import { Hono } from "hono";
import { requireServiceKey } from "./middleware.js";

export function createStatusRoute(serviceKey: string) {
	const app = new Hono();

	app.get("/ifttt/v1/status", requireServiceKey(serviceKey), (c) =>
		c.body(null, 200),
	);

	return app;
}
