// 구글 로그인 + Firestore로 폰·컴퓨터 기록 자동 동기화.
// 로그인 안 하면 예전처럼 이 기기에만 저장돼요.
import { firebaseConfig } from './firebase-config.js';

const FB = 'https://www.gstatic.com/firebasejs/10.12.2/';
const acct = document.getElementById('acct');
const SYNCED = 'gagyebu.syncedUid'; // 이 기기의 기존 기록을 이미 올린 계정

function render(html) { acct.innerHTML = html; }

if (!firebaseConfig.apiKey) {
  render('<div class="acct-msg">아직 연결 설정이 안 됐어요.</div>');
} else {
  start().catch(e => {
    console.error(e);
    render('<div class="acct-msg">연결 기능을 불러오지 못했어요. 인터넷 연결을 확인해 주세요.</div>');
  });
}

async function start() {
  const [{ initializeApp }, A, F] = await Promise.all([
    import(FB + 'firebase-app.js'),
    import(FB + 'firebase-auth.js'),
    import(FB + 'firebase-firestore.js'),
  ]);
  const app = initializeApp(firebaseConfig);
  const auth = A.getAuth(app);
  const db = F.initializeFirestore(app, {
    localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }),
  });
  let unsub = null;

  A.getRedirectResult(auth).catch(e => console.error(e));

  async function login() {
    const provider = new A.GoogleAuthProvider();
    try {
      await A.signInWithPopup(auth, provider);
    } catch (e) {
      if (['auth/popup-blocked', 'auth/operation-not-supported-in-environment'].includes(e.code)) {
        return A.signInWithRedirect(auth, provider);
      }
      if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
        console.error(e);
        window.toast('로그인 실패: ' + e.code);
      }
    }
  }

  A.onAuthStateChanged(auth, user => {
    if (unsub) { unsub(); unsub = null; }
    if (!user) {
      window.cloud = null;
      render(`<div class="acct-msg">구글로 로그인하면 폰과 컴퓨터에서 <b>같은 기록</b>을 볼 수 있어요.
        기록이 구글 서버에도 저장돼서 폰을 바꿔도 안전해요.</div>
        <button id="loginBtn">🔐 구글로 로그인</button>`);
      document.getElementById('loginBtn').onclick = login;
      return;
    }

    const col = F.collection(db, 'users', user.uid, 'items');
    const put = xs => {
      for (let i = 0; i < xs.length; i += 400) {
        const b = F.writeBatch(db);
        xs.slice(i, i + 400).forEach(x => b.set(F.doc(col, x.id), x));
        b.commit().catch(e => { console.error(e); window.toast('클라우드 저장 실패'); });
      }
    };
    window.cloud = { put, del: id => F.deleteDoc(F.doc(col, id)).catch(e => console.error(e)) };

    // 이 계정으로 처음 로그인한 기기면, 그동안 이 기기에 적은 기록을 올려서 합침
    let first = false;
    try { first = localStorage.getItem(SYNCED) !== user.uid; } catch {}
    if (first) {
      put(window.localItems());
      try { localStorage.setItem(SYNCED, user.uid); } catch {}
    }

    unsub = F.onSnapshot(col, snap => window.applyCloud(snap.docs.map(d => d.data())),
      e => { console.error(e); window.toast('동기화 오류: ' + e.code); });

    render(`<div class="acct-msg">✅ <b>${user.email}</b> 로 연결됨<br>
      다른 기기에서도 같은 구글 계정으로 로그인하면 자동으로 맞춰져요.</div>
      <button id="logoutBtn">로그아웃</button>`);
    document.getElementById('logoutBtn').onclick = () => {
      if (confirm('로그아웃할까요? 이 기기의 기록은 그대로 남아요.')) A.signOut(auth);
    };
  });
}
