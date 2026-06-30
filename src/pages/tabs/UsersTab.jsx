import { useState, useEffect } from "react";
import { db } from "../../firebase/config";
import { collection, onSnapshot, updateDoc, doc, deleteDoc } from "firebase/firestore";
import { C, card, input, label, btn, badge, fmt } from "../../utils/ui";

export default function UsersTab() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [addAmount, setAddAmount] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collection(db,"users"), snap=>{
      const list = snap.docs.map(d=>({id:d.id,...d.data()}));
      list.sort((a,b)=>(a.name||"").localeCompare(b.name||""));
      setUsers(list);
      setLoading(false);
    });
    return unsub;
  }, []);

  const filtered = users.filter(u=>
    (u.name||"").toLowerCase().includes(search.toLowerCase()) ||
    (u.email||"").toLowerCase().includes(search.toLowerCase()) ||
    (u.phone||"").includes(search) ||
    (u.ffUID||"").includes(search)
  );

  const showMsg = (m) => { setMsg(m); setTimeout(()=>setMsg(""),2500); };

  const ban = async (uid) => { await updateDoc(doc(db,"users",uid), { banned:true }); showMsg("🚫 ব্যান করা হয়েছে"); setSelected(null); };
  const unban = async (uid) => { await updateDoc(doc(db,"users",uid), { banned:false }); showMsg("✅ আনব্যান হয়েছে"); setSelected(null); };

  const adjustWallet = async (sign) => {
    if (!addAmount||isNaN(addAmount)) { showMsg("পরিমাণ দিন"); return; }
    const delta = sign * Number(addAmount);
    const newWallet = Math.max(0, (selected.wallet||0) + delta);
    await updateDoc(doc(db,"users",selected.id), { wallet: newWallet });
    showMsg(`✅ ৳${Math.abs(delta)} ${sign>0?"যোগ":"কাটা"} হয়েছে`);
    setSelected(null); setAddAmount("");
  };

  const makeAdmin = async (uid) => {
    if (!window.confirm("এই ইউজারকে Admin বানাবেন?")) return;
    await updateDoc(doc(db,"users",uid), { role:"admin" });
    showMsg("✅ Admin করা হয়েছে"); setSelected(null);
  };

  const deleteUser = async (u) => {
    if (!window.confirm(`"${u.name}" কে সম্পূর্ণ ডিলিট করবেন? এটা পূর্বাবস্থায় ফেরানো যাবে না!`)) return;
    try {
      await deleteDoc(doc(db,"users",u.id));
      showMsg("🗑 ইউজার ডিলিট হয়েছে"); setSelected(null);
    } catch(e) { showMsg("সমস্যা: "+e.message); }
  };

  return (
    <div>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 নাম, ইমেইল, ফোন বা FF UID..." style={{ ...input, marginBottom:14 }} />

      {msg && <div style={{ background:msg.includes("✅")?C.greenBg:C.redBg, color:msg.includes("✅")?C.green:C.red, borderRadius:10, padding:"10px 14px", fontSize:12, marginBottom:12, textAlign:"center" }}>{msg}</div>}

      <div style={{ fontSize:11, color:C.textFaint, marginBottom:10, fontFamily:"Orbitron,sans-serif" }}>মোট {users.length} জন ইউজার</div>

      {loading ? (
        <div style={{ ...card, textAlign:"center", padding:40, color:C.textFaint }}>লোড হচ্ছে...</div>
      ) : filtered.length===0 ? (
        <div style={{ ...card, textAlign:"center", padding:40, color:C.textFaint, fontSize:13 }}>কোনো ইউজার পাওয়া যায়নি</div>
      ) : filtered.map(u=>(
        <div key={u.id} onClick={()=>{ setSelected(u); setAddAmount(""); }} style={{ ...card, marginBottom:10, cursor:"pointer", display:"flex", alignItems:"center", gap:12, opacity:u.banned?0.55:1, transition:"all 0.15s" }}>
          <div style={{ width:44, height:44, borderRadius:12, background:C.grad, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, fontWeight:700, color:"#fff", overflow:"hidden", flexShrink:0 }}>
            {u.avatar?<img src={u.avatar} style={{ width:"100%",height:"100%",objectFit:"cover" }} alt="av"/>:(u.name||"P")[0].toUpperCase()}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
              <span style={{ fontSize:14, fontWeight:600, color:C.text }}>{u.name||"Player"}</span>
              {u.role==="admin" && <span style={badge(C.amber,C.amberBg)}>ADMIN</span>}
              {u.banned && <span style={badge(C.red,C.redBg)}>BANNED</span>}
            </div>
            <div style={{ fontSize:11, color:C.textFaint, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{u.email||u.phone||"—"}</div>
          </div>
          <div style={{ textAlign:"right", flexShrink:0 }}>
            <div style={{ fontFamily:"Orbitron,sans-serif", fontSize:14, fontWeight:700, color:C.green }}>৳{fmt(u.wallet||0)}</div>
            <div style={{ fontSize:9, color:C.textFaint }}>{u.matches||0} ম্যাচ</div>
          </div>
        </div>
      ))}

      {/* USER DETAIL MODAL */}
      {selected && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", backdropFilter:"blur(8px)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200, padding:20 }}>
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:18, padding:22, width:"100%", maxWidth:420 }}>
            <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
              <div style={{ width:52, height:52, borderRadius:14, background:C.grad, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, fontWeight:700, color:"#fff", overflow:"hidden" }}>
                {selected.avatar?<img src={selected.avatar} style={{ width:"100%",height:"100%",objectFit:"cover" }} alt="av"/>:(selected.name||"P")[0].toUpperCase()}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:16, fontWeight:700, color:C.text }}>{selected.name||"Player"}</div>
                <div style={{ fontSize:11, color:C.textFaint }}>{selected.email||selected.phone||"—"}</div>
                {selected.ffUID && <div style={{ fontSize:10, color:C.textFaint }}>FF UID: {selected.ffUID}</div>}
              </div>
            </div>

            {/* STATS */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:16 }}>
              {[["ব্যালেন্স",`৳${fmt(selected.wallet||0)}`,C.green],["ম্যাচ",selected.matches||0,C.primary],["জয়",selected.wins||0,C.amber]].map(([l,v,c])=>(
                <div key={l} style={{ background:C.surface2, borderRadius:10, padding:"10px 4px", textAlign:"center" }}>
                  <div style={{ fontFamily:"Orbitron,sans-serif", fontSize:13, fontWeight:700, color:c }}>{v}</div>
                  <div style={{ fontSize:9, color:C.textFaint, marginTop:2 }}>{l}</div>
                </div>
              ))}
            </div>

            {/* WALLET ADJUST */}
            <label style={label}>ব্যালেন্স পরিবর্তন</label>
            <input style={{ ...input, marginBottom:10 }} type="number" value={addAmount} onChange={e=>setAddAmount(e.target.value)} placeholder="পরিমাণ লিখুন" />
            <div style={{ display:"flex", gap:8, marginBottom:14 }}>
              <button onClick={()=>adjustWallet(1)} style={{ ...btn("green"), flex:1 }}>➕ যোগ</button>
              <button onClick={()=>adjustWallet(-1)} style={{ ...btn("red"), flex:1 }}>➖ কাটা</button>
            </div>

            {/* ACTIONS */}
            <div style={{ display:"flex", gap:8, marginBottom:10 }}>
              {selected.banned
                ? <button onClick={()=>unban(selected.id)} style={{ ...btn("green"), flex:1 }}>✅ আনব্যান</button>
                : <button onClick={()=>ban(selected.id)} style={{ ...btn("red"), flex:1 }}>🚫 ব্যান</button>}
              {selected.role!=="admin" && <button onClick={()=>makeAdmin(selected.id)} style={{ ...btn("ghost"), flex:1 }}>👑 Admin</button>}
            </div>

            {/* DELETE */}
            <button onClick={()=>deleteUser(selected)} style={{ ...btn("red"), width:"100%", marginBottom:10, background:"rgba(248,113,113,0.08)" }}>🗑 ইউজার ডিলিট করুন</button>

            <button onClick={()=>{setSelected(null);setAddAmount("");}} style={{ ...btn("ghost"), width:"100%" }}>বন্ধ করুন</button>
          </div>
        </div>
      )}
    </div>
  );
}
