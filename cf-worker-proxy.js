export default {
  async fetch(req) {
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,OPTIONS",
          "Access-Control-Allow-Headers": "*"
        }
      });
    }
    const u = new URL(req.url);
    const t = u.searchParams.get("url");
    if (!t) return new Response("missing url", { status: 400 });
    const tClean = t.replace(/%09/gi, "/").replace(/\s+/g, "");
    let target;
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,OPTIONS",
      "Access-Control-Allow-Headers": "*",
      "Cache-Control": "no-cache, no-store, must-revalidate"
    };
    try{
      target = new URL(tClean);
    }catch(e){
      const m = tClean.match(/^(https?:\/\/)([^\/]+)(.*)$/i);
      if(m){
        const rest = m[3] || "";
        const fixed = m[1] + m[2] + (rest.startsWith("/") ? rest : ("/" + rest));
        try{
          target = new URL(fixed);
        }catch(e2){
          return new Response("bad url", { status: 400, headers: cors });
        }
      }else{
        return new Response("bad url", { status: 400, headers: cors });
      }
    }
    const referer = u.searchParams.get("referer") || "https://rg2tvpro.blogspot.com/";
    const ua = u.searchParams.get("ua") || "Mozilla/5.0";
    const cookie = u.searchParams.get("cookie") || "";
    const r = await fetch(target.href, {
      headers: {
        "User-Agent": ua,
        "Referer": referer,
        "Cookie": cookie
      }
    });
    const ct = r.headers.get("content-type") || "";
    if (ct.includes("application/vnd.apple.mpegurl") || target.pathname.endsWith(".m3u8")) {
      let body = await r.text();
      const base = target;
      const lines = body.split(/\r?\n/).map(line => {
        const s = line.trim();
        if (!s || s.startsWith("#")) return line;
        try {
          const abs = new URL(s, base).href;
          const next = new URL(u.origin + u.pathname);
          next.searchParams.set("url", abs);
          next.searchParams.set("referer", referer);
          next.searchParams.set("ua", ua);
          if (cookie) next.searchParams.set("cookie", cookie);
          const prox = next.href;
          return prox;
        } catch {
          return line;
        }
      });
      body = lines.join("\n");
      const h = new Headers(r.headers);
      h.set("Access-Control-Allow-Origin", "*");
      h.set("Access-Control-Allow-Methods", "GET,OPTIONS");
      h.set("Access-Control-Allow-Headers", "*");
      h.set("Cache-Control", "no-cache, no-store, must-revalidate");
      h.set("content-type", "application/vnd.apple.mpegurl");
      return new Response(body, { status: r.status, headers: h });
    }
    const h = new Headers(r.headers);
    h.set("Access-Control-Allow-Origin", "*");
    h.set("Access-Control-Allow-Methods", "GET,OPTIONS");
    h.set("Access-Control-Allow-Headers", "*");
    h.set("Cache-Control", "no-cache, no-store, must-revalidate");
    return new Response(r.body, { status: r.status, headers: h });
  }
}
