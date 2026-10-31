// Server-only: shared auth for scheduled hooks called by pg_cron.
// Accepts CRON_SECRET or PUSH_TRIGGER_SECRET: the database sends the value
// stored in app_config.cron_secret, which is the push trigger secret.
// Never accept the Supabase anon/publishable key, which ships to browsers.

export function isCronAuthorized(request: Request): boolean {
  const apikey =
    request.headers.get("apikey") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!apikey) return false;
  const secrets = [process.env.CRON_SECRET, process.env.PUSH_TRIGGER_SECRET].filter(
    (s): s is string => typeof s === "string" && s.length > 0,
  );
  return secrets.includes(apikey);
}
