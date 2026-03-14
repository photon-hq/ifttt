import { consola } from "consola";
import { Hono } from "hono";
import {
	type Credentials,
	decodeCredentials,
	encodeCredentials,
} from "../sdk.js";
import { store } from "../store.js";

interface OAuthPending {
	serverUrl: string;
	apiKey: string;
}

function decodePending(code: string): OAuthPending | null {
	try {
		const parsed = JSON.parse(Buffer.from(code, "base64url").toString());
		if (parsed?.serverUrl && parsed?.apiKey) return parsed;
		return null;
	} catch {
		return null;
	}
}

async function registerWebhook(
	serverUrl: string,
	_apiKey: string,
	webhookUrl: string,
): Promise<string | null> {
	// TODO: Call webhook.photon.codes API to register this server + our ingest URL.
	// Returns a signing secret unique to this user's registration.
	// The endpoint isn't finalized yet — when ready, replace with:
	//
	// const res = await fetch("https://webhook.photon.codes/api/servers", {
	//   method: "POST",
	//   headers: { "Content-Type": "application/json" },
	//   body: JSON.stringify({ serverUrl, apiKey: _apiKey, webhookUrl }),
	// });
	// const data = await res.json();
	// return data.signingSecret;

	consola.info(
		`Webhook registration pending — server: ${serverUrl}, webhook: ${webhookUrl}`,
	);
	return null;
}

export function createOAuthRoutes(publicUrl: string) {
	const app = new Hono();

	app.get("/oauth/authorize", (c) => {
		const redirectUri = c.req.query("redirect_uri") ?? "";
		const state = c.req.query("state") ?? "";
		return c.html(authorizePage(redirectUri, state));
	});

	app.post("/oauth/token", async (c) => {
		let body: Record<string, string> = {};
		try {
			const ct = c.req.header("Content-Type") ?? "";
			if (ct.includes("application/x-www-form-urlencoded")) {
				body = Object.fromEntries(new URLSearchParams(await c.req.text()));
			} else {
				body = await c.req.json();
			}
		} catch {}

		const grantType = body.grant_type;

		if (grantType === "authorization_code") {
			const code = body.code;
			if (!code) {
				return c.json(
					{
						error: "invalid_request",
						error_description: "Missing code",
					},
					400,
				);
			}

			const pending = decodePending(code);
			if (!pending) {
				return c.json(
					{
						error: "invalid_grant",
						error_description: "Invalid token format",
					},
					400,
				);
			}

			const webhookUrl = `${publicUrl}/webhooks/ingest`;
			const signingSecret = await registerWebhook(
				pending.serverUrl,
				pending.apiKey,
				webhookUrl,
			);

			if (!signingSecret) {
				consola.warn(
					"Webhook registration not yet available — issuing token without signing secret",
				);
			}

			const creds: Credentials = {
				serverUrl: pending.serverUrl,
				apiKey: pending.apiKey,
				signingSecret: signingSecret ?? "",
			};
			const accessToken = encodeCredentials(creds);

			if (signingSecret) {
				store.registerSigningSecret(signingSecret);
			}

			store.setUser(accessToken, {
				id: accessToken.slice(0, 16),
				name: "iMessage User",
			});

			return c.json({
				token_type: "Bearer",
				access_token: accessToken,
				refresh_token: accessToken,
			});
		}

		if (grantType === "refresh_token") {
			const rt = body.refresh_token;
			if (!rt) {
				return c.json(
					{
						error: "invalid_request",
						error_description: "Missing refresh_token",
					},
					400,
				);
			}

			const creds = decodeCredentials(rt);
			if (creds?.signingSecret) {
				store.registerSigningSecret(creds.signingSecret);
			}

			if (!store.getUser(rt)) {
				let label = "unknown";
				try {
					if (creds) label = new URL(creds.serverUrl).hostname;
				} catch {}
				store.setUser(rt, {
					id: rt.slice(0, 16),
					name: `iMessage (${label})`,
				});
			}

			return c.json({
				token_type: "Bearer",
				access_token: rt,
				refresh_token: rt,
			});
		}

		return c.json(
			{
				error: "unsupported_grant_type",
				error_description: `Unsupported: ${grantType}`,
			},
			400,
		);
	});

	return app;
}

function authorizePage(redirectUri: string, state: string): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Connect iMessage to IFTTT</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0a0a0a;color:#fafafa}
.card{background:#141414;border:1px solid #2a2a2a;border-radius:16px;padding:40px;max-width:420px;width:100%}
h1{font-size:22px;margin-bottom:8px}
.sub{font-size:14px;color:#888;margin-bottom:24px;line-height:1.5}
label{font-size:13px;font-weight:600;display:block;margin-bottom:8px}
input{width:100%;padding:12px 16px;font-size:14px;font-family:monospace;background:#0a0a0a;border:1px solid #333;border-radius:10px;color:#fafafa;outline:none;margin-bottom:20px}
input:focus{border-color:#0077ff}
button{width:100%;padding:14px;font-size:15px;font-weight:600;background:#0077ff;color:#fff;border:none;border-radius:10px;cursor:pointer;transition:background .2s}
button:hover{background:#005ecb}
.logo{text-align:center;margin-bottom:24px;font-size:32px}
.deny{display:block;text-align:center;margin-top:16px;color:#666;font-size:13px;text-decoration:none}
.deny:hover{color:#999}
</style>
</head>
<body>
<div class="card">
  <div class="logo">💬</div>
  <h1>Connect iMessage</h1>
  <p class="sub">Enter your server details from <a href="https://photon.codes" target="_blank" style="color:#0077ff">photon.codes</a> to connect with IFTTT.</p>

  <form id="f">
    <label for="su">Server URL</label>
    <input type="url" id="su" placeholder="https://your-server.photon.codes" required autocomplete="off" />
    <label for="ak">API Key</label>
    <input type="password" id="ak" placeholder="Enter your API key" required autocomplete="off" />
    <button type="submit">Connect</button>
  </form>

  <a class="deny" id="dl" href="#">Cancel</a>
</div>
<script>
var ru=${JSON.stringify(redirectUri)},st=${JSON.stringify(state)};
function go(code){var s=ru.indexOf("?")===-1?"?":"&";window.location.href=ru+s+"code="+encodeURIComponent(code)+"&state="+encodeURIComponent(st)}
document.getElementById("dl").addEventListener("click",function(e){e.preventDefault();var s=ru.indexOf("?")===-1?"?":"&";window.location.href=ru+s+"error=access_denied&state="+encodeURIComponent(st)});
document.getElementById("f").addEventListener("submit",function(e){e.preventDefault();var s=document.getElementById("su").value.trim(),k=document.getElementById("ak").value.trim();if(!s||!k)return;var p=JSON.stringify({serverUrl:s,apiKey:k});var c=btoa(p).replace(/\\+/g,"-").replace(/\\//g,"_").replace(/=+$/,"");go(c)});
</script>
</body>
</html>`;
}
