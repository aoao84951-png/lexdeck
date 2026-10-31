import "server-only";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

export function database() {
  const existing = getApps().find(app => app.name === "gonglog");
  const credentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!credentials) throw new Error("Firebase 서버 인증 정보가 없습니다.");
  const app = existing ?? initializeApp({ credential: cert(JSON.parse(credentials)) }, "gonglog");
  return getFirestore(app);
}
