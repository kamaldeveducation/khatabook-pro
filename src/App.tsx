import React, { useState, useEffect, createContext, useContext, useMemo, useRef } from 'react';
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Navigate, 
  useNavigate, 
  useParams,
  Link,
  useSearchParams,
  useLocation
} from 'react-router-dom';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  linkWithCredential,
  EmailAuthProvider,
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  collection, 
  collectionGroup,
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  orderBy, 
  limit,
  Timestamp,
  serverTimestamp,
  arrayUnion,
  increment,
  runTransaction,
  writeBatch,
  deleteField,
  or,
  and
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { 
  Plus, 
  Search, 
  ArrowUpRight, 
  ArrowDownLeft, 
  User as UserIcon, 
  LogOut, 
  ChevronRight, 
  ChevronLeft,
  ArrowLeft, 
  Camera, 
  Calendar, 
  FileText,
  Trash2,
  Phone,
  MessageCircle,
  Contact,
  Share2,
  Filter,
  Pencil,
  Image as ImageIcon,
  X,
  Building2 as Store,
  ListOrdered as ReceiptText,
  MessageSquare as SmsIcon,
  Bell,
  MessageSquare,
  FileDown,
  Settings,
  Moon,
  Sun,
  Save,
  Check,
  Users,
  BookOpen,
  MoreHorizontal,
  UserPlus,
  AlertTriangle,
  Clock,
  Zap,
  CreditCard,
  ShieldCheck
} from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SubscriptionScreen, BulkMessageUI } from './components/PremiumBulkMessage';
import './components/PremiumBulkMessage.css';

import { auth, db, storage } from './firebase';

// --- Utilities ---
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function useKeyboardVisible() {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      // If the viewport height is significantly smaller than the screen height, 
      // the keyboard is likely open.
      const isVisible = window.innerHeight < window.screen.height * 0.7;
      setIsKeyboardVisible(isVisible);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isKeyboardVisible;
}

function formatRelativeTimeHindi(timestamp: any) {
  if (!timestamp) return 'कोई ट्रांजैक्शन नहीं';
  
  const date = toJSDate(timestamp);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'अभी';
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes} मिनट पहले`;
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours} घंटे पहले`;
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) return 'कल';
  if (diffInDays < 7) return `${diffInDays} दिन पहले`;
  
  if (diffInDays < 30) {
    const weeks = Math.floor(diffInDays / 7);
    return weeks === 1 ? 'एक सप्ताह पहले' : `${weeks} सप्ताह पहले`;
  }
  
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) return `${diffInMonths} महीने पहले`;
  
  const diffInYears = Math.floor(diffInMonths / 12);
  return `${diffInYears} साल पहले`;
}

function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

const normalizeMobile = (mobile: string): string => {
  if (!mobile) return '';
  // Remove all non-numeric characters
  const cleaned = mobile.replace(/\D/g, '');
  // If it starts with 91 and is 12 digits, remove 91
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    return cleaned.slice(2);
  }
  // Otherwise just return the last 10 digits if longer
  if (cleaned.length > 10) {
    return cleaned.slice(-10);
  }
  return cleaned;
};

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
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const currentUser = auth.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid || 'NOT_LOGGED_IN',
      email: currentUser?.email || 'NO_EMAIL',
      emailVerified: currentUser?.emailVerified || false,
      isAnonymous: currentUser?.isAnonymous || false,
      tenantId: currentUser?.tenantId || 'NO_TENANT',
      providerInfo: currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName || 'NO_DISPLAY_NAME',
        email: provider.email || 'NO_EMAIL',
        photoUrl: provider.photoURL || 'NO_PHOTO'
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // Don't throw for permission-denied to avoid crashing the app, just log it
  if (error instanceof Error && error.message.includes('permission-denied')) {
    return;
  }
  throw new Error(JSON.stringify(errInfo));
}

const getMillis = (timestamp: any): number => {
  if (!timestamp) return 0;
  if (typeof timestamp.toMillis === 'function') return timestamp.toMillis();
  if (timestamp instanceof Date) return timestamp.getTime();
  if (typeof timestamp === 'number') return timestamp;
  if (typeof timestamp === 'string') return new Date(timestamp).getTime();
  if (timestamp.seconds !== undefined) return timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1000000;
  return 0;
};

export const toJSDate = (timestamp: any): Date => {
  if (!timestamp) return new Date();
  if (typeof timestamp.toDate === 'function') return timestamp.toDate();
  if (timestamp instanceof Date) return timestamp;
  if (typeof timestamp === 'number') return new Date(timestamp);
  if (typeof timestamp === 'string') return new Date(timestamp);
  if (timestamp.seconds !== undefined) return new Date(timestamp.seconds * 1000);
  return new Date();
};

export const isSubscriptionActive = (user: AppUser | null) => {
  if (!user) return false;
  if (user.subscriptionStatus !== 'active') return false;
  if (!user.subscriptionExpiry) return false;
  
  const expiry = toJSDate(user.subscriptionExpiry);
  return expiry > new Date();
};

const compressImage = (file: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Compression failed'));
        }, 'image/jpeg', 0.7);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

// --- Types ---
export interface AppUser {
  uid: string;
  name: string;
  email?: any;
  mobile: string;
  role: 'shopkeeper' | 'customer';
  status: 'pending' | 'approved';
  shopName?: string;
  smsFormat?: string;
  txSmsFormat?: string;
  bulkSmsFormat?: string;
  id?: string;
  source?: 'global' | 'my_customers';
  subscriptionStatus?: 'active' | 'inactive';
  subscriptionExpiry?: any;
  createdAt?: any;
  platforms?: any;
}

export interface Customer {
  id: string;
  name: string;
  mobile: string;
  photoURL?: string;
  ownerId: string;
  totalDue: number;
  createdAt: any;
  lastUpdatedAt: any;
  reminderDate?: any;
  alertThreshold?: number;
  dailyReminderTime?: string;
  lastReminderSentDate?: string;
  merchantCreditNetwork?: {
    sharingEnabled?: boolean;
  };
}

export interface Supplier {
  id: string;
  name: string;
  mobile: string;
  photoURL?: string;
  ownerId: string;
  totalDue: number;
  createdAt: any;
  lastUpdatedAt: any;
  alertThreshold?: number;
  reminderDate?: any;
  dailyReminderTime?: string;
  lastReminderSentDate?: string;
}

interface Transaction {
  id: string;
  customerId?: string;
  customerMobile: string;
  ownerId: string;
  amount: number;
  type: 'udhar' | 'jama';
  note?: string;
  date: any;
  imageUrl?: string;
  imageUrls?: string[];
  runningBalance?: number;
}

interface SupplierTransaction {
  id: string;
  supplierId?: string;
  supplierMobile: string;
  ownerId: string;
  amount: number;
  type: 'udhar' | 'jama';
  note?: string;
  date: any;
  imageUrl?: string;
  imageUrls?: string[];
  runningBalance?: number;
}

// --- Context ---
const ThemeContext = createContext<{
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}>({ theme: 'light', toggleTheme: () => {} });

const useTheme = () => useContext(ThemeContext);

const AuthContext = createContext<{
  user: AppUser | null;
  isKhatabookAdmin: boolean;
  loading: boolean;
  needsRole: boolean;
  firebaseAuthUser: FirebaseUser | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  selectRole: (role: 'shopkeeper' | 'customer', mobile: string, overrideUser?: FirebaseUser | null, profileOverrides?: { name?: string }) => Promise<void>;
  updateUser: (data: Partial<AppUser>) => Promise<void>;
  loginEmail: (email: string, password: string) => Promise<void>;
        signUpEmail: (fullName: string, email: string, password: string) => Promise<boolean>;
        completeSignUpFlow: (fullName: string, email: string, password: string, role: 'shopkeeper' | 'customer', mobile: string) => Promise<{ ok: boolean; message: string }>;
        forgotPasswordEmail: (email: string) => Promise<{ ok: boolean; message: string }>;
} | null>(null);

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

// --- IndexedDB Helper for Offline Photos ---
const DB_NAME = 'KhataBookOffline';
const STORE_NAME = 'pendingUploads';

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const savePendingUpload = async (file: File, path: string, docId: string, collectionName: string, fieldName: string = 'photoURL', ownerId?: string, customerId?: string) => {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  store.add({ file, path, docId, collectionName, fieldName, ownerId, customerId, createdAt: Date.now() });
};

const customerDocRef = (ownerId: string, customerId: string) => doc(db, 'users', ownerId, 'customers', customerId);
const customerCollectionRef = (ownerId: string) => collection(db, 'users', ownerId, 'customers');
const transactionDocRef = (ownerId: string, customerId: string, transactionId: string) => doc(db, 'users', ownerId, 'customers', customerId, 'transactions', transactionId);
const transactionCollectionRef = (ownerId: string, customerId: string) => collection(db, 'users', ownerId, 'customers', customerId, 'transactions');
const supplierDocRef = (ownerId: string, supplierId: string) => doc(db, 'users', ownerId, 'suppliers', supplierId);
const supplierCollectionRef = (ownerId: string) => collection(db, 'users', ownerId, 'suppliers');
const supplierTxDocRef = (ownerId: string, supplierId: string, transactionId: string) => doc(db, 'users', ownerId, 'suppliers', supplierId, 'transactions', transactionId);
const supplierTxCollectionRef = (ownerId: string, supplierId: string) => collection(db, 'users', ownerId, 'suppliers', supplierId, 'transactions');

