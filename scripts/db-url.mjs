/**
 * Connection options from a Postgres URL, keeping only what Postgres.js
 * understands.
 *
 * Supabase's connection strings carry extra query parameters (such as
 * `supa=base-pooler.x`) that Postgres.js would forward to the server as
 * session settings, which the server rejects. So the URL is taken apart and
 * only the connection itself is kept. TLS is required for any remote host.
 */
export function connectionOptions(url) {
  const u = new URL(url);
  const local = ["localhost", "127.0.0.1", "::1"].includes(u.hostname);
  return {
    host: u.hostname,
    port: Number(u.port || 5432),
    database: decodeURIComponent(u.pathname.slice(1) || "postgres"),
    username: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    ssl: local ? false : "require",
  };
}
