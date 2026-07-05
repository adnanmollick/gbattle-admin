import { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../firebase/config";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

const AdminAuthContext = createContext();

// Super Admin — full access, controls all other admins
const SUPER_ADMIN_EMAIL = "topupdn68@gmail.com";

export function AdminAuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [adminData, setAdminData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        const snap = await getDoc(doc(db, "users", u.uid));
        const isSuper = u.email?.toLowerCase() === SUPER_ADMIN_EMAIL;
        if (isSuper || (snap.exists() && snap.data().role === "admin")) {
          setAdmin(u);
          setAdminData(snap.exists() ? { ...snap.data(), uid: u.uid } : { uid:u.uid, email:u.email, role:"admin" });
          setIsSuperAdmin(isSuper);
          setAccessDenied(false);
        } else {
          // Not admin — kick out
          setAccessDenied(true);
          setAdmin(null);
          setIsSuperAdmin(false);
          await signOut(auth);
        }
      } else {
        setAdmin(null);
        setAdminData(null);
        setIsSuperAdmin(false);
        setAccessDenied(false);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const loginAdmin = (email, pass) => signInWithEmailAndPassword(auth, email, pass);
  const logout = () => signOut(auth);

  return (
    <AdminAuthContext.Provider value={{ admin, adminData, loading, accessDenied, isSuperAdmin, loginAdmin, logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export const useAdminAuth = () => useContext(AdminAuthContext);
