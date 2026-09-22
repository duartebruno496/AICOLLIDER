/**
 * Relay OAuth GitHub (Device Flow) para o AICOLLIDER.
 *
 * O GitHub bloqueia chamadas diretas do navegador aos endpoints de OAuth
 * (sem CORS). Este worker apenas REPASSA as duas chamadas e devolve com
 * CORS aberto. Nenhum segredo é armazenado aqui — o Device Flow do GitHub
 * não exige client_secret.
 *
 * Deploy: Cloudflare Workers (plano gratuito) -> esse arquivo.
 * Depois defina VITE_GITHUB_DEVICE_RELAY como a URL do worker.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Accept",
    };

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return new Response("Método não suportado", { status: 405, headers: cors });

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "invalid_request", error_description: "Corpo JSON inválido." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...cors },
      });
    }

    const gh = url.pathname === "/device/code" ? "https://github.com/login/device/code" : "https://github.com/login/oauth/access_token";

    // Exige client_id presente (nunca repassa client_secret adicional vindo do body).
    if (!body?.client_id) {
      return new Response(JSON.stringify({ error: "invalid_request", error_description: "client_id ausente." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...cors },
      });
    }

    const params = new URLSearchParams();
    Object.entries(body).forEach(([k, v]) => {
      if (typeof v === "string" && k !== "client_secret") params.append(k, v);
    });

    try {
      const res = await fetch(gh, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });
      const data = await res.json().catch(() => ({}));
      return new Response(JSON.stringify(data), {
        status: res.status,
        headers: { "Content-Type": "application/json", ...cors },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: "server_error", error_description: String(e) }), {
        status: 502,
        headers: { "Content-Type": "application/json", ...cors },
      });
    }
  },
};