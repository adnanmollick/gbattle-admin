import { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../firebase/config";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

const AdminAuthContext = createContext();

export function AdminAuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [adminData, setAdminData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        const snap = await getDoc(doc(db, "users", u.uid));
        if (snap.exists() && snap.data().role === "admin") {
          setAdmin(u);
          setAdminData(snap.data());
          setAccessDenied(false);
        } else {
          // Not admin — kick out
          setAccessDenied(true);
          setAdmin(null);
          await signOut(auth);
        }
      } else {
        setAdmin(null);
        setAdminData(null);
        setAccessDenied(false);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const loginAdmin = (email, pass) => signInWithEmailAndPassword(auth, email, pass);
  const logout = () => signOut(auth);

  return (
    <AdminAuthContext.Provider value={{ admin, adminData, loading, accessDenied, loginAdmin, logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export const useAdminAuth = () => useContext(AdminAuthContext);
