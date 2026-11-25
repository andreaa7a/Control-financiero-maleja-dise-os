import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  setDoc,
  deleteDoc,
  doc,
  getDocFromServer,
  writeBatch,
} from 'firebase/firestore';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);
export const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function buildFirestoreErrorInfo(
  error: unknown,
  operationType: OperationType,
  path: string | null
): FirestoreErrorInfo {
  return {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo = buildFirestoreErrorInfo(error, operationType, path);
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function loginWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export async function loginWithEmail(email: string, pass: string) {
  return signInWithEmailAndPassword(auth, email, pass);
}

export async function registerWithEmail(email: string, pass: string) {
  const credential = await createUserWithEmailAndPassword(auth, email, pass);
  try {
    await sendEmailVerification(credential.user);
  } catch (err) {
    console.warn('No se pudo enviar verificación automática:', err);
  }
  return credential;
}

export async function sendUserEmailVerification() {
  if (!auth.currentUser) {
    throw new Error('No hay sesión activa.');
  }
  await sendEmailVerification(auth.currentUser);
}

export async function reloadCurrentUser(): Promise<User | null> {
  if (!auth.currentUser) return null;
  await auth.currentUser.reload();
  return auth.currentUser;
}

export async function getCurrentIdToken(forceRefresh = false): Promise<string | null> {
  if (!auth.currentUser) return null;
  return auth.currentUser.getIdToken(forceRefresh);
}

export async function resetPassword(email: string) {
  return sendPasswordResetEmail(auth, email);
}

export async function logoutUser() {
  return signOut(auth);
}

export { onAuthStateChanged };
export type { User };

export function formatFirebaseAuthError(error: any): string {
  const code = error?.code || '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Correo o contraseña incorrectos. Verifique sus credenciales.';
    case 'auth/email-already-in-use':
      return 'Ya existe una cuenta registrada con este correo electrónico.';
    case 'auth/weak-password':
      return 'La contraseña debe tener al menos 6 caracteres.';
    case 'auth/invalid-email':
      return 'El formato del correo electrónico no es válido.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos fallidos. Por seguridad, espere unos minutos antes de reintentar.';
    case 'auth/popup-closed-by-user':
      return 'El inicio de sesión con Google fue cancelado.';
    case 'auth/network-request-failed':
      return 'Error de conexión a internet. Verifique su red e intente nuevamente.';
    default:
      return error?.message || 'Error de autenticación. Intente nuevamente.';
  }
}

export function formatFirestoreErrorMessage(error: unknown): string {
  const code = (error as any)?.code || '';
  const msg = error instanceof Error ? error.message : String(error);
  if (code === 'permission-denied' || msg.includes('Missing or insufficient permissions')) {
    return 'Permiso denegado en la base de datos. Verifique que su correo esté verificado y autorizado.';
  }
  if (code === 'unauthenticated') {
    return 'Su sesión expiró. Vuelva a iniciar sesión.';
  }
  if (code === 'unavailable' || msg.includes('offline') || msg.includes('network')) {
    return 'Sin conexión con el servidor de base de datos. Verifique su internet e intente de nuevo.';
  }
  if (code === 'invalid-argument') {
    return 'Los datos ingresados exceden los límites permitidos o tienen un formato inválido.';
  }
  return 'No se pudo guardar la operación en la base de datos. Intente nuevamente.';
}

function isValidFirestoreId(id: string): boolean {
  return typeof id === 'string' && id.length >= 1 && id.length <= 50 && /^[a-zA-Z0-9_-]+$/.test(id);
}

export type CloudConnectionStatus = 'ok' | 'permission-denied' | 'offline';

export async function checkFirestoreStatus(): Promise<CloudConnectionStatus> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return 'ok';
  } catch (error: any) {
    const code = error?.code || '';
    const msg = error instanceof Error ? error.message : String(error);
    if (
      code === 'permission-denied' ||
      code === 'unauthenticated' ||
      msg.includes('Missing or insufficient permissions')
    ) {
      console.warn('Firestore authorization check denied:', msg);
      return 'permission-denied';
    }
    console.warn('Firestore connection notice:', msg);
    return 'offline';
  }
}

export async function testFirestoreConnection(): Promise<boolean> {
  const status = await checkFirestoreStatus();
  return status === 'ok';
}

export async function fetchCollectionData<T>(collectionName: string): Promise<T[] | null> {
  try {
    const colRef = collection(db, collectionName);
    const snapshot = await getDocs(colRef);
    const items: T[] = [];
    snapshot.forEach((d) => {
      items.push({ id: d.id, ...d.data() } as T);
    });
    return items;
  } catch (error) {
    console.error(`Error fetching ${collectionName}:`, JSON.stringify(buildFirestoreErrorInfo(error, OperationType.LIST, collectionName)));
    return null;
  }
}

