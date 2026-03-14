import { SDK } from "@photon-ai/advanced-imessage-kit";

export interface Credentials {
	serverUrl: string;
	apiKey: string;
	signingSecret: string;
}

export type IMClient = ReturnType<typeof SDK>;

export function encodeCredentials(creds: Credentials): string {
	return Buffer.from(JSON.stringify(creds)).toString("base64url");
}

export function decodeCredentials(token: string): Credentials | null {
	try {
		const parsed = JSON.parse(Buffer.from(token, "base64url").toString());
		if (parsed?.serverUrl && parsed?.apiKey && "signingSecret" in parsed)
			return parsed;
		return null;
	} catch {
		return null;
	}
}

export function createSDK(creds: Credentials): IMClient {
	return SDK({ serverUrl: creds.serverUrl, apiKey: creds.apiKey });
}
