import { z } from "zod";

const schema = z.object({
	IFTTT_SERVICE_KEY: z.string().min(1, "IFTTT_SERVICE_KEY is required"),
	PUBLIC_URL: z.string().min(1, "PUBLIC_URL is required"),
	PORT: z.coerce.number().default(3000),
	HOST: z.string().default("0.0.0.0"),
});

export type Config = z.infer<typeof schema>;

export function loadConfig(): Config {
	const result = schema.safeParse(process.env);
	if (!result.success) {
		for (const issue of result.error.issues) {
			console.error(`  ${issue.path.join(".")}: ${issue.message}`);
		}
		process.exit(1);
	}
	return result.data;
}
