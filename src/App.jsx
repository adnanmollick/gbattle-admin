import { useState } from "react";
import { AdminAuthProvider, useAdminAuth } from "./context/AdminAuthContext";
import AdminLoginPage from "./pages/AdminLoginPage";
import DashboardTab from "./pages/tabs/DashboardTab";
import MatchesTab from "./pages/tabs/MatchesTab";
import DepositsTab from "./pages/tabs/DepositsTab";
import WithdrawsTab from "./pages/tabs/WithdrawsTab";
import UsersTab from "./pages/tabs/UsersTab";
import ResultsTab from "./pages/tabs/ResultsTab";
import SettingsTab from "./pages/tabs/SettingsTab";
import AdminManageTab from "./pages/tabs/AdminManageTab";
import AdminWalletTab from "./pages/tabs/AdminWalletTab";
import BkashMonitorTab from "./pages/tabs/BkashMonitorTab";
import ContentTab from "./pages/tabs/ContentTab";
import PointTableTab from "./pages/tabs/PointTableTab";
import { C } from "./utils/ui";

const TABS = [
  { id:"dashboard", icon:"📊", label:"ড্যাশবোর্ড" },
  { id:"matches", icon:"🎮", label:"ম্যাচ" },
  { id:"deposits", icon:"💚", label:"ডিপোজিট" },
  { id:"withdraws", icon:"🔴", label:"উত্তোলন" },
  { id:"users", icon:"👥", label:"ইউজার" },
  { id:"results", icon:"🏆", label:"ফলাফল" },
  { id:"points", icon:"📊", label:"পয়েন্ট টেবিল" },
  { id:"bkash", icon:"📡", label:"bKash Monitor" },
  { id:"content", icon:"🎨", label:"কন্টেন্ট" },
  { id:"settings", icon:"⚙️", label:"সেটিংস" },
];

