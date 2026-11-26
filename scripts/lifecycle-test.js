// Integration test: create -> authorised use -> daily limit -> revoke -> rejected.
require("dotenv").config();
const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const dbPath = path.resolve("./data/lifecycle-test.sqlite");
try { fs.unlinkSync(dbPath); } catch {}
process.env.DATABASE_FILE = dbPath;
process.env.ADMIN_PASSWORD = "test-admin";
process.env.SESSION_SECRET = "test-session-secret";
const { initializeDatabase, db } = require("../src/database");
initializeDatabase();
const app = require("../server");
const http = require("http");
const server = http.createServer(app);
const { sha256 } = require("../src/middleware/apiKeyAuth");

(async () => {
  await new Promise(resolve => server.listen(0, resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie = "";
  async function request(route, options = {}) {
    const response = await fetch(base + route, { ...options, headers: { ...(options.headers || {}), ...(cookie ? { Cookie: cookie } : {}) } });
    if (response.headers.get("set-cookie")) cookie = response.headers.get("set-cookie").split(";")[0];
    return { status: response.status, body: await response.json() };
  }
  try {
    let r = await request("/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: "test-admin" }) });
    assert.equal(r.status, 200, "admin login");
    r = await request("/admin/keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Lifecycle test", daily_limit: 1 }) });
    assert.equal(r.status, 201, "create key");
    const token = r.body.key.token, id = r.body.key.id;
    assert.equal(db.prepare("SELECT token_hash FROM api_keys WHERE id=?").get(id).token_hash, sha256(token), "only token hash stored");
    r = await request("/api/v1/packages", { headers: { "X-API-Key": token } });
    assert.equal(r.status, 200, "first request authorised");
    r = await request("/api/v1/packages", { headers: { "X-API-Key": token } });
    assert.equal(r.status, 429, "second request rate limited");
    assert.equal(r.body.retry_after, "UTC midnight");
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM api_usage WHERE api_key_id=?").get(id).n, 2, "both authenticated calls logged once");
    r = await request(`/admin/keys/${id}/revoke`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    assert.equal(r.status, 200, "revoke key");
    r = await request("/api/v1/packages", { headers: { "X-API-Key": token } });
    assert.equal(r.status, 401, "revoked key rejected");
    r = await request("/api/v1/packages");
    assert.equal(r.status, 401, "missing key rejected");
    console.log("PASS: create, hashed storage, authorised use, daily limit, usage logging, revoke, revoked rejection, missing-key rejection.");
  } catch (error) { console.error("FAIL:", error); process.exitCode = 1; }
  finally { server.close(); db.close(); }
})();
