const $ = (id) => document.getElementById(id);
const toast = (message) => { $("toast").textContent = message; $("toast").classList.add("show"); setTimeout(() => $("toast").classList.remove("show"), 2600); };
async function api(url, options = {}) {
  const response = await fetch(url, { credentials: "same-origin", headers: { "Content-Type": "application/json", ...(options.headers || {}) }, ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.error || `Request failed (${response.status})`);
  return data;
}
function showDashboard(isLoggedIn) { $("loginPanel").hidden = isLoggedIn; $("dashboard").hidden = !isLoggedIn; if (isLoggedIn) loadKeys(); }
async function checkSession() { try { const result = await api("/admin/session"); showDashboard(result.authenticated); } catch { showDashboard(false); } }
async function loadKeys() {
  try {
    const result = await api("/admin/keys");
    const keys = result.data;
    $("keyTotal").textContent = keys.length;
    $("activeCount").textContent = keys.filter(k => k.active).length;
    $("requestCount").textContent = keys.reduce((sum, k) => sum + k.usage_count, 0);
    $("keysList").innerHTML = keys.length ? keys.map(key => `
      <article class="key-row">
        <div><div class="key-title">${escapeHtml(key.name)}</div><div class="key-meta">KEY #${key.id} · Created ${new Date(key.created_at + "Z").toLocaleDateString()}</div><div class="key-meta"><span class="status ${key.active ? "" : "revoked"}"><i></i>${key.active ? "ACTIVE" : "REVOKED"}</span></div></div>
        <div class="key-metric"><span>ALL-TIME CALLS</span><b>${key.usage_count}</b></div>
        <div class="key-metric"><span>TODAY / DAILY LIMIT</span><b>${key.usage_today} / ${key.daily_limit}</b></div>
        <button class="revoke-btn" data-revoke="${key.id}" ${key.active ? "" : "disabled"}>${key.active ? "Revoke key" : "Revoked"}</button>
      </article>`).join("") : '<p class="empty">No keys yet. Create your first partner credential above.</p>';
  } catch (error) { toast(error.message); }
}
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c])); }
$("loginForm").addEventListener("submit", async e => {
  e.preventDefault(); $("loginMessage").textContent = "";
  try { await api("/admin/login", { method: "POST", body: JSON.stringify({ password: $("adminPassword").value }) }); $("adminPassword").value = ""; showDashboard(true); toast("Welcome to the control room."); }
  catch (error) { $("loginMessage").textContent = error.message; }
});
$("createForm").addEventListener("submit", async e => {
  e.preventDefault();
  try {
    const result = await api("/admin/keys", { method: "POST", body: JSON.stringify({ name: $("keyName").value, daily_limit: Number($("dailyLimit").value) }) });
    $("newKeyValue").textContent = result.key.token; $("newKeyPanel").hidden = false; $("keyName").value = ""; await loadKeys(); toast("API key generated. Copy it now.");
    $("newKeyPanel").scrollIntoView({ behavior: "smooth", block: "center" });
  } catch (error) { toast(error.message); }
});
$("keysList").addEventListener("click", async e => {
  const button = e.target.closest("[data-revoke]"); if (!button) return;
  if (!confirm("Revoke this key now? Connected applications will lose access immediately.")) return;
  try { await api(`/admin/keys/${button.dataset.revoke}/revoke`, { method: "POST", body: "{}" }); await loadKeys(); toast("Key revoked successfully."); }
  catch (error) { toast(error.message); }
});
$("copyKey").addEventListener("click", async () => { await navigator.clipboard.writeText($("newKeyValue").textContent); toast("API key copied to clipboard."); });
$("refreshBtn").addEventListener("click", loadKeys);
$("logoutBtn").addEventListener("click", async () => { await api("/admin/logout", { method: "POST", body: "{}" }); showDashboard(false); toast("Signed out."); });
$("copyCurl").addEventListener("click", async () => { await navigator.clipboard.writeText("curl http://localhost:3000/api/v1/packages -H 'X-API-Key: YOUR_API_KEY'"); toast("Example command copied."); });
checkSession();