// Creates (or recreates) the LINE sign-in provider as a plain OAuth2 custom
// provider in Supabase Auth.
//
// Why a script: LINE signs web-login ID tokens with HS256 although its OIDC
// discovery document advertises ES256, so an OIDC-type provider rejects every
// LINE login. The dashboard only creates OIDC-type providers (it requires an
// issuer), and a provider's type can't be changed later. An OAuth2-type
// provider skips the ID token and reads the profile from LINE's userinfo
// endpoint instead. See docs/decisions.md.
//
// Usage (from the repo root, signed in with `npx supabase login` and linked):
//   node scripts/create-line-provider.mjs           hosted project
//   node scripts/create-line-provider.mjs --local   local Supabase (testing)
//
// The LINE Channel secret is typed at a hidden prompt and never printed.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import readline from "node:readline";
import { createClient } from "@supabase/supabase-js";

const LINE_CHANNEL_ID = "2012189656";
const IDENTIFIER = "custom:line";

const local = process.argv.includes("--local");
const { url, serviceKey } = local ? localProject() : hostedProject();

// Terminals can wrap pasted text in invisible control sequences (bracketed
// paste, e.g. "\x1b[200~...\x1b[201~"), which silently corrupts the secret.
// A LINE Channel secret is always 32 hex characters, so keep only those and
// check the shape before saving anything.
const raw = await askHidden("LINE Channel secret: ");
const clientSecret = raw
  .replace(/\x1b\[20[01]~/g, "")
  .replace(/[^0-9a-fA-F]/g, "")
  .toLowerCase();
if (!/^[0-9a-f]{32}$/.test(clientSecret)) {
  console.error(
    `That doesn't look like a LINE Channel secret (expected 32 letters a-f and digits, ` +
      `got ${clientSecret.length} after removing other characters). Nothing changed.`,
  );
  process.exit(1);
}
if (clientSecret !== raw.trim()) {
  console.log("Removed extra characters from the pasted secret.");
}

const providers = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
}).auth.admin.customProviders;

// Replace any earlier version (e.g. the OIDC one the dashboard created).
const existing = await providers.getProvider(IDENTIFIER);
if (existing.data) {
  const { error } = await providers.deleteProvider(IDENTIFIER);
  if (error) fail("Couldn't remove the existing provider", error);
  console.log(
    `Removed the existing ${IDENTIFIER} (${existing.data.provider_type}).`,
  );
}

const { data, error } = await providers.createProvider({
  provider_type: "oauth2",
  identifier: IDENTIFIER,
  name: "LINE",
  client_id: LINE_CHANNEL_ID,
  client_secret: clientSecret,
  authorization_url: "https://access.line.me/oauth2/v2.1/authorize",
  token_url: "https://api.line.me/oauth2/v2.1/token",
  // Returns sub (the LINE user ID), name and picture.
  userinfo_url: "https://api.line.me/oauth2/v2.1/userinfo",
  // `openid` is needed for the userinfo endpoint. Add `email` once LINE
  // approves the email permission for the channel.
  scopes: ["openid", "profile"],
  pkce_enabled: true,
  email_optional: true,
  enabled: true,
});
if (error) fail("Couldn't create the provider", error);

console.log(
  `Created ${data.identifier}: type ${data.provider_type}, ` +
    `${data.enabled ? "enabled" : "disabled"}, on ${local ? "local" : "hosted"} Supabase.`,
);

function hostedProject() {
  const ref = readFileSync("supabase/.temp/project-ref", "utf8").trim();
  const out = execFileSync(
    "npx",
    [
      "supabase",
      "projects",
      "api-keys",
      "--project-ref",
      ref,
      "--reveal",
      "-o",
      "json",
    ],
    { encoding: "utf8", shell: true, stdio: ["ignore", "pipe", "ignore"] },
  );
  const keys = JSON.parse(out.slice(out.indexOf("[")));
  const service = keys.find((k) => k.name === "service_role");
  if (!service) fail("Couldn't find the service_role key for the project");
  return { url: `https://${ref}.supabase.co`, serviceKey: service.api_key };
}

function localProject() {
  const env = Object.fromEntries(
    readFileSync(".env.local", "utf8")
      .split(/\r?\n/)
      .filter((line) => /^[A-Z_]+=/.test(line))
      .map((line) => [
        line.slice(0, line.indexOf("=")),
        line.slice(line.indexOf("=") + 1),
      ]),
  );
  return {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    serviceKey: env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });
    // Echo the question but not what's typed.
    rl._writeToOutput = (text) => {
      if (text.includes(question)) rl.output.write(text);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer.trim());
    });
  });
}

function fail(message, error) {
  console.error(message + (error ? `: ${error.message ?? error}` : "."));
  process.exit(1);
}
