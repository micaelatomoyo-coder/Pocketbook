
import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot, 
  addDoc, 
  doc, 
  updateDoc, 
  increment, 
  setDoc,
  serverTimestamp,
  getDoc
} from 'firebase/firestore';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { db, auth } from '../lib/firebase';
import { GenerationHistory } from '../types';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
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
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function useFirebase() {
  const [user, setUser] = useState<any>(null);
  const [history, setHistory] = useState<GenerationHistory[]>([]);
  const [totalStats, setTotalStats] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });

    // Global stats listener
    const statsPath = 'stats/global';
    const unsubStats = onSnapshot(doc(db, statsPath), (docSnap) => {
      if (docSnap.exists()) {
        setTotalStats(docSnap.data().totalGenerations || 0);
      }
    }, (error) => {
      // We don't throw here to avoid crashing the whole hook, but we log properly
      try {
        handleFirestoreError(error, OperationType.GET, statsPath);
      } catch (e) {
        // Log is already done in handleFirestoreError
      }
    });

    return () => {
      unsubAuth();
      unsubStats();
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setHistory([]);
      return;
    }

    const generationsPath = 'generations';
    const q = query(
      collection(db, generationsPath),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    const unsubHistory = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: (doc.data() as any).createdAt?.toMillis() || Date.now()
      })) as any[];
      setHistory(items);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, generationsPath);
    });

    return () => unsubHistory();
  }, [user]);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const saveGeneration = async (data: Omit<GenerationHistory, 'id' | 'timestamp'>) => {
    if (!user) return;

    const generationsPath = 'generations';
    const statsPath = 'stats/global';

    try {
      await addDoc(collection(db, generationsPath), {
        ...data,
        userId: user.uid,
        createdAt: serverTimestamp()
      });

      // Increment global counter
      const statsRef = doc(db, statsPath);
      // We use setDoc with merge: true to handle initialization and increment safely
      await setDoc(statsRef, {
        totalGenerations: increment(1)
      }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, generationsPath);
    }
  };

  return { user, history, totalStats, loading, saveGeneration, login, logout };
}
