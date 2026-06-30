import { useState } from "react";
import { useAdminAuth } from "../context/AdminAuthContext";

export default function AdminLoginPage() {
  const { loginAdmin } = useAdminAuth();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const handleLogin = async () => {
    setErr(""); setLoading(true);
    try { await loginAdmin(email, pass); }
    catch(e) {
      if (e.code==="auth/wrong-password"||e.code==="auth/user-not-found") setErr("ইমেইল বা পাসওয়ার্ড ভুল");
      else setErr("কিছু সমস্যা হয়েছে");
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight:"100vh", background:"#0a0118", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24, position:"relative", overflow:"hidden" }}>
      <div style={{ position:"absolute", width:400, height:400, borderRadius:"50%", background:"radial-gradient(circle,#dc2626,transparent)", top:-100, left:-100, opacity:.25, filter:"blur(80px)" }}></div>
      <div style={{ position:"absolute", width:300, height:300, borderRadius:"50%", background:"radial-gradient(circle,#7c3aed,transparent)", bottom:-80, right:-80, opacity:.2, filter:"blur(70px)" }}></div>

      <div style={{ fontSize:36, marginBottom:12, position:"relative", zIndex:1 }}>🔐</div>
      <div style={{ fontFamily:"Orbitron,sans-serif", fontSize:22, fontWeight:900, background:"linear-gradient(90deg,#f87171,#fbbf24)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", marginBottom:4, position:"relative", zIndex:1 }}>ADMIN PANEL</div>
      <div style={{ color:"rgba(255,255,255,0.35)", fontSize:12, fontFamily:"Orbitron,sans-serif", letterSpacing:2, marginBottom:32, position:"relative", zIndex:1 }}>G-BATTLE CONTROL</div>

      <div style={{ background:"rgba(255,255,255,0.06)", backdropFilter:"blur(24px)", border:"1.5px solid rgba(248,113,113,0.2)", borderRadius:20, padding:28, width:"100%", maxWidth:360, position:"relative", zIndex:1 }}>
        {err && <div style={{ background:"rgba(248,113,113,0.15)", border:"1px solid rgba(248,113,113,0.3)", color:"#f87171", borderRadius:10, padding:"10px 14px", fontSize:12, marginBottom:14, textAlign:"center" }}>{err}</div>}

        <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Admin ইমেইল" type="email"
          style={{ width:"100%", background:"rgba(255,255,255,0.07)", border:"1.5px solid rgba(255,255,255,0.1)", borderRadius:12, padding:"12px 16px", color:"#fff", fontSize:14, outline:"none", marginBottom:12, fontFamily:"Inter,sans-serif", boxSizing:"border-box" }} />
        <input value={pass} onChange={e=>setPass(e.target.value)} placeholder="পাসওয়ার্ড" type="password"
          style={{ width:"100%", background:"rgba(255,255,255,0.07)", border:"1.5px solid rgba(255,255,255,0.1)", borderRadius:12, padding:"12px 16px", color:"#fff", fontSize:14, outline:"none", marginBottom:20, fontFamily:"Inter,sans-serif", boxSizing:"border-box" }} />

        <button onClick={handleLogin} disabled={loading}
          style={{ width:"100%", background:"linear-gradient(135deg,#dc2626,#f87171)", color:"#fff", border:"none", borderRadius:12, padding:"13px 0", fontFamily:"Orbitron,sans-serif", fontWeight:700, fontSize:12, cursor:"pointer", boxShadow:"0 6px 20px rgba(220,38,38,0.4)", opacity:loading?0.7:1 }}>
          {loading?"লগইন হচ্ছে...":"🔐 Admin লগইন"}
        </button>
      </div>
    </div>
  );
}
