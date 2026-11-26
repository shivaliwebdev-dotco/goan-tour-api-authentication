require("dotenv").config();
const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const path = require("path");
const fs = require("fs");
const { db, initializeDatabase } = require("./src/database");
const { apiKeyAuth } = require("./src/middleware/apiKeyAuth");
const adminRoutes = require("./src/routes/admin");

const app = express();
const PORT = Number(process.env.PORT || 3000);

initializeDatabase();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(session({
  name: "goan-tour-admin",
  secret: process.env.SESSION_SECRET || "development-only-change-me",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", maxAge: 2 * 60 * 60 * 1000 }
}));
app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (_req, res) => res.json({ status: "ok", service: "Goan Tours Packages API" }));
app.use("/admin", adminRoutes);

const packages = [
  { id: "GT-101", name: "Old Goa Heritage Walk", region: "North Goa", duration: "4 hours", price_inr: 899, highlights: ["Basilica of Bom Jesus", "Se Cathedral", "Portuguese-era lanes"] },
  { id: "GT-102", name: "Dudhsagar Falls & Spice Plantation", region: "South Goa", duration: "Full day", price_inr: 2499, highlights: ["Dudhsagar viewpoint", "Spice plantation lunch", "Western Ghats"] },
  { id: "GT-103", name: "Fontainhas Latin Quarter Trail", region: "Panaji", duration: "2.5 hours", price_inr: 699, highlights: ["Colourful heritage homes", "Local art", "Goan café stop"] },
  { id: "GT-104", name: "Grand Island Boat Escape", region: "North Goa", duration: "Half day", price_inr: 1899, highlights: ["Boat ride", "Snorkelling (seasonal)", "Coastal views"] }
];

app.get("/api/v1/packages", apiKeyAuth, (req, res) => {
  res.json({
    success: true,
    count: packages.length,
    data: packages,
    meta: { request_id: req.requestId, remaining_today: Math.max(0, req.dailyLimit - req.dailyUsage) }
  });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "internal_server_error", message: "Something went wrong." });
});

if (require.main === module) {
  if (!process.env.ADMIN_PASSWORD) console.warn("WARNING: Set ADMIN_PASSWORD in .env before using the admin panel.");
  app.listen(PORT, () => console.log(`Goan Tours API running at http://localhost:${PORT}`));
}
module.exports = app;
