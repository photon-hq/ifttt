import { Hono } from "hono";
import { store } from "../store.js";
import { requireAuth } from "./middleware.js";

/*
 * 4 triggers:
 *   new_message     — inbound iMessage (not from me)
 *   message_sent    — outbound message confirmed
 *   message_failed  — send error
 *   group_event     — group chat changes (name, participants, icon)
 */

const GROUP_EVENT_OPTIONS = [
	{ label: "Name Changed", value: "group.name_changed" },
	{ label: "Participant Added", value: "group.participant_added" },
	{ label: "Participant Removed", value: "group.participant_removed" },
	{ label: "Participant Left", value: "group.participant_left" },
	{ label: "Icon Changed", value: "group.icon_changed" },
	{ label: "Icon Removed", value: "group.icon_removed" },
];

function triggerRoute(
	app: Hono,
	slug: string,
	serviceKey: string,
	filterField?: string,
	fieldOptions?: { label: string; value: string }[],
) {
	app.post(`/ifttt/v1/triggers/${slug}`, requireAuth(serviceKey), async (c) => {
		let body: any = {};
		try {
			body = await c.req.json();
		} catch {}

		const limit = body?.limit ?? 50;
		const fields = body?.triggerFields ?? {};
		const filterValue = filterField ? fields?.[filterField] : undefined;

		if (filterField && !filterValue) {
			return c.json(
				{
					errors: [
						{ message: `Missing required trigger field: ${filterField}` },
					],
				},
				400,
			);
		}

		const items = store
			.query(
				slug,
				limit,
				filterField ? "event_type" : undefined,
				filterValue || undefined,
			)
			.map(({ _trigger, ...rest }) => rest);

		return c.json({ data: items });
	});

	if (fieldOptions && filterField) {
		app.post(
			`/ifttt/v1/triggers/${slug}/fields/${filterField}/options`,
			requireAuth(serviceKey),
			(c) => c.json({ data: fieldOptions }),
		);
	}

	app.delete(
		`/ifttt/v1/triggers/${slug}/trigger_identity/:id`,
		requireAuth(serviceKey),
		(c) => c.body(null, 200),
	);
}

export function createTriggersRoute(serviceKey: string) {
	const app = new Hono();

	triggerRoute(app, "new_message", serviceKey);
	triggerRoute(app, "message_sent", serviceKey);
	triggerRoute(app, "message_failed", serviceKey);
	triggerRoute(
		app,
		"group_event",
		serviceKey,
		"event_type",
		GROUP_EVENT_OPTIONS,
	);

	return app;
}