function AdminInner() {
  const { admin, adminData, loading, accessDenied, isSuperAdmin, logout } = useAdminAuth();
  const [tab, setTab] = useState("dashboard");
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", background:C.bg }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontFamily:"Orbitron,sans-serif", fontSize:20, fontWeight:900, background:C.grad, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", marginBottom:16 }}>G-BATTLE ADMIN</div>
        <div style={{ width:36, height:36, border:`3px solid ${C.primary}44`, borderTop:`3px solid ${C.primary}`, borderRadius:"50%", animation:"spin 0.8s linear infinite", margin:"0 auto" }}></div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (accessDenied) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", background:C.bg, flexDirection:"column", gap:16, padding:24 }}>
      <div style={{ fontSize:60 }}>🚫</div>
      <div style={{ fontFamily:"Orbitron,sans-serif", fontSize:18, fontWeight:700, color:"#f87171" }}>ACCESS DENIED</div>
      <button onClick={()=>window.location.reload()} style={{ background:"rgba(248,113,113,0.15)", border:"1px solid rgba(248,113,113,0.3)", borderRadius:12, padding:"10px 24px", color:"#f87171", fontFamily:"Orbitron,sans-serif", fontSize:12, cursor:"pointer" }}>← ফিরে যান</button>
    </div>
  );

  if (!admin) return <AdminLoginPage />;

  // All admins see their commission wallet; super admin also gets Admin Management
  const visibleTabs = isSuperAdmin
    ? [...TABS, { id:"mywallet", icon:"💰", label:"আমার কমিশন" }, { id:"adminmanage", icon:"👑", label:"এডমিন ম্যানেজ" }]
    : [...TABS, { id:"mywallet", icon:"💰", label:"আমার কমিশন" }];

  const current = visibleTabs.find(t=>t.id===tab);
  const selectTab = (id) => { setTab(id); setDrawerOpen(false); };

  return (
    <div style={{ background:C.bgGrad, minHeight:"100vh", color:C.text, fontFamily:"'Hind Siliguri',Inter,sans-serif", maxWidth:1100, margin:"0 auto", position:"relative" }}>
      {/* TOPBAR */}
      <div style={{ background:"rgba(18,14,28,0.92)", backdropFilter:"blur(20px)", borderBottom:`1px solid ${C.border}`, padding:"13px 18px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:50 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          {/* HAMBURGER */}
          <button onClick={()=>setDrawerOpen(true)} style={{ background:C.surface2, border:`1px solid ${C.border}`, borderRadius:11, width:40, height:40, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:4, cursor:"pointer" }}>
            <span style={{ width:18, height:2, background:C.primary, borderRadius:2, display:"block" }}></span>
            <span style={{ width:18, height:2, background:C.primary, borderRadius:2, display:"block" }}></span>
            <span style={{ width:18, height:2, background:C.primary, borderRadius:2, display:"block" }}></span>
          </button>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:34, height:34, borderRadius:10, background:C.grad, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, boxShadow:`0 4px 14px ${C.primary}66` }}>⚡</div>
            <div>
              <div style={{ fontFamily:"Orbitron,sans-serif", fontWeight:900, fontSize:14, color:C.text }}>G-BATTLE</div>
              <div style={{ fontSize:8, color:C.textFaint, letterSpacing:1.5 }}>ADMIN PANEL</div>
            </div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ background:C.surface2, border:`1px solid ${C.border}`, borderRadius:20, padding:"6px 12px", fontSize:11, fontFamily:"Orbitron,sans-serif", color:C.primary, display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ width:7, height:7, borderRadius:"50%", background:C.green, boxShadow:`0 0 8px ${C.green}` }}></span>
            {adminData?.name||"ADMIN"}
          </div>
        </div>
      </div>

      {/* SIDE DRAWER */}
      {drawerOpen && (
        <>
          <div onClick={()=>setDrawerOpen(false)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", backdropFilter:"blur(4px)", zIndex:100, animation:"fadeIn 0.2s ease" }}></div>
          <div style={{ position:"fixed", top:0, left:0, bottom:0, width:270, background:C.surface, borderRight:`1px solid ${C.border}`, zIndex:101, animation:"slideIn 0.25s ease", display:"flex", flexDirection:"column", boxShadow:"4px 0 30px rgba(0,0,0,0.5)" }}>
            {/* DRAWER HEADER */}
            <div style={{ padding:"22px 20px", borderBottom:`1px solid ${C.border}`, background:C.grad }}>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ width:44, height:44, borderRadius:12, background:"rgba(255,255,255,0.2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>⚡</div>
                <div>
                  <div style={{ fontFamily:"Orbitron,sans-serif", fontWeight:900, fontSize:16, color:"#fff" }}>G-BATTLE</div>
                  <div style={{ fontSize:10, color:"rgba(255,255,255,0.7)" }}>{adminData?.name||"ADMIN"}</div>
                </div>
              </div>
            </div>

            {/* MENU ITEMS */}
            <div style={{ flex:1, overflowY:"auto", padding:12 }}>
              {visibleTabs.map(t=>(
                <button key={t.id} onClick={()=>selectTab(t.id)} style={{ display:"flex", alignItems:"center", gap:12, width:"100%", padding:"13px 16px", background:tab===t.id?C.grad:"transparent", border:"none", borderRadius:12, color:tab===t.id?"#fff":C.textDim, fontFamily:"'Hind Siliguri',sans-serif", fontSize:14, fontWeight:600, cursor:"pointer", marginBottom:4, transition:"all 0.15s", boxShadow:tab===t.id?`0 4px 14px ${C.primary}55`:"none" }}>
                  <span style={{ fontSize:18 }}>{t.icon}</span> {t.label}
                  {tab===t.id && <span style={{ marginLeft:"auto" }}>›</span>}
                </button>
              ))}
            </div>

            {/* LOGOUT */}
            <div style={{ padding:12, borderTop:`1px solid ${C.border}` }}>
              <button onClick={logout} style={{ display:"flex", alignItems:"center", gap:12, width:"100%", padding:"13px 16px", background:"rgba(248,113,113,0.1)", border:"1px solid rgba(248,113,113,0.25)", borderRadius:12, color:"#f87171", fontFamily:"'Hind Siliguri',sans-serif", fontSize:14, fontWeight:600, cursor:"pointer" }}>
                🚪 লগআউট
              </button>
            </div>
          </div>
        </>
      )}

      {/* PAGE TITLE */}
      <div style={{ padding:"18px 20px 0" }}>
        <div style={{ fontFamily:"Orbitron,sans-serif", fontSize:18, fontWeight:800, color:C.text, display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:22 }}>{current?.icon}</span> {current?.label}
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ padding:"16px 20px 50px" }}>
        {tab==="dashboard" && <DashboardTab setTab={setTab} />}
        {tab==="matches" && <MatchesTab />}
        {tab==="deposits" && <DepositsTab />}
        {tab==="withdraws" && <WithdrawsTab />}
        {tab==="users" && <UsersTab />}
        {tab==="results" && <ResultsTab />}
        {tab==="points" && <PointTableTab />}
        {tab==="bkash" && <BkashMonitorTab />}
        {tab==="content" && <ContentTab />}
        {tab==="settings" && <SettingsTab />}
        {tab==="mywallet" && <AdminWalletTab />}
        {tab==="adminmanage" && isSuperAdmin && <AdminManageTab />}
      </div>

      <style>{`
        @keyframes slideIn{from{transform:translateX(-100%)}to{transform:translateX(0)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
      `}</style>
    </div>
  );
}

export default function App() {
  return <AdminAuthProvider><AdminInner /></AdminAuthProvider>;
}
