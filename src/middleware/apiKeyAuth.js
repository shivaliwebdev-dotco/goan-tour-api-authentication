const crypto = require("crypto");
const { db } = require("../database");

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const dayStartUtc = () => new Date().toISOString().slice(0, 10) + " 00:00:00";

function apiKeyAuth(req, res, next) {
  const rawKey = req.get("X-API-Key");
  if (!rawKey) {
    return res.status(401).json({ error: "api_key_required", message: "Send your API key in the X-API-Key header." });
  }

  const key = db.prepare("SELECT id, name, active, daily_limit FROM api_keys WHERE token_hash = ?").get(sha256(rawKey));
  if (!key || key.active !== 1) {
    return res.status(401).json({ error: "invalid_api_key", message: "The API key is invalid or has been revoked." });
  }

  const requestId = crypto.randomUUID();
  const todayCount = db.prepare(`
    SELECT COUNT(*) AS total FROM api_usage
    WHERE api_key_id = ? AND created_at >= ?
  `).get(key.id, dayStartUtc()).total;

  // Every authenticated call is logged exactly once, including a request rejected by the limit.
  const statusCode = todayCount >= key.daily_limit ? 429 : 200;
  db.prepare(`
    INSERT INTO api_usage (api_key_id, endpoint, method, status_code, request_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(key.id, req.originalUrl, req.method, statusCode, requestId);

  const currentUsage = todayCount + 1;
  if (statusCode === 429) {
    return res.status(429).json({
      error: "daily_limit_exceeded",
      message: `Daily limit of ${key.daily_limit} requests reached.`,
      retry_after: "UTC midnight",
      retry_hint: "Wait until the next UTC day or ask the tour operator for a higher daily limit.",
      limit: key.daily_limit,
      usage_today: currentUsage
    });
  }

  req.apiKey = key;
  req.requestId = requestId;
  req.dailyLimit = key.daily_limit;
  req.dailyUsage = currentUsage;
  next();
}
module.exports = { apiKeyAuth, sha256 };
