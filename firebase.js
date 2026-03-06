const firebaseConfig = { 
  apiKey: "AIzaSyCI8ArQt-1KgPjue7hROhGIKa-m8cF90a4", 
  authDomain: "rg2-tv-pro.firebaseapp.com", 
  databaseURL: "https://rg2-tv-pro-default-rtdb.firebaseio.com", 
  projectId: "rg2-tv-pro", 
  storageBucket: "rg2-tv-pro.firebasestorage.app", 
  messagingSenderId: "265320226498", 
  appId: "1:265320226498:web:bfc8b9a719f5ae17c0e55b", 
  measurementId: "G-C2SMB1CDZ8" 
};

firebase.initializeApp(firebaseConfig);

var auth = firebase.auth();
var db = firebase.firestore();

function login(){
  var provider = new firebase.auth.GoogleAuthProvider();
  
  // Se o popup (signInWithPopup) continuar dando erro de COOP, 
  // você pode trocar por signInWithRedirect(provider) abaixo:
  auth.signInWithPopup(provider).catch(function(error) {
    console.error("Erro no login:", error);
    if(error.code === 'auth/popup-blocked') {
      alert("O seu navegador bloqueou o popup. Por favor, libere os popups para este site.");
    } else {
      alert("Erro ao fazer login: " + error.message);
    }
  });
}

auth.onAuthStateChanged(function(user){
  if(user){
    document.getElementById("loginArea").style.display="none";
    document.getElementById("app").style.display="block";
  }
});

function carregar(cat){
  var lista = document.getElementById("lista");
  lista.innerHTML="";

  db.collection("canais")
  .where("categoria","==",cat)
  .get()
  .then((snapshot) => {
    if (snapshot.empty) {
      console.log("Nenhum canal encontrado para a categoria:", cat);
      lista.innerHTML = "<p>Nenhum canal encontrado.</p>";
      return;
    }

    snapshot.forEach((doc) => {
      const c = doc.data();
      lista.innerHTML += `
      <div class="canal" onclick="assistir('${c.link}')">
        ${c.nome}
      </div>`;
    });
  })
  .catch((error) => {
    console.error("Erro ao carregar canais:", error);
    lista.innerHTML = "<p>Erro ao carregar canais. Verifique o console.</p>";
  });
}

var hls;

const PROXY_PREFIX = "https://listaiptv38.rafael2019rg.workers.dev/";
const PROXIES = [
  { base: PROXY_PREFIX, mode: "path" },
  { base: "https://cors.isomorphic-git.org/", mode: "path" },
  { base: PROXY_PREFIX, mode: "query" }
];
const BLOCKED_HOSTS = ["cdn.jmvstream.com","jmvstream.com"];

function normalizeUrl(url){
  let u = String(url || "").trim();
  u = u.replace(/\\/g, "/");
  u = u.replace(/^https:\/*/i, "https://");
  u = u.replace(/^http:\/*/i, "http://");
  return u;
}

function isM3U(url){
  return /\.m3u($|\?)/i.test(url);
}

function isHLS(url){
  return /\.m3u8($|\?)/i.test(url);
}

function getHost(url){
  try{
    return new URL(url).host.toLowerCase();
  }catch(e){
    return "";
  }
}

function parseM3U(text){
  const lines = text.split(/\r?\n/);
  const urls = [];
  for(let i=0;i<lines.length;i++){
    const line = lines[i].trim();
    if(!line || line.startsWith("#")) continue;
    urls.push(line);
  }
  return urls;
}

function resolveUrl(base, ref){
  try{
    return new URL(ref, base).href;
  }catch(e){
    return ref;
  }
}

function buildProxyUrl(base, mode, target){
  const t = normalizeUrl(target);
  let b = base || "";
  b = b.endsWith("/") ? b : (b + "/");
  if(mode === "query"){
    const sep = b.includes("?") ? "&" : "?";
    return b + sep + "url=" + encodeURIComponent(t);
  }
  return b + t;
}

function proxyCandidates(target){
  const t = normalizeUrl(target);
  const result = [t];
  for(const p of PROXIES){
    result.push(buildProxyUrl(p.base, p.mode, t));
  }
  return result;
}

