/**
 * 📚 자료실 — Firestore library/{docId} (목록 정보) + library/{docId}/body/main (본문) + Storage library/{docId}/ (이미지)
 * 권한은 firebase/firestore.rules · storage.rules 가 지킴. 여기서는 화면에 맞게 읽고 쓰기만.
 *
 * 공유 범위: private(🔒 나만 보기) → teachers(👩‍🏫 선생과 공유) → all(🌏 모두에게 공유)
 * 강사 · 관리자(똑같음): 만들기, 공유된 자료 수정 · 삭제 / 나만 보기: 작성자만 / 학생: 모두에게 공유된 자료 읽기만
 */
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { deleteObject, getDownloadURL, listAll, ref as storageRef, uploadBytes } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import { cloudFunctions, fileStorage, firestore } from "@/lib/firebase";
import type { Role } from "@/shared/protocol";

export type Visibility = "private" | "teachers" | "all";

export const VISIBILITY: Record<Visibility, { icon: string; label: string; desc: string }> = {
  private: { icon: "🔒", label: "나만 보기", desc: "나만 볼 수 있어요 (초안)" },
  teachers: { icon: "👩‍🏫", label: "선생과 공유", desc: "강사 · 관리자 아델리가 함께 보고 고칠 수 있어요" },
  all: { icon: "🌏", label: "모두에게 공유", desc: "학생 아델리도 읽을 수 있어요 (고치기는 강사 · 관리자)" },
};

export interface LibraryDoc {
  id: string;
  title: string;
  icon: string;
  visibility: Visibility;
  ownerId: string;
  ownerName: string;
  createdAt: number;
  updatedAt: number;
  updatedByName: string;
}

export interface Me {
  uid: string;
  name: string;
  role: Role;
}

export const isStaff = (role: Role) => role === "teacher" || role === "admin";

/** 규칙과 같은 기준: 고칠 수 있는가 */
export function canEdit(me: Me, d: Pick<LibraryDoc, "ownerId" | "visibility">) {
  return isStaff(me.role) && (d.ownerId === me.uid || d.visibility !== "private");
}

const ms = (v: unknown) => (v instanceof Timestamp ? v.toMillis() : Date.now()); // 방금 쓴 값은 서버 시각이 아직 없음

function toDoc(s: QueryDocumentSnapshot<DocumentData>): LibraryDoc {
  const d = s.data({ serverTimestamps: "estimate" });
  return {
    id: s.id,
    title: String(d.title ?? ""),
    icon: String(d.icon ?? "📄"),
    visibility: d.visibility as Visibility,
    ownerId: String(d.ownerId),
    ownerName: String(d.ownerName ?? ""),
    createdAt: ms(d.createdAt),
    updatedAt: ms(d.updatedAt),
    updatedByName: String(d.updatedByName ?? ""),
  };
}

/**
 * 내가 볼 수 있는 자료 목록을 지켜봄.
 * 규칙은 걸러 주지 않으므로(조건이 규칙을 만족하는 질의만 허용) 범위별로 나눠 질의하고 합침.
 */
export function watchLibrary(me: Me, cb: (docs: LibraryDoc[]) => void, onError: (e: Error) => void): () => void {
  const col = collection(firestore(), "library");
  const qs = [query(col, where("visibility", "==", "all"))];
  if (isStaff(me.role)) qs.push(query(col, where("visibility", "==", "teachers")), query(col, where("ownerId", "==", me.uid)));

  const parts: Map<string, LibraryDoc>[] = qs.map(() => new Map());
  const emit = () => {
    const all = new Map<string, LibraryDoc>();
    for (const p of parts) for (const [id, d] of p) all.set(id, d);
    cb([...all.values()].sort((a, b) => a.createdAt - b.createdAt));
  };
  const stops = qs.map((q, i) =>
    onSnapshot(
      q,
      (snap) => {
        parts[i] = new Map(snap.docs.map((s) => [s.id, toDoc(s)]));
        emit();
      },
      onError,
    ),
  );
  return () => stops.forEach((s) => s());
}