const getPendingUploads = async () => {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  return new Promise<any[]>((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const deletePendingUpload = async (id: number) => {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  store.delete(id);
};

// --- Storage Helper ---
const uploadToStorage = async (file: File, path: string): Promise<string> => {
  try {
    const compressedBlob = await compressImage(file);
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, compressedBlob);
    return await getDownloadURL(storageRef);
  } catch (error: any) {
    console.error("Storage upload failed:", error);
    if (error.code === 'storage/unauthorized') {
      throw new Error("STORAGE_UNAUTHORIZED: You need to publish Storage security rules in your Firebase Console. Please check the 'Storage' tab in Firebase.");
    }
    if (error.code === 'storage/retry-limit-exceeded') {
      throw new Error("STORAGE_RETRY_LIMIT: Could not connect to Firebase Storage. Please ensure it is enabled in your Firebase Console.");
    }
    throw error;
  }
};

// --- Background Sync Hook ---
const useBackgroundSync = () => {
  const isOnline = useOnlineStatus();

  useEffect(() => {
    if (isOnline) {
      const sync = async () => {
        const pending = await getPendingUploads();
        for (const item of pending) {
          try {
            console.log(`Syncing pending upload for ${item.collectionName}/${item.docId}...`);
            const url = await uploadToStorage(item.file, item.path);
            
            if (item.fieldName === 'imageUrls') {
              // Handle array of images for transactions
              let docRef;
              if (item.collectionName === 'transactions' && item.ownerId && item.customerId) {
                docRef = transactionDocRef(item.ownerId, item.customerId, item.docId);
              } else if (item.collectionName === 'supplierTransactions' && item.ownerId && item.supplierId) {
                docRef = supplierTxDocRef(item.ownerId, item.supplierId, item.docId);
              } else {
                docRef = doc(db, item.collectionName, item.docId);
              }
              const docSnap = await getDoc(docRef);
              if (docSnap.exists()) {
                const data = docSnap.data() as any;
                const currentUrls = data.imageUrls || [];
                // Replace local blob URLs with real ones
                const updatedUrls = currentUrls.map((u: string) => u.startsWith('blob:') ? url : u);
                // If the URL wasn't a replacement, add it
                if (!updatedUrls.includes(url)) {
                  updatedUrls.push(url);
                }
                
                await updateDoc(docRef, {
                  imageUrls: updatedUrls,
                  imageUrl: updatedUrls[0] || url
                });
              }
            } else {
              // Handle single photoURL for customers/suppliers
              if (item.collectionName === 'customers' && item.ownerId) {
                await updateDoc(customerDocRef(item.ownerId, item.docId), {
                  [item.fieldName]: url
                });
              } else if (item.collectionName === 'suppliers' && item.ownerId) {
                await updateDoc(supplierDocRef(item.ownerId, item.docId), {
                  [item.fieldName]: url
                });
              } else {
                await updateDoc(doc(db, item.collectionName, item.docId), {
                  [item.fieldName]: url
                });
              }
            }
            
            await deletePendingUpload(item.id);
            console.log(`Successfully synced ${item.collectionName}/${item.docId}`);
          } catch (error) {
            console.error(`Failed to sync ${item.collectionName}/${item.docId}:`, error);
          }
        }
      };
      sync();
    }
  }, [isOnline]);
};

// --- Components ---

const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isKhatabookAdmin, setIsKhatabookAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [needsRole, setNeedsRole] = useState(false);
  const [tempUser, setTempUser] = useState<FirebaseUser | null>(null);
  const emailSignupInProgressRef = useRef<boolean>(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setTempUser(firebaseUser);
      setIsKhatabookAdmin(false);
      if (emailSignupInProgressRef.current) {
        // Email/password signup critical section: the signup flow itself will write the
        // Firestore users/{uid} doc and then signOut. We must NOT run any Firestore checks
        // that could momentarily set needsRole=true or otherwise flash Complete Profile UI.
        return;
      }
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            let userData = userDoc.data() as AppUser;
            const platformRoles = userDoc.get('platformRoles') as Record<string, unknown> | undefined;
            setIsKhatabookAdmin(platformRoles?.khatabookAdmin === true);
            // Force shopkeeper role for the main user email if it was accidentally set to customer
            if (firebaseUser.email === 'kamaldevjobs@gmail.com' && userData.role !== 'shopkeeper') {
              userData.role = 'shopkeeper';
              userData.status = 'approved';
              await updateDoc(doc(db, 'users', firebaseUser.uid), { role: 'shopkeeper', status: 'approved' });
            }
            // Cross-app safe: ensure "khatabook" is present in platforms array without removing "kirana" or other platforms
            const currentPlatforms: any[] = Array.isArray(userData.platforms) ? userData.platforms : [];
            if (!currentPlatforms.includes('khatabook')) {
              await updateDoc(doc(db, 'users', firebaseUser.uid), { platforms: arrayUnion('khatabook') });
              userData.platforms = [...currentPlatforms, 'khatabook'];
            }
            setUser(userData);
            setNeedsRole(false);
          } else {
            setIsKhatabookAdmin(false);
            setNeedsRole(true);
          }
        } catch (error) {
          setIsKhatabookAdmin(false);
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
        }
      } else {
        setIsKhatabookAdmin(false);
        setUser(null);
        setNeedsRole(false);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const logout = async () => {
    await signOut(auth);
  };

  const selectRole = async (role: 'shopkeeper' | 'customer', mobile: string, overrideUser?: FirebaseUser | null, profileOverrides?: { name?: string }) => {
    const targetUser = overrideUser || tempUser;
    if (!targetUser) return;
    const finalRole = targetUser.email === 'kamaldevjobs@gmail.com' ? 'shopkeeper' : role;
    const normalizedMobile = normalizeMobile(mobile);
    const initialStatus: 'pending' | 'approved' =
      targetUser.email === 'kamaldevjobs@gmail.com'
        ? 'approved'
        : finalRole === 'shopkeeper'
          ? 'pending'
          : 'approved';
    const resolvedName = profileOverrides?.name?.trim() || targetUser.displayName || 'User';
    const newUser: AppUser = {
      uid: targetUser.uid,
      name: resolvedName,
      mobile: normalizedMobile,
      role: finalRole,
      status: initialStatus,
      shopName: resolvedName || 'My Shop',
      smsFormat: 'नमस्ते {name}, Khatabook पर आपका ₹{amount} का {type} है। कृपया जल्द भुगतान करें। धन्यवाद।',
      createdAt: serverTimestamp(),
      platforms: ['khatabook'],
      ...(targetUser.email ? { email: targetUser.email } : {})
    };
    try {
      await setDoc(doc(db, 'users', targetUser.uid), newUser, { merge: true });
      setUser(newUser);
      setNeedsRole(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${targetUser.uid}`);
      throw error;
    }
  };

  const updateUser = async (data: Partial<AppUser>) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), data);
      setUser({ ...user, ...data });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const loginEmail = async (email: string, password: string): Promise<void> => {
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (error: any) {
      const code = error?.code as string | undefined;
      switch (code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          alert('Invalid email or password.');
          break;
        case 'auth/account-exists-with-different-credential':
          alert('This email is registered with a different sign-in method. Please sign in with Google instead.');
          break;
        case 'auth/invalid-email':
          alert('Please enter a valid email.');
          break;
        default:
          alert('Sign in failed. Please try again.');
      }
    }
  };

  const signUpEmail = async (fullName: string, email: string, password: string): Promise<boolean> => {
    if (!fullName.trim() || !email || !password) {
      alert('Please fill in all required fields.');
      return false;
    }
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(userCredential.user, { displayName: fullName.trim() });
      return true;
    } catch (error: any) {
      const code = error?.code as string | undefined;
      switch (code) {
        case 'auth/email-already-in-use':
          alert('This email is already registered. Please sign in with Google or use Forgot Password.');
          break;
        case 'auth/weak-password':
          alert('Password should be at least 6 characters.');
          break;
        case 'auth/invalid-email':
          alert('Please enter a valid email.');
          break;
        case 'auth/account-exists-with-different-credential':
          alert('This email is registered with a different sign-in method. Please sign in with Google instead.');
          break;
        default:
          alert('Sign up failed. Please try again.');
      }
      return false;
    }
  };

  const completeSignUpFlow = async (
    fullName: string,
    email: string,
    password: string,
    role: 'shopkeeper' | 'customer',
    mobile: string
  ): Promise<{ ok: boolean; message: string }> => {
    emailSignupInProgressRef.current = true;
    try {
      if (!fullName.trim() || !email || !password) {
        return { ok: false, message: 'Please fill in all required fields.' };
      }
      let createdUser: FirebaseUser | null = null;
      let authCleanupNeeded = false;
      let success = false;
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        createdUser = userCredential.user;
        authCleanupNeeded = true;
        await updateProfile(createdUser, { displayName: fullName.trim() });
        try {
          await selectRole(role, mobile, createdUser);
        } catch (firestoreErr: any) {
          try { await signOut(auth); } catch { /* ignore */ }
          return { ok: false, message: 'Registration could not be completed. Profile save failed. Please try again.' };
        }
        try { await signOut(auth); } catch { /* ignore sign-out error */ }
        success = true;
        return { ok: true, message: 'Account created successfully. Please login.' };
      } catch (error: any) {
        const code = error?.code as string | undefined;
        let msg = 'Sign up failed. Please try again.';
        switch (code) {
          case 'auth/email-already-in-use':
            msg = 'This email is already registered. Please sign in with Google or use Forgot Password.';
            break;
          case 'auth/weak-password':
            msg = 'Password should be at least 6 characters.';
            break;
          case 'auth/invalid-email':
            msg = 'Please enter a valid email.';
            break;
          case 'auth/account-exists-with-different-credential':
            msg = 'This email is registered with a different sign-in method. Please sign in with Google instead.';
            break;
        }
        if (authCleanupNeeded) {
          try { await signOut(auth); } catch { /* ignore */ }
        }
        return { ok: false, message: msg };
      } finally {
        // selectRole() updates local React state: setUser + setNeedsRole. The guard skipped
        // onAuthStateChanged for this window, so the Firebase-side sign-out event can't clear
        // those state vars. Manually reset local user-facing state right here so the LoginScreen
        // renders directly without any flash of Complete Profile or PendingApproval.
        setUser(null);
        setIsKhatabookAdmin(false);
        setNeedsRole(false);
        setLoading(false);
        if (!success) {
          // On failure, still reset guard after a short macrotask so queued auth events flush.
          setTimeout(() => { emailSignupInProgressRef.current = false; }, 0);
        } else {
          // On success: reset guard after a macrotask tick so any trailing auth-related state
          // emissions don't accidentally hit unguarded handling.
          setTimeout(() => { emailSignupInProgressRef.current = false; }, 0);
        }
      }
    } catch (outerErr) {
      // Safety net: if the outer try shell somehow throws, never leave the guard stuck on.
      setTimeout(() => { emailSignupInProgressRef.current = false; }, 0);
      setUser(null);
      setNeedsRole(false);
      setLoading(false);
      return { ok: false, message: 'Sign up failed. Please try again.' };
    }
  };

  const forgotPasswordEmail = async (email: string): Promise<{ ok: boolean; message: string }> => {
    try {
      await sendPasswordResetEmail(auth, email.trim());
      return { ok: true, message: 'Password reset email sent. Please check your inbox.' };
    } catch (error: any) {
      const code = error?.code as string | undefined;
      switch (code) {
        case 'auth/user-not-found':
          return { ok: true, message: 'Password reset email sent. Please check your inbox.' };
        case 'auth/invalid-email':
          return { ok: false, message: 'Please enter a valid email.' };
        default:
          return { ok: true, message: 'Password reset email sent. Please check your inbox.' };
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, isKhatabookAdmin, loading, login, logout, needsRole, firebaseAuthUser: tempUser, selectRole, updateUser, loginEmail, signUpEmail, completeSignUpFlow, forgotPasswordEmail }}>
      {children}
    </AuthContext.Provider>
  );
};

const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    return (saved as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <div className={cn(theme === 'dark' ? 'dark' : '')}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
};

export const Layout: React.FC<{ 
  children: React.ReactNode; 
  title?: string; 
  showBack?: boolean; 
  hideLogout?: boolean;
  rightAction?: React.ReactNode;
  onTitleClick?: () => void;
  showTabs?: boolean;
  activeTab?: 'customers' | 'suppliers';
  onTabChange?: (tab: 'customers' | 'suppliers') => void;
  headerClassName?: string;
  backTo?: string;
  bottomNavActive?: 'parties' | 'creditCheck' | 'more';
  onCreditCheck?: () => void;
}> = ({ children, title, showBack, hideLogout, rightAction, onTitleClick, showTabs, activeTab = 'customers', onTabChange, headerClassName, backTo, bottomNavActive = 'parties', onCreditCheck }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();
  const isOnline = useOnlineStatus();

  const isKeyboardVisible = useKeyboardVisible();

  return (
    <div className={cn(
      "min-h-screen transition-colors duration-300",
      theme === 'dark' ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900"
    )}>
      {!isOnline && (
        <div className="bg-amber-500 text-white text-[10px] font-bold py-1 px-4 flex items-center justify-center gap-2 sticky top-0 z-[100] animate-pulse">
          <div className="w-1.5 h-1.5 bg-white rounded-full" />
          ऑफलाइन मोड - कनेक्ट होने पर सिंक होगा
        </div>
      )}
      <header className={cn(
        "sticky top-0 z-30 transition-all duration-300",
        theme === 'dark' ? "bg-slate-900/80 backdrop-blur-md border-b border-slate-800" : (headerClassName || "bg-indigo-700 text-white shadow-lg")
      )}>
        <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {showBack && (
              <button 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (backTo) {
                    navigate(backTo);
                  } else {
                    navigate(-1);
                  }
                }}
                className={cn(
                  "p-3 -ml-2 rounded-full transition-all active:scale-90 flex items-center justify-center",
                  theme === 'dark' ? "text-slate-400 hover:text-indigo-400 hover:bg-slate-800" : "text-white hover:bg-white/20"
                )}
                aria-label="Back"
              >
                <ArrowLeft size={24} />
              </button>
            )}
            <h1 
              onClick={onTitleClick}
              className={cn(
                "text-lg font-bold tracking-tight truncate max-w-[200px]",
                theme === 'dark' ? "text-slate-100" : "text-white",
                onTitleClick && "cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-1"
              )}
            >
              {title || (user?.shopName || "KhataBook Kirana")}
              {onTitleClick && <Pencil size={12} className="opacity-60" />}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {rightAction}
            {!hideLogout && (
              <button 
                onClick={() => navigate('/settings')}
                className={cn(
                  "p-2 rounded-full transition-all active:scale-90",
                  theme === 'dark' ? "text-slate-400 hover:text-indigo-400 hover:bg-slate-800" : "text-white hover:bg-white/20"
                )}
                title="सेटिंग्स"
              >
                <Settings size={20} />
              </button>
            )}
          </div>
        </div>

        {showTabs && bottomNavActive !== 'creditCheck' && (
          <div className="max-w-md mx-auto px-4 flex border-t border-white/10">
            <button 
              onClick={() => onTabChange?.('customers')}
              className={cn(
                "flex-1 py-3 text-sm font-bold border-b-4 transition-all",
                activeTab === 'customers' ? "border-white text-white" : "border-transparent text-white/60 hover:text-white"
              )}
            >
              ग्राहक
            </button>
            <button 
              onClick={() => onTabChange?.('suppliers')}
              className={cn(
                "flex-1 py-3 text-sm font-bold border-b-4 transition-all",
                activeTab === 'suppliers' ? "border-white text-white" : "border-transparent text-white/60 hover:text-white"
              )}
            >
              सप्लायर
            </button>
          </div>
        )}
      </header>
      <main className={cn("max-w-md mx-auto", !isKeyboardVisible && "pb-32")}>
        {children}
      </main>

      {/* Bottom Navigation */}
      {showTabs && !isKeyboardVisible && (
        <nav className={cn(
          "fixed bottom-0 left-0 right-0 z-40 border-t transition-all duration-300",
          theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
        )}>
          <div className="max-w-md mx-auto flex items-center justify-around h-16">
            <button
              onClick={() => navigate("/")}
              className={cn(
                "flex flex-col items-center gap-1 transition-colors",
                bottomNavActive === "parties" ? "text-indigo-600" : "text-slate-400 hover:text-indigo-600"
              )}
            >
              <Users size={20} />
              <span className="text-[10px] font-bold uppercase tracking-wider">पार्टीज़</span>
            </button>
            <button
              onClick={() => onCreditCheck ? onCreditCheck() : navigate('/credit-check')}
              className={cn(
                "flex flex-col items-center gap-1 transition-colors",
                bottomNavActive === 'creditCheck' ? "text-indigo-600" : "text-slate-400 hover:text-indigo-600"
              )}
            >
              <ShieldCheck size={20} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Credit Check</span>
            </button>
            <button className={cn(
              "flex flex-col items-center gap-1 transition-colors",
              bottomNavActive === 'more' ? "text-indigo-600" : "text-slate-400 hover:text-indigo-600"
            )}>
              <MoreHorizontal size={20} />
              <span className="text-[10px] font-bold uppercase tracking-wider">मोर</span>
            </button>
          </div>
        </nav>
      )}
    </div>
  );
};

interface SharedCreditLookupItem {
  merchantId: string;
  merchantName: string;
  merchantMobile?: string;
  customerId: string;
  customerName: string;
  customerPhotoURL?: string;
  mobile: string;
  outstandingAmount: number;
  sharingEnabled: true;
}

interface SharedCreditLookupResult {
  found: boolean;
  results: SharedCreditLookupItem[];
}

async function lookupSharedCreditByMobile(
  rawMobile: string
): Promise<SharedCreditLookupResult> {
  const normalized = normalizeMobile(rawMobile);
  if (normalized.length < 10) {
    return { found: false, results: [] };
  }
  const cg = collectionGroup(db, 'customers');
  const qSnap = await getDocs(
    query(
      cg,
      where('mobile', '==', normalized),
      where('merchantCreditNetwork.sharingEnabled', '==', true)
    )
  );
  const perMerchant: Map<string, SharedCreditLookupItem> = new Map();
  const ownerIds: Set<string> = new Set();
  for (const d of qSnap.docs) {
    const dref = d.ref;
    const parts = dref.path.split('/');
    let ownerId: string | null = null;
    if (parts.length >= 4 && parts[0] === 'users' && parts[2] === 'customers') {
      ownerId = parts[1];
    }
    const data = d.data() as any;
    if (!ownerId && data && typeof data === 'object' && typeof data.ownerId === 'string' && data.ownerId) {
      ownerId = data.ownerId;
    }
    if (!ownerId) continue;
    const sharingEnabled = data?.merchantCreditNetwork?.sharingEnabled === true;
    if (!sharingEnabled) continue;
    ownerIds.add(ownerId);
    const totalDue = typeof data.totalDue === 'number' ? data.totalDue : 0;
    const existing = perMerchant.get(ownerId);
    const candidate: SharedCreditLookupItem = {
      merchantId: ownerId,
      merchantName: '',
      merchantMobile: undefined,
      customerId: d.id,
      customerName: String(data.name || ''),
      customerPhotoURL: data.photoURL ? String(data.photoURL) : undefined,
      mobile: String(data.mobile || normalized),
      outstandingAmount: totalDue,
      sharingEnabled: true
    };
    if (!existing || Math.abs(candidate.outstandingAmount) > Math.abs(existing.outstandingAmount)) {
      perMerchant.set(ownerId, candidate);
    }
  }
  const merchantProfiles: Record<string, { name: string; mobile?: string }> = {};
  await Promise.all(Array.from(ownerIds).map(async (oid) => {
    try {
      const snap = await getDoc(doc(db, 'users', oid));
      if (snap.exists()) {
        const ud = snap.data() as any;
        const rawMob = String(ud.mobile || ud.phone || ud.contact || ud.phoneNumber || '');
        merchantProfiles[oid] = {
          name: String(ud.shopName || ud.name || ud.fullName || `Shop (${oid.slice(0, 4)})`),
          mobile: normalizeMobile(rawMob) || undefined
        };
      } else {
        merchantProfiles[oid] = { name: `Shop (${oid.slice(0, 4)})` };
      }
    } catch {
      merchantProfiles[oid] = { name: `Shop (${oid.slice(0, 4)})` };
    }
  }));
  const results: SharedCreditLookupItem[] = Array.from(perMerchant.values()).map((it) => ({
    ...it,
    merchantName: merchantProfiles[it.merchantId]?.name || `Shop (${it.merchantId.slice(0, 4)})`,
    merchantMobile: merchantProfiles[it.merchantId]?.mobile
  }));
  return { found: results.length > 0, results };
}

interface CreditTxSummary {
  lastTransactionDate: Date | null;
  lastPaymentDate: Date | null;
  lastPaymentAmount: number | null;
}

function formatDDMonYYYY(d: Date): string {
  const day = d.getDate();
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${day} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatRelativePaid(d: Date, now: Date = new Date()): string {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dt = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfToday - dt) / 86400000);
  if (diffDays <= 0) return 'Paid today';
  if (diffDays === 1) return 'Paid yesterday';
  if (diffDays < 7) return `Paid ${diffDays} days ago`;
  if (diffDays < 30) {
    const w = Math.floor(diffDays / 7);
    if (w >= 1 && diffDays - w * 7 < 7) return `Paid ${w} week${w === 1 ? '' : 's'} ago`;
    return `Paid ${diffDays} days ago`;
  }
  const approxMonths = Math.round((startOfToday - dt) / (86400000 * 30));
  if (approxMonths <= 0) return 'Paid this month';
  if (approxMonths === 1) return 'Paid 1 month ago';
  if (approxMonths < 12) return `Paid ${approxMonths} months ago`;
  const y = Math.floor(approxMonths / 12);
  const remM = approxMonths - y * 12;
  if (remM === 0) return `Paid ${y} year${y === 1 ? '' : 's'} ago`;
  return `Paid ${y} year${y === 1 ? '' : 's'} ${remM} month${remM === 1 ? '' : 's'} ago`;
}

async function fetchCustomerTxSummary(ownerId: string, customerId: string): Promise<CreditTxSummary> {
  const coll = collection(db, 'users', ownerId, 'customers', customerId, 'transactions');
  const q = query(coll, orderBy('date', 'desc'), limit(200));
  const snap = await getDocs(q);
  let lastTxDate: Date | null = null;
  let lastPaymentDate: Date | null = null;
  let lastPaymentAmount: number | null = null;
  for (const d of snap.docs) {
    const t = d.data() as any;
    const dt = toJSDate(t.date);
    const ts = getMillis(t.date);
    if (!lastTxDate || (ts > 0 && dt.getTime() > lastTxDate.getTime())) {
      lastTxDate = dt;
    }
    if (t && t.type === 'jama') {
      if (!lastPaymentDate || (ts > 0 && dt.getTime() > lastPaymentDate.getTime())) {
        lastPaymentDate = dt;
        lastPaymentAmount = typeof t.amount === 'number' ? t.amount : 0;
      }
    }
  }
  return { lastTransactionDate: lastTxDate, lastPaymentDate, lastPaymentAmount };
}

const CreditCheckScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  interface CreditResultCustomer {
    id: string;
    ownerId: string;
    name: string;
    mobile: string;
    photoURL?: string;
    totalDue?: number;
    lastTransactionDate?: Date | null;
    lastPaymentDate?: Date | null;
    lastPaymentAmount?: number | null;
  }

  const [mobile, setMobile] = useState('');
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);
  const [results, setResults] = useState<CreditResultCustomer[]>([]);
  const [shops, setShops] = useState<Record<string, { name: string; mobile?: string }>>({});
  const [searchedMobile, setSearchedMobile] = useState<string>('');
  const [errorText, setErrorText] = useState<string | null>(null);

  const resetSearch = () => {
    setMobile('');
    setResults([]);
    setShops({});
    setSearchedMobile('');
    setErrorText(null);
    setChecked(false);
  };

  const handleCheckCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const normalized = normalizeMobile(mobile);
    if (normalized.length < 10) {
      alert('Please enter a valid 10-digit mobile number.');
      return;
    }
    setLoading(true);
    setChecked(true);
    setResults([]);
    setShops({});
    setErrorText(null);
    setSearchedMobile(normalized);
    try {
      const lookup = await lookupSharedCreditByMobile(normalized);
      const others = lookup.results.filter((r) => r.merchantId !== user.uid);
      const summaries = await Promise.all(
        others.map(async (r) => {
          try {
            const s = await fetchCustomerTxSummary(r.merchantId, r.customerId);
            return s;
          } catch (err) {
            console.warn(`Tx summary fetch failed for merchant=${r.merchantId} customer=${r.customerId}`, err);
            return { lastTransactionDate: null, lastPaymentDate: null, lastPaymentAmount: null };
          }
        })
      );
      const matches: CreditResultCustomer[] = others.map((r, idx) => ({
        id: r.customerId,
        ownerId: r.merchantId,
        name: r.customerName,
        mobile: r.mobile,
        photoURL: r.customerPhotoURL,
        totalDue: r.outstandingAmount,
        lastTransactionDate: summaries[idx].lastTransactionDate,
        lastPaymentDate: summaries[idx].lastPaymentDate,
        lastPaymentAmount: summaries[idx].lastPaymentAmount
      }));
      const shopMap: Record<string, { name: string; mobile?: string }> = {};
      for (const r of others) {
        shopMap[r.merchantId] = { name: r.merchantName, mobile: r.merchantMobile };
      }
      for (const r of lookup.results) {
        if (!shopMap[r.merchantId]) {
          shopMap[r.merchantId] = { name: r.merchantName, mobile: r.merchantMobile };
        }
      }
      setShops(shopMap);
      setResults(matches);
    } catch (error) {
      console.error('Credit check failed', error);
      let msg = 'Could not complete credit check. Please try again.';
      if (error instanceof Error) {
        const m = error.message;
        if (m && typeof m === 'string') {
          if (m.includes('The query requires an index')) {
            msg = 'A Firebase composite index is required for Credit Check search. Please follow the index creation link in the browser console and then try again.';
          } else if (m.includes('PERMISSION_DENIED') || m.includes('permission') || m.includes('Unauthenticated')) {
            msg = 'Access denied. Please sign in again or contact support.';
          } else if (m.includes('offline') || m.includes('network')) {
            msg = 'Network issue. Please check your internet connection and try again.';
          } else if (m.trim().length > 0 && m.length < 220) {
            msg = m;
          }
        }
      }
      setErrorText(msg);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const formatRupee = (n: number) => '₹' + Math.abs(n).toLocaleString('en-IN');

  return (
    <Layout title="Merchant Credit Check" showBack backTo="/" showTabs bottomNavActive="creditCheck" onCreditCheck={() => {}}>
      <div className="px-4 pt-5 space-y-5">
        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center ring-1 ring-indigo-100">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight">Merchant Credit Check</h2>
              <p className="text-xs text-slate-500">
                Enter a mobile number to view credit information shared by other merchants in the network.
              </p>
            </div>
          </div>

          <form onSubmit={handleCheckCredit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">
                Customer Mobile Number
              </label>
              <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-400 transition-all">
                <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500">
                  <Search size={18} />
                </div>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={15}
                  className="flex-1 bg-transparent outline-none text-base font-bold text-slate-900 placeholder:text-slate-400"
                  placeholder="Enter mobile number"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-black tracking-wide shadow-lg shadow-indigo-200/60 hover:bg-indigo-700 transition-all active:scale-[0.995] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Clock size={18} className="animate-pulse" />
                  Checking credit…
                </>
              ) : (
                <>
                  <Check size={18} />
                  Check Credit
                </>
              )}
            </button>
          </form>
        </div>

        {(loading || checked) && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 px-1">
              <div className="space-y-0.5">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                  {loading ? 'Searching network…' : 'Credit Information Found'}
                </p>
                {searchedMobile && (
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-lg font-black tracking-tight text-slate-900">
                      Mobile: {searchedMobile.slice(0, 5)} {searchedMobile.slice(5)}
                    </h3>
                    {!loading && results.length > 0 && (
                      <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-wider ring-1 ring-indigo-100">
                        {results.length} result{results.length === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>
                )}
              </div>
              {checked && !loading && (
                <button
                  type="button"
                  onClick={resetSearch}
                  className="px-4 py-2 rounded-2xl bg-white border border-slate-200 text-slate-700 text-xs font-black uppercase tracking-wider shadow-sm hover:border-indigo-200 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all flex items-center gap-2"
                >
                  <Search size={14} />
                  Search Another Number
                </button>
              )}
            </div>

            {errorText && !loading && (
              <div className="p-4 rounded-3xl bg-red-50/80 border border-red-200 text-red-700 text-xs font-semibold leading-relaxed">
                {errorText}
              </div>
            )}

            {loading && (
              <div className="space-y-3">
                <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 animate-pulse" />
                      <div className="space-y-2 flex-1">
                        <div className="h-4 w-2/3 bg-slate-100 rounded-lg animate-pulse" />
                        <div className="h-3 w-1/2 bg-slate-100 rounded-lg animate-pulse" />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      <div className="h-14 rounded-2xl bg-slate-100 animate-pulse" />
                      <div className="h-14 rounded-2xl bg-slate-100 animate-pulse" />
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-xs font-bold text-slate-400">
                    <span className="inline-block w-3 h-3 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
                    Checking credit information…
                  </div>
                </div>
              </div>
            )}

            {!loading && checked && results.length === 0 && !errorText && (
              <div className="p-8 rounded-3xl border border-slate-200 bg-white text-center space-y-3 shadow-sm">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center ring-1 ring-indigo-100">
                  <ShieldCheck size={26} />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-base font-black text-slate-800">No Shared Credit Information</h3>
                  <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
                    No merchant has shared credit information for this mobile number.
                  </p>
                  <p className="text-xs text-slate-400 font-semibold leading-relaxed max-w-xs mx-auto">
                    Try another mobile number.
                  </p>
                </div>
              </div>
            )}

            {!loading && results.length > 0 && (
              <div className="space-y-4">
                {results.map((r) => {
                  const shop = shops[r.ownerId] || { name: `Shop (${r.ownerId.slice(0, 4)})` };
                  const due = typeof r.totalDue === 'number' ? r.totalDue : 0;
                  let statusLabel = 'SETTLED';
                  let statusPill = 'bg-slate-100 ring-slate-200 text-slate-700';
                  let amountColor = 'text-slate-900';
                  if (due > 0) {
                    statusLabel = 'DUE';
                    statusPill = 'bg-red-50 ring-red-200 text-red-700';
                    amountColor = 'text-red-600';
                  } else if (due < 0) {
                    statusLabel = 'ADVANCE';
                    statusPill = 'bg-emerald-50 ring-emerald-200 text-emerald-700';
                    amountColor = 'text-emerald-600';
                  }
                  const now = new Date();
                  const paidRelative = r.lastPaymentDate ? formatRelativePaid(r.lastPaymentDate, now) : null;
                  return (
                    <div
                      key={`${r.ownerId}-${r.id}`}
                      className="overflow-hidden rounded-[28px] bg-white border-2 border-indigo-100 shadow-[0_4px_20px_-4px_rgba(99,102,241,0.10)] hover:shadow-[0_8px_28px_-6px_rgba(99,102,241,0.18)] hover:-translate-y-0.5 transition-all"
                    >
                      <div className="w-full bg-indigo-700 rounded-t-[26px] px-4 sm:px-5 py-4 sm:py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-2xl bg-white/95 text-indigo-700 flex items-center justify-center ring-1 ring-indigo-100 shrink-0 shadow-sm">
                            <Store size={20} />
                          </div>
                          <div className="min-w-0 flex-1 py-0.5">
                            <p className="text-base sm:text-[15px] font-extrabold tracking-tight truncate text-white leading-tight">
                              {shop.name}
                            </p>
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-100/80 mt-1">
                              Shared by Merchant
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 sm:p-5">
                      <div className="mt-3.5 sm:mt-5 grid grid-cols-2 sm:grid-cols-2 gap-3 sm:gap-4 items-start">
                        <div className="p-3 sm:p-5 rounded-2xl bg-slate-50 border border-slate-100">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                            Customer
                          </p>
                          <p className="mt-1 sm:mt-1.5 text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 break-words leading-tight">
                            {r.name || '—'}
                          </p>
                        </div>
                        <div className="p-3 sm:p-5 rounded-2xl bg-slate-50 border border-slate-100">
                          <div className="flex flex-col gap-1.5 sm:gap-2">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                              Outstanding
                            </p>
                            <p className={cn('text-2xl sm:text-3xl font-black tracking-tight leading-none', amountColor)}>
                              {formatRupee(due)}
                            </p>
                            <div>
                              <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ring-1 text-[10px] font-black uppercase tracking-[0.18em]', statusPill)}>
                                <span className={cn('w-1.5 h-1.5 rounded-full', due > 0 ? 'bg-red-500' : due < 0 ? 'bg-emerald-500' : 'bg-slate-400')} />
                                {statusLabel}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-1.5 sm:mt-4 border-t border-slate-100 pt-1.5 sm:pt-4">
                        <div className="grid grid-cols-2 sm:grid-cols-2 gap-2.5 sm:gap-3">
                          <div className="p-3 sm:p-4 rounded-2xl bg-white border border-slate-100 ring-1 ring-slate-100 min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                              Last Transaction
                            </p>
                            <p className="text-sm font-black text-slate-800 mt-1 break-words">
                              {r.lastTransactionDate ? formatDDMonYYYY(r.lastTransactionDate) : 'No transaction yet'}
                            </p>
                          </div>
                          <div className="p-3 sm:p-4 rounded-2xl bg-white border border-slate-100 ring-1 ring-slate-100 min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                              Last Payment
                            </p>
                            <p className="text-sm font-black text-slate-800 mt-1 break-words">
                              {r.lastPaymentDate && typeof r.lastPaymentAmount === 'number'
                                ? '₹' + Math.abs(r.lastPaymentAmount).toLocaleString('en-IN')
                                : 'No payment recorded'}
                            </p>
                          </div>
                        </div>
                      </div>
                      </div>

                      <div className={cn(
                        'w-full rounded-b-[26px] px-4 sm:px-5 py-4 sm:py-5',
                        paidRelative
                          ? 'bg-emerald-800 text-white'
                          : 'bg-red-800 text-white'
                      )}>
                        <p className={cn(
                          'text-[10px] font-black uppercase tracking-[0.22em]',
                          paidRelative ? 'text-emerald-100/90' : 'text-red-100/90'
                        )}>
                          Paid
                        </p>
                        <p className="mt-1 text-sm sm:text-[15px] font-black leading-tight break-words">
                          {paidRelative ?? 'No payment recorded'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="h-6" />
      </div>
    </Layout>
  );
};

const SettingsScreen = () => {
  const { user, updateUser, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.name || '');
  const [shopName, setShopName] = useState(user?.shopName || '');
  const [mobile, setMobile] = useState(user?.mobile || '');
  const [smsFormat, setSmsFormat] = useState(user?.smsFormat || '');
  const [txSmsFormat, setTxSmsFormat] = useState(user?.txSmsFormat || '');
  const [bulkSmsFormat, setBulkSmsFormat] = useState(user?.bulkSmsFormat || '');
  const [saving, setSaving] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const normalizedMobile = normalizeMobile(mobile);
    await updateUser({ name, shopName, mobile: normalizedMobile, smsFormat, txSmsFormat, bulkSmsFormat });
    setSaving(false);
  };

  return (
    <Layout title="सेटिंग्स" showBack backTo="/" hideLogout>
      <div className="p-4 space-y-6">
        {/* Appearance Section */}
        <div className={cn(
          "p-6 rounded-3xl border shadow-sm space-y-4",
          theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
        )}>
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">दिखावट (Appearance)</h3>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center",
                theme === 'dark' ? "bg-slate-800 text-amber-400" : "bg-slate-100 text-slate-600"
              )}>
                {theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
              </div>
              <div>
                <p className="font-bold">डार्क मोड</p>
                <p className="text-xs text-slate-500">लाइट और डार्क थीम के बीच स्विच करें</p>
              </div>
            </div>
            <button 
              onClick={toggleTheme}
              className={cn(
                "w-14 h-8 rounded-full relative transition-colors duration-300",
                theme === 'dark' ? "bg-indigo-600" : "bg-slate-200"
              )}
            >
              <div className={cn(
                "absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300",
                theme === 'dark' ? "left-7" : "left-1"
              )} />
            </button>
          </div>
        </div>

        {/* Shop Details Section */}
        <form onSubmit={handleSave} className={cn(
          "p-6 rounded-3xl border shadow-sm space-y-6",
          theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
        )}>
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
            {user?.role === 'customer' ? "प्रोफ़ाइल और संपर्क" : "दुकान और संपर्क"}
          </h3>
          
          <div className="space-y-4">
            {user?.role === 'customer' ? (
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">आपका नाम</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={cn(
                    "w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all",
                    theme === 'dark' ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200"
                  )}
                  placeholder="अपना नाम दर्ज करें"
                />
              </div>
            ) : (
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">दुकान का नाम</label>
                <input 
                  type="text" 
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  className={cn(
                    "w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all",
                    theme === 'dark' ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200"
                  )}
                  placeholder="दुकान का नाम दर्ज करें"
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">मोबाइल नंबर</label>
              <input 
                type="tel" 
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                className={cn(
                  "w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all",
                  theme === 'dark' ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200"
                )}
                placeholder="मोबाइल नंबर दर्ज करें"
              />
            </div>
          </div>

          {user?.role !== 'customer' && (
            <div className="space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">SMS फॉर्मेट</h3>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">रिमाइंडर मैसेज</label>
                <textarea 
                  rows={3}
                  value={smsFormat}
                  onChange={(e) => setSmsFormat(e.target.value)}
                  className={cn(
                    "w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none",
                    theme === 'dark' ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200"
                  )}
                  placeholder="रिमाइंडर मैसेज फॉर्मेट..."
                />
                <p className="text-[10px] text-slate-500 font-medium">प्लेसहोल्डर: {'{name}'}, {'{amount}'}, {'{type}'}</p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">ट्रांसक्शन मैसेज</label>
                <textarea 
                  rows={3}
                  value={txSmsFormat}
                  onChange={(e) => setTxSmsFormat(e.target.value)}
                  className={cn(
                    "w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none",
                    theme === 'dark' ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200"
                  )}
                  placeholder="ट्रांसक्शन मैसेज फॉर्मेट..."
                />
                <p className="text-[10px] text-slate-500 font-medium">प्लेसहोल्डर: {'{name}'}, {'{amount}'}, {'{type}'}, {'{balance}'}</p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">बल्क (प्रमोशनल) मैसेज</label>
                <textarea 
                  rows={3}
                  value={bulkSmsFormat}
                  onChange={(e) => setBulkSmsFormat(e.target.value)}
                  className={cn(
                    "w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none",
                    theme === 'dark' ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200"
                  )}
                  placeholder="बल्क मैसेज फॉर्मेट..."
                />
                <p className="text-[10px] text-slate-500 font-medium">प्लेसहोल्डर: {'{name}'}, {'{shopName}'}</p>
              </div>
            </div>
          )}

          <button 
            type="submit"
            disabled={saving}
            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={20} />}
            बदलाव सुरक्षित करें
          </button>
        </form>

        {/* Subscription Section */}
        <div className="pt-4">
          <button 
            onClick={() => navigate('/subscription')}
            className={cn(
              "w-full p-5 rounded-[2rem] border flex items-center justify-between group transition-all active:scale-[0.98]",
              theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100 shadow-sm"
            )}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Zap size={24} fill="currentColor" />
              </div>
              <div className="text-left">
                <h4 className={cn("font-black text-base", theme === 'dark' ? "text-slate-100" : "text-slate-900")}>प्रीमियम सदस्यता</h4>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                  {isSubscriptionActive(user) ? "सक्रिय (Active)" : "सब्सक्राइब करें"}
                </p>
              </div>
            </div>
            <ChevronRight size={20} className="text-slate-400 group-hover:text-indigo-600 transition-colors" />
          </button>
        </div>

        {/* Logout Section */}
        <div className="pt-4">
          <button 
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full py-4 text-red-500 font-bold hover:bg-red-50 dark:hover:bg-red-900/20 rounded-2xl transition-all flex items-center justify-center gap-2"
          >
            <LogOut size={20} />
            ऐप से लॉगआउट करें
          </button>
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLogoutConfirm(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={cn(
                "relative w-full max-w-xs rounded-[2.5rem] p-8 shadow-2xl text-center space-y-6",
                theme === 'dark' ? "bg-slate-900" : "bg-white"
              )}
            >
              <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto">
                <LogOut size={32} />
              </div>
              <div className="space-y-2">
                <h3 className={cn("text-xl font-bold", theme === 'dark' ? "text-white" : "text-slate-900")}>लॉगआउट करें?</h3>
                <p className="text-slate-500 text-sm font-medium">क्या आप वाकई अपने अकाउंट से लॉगआउट करना चाहते हैं?</p>
              </div>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={logout}
                  className="w-full py-4 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-100"
                >
                  हाँ, लॉगआउट करें
                </button>
                <button 
                  onClick={() => setShowLogoutConfirm(false)}
                  className="w-full py-4 text-slate-500 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-all"
                >
                  रद्द करें
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Layout>
  );
};

const SubscriptionScreenWrapper = () => {
  const { user, updateUser } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();

  return (
    <SubscriptionScreen 
      user={user}
      updateUser={updateUser}
      theme={theme}
      navigate={navigate}
      isSubscriptionActive={isSubscriptionActive}
      toJSDate={toJSDate}
      cn={cn}
      Layout={Layout}
    />
  );
};

const LoginScreen = () => {
  const { login, loginEmail, completeSignUpFlow, forgotPasswordEmail } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [signUpName, setSignUpName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpMobile, setSignUpMobile] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpConfirm, setSignUpConfirm] = useState('');
  const [signUpRole, setSignUpRole] = useState<'shopkeeper' | 'customer'>('shopkeeper');
  const [signUpMessage, setSignUpMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMessage, setForgotMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return alert('Please enter email and password.');
    setLoading(true);
    try {
      await loginEmail(email, password);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignUpMessage(null);
    if (!signUpName.trim()) {
      setSignUpMessage({ ok: false, text: 'Please enter your full name.' });
      return;
    }
    if (!emailRegex.test(signUpEmail.trim())) {
      setSignUpMessage({ ok: false, text: 'Please enter a valid email.' });
      return;
    }
    if (normalizeMobile(signUpMobile).length < 10) {
      setSignUpMessage({ ok: false, text: 'Please enter a valid 10-digit mobile number.' });
      return;
    }
    if (!signUpPassword) {
      setSignUpMessage({ ok: false, text: 'Please enter a password.' });
      return;
    }
    if (signUpPassword !== signUpConfirm) {
      setSignUpMessage({ ok: false, text: 'Passwords do not match.' });
      return;
    }
    if (signUpRole !== 'shopkeeper' && signUpRole !== 'customer') {
      setSignUpMessage({ ok: false, text: 'Please select a role.' });
      return;
    }

    setLoading(true);
    try {
      const result = await completeSignUpFlow(
        signUpName.trim(),
        signUpEmail.trim(),
        signUpPassword,
        signUpRole,
        signUpMobile
      );
      if (result.ok) {
        setSignUpName('');
        setSignUpEmail('');
        setSignUpMobile('');
        setSignUpPassword('');
        setSignUpConfirm('');
        setSignUpRole('shopkeeper');
        setSignUpMessage({ ok: true, text: result.message });
        setTimeout(() => {
          setSignUpMessage(null);
          setMode('login');
        }, 1500);
      } else {
        setSignUpMessage({ ok: false, text: result.message });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotMessage(null);
    if (!emailRegex.test(forgotEmail.trim())) {
      setForgotMessage({ ok: false, text: 'Please enter a valid email.' });
      return;
    }
    setLoading(true);
    try {
      const result = await forgotPasswordEmail(forgotEmail);
      setForgotMessage({ ok: result.ok, text: result.message });
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    'w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500';
  const labelCls = 'text-xs font-bold text-slate-500 uppercase tracking-wider';
  const primaryBtnCls =
    'w-full py-4 px-6 bg-slate-900 text-white rounded-2xl font-semibold flex items-center justify-center gap-3 hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-60 disabled:active:scale-100';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm space-y-8"
      >
        <div className="space-y-2">
          <div className="w-20 h-20 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-xl shadow-indigo-200">
            <FileText size={40} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">KhataBook Pro</h1>
          <p className="text-slate-500">अपने किराना उधार को आसानी से मैनेज करें</p>
        </div>

        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 space-y-6">
          <p className="text-sm text-slate-600">
            अपने व्यापार की उधारी और ग्राहकों का बैलेंस एक ही जगह सुरक्षित रूप से मैनेज करें।
          </p>

          <button
            onClick={login}
            disabled={loading}
            className="w-full py-4 px-6 bg-slate-900 text-white rounded-2xl font-semibold flex items-center justify-center gap-3 hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-60 disabled:active:scale-100"
          >
            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
            Continue with Google
          </button>

          <div className="flex items-center gap-3">
            <hr className="flex-1 border-slate-100" />
            <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">OR</span>
            <hr className="flex-1 border-slate-100" />
          </div>
          <p className="text-center text-sm font-semibold text-slate-600">Login with Email &amp; Password</p>

          {mode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-5">
              <div className="space-y-1 text-left">
                <label className={labelCls}>Email ID</label>
                <input
                  required
                  type="email"
                  className={inputCls}
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-1 text-left">
                <label className={labelCls}>Password</label>
                <input
                  required
                  type="password"
                  className={inputCls}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
              </div>

              <button type="submit" disabled={loading || !email || !password} className={primaryBtnCls}>
                {loading ? 'Please wait…' : 'Login'}
              </button>

              <div className="flex items-center justify-between text-sm font-medium text-indigo-600">
                <button type="button" onClick={() => { setMode('forgot'); setForgotMessage(null); }} className="hover:underline">
                  Forgot Password?
                </button>
                <button type="button" onClick={() => setMode('signup')} className="hover:underline">
                  New user? Sign Up
                </button>
              </div>
            </form>
          )}

          {mode === 'signup' && (
            <form onSubmit={handleSignUpSubmit} className="space-y-5">
              <div className="text-left space-y-1">
                <label className={labelCls}>Full Name</label>
                <input required type="text" className={inputCls} placeholder="e.g. KAMLESH KUMAR"
                  value={signUpName} onChange={(e) => setSignUpName(e.target.value)} disabled={loading} />
              </div>
              <div className="text-left space-y-1">
                <label className={labelCls}>Email ID</label>
                <input required type="email" className={inputCls} placeholder="you@example.com"
                  value={signUpEmail} onChange={(e) => setSignUpEmail(e.target.value)} disabled={loading} />
              </div>
              <div className="text-left space-y-1">
                <label className={labelCls}>Mobile Number</label>
                <input required type="tel" className={inputCls} placeholder="e.g. 9876543210"
                  value={signUpMobile} onChange={(e) => setSignUpMobile(e.target.value)} disabled={loading} />
              </div>
              <div className="text-left space-y-1">
                <label className={labelCls}>Password</label>
                <input required type="password" className={inputCls} placeholder="Min 6 characters"
                  value={signUpPassword} onChange={(e) => setSignUpPassword(e.target.value)} disabled={loading} />
              </div>
              <div className="text-left space-y-1">
                <label className={labelCls}>Confirm Password</label>
                <input required type="password" className={inputCls} placeholder="Re-enter password"
                  value={signUpConfirm} onChange={(e) => setSignUpConfirm(e.target.value)} disabled={loading} />
              </div>

              <div className="space-y-1 text-left">
                <label className={labelCls}>I will use KhataBook Pro as a</label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setSignUpRole('shopkeeper')}
                    className={cn(
                      'flex-1 py-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2',
                      signUpRole === 'shopkeeper'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-slate-100 text-slate-400'
                    )}
                  >
                    <FileText size={24} />
                    <span className="text-xs font-bold uppercase tracking-wider">Shopkeeper</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSignUpRole('customer')}
                    className={cn(
                      'flex-1 py-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2',
                      signUpRole === 'customer'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-slate-100 text-slate-400'
                    )}
                  >
                    <UserIcon size={24} />
                    <span className="text-xs font-bold uppercase tracking-wider">Customer</span>
                  </button>
                </div>
              </div>

              {signUpMessage && (
                <p className={signUpMessage.ok ? 'text-sm text-emerald-600 font-medium text-center' : 'text-sm text-red-600 font-medium text-center'}>
                  {signUpMessage.text}
                </p>
              )}

              <button type="submit" disabled={loading} className={primaryBtnCls}>
                {loading ? 'Please wait…' : 'Sign Up'}
              </button>

              <div className="text-center text-sm font-medium text-indigo-600">
                <button type="button" onClick={() => setMode('login')} className="hover:underline">
                  Already have an account? Login
                </button>
              </div>
            </form>
          )}

          {mode === 'forgot' && (
            <form onSubmit={handleForgotSubmit} className="space-y-5">
              <div className="text-left space-y-1">
                <label className={labelCls}>Email ID</label>
                <input required type="email" className={inputCls} placeholder="you@example.com"
                  value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} disabled={loading} />
              </div>

              {forgotMessage && (
                <p className={forgotMessage.ok ? 'text-sm text-emerald-600 font-medium' : 'text-sm text-red-600 font-medium'}>
                  {forgotMessage.text}
                </p>
              )}

              <button type="submit" disabled={loading} className={primaryBtnCls}>
                {loading ? 'Please wait…' : 'Send Reset Email'}
              </button>

              <div className="text-center text-sm font-medium text-indigo-600">
                <button type="button" onClick={() => setMode('login')} className="hover:underline">
                  Back to Login
                </button>
              </div>
            </form>
          )}
        </div>

        <p className="text-xs text-slate-400 uppercase tracking-widest font-medium">किराना व्यापार के लिए बनाया गया</p>
      </motion.div>
    </div>
  );
};

const Dashboard = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isOnline = useOnlineStatus();
  useBackgroundSync();
  const isSubscribed = isSubscriptionActive(user);
  const activeTab = (searchParams.get('tab') as 'customers' | 'suppliers') || 'customers';
  const setActiveTab = (tab: 'customers' | 'suppliers') => {
    setSearchParams({ tab });
  };
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierBalances, setSupplierBalances] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [sortBy, setSortBy] = useState<'name' | 'sabse_naya' | 'sabse_purana' | 'adhikatam_rashi' | 'nyunatam_rashi'>('sabse_naya');
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [isAddingSupplier, setIsAddingSupplier] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkMessage, setBulkMessage] = useState('');
  const [newCustomer, setNewCustomer] = useState({ name: '', mobile: '', merchantCreditNetwork: { sharingEnabled: false } });
  const [newSupplier, setNewSupplier] = useState({ name: '', mobile: '' });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [reminderCustomer, setReminderCustomer] = useState<Customer | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isRemindersVisible, setIsRemindersVisible] = useState(true);
  const [sentReminderIds, setSentReminderIds] = useState<string[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const dueReminders = useMemo(() => {
    const currentHHmm = format(currentTime, 'HH:mm');
    const todayDate = format(currentTime, 'yyyy-MM-dd');

    return customers.filter(c => {
      // If we already sent a reminder in this session, keep it in the list
      if (sentReminderIds.includes(c.id)) return true;

      if (c.totalDue <= 0) return false;
      
      // Daily Reminder Logic
      const isDailyTimePassed = c.dailyReminderTime && currentHHmm >= c.dailyReminderTime;
      const isNotSentToday = c.lastReminderSentDate !== todayDate;
      const isDailyDue = isDailyTimePassed && isNotSentToday;
      
      // Collection Date Logic
      const collectionDate = c.reminderDate ? toJSDate(c.reminderDate) : null;
      const isCollectionDateDue = collectionDate && format(collectionDate, 'yyyy-MM-dd') <= todayDate;
      
      return isDailyDue || isCollectionDateDue;
    });
  }, [customers, currentTime, sentReminderIds]);

  const handleDashboardWhatsAppReminder = (customer: Customer) => {
    if (!user) return;
    const amount = Math.abs(customer.totalDue).toLocaleString();
    const type = customer.totalDue > 0 ? "बकाया (Udhar)" : "एडवांस (Advance)";
    
    let message = user.smsFormat || `नमस्ते {name}, Khatabook पर आपका ₹{amount} का {type} है। कृपया जल्द भुगतान करें। धन्यवाद।`;
    message = message.replace('{name}', customer.name)
                     .replace('{amount}', amount)
                     .replace('{type}', type);

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/91${customer.mobile}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
    
    // Add to sent list to keep it visible in this session
    setSentReminderIds(prev => [...new Set([...prev, customer.id])]);
    
    // Update lastReminderSentDate
    try {
      const todayDate = format(new Date(), 'yyyy-MM-dd');
      const updates: any = {
        lastReminderSentDate: todayDate
      };
      
      updateDoc(customerDocRef(customer.ownerId, customer.id), updates);
    } catch (error) {
      console.error("Error updating reminder status:", error);
    }

    setReminderCustomer(null);
  };

  const handleDashboardSMSReminder = (customer: Customer) => {
    if (!user) return;
    const amount = Math.abs(customer.totalDue).toLocaleString();
    const type = customer.totalDue > 0 ? "बकाया (Udhar)" : "एडवांस (Advance)";
    
    let message = user.smsFormat || `नमस्ते {name}, Khatabook पर आपका ₹{amount} का {type} है। कृपया जल्द भुगतान करें। धन्यवाद।`;
    message = message.replace('{name}', customer.name)
                     .replace('{amount}', amount)
                     .replace('{type}', type);

    const encodedMessage = encodeURIComponent(message);
    const smsUrl = `sms:+91${customer.mobile}?body=${encodedMessage}`;
    window.location.href = smsUrl;
    
    // Add to sent list to keep it visible in this session
    setSentReminderIds(prev => [...new Set([...prev, customer.id])]);
    
    // Update lastReminderSentDate
    try {
      const todayDate = format(new Date(), 'yyyy-MM-dd');
      const updates: any = {
        lastReminderSentDate: todayDate
      };
      
      updateDoc(customerDocRef(customer.ownerId, customer.id), updates);
    } catch (error) {
      console.error("Error updating reminder status:", error);
    }
    
    setReminderCustomer(null);
  };

  const handleDashboardCall = (customer: Customer) => {
    window.location.href = `tel:+91${customer.mobile}`;
    setSentReminderIds(prev => [...new Set([...prev, customer.id])]);
  };

  const handlePickFromContacts = async () => {
    // Check if running in an iframe (like the AI Studio preview)
    const isIframe = window.self !== window.top;
    
    if (isIframe) {
      // In AI Studio, we can't reliably use window.open(window.location.href) 
      // because it might open the iframe URL which is restricted.
      // We should tell the user to use the "Open in new tab" button in the AI Studio UI.
      alert("⚠️ सुरक्षा कारणों से, 'फोन से चुनें' फीचर केवल तभी काम करता है जब आप ऐप को नए टैब (New Tab) में खोलते हैं।\n\nकृपया ऊपर दिए गए 'Open in new tab' बटन पर क्लिक करें।");
      return;
    }

    if (!('contacts' in navigator && 'select' in (navigator as any).contacts)) {
      alert("आपका ब्राउज़र सीधे कॉन्टैक्ट चुनने का समर्थन नहीं करता है। कृपया मैन्युअल रूप से दर्ज करें।");
      return;
    }

    try {
      const props = ['name', 'tel'];
      const opts = { multiple: false };
      const contacts = await (navigator as any).contacts.select(props, opts);
      
      if (contacts.length > 0) {
        const contact = contacts[0];
        const name = contact.name?.[0] || '';
        const tel = contact.tel?.[0]?.replace(/\s+/g, '').replace(/[-()]/g, '') || '';
        
        // Clean up number (remove +91 if present)
        const cleanTel = tel.startsWith('+91') ? tel.slice(3) : tel.startsWith('0') ? tel.slice(1) : tel;
        
        setNewCustomer({ name, mobile: cleanTel, merchantCreditNetwork: { sharingEnabled: false } });
      }
    } catch (error: any) {
      console.error("Error picking contact:", error);
      if (error.name === 'SecurityError' || error.message.includes('top frame')) {
        alert("सुरक्षा प्रतिबंध: कृपया इस फीचर का उपयोग करने के लिए ऐप को नए टैब में खोलें।");
      } else if (error.name !== 'AbortError') {
        alert("कॉन्टैक्ट्स तक नहीं पहुँचा जा सका। कृपया सुनिश्चित करें कि आपने अनुमति दी है।");
      }
    }
  };

  useEffect(() => {
    if (!user) return;
    const q = query(customerCollectionRef(user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/customers`));
    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(supplierCollectionRef(user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSuppliers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/suppliers`));
    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsubsBySupplierId: Record<string, () => void> = {};

    const calculateBalance = (txs: SupplierTransaction[]) => {
      let bal = 0;
      for (const tx of txs) {
        if (tx.type === 'udhar') bal += tx.amount;
        else bal -= tx.amount;
      }
      return bal;
    };

    const snapshotListener = onSnapshot(query(supplierCollectionRef(user.uid)), (supplierSnap) => {
      const currentSupplierIds = new Set<string>();
      supplierSnap.forEach(doc => currentSupplierIds.add(doc.id));

      // Stop listening to removed suppliers
      Object.keys(unsubsBySupplierId).forEach(existingId => {
        if (!currentSupplierIds.has(existingId) && unsubsBySupplierId[existingId]) {
          unsubsBySupplierId[existingId]();
          delete unsubsBySupplierId[existingId];
          setSupplierBalances(prev => {
            if (!(existingId in prev)) return prev;
            const next = { ...prev };
            delete next[existingId];
            return next;
          });
        }
      });

      // Start listening to new suppliers
      currentSupplierIds.forEach(sid => {
        if (unsubsBySupplierId[sid]) return;
        const unsubTx = onSnapshot(
          query(supplierTxCollectionRef(user.uid, sid)),
          (txSnap) => {
            const txs = txSnap.docs.map(d => ({ id: d.id, ...d.data() } as SupplierTransaction));
            const bal = calculateBalance(txs);
            setSupplierBalances(prev => ({ ...prev, [sid]: bal }));
          },
          (error) => handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/suppliers/${sid}/transactions`)
        );
        unsubsBySupplierId[sid] = unsubTx;
      });
    }, (error) => handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/suppliers`));

    return () => {
      snapshotListener();
      Object.values(unsubsBySupplierId).forEach(fn => { try { fn(); } catch {} });
    };
  }, [user]);

  const stats = useMemo(() => {
    if (activeTab === 'customers') {
      return customers.reduce((acc, curr) => {
        if (curr.totalDue > 0) acc.youWillGet += curr.totalDue;
        else acc.youWillGive += Math.abs(curr.totalDue);
        return acc;
      }, { youWillGet: 0, youWillGive: 0 });
    }
    return suppliers.reduce((acc, curr) => {
      const bal = supplierBalances[curr.id] !== undefined ? supplierBalances[curr.id] : (curr.totalDue || 0);
      if (bal > 0) acc.youWillGet += bal;
      else acc.youWillGive += Math.abs(bal);
      return acc;
    }, { youWillGet: 0, youWillGive: 0 });
  }, [customers, suppliers, supplierBalances, activeTab]);

  const filteredItems = useMemo(() => {
    const items = activeTab === 'customers' ? customers : suppliers;
    let result = items.filter(c => 
      c.name.toLowerCase().includes(search.toLowerCase()) || 
      c.mobile.includes(search)
    );

    const getBalance = (item: Customer | Supplier) => {
      if (activeTab === 'suppliers') {
        const s = item as Supplier;
        return supplierBalances[s.id] !== undefined ? supplierBalances[s.id] : (item.totalDue || 0);
      }
      return item.totalDue || 0;
    };

    switch (sortBy) {
      case 'sabse_naya':
        result.sort((a, b) => getMillis(b.lastUpdatedAt) - getMillis(a.lastUpdatedAt));
        break;
      case 'sabse_purana':
        result.sort((a, b) => getMillis(a.createdAt) - getMillis(b.createdAt));
        break;
      case 'adhikatam_rashi':
        result.sort((a, b) => getBalance(b) - getBalance(a));
        break;
      case 'nyunatam_rashi':
        result.sort((a, b) => getBalance(a) - getBalance(b));
        break;
      default:
        result.sort((a, b) => a.name.localeCompare(b.name));
    }
    return result;
  }, [customers, suppliers, supplierBalances, search, sortBy, activeTab]);

  const toggleBulkMode = () => {
    setIsBulkMode(!isBulkMode);
    setSelectedItemIds([]);
  };

  const isKeyboardVisible = useKeyboardVisible();

  const toggleItemSelection = (id: string) => {
    setSelectedItemIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedItemIds(filteredItems.map(c => c.id));
  };

  const deselectAll = () => {
    setSelectedItemIds([]);
  };

  const selectBakaya = () => {
    setSelectedItemIds(filteredItems.filter(c => c.totalDue > 0).map(c => c.id));
  };

  const selectJama = () => {
    setSelectedItemIds(filteredItems.filter(c => c.totalDue < 0).map(c => c.id));
  };

  const selectZero = () => {
    setSelectedItemIds(filteredItems.filter(c => c.totalDue === 0).map(c => c.id));
  };

  const handleOpenBulkModal = () => {
    if (selectedItemIds.length === 0) {
      alert(`कृपया कम से कम एक ${activeTab === 'customers' ? 'ग्राहक' : 'सप्लायर'} चुनें।`);
      return;
    }
    const defaultFormat = user?.bulkSmsFormat || "नमस्ते {name}, हमारी दुकान {shopName} पर नए ऑफर्स उपलब्ध हैं। अधिक जानकारी के लिए संपर्क करें।";
    setBulkMessage(defaultFormat);
    setIsBulkModalOpen(true);
  };

  const handleSendBulkMessage = (type: 'whatsapp' | 'sms') => {
    const items = activeTab === 'customers' ? customers : suppliers;
    const selectedItems = items.filter(c => selectedItemIds.includes(c.id));
    
    selectedItems.forEach((item, index) => {
      // We use a small delay to prevent browser from blocking multiple popups
      setTimeout(() => {
        let message = bulkMessage
          .replace(/{name}/g, item.name)
          .replace(/{shopName}/g, user?.shopName || 'हमारी दुकान');
        
        const encodedMessage = encodeURIComponent(message);
        const url = type === 'whatsapp' 
          ? `https://wa.me/91${item.mobile}?text=${encodedMessage}`
          : `sms:+91${item.mobile}?body=${encodedMessage}`;
        
        window.open(url, '_blank');
      }, index * 1000);
    });
    
    setIsBulkModalOpen(false);
    setIsBulkMode(false);
    setSelectedItemIds([]);
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const normalizedMobile = normalizeMobile(newCustomer.mobile);

    // Check for duplicate customer by mobile number
    const duplicate = customers.find(c => normalizeMobile(c.mobile) === normalizedMobile);
    if (duplicate) {
      navigate(`/customer/${duplicate.id}`);
      setIsAddingCustomer(false);
      setNewCustomer({ name: '', mobile: '', merchantCreditNetwork: { sharingEnabled: false } });
      setPhotoFile(null);
      return;
    }

    // Check for duplicate customer by mobile number or name
    const duplicateCustomer = customers.find(c => 
      (normalizeMobile(c.mobile) === normalizedMobile && normalizedMobile !== '') || 
      (c.name.trim().toLowerCase() === newCustomer.name.trim().toLowerCase())
    );
    if (duplicateCustomer) {
      alert(`ग्राहक "${duplicateCustomer.name}" पहले से ही मौजूद है।`);
      navigate(`/customer/${duplicateCustomer.id}`);
      setIsAddingCustomer(false);
      setNewCustomer({ name: '', mobile: '', merchantCreditNetwork: { sharingEnabled: false } });
      setPhotoFile(null);
      return;
    }

    setUploading(true);
    try {
      let photoURL = '';
      let pendingFile: File | null = null;

      // 1. Create doc ref FIRST to get stable customerId for storage path
      const docRef = doc(customerCollectionRef(user.uid));
      const customerPhotoPath = `customers/${user.uid}/${docRef.id}/profile.jpg`;

      if (photoFile) {
        if (isOnline) {
          try {
            photoURL = await uploadToStorage(photoFile, customerPhotoPath);
          } catch (error) {
            console.error("Photo upload failed, saving locally for sync", error);
            photoURL = URL.createObjectURL(photoFile);
            pendingFile = photoFile;
          }
        } else {
          console.warn("Offline: saving photo locally for sync");
          photoURL = URL.createObjectURL(photoFile);
          pendingFile = photoFile;
        }
      }

      const customerData = {
        ...newCustomer,
        mobile: normalizedMobile,
        photoURL,
        ownerId: user.uid,
        totalDue: 0,
        createdAt: Timestamp.now(),
        lastUpdatedAt: Timestamp.now(),
        merchantCreditNetwork: {
          sharingEnabled: !!newCustomer.merchantCreditNetwork?.sharingEnabled
        }
      };

      await setDoc(docRef, customerData);
      
      if (pendingFile) {
        await savePendingUpload(
          pendingFile, 
          customerPhotoPath, 
          docRef.id, 
          'customers',
          'photoURL',
          user.uid
        );
      }

      setNewCustomer({ name: '', mobile: '', merchantCreditNetwork: { sharingEnabled: false } });
      setPhotoFile(null);
      setIsAddingCustomer(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'customers');
    } finally {
      setUploading(false);
    }
  };

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const normalizedMobile = normalizeMobile(newSupplier.mobile);

    // Check for duplicate supplier by mobile number or name
    const duplicate = suppliers.find(s => 
      (normalizeMobile(s.mobile) === normalizedMobile && normalizedMobile !== '') || 
      (s.name.trim().toLowerCase() === newSupplier.name.trim().toLowerCase())
    );
    if (duplicate) {
      alert(`सप्लायर "${duplicate.name}" पहले से ही मौजूद है।`);
      navigate(`/supplier/${duplicate.id}`);
      setIsAddingSupplier(false);
      setNewSupplier({ name: '', mobile: '' });
      setPhotoFile(null);
      return;
    }

    setUploading(true);
    try {
      let photoURL = '';
      let pendingFile: File | null = null;
      const docRef = doc(supplierCollectionRef(user.uid));
      const supplierPhotoPath = `suppliers/${user.uid}/${docRef.id}/profile.jpg`;

      if (photoFile) {
        if (isOnline) {
          try {
            photoURL = await uploadToStorage(photoFile, supplierPhotoPath);
          } catch (error) {
            console.error("Photo upload failed, saving locally for sync", error);
            photoURL = URL.createObjectURL(photoFile);
            pendingFile = photoFile;
          }
        } else {
          console.warn("Offline: saving photo locally for sync");
          photoURL = URL.createObjectURL(photoFile);
          pendingFile = photoFile;
        }
      }

      const supplierData = {
        ...newSupplier,
        mobile: normalizedMobile,
        photoURL,
        ownerId: user.uid,
        totalDue: 0,
        createdAt: Timestamp.now(),
        lastUpdatedAt: Timestamp.now()
      };

      await setDoc(docRef, supplierData);
      
      if (pendingFile) {
        await savePendingUpload(
          pendingFile, 
          supplierPhotoPath, 
          docRef.id, 
          'suppliers',
          'photoURL',
          user.uid
        );
      }

      setNewSupplier({ name: '', mobile: '' });
      setPhotoFile(null);
      setIsAddingSupplier(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'suppliers');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Layout 
      title={user?.shopName || (activeTab === 'customers' ? "मेरे ग्राहक" : "मेरे सप्लायर")} 
      showTabs 
      activeTab={activeTab} 
      bottomNavActive="parties"
      onCreditCheck={() => navigate('/credit-check')}
      onTabChange={(tab) => {
        setActiveTab(tab);
        setIsBulkMode(false);
        setSelectedItemIds([]);
      }}
    >
      <div className="p-4 space-y-4 pb-24">
        {/* Bulk Mode Toggle & Stats */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest">डैशबोर्ड</h2>
          <button 
            onClick={toggleBulkMode}
            className={cn(
              "px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2",
              isBulkMode 
                ? "bg-red-100 text-red-600 border border-red-200" 
                : isSubscribed ? "bg-indigo-50 text-indigo-600 border border-indigo-100" : "bg-amber-100 text-amber-700 border border-amber-200"
            )}
          >
            {isBulkMode ? <X size={12} /> : isSubscribed ? <MessageCircle size={12} /> : <Zap size={12} />}
            {isBulkMode ? "कैंसिल करें" : isSubscribed ? "बल्क मैसेज" : "प्रीमियम (बल्क मैसेज)"}
          </button>
        </div>

        {/* Due Reminders Section */}
        {activeTab === 'customers' && dueReminders.length > 0 && !isBulkMode && isRemindersVisible && (
          <div className="space-y-3 animate-in fade-in slide-in-from-top-4 duration-500 relative">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setIsRemindersVisible(false)}
                  className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-full hover:bg-slate-200 transition-colors"
                >
                  <X size={12} />
                </button>
                <h2 className="text-[10px] font-black text-amber-600 uppercase tracking-[0.2em] flex items-center gap-2">
                  <Bell size={12} className="animate-bounce" /> आज के रिमाइंडर ({dueReminders.length})
                </h2>
              </div>
            </div>
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
              {dueReminders.map(customer => (
                <div 
                  key={customer.id}
                  onClick={() => navigate(`/customer/${customer.id}`)}
                  className={cn(
                    "min-w-[200px] p-4 rounded-3xl border-2 shadow-lg flex flex-col gap-3 transition-all cursor-pointer active:scale-[0.98]",
                    theme === 'dark' ? "bg-slate-900 border-amber-900/30" : "bg-amber-50 border-amber-100"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center font-black">
                      {customer.name[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-black text-slate-900 dark:text-white truncate">{customer.name}</h3>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">₹{customer.totalDue.toLocaleString()} बकाया</p>
                        {customer.dailyReminderTime && (
                          <span className="text-[8px] font-black bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded uppercase tracking-tighter flex items-center gap-1">
                            <Clock size={8} /> {format(new Date(`2000-01-01T${customer.dailyReminderTime}`), 'hh:mm a')}
                          </span>
                        )}
                        {customer.reminderDate && format(toJSDate(customer.reminderDate), 'yyyy-MM-dd') <= format(currentTime, 'yyyy-MM-dd') && (
                          <span className="text-[8px] font-black bg-red-100 text-red-600 px-1.5 py-0.5 rounded uppercase tracking-tighter">कलेक्शन तारीख</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDashboardWhatsAppReminder(customer);
                      }}
                      className="flex-1 py-2 bg-emerald-500 text-white rounded-xl shadow-md shadow-emerald-200 dark:shadow-none active:scale-90 transition-all flex items-center justify-center"
                      title="WhatsApp"
                    >
                      <MessageCircle size={18} fill="currentColor" />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDashboardSMSReminder(customer);
                      }}
                      className="flex-1 py-2 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-200 dark:shadow-none active:scale-90 transition-all flex items-center justify-center"
                      title="SMS"
                    >
                      <MessageSquare size={18} fill="currentColor" />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDashboardCall(customer);
                      }}
                      className="flex-1 py-2 bg-blue-500 text-white rounded-xl shadow-md shadow-blue-200 dark:shadow-none active:scale-90 transition-all flex items-center justify-center"
                      title="Call"
                    >
                      <Phone size={18} fill="currentColor" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats Card - Professional Combined View */}
        <div className={cn(
          "rounded-2xl border shadow-md overflow-hidden",
          theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
        )}>
          <div className="flex divide-x divide-slate-100 dark:divide-slate-800">
            <div className="flex-1 p-4 text-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">आप देंगे</p>
              <p className="text-xl font-bold text-emerald-600">₹{stats.youWillGive.toLocaleString()}</p>
            </div>
            <div className="flex-1 p-4 text-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">आपको मिलेंगे</p>
              <p className="text-xl font-bold text-red-600">₹{stats.youWillGet.toLocaleString()}</p>
            </div>
          </div>
          <button className="w-full py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-center gap-2 text-xs font-bold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors">
            <FileText size={14} />
            रिपोर्ट देखें
          </button>
        </div>

        {/* Search & Filter - Integrated Look */}
        {!isBulkMode ? (
          <div className={cn(
            "sticky top-16 z-20 flex items-center gap-2 p-1 rounded-2xl border shadow-sm",
            theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
          )}>
            <div className="relative flex-1">
              {(search || isSearchFocused) ? (
                <button 
                  onClick={() => {
                    setSearch('');
                    searchInputRef.current?.blur();
                  }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={18} />
                </button>
              ) : (
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              )}
              <input 
                ref={searchInputRef}
                type="text" 
                placeholder={activeTab === 'customers' ? "ग्राहक खोजें" : "सप्लायर खोजें"} 
                className={cn(
                  "w-full pl-10 pr-4 py-2.5 bg-transparent focus:outline-none text-sm",
                  theme === 'dark' ? "text-white" : "text-slate-900"
                )}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
              />
            </div>
            <div className="h-8 w-px bg-slate-100 dark:bg-slate-800" />
            <div className="relative px-2">
              <select 
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className={cn(
                  "appearance-none bg-transparent pl-2 pr-8 py-2 text-xs font-bold focus:outline-none cursor-pointer",
                  theme === 'dark' ? "text-slate-300" : "text-slate-700"
                )}
              >
                <option value="sabse_naya">सबसे नया</option>
                <option value="sabse_purana">सबसे पुराना</option>
                <option value="adhikatam_rashi">अधिकतम राशि</option>
                <option value="nyunatam_rashi">न्यूनतम राशि</option>
                <option value="name">A-Z (नाम से)</option>
              </select>
              <Filter className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 p-2">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 max-w-[70%]">
              <button 
                onClick={selectAll}
                className="whitespace-nowrap px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-[10px] font-bold rounded-lg"
              >
                सब चुनें
              </button>
              <button 
                onClick={deselectAll}
                className="whitespace-nowrap px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-[10px] font-bold rounded-lg"
              >
                सब हटाएं
              </button>
              <button 
                onClick={selectBakaya}
                className="whitespace-nowrap px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 text-[10px] font-bold rounded-lg border border-red-100 dark:border-red-800"
              >
                बकाया वाले
              </button>
              <button 
                onClick={selectJama}
                className="whitespace-nowrap px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 text-[10px] font-bold rounded-lg border border-emerald-100 dark:border-emerald-800"
              >
                जमा वाले
              </button>
              <button 
                onClick={selectZero}
                className="whitespace-nowrap px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold rounded-lg border border-slate-200 dark:border-slate-700"
              >
                जीरो बैलेंस
              </button>
            </div>
            <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest shrink-0">
              {selectedItemIds.length} {activeTab === 'customers' ? 'ग्राहक' : 'सप्लायर'} चुने गए
            </p>
          </div>
        )}

        {/* Customer/Supplier List - Clean Professional Cards */}
        <div className="space-y-2">
          {filteredItems.length > 0 ? (
            filteredItems.map((item) => {
              const isSelected = selectedItemIds.includes(item.id);
              const itemBalance = (() => {
                if (activeTab === 'suppliers') return supplierBalances[item.id] !== undefined ? supplierBalances[item.id] : (item.totalDue || 0);
                return item.totalDue || 0;
              })();
              
              return isBulkMode ? (
                <div 
                  key={item.id}
                  onClick={() => toggleItemSelection(item.id)}
                  className={cn(
                    "flex items-center justify-between p-4 rounded-2xl border shadow-sm transition-all cursor-pointer",
                    isSelected 
                      ? "bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800" 
                      : theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all",
                      isSelected 
                        ? "bg-indigo-600 border-indigo-600 text-white" 
                        : "border-slate-300 dark:border-slate-700"
                    )}>
                      {isSelected && <Check size={14} strokeWidth={3} />}
                    </div>
                    <div className="flex items-center gap-3">
                      {item.photoURL ? (
                        <img 
                          src={item.photoURL} 
                          alt={item.name} 
                          className="w-10 h-10 rounded-full object-cover border-2 border-white dark:border-slate-800"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-2 border-white dark:border-slate-800",
                          theme === 'dark' ? "bg-slate-800 text-indigo-400" : "bg-indigo-50 text-indigo-600"
                        )}>
                          {item.name[0].toUpperCase()}
                        </div>
                      )}
                      <div>
                        <h3 className={cn("font-bold text-sm", theme === 'dark' ? "text-slate-100" : "text-slate-900")}>{item.name}</h3>
                        <p className="text-[10px] text-slate-500">{item.mobile}</p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn(
                      "font-bold text-sm",
                      itemBalance > 0 ? "text-red-600" : itemBalance < 0 ? "text-emerald-600" : "text-slate-400"
                    )}>
                      ₹{Math.abs(itemBalance).toLocaleString()}
                    </p>
                  </div>
                </div>
              ) : (
                <Link 
                  key={item.id}
                  to={`/${activeTab === 'customers' ? 'customer' : 'supplier'}/${item.id}`}
                  className={cn(
                    "flex items-center justify-between p-4 rounded-2xl border shadow-sm transition-all active:scale-[0.98] hover:shadow-md",
                    theme === 'dark' ? "bg-slate-900 border-slate-800 hover:border-indigo-900" : "bg-white border-slate-200 hover:border-indigo-200"
                  )}
                >
                  <div className="flex items-center gap-3">
                    {item.photoURL ? (
                      <img 
                        src={item.photoURL} 
                        alt={item.name} 
                        className="w-12 h-12 rounded-full object-cover border-2 border-white dark:border-slate-800 shadow-sm"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg border-2 border-white dark:border-slate-800 shadow-sm",
                        theme === 'dark' ? "bg-slate-800 text-indigo-400" : "bg-indigo-50 text-indigo-600"
                      )}>
                        {item.name[0].toUpperCase()}
                      </div>
                    )}
                    <div>
                      <h3 className={cn("font-bold text-sm", theme === 'dark' ? "text-slate-100" : "text-slate-900")}>{item.name}</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        {formatRelativeTimeHindi(item.lastUpdatedAt)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1">
                    <p className={cn(
                      "font-black text-base",
                      itemBalance > 0 ? "text-red-600" : itemBalance < 0 ? "text-emerald-600" : "text-slate-400"
                    )}>
                      ₹{Math.abs(itemBalance).toLocaleString()}
                    </p>
                    {activeTab === 'customers' && itemBalance !== 0 && (
                      <button 
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setReminderCustomer(item as Customer);
                        }}
                        className="flex items-center gap-1 text-[10px] font-black text-indigo-600 uppercase tracking-tighter"
                      >
                        रिमाइंड कराएं <ChevronRight size={12} />
                      </button>
                    )}
                    {activeTab === 'suppliers' && (
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {itemBalance > 0 ? "आपको मिलेंगे" : itemBalance < 0 ? "आप देंगे" : "सेटल"}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })
          ) : (
            <div className="py-20 text-center space-y-3">
              <div className="w-20 h-20 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mx-auto">
                <UserIcon size={32} className="text-slate-300" />
              </div>
              <p className="text-slate-500 font-bold text-sm">कोई {activeTab === 'customers' ? 'ग्राहक' : 'सप्लायर'} नहीं मिला</p>
            </div>
          )}
        </div>
      </div>

      {/* Bulk Action Bar */}
      <AnimatePresence>
        {isBulkMode && (
          <motion.div 
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="fixed bottom-20 left-4 right-4 z-40"
          >
            <div className="bg-indigo-600 text-white p-4 rounded-3xl shadow-2xl flex items-center justify-between gap-4">
              <div className="flex-1">
                <p className="text-xs font-bold opacity-80 uppercase tracking-widest">चुने गए {activeTab === 'customers' ? 'ग्राहक' : 'सप्लायर'}</p>
                <p className="text-lg font-black">{selectedItemIds.length}</p>
              </div>
              <button 
                onClick={handleOpenBulkModal}
                className="px-6 py-3 bg-white text-indigo-600 rounded-2xl font-black text-sm uppercase tracking-wider shadow-lg active:scale-95 transition-all"
              >
                मैसेज भेजें
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk Message Modal */}
      <AnimatePresence>
        {isBulkModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsBulkModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className={cn(
                "relative w-full max-w-sm rounded-t-[2rem] sm:rounded-[2rem] p-6 shadow-2xl max-h-[90vh] overflow-y-auto",
                theme === 'dark' ? "bg-slate-900" : "bg-white"
              )}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-black">बल्क मैसेज भेजें</h2>
                <button onClick={() => setIsBulkModalOpen(false)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800">
                  <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-2">मैसेज फॉर्मेट</p>
                  <textarea 
                    rows={5}
                    value={bulkMessage}
                    onChange={(e) => setBulkMessage(e.target.value)}
                    className={cn(
                      "w-full bg-transparent border-none focus:outline-none text-sm font-medium resize-none",
                      theme === 'dark' ? "text-white" : "text-slate-900"
                    )}
                    placeholder="अपना मैसेज यहाँ लिखें..."
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="px-2 py-1 bg-white dark:bg-slate-800 text-[8px] font-bold rounded border border-indigo-100 dark:border-indigo-800">{'{name}'}</span>
                    <span className="px-2 py-1 bg-white dark:bg-slate-800 text-[8px] font-bold rounded border border-indigo-100 dark:border-indigo-800">{'{shopName}'}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => handleSendBulkMessage('whatsapp')}
                    className="flex flex-col items-center gap-2 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-2xl group active:scale-95 transition-all"
                  >
                    <div className="w-10 h-10 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-emerald-200 dark:shadow-none">
                      <MessageCircle size={20} />
                    </div>
                    <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">WhatsApp</span>
                  </button>
                  <button 
                    onClick={() => handleSendBulkMessage('sms')}
                    className="flex flex-col items-center gap-2 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-2xl group active:scale-95 transition-all"
                  >
                    <div className="w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-blue-200 dark:shadow-none">
                      <MessageSquare size={20} />
                    </div>
                    <span className="text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest">SMS</span>
                  </button>
                </div>

                <p className="text-[10px] text-slate-500 text-center leading-relaxed">
                  नोट: ब्राउज़र सुरक्षा के कारण, हर ग्राहक के लिए अलग टैब खुलेगा। कृपया एक-एक करके मैसेज भेजें।
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Action Button - Styled like KhataBook */}
      {!isKeyboardVisible && (
        <button 
          onClick={() => activeTab === 'customers' ? setIsAddingCustomer(true) : setIsAddingSupplier(true)}
          className="fixed bottom-20 right-4 px-6 py-3 bg-pink-600 text-white rounded-full shadow-xl shadow-pink-200 flex items-center gap-2 hover:bg-pink-700 transition-all active:scale-95 z-20 font-bold text-sm"
        >
          <UserPlus size={20} />
          {activeTab === 'customers' ? "ग्राहक जोड़ें" : "सप्लायर जोड़ें"}
        </button>
      )}

      {/* Add Supplier Modal */}
      <AnimatePresence>
        {isAddingSupplier && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsAddingSupplier(false);
                setPhotoFile(null);
              }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="relative w-full max-w-sm bg-white rounded-t-[2rem] sm:rounded-[2rem] p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <h2 className="text-xl font-bold mb-6">नया सप्लायर जोड़ें</h2>
              
              <form onSubmit={handleAddSupplier} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">नाम</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="जैसे: राहुल सप्लायर"
                    value={newSupplier.name}
                    onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1 relative">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">मोबाइल नंबर</label>
                  <input 
                    required
                    type="tel" 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="जैसे: 9876543210"
                    value={newSupplier.mobile}
                    onChange={(e) => {
                      setNewSupplier({ ...newSupplier, mobile: e.target.value });
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">फोटो (वैकल्पिक)</label>
                  <div className="flex flex-col gap-3">
                    <div className="flex gap-2">
                      <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 transition-all">
                        <ImageIcon size={20} className="text-slate-400" />
                        <span className="text-sm font-medium text-slate-600">गैलरी</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                        />
                      </label>
                      <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 transition-all">
                        <Camera size={20} className="text-slate-400" />
                        <span className="text-sm font-medium text-slate-600">कैमरा</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          capture="environment"
                          className="hidden" 
                          onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                        />
                      </label>
                    </div>
                    {photoFile && (
                      <div className="flex items-center justify-between p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                        <div className="flex items-center gap-2">
                          <ImageIcon size={16} className="text-indigo-500" />
                          <span className="text-xs font-bold text-indigo-700 truncate max-w-[150px]">{photoFile.name}</span>
                        </div>
                        <button 
                          type="button" 
                          onClick={() => setPhotoFile(null)}
                          className="p-1 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    disabled={uploading}
                    onClick={() => {
                      setIsAddingSupplier(false);
                      setPhotoFile(null);
                    }}
                    className="flex-1 py-3 text-slate-600 font-semibold hover:bg-slate-50 rounded-xl transition-colors disabled:opacity-50"
                  >
                    रद्द करें
                  </button>
                  <button 
                    type="submit"
                    disabled={uploading}
                    className="flex-1 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50"
                  >
                    {uploading ? "सुरक्षित हो रहा है..." : "सप्लायर सुरक्षित करें"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Customer Modal */}
      <AnimatePresence>
        {isAddingCustomer && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsAddingCustomer(false);
                setPhotoFile(null);
              }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="relative w-full max-w-sm bg-white rounded-t-[2rem] sm:rounded-[2rem] p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <h2 className="text-xl font-bold mb-6">नया ग्राहक जोड़ें</h2>
              
              {/* Contact Picker Section */}
              <div className="mb-6 space-y-4">
                {('contacts' in navigator) && (
                  <div className="space-y-2">
                    <button 
                      type="button"
                      onClick={handlePickFromContacts}
                      className="w-full flex items-center justify-center gap-3 py-4 bg-indigo-50 border-2 border-dashed border-indigo-200 rounded-2xl text-indigo-600 hover:bg-indigo-100 transition-all group"
                    >
                      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                        <Contact size={20} />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-bold">फोन से चुनें</p>
                        <p className="text-[10px] text-indigo-400 font-medium uppercase tracking-wider">जल्दी खोजें और जोड़ें</p>
                      </div>
                    </button>
                    {window.self !== window.top && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                        <p className="text-[11px] text-amber-700 font-bold flex items-center gap-2">
                          <AlertTriangle size={14} /> यह फीचर यहाँ काम नहीं करेगा
                        </p>
                        <p className="text-[10px] text-amber-600 leading-relaxed">
                          सुरक्षा कारणों से, फोन के कॉन्टैक्ट्स को केवल तभी चुना जा सकता है जब आप ऐप को <b>नए टैब (New Tab)</b> में खोलें।
                        </p>
                        <button 
                          onClick={() => window.open(window.location.href, '_blank')}
                          className="w-full py-1.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-lg hover:bg-amber-200 transition-colors"
                        >
                          नए टैब में खोलें
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <form onSubmit={handleAddCustomer} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">नाम</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="जैसे: राहुल शर्मा"
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1 relative">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">मोबाइल नंबर</label>
                  <input 
                    required
                    type="tel" 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="जैसे: 9876543210"
                    value={newCustomer.mobile}
                    onChange={(e) => {
                      setNewCustomer({ ...newCustomer, mobile: e.target.value });
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">फोटो (वैकल्पिक)</label>
                  <div className="flex flex-col gap-3">
                    <div className="flex gap-2">
                      <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 transition-all">
                        <ImageIcon size={20} className="text-slate-400" />
                        <span className="text-sm font-medium text-slate-600">गैलरी</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                        />
                      </label>
                      <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 transition-all">
                        <Camera size={20} className="text-slate-400" />
                        <span className="text-sm font-medium text-slate-600">कैमरा</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          capture="environment"
                          className="hidden" 
                          onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                        />
                      </label>
                    </div>
                    {photoFile && (
                      <div className="flex items-center justify-between p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                        <div className="flex items-center gap-2">
                          <ImageIcon size={16} className="text-indigo-500" />
                          <span className="text-xs font-bold text-indigo-700 truncate max-w-[150px]">{photoFile.name}</span>
                        </div>
                        <button 
                          type="button" 
                          onClick={() => setPhotoFile(null)}
                          className="p-1 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-2 p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3">
                  <div>
                    <p className="text-xs font-extrabold text-slate-600 uppercase tracking-wider">Merchant Credit Network</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Only if you want to share outstanding/credit information with other merchants in the network.</p>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-800">Share Credit Information</p>
                      <p className="text-[11px] text-slate-500">
                        Default: <span className="font-semibold">OFF</span>. Enable only if you want to share this customer's credit history.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setNewCustomer(c => ({
                        ...c,
                        merchantCreditNetwork: { sharingEnabled: !c.merchantCreditNetwork?.sharingEnabled }
                      }))}
                      className={cn(
                        "relative inline-flex h-7 w-12 items-center rounded-full transition-colors ring-1 shrink-0",
                        newCustomer.merchantCreditNetwork?.sharingEnabled ? "bg-indigo-600 ring-indigo-700" : "bg-slate-300 ring-slate-300"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
                          newCustomer.merchantCreditNetwork?.sharingEnabled ? "translate-x-6" : "translate-x-1"
                        )}
                      />
                    </button>
                  </div>
                  <p className={cn(
                    "text-[10px] font-black uppercase tracking-[0.22em] text-right",
                    newCustomer.merchantCreditNetwork?.sharingEnabled ? "text-indigo-700" : "text-slate-400"
                  )}>
                    {newCustomer.merchantCreditNetwork?.sharingEnabled ? "ON" : "OFF"}
                  </p>
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    disabled={uploading}
                    onClick={() => {
                      setIsAddingCustomer(false);
                      setPhotoFile(null);
                    }}
                    className="flex-1 py-3 text-slate-600 font-semibold hover:bg-slate-50 rounded-xl transition-colors disabled:opacity-50"
                  >
                    रद्द करें
                  </button>
                  <button 
                    type="submit"
                    disabled={uploading}
                    className="flex-1 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50"
                  >
                    {uploading ? "सुरक्षित हो रहा है..." : "ग्राहक सुरक्षित करें"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reminder Options Modal */}
      <AnimatePresence>
        {reminderCustomer && (
          <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setReminderCustomer(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className={cn(
                "relative w-full max-w-sm rounded-t-[2rem] sm:rounded-[2rem] p-6 shadow-2xl",
                theme === 'dark' ? "bg-slate-900 border border-slate-800" : "bg-white"
              )}
            >
              <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto mb-6" />
              <h2 className={cn("text-xl font-black mb-2", theme === 'dark' ? "text-white" : "text-slate-900")}>
                रिमाइंडर भेजें
              </h2>
              <p className="text-slate-500 text-sm font-bold mb-6">
                {reminderCustomer.name} को ₹{Math.abs(reminderCustomer.totalDue).toLocaleString()} का रिमाइंडर भेजें
              </p>

              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => handleDashboardWhatsAppReminder(reminderCustomer)}
                  className="flex flex-col items-center gap-3 p-6 bg-emerald-50 dark:bg-emerald-900/20 border-2 border-emerald-100 dark:border-emerald-800 rounded-3xl hover:bg-emerald-100 transition-all group"
                >
                  <div className="w-12 h-12 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-emerald-200 dark:shadow-none group-hover:scale-110 transition-transform">
                    <MessageCircle size={24} fill="currentColor" />
                  </div>
                  <span className="text-emerald-700 dark:text-emerald-400 font-black text-xs uppercase tracking-wider">WhatsApp</span>
                </button>

                <button 
                  onClick={() => handleDashboardSMSReminder(reminderCustomer)}
                  className="flex flex-col items-center gap-3 p-6 bg-indigo-50 dark:bg-indigo-900/20 border-2 border-indigo-100 dark:border-indigo-800 rounded-3xl hover:bg-indigo-100 transition-all group"
                >
                  <div className="w-12 h-12 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-none group-hover:scale-110 transition-transform">
                    <MessageSquare size={24} fill="currentColor" />
                  </div>
                  <span className="text-indigo-700 dark:text-indigo-400 font-black text-xs uppercase tracking-wider">SMS</span>
                </button>
              </div>

              <button 
                onClick={() => setReminderCustomer(null)}
                className="w-full mt-6 py-4 text-slate-500 font-black text-xs uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-colors"
              >
                रहने दें
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Layout>
  );
};

const CustomerDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  useBackgroundSync();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const transactionsWithBalance = useMemo(() => {
    // Sort by date ascending to calculate running balance accurately
    const sorted = [...transactions].sort((a, b) => getMillis(a.date) - getMillis(b.date));
    let currentBalance = 0;
    const withBalance = sorted.map(tx => {
      if (tx.type === 'udhar') {
        currentBalance += tx.amount;
      } else {
        currentBalance -= tx.amount;
      }
      return { ...tx, runningBalance: currentBalance };
    });
    // Return in descending order for display (newest first)
    return withBalance.reverse();
  }, [transactions]);
  const [isAddingEntry, setIsAddingEntry] = useState<'udhar' | 'jama' | null>(null);
  const [isSettingReminder, setIsSettingReminder] = useState(false);
  const [reminderOption, setReminderOption] = useState<'week' | 'month' | 'calendar' | null>(null);
  const [customReminderDate, setCustomReminderDate] = useState('');
  const [entry, setEntry] = useState({ amount: '', note: '', date: format(new Date(), "yyyy-MM-dd'T'HH:mm") });
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ name: '', mobile: '', merchantCreditNetwork: { sharingEnabled: false } });
  const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editTxData, setEditTxData] = useState({ amount: '', note: '', date: '' });
  const [editImageFiles, setEditImageFiles] = useState<File[]>([]);
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);
  const [showEditPhotoOptions, setShowEditPhotoOptions] = useState(false);
  const [isDeletingTransaction, setIsDeletingTransaction] = useState(false);
  const [isDeletingCustomer, setIsDeletingCustomer] = useState(false);
  const [isDeletingPhoto, setIsDeletingPhoto] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportStartDate, setReportStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [reportEndDate, setReportEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [generatingReport, setGeneratingReport] = useState(false);
  const [viewingImages, setViewingImages] = useState<string[] | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isSettingThreshold, setIsSettingThreshold] = useState(false);
  const [thresholdInput, setThresholdInput] = useState('');
  const [isSettingDailyReminder, setIsSettingDailyReminder] = useState(false);
  const [dailyReminderTimeInput, setDailyReminderTimeInput] = useState('');
  const [isDeletingAllTransactions, setIsDeletingAllTransactions] = useState(false);

  const nextImage = () => {
    if (viewingImages) {
      setCurrentImageIndex((prev) => (prev + 1) % viewingImages.length);
    }
  };

  const prevImage = () => {
    if (viewingImages) {
      setCurrentImageIndex((prev) => (prev - 1 + viewingImages.length) % viewingImages.length);
    }
  };

  useEffect(() => {
    if (!id || !user || !auth.currentUser) return;
    let chosenMobile: string = '';
    let transactionsUnsub: (() => void) | null = null;

    const bindTransactions = (mobile: string) => {
      if (transactionsUnsub) transactionsUnsub();
      const q = query(transactionCollectionRef(user.uid, id));
      transactionsUnsub = onSnapshot(q, (snapshot) => {
        const txs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
        txs.sort((a, b) => getMillis(b.date) - getMillis(a.date));
        setTransactions(txs);
      }, (error) => handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/customers/${id}/transactions`));
    };

    const unsubCustomer = onSnapshot(customerDocRef(user.uid, id), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as Customer;
        const custObj = { id: docSnap.id, ...data } as Customer;
        setCustomer(custObj);
        setEditData({
          name: data.name,
          mobile: data.mobile,
          merchantCreditNetwork: {
            sharingEnabled: !!data.merchantCreditNetwork?.sharingEnabled
          }
        });
        const newMobile = normalizeMobile(data.mobile);
        if (newMobile !== chosenMobile) {
          chosenMobile = newMobile;
          bindTransactions(data.mobile);
        }
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, `users/${user.uid}/customers/${id}`));

    return () => {
      unsubCustomer();
      if (transactionsUnsub) transactionsUnsub();
    };
  }, [id, user]);

  const sendSMSNotification = (customerName: string, mobile: string, amount: number, type: 'udhar' | 'jama', newBalance: number) => {
    const shopName = user?.shopName || "किराना स्टोर";
    const typeText = type === 'udhar' ? 'उधार' : 'जमा';
    const balanceText = newBalance > 0 ? `कुल बकाया: ₹${newBalance}` : newBalance < 0 ? `एडवांस: ₹${Math.abs(newBalance)}` : `बैलेंस: ₹0`;
    
    let message = user?.txSmsFormat || `नमस्ते {name}, आपके {shopName} खाते में ₹{amount} का {type} जोड़ा गया है। {balance}। धन्यवाद।`;
    
    message = message
      .replace(/{name}/g, customerName)
      .replace(/{shopName}/g, shopName)
      .replace(/{amount}/g, amount.toString())
      .replace(/{type}/g, typeText)
      .replace(/{balance}/g, balanceText);
    
    const encodedMessage = encodeURIComponent(message);
    const smsUrl = `sms:+91${mobile}?body=${encodedMessage}`;
    
    window.location.href = smsUrl;
  };

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer || !user || !isAddingEntry) return;
    setUploading(true);

    try {
      // 0. Create tx doc ref FIRST to get stable transactionId for the storage folder
      const txDocRef = doc(transactionCollectionRef(user.uid, customer.id));
      const transactionId = txDocRef.id;

      const imageUrls: string[] = [];
      const pendingFiles: File[] = [];
      const pendingFileStoragePaths: string[] = [];
      
      if (imageFiles.length > 0) {
        if (isOnline) {
          for (const file of imageFiles) {
            const storagePath = `bills/${user.uid}/${customer.id}/${transactionId}/${file.name}`;
            try {
              const url = await uploadToStorage(file, storagePath);
              imageUrls.push(url);
            } catch (error) {
              console.error("Image upload failed, saving locally for sync", error);
              imageUrls.push(URL.createObjectURL(file));
              pendingFiles.push(file);
              pendingFileStoragePaths.push(storagePath);
            }
          }
        } else {
          console.warn("Offline: saving images locally for sync");
          for (const file of imageFiles) {
            const storagePath = `bills/${user.uid}/${customer.id}/${transactionId}/${file.name}`;
            imageUrls.push(URL.createObjectURL(file));
            pendingFiles.push(file);
            pendingFileStoragePaths.push(storagePath);
          }
        }
      }

      const amount = parseFloat(entry.amount);
      if (isNaN(amount) || amount <= 0) {
        alert("कृपया सही राशि दर्ज करें (Enter valid amount)");
        setUploading(false);
        return;
      }
      if (!entry.date) {
        alert("कृपया सही तारीख चुनें (Select valid date)");
        setUploading(false);
        return;
      }
      const type = isAddingEntry;
      const diff = type === 'udhar' ? amount : -amount;
      const normalizedMobile = normalizeMobile(customer.mobile);

      const txData: any = {
        customerMobile: normalizedMobile,
        ownerId: user.uid,
        amount,
        type,
        note: entry.note,
        date: Timestamp.fromDate(new Date(entry.date)),
        imageUrl: imageUrls.length > 0 ? imageUrls[0] : '',
        imageUrls: imageUrls,
        createdAt: Timestamp.now()
      };

      if (customer.id) {
        txData.customerId = customer.id;
      }

      await setDoc(txDocRef, txData);

      // Save pending uploads for each file
      for (let i = 0; i < pendingFiles.length; i++) {
        await savePendingUpload(
          pendingFiles[i],
          pendingFileStoragePaths[i],
          transactionId,
          'transactions',
          'imageUrls',
          user.uid,
          customer.id
        );
      }

      await updateDoc(customerDocRef(user.uid, customer.id), { 
        totalDue: increment(diff),
        lastUpdatedAt: Timestamp.now()
      });

      // Calculate new balance for SMS
      const newBalance = (customer.totalDue || 0) + diff;
      
      setEntry({ amount: '', note: '', date: format(new Date(), "yyyy-MM-dd'T'HH:mm") });
      setImageFiles([]);
      setIsAddingEntry(null);

      // Trigger SMS notification
      sendSMSNotification(customer.name, customer.mobile, amount, type, newBalance);
    } catch (error: any) {
      console.error("Error adding entry:", error);
      alert("प्रविष्टि सुरक्षित करने में त्रुटि हुई (Error saving): " + (error.message || "Unknown error"));
    } finally {
      setUploading(false);
    }
  };

  const handleSetDailyReminder = async () => {
    if (!customer || !user) return;
    try {
      await updateDoc(customerDocRef(user.uid, customer.id), {
        dailyReminderTime: dailyReminderTimeInput || deleteField(),
        lastUpdatedAt: Timestamp.now()
      });
      setIsSettingDailyReminder(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `customers/${customer.id}`);
    }
  };

  const handleDeleteCustomer = async () => {
    if (!customer) return;
    setUploading(true);
    try {
      // 1. Delete all transaction photos from Storage
      const photosToDelete: string[] = [];
      transactions.forEach(tx => {
        if (tx.imageUrls && tx.imageUrls.length > 0) {
          photosToDelete.push(...tx.imageUrls);
        }
      });

      // 2. Delete customer photo from Storage
      if (customer.photoURL) {
        photosToDelete.push(customer.photoURL);
      }

      // Delete all collected photos
      for (const url of photosToDelete) {
        try {
          if (url.includes('firebasestorage.googleapis.com')) {
            const photoRef = ref(storage, url);
            await deleteObject(photoRef);
          }
        } catch (e) {
          console.error("Error deleting photo from storage:", e);
        }
      }

      // 3. Delete all transaction documents
      const batch = writeBatch(db);
      transactions.forEach(tx => {
        batch.delete(transactionDocRef(user?.uid || customer.ownerId, customer.id, tx.id));
      });

      // 4. Delete the customer document
      batch.delete(customerDocRef(user?.uid || customer.ownerId, customer.id));

      await batch.commit();
      navigate('/');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `customers/${customer.id}`);
    } finally {
      setUploading(false);
      setIsDeletingCustomer(false);
    }
  };

  const handleUpdateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer || !user) return;

    const normalizedMobile = normalizeMobile(editData.mobile);

    // Check for duplicate customer by mobile number or name (excluding current)
    try {
      const qMobile = query(customerCollectionRef(user.uid), where('mobile', '==', normalizedMobile));
      const qName = query(customerCollectionRef(user.uid), where('name', '==', editData.name));
      
      const [mobileResults, nameResults] = await Promise.all([getDocs(qMobile), getDocs(qName)]);
      
      const duplicate = [...mobileResults.docs, ...nameResults.docs].find(d => d.id !== customer.id);
      if (duplicate) {
        alert("यह नाम या मोबाइल नंबर पहले से ही किसी अन्य ग्राहक को दिया गया है।");
        return;
      }
    } catch (error) {
      console.error("Duplicate check failed", error);
    }

    setUploading(true);
    try {
      let photoURL = customer.photoURL || '';
      let pendingFile: File | null = null;

      const customerPhotoPath = `customers/${user.uid}/${customer.id}/profile.jpg`;
      
      if (editPhotoFile) {
        if (isOnline) {
          try {
            photoURL = await uploadToStorage(editPhotoFile, customerPhotoPath);
          } catch (error) {
            console.error("Photo upload failed, saving locally for sync", error);
            photoURL = URL.createObjectURL(editPhotoFile);
            pendingFile = editPhotoFile;
          }
        } else {
          console.warn("Offline: saving photo locally for sync");
          photoURL = URL.createObjectURL(editPhotoFile);
          pendingFile = editPhotoFile;
        }
      }

      const updateData = {
        name: editData.name,
        mobile: normalizedMobile,
        photoURL,
        lastUpdatedAt: Timestamp.now(),
        merchantCreditNetwork: {
          sharingEnabled: !!editData.merchantCreditNetwork?.sharingEnabled
        }
      };

      await updateDoc(customerDocRef(user.uid, customer.id), updateData);

      if (pendingFile) {
        await savePendingUpload(
          pendingFile,
          customerPhotoPath,
          customer.id,
          'customers',
          'photoURL',
          user.uid
        );
      }

      setEditPhotoFile(null);
      setIsEditing(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `customers/${customer.id}`);
    } finally {
      setUploading(false);
    }
  };

  const generatePDFReport = async (action: 'download' | 'share' | 'whatsapp' = 'download') => {
    if (!customer || !user) return;
    setGeneratingReport(true);

    try {
      const doc = new jsPDF();
      const shopName = user.shopName || "Kirana Store";
      const startDate = new Date(reportStartDate);
      const endDate = new Date(reportEndDate);
      endDate.setHours(23, 59, 59, 999);

      const filteredTxs = transactionsWithBalance.filter(tx => {
        const txDate = toJSDate(tx.date);
        return txDate >= startDate && txDate <= endDate;
      }).sort((a, b) => getMillis(a.date) - getMillis(b.date));

      // Header
      doc.setFontSize(22);
      doc.setTextColor(79, 70, 229); // Indigo-600
      doc.text(shopName, 105, 20, { align: 'center' });
      
      doc.setFontSize(12);
      doc.setTextColor(100, 116, 139); // Slate-500
      doc.text(`Account Statement`, 105, 30, { align: 'center' });
      doc.text(`${format(startDate, 'dd/MM/yyyy')} to ${format(endDate, 'dd/MM/yyyy')}`, 105, 38, { align: 'center' });

      // Customer Info
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42); // Slate-900
      doc.text(`Customer: ${customer.name}`, 20, 55);
      doc.text(`Mobile: ${customer.mobile}`, 20, 63);

      // Table
      const tableData = filteredTxs.map(tx => [
        format(toJSDate(tx.date), 'dd/MM/yyyy'),
        tx.note || (tx.type === 'udhar' ? 'Debit' : 'Credit'),
        tx.type === 'udhar' ? `Rs.${tx.amount}` : '-',
        tx.type === 'jama' ? `Rs.${tx.amount}` : '-',
        `Rs.${tx.runningBalance || 0}`,
        tx.imageUrl ? 'View' : '-'
      ]);

      autoTable(doc, {
        startY: 75,
        head: [['Date', 'Note', 'Debit', 'Credit', 'Remaining Balance', 'Receipt']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 10, cellPadding: 3 },
        columnStyles: {
          2: { textColor: [220, 38, 38] }, // Red-600 for Udhar
          3: { textColor: [5, 150, 105] }, // Emerald-600 for Jama
          4: { fontStyle: 'bold' },
          5: { textColor: [79, 70, 229], fontStyle: 'bold' }
        },
        didDrawCell: (data) => {
          if (data.section === 'body' && data.column.index === 5) {
            const tx = filteredTxs[data.row.index];
            if (tx.imageUrl) {
              doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url: tx.imageUrl });
            }
          }
        }
      });

      // Summary
      const finalY = (doc as any).lastAutoTable.finalY + 15;
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text(`Total Due: Rs.${customer.totalDue}`, 140, finalY);

      // Footer
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(`Generated by Kirana Master • Page ${i} of ${pageCount}`, 105, 285, { align: 'center' });
      }

      const fileName = `${customer.name}_Statement.pdf`;

      if (action === 'whatsapp') {
        // Upload to Firebase Storage to get a direct link
        const pdfBlob = doc.output('blob');
        const storageRef = ref(storage, `reports/${user.uid}/${Date.now()}_${fileName}`);
        const uploadResult = await uploadBytes(storageRef, pdfBlob);
        const downloadUrl = await getDownloadURL(uploadResult.ref);
        
        const message = `नमस्ते ${customer.name}, आपके ${user.shopName || 'हमारी दुकान'} का खाता विवरण (PDF) यहाँ है: ${downloadUrl}\n\nकुल बकाया: ₹${customer.totalDue}`;
        const whatsappUrl = `https://wa.me/91${customer.mobile}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
      } else if (action === 'share' && navigator.share) {
        const pdfBlob = doc.output('blob');
        const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
        
        try {
          await navigator.share({
            files: [file],
            title: 'Account Statement',
            text: `Statement for ${customer.name}`
          });
        } catch (err) {
          console.error("Sharing failed:", err);
          doc.save(fileName); // Fallback to download
        }
      } else {
        doc.save(fileName);
      }
      
      setIsReportModalOpen(false);
    } catch (error) {
      console.error("PDF generation failed:", error);
      alert("Error generating report. Please try again.");
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleShareOnWhatsApp = () => {
    if (!customer) return;
    const message = `नमस्ते ${customer.name}, आपके ${user?.shopName || 'हमारी दुकान'} का खाता विवरण तैयार है। कृपया चेक करें। कुल बकाया: ₹${customer.totalDue}`;
    const url = `https://wa.me/91${customer.mobile}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const handleEditTransaction = (tx: Transaction) => {
    setEditingTransaction(tx);
    setEditTxData({
      amount: tx.amount.toString(),
      note: tx.note || '',
      date: format(toJSDate(tx.date), "yyyy-MM-dd'T'HH:mm")
    });
    setExistingImageUrls(tx.imageUrls || []);
    setEditImageFiles([]);
    setIsDeletingTransaction(false);
  };

  const handleUpdateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer || !editingTransaction || !user) return;
    
    setUploading(true);
    const newAmount = parseFloat(editTxData.amount);
    const oldAmount = editingTransaction.amount;
    const diff = newAmount - oldAmount;
    const type = editingTransaction.type;
    const txRef = transactionDocRef(user.uid, customer.id, editingTransaction.id);
    const totalDueDiff = type === 'udhar' ? diff : -diff;

    try {
      // Upload new images if any
      const newImageUrls = [...existingImageUrls];
      const transactionId = editingTransaction.id;
      if (editImageFiles.length > 0) {
        if (isOnline) {
          for (const file of editImageFiles) {
            try {
              const storageRef = ref(storage, `bills/${user.uid}/${customer.id}/${transactionId}/${file.name}`);
              await uploadBytes(storageRef, file);
              const url = await getDownloadURL(storageRef);
              newImageUrls.push(url);
            } catch (error) {
              console.error("Image upload failed, saving without image", error);
            }
          }
        } else {
          console.warn("Offline: skipping image uploads for now");
        }
      }

      // Update transaction
      updateDoc(txRef, {
        amount: newAmount,
        note: editTxData.note,
        date: Timestamp.fromDate(new Date(editTxData.date)),
        imageUrls: newImageUrls
      }).catch(error => handleFirestoreError(error, OperationType.UPDATE, `transactions/${editingTransaction.id}`));

      // Update customer totalDue
      updateDoc(customerDocRef(user.uid, customer.id), { 
        totalDue: increment(totalDueDiff),
        lastUpdatedAt: Timestamp.now()
      }).catch(error => handleFirestoreError(error, OperationType.UPDATE, `customers/${customer.id}`));

      setEditingTransaction(null);
      setEditImageFiles([]);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `transactions/${editingTransaction.id}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteTransaction = async () => {
    if (!customer || !editingTransaction || !user) return;
    
    setUploading(true);
    const amount = editingTransaction.amount;
    const type = editingTransaction.type;
    const imageUrls = editingTransaction.imageUrls || [];
    const txRef = transactionDocRef(user.uid, customer.id, editingTransaction.id);
    const totalDueDiff = type === 'udhar' ? -amount : amount;

    try {
      // 1. Delete photos from Storage
      for (const url of imageUrls) {
        try {
          if (url.includes('firebasestorage.googleapis.com')) {
            const photoRef = ref(storage, url);
            await deleteObject(photoRef);
          }
        } catch (e) {
          console.error("Error deleting transaction photo:", e);
        }
      }

      // 2. Delete transaction document
      await deleteDoc(txRef);

      // 3. Update customer totalDue
      await updateDoc(customerDocRef(user.uid, customer.id), { 
        totalDue: increment(totalDueDiff),
        lastUpdatedAt: Timestamp.now()
      });

      setEditingTransaction(null);
      setIsDeletingTransaction(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `transactions/${editingTransaction.id}`);
    } finally {
      setUploading(false);
    }
  };

  const handleSetReminder = async (date: Date | null) => {
    if (!customer || !user) return;
    try {
      await updateDoc(customerDocRef(user.uid, customer.id), {
        reminderDate: date ? Timestamp.fromDate(date) : null,
        lastUpdatedAt: Timestamp.now()
      });
      setIsSettingReminder(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `customers/${customer.id}`);
    }
  };

  const handleSetThreshold = async () => {
    if (!customer || !user) return;
    try {
      const threshold = thresholdInput === '' ? null : parseFloat(thresholdInput);
      await updateDoc(customerDocRef(user.uid, customer.id), {
        alertThreshold: threshold,
        lastUpdatedAt: Timestamp.now()
      });
      setIsSettingThreshold(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `customers/${customer.id}`);
    }
  };

  const handleDeleteAllTransactions = async () => {
    if (!customer || !user) return;
    try {
      // 1. Delete all transaction photos from Storage
      const photosToDelete: string[] = [];
      transactions.forEach(tx => {
        if (tx.imageUrls && tx.imageUrls.length > 0) {
          photosToDelete.push(...tx.imageUrls);
        }
      });

      for (const url of photosToDelete) {
        try {
          if (url.includes('firebasestorage.googleapis.com')) {
            const photoRef = ref(storage, url);
            await deleteObject(photoRef);
          }
        } catch (e) {
          console.error("Error deleting photo during delete all:", e);
        }
      }

      // 2. Delete all transaction documents
      const batch = writeBatch(db);
      
      // Delete all transactions for this customer
      transactions.forEach((tx) => {
        batch.delete(transactionDocRef(user.uid, customer.id, tx.id));
      });

      // 3. Reset customer totalDue to 0
      batch.update(customerDocRef(user.uid, customer.id), {
        totalDue: 0,
        lastUpdatedAt: Timestamp.now()
      });

      await batch.commit();
      setIsDeletingAllTransactions(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `customers/${customer.id}/all-transactions`);
    }
  };

  const getNextWeekDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d;
  };

  const getNextMonthDate = () => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d;
  };

  const handleWhatsAppReminder = () => {
    if (!customer || !user) return;
    const amount = Math.abs(customer.totalDue).toLocaleString();
    const type = customer.totalDue > 0 ? "बकाया (Udhar)" : "एडवांस (Advance)";
    
    let message = "";
    if (customer.alertThreshold && customer.totalDue > customer.alertThreshold) {
      message = `नमस्ते ${customer.name}, आपका बकाया (₹${amount}) आपकी सेट की गई सीमा (₹${customer.alertThreshold.toLocaleString()}) से अधिक हो गया है। कृपया जल्द भुगतान करें। धन्यवाद।`;
    } else {
      message = user.smsFormat || `नमस्ते {name}, Khatabook पर आपका ₹{amount} का {type} है। कृपया जल्द भुगतान करें। धन्यवाद।`;
      message = message.replace('{name}', customer.name)
                       .replace('{amount}', amount)
                       .replace('{type}', type);
    }

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/91${customer.mobile}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleSMSReminder = () => {
    if (!customer || !user) return;
    const amount = Math.abs(customer.totalDue).toLocaleString();
    const type = customer.totalDue > 0 ? "बकाया (Udhar)" : "एडवांस (Advance)";
    
    let message = "";
    if (customer.alertThreshold && customer.totalDue > customer.alertThreshold) {
      message = `नमस्ते ${customer.name}, आपका बकाया (₹${amount}) आपकी सेट की गई सीमा (₹${customer.alertThreshold.toLocaleString()}) से अधिक हो गया है। कृपया जल्द भुगतान करें। धन्यवाद।`;
    } else {
      message = user.smsFormat || `नमस्ते {name}, Khatabook पर आपका ₹{amount} का {type} है। कृपया जल्द भुगतान करें। धन्यवाद।`;
      message = message.replace('{name}', customer.name)
                       .replace('{amount}', amount)
                       .replace('{type}', type);
    }

    const encodedMessage = encodeURIComponent(message);
    const smsUrl = `sms:+91${customer.mobile}?body=${encodedMessage}`;
    window.location.href = smsUrl;
  };

  if (!customer) return <div className="p-8 text-center">लोड हो रहा है...</div>;

  return (
    <Layout 
      title={customer.name} 
      showBack 
      backTo="/?tab=customers"
      hideLogout
      rightAction={
        <a 
          href={`tel:${customer.mobile}`}
          className="p-2.5 bg-white text-indigo-600 rounded-full shadow-xl hover:bg-slate-50 transition-all active:scale-90 flex items-center justify-center"
          title="ग्राहक को कॉल करें"
        >
          <Phone size={20} fill="currentColor" />
        </a>
      }
    >
      <div className="p-4 space-y-4">
        {/* Customer Profile Header */}
        <div className="flex flex-col items-center justify-center py-4 space-y-3">
          <div className="relative group">
            {customer.photoURL ? (
              <img 
                src={customer.photoURL} 
                alt={customer.name} 
                className="w-24 h-24 rounded-[2rem] object-cover border-4 border-white shadow-xl"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-24 h-24 bg-indigo-100 text-indigo-700 rounded-[2rem] flex items-center justify-center font-bold text-3xl border-4 border-white shadow-xl">
                {customer.name[0].toUpperCase()}
              </div>
            )}
            <button 
              onClick={() => setIsEditing(true)}
              className="absolute -bottom-1 -right-1 w-8 h-8 bg-white text-indigo-600 rounded-full shadow-lg flex items-center justify-center hover:bg-indigo-50 transition-colors border border-slate-100"
            >
              <Camera size={16} />
            </button>
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">{customer.name}</h2>
            <p className="text-sm font-bold text-slate-400 tracking-widest uppercase">{customer.mobile}</p>
          </div>
        </div>

        {/* Balance Card */}
        <div className={cn(
          "p-6 rounded-3xl shadow-lg text-white flex flex-col space-y-4",
          customer.totalDue > 0 ? "bg-red-600 shadow-red-100" : customer.totalDue < 0 ? "bg-emerald-600 shadow-emerald-100" : "bg-slate-800 shadow-slate-100"
        )}>
          <div className="flex flex-col items-center justify-center text-center space-y-1">
            <p className="text-sm font-bold uppercase tracking-widest opacity-80">
              {customer.totalDue > 0 ? "आपको मिलेंगे" : customer.totalDue < 0 ? "आपको देने हैं" : "हिसाब बराबर"}
            </p>
            <p className="text-4xl font-black tracking-tight">₹{Math.abs(customer.totalDue).toLocaleString()}</p>
          </div>
          
          <div className="pt-4 border-t border-white/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar size={18} className="opacity-80" />
              <p className="text-sm font-bold">
                {customer.reminderDate 
                  ? `कलेक्शन की तारीख : ${format(toJSDate(customer.reminderDate), 'dd MMM')}`
                  : "कलेक्शन के लिए रिमाइंडर सेट करें"
                }
              </p>
            </div>
            <button 
              onClick={() => setIsSettingReminder(true)}
              className="text-sm font-black underline underline-offset-4 hover:opacity-80 transition-opacity"
            >
              तारीख़ सेट करें
            </button>
          </div>
        </div>

        {/* Action Grid */}
        <div className="grid grid-cols-3 gap-4 py-2">
          <button 
            onClick={() => setIsReportModalOpen(true)}
            className="flex flex-col items-center gap-2 p-2 group"
          >
            <div className={cn(
              "w-12 h-12 border rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm group-active:scale-90 transition-transform",
              theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
            )}>
              <FileDown size={24} />
            </div>
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">रिपोर्ट</span>
          </button>
          <button 
            onClick={handleWhatsAppReminder}
            className="flex flex-col items-center gap-2 p-2 group"
          >
            <div className={cn(
              "w-12 h-12 border rounded-2xl flex items-center justify-center text-emerald-600 shadow-sm group-active:scale-90 transition-transform",
              theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
            )}>
              <MessageCircle size={24} />
            </div>
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">रिमाइंडर</span>
          </button>
          <button 
            onClick={handleSMSReminder}
            className="flex flex-col items-center gap-2 p-2 group"
          >
            <div className={cn(
              "w-12 h-12 border rounded-2xl flex items-center justify-center text-blue-600 shadow-sm group-active:scale-90 transition-transform",
              theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
            )}>
              <MessageSquare size={24} />
            </div>
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">SMS</span>
          </button>
        </div>

        {/* Threshold Alert Section */}
        <div className={cn(
          "p-4 rounded-3xl border shadow-sm space-y-3",
          theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-900/20 flex items-center justify-center">
                <Bell size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">बैलेंस अलर्ट</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">सीमा (Threshold) सेट करें</p>
              </div>
            </div>
            <button 
              onClick={() => {
                setThresholdInput(customer.alertThreshold?.toString() || '');
                setIsSettingThreshold(!isSettingThreshold);
              }}
              className="text-xs font-black text-indigo-600 underline underline-offset-4"
            >
              {isSettingThreshold ? "बंद करें" : "बदलें"}
            </button>
          </div>

          {isSettingThreshold ? (
            <div className="flex gap-2 pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <input 
                type="number" 
                placeholder="उदा. 5000"
                className={cn(
                  "flex-1 px-4 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold",
                  theme === 'dark' ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                )}
                value={thresholdInput}
                onChange={(e) => setThresholdInput(e.target.value)}
              />
              <button 
                onClick={handleSetThreshold}
                className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-black text-sm shadow-lg shadow-indigo-100 active:scale-95 transition-all"
              >
                सेट करें
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between pt-1">
              <p className="text-xs font-bold text-slate-500">
                {customer.alertThreshold 
                  ? `₹${customer.alertThreshold.toLocaleString()} से ज्यादा होने पर अलर्ट`
                  : "कोई सीमा सेट नहीं है"
                }
              </p>
              {customer.alertThreshold && customer.totalDue > customer.alertThreshold && (
                <div className="flex items-center gap-1 text-red-600 animate-pulse">
                  <Bell size={14} fill="currentColor" />
                  <span className="text-[10px] font-black uppercase tracking-wider">सीमा पार!</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Daily Reminder Section */}
        <div className={cn(
          "p-4 rounded-3xl border shadow-sm space-y-3",
          theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 flex items-center justify-center">
                <Clock size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">डेली रिमाइंडर</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">मैसेज भेजने का समय</p>
              </div>
            </div>
            <button 
              onClick={() => {
                setDailyReminderTimeInput(customer.dailyReminderTime || '');
                setIsSettingDailyReminder(!isSettingDailyReminder);
              }}
              className="text-xs font-black text-indigo-600 underline underline-offset-4"
            >
              {isSettingDailyReminder ? "बंद करें" : "बदलें"}
            </button>
          </div>

          {isSettingDailyReminder ? (
            <div className="flex gap-2 pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <input 
                type="time" 
                className={cn(
                  "flex-1 px-4 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold",
                  theme === 'dark' ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                )}
                value={dailyReminderTimeInput}
                onChange={(e) => setDailyReminderTimeInput(e.target.value)}
              />
              <button 
                onClick={handleSetDailyReminder}
                className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-black text-sm shadow-lg shadow-indigo-100 active:scale-95 transition-all"
              >
                सेट करें
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between pt-1">
              <p className="text-xs font-bold text-slate-500">
                {customer.dailyReminderTime 
                  ? `हर दिन ${format(new Date(`2000-01-01T${customer.dailyReminderTime}`), 'hh:mm a')} पर रिमाइंडर`
                  : "कोई समय सेट नहीं है"
                }
              </p>
            </div>
          )}
        </div>

        {/* Transaction History Header (Simplified) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">लेन-देन (Transactions)</h2>
            {transactions.length > 0 && (
              <button 
                onClick={() => setIsDeletingAllTransactions(true)}
                className="text-[10px] font-black text-red-600 uppercase tracking-wider hover:opacity-80 transition-opacity"
              >
                सभी डिलीट करें
              </button>
            )}
          </div>
          
          <div className="space-y-3">
            {transactionsWithBalance.map((tx) => (
              <div 
                key={tx.id} 
                onClick={() => handleEditTransaction(tx)}
                className={cn(
                  "p-4 rounded-2xl border shadow-sm flex items-center justify-between cursor-pointer transition-all active:scale-[0.98]",
                  theme === 'dark' ? "bg-slate-900 border-slate-800 hover:border-indigo-900 hover:shadow-indigo-900/10" : "bg-white border-slate-200 hover:border-indigo-200 hover:shadow-md"
                )}
              >
                <div className="flex gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center",
                    tx.type === 'udhar' ? "bg-red-50 text-red-600 dark:bg-red-900/20" : "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20"
                  )}>
                    {tx.type === 'udhar' ? <ArrowUpRight size={20} /> : <ArrowDownLeft size={20} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={cn("font-bold", theme === 'dark' ? "text-slate-100" : "text-slate-900")}>₹{tx.amount.toLocaleString()}</p>
                      {(tx.imageUrl || (tx.imageUrls && tx.imageUrls.length > 0)) && <Camera size={14} className="text-slate-400" />}
                    </div>
                    
                    <p className="text-xs text-slate-500 font-medium">
                      {tx.note || (tx.type === 'udhar' ? 'उधार' : 'जमा')} • {format(toJSDate(tx.date), 'dd MMM, hh:mm a')}
                    </p>
                    {tx.imageUrls && tx.imageUrls.length > 0 && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setViewingImages(tx.imageUrls || []);
                          setCurrentImageIndex(0);
                        }}
                        className={cn(
                          "mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-colors",
                          theme === 'dark' ? "bg-indigo-900/20 text-indigo-400 border-indigo-900/40 hover:bg-indigo-900/40" : "bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-100"
                        )}
                      >
                        <FileText size={12} />
                        बिल देखें (Bill Dekhe)
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <div className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                    tx.type === 'udhar' ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                  )}>
                    {tx.type === 'udhar' ? 'उधार' : 'जमा'}
                  </div>
                  
                  {/* Running Balance Badge */}
                  <div className={cn(
                    "inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold",
                    theme === 'dark' ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500"
                  )}>
                    बैलेंस ₹{Math.abs(tx.runningBalance || 0).toLocaleString()}
                    {tx.runningBalance !== undefined && (
                      <span className="ml-1 opacity-70">
                        {tx.runningBalance > 0 ? "(Dr)" : tx.runningBalance < 0 ? "(Cr)" : ""}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {transactions.length === 0 && (
              <div className={cn(
                "py-12 text-center font-medium border-2 border-dashed rounded-3xl",
                theme === 'dark' ? "border-slate-800 text-slate-600" : "border-slate-200 text-slate-400"
              )}>
                अभी तक कोई ट्रांजैक्शन नहीं है
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className={cn(
        "fixed bottom-0 left-0 right-0 p-4 backdrop-blur-md border-t flex gap-3 max-w-md mx-auto",
        theme === 'dark' ? "bg-slate-900/80 border-slate-800" : "bg-white/80 border-slate-100"
      )}>
        <button 
          onClick={() => setIsAddingEntry('udhar')}
          className="flex-1 py-4 bg-red-600 text-white font-bold rounded-2xl shadow-lg shadow-red-100 dark:shadow-none flex items-center justify-center gap-2 hover:bg-red-700 transition-all active:scale-95"
        >
          <ArrowUpRight size={20} /> आपने दिए
        </button>
        <button 
          onClick={() => setIsAddingEntry('jama')}
          className="flex-1 py-4 bg-emerald-600 text-white font-bold rounded-2xl shadow-lg shadow-emerald-100 dark:shadow-none flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all active:scale-95"
        >
          <ArrowDownLeft size={20} /> आपको मिले
        </button>
      </div>

      {/* Reminder Modal */}
      <AnimatePresence>
        {isSettingReminder && (
          <div className="fixed inset-0 z-[120] flex items-end justify-center p-4 sm:items-center overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingReminder(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="relative w-full max-w-md bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="p-8 space-y-8">
                <div className="space-y-2 text-center">
                  <h3 className="text-xl font-black text-slate-900 leading-tight">
                    {customer.name} के लिए देय तारीख सेट करें
                  </h3>
                  <p className="text-sm font-medium text-slate-500">
                    Khatabook ग्राहकों को चुनी हुई तारीख पर रिमाइंड कराएगा
                  </p>
                </div>

                <div className="space-y-4">
                  <button 
                    onClick={() => handleSetReminder(getNextWeekDate())}
                    className="w-full flex items-center justify-between p-4 rounded-2xl border-2 border-slate-100 hover:border-indigo-100 hover:bg-indigo-50/30 transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-6 h-6 rounded-full border-2 border-slate-300 flex items-center justify-center group-hover:border-indigo-500">
                        <div className="w-3 h-3 rounded-full bg-indigo-500 scale-0 group-hover:scale-100 transition-transform" />
                      </div>
                      <span className="font-bold text-slate-700">अगले सप्ताह</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-400 font-bold text-sm">
                      <Calendar size={16} />
                      {format(getNextWeekDate(), 'dd MMM yy')}
                    </div>
                  </button>

                  <button 
                    onClick={() => handleSetReminder(getNextMonthDate())}
                    className="w-full flex items-center justify-between p-4 rounded-2xl border-2 border-slate-100 hover:border-indigo-100 hover:bg-indigo-50/30 transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-6 h-6 rounded-full border-2 border-slate-300 flex items-center justify-center group-hover:border-indigo-500">
                        <div className="w-3 h-3 rounded-full bg-indigo-500 scale-0 group-hover:scale-100 transition-transform" />
                      </div>
                      <span className="font-bold text-slate-700">अगला महीना</span>
                    </div>
                  </button>

                  <div className="space-y-2">
                    <button 
                      onClick={() => setReminderOption(reminderOption === 'calendar' ? null : 'calendar')}
                      className="w-full flex items-center justify-between p-4 rounded-2xl border-2 border-slate-100 hover:border-indigo-100 hover:bg-indigo-50/30 transition-all group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-6 h-6 rounded-full border-2 border-slate-300 flex items-center justify-center group-hover:border-indigo-500">
                          <div className="w-3 h-3 rounded-full bg-indigo-500 scale-0 group-hover:scale-100 transition-transform" />
                        </div>
                        <span className="font-bold text-slate-700">कैलेंडर</span>
                      </div>
                    </button>
                    
                    {reminderOption === 'calendar' && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        className="px-2 pb-2"
                      >
                        <input 
                          type="date" 
                          className="w-full p-4 rounded-xl border-2 border-indigo-100 focus:border-indigo-500 outline-none font-bold"
                          onChange={(e) => {
                            if (e.target.value) {
                              handleSetReminder(new Date(e.target.value));
                            }
                          }}
                        />
                      </motion.div>
                    )}
                  </div>
                </div>

                <button 
                  onClick={() => handleSetReminder(null)}
                  className="w-full py-4 text-red-500 font-black uppercase tracking-widest hover:bg-red-50 rounded-2xl transition-colors"
                >
                  हटाना
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Customer Modal */}
      <AnimatePresence>
        {isEditing && (
          <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditing(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="relative w-full max-w-sm bg-white rounded-t-[2rem] sm:rounded-[2rem] p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <h2 className="text-xl font-bold mb-6">ग्राहक संपादित करें</h2>
              <form onSubmit={handleUpdateCustomer} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">ग्राहक का नाम</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="नाम दर्ज करें"
                    value={editData.name}
                    onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">मोबाइल नंबर</label>
                  <input 
                    required
                    type="tel" 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="मोबाइल नंबर दर्ज करें"
                    value={editData.mobile}
                    onChange={(e) => setEditData({ ...editData, mobile: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">फोटो अपडेट करें (वैकल्पिक)</label>
                  <div className="flex flex-col gap-3">
                    <div className="flex gap-2">
                      <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 transition-all">
                        <ImageIcon size={20} className="text-slate-400" />
                        <span className="text-sm font-medium text-slate-600">गैलरी</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={(e) => setEditPhotoFile(e.target.files?.[0] || null)}
                        />
                      </label>
                      <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 transition-all">
                        <Camera size={20} className="text-slate-400" />
                        <span className="text-sm font-medium text-slate-600">कैमरा</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          capture="environment"
                          className="hidden" 
                          onChange={(e) => setEditPhotoFile(e.target.files?.[0] || null)}
                        />
                      </label>
                    </div>
                    {(editPhotoFile || customer.photoURL) && (
                      <div className="flex items-center justify-between p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                        <div className="flex items-center gap-3">
                          <img 
                            src={editPhotoFile ? URL.createObjectURL(editPhotoFile) : customer.photoURL} 
                            alt="Preview" 
                            className="w-10 h-10 rounded-lg object-cover border border-indigo-200"
                            referrerPolicy="no-referrer"
                          />
                          <span className="text-xs font-bold text-indigo-700 truncate max-w-[120px]">
                            {editPhotoFile ? editPhotoFile.name : "वर्तमान फोटो"}
                          </span>
                        </div>
                        <button 
                          type="button" 
                          onClick={() => {
                            if (editPhotoFile) setEditPhotoFile(null);
                            else {
                              setIsDeletingPhoto(true);
                            }
                          }}
                          className="p-1 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Photo Delete Confirmation Overlay */}
                <AnimatePresence>
                  {isDeletingPhoto && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 z-20 bg-white rounded-[2rem] p-6 flex flex-col items-center justify-center text-center"
                    >
                      <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mb-4">
                        <Trash2 size={32} />
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 mb-2">फोटो हटाएं?</h3>
                      <p className="text-slate-500 mb-8">क्या आप वाकई इस फोटो को हटाना चाहते हैं?</p>
                      <div className="w-full space-y-3">
                        <button 
                          onClick={async () => {
                            try {
                              if (customer.photoURL && customer.photoURL.includes('firebasestorage.googleapis.com')) {
                                const photoRef = ref(storage, customer.photoURL);
                                await deleteObject(photoRef);
                              }
                              await updateDoc(customerDocRef(user?.uid || customer.ownerId, customer.id), { photoURL: '' });
                              setIsDeletingPhoto(false);
                            } catch (error) {
                              handleFirestoreError(error, OperationType.UPDATE, `customers/${customer.id}`);
                            }
                          }}
                          className="w-full py-4 bg-red-600 text-white font-bold rounded-2xl shadow-lg shadow-red-100 hover:bg-red-700 transition-all"
                        >
                          हाँ, हटाएं
                        </button>
                        <button 
                          onClick={() => setIsDeletingPhoto(false)}
                          className="w-full py-4 text-slate-600 font-bold hover:bg-slate-50 rounded-2xl transition-colors"
                        >
                          नहीं, रहने दें
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="mt-2 p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3">
                  <div>
                    <p className="text-xs font-extrabold text-slate-600 uppercase tracking-wider">Merchant Credit Network</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Control sharing of this customer's credit information with other merchants.</p>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-800">Share Credit Information</p>
                      <p className="text-[11px] text-slate-500">
                        Enable only if you want to share this customer's outstanding/credit data in the Merchant Credit Network.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditData(e => ({
                        ...e,
                        merchantCreditNetwork: { sharingEnabled: !e.merchantCreditNetwork?.sharingEnabled }
                      }))}
                      className={cn(
                        "relative inline-flex h-7 w-12 items-center rounded-full transition-colors ring-1 shrink-0",
                        editData.merchantCreditNetwork?.sharingEnabled ? "bg-indigo-600 ring-indigo-700" : "bg-slate-300 ring-slate-300"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
                          editData.merchantCreditNetwork?.sharingEnabled ? "translate-x-6" : "translate-x-1"
                        )}
                      />
                    </button>
                  </div>
                  <p className={cn(
                    "text-[10px] font-black uppercase tracking-[0.22em] text-right",
                    editData.merchantCreditNetwork?.sharingEnabled ? "text-indigo-700" : "text-slate-400"
                  )}>
                    {editData.merchantCreditNetwork?.sharingEnabled ? "ON" : "OFF"}
                  </p>
                </div>

                <div className="pt-4 space-y-3">
                  <div className="flex gap-3">
                    <button 
                      type="button"
                      disabled={uploading}
                      onClick={() => {
                        setIsEditing(false);
                        setEditPhotoFile(null);
                      }}
                      className="flex-1 py-4 text-slate-600 font-bold hover:bg-slate-50 rounded-2xl transition-colors disabled:opacity-50"
                    >
                      रद्द करें
                    </button>
                    <button 
                      type="submit"
                      disabled={uploading}
                      className="flex-1 py-4 bg-slate-900 text-white font-bold rounded-2xl shadow-lg hover:bg-slate-800 transition-all disabled:opacity-50"
                    >
                      {uploading ? "सुरक्षित हो रहा है..." : "बदलाव सुरक्षित करें"}
                    </button>
                  </div>
                  <button 
                    type="button"
                    disabled={uploading}
                    onClick={() => setIsDeletingCustomer(true)}
                    className="w-full py-4 text-red-600 font-bold hover:bg-red-50 rounded-2xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Trash2 size={18} /> ग्राहक को हटाएं
                  </button>
                </div>
              </form>

              {/* Delete Customer Confirmation Overlay */}
              <AnimatePresence>
                {isDeletingCustomer && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-20 bg-white rounded-[2rem] p-6 flex flex-col items-center justify-center text-center"
                  >
                    <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mb-4">
                      <Trash2 size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">ग्राहक को हटाएं?</h3>
                    <p className="text-slate-500 mb-8">क्या आप वाकई इस ग्राहक को हटाना चाहते हैं? सभी ट्रांजैक्शन मिट जाएंगे और यह वापस नहीं लिया जा सकता।</p>
                    <div className="w-full space-y-3">
                      <button 
                        onClick={handleDeleteCustomer}
                        disabled={uploading}
                        className="w-full py-4 bg-red-600 text-white font-bold rounded-2xl shadow-lg shadow-red-100 hover:bg-red-700 transition-all disabled:opacity-50"
                      >
                        {uploading ? "हटाया जा रहा है..." : "हाँ, हटाएं"}
                      </button>
                      <button 
                        onClick={() => setIsDeletingCustomer(false)}
                        className="w-full py-4 text-slate-600 font-bold hover:bg-slate-50 rounded-2xl transition-colors"
                      >
                        नहीं, रहने दें
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Entry Modal */}
      <AnimatePresence>
        {isAddingEntry && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingEntry(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="relative w-full max-sm bg-white rounded-t-[2rem] sm:rounded-[2rem] p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">
                  {isAddingEntry === 'udhar' ? "उधार जोड़ें" : "जमा जोड़ें"}
                </h2>
                <div className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                  isAddingEntry === 'udhar' ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
                )}>
                  {isAddingEntry === 'udhar' ? "उधार" : "जमा"}
                </div>
              </div>

              <form onSubmit={handleAddEntry} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">राशि (Amount)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">₹</span>
                    <input 
                      required
                      type="number" 
                      className="w-full pl-8 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-2xl font-black focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="0.00"
                      value={entry.amount}
                      onChange={(e) => setEntry({ ...entry, amount: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">नोट (Note - वैकल्पिक)</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="जैसे: 2 किलो चीनी, 1 लीटर तेल"
                    value={entry.note}
                    onChange={(e) => setEntry({ ...entry, note: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">तारीख (Date)</label>
                    <input 
                      type="datetime-local" 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      value={entry.date}
                      onChange={(e) => setEntry({ ...entry, date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">बिल फोटो</label>
                    <div className="relative">
                      <button 
                        type="button"
                        onClick={() => setShowPhotoOptions(!showPhotoOptions)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-100 transition-colors"
                      >
                        <Camera size={18} className="text-slate-400" />
                        <span className="text-sm font-medium text-slate-600">
                          {imageFiles.length > 0 ? `${imageFiles.length} फोटो` : "जोड़ें"}
                        </span>
                      </button>

                      <AnimatePresence>
                        {showPhotoOptions && (
                          <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-slate-200 rounded-2xl shadow-xl p-2 flex flex-col gap-1 z-10"
                          >
                            <label className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors">
                              <ImageIcon size={20} className="text-indigo-600" />
                              <span className="text-sm font-bold text-slate-700">गैलरी</span>
                              <input 
                                type="file" 
                                accept="image/*" 
                                multiple 
                                className="hidden" 
                                onChange={(e) => {
                                  const files = Array.from(e.target.files || []);
                                  setImageFiles([...imageFiles, ...files]);
                                  setShowPhotoOptions(false);
                                }}
                              />
                            </label>
                            <label className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors border-t border-slate-100">
                              <Camera size={20} className="text-indigo-600" />
                              <span className="text-sm font-bold text-slate-700">कैमरा</span>
                              <input 
                                type="file" 
                                accept="image/*" 
                                capture="environment" 
                                className="hidden" 
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) setImageFiles([...imageFiles, file]);
                                  setShowPhotoOptions(false);
                                }}
                              />
                            </label>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>

                {imageFiles.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {imageFiles.map((file, idx) => (
                      <div key={idx} className="relative flex-shrink-0">
                        <img 
                          src={URL.createObjectURL(file)} 
                          alt="preview" 
                          className="w-16 h-16 rounded-xl object-cover border border-slate-200"
                        />
                        <button 
                          type="button"
                          onClick={() => setImageFiles(imageFiles.filter((_, i) => i !== idx))}
                          className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 text-white rounded-full flex items-center justify-center shadow-md"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsAddingEntry(null)}
                    className="flex-1 py-4 text-slate-600 font-bold hover:bg-slate-50 rounded-2xl transition-colors"
                  >
                    रद्द करें
                  </button>
                  <button 
                    type="submit"
                    disabled={uploading}
                    className={cn(
                      "flex-1 py-4 text-white font-bold rounded-2xl shadow-lg transition-all",
                      isAddingEntry === 'udhar' ? "bg-red-600 hover:bg-red-700 shadow-red-100" : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100",
                      uploading && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {uploading ? "सुरक्षित हो रहा है..." : "प्रविष्टि सुरक्षित करें"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Transaction Modal */}
      <AnimatePresence>
        {editingTransaction && (
          <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingTransaction(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="relative w-full max-w-sm bg-white rounded-t-[2rem] sm:rounded-[2rem] p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <button 
                    type="button"
                    onClick={() => setEditingTransaction(null)}
                    className="p-2 -ml-2 hover:bg-slate-100 rounded-full transition-colors"
                  >
                    <ArrowLeft size={20} className="text-slate-600" />
                  </button>
                  <h2 className="text-xl font-bold">ट्रांजैक्शन संपादित करें</h2>
                </div>
                <div className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                  editingTransaction.type === 'udhar' ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
                )}>
                  {editingTransaction.type === 'udhar' ? "उधार" : "जमा"}
                </div>
              </div>

              <form onSubmit={handleUpdateTransaction} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">राशि (Amount)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">₹</span>
                    <input 
                      required
                      type="number" 
                      className="w-full pl-8 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-2xl font-black focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="0.00"
                      value={editTxData.amount}
                      onChange={(e) => setEditTxData({ ...editTxData, amount: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">नोट (Note - वैकल्पिक)</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="जैसे: 2 किलो चीनी, 1 लीटर तेल"
                    value={editTxData.note}
                    onChange={(e) => setEditTxData({ ...editTxData, note: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">तारीख (Date)</label>
                    <input 
                      type="datetime-local" 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      value={editTxData.date}
                      onChange={(e) => setEditTxData({ ...editTxData, date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">फोटो जोड़ें</label>
                    <div className="relative">
                      <button 
                        type="button"
                        onClick={() => setShowEditPhotoOptions(!showEditPhotoOptions)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-100 transition-colors"
                      >
                        <Camera size={18} className="text-slate-400" />
                        <span className="text-sm font-medium text-slate-600">जोड़ें</span>
                      </button>

                      <AnimatePresence>
                        {showEditPhotoOptions && (
                          <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-slate-200 rounded-2xl shadow-xl p-2 flex flex-col gap-1 z-10"
                          >
                            <label className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors">
                              <ImageIcon size={20} className="text-indigo-600" />
                              <span className="text-sm font-bold text-slate-700">गैलरी</span>
                              <input 
                                type="file" 
                                accept="image/*" 
                                multiple 
                                className="hidden" 
                                onChange={(e) => {
                                  const files = Array.from(e.target.files || []);
                                  setEditImageFiles([...editImageFiles, ...files]);
                                  setShowEditPhotoOptions(false);
                                }}
                              />
                            </label>
                            <label className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors border-t border-slate-100">
                              <Camera size={20} className="text-indigo-600" />
                              <span className="text-sm font-bold text-slate-700">कैमरा</span>
                              <input 
                                type="file" 
                                accept="image/*" 
                                capture="environment" 
                                className="hidden" 
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) setEditImageFiles([...editImageFiles, file]);
                                  setShowEditPhotoOptions(false);
                                }}
                              />
                            </label>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>

                {/* Existing Photos */}
                {existingImageUrls.length > 0 && (
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">मौजूदा फोटो</label>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {existingImageUrls.map((url, idx) => (
                        <div key={idx} className="relative flex-shrink-0">
                          <img 
                            src={url} 
                            alt="existing" 
                            className="w-16 h-16 rounded-xl object-cover border border-slate-200"
                            referrerPolicy="no-referrer"
                          />
                          <button 
                            type="button"
                            onClick={() => setExistingImageUrls(existingImageUrls.filter((_, i) => i !== idx))}
                            className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 text-white rounded-full flex items-center justify-center shadow-md"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* New Photos */}
                {editImageFiles.length > 0 && (
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">New Photos</label>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {editImageFiles.map((file, idx) => (
                        <div key={idx} className="relative flex-shrink-0">
                          <img 
                            src={URL.createObjectURL(file)} 
                            alt="preview" 
                            className="w-16 h-16 rounded-xl object-cover border border-slate-200"
                          />
                          <button 
                            type="button"
                            onClick={() => setEditImageFiles(editImageFiles.filter((_, i) => i !== idx))}
                            className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 text-white rounded-full flex items-center justify-center shadow-md"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsDeletingTransaction(true)}
                    className="flex-1 py-4 bg-red-600 text-white font-bold hover:bg-red-700 rounded-2xl transition-colors shadow-lg"
                  >
                    हटाएं
                  </button>
                  <button 
                    type="submit"
                    disabled={uploading}
                    className="flex-[2] py-4 bg-emerald-600 text-white font-bold rounded-2xl shadow-lg hover:bg-emerald-700 transition-all disabled:opacity-50"
                  >
                    {uploading ? "सुरक्षित हो रहा है..." : "बदलाव सुरक्षित करें"}
                  </button>
                </div>
              </form>

              {/* Delete Confirmation Overlay */}
              <AnimatePresence>
                {isDeletingTransaction && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-20 bg-white rounded-[2rem] p-6 flex flex-col items-center justify-center text-center"
                  >
                    <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mb-4">
                      <Trash2 size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">ट्रांजैक्शन हटाएं?</h3>
                    <p className="text-slate-500 mb-8">यह क्रिया वापस नहीं ली जा सकती। ग्राहक का बैलेंस अपडेट हो जाएगा।</p>
                    <div className="w-full space-y-3">
                      <button 
                        onClick={handleDeleteTransaction}
                        disabled={uploading}
                        className="w-full py-4 bg-red-600 text-white font-bold rounded-2xl shadow-lg shadow-red-100 hover:bg-red-700 transition-all disabled:opacity-50"
                      >
                        {uploading ? "हटाया जा रहा है..." : "हाँ, हटाएं"}
                      </button>
                      <button 
                        onClick={() => setIsDeletingTransaction(false)}
                        className="w-full py-4 text-slate-600 font-bold hover:bg-slate-50 rounded-2xl transition-colors"
                      >
                        नहीं, रहने दें
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Image Viewer Modal */}
      <AnimatePresence>
        {viewingImages && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative w-full h-full flex flex-col"
            >
              {/* Header */}
              <div className="absolute top-0 left-0 right-0 p-6 flex items-center justify-between z-10 bg-gradient-to-b from-black/50 to-transparent">
                <div className="text-white">
                  <p className="text-sm font-bold opacity-80">Bill Photo</p>
                  <p className="text-xs opacity-60">{currentImageIndex + 1} of {viewingImages.length}</p>
                </div>
                <button 
                  onClick={() => setViewingImages(null)}
                  className="w-10 h-10 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center backdrop-blur-md transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Image Container */}
              <div className="flex-1 flex items-center justify-center p-4">
                <motion.img 
                  key={currentImageIndex}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  src={viewingImages[currentImageIndex]} 
                  alt="bill full" 
                  className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* Navigation Controls */}
              {viewingImages.length > 1 && (
                <>
                  <button 
                    onClick={prevImage}
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center backdrop-blur-md transition-colors"
                  >
                    <ChevronLeft size={32} />
                  </button>
                  <button 
                    onClick={nextImage}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center backdrop-blur-md transition-colors"
                  >
                    <ChevronRight size={32} />
                  </button>

                  {/* Dots Indicator */}
                  <div className="absolute bottom-10 left-0 right-0 flex justify-center gap-2">
                    {viewingImages.map((_, idx) => (
                      <div 
                        key={idx}
                        className={cn(
                          "w-2 h-2 rounded-full transition-all duration-300",
                          idx === currentImageIndex ? "bg-white w-6" : "bg-white/30"
                        )}
                      />
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete All Transactions Confirmation Modal */}
      {isDeletingAllTransactions && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={cn(
            "w-full max-w-sm p-6 rounded-[2.5rem] shadow-2xl animate-in zoom-in-95 duration-200",
            theme === 'dark' ? "bg-slate-900 border border-slate-800" : "bg-white"
          )}>
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 bg-red-50 text-red-600 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                <Trash2 size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-900 dark:text-white">क्या आप पक्का हैं?</h3>
                <p className="text-sm font-bold text-slate-500">
                  इस ग्राहक के सभी {transactions.length} लेन-देन हमेशा के लिए डिलीट हो जाएंगे और बैलेंस ₹0 हो जाएगा।
                </p>
              </div>
              <div className="flex flex-col w-full gap-3 pt-2">
                <button 
                  onClick={handleDeleteAllTransactions}
                  className="w-full py-4 bg-red-600 text-white rounded-2xl font-black shadow-lg shadow-red-100 active:scale-95 transition-all"
                >
                  हाँ, सब डिलीट करें
                </button>
                <button 
                  onClick={() => setIsDeletingAllTransactions(false)}
                  className={cn(
                    "w-full py-4 rounded-2xl font-black active:scale-95 transition-all",
                    theme === 'dark' ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600"
                  )}
                >
                  नहीं, वापस जाएँ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      <AnimatePresence>
        {isReportModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsReportModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className={cn(
                "relative w-full max-w-sm rounded-t-[2rem] sm:rounded-[2rem] p-6 shadow-2xl",
                theme === 'dark' ? "bg-slate-900" : "bg-white"
              )}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-black">रिपोर्ट डाउनलोड करें</h2>
                <button onClick={() => setIsReportModalOpen(false)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">शुरुआत (From)</label>
                    <input 
                      type="date" 
                      value={reportStartDate}
                      onChange={(e) => setReportStartDate(e.target.value)}
                      className={cn(
                        "w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500",
                        theme === 'dark' ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200"
                      )}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">अंत (To)</label>
                    <input 
                      type="date" 
                      value={reportEndDate}
                      onChange={(e) => setReportEndDate(e.target.value)}
                      className={cn(
                        "w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500",
                        theme === 'dark' ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200"
                      )}
                    />
                  </div>
                </div>

                <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800">
                  <p className="text-xs font-bold text-indigo-700 dark:text-indigo-400 flex items-center gap-2">
                    <FileText size={16} />
                    {transactions.filter(tx => {
                      const d = toJSDate(tx.date);
                      const start = new Date(reportStartDate);
                      const end = new Date(reportEndDate);
                      end.setHours(23, 59, 59, 999);
                      return d >= start && d <= end;
                    }).length} ट्रांजैक्शन शामिल होंगे
                  </p>
                </div>

                <div className="space-y-3">
                  <button 
                    onClick={() => generatePDFReport('whatsapp')}
                    disabled={generatingReport}
                    className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-emerald-200 dark:shadow-none flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {generatingReport ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <MessageCircle size={20} />
                    )}
                    WhatsApp पर भेजें
                  </button>

                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => generatePDFReport('download')}
                      disabled={generatingReport}
                      className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
                    >
                      {generatingReport ? (
                        <div className="w-5 h-5 border-2 border-slate-400 border-t-slate-900 dark:border-t-white rounded-full animate-spin" />
                      ) : (
                        <FileDown size={20} />
                      )}
                      डाउनलोड
                    </button>
                    <button 
                      onClick={() => generatePDFReport('share')}
                      disabled={generatingReport}
                      className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-indigo-200 dark:shadow-none flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
                    >
                      {generatingReport ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Share2 size={20} />
                      )}
                      अन्य शेयर
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Layout>
  );
};

interface CustomerMerchantRecord {
  key: string;
  ownerId: string;
  customerId: string;
  customerMobile: string;
  customerName: string;
  customerPhotoURL?: string;
  shopName: string;
  shopMobile?: string;
  balance: number;
  txs: Transaction[];
  txUnsub: () => void;
  ownerUnsub: () => void;
}

const CustomerDashboard = () => {
  const { user } = useAuth();
  const [merchantRecords, setMerchantRecords] = useState<Record<string, CustomerMerchantRecord>>({});
  const [totalDue, setTotalDue] = useState(0);
  const [viewingImages, setViewingImages] = useState<string[] | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  const nextImage = () => {
    if (viewingImages) {
      setCurrentImageIndex((prev) => (prev + 1) % viewingImages.length);
    }
  };

  const prevImage = () => {
    if (viewingImages) {
      setCurrentImageIndex((prev) => (prev - 1 + viewingImages.length) % viewingImages.length);
    }
  };

  const transactions = useMemo(() => {
    const allTxs: (Transaction & { ownerId?: string; customerId?: string; shopName?: string })[] = [];
    Object.values(merchantRecords).forEach(rec => {
      rec.txs.forEach(tx => {
        allTxs.push({ ...tx, ownerId: rec.ownerId, customerId: rec.customerId, shopName: rec.shopName || '' });
      });
    });
    allTxs.sort((a, b) => getMillis(b.date) - getMillis(a.date));
    return allTxs;
  }, [merchantRecords]);

  const visibleRecords = useMemo(() => {
    const recs = Object.values(merchantRecords);
    recs.sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
    if (!selectedOwnerId || !selectedCustomerId) return recs;
    return recs.filter(r => r.ownerId === selectedOwnerId && r.customerId === selectedCustomerId);
  }, [merchantRecords, selectedOwnerId, selectedCustomerId]);

  useEffect(() => {
    if (!user || !auth.currentUser) return;

    const listenersByKey: Record<string, {
      txUnsub: () => void;
      ownerUnsub: () => void;
      ownerId: string;
      customerId: string;
      customerMobile: string;
      customerName: string;
      customerPhotoURL?: string;
      shopName: string;
      shopMobile?: string;
      txs: Transaction[];
      balance: number;
    }> = {};

    const recalcAndSync = () => {
      const mergedRecs: Record<string, CustomerMerchantRecord> = {};
      let sumBalance = 0;
      Object.entries(listenersByKey).forEach(([key, entry]) => {
        let bal = 0;
        for (const tx of entry.txs) {
          if (tx.type === 'udhar') bal += tx.amount;
          else bal -= tx.amount;
        }
        entry.balance = bal;
        sumBalance += bal;
        mergedRecs[key] = {
          key,
          ownerId: entry.ownerId,
          customerId: entry.customerId,
          customerMobile: entry.customerMobile,
          customerName: entry.customerName,
          customerPhotoURL: entry.customerPhotoURL,
          shopName: entry.shopName || `Merchant (${entry.ownerId.slice(0, 4)})`,
          shopMobile: entry.shopMobile,
          balance: bal,
          txs: entry.txs,
          txUnsub: entry.txUnsub,
          ownerUnsub: entry.ownerUnsub
        };
      });
      setMerchantRecords(mergedRecs);
      setTotalDue(sumBalance);
    };

    const normalizedUserMobile = normalizeMobile(user.mobile);
    const qCustomer = query(
      collectionGroup(db, 'customers'),
      where('mobile', '==', normalizedUserMobile)
    );

    let unsubCustomer: () => void;
    try {
      unsubCustomer = onSnapshot(qCustomer, (snapshot) => {
        const snapshotKeys = new Set<string>();

        snapshot.docs.forEach(custDoc => {
          const custData = custDoc.data() as Customer;
          const custId = custDoc.id;
          const ownerId = custData.ownerId;
          if (!ownerId) return;
          const key = `${ownerId}__${custId}`;
          snapshotKeys.add(key);

          if (listenersByKey[key]) {
            const e = listenersByKey[key];
            e.customerName = custData.name;
            e.customerMobile = custData.mobile;
            e.customerPhotoURL = custData.photoURL;
            return;
          }

          const placeholder: typeof listenersByKey[string] = {
            txUnsub: () => {},
            ownerUnsub: () => {},
            ownerId,
            customerId: custId,
            customerMobile: custData.mobile,
            customerName: custData.name,
            customerPhotoURL: custData.photoURL,
            shopName: `Merchant (${ownerId.slice(0, 4)})`,
            shopMobile: undefined,
            txs: [],
            balance: 0
          };
          listenersByKey[key] = placeholder;

          try {
            const ownerDocRef = doc(db, 'users', ownerId);
            const u = onSnapshot(ownerDocRef, (ownerSnap) => {
              if (ownerSnap.exists() && listenersByKey[key]) {
                const ownerData = ownerSnap.data() as any;
                const nm = (ownerData.shopName || ownerData.name || ownerData.fullName || `Merchant (${ownerId.slice(0, 4)})`) as string;
                const rawMob = (ownerData.mobile || ownerData.phone || ownerData.contact || ownerData.phoneNumber || '') as string;
                const mob = normalizeMobile(String(rawMob || ''));
                listenersByKey[key].shopName = nm;
                listenersByKey[key].shopMobile = mob || undefined;
                recalcAndSync();
              }
            }, () => {});
            placeholder.ownerUnsub = u;
          } catch {}

          try {
            const qTx = query(transactionCollectionRef(ownerId, custId));
            const tUnsub = onSnapshot(qTx, (txSnapshot) => {
              const txs = txSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
              if (listenersByKey[key]) {
                listenersByKey[key].txs = txs;
                recalcAndSync();
              }
            }, () => {});
            placeholder.txUnsub = tUnsub;
          } catch {}
        });

        Object.keys(listenersByKey).forEach(existingKey => {
          if (!snapshotKeys.has(existingKey)) {
            try { listenersByKey[existingKey].txUnsub(); } catch {}
            try { listenersByKey[existingKey].ownerUnsub(); } catch {}
            delete listenersByKey[existingKey];
          }
        });

        recalcAndSync();
      }, (error) => handleFirestoreError(error, OperationType.LIST, `collectionGroup:customers`));
    } catch (e: any) {
      console.warn("CustomerDashboard: skipping collectionGroup customer read (needs composite index?)", e?.message || e);
      unsubCustomer = () => {};
    }

    return () => {
      unsubCustomer();
      Object.values(listenersByKey).forEach(entry => {
        try { entry.txUnsub(); } catch {}
        try { entry.ownerUnsub(); } catch {}
      });
    };
  }, [user]);

  return (
    <Layout title="My Khata">
      <div className="p-4 space-y-6">
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-100 text-center space-y-4">
          <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto">
            <UserIcon size={40} />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight">{user?.name}</h2>
            <p className="text-slate-500 font-medium">{user?.mobile}</p>
          </div>
          <div className="pt-4 border-t border-slate-100">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Outstanding</p>
            <p className={cn(
              "text-4xl font-black tracking-tighter",
              totalDue > 0 ? "text-red-600" : totalDue < 0 ? "text-emerald-600" : "text-slate-900"
            )}>
              ₹{Math.abs(totalDue).toLocaleString()}
            </p>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mt-1">
              {totalDue > 0 ? "You owe the shop" : totalDue < 0 ? "Shop owes you" : "Settled"}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {selectedOwnerId && selectedCustomerId ? (
            <button
              onClick={() => {
                setSelectedOwnerId(null);
                setSelectedCustomerId(null);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
            >
              ← All Merchants
            </button>
          ) : null}
          {visibleRecords.length === 0 ? (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 text-center text-sm text-slate-500 shadow-sm">
              No merchant khata records found for your number yet.
            </div>
          ) : (
            visibleRecords.map(rec => {
              const hasShopNumber = !!rec.shopMobile;
              const whatsappMobile = hasShopNumber ? `91${rec.shopMobile}` : '';
              const whatsappMsg = encodeURIComponent('नमस्ते, मेरे खाते के transaction/balance के संबंध में मुझे सहायता चाहिए।');
              const telLink = hasShopNumber ? `tel:+91${rec.shopMobile}` : undefined;
              const smsLink = hasShopNumber ? `sms:+91${rec.shopMobile}` : undefined;
              const waLink = hasShopNumber ? `https://wa.me/${whatsappMobile}?text=${whatsappMsg}` : undefined;

              return (
                <div key={rec.key} className="bg-white rounded-2xl border border-slate-300/80 shadow-md shadow-slate-200/60 overflow-hidden p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center flex-shrink-0 ring-1 ring-indigo-100">
                        <Store size={22} />
                      </div>
                      <div className="min-w-0 flex-1 pt-1">
                        <p className="text-[17px] font-extrabold text-slate-900 truncate leading-tight">
                          {rec.shopName}
                        </p>
                        <p className="text-[12px] text-slate-500 font-semibold mt-1 tracking-tight">
                          Customer ID: <span className="font-mono text-slate-600">{rec.customerId.slice(0, 8)}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0 pt-0.5">
                      <p className={cn(
                        "text-2xl font-black leading-none whitespace-nowrap tracking-tight",
                        rec.balance > 0 ? "text-red-600" : rec.balance < 0 ? "text-emerald-600" : "text-slate-400"
                      )}>
                        ₹{Math.abs(rec.balance).toLocaleString()}
                      </p>
                      <p className={cn(
                        "text-[10px] font-black uppercase tracking-[0.18em] whitespace-nowrap px-2.5 py-1 rounded-full",
                        rec.balance > 0
                          ? "text-red-700 bg-red-50 ring-1 ring-red-100"
                          : rec.balance < 0
                          ? "text-emerald-700 bg-emerald-50 ring-1 ring-emerald-100"
                          : "text-slate-500 bg-slate-50 ring-1 ring-slate-200"
                      )}>
                        {rec.balance > 0 ? "DUE" : rec.balance < 0 ? "ADVANCE" : "SETTLED"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5">
                    <div className="grid grid-cols-3 gap-2.5">
                      <a
                        href={telLink || '#'}
                        aria-disabled={!hasShopNumber}
                        onClick={(e) => { if (!hasShopNumber) { e.preventDefault(); return; } }}
                        className={cn(
                          "flex flex-col items-center justify-center gap-1.5 py-3 rounded-2xl font-bold text-[12px] transition-colors ring-1",
                          hasShopNumber
                            ? "text-slate-700 bg-white hover:bg-slate-50 ring-slate-200"
                            : "text-slate-300 bg-slate-100 ring-slate-200 cursor-not-allowed"
                        )}
                      >
                        <Phone size={19} className={cn(!hasShopNumber && "opacity-40")} />
                        Call
                      </a>
                      <a
                        href={smsLink || '#'}
                        aria-disabled={!hasShopNumber}
                        onClick={(e) => { if (!hasShopNumber) { e.preventDefault(); return; } }}
                        className={cn(
                          "flex flex-col items-center justify-center gap-1.5 py-3 rounded-2xl font-bold text-[12px] transition-colors ring-1",
                          hasShopNumber
                            ? "text-slate-700 bg-white hover:bg-slate-50 ring-slate-200"
                            : "text-slate-300 bg-slate-100 ring-slate-200 cursor-not-allowed"
                        )}
                      >
                        <SmsIcon size={19} className={cn(!hasShopNumber && "opacity-40")} />
                        Message
                      </a>
                      <a
                        href={waLink || '#'}
                        target={hasShopNumber ? '_blank' : undefined}
                        rel={hasShopNumber ? 'noopener noreferrer' : undefined}
                        aria-disabled={!hasShopNumber}
                        onClick={(e) => { if (!hasShopNumber) { e.preventDefault(); return; } }}
                        className={cn(
                          "flex flex-col items-center justify-center gap-1.5 py-3 rounded-2xl font-bold text-[12px] transition-colors ring-1",
                          hasShopNumber
                            ? "text-emerald-700 bg-emerald-50 hover:bg-emerald-100 ring-emerald-100"
                            : "text-slate-300 bg-slate-100 ring-slate-200 cursor-not-allowed"
                        )}
                      >
                        <MessageCircle size={19} className={cn(!hasShopNumber && "opacity-40")} />
                        WhatsApp
                      </a>
                    </div>
                  </div>

                  <div className="mt-5">
                    <button
                      onClick={() => {
                        setSelectedOwnerId(rec.ownerId);
                        setSelectedCustomerId(rec.customerId);
                      }}
                      className={cn(
                        "w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-extrabold text-[13px]",
                        "transition-all active:scale-[0.985]",
                        "bg-indigo-600/95 text-white shadow-sm shadow-indigo-200",
                        "hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2"
                      )}
                    >
                      <ReceiptText size={17} />
                      View Transactions
                      <ChevronRight size={17} className="opacity-90" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {selectedOwnerId && selectedCustomerId ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                Transactions • {visibleRecords[0]?.shopName || "Merchant"} • {selectedCustomerId.slice(0, 6)}
              </h3>
            </div>
            <div className="space-y-3">
              {transactions
                .filter(tx => tx.ownerId === selectedOwnerId && tx.customerId === selectedCustomerId)
                .map((tx) => (
                <div key={tx.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                  <div className="flex gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center",
                      tx.type === 'udhar' ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
                    )}>
                      {tx.type === 'udhar' ? <ArrowUpRight size={20} /> : <ArrowDownLeft size={20} />}
                    </div>
                    <div>
                      {(tx as any).shopName ? (
                        <div className="flex items-center gap-1 mb-0.5">
                          <Store size={10} className="text-slate-400" />
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            {(tx as any).shopName}
                          </p>
                        </div>
                      ) : null}
                      <p className="font-bold text-slate-900">₹{tx.amount.toLocaleString()}</p>
                      <p className="text-xs text-slate-500 font-medium">
                        {tx.note || (tx.type === 'udhar' ? 'उधार' : 'जमा')} • {format(toJSDate(tx.date), 'dd MMM')}
                      </p>
                      {tx.imageUrls && tx.imageUrls.length > 0 && (
                        <button 
                          onClick={() => {
                            setViewingImages(tx.imageUrls || []);
                            setCurrentImageIndex(0);
                          }}
                          className="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-[10px] font-bold border border-indigo-100 hover:bg-indigo-100 transition-colors"
                        >
                          <FileText size={12} />
                          बिल देखें (Bill Dekhe)
                        </button>
                      )}
                    </div>
                  </div>
                  <div className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                    tx.type === 'udhar' ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
                  )}>
                    {tx.type === 'udhar' ? "उधार" : "जमा"}
                  </div>
                </div>
              ))}
              {transactions.filter(tx => tx.ownerId === selectedOwnerId && tx.customerId === selectedCustomerId).length === 0 && (
                <div className="bg-white p-6 rounded-2xl border border-slate-200 text-center text-sm text-slate-500 shadow-sm">
                  No transactions yet for this merchant.
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {/* Image Viewer Modal */}
      <AnimatePresence>
        {viewingImages && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative w-full h-full flex flex-col"
            >
              {/* Header */}
              <div className="absolute top-0 left-0 right-0 p-6 flex items-center justify-between z-10 bg-gradient-to-b from-black/50 to-transparent">
                <div className="text-white">
                  <p className="text-sm font-bold opacity-80">Bill Photo</p>
                  <p className="text-xs opacity-60">{currentImageIndex + 1} of {viewingImages.length}</p>
                </div>
                <button 
                  onClick={() => setViewingImages(null)}
                  className="w-10 h-10 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center backdrop-blur-md transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Image Container */}
              <div className="flex-1 flex items-center justify-center p-4">
                <motion.img 
                  key={currentImageIndex}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  src={viewingImages[currentImageIndex]} 
                  alt="bill full" 
                  className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* Navigation Controls */}
              {viewingImages.length > 1 && (
                <>
                  <button 
                    onClick={prevImage}
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center backdrop-blur-md transition-colors"
                  >
                    <ChevronLeft size={32} />
                  </button>
                  <button 
                    onClick={nextImage}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center backdrop-blur-md transition-colors"
                  >
                    <ChevronRight size={32} />
                  </button>

                  {/* Dots Indicator */}
                  <div className="absolute bottom-10 left-0 right-0 flex justify-center gap-2">
                    {viewingImages.map((_, idx) => (
                      <div 
                        key={idx}
                        className={cn(
                          "w-2 h-2 rounded-full transition-all duration-300",
                          idx === currentImageIndex ? "bg-white w-6" : "bg-white/30"
                        )}
                      />
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Layout>
  );
};

const SupplierDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  useBackgroundSync();
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [transactions, setTransactions] = useState<SupplierTransaction[]>([]);

  const transactionsWithBalance = useMemo(() => {
    // Sort by date ascending to calculate running balance accurately
    const sorted = [...transactions].sort((a, b) => getMillis(a.date) - getMillis(b.date));
    let currentBalance = 0;
    const withBalance = sorted.map(tx => {
      if (tx.type === 'udhar') {
        currentBalance += tx.amount;
      } else {
        currentBalance -= tx.amount;
      }
      return { ...tx, runningBalance: currentBalance };
    });
    // Return in descending order for display (newest first)
    return withBalance.reverse();
  }, [transactions]);

  const supplierBalance = useMemo(() => {
    let bal = 0;
    for (const tx of transactions) {
      if (tx.type === 'udhar') bal += tx.amount;
      else bal -= tx.amount;
    }
    return bal;
  }, [transactions]);

  const [isAddingEntry, setIsAddingEntry] = useState<'udhar' | 'jama' | null>(null);
  const [isSettingReminder, setIsSettingReminder] = useState(false);
  const [reminderOption, setReminderOption] = useState<'week' | 'month' | 'calendar' | null>(null);
  const [customReminderDate, setCustomReminderDate] = useState('');
  const [entry, setEntry] = useState({ amount: '', note: '', date: format(new Date(), "yyyy-MM-dd'T'HH:mm") });
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ name: '', mobile: '' });
  const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<SupplierTransaction | null>(null);
  const [editTxData, setEditTxData] = useState({ amount: '', note: '', date: '' });
  const [editImageFiles, setEditImageFiles] = useState<File[]>([]);
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);
  const [showEditPhotoOptions, setShowEditPhotoOptions] = useState(false);
  const [isDeletingTransaction, setIsDeletingTransaction] = useState(false);
  const [isDeletingSupplier, setIsDeletingSupplier] = useState(false);
  const [isDeletingPhoto, setIsDeletingPhoto] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportStartDate, setReportStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [reportEndDate, setReportEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [generatingReport, setGeneratingReport] = useState(false);
  const [viewingImages, setViewingImages] = useState<string[] | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isSettingThreshold, setIsSettingThreshold] = useState(false);
  const [thresholdInput, setThresholdInput] = useState('');
  const [isSettingDailyReminder, setIsSettingDailyReminder] = useState(false);
  const [dailyReminderTimeInput, setDailyReminderTimeInput] = useState('');
  const [isDeletingAllTransactions, setIsDeletingAllTransactions] = useState(false);

  const nextImage = () => {
    if (viewingImages) {
      setCurrentImageIndex((prev) => (prev + 1) % viewingImages.length);
    }
  };

  const prevImage = () => {
    if (viewingImages) {
      setCurrentImageIndex((prev) => (prev - 1 + viewingImages.length) % viewingImages.length);
    }
  };

  useEffect(() => {
    if (!id || !user || !auth.currentUser) return;
    const unsubSupplier = onSnapshot(supplierDocRef(user.uid, id), (doc) => {
      if (doc.exists()) {
        const data = doc.data() as Supplier;
        setSupplier({ id: doc.id, ...data } as Supplier);
        setEditData({ name: data.name, mobile: data.mobile });
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, `users/${user.uid}/suppliers/${id}`));

    const unsubTransactions = onSnapshot(
      query(supplierTxCollectionRef(user.uid, id)),
      (snapshot) => {
        const txs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SupplierTransaction));
        txs.sort((a, b) => getMillis(b.date) - getMillis(a.date));
        setTransactions(txs);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/suppliers/${id}/transactions`)
    );

    return () => {
      unsubSupplier();
      unsubTransactions();
    };
  }, [id, user]);

  const sendSMSNotification = (supplierName: string, mobile: string, amount: number, type: 'udhar' | 'jama', newBalance: number) => {
    const shopName = user?.shopName || "किराना स्टोर";
    const typeText = type === 'udhar' ? 'उधार' : 'जमा';
    const balanceText = newBalance > 0 ? `कुल बकाया: ₹${newBalance}` : newBalance < 0 ? `एडवांस: ₹${Math.abs(newBalance)}` : `बैलेंस: ₹0`;
    
    let message = user?.txSmsFormat || `नमस्ते {name}, आपके {shopName} खाते में ₹{amount} का {type} जोड़ा गया है। {balance}। धन्यवाद।`;
    
    message = message
      .replace(/{name}/g, supplierName)
      .replace(/{shopName}/g, shopName)
      .replace(/{amount}/g, amount.toString())
      .replace(/{type}/g, typeText)
      .replace(/{balance}/g, balanceText);
    
    const encodedMessage = encodeURIComponent(message);
    const smsUrl = `sms:+91${mobile}?body=${encodedMessage}`;
    
    window.location.href = smsUrl;
  };

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplier || !user || !isAddingEntry) return;
    setUploading(true);

    try {
      const imageUrls: string[] = [];
      const pendingFiles: File[] = [];
      const pendingFileStoragePaths: string[] = [];
      const txDocRef = doc(supplierTxCollectionRef(user.uid, supplier.id));
      const transactionId = txDocRef.id;

      if (imageFiles.length > 0) {
        if (isOnline) {
          for (const file of imageFiles) {
            try {
              const storagePath = `bills/${user.uid}/${supplier.id}/${transactionId}/${file.name}`;
              const url = await uploadToStorage(file, storagePath);
              imageUrls.push(url);
            } catch (error) {
              console.error("Image upload failed, saving locally for sync", error);
              imageUrls.push(URL.createObjectURL(file));
              pendingFiles.push(file);
              pendingFileStoragePaths.push(`bills/${user.uid}/${supplier.id}/${transactionId}/${file.name}`);
            }
          }
        } else {
          console.warn("Offline: saving images locally for sync");
          for (const file of imageFiles) {
            imageUrls.push(URL.createObjectURL(file));
            pendingFiles.push(file);
            pendingFileStoragePaths.push(`bills/${user.uid}/${supplier.id}/${transactionId}/${file.name}`);
          }
        }
      }

      const amount = parseFloat(entry.amount);
      if (isNaN(amount) || amount <= 0) {
        alert("कृपया सही राशि दर्ज करें (Enter valid amount)");
        setUploading(false);
        return;
      }
      if (!entry.date) {
        alert("कृपया सही तारीख चुनें (Select valid date)");
        setUploading(false);
        return;
      }
      const type = isAddingEntry;
      const supplierRef = supplierDocRef(user.uid, supplier.id);
      const diff = type === 'udhar' ? amount : -amount;
      const normalizedMobile = normalizeMobile(supplier.mobile);

      const txData: any = {
        supplierMobile: normalizedMobile,
        ownerId: user.uid,
        amount,
        type,
        note: entry.note,
        date: Timestamp.fromDate(new Date(entry.date)),
        imageUrl: imageUrls.length > 0 ? imageUrls[0] : '',
        imageUrls: imageUrls,
        createdAt: Timestamp.now()
      };

      if (supplier.id) {
        txData.supplierId = supplier.id;
      }

      await setDoc(txDocRef, txData);

      for (let i = 0; i < pendingFiles.length; i++) {
        await savePendingUpload(
          pendingFiles[i],
          pendingFileStoragePaths[i],
          txDocRef.id,
          'supplierTransactions',
          'imageUrls',
          user.uid,
          supplier.id
        );
      }

      await updateDoc(supplierRef, { 
        totalDue: increment(diff),
        lastUpdatedAt: Timestamp.now()
      });

      const newBalance = supplierBalance + diff;
      
      setEntry({ amount: '', note: '', date: format(new Date(), "yyyy-MM-dd'T'HH:mm") });
      setImageFiles([]);
      setIsAddingEntry(null);

      sendSMSNotification(supplier.name, supplier.mobile, amount, type, newBalance);
    } catch (error: any) {
      console.error("Error adding entry:", error);
      alert("प्रविष्टि सुरक्षित करने में त्रुटि हुई (Error saving): " + (error.message || "Unknown error"));
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteSupplier = async () => {
    if (!supplier) return;
    setUploading(true);
    try {
      const photosToDelete: string[] = [];
      transactions.forEach(tx => {
        if (tx.imageUrls && tx.imageUrls.length > 0) {
          photosToDelete.push(...tx.imageUrls);
        }
      });

      if (supplier.photoURL) {
        photosToDelete.push(supplier.photoURL);
      }

      for (const url of photosToDelete) {
        try {
          if (url.includes('firebasestorage.googleapis.com')) {
            const photoRef = ref(storage, url);
            await deleteObject(photoRef);
          }
        } catch (e) {
          console.error("Error deleting photo from storage:", e);
        }
      }

      const batch = writeBatch(db);
      transactions.forEach(tx => {
        batch.delete(supplierTxDocRef(user?.uid || supplier.ownerId, supplier.id, tx.id));
      });

      batch.delete(supplierDocRef(user?.uid || supplier.ownerId, supplier.id));

      await batch.commit();
      navigate('/');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `suppliers/${supplier.id}`);
    } finally {
      setUploading(false);
      setIsDeletingSupplier(false);
    }
  };

  const handleUpdateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplier || !user) return;

    const normalizedMobile = normalizeMobile(editData.mobile);

    try {
      const qMobile = query(supplierCollectionRef(user.uid), where('mobile', '==', normalizedMobile));
      const qName = query(supplierCollectionRef(user.uid), where('name', '==', editData.name));
      
      const [mobileResults, nameResults] = await Promise.all([getDocs(qMobile), getDocs(qName)]);
      
      const duplicate = [...mobileResults.docs, ...nameResults.docs].find(d => d.id !== supplier.id);
      if (duplicate) {
        alert("यह नाम या मोबाइल नंबर पहले से ही किसी अन्य सप्लायर को दिया गया है।");
        return;
      }
    } catch (error) {
      console.error("Duplicate check failed", error);
    }

    setUploading(true);
    try {
      let photoURL = supplier.photoURL || '';
      let pendingFile: File | null = null;
      const supplierPhotoPath = `suppliers/${user.uid}/${supplier.id}/profile.jpg`;
      
      if (editPhotoFile) {
        if (isOnline) {
          try {
            photoURL = await uploadToStorage(editPhotoFile, supplierPhotoPath);
            if (supplier.photoURL && supplier.photoURL.includes('firebasestorage.googleapis.com') && !supplier.photoURL.includes(encodeURIComponent(`${supplier.id}/profile.jpg`))) {
              try {
                await deleteObject(ref(storage, supplier.photoURL));
              } catch (_) {}
            }
          } catch (error) {
            console.error("Photo upload failed, saving locally for sync", error);
            photoURL = URL.createObjectURL(editPhotoFile);
            pendingFile = editPhotoFile;
          }
        } else {
          console.warn("Offline: saving photo locally for sync");
          photoURL = URL.createObjectURL(editPhotoFile);
          pendingFile = editPhotoFile;
        }
      }

      const updateData = {
        name: editData.name,
        mobile: normalizedMobile,
        photoURL,
        lastUpdatedAt: Timestamp.now()
      };

      await updateDoc(supplierDocRef(user.uid, supplier.id), updateData);

      if (pendingFile) {
        await savePendingUpload(
          pendingFile,
          supplierPhotoPath,
          supplier.id,
          'suppliers',
          'photoURL',
          user.uid
        );
      }

      setEditPhotoFile(null);
      setIsEditing(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `suppliers/${supplier.id}`);
    } finally {
      setUploading(false);
    }
  };

  const generatePDFReport = async (action: 'download' | 'share' | 'whatsapp' = 'download') => {
    if (!supplier || !user) return;
    setGeneratingReport(true);

    try {
      const doc = new jsPDF();
      const shopName = user.shopName || "Kirana Store";
      const startDate = new Date(reportStartDate);
      const endDate = new Date(reportEndDate);
      endDate.setHours(23, 59, 59, 999);

      const filteredTxs = transactionsWithBalance.filter(tx => {
        const txDate = toJSDate(tx.date);
        return txDate >= startDate && txDate <= endDate;
      }).sort((a, b) => getMillis(a.date) - getMillis(b.date));

      doc.setFontSize(22);
      doc.setTextColor(79, 70, 229);
      doc.text(shopName, 105, 20, { align: 'center' });
      
      doc.setFontSize(12);
      doc.setTextColor(100, 116, 139);
      doc.text(`Supplier Statement`, 105, 30, { align: 'center' });
      doc.text(`${format(startDate, 'dd/MM/yyyy')} to ${format(endDate, 'dd/MM/yyyy')}`, 105, 38, { align: 'center' });

      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text(`Supplier: ${supplier.name}`, 20, 55);
      doc.text(`Mobile: ${supplier.mobile}`, 20, 63);

      const tableData = filteredTxs.map(tx => [
        format(toJSDate(tx.date), 'dd/MM/yyyy'),
        tx.note || (tx.type === 'udhar' ? 'Debit' : 'Credit'),
        tx.type === 'udhar' ? `Rs.${tx.amount}` : '-',
        tx.type === 'jama' ? `Rs.${tx.amount}` : '-',
        `Rs.${tx.runningBalance || 0}`,
        tx.imageUrl ? 'View' : '-'
      ]);

      autoTable(doc, {
        startY: 75,
        head: [['Date', 'Note', 'Debit', 'Credit', 'Remaining Balance', 'Receipt']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 10, cellPadding: 3 },
        columnStyles: {
          2: { textColor: [220, 38, 38] },
          3: { textColor: [5, 150, 105] },
          4: { fontStyle: 'bold' },
          5: { textColor: [79, 70, 229], fontStyle: 'bold' }
        },
        didDrawCell: (data) => {
          if (data.section === 'body' && data.column.index === 5) {
            const tx = filteredTxs[data.row.index];
            if (tx.imageUrl) {
              doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url: tx.imageUrl });
            }
          }
        }
      });

      const finalY = (doc as any).lastAutoTable.finalY + 15;
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text(`Total Due: Rs.${supplier.totalDue}`, 140, finalY);

      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(`Generated by Kirana Master • Page ${i} of ${pageCount}`, 105, 285, { align: 'center' });
      }

      const fileName = `${supplier.name}_Statement.pdf`;

      if (action === 'whatsapp') {
        const pdfBlob = doc.output('blob');
        const storageRef = ref(storage, `reports/${user.uid}/${Date.now()}_${fileName}`);
        const uploadResult = await uploadBytes(storageRef, pdfBlob);
        const downloadUrl = await getDownloadURL(uploadResult.ref);
        
        const message = `नमस्ते ${supplier.name}, आपके ${user.shopName || 'हमारी दुकान'} का खाता विवरण (PDF) यहाँ है: ${downloadUrl}\n\nकुल बकाया: ₹${supplier.totalDue}`;
        const whatsappUrl = `https://wa.me/91${supplier.mobile}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
      } else if (action === 'share' && navigator.share) {
        const pdfBlob = doc.output('blob');
        const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
        
        try {
          await navigator.share({
            files: [file],
            title: 'Account Statement',
            text: `Statement for ${supplier.name}`
          });
        } catch (err) {
          console.error("Sharing failed:", err);
          doc.save(fileName);
        }
      } else {
        doc.save(fileName);
      }
      
      setIsReportModalOpen(false);
    } catch (error) {
      console.error("PDF generation failed:", error);
      alert("Error generating report. Please try again.");
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleEditTransaction = (tx: SupplierTransaction) => {
    setEditingTransaction(tx);
    setEditTxData({
      amount: tx.amount.toString(),
      note: tx.note || '',
      date: format(toJSDate(tx.date), "yyyy-MM-dd'T'HH:mm")
    });
    setExistingImageUrls(tx.imageUrls || []);
    setEditImageFiles([]);
    setIsDeletingTransaction(false);
  };

  const handleUpdateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplier || !editingTransaction || !user) return;
    
    setUploading(true);
    const newAmount = parseFloat(editTxData.amount);
    const oldAmount = editingTransaction.amount;
    const diff = newAmount - oldAmount;
    const type = editingTransaction.type;
    const supplierRef = supplierDocRef(user.uid, supplier.id);
    const txRef = supplierTxDocRef(user.uid, supplier.id, editingTransaction.id);
    const totalDueDiff = type === 'udhar' ? diff : -diff;

    try {
      const originalImageUrls = editingTransaction.imageUrls || [];
      const removedUrls = originalImageUrls.filter(url => !existingImageUrls.includes(url));
      if (removedUrls.length > 0 && isOnline) {
        for (const url of removedUrls) {
          try {
            if (url.includes('firebasestorage.googleapis.com')) {
              const photoRef = ref(storage, url);
              await deleteObject(photoRef);
            }
          } catch (e) {
            console.error("Error deleting removed supplier transaction bill image:", e);
          }
        }
      }

      const newImageUrls = [...existingImageUrls];
      if (editImageFiles.length > 0) {
        if (isOnline) {
          for (const file of editImageFiles) {
            try {
              const storageRef = ref(storage, `bills/${user.uid}/${supplier.id}/${editingTransaction.id}/${file.name}`);
              await uploadBytes(storageRef, file);
              const url = await getDownloadURL(storageRef);
              newImageUrls.push(url);
            } catch (error) {
              console.error("Image upload failed, saving without image", error);
            }
          }
        }
      }

      updateDoc(txRef, {
        amount: newAmount,
        note: editTxData.note,
        date: Timestamp.fromDate(new Date(editTxData.date)),
        imageUrl: newImageUrls.length > 0 ? newImageUrls[0] : '',
        imageUrls: newImageUrls
      }).catch(error => handleFirestoreError(error, OperationType.UPDATE, `supplierTransactions/${editingTransaction.id}`));

      updateDoc(supplierRef, { 
        totalDue: increment(totalDueDiff),
        lastUpdatedAt: Timestamp.now()
      }).catch(error => handleFirestoreError(error, OperationType.UPDATE, `suppliers/${supplier.id}`));

      setEditingTransaction(null);
      setEditImageFiles([]);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `supplierTransactions/${editingTransaction.id}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteTransaction = async () => {
    if (!supplier || !editingTransaction) return;
    
    setUploading(true);
    const amount = editingTransaction.amount;
    const type = editingTransaction.type;
    const imageUrls = editingTransaction.imageUrls || [];
    const supplierRef = supplierDocRef(user.uid, supplier.id);
    const txRef = supplierTxDocRef(user.uid, supplier.id, editingTransaction.id);
    const totalDueDiff = type === 'udhar' ? -amount : amount;

    try {
      for (const url of imageUrls) {
        try {
          if (url.includes('firebasestorage.googleapis.com')) {
            const photoRef = ref(storage, url);
            await deleteObject(photoRef);
          }
        } catch (e) {
          console.error("Error deleting transaction photo:", e);
        }
      }

      await deleteDoc(txRef);

      await updateDoc(supplierRef, { 
        totalDue: increment(totalDueDiff),
        lastUpdatedAt: Timestamp.now()
      });

      setEditingTransaction(null);
      setIsDeletingTransaction(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `supplierTransactions/${editingTransaction.id}`);
    } finally {
      setUploading(false);
    }
  };

  const handleSetReminder = async (date: Date | null) => {
    if (!supplier) return;
    try {
      await updateDoc(supplierDocRef(user?.uid || supplier.ownerId, supplier.id), {
        reminderDate: date ? Timestamp.fromDate(date) : null,
        lastUpdatedAt: Timestamp.now()
      });
      setIsSettingReminder(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `suppliers/${supplier.id}`);
    }
  };

  const handleSetThreshold = async () => {
    if (!supplier) return;
    try {
      const threshold = thresholdInput === '' ? null : parseFloat(thresholdInput);
      await updateDoc(supplierDocRef(user?.uid || supplier.ownerId, supplier.id), {
        alertThreshold: threshold,
        lastUpdatedAt: Timestamp.now()
      });
      setIsSettingThreshold(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `suppliers/${supplier.id}`);
    }
  };

  const handleSetDailyReminder = async () => {
    if (!supplier || !user) return;
    try {
      await updateDoc(supplierDocRef(user.uid, supplier.id), {
        dailyReminderTime: dailyReminderTimeInput || deleteField(),
        lastUpdatedAt: Timestamp.now()
      });
      setIsSettingDailyReminder(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `suppliers/${supplier.id}`);
    }
  };

  const handleDeleteAllTransactions = async () => {
    if (!supplier || !user) return;
    try {
      const photosToDelete: string[] = [];
      transactions.forEach(tx => {
        if (tx.imageUrls && tx.imageUrls.length > 0) {
          photosToDelete.push(...tx.imageUrls);
        }
      });

      for (const url of photosToDelete) {
        try {
          if (url.includes('firebasestorage.googleapis.com')) {
            const photoRef = ref(storage, url);
            await deleteObject(photoRef);
          }
        } catch (e) {
          console.error("Error deleting photo during delete all:", e);
        }
      }

      const batch = writeBatch(db);
      transactions.forEach((tx) => {
        batch.delete(supplierTxDocRef(user.uid, supplier.id, tx.id));
      });

      batch.update(supplierDocRef(user.uid, supplier.id), {
        totalDue: 0,
        lastUpdatedAt: Timestamp.now()
      });

      await batch.commit();
      setIsDeletingAllTransactions(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `suppliers/${supplier.id}/all-transactions`);
    }
  };

  const getNextWeekDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d;
  };

  const getNextMonthDate = () => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d;
  };

  const handleWhatsAppReminder = () => {
    if (!supplier || !user) return;
    const amount = Math.abs(supplierBalance).toLocaleString();
    const type = supplierBalance > 0 ? "बकाया (Udhar)" : "एडवांस (Advance)";
    
    let message = "";
    if (supplier.alertThreshold && supplierBalance > supplier.alertThreshold) {
      message = `नमस्ते ${supplier.name}, आपका बकाया (₹${amount}) आपकी सेट की गई सीमा (₹${supplier.alertThreshold.toLocaleString()}) से अधिक हो गया है। कृपया जल्द भुगतान करें। धन्यवाद।`;
    } else {
      message = user.smsFormat || `नमस्ते {name}, Khatabook पर आपका ₹{amount} का {type} है। कृपया जल्द भुगतान करें। धन्यवाद।`;
      message = message.replace('{name}', supplier.name)
                       .replace('{amount}', amount)
                       .replace('{type}', type);
    }

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/91${supplier.mobile}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleSMSReminder = () => {
    if (!supplier || !user) return;
    const amount = Math.abs(supplierBalance).toLocaleString();
    const type = supplierBalance > 0 ? "बकाया (Udhar)" : "एडवांस (Advance)";
    
    let message = "";
    if (supplier.alertThreshold && supplierBalance > supplier.alertThreshold) {
      message = `नमस्ते ${supplier.name}, आपका बकाया (₹${amount}) आपकी सेट की गई सीमा (₹${supplier.alertThreshold.toLocaleString()}) से अधिक हो गया है। कृपया जल्द भुगतान करें। धन्यवाद।`;
    } else {
      message = user.smsFormat || `नमस्ते {name}, Khatabook पर आपका ₹{amount} का {type} है। कृपया जल्द भुगतान करें। धन्यवाद।`;
      message = message.replace('{name}', supplier.name)
                       .replace('{amount}', amount)
                       .replace('{type}', type);
    }

    const encodedMessage = encodeURIComponent(message);
    const smsUrl = `sms:+91${supplier.mobile}?body=${encodedMessage}`;
    window.location.href = smsUrl;
  };

  if (!supplier) return <div className="p-8 text-center">लोड हो रहा है...</div>;

  return (
    <Layout 
      title={supplier.name} 
      showBack 
      backTo="/?tab=suppliers"
      hideLogout
      headerClassName="bg-[#5c33cf] text-white shadow-none"
      rightAction={
        <a 
          href={`tel:${supplier.mobile}`}
          className="w-10 h-10 bg-white text-indigo-600 rounded-full shadow-lg hover:bg-slate-50 transition-all active:scale-90 flex items-center justify-center"
          title="सप्लायर को कॉल करें"
        >
          <Phone size={20} fill="currentColor" />
        </a>
      }
    >
      <div className="space-y-6 pb-32">
        {/* Supplier Profile Header */}
        <div className="flex flex-col items-center justify-center pt-8 pb-2 space-y-3">
          <div className="relative">
            {supplier.photoURL ? (
              <img 
                src={supplier.photoURL} 
                alt={supplier.name} 
                className="w-28 h-28 rounded-[2.5rem] object-cover border-4 border-white shadow-xl"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className={cn(
                "w-28 h-28 rounded-[2.5rem] flex items-center justify-center font-black text-5xl border-4 border-white shadow-xl",
                theme === 'dark' ? "bg-slate-800 text-indigo-400" : "bg-indigo-50 text-indigo-600"
              )}>
                {supplier.name[0].toUpperCase()}
              </div>
            )}
            <button 
              onClick={() => setIsEditing(true)}
              className="absolute bottom-0 right-0 p-2.5 bg-white text-indigo-600 rounded-full shadow-lg border border-slate-100 active:scale-90 transition-all"
            >
              <Camera size={18} />
            </button>
          </div>
          <div className="text-center">
            <h2 className={cn("text-3xl font-black tracking-tight", theme === 'dark' ? "text-slate-100" : "text-slate-900")}>{supplier.name}</h2>
            <p className="text-slate-400 font-black text-lg tracking-widest">
              {supplier.mobile}
            </p>
          </div>
        </div>

        {/* Balance Card Section */}
        <div className="px-4">
          <div className={cn(
            "p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden transition-colors duration-500",
            supplierBalance > 0 ? "bg-red-600" : supplierBalance < 0 ? "bg-emerald-600" : "bg-slate-600"
          )}>
            <div className="relative z-10 text-center space-y-2">
              <p className="text-white/80 text-sm font-bold uppercase tracking-widest">
                {supplierBalance > 0 ? "आपको मिलेंगे" : supplierBalance < 0 ? "आप देंगे" : "हिसाब बराबर है"}
              </p>
              <h3 className="text-6xl font-black text-white tracking-tighter">
                ₹{Math.abs(supplierBalance).toLocaleString()}
              </h3>
              
              <div className="w-full h-px bg-white/20 my-4" />

              {/* Collection Date Row */}
              <div className="flex flex-col items-center gap-3">
                <div className="flex items-center gap-2 text-white/90">
                  <Calendar size={20} />
                  <span className="text-base font-bold">
                    कलेक्शन की तारीख : {supplier.reminderDate ? format(toJSDate(supplier.reminderDate), 'dd MMM') : "सेट नहीं है"}
                  </span>
                </div>
                <button 
                  onClick={() => setIsSettingReminder(true)}
                  className="text-white font-black text-sm underline underline-offset-8 decoration-2 hover:text-white/80 transition-colors"
                >
                  तारीख़ सेट करें
                </button>
              </div>
            </div>
            
            {/* Decorative Background Icon */}
            <div className="absolute -right-8 -bottom-8 text-white/10 rotate-12">
              <BookOpen size={180} />
            </div>
          </div>
        </div>

        {/* Quick Action Icons */}
        <div className="px-4 grid grid-cols-3 gap-4">
          <button 
            onClick={() => setIsReportModalOpen(true)}
            className="flex flex-col items-center gap-2 group"
          >
            <div className={cn(
              "w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg transition-all group-active:scale-90 border",
              theme === 'dark' ? "bg-slate-900 text-indigo-400 border-slate-800" : "bg-white text-indigo-600 border-slate-50"
            )}>
              <FileDown size={28} />
            </div>
            <span className="text-xs font-black text-slate-500 uppercase tracking-wider">रिपोर्ट</span>
          </button>
          
          <button 
            onClick={handleWhatsAppReminder}
            className="flex flex-col items-center gap-2 group"
          >
            <div className={cn(
              "w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg transition-all group-active:scale-90 border",
              theme === 'dark' ? "bg-slate-900 text-emerald-400 border-slate-800" : "bg-white text-emerald-600 border-slate-50"
            )}>
              <MessageCircle size={28} />
            </div>
            <span className="text-xs font-black text-slate-500 uppercase tracking-wider">रिमाइंडर</span>
          </button>

          <button 
            onClick={handleSMSReminder}
            className="flex flex-col items-center gap-2 group"
          >
            <div className={cn(
              "w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg transition-all group-active:scale-90 border",
              theme === 'dark' ? "bg-slate-900 text-blue-400 border-slate-800" : "bg-white text-blue-600 border-slate-50"
            )}>
              <MessageSquare size={28} />
            </div>
            <span className="text-xs font-black text-slate-500 uppercase tracking-wider">SMS</span>
          </button>
        </div>

        {/* Setting Cards */}
        <div className="px-4 space-y-4">
          {/* Balance Alert Card */}
          <div className={cn(
            "p-5 rounded-[2rem] shadow-xl border flex items-center justify-between group",
            theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
          )}>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shadow-inner">
                <Bell size={28} />
              </div>
              <div>
                <h4 className={cn("font-black text-base", theme === 'dark' ? "text-slate-100" : "text-slate-900")}>बैलेंस अलर्ट</h4>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">
                  {supplier.alertThreshold ? `सीमा: ₹${supplier.alertThreshold.toLocaleString()}` : "सीमा (THRESHOLD) सेट करें"}
                </p>
                {!supplier.alertThreshold && (
                  <p className="text-slate-400 text-[10px] mt-1 font-medium">कोई सीमा सेट नहीं है</p>
                )}
              </div>
            </div>
            <button 
              onClick={() => setIsSettingThreshold(true)}
              className="text-indigo-600 font-black text-sm underline underline-offset-4 decoration-2 hover:text-indigo-700 transition-colors"
            >
              बदलें
            </button>
          </div>

          {/* Daily Reminder Card */}
          <div className={cn(
            "p-5 rounded-[2rem] shadow-xl border flex items-center justify-between group",
            theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
          )}>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-inner">
                <Clock size={28} />
              </div>
              <div>
                <h4 className={cn("font-black text-base", theme === 'dark' ? "text-slate-100" : "text-slate-900")}>डेली रिमाइंडर</h4>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">
                  {supplier.dailyReminderTime ? `समय: ${supplier.dailyReminderTime}` : "मैसेज भेजने का समय"}
                </p>
                {!supplier.dailyReminderTime && (
                  <p className="text-slate-400 text-[10px] mt-1 font-medium">कोई समय सेट नहीं है</p>
                )}
              </div>
            </div>
            <button 
              onClick={() => {
                setDailyReminderTimeInput(supplier.dailyReminderTime || '');
                setIsSettingDailyReminder(true);
              }}
              className="text-indigo-600 font-black text-sm underline underline-offset-4 decoration-2 hover:text-indigo-700 transition-colors"
            >
              बदलें
            </button>
          </div>
        </div>

        {/* Transaction History Section */}
        <div className="px-4 space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className={cn("font-black text-lg tracking-tight", theme === 'dark' ? "text-slate-100" : "text-slate-900")}>लेन-देन का इतिहास</h3>
            <button 
              onClick={() => setIsDeletingAllTransactions(true)}
              className="text-xs font-bold text-red-500 hover:text-red-600 p-1"
            >
              सब मिटाएं
            </button>
          </div>
          
          <div className="space-y-3">
            {transactionsWithBalance.length === 0 ? (
              <div className={cn(
                "p-12 text-center rounded-[2.5rem] border-2 border-dashed",
                theme === 'dark' ? "border-slate-800 text-slate-600" : "border-slate-100 text-slate-400"
              )}>
                <BookOpen size={48} className="mx-auto mb-3 opacity-20" />
                <p className="font-bold">कोई लेन-देन नहीं मिला</p>
                <p className="text-xs">नया लेन-देन जोड़ने के लिए नीचे दिए गए बटनों का उपयोग करें।</p>
              </div>
            ) : (
              transactionsWithBalance.map((tx) => (
                <motion.div 
                  key={tx.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  onClick={() => handleEditTransaction(tx)}
                  className={cn(
                    "p-4 rounded-[2rem] border shadow-sm flex items-center justify-between active:scale-[0.98] transition-all cursor-pointer",
                    theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center",
                      tx.type === 'udhar' 
                        ? "bg-red-50 text-red-600" 
                        : "bg-emerald-50 text-emerald-600"
                    )}>
                      {tx.type === 'udhar' ? <ArrowUpRight size={24} /> : <ArrowDownLeft size={24} />}
                    </div>
                    <div>
                      <p className={cn("font-black text-base", theme === 'dark' ? "text-slate-100" : "text-slate-900")}>
                        ₹{tx.amount.toLocaleString()}
                      </p>
                      <p className="text-xs text-slate-500 font-medium">
                        {tx.note || (tx.type === 'udhar' ? 'उधार' : 'जमा')} • {format(toJSDate(tx.date), 'dd MMM, hh:mm a')}
                      </p>
                      {tx.imageUrls && tx.imageUrls.length > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewingImages(tx.imageUrls || []);
                            setCurrentImageIndex(0);
                          }}
                          className={cn(
                            "mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-colors",
                            theme === 'dark' ? "bg-indigo-900/20 text-indigo-400 border-indigo-900/40 hover:bg-indigo-900/40" : "bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-100"
                          )}
                        >
                          <FileText size={12} />
                          बिल देखें (Bill Dekhe)
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-0.5">बैलेंस</p>
                    <p className={cn(
                      "font-bold text-sm",
                      (tx.runningBalance || 0) > 0 ? "text-red-600" : (tx.runningBalance || 0) < 0 ? "text-emerald-600" : "text-slate-400"
                    )}>
                      ₹{Math.abs(tx.runningBalance || 0).toLocaleString()}
                    </p>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>

        {/* Delete Supplier Button */}
        <div className="px-4 pt-8 pb-4">
          <button 
            onClick={() => setIsDeletingSupplier(true)}
            className="w-full py-4 text-red-500 font-bold text-sm flex items-center justify-center gap-2 hover:bg-red-50 rounded-2xl transition-all"
          >
            <Trash2 size={18} /> सप्लायर को डिलीट करें
          </button>
        </div>

        {/* Sticky Action Buttons */}
        {!isAddingEntry && (
          <div className={cn(
            "fixed bottom-0 left-0 right-0 z-50 p-4 pb-8 transition-all duration-300",
            theme === 'dark' ? "bg-slate-950/80 backdrop-blur-md" : "bg-white/80 backdrop-blur-md"
          )}>
            <div className="max-w-md mx-auto grid grid-cols-2 gap-4">
              <button 
                onClick={() => setIsAddingEntry('udhar')}
                className="flex items-center justify-center gap-2 p-5 bg-red-600 text-white rounded-[2rem] shadow-2xl active:scale-95 transition-all group"
              >
                <ArrowUpRight size={24} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                <span className="font-black text-base uppercase tracking-wider">आपने दिए</span>
              </button>
              <button 
                onClick={() => setIsAddingEntry('jama')}
                className="flex items-center justify-center gap-2 p-5 bg-emerald-600 text-white rounded-[2rem] shadow-2xl active:scale-95 transition-all group"
              >
                <ArrowDownLeft size={24} className="group-hover:-translate-x-1 group-hover:translate-y-1 transition-transform" />
                <span className="font-black text-base uppercase tracking-wider">आपको मिले</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Reminder Modal */}
      <AnimatePresence>
        {isSettingReminder && (
          <div className="fixed inset-0 z-[120] flex items-end justify-center p-4 sm:items-center overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingReminder(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="relative w-full max-w-md bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="p-8 space-y-8">
                <div className="space-y-2 text-center">
                  <h3 className="text-xl font-black text-slate-900 leading-tight">
                    {supplier.name} के लिए देय तारीख सेट करें
                  </h3>
                  <p className="text-sm font-medium text-slate-500">
                    Khatabook सप्लायर को चुनी हुई तारीख पर रिमाइंड कराएगा
                  </p>
                </div>

                <div className="space-y-4">
                  <button 
                    onClick={() => handleSetReminder(getNextWeekDate())}
                    className="w-full flex items-center justify-between p-4 rounded-2xl border-2 border-slate-100 hover:border-indigo-100 hover:bg-indigo-50/30 transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-6 h-6 rounded-full border-2 border-slate-300 flex items-center justify-center group-hover:border-indigo-500">
                        <div className="w-3 h-3 rounded-full bg-indigo-500 scale-0 group-hover:scale-100 transition-transform" />
                      </div>
                      <span className="font-bold text-slate-700">अगले सप्ताह</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-400 font-bold text-sm">
                      <Calendar size={16} />
                      {format(getNextWeekDate(), 'dd MMM yy')}
                    </div>
                  </button>

                  <button 
                    onClick={() => handleSetReminder(getNextMonthDate())}
                    className="w-full flex items-center justify-between p-4 rounded-2xl border-2 border-slate-100 hover:border-indigo-100 hover:bg-indigo-50/30 transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-6 h-6 rounded-full border-2 border-slate-300 flex items-center justify-center group-hover:border-indigo-500">
                        <div className="w-3 h-3 rounded-full bg-indigo-500 scale-0 group-hover:scale-100 transition-transform" />
                      </div>
                      <span className="font-bold text-slate-700">अगला महीना</span>
                    </div>
                  </button>

                  <div className="space-y-2">
                    <button 
                      onClick={() => setReminderOption(reminderOption === 'calendar' ? null : 'calendar')}
                      className="w-full flex items-center justify-between p-4 rounded-2xl border-2 border-slate-100 hover:border-indigo-100 hover:bg-indigo-50/30 transition-all group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-6 h-6 rounded-full border-2 border-slate-300 flex items-center justify-center group-hover:border-indigo-500">
                          <div className="w-3 h-3 rounded-full bg-indigo-500 scale-0 group-hover:scale-100 transition-transform" />
                        </div>
                        <span className="font-bold text-slate-700">कैलेंडर</span>
                      </div>
                    </button>
                    
                    {reminderOption === 'calendar' && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        className="px-2 pb-2"
                      >
                        <input 
                          type="date" 
                          className="w-full p-4 rounded-xl border-2 border-indigo-100 focus:border-indigo-500 outline-none font-bold"
                          onChange={(e) => {
                            if (e.target.value) {
                              handleSetReminder(new Date(e.target.value));
                            }
                          }}
                        />
                      </motion.div>
                    )}
                  </div>
                </div>

                <button 
                  onClick={() => handleSetReminder(null)}
                  className="w-full py-4 text-red-500 font-black uppercase tracking-widest hover:bg-red-50 rounded-2xl transition-colors"
                >
                  हटाना
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Daily Reminder Modal */}
      <AnimatePresence>
        {isSettingDailyReminder && (
          <div className="fixed inset-0 z-[120] flex items-end justify-center p-4 sm:items-center overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingDailyReminder(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="relative w-full max-w-md bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="p-8 space-y-8">
                <div className="space-y-2 text-center">
                  <h3 className="text-xl font-black text-slate-900 leading-tight">
                    डेली रिमाइंडर सेट करें
                  </h3>
                  <p className="text-sm font-medium text-slate-500">
                    सप्लायर को हर दिन इस समय पर रिमाइंडर भेजा जाएगा
                  </p>
                </div>

                <div className="space-y-4">
                  <input 
                    type="time" 
                    className="w-full p-4 rounded-xl border-2 border-indigo-100 focus:border-indigo-500 outline-none font-bold text-2xl text-center"
                    value={dailyReminderTimeInput}
                    onChange={(e) => setDailyReminderTimeInput(e.target.value)}
                  />
                  
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setIsSettingDailyReminder(false)}
                      className="flex-1 py-4 text-slate-600 font-bold hover:bg-slate-50 rounded-2xl transition-colors"
                    >
                      रद्द करें
                    </button>
                    <button 
                      onClick={handleSetDailyReminder}
                      className="flex-1 py-4 bg-indigo-600 text-white font-bold rounded-2xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
                    >
                      सुरक्षित करें
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Supplier Modal */}
      <AnimatePresence>
        {isEditing && (
          <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditing(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="relative w-full max-w-sm bg-white rounded-t-[2rem] sm:rounded-[2rem] p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <h2 className="text-xl font-bold mb-6">सप्लायर संपादित करें</h2>
              <form onSubmit={handleUpdateSupplier} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">सप्लायर का नाम</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="नाम दर्ज करें"
                    value={editData.name}
                    onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">मोबाइल नंबर</label>
                  <input 
                    required
                    type="tel" 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="मोबाइल नंबर दर्ज करें"
                    value={editData.mobile}
                    onChange={(e) => setEditData({ ...editData, mobile: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">फोटो अपडेट करें (वैकल्पिक)</label>
                  <div className="flex flex-col gap-3">
                    <div className="flex gap-2">
                      <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 transition-all">
                        <ImageIcon size={20} className="text-slate-400" />
                        <span className="text-sm font-medium text-slate-600">गैलरी</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={(e) => setEditPhotoFile(e.target.files?.[0] || null)}
                        />
                      </label>
                      <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 transition-all">
                        <Camera size={20} className="text-slate-400" />
                        <span className="text-sm font-medium text-slate-600">कैमरा</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          capture="environment"
                          className="hidden" 
                          onChange={(e) => setEditPhotoFile(e.target.files?.[0] || null)}
                        />
                      </label>
                    </div>
                    {(editPhotoFile || supplier.photoURL) && (
                      <div className="flex items-center justify-between p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                        <div className="flex items-center gap-3">
                          <img 
                            src={editPhotoFile ? URL.createObjectURL(editPhotoFile) : supplier.photoURL} 
                            alt="Preview" 
                            className="w-10 h-10 rounded-lg object-cover border border-indigo-200"
                            referrerPolicy="no-referrer"
                          />
                          <span className="text-xs font-bold text-indigo-700 truncate max-w-[120px]">
                            {editPhotoFile ? editPhotoFile.name : "वर्तमान फोटो"}
                          </span>
                        </div>
                        <button 
                          type="button" 
                          onClick={() => {
                            if (editPhotoFile) setEditPhotoFile(null);
                            else {
                              setIsDeletingPhoto(true);
                            }
                          }}
                          className="p-1 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Photo Delete Confirmation Overlay */}
                <AnimatePresence>
                  {isDeletingPhoto && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 z-20 bg-white rounded-[2rem] p-6 flex flex-col items-center justify-center text-center"
                    >
                      <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mb-4">
                        <Trash2 size={32} />
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 mb-2">फोटो हटाएं?</h3>
                      <p className="text-slate-500 mb-8">क्या आप वाकई इस फोटो को हटाना चाहते हैं?</p>
                      <div className="w-full space-y-3">
                        <button 
                          onClick={async () => {
                            try {
                              const ownerId = user?.uid || supplier.ownerId;
                              const expectedPath = `suppliers/${ownerId}/${supplier.id}/profile.jpg`;
                              if (supplier.photoURL && supplier.photoURL.includes('firebasestorage.googleapis.com')) {
                                try {
                                  await deleteObject(ref(storage, supplier.photoURL));
                                } catch (_) {}
                              }
                              try {
                                await deleteObject(ref(storage, expectedPath));
                              } catch (_) {}
                              await updateDoc(supplierDocRef(ownerId, supplier.id), { photoURL: '' });
                              setIsDeletingPhoto(false);
                            } catch (error) {
                              handleFirestoreError(error, OperationType.UPDATE, `suppliers/${supplier.id}`);
                            }
                          }}
                          className="w-full py-4 bg-red-600 text-white font-bold rounded-2xl shadow-lg shadow-red-100 hover:bg-red-700 transition-all"
                        >
                          हाँ, हटाएं
                        </button>
                        <button 
                          onClick={() => setIsDeletingPhoto(false)}
                          className="w-full py-4 text-slate-600 font-bold hover:bg-slate-50 rounded-2xl transition-colors"
                        >
                          नहीं, रहने दें
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <div className="pt-4 space-y-3">
                  <div className="flex gap-3">
                    <button 
                      type="button"
                      disabled={uploading}
                      onClick={() => {
                        setIsEditing(false);
                        setEditPhotoFile(null);
                      }}
                      className="flex-1 py-4 text-slate-600 font-bold hover:bg-slate-50 rounded-2xl transition-colors disabled:opacity-50"
                    >
                      रद्द करें
                    </button>
                    <button 
                      type="submit"
                      disabled={uploading}
                      className="flex-1 py-4 bg-slate-900 text-white font-bold rounded-2xl shadow-lg hover:bg-slate-800 transition-all disabled:opacity-50"
                    >
                      {uploading ? "सुरक्षित हो रहा है..." : "बदलाव सुरक्षित करें"}
                    </button>
                  </div>
                </div>
              </form>

              {/* Delete Supplier Confirmation Overlay */}
              <AnimatePresence>
                {isDeletingSupplier && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-20 bg-white rounded-[2rem] p-6 flex flex-col items-center justify-center text-center"
                  >
                    <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mb-4">
                      <Trash2 size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">सप्लायर को हटाएं?</h3>
                    <p className="text-slate-500 mb-8">क्या आप वाकई इस सप्लायर को हटाना चाहते हैं? सभी ट्रांजैक्शन मिट जाएंगे और यह वापस नहीं लिया जा सकता।</p>
                    <div className="w-full space-y-3">
                      <button 
                        onClick={handleDeleteSupplier}
                        disabled={uploading}
                        className="w-full py-4 bg-red-600 text-white font-bold rounded-2xl shadow-lg shadow-red-100 hover:bg-red-700 transition-all disabled:opacity-50"
                      >
                        {uploading ? "हटाया जा रहा है..." : "हाँ, हटाएं"}
                      </button>
                      <button 
                        onClick={() => setIsDeletingSupplier(false)}
                        className="w-full py-4 text-slate-600 font-bold hover:bg-slate-50 rounded-2xl transition-colors"
                      >
                        नहीं, रहने दें
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Entry Modal */}
      <AnimatePresence>
        {isAddingEntry && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingEntry(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="relative w-full max-sm bg-white rounded-t-[2rem] sm:rounded-[2rem] p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">
                  {isAddingEntry === 'udhar' ? "उधार जोड़ें" : "जमा जोड़ें"}
                </h2>
                <div className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                  isAddingEntry === 'udhar' ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
                )}>
                  {isAddingEntry === 'udhar' ? "उधार" : "जमा"}
                </div>
              </div>

              <form onSubmit={handleAddEntry} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">राशि (Amount)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">₹</span>
                    <input 
                      required
                      type="number" 
                      className="w-full pl-8 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-2xl font-black focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="0.00"
                      value={entry.amount}
                      onChange={(e) => setEntry({ ...entry, amount: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">नोट (Note - वैकल्पिक)</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="जैसे: 2 किलो चीनी, 1 लीटर तेल"
                    value={entry.note}
                    onChange={(e) => setEntry({ ...entry, note: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">तारीख (Date)</label>
                    <input 
                      type="datetime-local" 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      value={entry.date}
                      onChange={(e) => setEntry({ ...entry, date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">बिल फोटो</label>
                    <div className="relative">
                      <button 
                        type="button"
                        onClick={() => setShowPhotoOptions(!showPhotoOptions)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-100 transition-colors"
                      >
                        <Camera size={18} className="text-slate-400" />
                        <span className="text-sm font-medium text-slate-600">
                          {imageFiles.length > 0 ? `${imageFiles.length} फोटो` : "जोड़ें"}
                        </span>
                      </button>

                      <AnimatePresence>
                        {showPhotoOptions && (
                          <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-slate-200 rounded-2xl shadow-xl p-2 flex flex-col gap-1 z-10"
                          >
                            <label className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors">
                              <ImageIcon size={20} className="text-indigo-600" />
                              <span className="text-sm font-bold text-slate-700">गैलरी</span>
                              <input 
                                type="file" 
                                accept="image/*" 
                                multiple 
                                className="hidden" 
                                onChange={(e) => {
                                  const files = Array.from(e.target.files || []);
                                  setImageFiles([...imageFiles, ...files]);
                                  setShowPhotoOptions(false);
                                }}
                              />
                            </label>
                            <label className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors border-t border-slate-100">
                              <Camera size={20} className="text-indigo-600" />
                              <span className="text-sm font-bold text-slate-700">कैमरा</span>
                              <input 
                                type="file" 
                                accept="image/*" 
                                capture="environment" 
                                className="hidden" 
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) setImageFiles([...imageFiles, file]);
                                  setShowPhotoOptions(false);
                                }}
                              />
                            </label>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>

                {imageFiles.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {imageFiles.map((file, idx) => (
                      <div key={idx} className="relative flex-shrink-0">
                        <img 
                          src={URL.createObjectURL(file)} 
                          alt="preview" 
                          className="w-16 h-16 rounded-xl object-cover border border-slate-200"
                        />
                        <button 
                          type="button"
                          onClick={() => setImageFiles(imageFiles.filter((_, i) => i !== idx))}
                          className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 text-white rounded-full flex items-center justify-center shadow-md"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsAddingEntry(null)}
                    className="flex-1 py-4 text-slate-600 font-bold hover:bg-slate-50 rounded-2xl transition-colors"
                  >
                    रद्द करें
                  </button>
                  <button 
                    type="submit"
                    disabled={uploading}
                    className={cn(
                      "flex-1 py-4 text-white font-bold rounded-2xl shadow-lg transition-all",
                      isAddingEntry === 'udhar' ? "bg-red-600 hover:bg-red-700 shadow-red-100" : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100",
                      uploading && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {uploading ? "सुरक्षित हो रहा है..." : "प्रविष्टि सुरक्षित करें"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Transaction Modal */}
      <AnimatePresence>
        {editingTransaction && (
          <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingTransaction(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="relative w-full max-w-sm bg-white rounded-t-[2rem] sm:rounded-[2rem] p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <button 
                    type="button"
                    onClick={() => setEditingTransaction(null)}
                    className="p-2 -ml-2 hover:bg-slate-100 rounded-full transition-colors"
                  >
                    <ArrowLeft size={20} className="text-slate-600" />
                  </button>
                  <h2 className="text-xl font-bold">ट्रांजैक्शन संपादित करें</h2>
                </div>
                <div className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                  editingTransaction.type === 'udhar' ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
                )}>
                  {editingTransaction.type === 'udhar' ? "उधार" : "जमा"}
                </div>
              </div>

              <form onSubmit={handleUpdateTransaction} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">राशि (Amount)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">₹</span>
                    <input 
                      required
                      type="number" 
                      className="w-full pl-8 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-2xl font-black focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="0.00"
                      value={editTxData.amount}
                      onChange={(e) => setEditTxData({ ...editTxData, amount: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">नोट (Note - वैकल्पिक)</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="जैसे: 2 किलो चीनी, 1 लीटर तेल"
                    value={editTxData.note}
                    onChange={(e) => setEditTxData({ ...editTxData, note: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">तारीख (Date)</label>
                    <input 
                      type="datetime-local" 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      value={editTxData.date}
                      onChange={(e) => setEditTxData({ ...editTxData, date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">फोटो जोड़ें</label>
                    <div className="relative">
                      <button 
                        type="button"
                        onClick={() => setShowEditPhotoOptions(!showEditPhotoOptions)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-100 transition-colors"
                      >
                        <Camera size={18} className="text-slate-400" />
                        <span className="text-sm font-medium text-slate-600">जोड़ें</span>
                      </button>

                      <AnimatePresence>
                        {showEditPhotoOptions && (
                          <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-slate-200 rounded-2xl shadow-xl p-2 flex flex-col gap-1 z-10"
                          >
                            <label className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors">
                              <ImageIcon size={20} className="text-indigo-600" />
                              <span className="text-sm font-bold text-slate-700">गैलरी</span>
                              <input 
                                type="file" 
                                accept="image/*" 
                                multiple 
                                className="hidden" 
                                onChange={(e) => {
                                  const files = Array.from(e.target.files || []);
                                  setEditImageFiles([...editImageFiles, ...files]);
                                  setShowEditPhotoOptions(false);
                                }}
                              />
                            </label>
                            <label className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors border-t border-slate-100">
                              <Camera size={20} className="text-indigo-600" />
                              <span className="text-sm font-bold text-slate-700">कैमरा</span>
                              <input 
                                type="file" 
                                accept="image/*" 
                                capture="environment" 
                                className="hidden" 
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) setEditImageFiles([...editImageFiles, file]);
                                  setShowEditPhotoOptions(false);
                                }}
                              />
                            </label>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>

                {/* Existing Photos */}
                {existingImageUrls.length > 0 && (
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">मौजूदा फोटो</label>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {existingImageUrls.map((url, idx) => (
                        <div key={idx} className="relative flex-shrink-0">
                          <img 
                            src={url} 
                            alt="existing" 
                            className="w-16 h-16 rounded-xl object-cover border border-slate-200"
                            referrerPolicy="no-referrer"
                          />
                          <button 
                            type="button"
                            onClick={() => setExistingImageUrls(existingImageUrls.filter((_, i) => i !== idx))}
                            className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 text-white rounded-full flex items-center justify-center shadow-md"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* New Photos */}
                {editImageFiles.length > 0 && (
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">New Photos</label>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {editImageFiles.map((file, idx) => (
                        <div key={idx} className="relative flex-shrink-0">
                          <img 
                            src={URL.createObjectURL(file)} 
                            alt="preview" 
                            className="w-16 h-16 rounded-xl object-cover border border-slate-200"
                          />
                          <button 
                            type="button"
                            onClick={() => setEditImageFiles(editImageFiles.filter((_, i) => i !== idx))}
                            className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 text-white rounded-full flex items-center justify-center shadow-md"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsDeletingTransaction(true)}
                    className="flex-1 py-4 bg-red-600 text-white font-bold hover:bg-red-700 rounded-2xl transition-colors shadow-lg"
                  >
                    हटाएं
                  </button>
                  <button 
                    type="submit"
                    disabled={uploading}
                    className="flex-[2] py-4 bg-emerald-600 text-white font-bold rounded-2xl shadow-lg hover:bg-emerald-700 transition-all disabled:opacity-50"
                  >
                    {uploading ? "सुरक्षित हो रहा है..." : "बदलाव सुरक्षित करें"}
                  </button>
                </div>
              </form>

              {/* Delete Confirmation Overlay */}
              <AnimatePresence>
                {isDeletingTransaction && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-20 bg-white rounded-[2rem] p-6 flex flex-col items-center justify-center text-center"
                  >
                    <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mb-4">
                      <Trash2 size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">ट्रांजैक्शन हटाएं?</h3>
                    <p className="text-slate-500 mb-8">यह क्रिया वापस नहीं ली जा सकती। सप्लायर का बैलेंस अपडेट हो जाएगा।</p>
                    <div className="w-full space-y-3">
                      <button 
                        onClick={handleDeleteTransaction}
                        disabled={uploading}
                        className="w-full py-4 bg-red-600 text-white font-bold rounded-2xl shadow-lg shadow-red-100 hover:bg-red-700 transition-all disabled:opacity-50"
                      >
                        {uploading ? "हटाया जा रहा है..." : "हाँ, हटाएं"}
                      </button>
                      <button 
                        onClick={() => setIsDeletingTransaction(false)}
                        className="w-full py-4 text-slate-600 font-bold hover:bg-slate-50 rounded-2xl transition-colors"
                      >
                        नहीं, रहने दें
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Image Viewer Modal */}
      <AnimatePresence>
        {viewingImages && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative w-full h-full flex flex-col"
            >
              {/* Header */}
              <div className="absolute top-0 left-0 right-0 p-6 flex items-center justify-between z-10 bg-gradient-to-b from-black/50 to-transparent">
                <div className="text-white">
                  <p className="text-sm font-bold opacity-80">Bill Photo</p>
                  <p className="text-xs opacity-60">{currentImageIndex + 1} of {viewingImages.length}</p>
                </div>
                <button 
                  onClick={() => setViewingImages(null)}
                  className="w-10 h-10 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center backdrop-blur-md transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Image Container */}
              <div className="flex-1 flex items-center justify-center p-4">
                <motion.img 
                  key={currentImageIndex}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  src={viewingImages[currentImageIndex]} 
                  alt="bill full" 
                  className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* Navigation Controls */}
              {viewingImages.length > 1 && (
                <>
                  <button 
                    onClick={prevImage}
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center backdrop-blur-md transition-colors"
                  >
                    <ChevronLeft size={32} />
                  </button>
                  <button 
                    onClick={nextImage}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center backdrop-blur-md transition-colors"
                  >
                    <ChevronRight size={32} />
                  </button>

                  {/* Dots Indicator */}
                  <div className="absolute bottom-10 left-0 right-0 flex justify-center gap-2">
                    {viewingImages.map((_, idx) => (
                      <div 
                        key={idx}
                        className={cn(
                          "w-2 h-2 rounded-full transition-all duration-300",
                          idx === currentImageIndex ? "bg-white w-6" : "bg-white/30"
                        )}
                      />
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete All Transactions Confirmation Modal */}
      {isDeletingAllTransactions && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={cn(
            "w-full max-w-sm p-6 rounded-[2.5rem] shadow-2xl animate-in zoom-in-95 duration-200",
            theme === 'dark' ? "bg-slate-900 border border-slate-800" : "bg-white"
          )}>
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 bg-red-50 text-red-600 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                <Trash2 size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-900 dark:text-white">क्या आप पक्का हैं?</h3>
                <p className="text-sm font-bold text-slate-500">
                  इस सप्लायर के सभी {transactions.length} लेन-देन हमेशा के लिए डिलीट हो जाएंगे और बैलेंस ₹0 हो जाएगा।
                </p>
              </div>
              <div className="flex flex-col w-full gap-3 pt-2">
                <button 
                  onClick={handleDeleteAllTransactions}
                  className="w-full py-4 bg-red-600 text-white rounded-2xl font-black shadow-lg shadow-red-100 active:scale-95 transition-all"
                >
                  हाँ, सब डिलीट करें
                </button>
                <button 
                  onClick={() => setIsDeletingAllTransactions(false)}
                  className={cn(
                    "w-full py-4 rounded-2xl font-black active:scale-95 transition-all",
                    theme === 'dark' ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600"
                  )}
                >
                  नहीं, वापस जाएँ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      <AnimatePresence>
        {isReportModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsReportModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className={cn(
                "relative w-full max-w-sm rounded-t-[2rem] sm:rounded-[2rem] p-6 shadow-2xl",
                theme === 'dark' ? "bg-slate-900" : "bg-white"
              )}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-black">रिपोर्ट डाउनलोड करें</h2>
                <button onClick={() => setIsReportModalOpen(false)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">शुरुआत (From)</label>
                    <input 
                      type="date" 
                      value={reportStartDate}
                      onChange={(e) => setReportStartDate(e.target.value)}
                      className={cn(
                        "w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500",
                        theme === 'dark' ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200"
                      )}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">अंत (To)</label>
                    <input 
                      type="date" 
                      value={reportEndDate}
                      onChange={(e) => setReportEndDate(e.target.value)}
                      className={cn(
                        "w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500",
                        theme === 'dark' ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200"
                      )}
                    />
                  </div>
                </div>

                <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800">
                  <p className="text-xs font-bold text-indigo-700 dark:text-indigo-400 flex items-center gap-2">
                    <FileText size={16} />
                    {transactions.filter(tx => {
                      const d = toJSDate(tx.date);
                      const start = new Date(reportStartDate);
                      const end = new Date(reportEndDate);
                      end.setHours(23, 59, 59, 999);
                      return d >= start && d <= end;
                    }).length} ट्रांजैक्शन शामिल होंगे
                  </p>
                </div>

                <div className="space-y-3">
                  <button 
                    onClick={() => generatePDFReport('whatsapp')}
                    disabled={generatingReport}
                    className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-emerald-200 dark:shadow-none flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {generatingReport ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <MessageCircle size={20} />
                    )}
                    WhatsApp पर भेजें
                  </button>

                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => generatePDFReport('download')}
                      disabled={generatingReport}
                      className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
                    >
                      {generatingReport ? (
                        <div className="w-5 h-5 border-2 border-slate-400 border-t-slate-900 dark:border-t-white rounded-full animate-spin" />
                      ) : (
                        <FileDown size={20} />
                      )}
                      डाउनलोड
                    </button>
                    <button 
                      onClick={() => generatePDFReport('share')}
                      disabled={generatingReport}
                      className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-indigo-200 dark:shadow-none flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
                    >
                      {generatingReport ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Share2 size={20} />
                      )}
                      अन्य शेयर
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Layout>
  );
};

const PendingApprovalScreen = () => {
  const { logout } = useAuth();
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-200 space-y-6"
      >
        <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
          <Bell size={40} />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black tracking-tight">Approval Pending</h1>
          <p className="text-slate-500 text-sm">
            Your shopkeeper account is waiting for admin approval. Please check back later.
          </p>
        </div>
        <button 
          onClick={logout}
          className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-lg"
        >
          Logout
        </button>
      </motion.div>
    </div>
  );
};

const RoleSelectionScreen = () => {
  const { selectRole, logout, firebaseAuthUser } = useAuth();
  const [role, setRole] = useState<'shopkeeper' | 'customer'>('shopkeeper');
  const [name, setName] = useState<string>(firebaseAuthUser?.displayName || '');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<{ ok: boolean; text: string } | null>(null);

  const email = firebaseAuthUser?.email || '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);
    if (!name.trim()) {
      setBanner({ ok: false, text: 'Please enter your full name.' });
      return;
    }
    if (!email) {
      setBanner({ ok: false, text: 'Could not read email from Google account. Please try again.' });
      return;
    }
    if (normalizeMobile(mobile).length < 10) {
      setBanner({ ok: false, text: 'Please enter a valid 10-digit mobile number.' });
      return;
    }
    if (!password) {
      setBanner({ ok: false, text: 'Please enter a password.' });
      return;
    }
    if (password.length < 6) {
      setBanner({ ok: false, text: 'Password should be at least 6 characters.' });
      return;
    }
    if (password !== confirmPassword) {
      setBanner({ ok: false, text: 'Passwords do not match.' });
      return;
    }
    if (role !== 'shopkeeper' && role !== 'customer') {
      setBanner({ ok: false, text: 'Please select a role.' });
      return;
    }

    setLoading(true);
    try {
      // Step 1: Link Email/Password provider to the existing Google Firebase Auth account (same UID).
      const currentAuthUser = auth.currentUser || firebaseAuthUser;
      if (!currentAuthUser) {
        setBanner({ ok: false, text: 'Authenticated user not found. Please sign in with Google again.' });
        return;
      }
      try {
        const credential = EmailAuthProvider.credential(email.trim(), password);
        try {
          await linkWithCredential(currentAuthUser, credential);
        } catch (linkErr: any) {
          const code = linkErr?.code as string | undefined;
          if (code === 'auth/provider-already-linked' || code === 'auth/credential-already-in-use') {
            // Provider already linked to this account → end-state already achieved, treat as OK.
          } else if (code === 'auth/email-already-in-use') {
            setBanner({ ok: false, text: 'This email is already registered with a different sign-in method. Please try another password reset or contact support.' });
            return;
          } else if (code === 'auth/weak-password') {
            setBanner({ ok: false, text: 'Password should be at least 6 characters.' });
            return;
          } else if (code === 'auth/requires-recent-login') {
            setBanner({ ok: false, text: 'Please sign in with Google again to set a password.' });
            return;
          } else if (code === 'auth/invalid-email' || code === 'auth/invalid-credential') {
            setBanner({ ok: false, text: 'Invalid email or password. Please try again.' });
            return;
          } else {
            setBanner({ ok: false, text: 'Could not link password to this account. Please try again.' });
            return;
          }
        }
      } catch (outerLinkErr: any) {
        setBanner({ ok: false, text: 'Could not link password. Please try again.' });
        return;
      }

      // Step 2: Now save the Firestore users/{uid} profile with name/mobile/role/status/etc.
      try {
        await selectRole(role, mobile, firebaseAuthUser, { name: name.trim() });
        setBanner({ ok: true, text: 'Profile created successfully.' });
      } catch (firestoreErr: any) {
        setBanner({ ok: false, text: 'Profile could not be saved. Please try again.' });
      }
    } finally {
      setLoading(false);
    }
  };

  const labelCls = 'text-xs font-bold text-slate-500 uppercase tracking-wider';
  const inputCls = 'w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500';
  const disabledInputCls = 'w-full px-4 py-3 bg-slate-100 text-slate-500 border border-slate-200 rounded-xl cursor-not-allowed';
  const primaryBtnCls = loading
    ? 'w-full py-4 bg-slate-700 text-white rounded-2xl font-bold shadow-lg cursor-not-allowed'
    : 'w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-lg';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-200 space-y-8"
      >
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-black tracking-tight">Complete Profile</h1>
          <p className="text-slate-500 text-sm">How will you use KhataBook Pro?</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1 text-left">
            <label className={labelCls}>Full Name</label>
            <input
              required
              type="text"
              className={inputCls}
              placeholder="e.g. KAMLESH KUMAR"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-1 text-left">
            <label className={labelCls}>Email ID</label>
            <input
              type="email"
              className={disabledInputCls}
              placeholder="you@example.com"
              value={email}
              disabled
              readOnly
            />
          </div>

          <div className="space-y-1 text-left">
            <label className={labelCls}>Mobile Number</label>
            <input
              required
              type="tel"
              className={inputCls}
              placeholder="e.g. 9876543210"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-1 text-left">
            <label className={labelCls}>Password</label>
            <input
              required
              type="password"
              className={inputCls}
              placeholder="Min 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-1 text-left">
            <label className={labelCls}>Confirm Password</label>
            <input
              required
              type="password"
              className={inputCls}
              placeholder="Re-enter password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-1 text-left">
            <label className={labelCls}>I will use KhataBook Pro as a</label>
            <div className="flex gap-3">
              <button 
                type="button"
                onClick={() => setRole('shopkeeper')}
                disabled={loading}
                className={cn(
                  "flex-1 py-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2",
                  role === 'shopkeeper' ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-100 text-slate-400"
                )}
              >
                <FileText size={24} />
                <span className="text-xs font-bold uppercase tracking-wider">Shopkeeper</span>
              </button>
              <button 
                type="button"
                onClick={() => setRole('customer')}
                disabled={loading}
                className={cn(
                  "flex-1 py-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2",
                  role === 'customer' ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-100 text-slate-400"
                )}
              >
                <UserIcon size={24} />
                <span className="text-xs font-bold uppercase tracking-wider">Customer</span>
              </button>
            </div>
          </div>

          {banner && (
            <p className={banner.ok ? 'text-sm text-emerald-600 font-medium text-center' : 'text-sm text-red-600 font-medium text-center'}>
              {banner.text}
            </p>
          )}

          <button 
            type="submit"
            disabled={loading}
            className={primaryBtnCls}
          >
            {loading ? 'Please wait…' : 'Get Started'}
          </button>
          
          <button 
            type="button"
            onClick={logout}
            disabled={loading}
            className="w-full text-slate-400 text-sm font-medium hover:text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel & Logout
          </button>
        </form>
      </motion.div>
    </div>
  );
};

interface KhataBookAdminUser {
  uid: string;
  name: string;
  email: string;
  mobile: string;
  shopName: string;
  role: string;
  status: string;
}

const KhataBookAdminAccess = () => {
  const { user, firebaseAuthUser, logout } = useAuth();
  const location = useLocation();
  const adminName = user?.name || firebaseAuthUser?.displayName || firebaseAuthUser?.email || 'Admin';
  const isUsersPage = location.pathname === '/admin/users';
  const isApprovalsPage = location.pathname === '/admin/approvals';
  const [khataBookUsers, setKhataBookUsers] = useState<KhataBookAdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState('');
  const [approvingUserId, setApprovingUserId] = useState<string | null>(null);
  const [approvalError, setApprovalError] = useState('');
  const pendingShopkeepers = khataBookUsers.filter((khataBookUser) =>
    khataBookUser.role === 'shopkeeper' && khataBookUser.status === 'pending'
  );
  const dashboardCounts = {
    total: khataBookUsers.length,
    shopkeepers: khataBookUsers.filter((khataBookUser) => khataBookUser.role === 'shopkeeper').length,
    customers: khataBookUsers.filter((khataBookUser) => khataBookUser.role === 'customer').length,
    pendingApprovals: khataBookUsers.filter((khataBookUser) =>
      khataBookUser.role === 'shopkeeper' && khataBookUser.status === 'pending'
    ).length
  };
  const countsAvailable = !usersLoading && !usersError;
  const dashboardCards = [
    { label: 'Total KhataBook Users', value: dashboardCounts.total, icon: Users, iconClass: 'bg-indigo-50 text-indigo-700' },
    { label: 'Shopkeepers', value: dashboardCounts.shopkeepers, icon: Store, iconClass: 'bg-emerald-50 text-emerald-700' },
    { label: 'Customers', value: dashboardCounts.customers, icon: UserIcon, iconClass: 'bg-sky-50 text-sky-700' },
    { label: 'Pending Approvals', value: dashboardCounts.pendingApprovals, icon: Bell, iconClass: 'bg-amber-50 text-amber-700' }
  ];

  useEffect(() => {
    let isActive = true;
    const loadKhataBookUsers = async () => {
      setUsersLoading(true);
      setUsersError('');
      try {
        const khataBookUsersQuery = query(
          collection(db, 'users'),
          where('platforms', 'array-contains', 'khatabook')
        );
        const snapshot = await getDocs(khataBookUsersQuery);
        if (!isActive) return;

        const rows = snapshot.docs.flatMap((userDoc) => {
          const data = userDoc.data();
          if (!Array.isArray(data.platforms) || !data.platforms.includes('khatabook')) return [];
          return [{
            uid: userDoc.id,
            name: typeof data.name === 'string' && data.name.trim() ? data.name : 'Unnamed user',
            email: typeof data.email === 'string' ? data.email : '',
            mobile: typeof data.mobile === 'string' ? data.mobile : '',
            shopName: typeof data.shopName === 'string' ? data.shopName : '',
            role: typeof data.role === 'string' ? data.role : 'Unknown',
            status: typeof data.status === 'string' ? data.status : 'Unknown'
          }];
        });
        setKhataBookUsers(rows);
      } catch {
        if (isActive) setUsersError('Could not load KhataBook users. Please try again.');
      } finally {
        if (isActive) setUsersLoading(false);
      }
    };

    void loadKhataBookUsers();
    return () => {
      isActive = false;
    };
  }, []);

  const approveShopkeeper = async (uid: string) => {
    setApprovingUserId(uid);
    setApprovalError('');
    try {
      await updateDoc(doc(db, 'users', uid), { status: 'approved' });
      setKhataBookUsers((currentUsers) => currentUsers.map((khataBookUser) =>
        khataBookUser.uid === uid ? { ...khataBookUser, status: 'approved' } : khataBookUser
      ));
    } catch {
      setApprovalError('Could not approve this shopkeeper. Please try again.');
    } finally {
      setApprovingUserId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-4 sm:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <UserIcon size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold">KhataBook Admin</h1>
            <p className="text-sm text-slate-500">{adminName}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={logout}
          className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <LogOut size={16} />
          Logout
        </button>
      </header>
      <nav aria-label="Admin navigation" className="flex gap-2 border-b border-slate-200 bg-white px-4 sm:px-8">
        <Link
          to="/admin"
          className={`border-b-2 px-3 py-3 text-sm font-medium ${!isUsersPage && !isApprovalsPage ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
        >
          Dashboard
        </Link>
        <Link
          to="/admin/users"
          className={`border-b-2 px-3 py-3 text-sm font-medium ${isUsersPage ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
        >
          Users
        </Link>
        <Link
          to="/admin/approvals"
          className={`border-b-2 px-3 py-3 text-sm font-medium ${isApprovalsPage ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
        >
          Pending Approvals
        </Link>
      </nav>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
        {isApprovalsPage ? (
          <section aria-label="Pending shopkeeper approvals">
            <div className="mb-6">
              <h2 className="text-xl font-bold">Pending Approvals</h2>
              <p className="mt-1 text-sm text-slate-500">Shopkeepers waiting for approval</p>
            </div>
            {approvalError && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-white p-4 text-sm text-red-700">{approvalError}</p>}
            {usersLoading ? (
              <p className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading approvals...</p>
            ) : usersError ? (
              <p role="alert" className="rounded-lg border border-red-200 bg-white p-6 text-sm text-red-700">{usersError}</p>
            ) : pendingShopkeepers.length === 0 ? (
              <p className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">No pending shopkeeper approvals.</p>
            ) : (
              <ul className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                {pendingShopkeepers.map((shopkeeper) => (
                  <li key={shopkeeper.uid} className="flex flex-col gap-4 border-b border-slate-100 p-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-slate-900">{shopkeeper.name}</h3>
                      <div className="mt-2 flex flex-col gap-1 text-sm text-slate-500 sm:flex-row sm:gap-4">
                        <span>{shopkeeper.mobile || 'Mobile not provided'}</span>
                        <span>{shopkeeper.shopName || 'Shop name not provided'}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 self-start sm:self-auto">
                      <span className="rounded-md bg-amber-50 px-2.5 py-1 text-xs font-medium capitalize text-amber-800">{shopkeeper.status}</span>
                      <button
                        type="button"
                        onClick={() => void approveShopkeeper(shopkeeper.uid)}
                        disabled={approvingUserId !== null}
                        className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60"
                      >
                        {approvingUserId === shopkeeper.uid ? 'Approving...' : 'Approve'}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : isUsersPage ? (
          <section aria-label="KhataBook users">
            <div className="mb-6">
              <h2 className="text-xl font-bold">KhataBook Users</h2>
              <p className="mt-1 text-sm text-slate-500">Users registered on the KhataBook platform</p>
            </div>
            {usersLoading ? (
              <p className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading users...</p>
            ) : usersError ? (
              <p role="alert" className="rounded-lg border border-red-200 bg-white p-6 text-sm text-red-700">{usersError}</p>
            ) : khataBookUsers.length === 0 ? (
              <p className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">No KhataBook users found.</p>
            ) : (
              <ul className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                {khataBookUsers.map((khataBookUser) => {
                  const roleLabel = khataBookUser.role === 'shopkeeper'
                    ? 'Shopkeeper'
                    : khataBookUser.role === 'customer'
                      ? 'Customer'
                      : khataBookUser.role;

                  return (
                    <li key={khataBookUser.uid} className="flex flex-col gap-3 border-b border-slate-100 p-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-slate-900">{khataBookUser.name}</h3>
                        <p className="mt-1 truncate text-sm text-slate-500">{khataBookUser.email || khataBookUser.mobile || khataBookUser.uid}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 self-start sm:self-auto">
                        <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{roleLabel}</span>
                        <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium capitalize text-slate-700">{khataBookUser.status}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ) : (
          <>
            <div className="mb-6">
              <h2 className="text-xl font-bold">Dashboard</h2>
            </div>
            {usersError && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-white p-4 text-sm text-red-700">{usersError}</p>}
            <section aria-label="KhataBook overview" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {dashboardCards.map(({ label, value, icon: Icon, iconClass }) => (
                <article key={label} className="flex min-h-36 items-start justify-between rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex min-h-24 flex-col justify-between gap-5">
                    <h3 className="text-sm font-medium text-slate-600">{label}</h3>
                    <p className="text-3xl font-bold text-slate-900">{countsAvailable ? value : '--'}</p>
                  </div>
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconClass}`}>
                    <Icon size={20} />
                  </div>
                </article>
              ))}
            </section>
          </>
        )}
      </main>
    </div>
  );
};

const AppContent = () => {
  const { user, isKhatabookAdmin, loading, needsRole } = useAuth();
  const location = useLocation();

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (!user && !needsRole) return <LoginScreen />;
  if (needsRole) return <RoleSelectionScreen />;
  if (location.pathname === '/admin' || location.pathname.startsWith('/admin/')) {
    if (!isKhatabookAdmin) return <Navigate to="/" replace />;
    if (location.pathname === '/admin' || location.pathname === '/admin/users' || location.pathname === '/admin/approvals') return <KhataBookAdminAccess />;
    return <Navigate to="/admin" replace />;
  }
  if (user?.role === 'shopkeeper' && user?.status === 'pending') return <PendingApprovalScreen />;

  return (
    <Routes>
      <Route path="/" element={user?.role === 'shopkeeper' ? <Dashboard /> : <CustomerDashboard />} />
      <Route path="/customer/:id" element={user?.role === 'shopkeeper' ? <CustomerDetail /> : <Navigate to="/" />} />
      <Route path="/supplier/:id" element={user?.role === 'shopkeeper' ? <SupplierDetail /> : <Navigate to="/" />} />
      <Route path="/credit-check" element={user?.role === 'shopkeeper' ? <CreditCheckScreen /> : <Navigate to="/" />} />
      <Route path="/settings" element={<SettingsScreen />} />
      <Route path="/subscription" element={<SubscriptionScreenWrapper />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <Router>
          <AppContent />
        </Router>
      </ThemeProvider>
    </AuthProvider>
  );
}
