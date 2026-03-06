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

function assistir(link){
  var video = document.getElementById("video");

  // Se já existir player anterior, destruir
  if(hls){
    hls.destroy();
  }

  if(Hls.isSupported()){
    hls = new Hls({
      maxBufferLength: 10,        // menor buffer = inicia mais rápido
      maxMaxBufferLength: 20,
      startLevel: -1,
      liveSyncDurationCount: 3    // mais rápido em canais ao vivo
    });

    hls.loadSource(link);
    hls.attachMedia(video);

    hls.on(Hls.Events.MANIFEST_PARSED, function() {
      video.play();
    });

  } else {
    video.src = link;
    video.play();
  }
}
