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
var vjsPlayer;

const WORKER_PREFIX = "https://listaiptv38.rafael2019rg.workers.dev/";
const PROXY_PREFIX = "https://cors.isomorphic-git.org/";

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
  const u = normalizeUrl(url);
  if(WORKER_PREFIX){
    const w = WORKER_PREFIX.endsWith("/") ? WORKER_PREFIX : (WORKER_PREFIX + "/");
    return w + "?url=" + encodeURIComponent(u);
  }
  const p = PROXY_PREFIX.endsWith("/") ? PROXY_PREFIX : (PROXY_PREFIX + "/");
  if(/^https?:\/\//i.test(u)) return p + u;
  return u;
}

function resetVideo(video){
  try{
    video.pause();
  }catch(e){}
  video.removeAttribute("src");
  video.load();
}

function playNative(video, url, mime){
  resetVideo(video);
  video.src = url;
  if(mime){
    try{ video.type = mime; }catch(e){}
  }
  video.play().catch(()=>{});
}

function playWithVideoJS(video, url){
  if(typeof window.videojs !== "function") return false;
  try{
    if(vjsPlayer){
      vjsPlayer.src({ src: url, type: "application/x-mpegURL" });
      vjsPlayer.play();
    } else {
      vjsPlayer = window.videojs(video, { liveui: true });
      vjsPlayer.src({ src: url, type: "application/x-mpegURL" });
      vjsPlayer.play();
    }
    return true;
  }catch(e){
    return false;
  }
}

function playHLS(video, url, proxied){
  if(hls){
    hls.destroy();
  }
  if(playWithVideoJS(video, url)) return;
  if(Hls.isSupported()){
    hls = new Hls({
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
  link = normalizeUrl(link);

  // Se já existir player anterior, destruir
  if(hls){
    hls.destroy();
  }

  if(isM3U(link)){
    fetch(link)
      .then(r=>r.text())
      .then(txt=>{
        const entries = parseM3U(txt);
        if(entries.length === 0){
          alert("Playlist M3U vazia");
          return;
        }
        const raw = entries[0];
        const first = normalizeUrl(resolveUrl(link, raw));
        if(isHLS(first)){
          playHLS(video, first, false);
        } else {
          playNative(video, first);
        }
      })
      .catch(()=>{
        fetch(withProxy(link))
          .then(r=>r.text())
          .then(txt=>{
            const entries = parseM3U(txt);
            if(entries.length === 0){
              alert("Playlist M3U vazia");
              return;
            }
            const raw = entries[0];
            const first = normalizeUrl(resolveUrl(link, raw));
            if(isHLS(first)){
              playHLS(video, withProxy(first), true);
            } else {
              playNative(video, first);
            }
          })
          .catch(()=>{
            alert("Não foi possível abrir a playlist .m3u");
          });
      });
    return;
  }

  if(isHLS(link)){
    playHLS(video, link, false);
  } else {
    playNative(video, link, "video/mp2t");
  }
}
