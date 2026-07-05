import { useState, useEffect } from "react";
import { db } from "../../firebase/config";
import { collection, query, where, onSnapshot, updateDoc, doc, getDoc } from "firebase/firestore";
import { C, card, btn, badge, fmt } from "../../utils/ui";
import { useAdminAuth } from "../../context/AdminAuthContext";

export default function DepositsTab() {
  const { adminData, isSuperAdmin } = useAdminAuth();
  const [deps, setDeps] = useState([]);
  const [filter, setFilter] = useState("pending");
  const [msg, setMsg] = useState("");

  // Manual add permission: super admin always, else check flag
  const canManualAdd = isSuperAdmin || (adminData?.manualAddEnabled !== false);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db,"transactions"), where("type","==","deposit")),
      snap => {
        const all = snap.docs.map(d=>({id:d.id,...d.data()}));
        all.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
        setDeps(all);
      }
    );
    return unsub;
  }, []);

  const approve = async (dep) => {
    if (!canManualAdd) { setMsg("❌ আপনার ম্যানুয়াল টাকা অ্যাড করার অনুমতি নেই"); setTimeout(()=>setMsg(""),3000); return; }
    try {
      // 1. Update transaction status + track who approved
      await updateDoc(doc(db,"transactions",dep.id), {
        status:"approved", approvedAt:new Date().toISOString(),
        approvedBy:adminData?.uid||null, approvedByName:adminData?.name||"",
      });
      // 2. Add to wallet — getDoc first to get current balance
      const uRef = doc(db,"users",dep.uid);
      const uSnap = await getDoc(uRef);
      if (uSnap.exists()) {
        const cur = Number(uSnap.data().wallet)||0;
        const newWallet = Math.max(0, cur + Number(dep.amount));
        await updateDoc(uRef, { wallet: newWallet });
      }
      setMsg(`✅ ৳${fmt(dep.amount)} অনুমোদন ও ওয়ালেটে যোগ হয়েছে`);
      setTimeout(()=>setMsg(""),3000);
    } catch(e) { setMsg("সমস্যা: "+e.message); }
  };

  const reject = async (dep) => {
    try {
      await updateDoc(doc(db,"transactions",dep.id), { status:"rejected", rejectedAt:new Date().toISOString() });
      setMsg("❌ প্রত্যাখ্যান করা হয়েছে");
      setTimeout(()=>setMsg(""),3000);
    } catch(e) { setMsg("সমস্যা: "+e.message); }
  };

  const pending = deps.filter(d=>d.status==="pending");
  const done = deps.filter(d=>d.status!=="pending");
  const list = filter==="pending"?pending:done;

  return (
    <div>
      {msg && <div style={{ background:msg.startsWith("✅")?C.greenBg:C.redBg, color:msg.startsWith("✅")?C.green:C.red, borderRadius:10, padding:"11px 14px", fontSize:13, marginBottom:14, textAlign:"center" }}>{msg}</div>}

      {!canManualAdd && <div style={{ background:"rgba(248,113,113,0.1)", border:"1px solid rgba(248,113,113,0.3)", borderRadius:10, padding:"11px 14px", fontSize:12, color:"#f87171", marginBottom:14, textAlign:"center" }}>🔒 আপনার ম্যানুয়াল টাকা অ্যাড করার অনুমতি নেই। সুপার এডমিন এটি বন্ধ করেছেন।</div>}

      <div style={{ display:"flex", gap:8, marginBottom:16 }}>
        <button onClick={()=>setFilter("pending")} style={{ ...btn(filter==="pending"?"primary":"ghost"), flex:1 }}>⏳ পেন্ডিং ({pending.length})</button>
        <button onClick={()=>setFilter("done")} style={{ ...btn(filter==="done"?"primary":"ghost"), flex:1 }}>✅ সম্পন্ন ({done.length})</button>
      </div>

      {list.length===0 ? (
        <div style={{ ...card, textAlign:"center", padding:40, color:C.textFaint, fontSize:13 }}>কোনো {filter==="pending"?"পেন্ডিং":"সম্পন্ন"} ডিপোজিট নেই</div>
      ) : list.map(dep=>(
        <div key={dep.id} style={{ ...card, marginBottom:12 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                <span style={{ fontFamily:"Orbitron,sans-serif", fontSize:18, fontWeight:800, color:C.green }}>৳{fmt(dep.amount)}</span>
                {dep.autoVerified && <span style={badge(C.blue,C.blueBg)}>AUTO</span>}
                <span style={badge(
                  dep.status==="approved"?C.green:dep.status==="rejected"?C.red:C.amber,
                  dep.status==="approved"?C.greenBg:dep.status==="rejected"?C.redBg:C.amberBg
                )}>{dep.status==="approved"?"অনুমোদিত":dep.status==="rejected"?"বাতিল":"পেন্ডিং"}</span>
              </div>
              <div style={{ fontSize:13, color:C.text, fontWeight:600 }}>{dep.userName||"Player"}</div>
              <div style={{ fontSize:11, color:C.textDim }}>📱 {dep.phone||"—"}</div>
            </div>
            <div style={{ fontSize:10, color:C.textFaint }}>{new Date(dep.createdAt).toLocaleString("bn-BD")}</div>
          </div>

          <div style={{ background:C.surface2, borderRadius:8, padding:"8px 12px", marginBottom:dep.status==="pending"?12:0 }}>
            <span style={{ fontSize:11, color:C.textFaint }}>TrxID: </span>
            <span style={{ fontFamily:"Orbitron,sans-serif", fontSize:13, fontWeight:700, color:C.primary }}>{dep.txID||"—"}</span>
          </div>

          {dep.status==="pending" && (
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={()=>reject(dep)} style={{ ...btn("red"), flex:1 }}>❌ বাতিল</button>
              <button onClick={()=>approve(dep)} style={{ ...btn("green"), flex:2 }}>✅ অনুমোদন দিন</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
