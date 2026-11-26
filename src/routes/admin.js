const express = require("express");
const crypto = require("crypto");
const { db } = require("../database");
const { sha256 } = require("../middleware/apiKeyAuth");
const router = express.Router();

const requireAdmin = (req, res, next) => {
  if (!req.session.isAdmin) return res.status(401).json({ error: "admin_login_required" });
  next();
};

router.post("/login", (req, res) => {
  const password = String(req.body.password || "");
  const expected = process.env.ADMIN_PASSWORD || "";
  if (!expected || password !== expected) return res.status(401).json({ error: "invalid_credentials", message: "Incorrect admin password." });
  req.session.isAdmin = true;
  res.json({ success: true, message: "Signed in." });
});
router.post("/logout", requireAdmin, (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});
router.get("/session", (req, res) => res.json({ authenticated: Boolean(req.session.isAdmin) }));

router.get("/keys", requireAdmin, (_req, res) => {
  const keys = db.prepare(`
    SELECT k.id, k.name, k.active, k.daily_limit, k.created_at, k.revoked_at,
      (SELECT COUNT(*) FROM api_usage u WHERE u.api_key_id = k.id) AS usage_count,
      (SELECT COUNT(*) FROM api_usage u WHERE u.api_key_id = k.id AND u.created_at >= datetime('now','start of day')) AS usage_today
    FROM api_keys k ORDER BY k.id DESC
  `).all();
  res.json({ data: keys });
});

router.post("/keys", requireAdmin, (req, res) => {
  const name = String(req.body.name || "").trim();
  const dailyLimit = Number(req.body.daily_limit || 100);
  if (!name || name.length > 80) return res.status(400).json({ error: "invalid_name", message: "Enter a key name (1–80 characters)." });
  if (!Number.isInteger(dailyLimit) || dailyLimit < 1 || dailyLimit > 100000) return res.status(400).json({ error: "invalid_daily_limit", message: "Daily limit must be between 1 and 100000." });

  const token = "goan_" + crypto.randomBytes(32).toString("hex");
  const result = db.prepare("INSERT INTO api_keys (name, token_hash, daily_limit) VALUES (?, ?, ?)").run(name, sha256(token), dailyLimit);
  res.status(201).json({
    success: true,
    message: "Key created. Copy it now — it will not be shown again.",
    key: { id: Number(result.lastInsertRowid), name, token, daily_limit: dailyLimit }
  });
});

router.post("/keys/:id/revoke", requireAdmin, (req, res) => {
  const result = db.prepare("UPDATE api_keys SET active = 0, revoked_at = datetime('now') WHERE id = ? AND active = 1").run(Number(req.params.id));
  if (!result.changes) return res.status(404).json({ error: "key_not_found_or_revoked", message: "This key does not exist or is already revoked." });
  res.json({ success: true, message: "Key revoked. It will be rejected immediately." });
});

module.exports = router;
