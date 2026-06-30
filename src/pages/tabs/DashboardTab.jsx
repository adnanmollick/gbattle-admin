import { useState, useEffect } from "react";
import { db } from "../../firebase/config";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { C, card, fmt } from "../../utils/ui";

export default function DashboardTab({ setTab }) {
  const [stats, setStats] = useState({ users:0, matches:0, liveMatches:0, pendingDep:0, pendingWd:0, totalDep:0, totalWd:0 });

  useEffect(() => {
    const unsubs = [];
    unsubs.push(onSnapshot(collection(db,"users"), s => setStats(p=>({...p, users:s.size}))));
    unsubs.push(onSnapshot(collection(db,"matches"), s => {
      setStats(p=>({...p, matches:s.size, liveMatches:s.docs.filter(d=>d.data().status==="live").length}));
    }));
    unsubs.push(onSnapshot(collection(db,"transactions"), s => {
      const txs = s.docs.map(d=>d.data());
      const deps = txs.filter(t=>t.type==="deposit");
      const wds = txs.filter(t=>t.type==="withdraw");
      setStats(p=>({
        ...p,
        pendingDep: deps.filter(t=>t.status==="pending").length,
        pendingWd: wds.filter(t=>t.status==="pending").length,
        totalDep: deps.filter(t=>t.status==="approved"||t.status==="completed").reduce((a,t)=>a+Number(t.amount||0),0),
        totalWd: wds.filter(t=>t.status==="approved"||t.status==="completed").reduce((a,t)=>a+Number(t.amount||0),0),
      }));
    }));
    return () => unsubs.forEach(u=>u());
  }, []);

  const net = stats.totalDep - stats.totalWd;

  const tiles = [
    { label:"মোট ইউজার", value:stats.users, icon:"👥", color:C.blue, tab:"users" },
    { label:"মোট ম্যাচ", value:stats.matches, icon:"🎮", color:C.primary, tab:"matches" },
    { label:"Live ম্যাচ", value:stats.liveMatches, icon:"🔴", color:C.red, tab:"matches" },
    { label:"পেন্ডিং ডিপোজিট", value:stats.pendingDep, icon:"⏳", color:C.amber, tab:"deposits" },
    { label:"পেন্ডিং উত্তোলন", value:stats.pendingWd, icon:"📤", color:C.green, tab:"withdraws" },
    { label:"নেট ব্যালেন্স", value:`৳${fmt(net)}`, icon:"💰", color:C.green, tab:null },
  ];

  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
        {tiles.map(t => (
          <div key={t.label} onClick={()=>t.tab&&setTab(t.tab)} style={{ ...card, cursor:t.tab?"pointer":"default", position:"relative", overflow:"hidden", transition:"all 0.15s" }}>
            <div style={{ position:"absolute", top:-8, right:-4, fontSize:46, opacity:0.08 }}>{t.icon}</div>
            <div style={{ fontSize:22, marginBottom:8 }}>{t.icon}</div>
            <div style={{ fontFamily:"Orbitron,sans-serif", fontSize:22, fontWeight:800, color:t.color, lineHeight:1, wordBreak:"break-all" }}>{t.value}</div>
            <div style={{ fontSize:11, color:C.textDim, marginTop:6 }}>{t.label}</div>
            {t.tab && <div style={{ fontSize:10, color:C.textFaint, marginTop:6 }}>ক্লিক করুন →</div>}
          </div>
        ))}
      </div>

      {/* FINANCIAL SUMMARY */}
      <div style={{ ...card, marginBottom:16 }}>
        <div style={{ fontFamily:"Orbitron,sans-serif", fontSize:13, fontWeight:700, color:C.text, marginBottom:14 }}>💵 আর্থিক সারসংক্ষেপ</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
          {[["মোট জমা",stats.totalDep,C.green],["মোট উত্তোলন",stats.totalWd,C.red],["নেট",net,C.primary]].map(([l,v,c])=>(
            <div key={l} style={{ background:C.surface2, borderRadius:12, padding:"14px 8px", textAlign:"center" }}>
              <div style={{ fontFamily:"Orbitron,sans-serif", fontSize:15, fontWeight:800, color:c, wordBreak:"break-all" }}>৳{fmt(v)}</div>
              <div style={{ fontSize:9, color:C.textFaint, marginTop:4 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <div style={{ fontFamily:"Orbitron,sans-serif", fontSize:12, fontWeight:700, color:C.textDim, marginBottom:12 }}>⚡ দ্রুত অ্যাকশন</div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        {[["➕ নতুন ম্যাচ","matches",C.primary],["💚 ডিপোজিট","deposits",C.green],["📡 bKash Monitor","bkash",C.blue],["🏆 ফলাফল দিন","results",C.amber]].map(([l,tab,c])=>(
          <button key={l} onClick={()=>setTab(tab)} style={{ ...card, cursor:"pointer", border:`1px solid ${c}33`, color:c, fontFamily:"Orbitron,sans-serif", fontWeight:700, fontSize:12, textAlign:"center", padding:"16px 8px" }}>{l}</button>
        ))}
      </div>
    </div>
  );
}
