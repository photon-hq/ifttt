import { consola } from "consola";
import { Hono } from "hono";
import { requireServiceKey } from "./middleware.js";

export function createIFTTTWebhooksRoute(serviceKey: string) {
	const app = new Hono();

	app.post(
		"/ifttt/v1/webhooks/:type/:event",
		requireServiceKey(serviceKey),
		async (c) => {
			let body: any = {};
			try {
				body = await c.req.json();
			} catch {}

			consola.info(
				`IFTTT webhook: ${c.req.param("type")}/${c.req.param("event")}`,
				body?.data?.user_id ?? "",
			);

			return c.body(null, 200);
		},
	);

	return app;
}