/** 본문을 지켜봄 (다른 사람이 고치면 읽는 사람 화면도 바뀜). null = 아직 본문 없음 */
export function watchBody(id: string, cb: (json: string | null, fromMe: boolean) => void, onError: (e: Error) => void): () => void {
  return onSnapshot(
    doc(firestore(), "library", id, "body", "main"),
    (s) => cb(s.exists() ? String(s.data().doc) : null, s.metadata.hasPendingWrites),
    onError,
  );
}

const EMPTY_BODY = JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] });

/** 새 자료 (나만 보기로 시작) — 목록 정보와 본문을 한 번에 만듦 */
export async function createLibraryDoc(me: Me): Promise<string> {
  const db = firestore();
  const ref = doc(collection(db, "library"));
  const b = writeBatch(db);
  b.set(ref, {
    title: "",
    icon: "📄",
    visibility: "private",
    ownerId: me.uid,
    ownerName: me.name,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: me.uid,
    updatedByName: me.name,
  });
  b.set(doc(db, "library", ref.id, "body", "main"), { doc: EMPTY_BODY });
  await b.commit();
  return ref.id;
}

const stamp = (me: Me) => ({ updatedAt: serverTimestamp(), updatedBy: me.uid, updatedByName: me.name });

/** 제목 · 아이콘 · 공유 범위 바꾸기 */
export async function updateLibraryMeta(me: Me, id: string, patch: Partial<Pick<LibraryDoc, "title" | "icon" | "visibility">>) {
  const b = writeBatch(firestore());
  b.update(doc(firestore(), "library", id), { ...patch, ...stamp(me) });
  await b.commit();
}

/** 본문 저장 (수정 시각도 같이 — 규칙이 확인) */
export async function saveLibraryBody(me: Me, id: string, json: string) {
  const db = firestore();
  const b = writeBatch(db);
  b.set(doc(db, "library", id, "body", "main"), { doc: json });
  b.update(doc(db, "library", id), stamp(me));
  await b.commit();
}

/** 자료 삭제 — 본문 · 목록 정보를 지우고 이미지 폴더도 비움 */
export async function deleteLibraryDoc(id: string) {
  const db = firestore();
  // 이미지는 자료가 남아 있어야 규칙(작성자 확인)을 통과하므로 먼저 지움
  try {
    const files = await listAll(storageRef(fileStorage(), `library/${id}`));
    await Promise.all(files.items.map((f) => deleteObject(f)));
  } catch (e) {
    console.warn("[library] 이미지 정리 실패 (자료는 지움)", e);
  }
  const b = writeBatch(db);
  b.delete(doc(db, "library", id, "body", "main"));
  b.delete(doc(db, "library", id));
  await b.commit();
}

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** 이미지 올리고 주소 받기 (10MB 미만, 이미지 파일만 — 규칙과 같음) */
export async function uploadLibraryImage(id: string, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("이미지 파일만 올릴 수 있어요");
  if (file.size >= MAX_IMAGE_BYTES) throw new Error("10MB보다 작은 이미지만 올릴 수 있어요");
  const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "png";
  const r = storageRef(fileStorage(), `library/${id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`);
  await uploadBytes(r, file, { contentType: file.type });
  return getDownloadURL(r);
}

export type RoleSync = "ok" | "missing" | "mismatch" | "error";

async function readRoleCopy(me: Me): Promise<RoleSync> {
  try {
    const s = await getDoc(doc(firestore(), "roles", me.uid));
    if (!s.exists()) return "missing";
    return s.data().role === me.role ? "ok" : "mismatch";
  } catch (e) {
    console.error("[library] 역할 사본 읽기 실패", e);
    return "error";
  }
}

/**
 * 내 역할 사본(Firestore roles/{uid})이 RTDB 역할과 맞는지 확인하고, 틀리면 서버 함수로 한 번 다시 맞춤.
 * (syncRole 배포 전에 지정된 강사 · 관리자, 콘솔에서 손으로 만든 사본이 틀린 경우)
 */
export async function ensureRoleSynced(me: Me): Promise<RoleSync> {
  if (!isStaff(me.role)) return "ok";
  const first = await readRoleCopy(me);
  if (first === "ok") return first;
  try {
    await httpsCallable(cloudFunctions(), "syncMyRole")();
  } catch (e) {
    console.error("[library] 역할 다시 맞추기 실패", e);
    return first;
  }
  return readRoleCopy(me);
}
