/**
 * Firebase 클라이언트 초기화 (브라우저 전용).
 * 값은 .env.local 의 NEXT_PUBLIC_FIREBASE_* 에서 빌드 시 주입됩니다.
 * (Next.js는 process.env.NEXT_PUBLIC_X 를 "정적으로" 쓴 경우에만 치환하므로 하나씩 적습니다.)
 *
 * NEXT_PUBLIC_FIREBASE_EMULATORS=1 이면 로컬 에뮬레이터(npm run dev 가 함께 띄움)에 연결합니다.
 */
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import { connectDatabaseEmulator, getDatabase, type Database } from "firebase/database";

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || undefined,
};

export const USE_EMULATORS = process.env.NEXT_PUBLIC_FIREBASE_EMULATORS === "1";

let auth: Auth | undefined;
let db: Database | undefined;

/** HMR·중복 import 시에도 앱을 한 번만 만듭니다. */
export function firebaseApp(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

export function firebaseAuth(): Auth {
  if (!auth) {
    auth = getAuth(firebaseApp());
    if (USE_EMULATORS) connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  }
  return auth;
}

/** Realtime Database — 계정 프로필·접속·위치·자리·출석 */
export function rtdb(): Database {
  if (!db) {
    if (USE_EMULATORS) {
      // 에뮬레이터는 URL의 네임스페이스(<프로젝트>-default-rtdb)만 쓰고 주소는 아래에서 바꿉니다.
      db = getDatabase(firebaseApp(), `https://${projectId}-default-rtdb.firebaseio.com`);
      connectDatabaseEmulator(db, "127.0.0.1", 9000);
    } else {
      db = getDatabase(firebaseApp());
    }
  }
  return db;
}
