export default {
  async fetch(req) {
    const u = new URL(req.url);
    const t = u.searchParams.get("url");
    if (!t) return new Response("missing url", { status: 400 });
    const target = new URL(t);
    const r = await fetch(target.href, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Origin": u.origin,
        "Referer": "https://rg2tvpro.blogspot.com/"
      }
    });
    const ct = r.headers.get("content-type") || "";
    let body = await r.text();
    if (ct.includes("application/vnd.apple.mpegurl") || target.pathname.endsWith(".m3u8")) {
      const base = target;
      const lines = body.split(/\r?\n/).map(line => {
        const s = line.trim();
        if (!s || s.startsWith("#")) return line;
        try {
          const abs = new URL(s, base).href;
          const prox = `${u.origin}${u.pathname}?url=${encodeURIComponent(abs)}`;
          return prox;
        } catch {
          return line;
        }
      });
      body = lines.join("\n");
    }
    const h = new Headers(r.headers);
    h.set("Access-Control-Allow-Origin", "*");
    h.set("Cache-Control", "no-cache, no-store, must-revalidate");
    if (target.pathname.endsWith(".m3u8")) {
      h.set("content-type", "application/vnd.apple.mpegurl");
    }
    return new Response(body, { status: r.status, headers: h });
  }
}
