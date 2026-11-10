// Creates (or recreates) LINE sign-in for the platform as a plain OAuth2
// custom provider ("custom:line") in Supabase Auth: on mango-works-staging, or
// on local Supabase with --local. It never touches the live project.
//
// Why a script (docs/marketplace/decisions.md, LINE Login): LINE signs
// web-login ID tokens with HS256 although its discovery document advertises
// ES256, so an OIDC-type provider rejects every LINE login. The dashboard only
// creates OIDC-type providers, and a provider's type can't be changed later.
// An OAuth2-type provider skips the ID token and reads the profile from LINE's
// userinfo endpoint. Same approach as apps/marketplace/scripts/create-line-provider.mjs,
// which targets the linked (live) project instead.
//
// Usage, from apps/platform:
//   node --env-file=.env.local scripts/create-line-provider.mjs           staging
//   node --env-file=.env.local scripts/create-line-provider.mjs --local   local
//
// Asks for the LINE Login channel ID and its Channel secret (hidden, never
// printed). Staging needs STAGING_SUPABASE_URL and STAGING_SUPABASE_SECRET_KEY.

import readline from "node:readline";
import { createClient } from "@supabase/supabase-js";

const IDENTIFIER = "custom:line";
const local = process.argv.includes("--local");

const url = local
  ? process.env.NEXT_PUBLIC_SUPABASE_URL
  : process.env.STAGING_SUPABASE_URL;
const serviceKey = local
  ? process.env.SUPABASE_SERVICE_ROLE_KEY
  : process.env.STAGING_SUPABASE_SECRET_KEY;
if (!url || !serviceKey) {
  fail(
    local
      ? "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local"
      : "Set STAGING_SUPABASE_URL and STAGING_SUPABASE_SECRET_KEY in .env.local",
  );
}
const isLocalUrl = /^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url);
if (local !== isLocalUrl) fail(`Refusing: ${url} isn't the expected project.`);

const channelId = (await ask("LINE Login channel ID: ", false)).replace(
  /\D/g,
  "",
);
if (!/^\d{10}$/.test(channelId)) {
  fail("A LINE Login channel ID is 10 digits. Nothing changed.");
}

// Terminals can wrap pasted text in bracketed-paste markers; a Channel secret
// is always 32 hex characters, so keep only those and check the shape.
const raw = await ask("LINE Channel secret: ", true);
const clientSecret = raw
  .replace(/\x1b\[20[01]~/g, "")
  .replace(/[^0-9a-fA-F]/g, "")
  .toLowerCase();
if (!/^[0-9a-f]{32}$/.test(clientSecret)) {
  fail(
    `That doesn't look like a Channel secret (expected 32 hex characters, got ${clientSecret.length}). Nothing changed.`,
  );
}

const providers = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
}).auth.admin.customProviders;

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
  client_id: channelId,
  client_secret: clientSecret,
  authorization_url: "https://access.line.me/oauth2/v2.1/authorize",
  token_url: "https://api.line.me/oauth2/v2.1/token",
  userinfo_url: "https://api.line.me/oauth2/v2.1/userinfo",
  // `openid` is needed for userinfo. Add `email` once LINE approves the email
  // permission for the channel.
  scopes: ["openid", "profile"],
  pkce_enabled: true,
  email_optional: true,
  enabled: true,
});
if (error) fail("Couldn't create the provider", error);

console.log(
  `Created ${data.identifier}: type ${data.provider_type}, ${data.enabled ? "enabled" : "disabled"}, on ${local ? "local" : "staging"} (${url}).`,
);

function fail(message, error) {
  console.error(error ? `${message}: ${error.message ?? error}` : message);
  process.exit(1);
}

function ask(question, hidden) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });
    if (hidden) {
      rl._writeToOutput = (text) => {
        if (text.includes(question)) rl.output.write(text);
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer.trim());
    });
  });
}
