import { useState, useEffect } from "react";
import { db } from "../../firebase/config";
import { collection, query, where, onSnapshot, updateDoc, doc, getDoc } from "firebase/firestore";
import { C, card, btn, badge, fmt } from "../../utils/ui";

export default function WithdrawsTab() {
  const [wds, setWds] = useState([]);
  const [filter, setFilter] = useState("pending");
  const [copiedId, setCopiedId] = useState(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    // Load both user withdraws and admin commission withdraws
    const unsub1 = onSnapshot(
      query(collection(db,"transactions"), where("type","==","withdraw")),
      snap => {
        const userWds = snap.docs.map(d=>({id:d.id,...d.data()}));
        setWds(prev => {
          const adminWds = prev.filter(w => w.type === "admin_withdraw");
          const all = [...userWds, ...adminWds];
          all.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
          return all;
        });
      }
    );
    const unsub2 = onSnapshot(
      query(collection(db,"transactions"), where("type","==","admin_withdraw")),
      snap => {
        const adminWds = snap.docs.map(d=>({id:d.id,...d.data()}));
        setWds(prev => {
          const userWds = prev.filter(w => w.type === "withdraw");
          const all = [...userWds, ...adminWds];
          all.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
          return all;
        });
      }
    );
    return () => { unsub1(); unsub2(); };
  }, []);

  const approve = async (wd) => {
    try {
      const uRef = doc(db,"users",wd.uid);
      const uSnap = await getDoc(uRef);
      if (uSnap.exists()) {
        const cur = uSnap.data().wallet || 0;
        if (cur < Number(wd.amount)) { setMsg("⚠️ ইউজারের পর্যাপ্ত ব্যালেন্স নেই"); setTimeout(()=>setMsg(""),3000); return; }
        await updateDoc(uRef, { wallet: Math.max(0, cur - Number(wd.amount)) });
      }
      await updateDoc(doc(db,"transactions",wd.id), { status:"approved", approvedAt:new Date().toISOString() });
      setMsg(`✅ ৳${fmt(wd.amount)} উত্তোলন অনুমোদন হয়েছে`);
      setTimeout(()=>setMsg(""), 3000);
    } catch(e) { setMsg("সমস্যা: " + e.message); }
  };

  const reject = async (wd) => {
    try {
      await updateDoc(doc(db,"transactions",wd.id), { status:"rejected", rejectedAt:new Date().toISOString() });
      setMsg("❌ প্রত্যাখ্যান করা হয়েছে");
      setTimeout(()=>setMsg(""), 3000);
    } catch(e) { setMsg("সমস্যা: " + e.message); }
  };

  const pending = wds.filter(d => d.status === "pending");
  const done = wds.filter(d => d.status !== "pending");
  const list = filter === "pending" ? pending : done;

  return (
    <div>
      {msg && <div style={{ background: msg.startsWith("✅") ? C.greenBg : C.redBg, color: msg.startsWith("✅") ? C.green : C.red, borderRadius: 10, padding: "11px 14px", fontSize: 13, marginBottom: 14, textAlign: "center" }}>{msg}</div>}

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={() => setFilter("pending")} style={{ ...btn(filter === "pending" ? "primary" : "ghost"), flex: 1 }}>⏳ পেন্ডিং ({pending.length})</button>
        <button onClick={() => setFilter("done")} style={{ ...btn(filter === "done" ? "primary" : "ghost"), flex: 1 }}>✅ সম্পন্ন ({done.length})</button>
      </div>

      {list.length === 0 ? (
        <div style={{ ...card, textAlign: "center", padding: 40, color: C.textFaint, fontSize: 13 }}>
          {filter === "pending" ? "কোনো পেন্ডিং উত্তোলন নেই" : "কোনো সম্পন্ন উত্তোলন নেই"}
        </div>
      ) : list.map(wd => (
        <div key={wd.id} style={{ ...card, marginBottom: 12, border: wd.type==="admin_withdraw"?"1px solid rgba(167,139,250,0.3)":undefined }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontFamily: "Orbitron,sans-serif", fontSize: 18, fontWeight: 800, color: C.red }}>৳{fmt(wd.amount)}</span>
                <span style={badge(
                  wd.status === "approved" ? C.green : wd.status === "rejected" ? C.red : C.amber,
                  wd.status === "approved" ? C.greenBg : wd.status === "rejected" ? C.redBg : C.amberBg
                )}>
                  {wd.status === "approved" ? "অনুমোদিত" : wd.status === "rejected" ? "বাতিল" : "পেন্ডিং"}
                </span>
                {wd.type==="admin_withdraw" && <span style={badge(C.primary, "rgba(124,58,237,0.15)")}>👑 এডমিন কমিশন</span>}
              </div>
              <div style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>{wd.userName || "Player"}{wd.method?` · ${wd.method}`:""}</div>
            </div>
            <div style={{ fontSize: 10, color: C.textFaint }}>{new Date(wd.createdAt).toLocaleString("bn-BD")}</div>
          </div>

          {/* Admin withdraw: show charge breakdown + net to send */}
          {wd.type==="admin_withdraw" && wd.net != null && (
            <div style={{ background: "rgba(52,211,153,0.08)", border:"1px solid rgba(52,211,153,0.2)", borderRadius: 8, padding: "10px 12px", marginBottom: 10 }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:C.textDim, marginBottom:4 }}><span>উত্তোলন</span><span>৳{fmt(wd.amount)}</span></div>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#fb923c", marginBottom:4 }}><span>সেন্ড মানি চার্জ</span><span>− ৳{wd.charge}</span></div>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, color:C.green, fontWeight:700, paddingTop:6, borderTop:`1px solid ${C.border}` }}><span>যত টাকা পাঠাবেন</span><span style={{fontFamily:"Orbitron,sans-serif"}}>৳{fmt(wd.net)}</span></div>
            </div>
          )}

          <div style={{ background: C.surface2, borderRadius: 8, padding: "8px 12px", marginBottom: wd.status === "pending" ? 12 : 0, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div>
              <span style={{ fontSize: 11, color: C.textFaint }}>{wd.method||"bKash"} নম্বর: </span>
              <span style={{ fontFamily: "Orbitron,sans-serif", fontSize: 13, fontWeight: 700, color: C.primary }}>{wd.accountNumber || "—"}</span>
            </div>
            {wd.accountNumber && (
              <button onClick={()=>{ navigator.clipboard.writeText(wd.accountNumber); setCopiedId(wd.id); setTimeout(()=>setCopiedId(null),2000); }} style={{ background:copiedId===wd.id?C.greenBg:C.surface, border:`1px solid ${C.border}`, borderRadius:7, padding:"5px 12px", color:copiedId===wd.id?C.green:C.primary, fontSize:11, cursor:"pointer", fontFamily:"'Hind Siliguri',sans-serif", whiteSpace:"nowrap" }}>{copiedId===wd.id?"✓ কপি":"📋 কপি"}</button>
            )}
          </div>

          {wd.status === "pending" && (
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => reject(wd)} style={{ ...btn("red"), flex: 1 }}>❌ বাতিল</button>
              <button onClick={() => approve(wd)} style={{ ...btn("green"), flex: 2 }}>✅ পেমেন্ট দিয়েছি</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
