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

function resetVideo(video){
  try{
    video.pause();
  }catch(e){}
  video.removeAttribute("src");
  video.load();
}

function playNative(video, url){
  resetVideo(video);
  video.src = url;
  video.play().catch(()=>{});
}

function playHLS(video, url){
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
          hls.startLoad();
        } else if(data.type === Hls.ErrorTypes.MEDIA_ERROR){
          hls.recoverMediaError();
        } else {
          hls.destroy();
          playNative(video, url);
        }
      }
    });
  } else {
    playNative(video, url);
  }
}

function assistir(link){
  var video = document.getElementById("video");
  video.setAttribute("playsinline","true");
  video.setAttribute("webkit-playsinline","true");
  video.crossOrigin = "anonymous";

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
        const first = entries[0];
        if(isHLS(first)){
          playHLS(video, first);
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
    playHLS(video, link);
  } else {
    playNative(video, link);
  }
}