export interface PersistenceResult {
  ok: boolean;
  error?: string;
  code?: string;
}

export async function saveDocumentStrict(
  collectionName: string,
  id: string,
  data: any,
  options: { merge?: boolean } = { merge: false }
): Promise<PersistenceResult> {
  if (!isValidFirestoreId(id)) {
    return {
      ok: false,
      error: `Identificador inválido para ${collectionName}: ${id}`,
      code: 'invalid-id',
    };
  }
  try {
    const docRef = doc(db, collectionName, id);
    const cleanData = sanitizeForFirestore(data);
    if (options.merge) {
      await setDoc(docRef, cleanData, { merge: true });
    } else {
      await setDoc(docRef, cleanData);
    }
    return { ok: true };
  } catch (error: any) {
    console.error(
      `Error saving to ${collectionName}/${id}:`,
      JSON.stringify(buildFirestoreErrorInfo(error, OperationType.WRITE, `${collectionName}/${id}`))
    );
    return {
      ok: false,
      error: formatFirestoreErrorMessage(error),
      code: error?.code,
    };
  }
}

export async function deleteDocumentStrict(
  collectionName: string,
  id: string
): Promise<PersistenceResult> {
  if (!isValidFirestoreId(id)) {
    return {
      ok: false,
      error: `Identificador inválido para eliminar en ${collectionName}: ${id}`,
      code: 'invalid-id',
    };
  }
  try {
    const docRef = doc(db, collectionName, id);
    await deleteDoc(docRef);
    return { ok: true };
  } catch (error: any) {
    console.error(
      `Error deleting from ${collectionName}/${id}:`,
      JSON.stringify(buildFirestoreErrorInfo(error, OperationType.DELETE, `${collectionName}/${id}`))
    );
    return {
      ok: false,
      error: formatFirestoreErrorMessage(error),
      code: error?.code,
    };
  }
}

export async function saveDocumentData(
  collectionName: string,
  id: string,
  data: any,
  merge = false
): Promise<boolean> {
  const res = await saveDocumentStrict(collectionName, id, data, { merge });
  return res.ok;
}

export async function deleteDocumentData(collectionName: string, id: string): Promise<boolean> {
  const res = await deleteDocumentStrict(collectionName, id);
  return res.ok;
}

function sanitizeForFirestore(obj: any): any {
  if (obj === null || obj === undefined) return undefined;
  if (Array.isArray(obj)) {
    return obj
      .map((item) => sanitizeForFirestore(item))
      .filter((item) => item !== undefined);
  }
  if (typeof obj === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (val !== undefined && val !== null) {
        const sanitizedVal = sanitizeForFirestore(val);
        if (sanitizedVal !== undefined) {
          cleaned[key] = sanitizedVal;
        }
      }
    }
    return cleaned;
  }
  return obj;
}

export async function batchRestoreCollection<T extends { id: string }>(
  collectionName: string,
  items: T[],
  replaceExisting: boolean
): Promise<{ written: number; deleted: number }> {
  const BATCH_LIMIT = 400;
  let written = 0;
  let deleted = 0;

  try {
    const colRef = collection(db, collectionName);

    if (replaceExisting) {
      const existingSnap = await getDocs(colRef);
      const idsToDelete: string[] = [];
      const incomingIds = new Set(items.map((i) => i.id));
      existingSnap.forEach((d) => {
        if (!incomingIds.has(d.id)) {
          idsToDelete.push(d.id);
        }
      });

      for (let i = 0; i < idsToDelete.length; i += BATCH_LIMIT) {
        const chunk = idsToDelete.slice(i, i + BATCH_LIMIT);
        const batch = writeBatch(db);
        chunk.forEach((docId) => {
          batch.delete(doc(db, collectionName, docId));
        });
        await batch.commit();
        deleted += chunk.length;
      }
    }

    for (let i = 0; i < items.length; i += BATCH_LIMIT) {
      const chunk = items.slice(i, i + BATCH_LIMIT);
      const batch = writeBatch(db);
      chunk.forEach((item) => {
        const cleanDoc = sanitizeForFirestore(item);
        batch.set(doc(db, collectionName, item.id), cleanDoc, { merge: !replaceExisting });
      });
      await batch.commit();
      written += chunk.length;
    }

    return { written, deleted };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, collectionName);
  }
}