function extractIframeSrc(input){
  const s = String(input || "");
  if(s.toLowerCase().includes("<iframe")){
    const m = s.match(/src\s*=\s*["'`]\s*([^"'`]+)\s*["'`]/i);
    if(m && m[1]) return normalizeUrl(m[1]);
  }
  return normalizeUrl(s);
}

function resetVideo(video){
  try{
    video.pause();
  }catch(e){}
  video.removeAttribute("src");
  var src = document.getElementById("videoSource");
  if(src){
    src.removeAttribute("src");
    src.removeAttribute("type");
  }
  video.load();
}

function showVideo(){
  var v = document.getElementById("video");
  var f = document.getElementById("framePlayer");
  if(f){
    f.removeAttribute("src");
    f.style.display = "none";
  }
  if(v){
    v.style.display = "block";
  }
}

function showIframe(url){
  var v = document.getElementById("video");
  var f = document.getElementById("framePlayer");
  if(hls){
    hls.destroy();
  }
  if(v){
    try{ v.pause(); }catch(e){}
    v.style.display = "none";
  }
  if(f){
    f.src = url;
    f.style.display = "block";
  }
}

function playNative(video, url, mime){
  resetVideo(video);
  var src = document.getElementById("videoSource");
  if(src){
    src.setAttribute("src", url);
    if(mime){
      src.setAttribute("type", mime);
    } else {
      src.removeAttribute("type");
    }
    video.load();
  } else {
    video.src = url;
  }
  video.play().catch(()=>{});
}

function startHLSWithCandidates(video, urls){
  if(hls){
    hls.destroy();
  }
  if(!Hls.isSupported()){
    playNative(video, urls[0], "application/vnd.apple.mpegurl");
    return;
  }
  let idx = 0;
  const tryUrl = (u) => {
    if(hls) hls.destroy();
    const instance = new Hls({
      enableWorker: true,
      lowLatencyMode: true,
      maxBufferLength: 10,
      maxMaxBufferLength: 20,
      startLevel: -1,
      liveSyncDurationCount: 3
    });
    hls = instance;
    instance.loadSource(u);
    instance.attachMedia(video);
    instance.on(Hls.Events.MANIFEST_PARSED, function(){
      video.play().catch(()=>{});
    });
    instance.on(Hls.Events.ERROR, function(_, data){
      if(!data) return;
      if(data.fatal){
        if(data.type === Hls.ErrorTypes.NETWORK_ERROR){
          alert("Erro de rede ao carregar HLS. O servidor pode bloquear CORS/Referer.");
          idx++;
          if(idx < urls.length){
            instance.destroy();
            tryUrl(urls[idx]);
            return;
          }
          instance.startLoad();
        } else if(data.type === Hls.ErrorTypes.MEDIA_ERROR){
          instance.recoverMediaError();
        } else {
          instance.destroy();
          playNative(video, u, "application/vnd.apple.mpegurl");
        }
      }
    });
  };
  tryUrl(urls[0]);
}

function assistir(link){
  var video = document.getElementById("video");
  video.setAttribute("playsinline","true");
  video.setAttribute("webkit-playsinline","true");
  video.crossOrigin = "anonymous";
  link = extractIframeSrc(link);

  // Se já existir player anterior, destruir
  if(hls){
    hls.destroy();
  }

  if(!link){
    alert("Link inválido");
    return;
  }

  if(!isM3U(link) && !isHLS(link) && /^https?:\/\//i.test(link)){
    showIframe(link);
    return;
  }

  if(isM3U(link)){
    showVideo();
    const candidatesM3U = proxyCandidates(link);
    let fetched = false;
    const tryFetchSeq = (i) => {
      if(fetched || i >= candidatesM3U.length){
        alert("Não foi possível abrir a playlist .m3u");
        return;
      }
      fetch(candidatesM3U[i])
      .then(r=>r.text())
      .then(txt=>{
        fetched = true;
        const entries = parseM3U(txt);
        if(entries.length === 0){
          alert("Playlist M3U vazia");
          return;
        }
        const first = normalizeUrl(resolveUrl(link, entries[0]));
        if(isHLS(first)){
          const urls = proxyCandidates(first);
          startHLSWithCandidates(video, urls);
        } else {
          playNative(video, first);
        }
      })
      .catch(err=>{
        console.error("Erro ao carregar M3U:", err);
        tryFetchSeq(i+1);
      });
    };
    tryFetchSeq(0);
    return;
  }

  if(isHLS(link)){
    showVideo();
    const urls = proxyCandidates(link);
    startHLSWithCandidates(video, urls);
  } else {
    showIframe(link);
    return;
    playNative(video, link, undefined);
  }
}
