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

function withProxy(url){
  if(!PROXY_PREFIX) return url;
  const u = normalizeUrl(url);
  if(u.startsWith(PROXY_PREFIX)) return u;
  const prefix = PROXY_PREFIX.endsWith("/") ? PROXY_PREFIX : (PROXY_PREFIX + "/");
  if(/^https?:\/\//i.test(u)) return prefix + u;
  return u;
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

function playHLS(video, url, proxied){
  if(hls){
    hls.destroy();
  }
  if(Hls.isSupported()){
    hls = new Hls({
      enableWorker: true,
      lowLatencyMode: true,
      maxBufferLength: 10,
      maxMaxBufferLength: 20,
      startLevel: -1,
      liveSyncDurationCount: 3
    });
    hls.loadSource(url);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, function(){
      video.play().catch(()=>{});
    });
    hls.on(Hls.Events.ERROR, function(_, data){
      if(!data) return;
      if(data.fatal){
        if(data.type === Hls.ErrorTypes.NETWORK_ERROR){
          alert("Erro de rede ao carregar HLS. O servidor pode bloquear CORS/Referer.");
          if(!proxied){
            hls.destroy();
            playHLS(video, withProxy(url), true);
            return;
          }
          hls.startLoad();
        } else if(data.type === Hls.ErrorTypes.MEDIA_ERROR){
          hls.recoverMediaError();
        } else {
          hls.destroy();
          playNative(video, url, "application/vnd.apple.mpegurl");
        }
      }
    });
  } else {
    playNative(video, url, "application/vnd.apple.mpegurl");
  }
}

function assistir(link){
  var video = document.getElementById("video");
  video.setAttribute("playsinline","true");
  video.setAttribute("webkit-playsinline","true");
  video.crossOrigin = "anonymous";
  link = normalizeUrl(link);

  // Se já existir player anterior, destruir
  if(hls){
    hls.destroy();
  }

  if(isM3U(link)){
    const hostM3U = getHost(link);
    const m3uUrl = BLOCKED_HOSTS.indexOf(hostM3U) !== -1 ? withProxy(link) : link;
    fetch(m3uUrl)
      .then(r=>r.text())
      .then(txt=>{
        const entries = parseM3U(txt);
        if(entries.length === 0){
          alert("Playlist M3U vazia");
          return;
        }
        const first = normalizeUrl(resolveUrl(link, entries[0]));
        if(isHLS(first)){
          const host = getHost(first);
          if(BLOCKED_HOSTS.indexOf(host) !== -1){
            playHLS(video, withProxy(first), true);
          } else {
            playHLS(video, first, false);
          }
        } else {
          playNative(video, first);
        }
      })
      .catch(err=>{
        console.error("Erro ao carregar M3U:", err);
        alert("Não foi possível abrir a playlist .m3u");
      });
    return;
  }

  if(isHLS(link)){
    const host = getHost(link);
    if(BLOCKED_HOSTS.indexOf(host) !== -1){
      playHLS(video, withProxy(link), true);
    } else {
      playHLS(video, link, false);
    }
  } else {
    playNative(video, link, undefined);
  }
}
