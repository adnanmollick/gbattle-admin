import { useState, useEffect } from "react";
import { db } from "../../firebase/config";
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, getDoc, increment, deleteDoc, setDoc } from "firebase/firestore";
import { C, card, input, label, btn, fmt } from "../../utils/ui";

export default function ResultsTab() {
  const [matches, setMatches] = useState([]);
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [winners, setWinners] = useState([
    { name:"", prize:"", kills:0, players:[{ name:"", kills:0 },{ name:"", kills:0 },{ name:"", kills:0 },{ name:"", kills:0 }] },
    { name:"", prize:"", kills:0, players:[{ name:"", kills:0 },{ name:"", kills:0 }] },
    { name:"", prize:"", kills:0, players:[] },
  ]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db,"matches"), where("status","==","finished")),
      snap => setMatches(snap.docs.map(d=>({id:d.id,...d.data()})))
    );
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db,"results"), snap=>{
      const all = snap.docs.map(d=>({id:d.id,...d.data()}));
      all.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
      setResults(all);
    });
    return unsub;
  }, []);

  const addWinner = () => setWinners([...winners, { name:"", prize:"", kills:0, players:[] }]);
  const removeWinner = (i) => setWinners(winners.filter((_,idx)=>idx!==i));
  const updateWinner = (i,k,v) => { const w=[...winners]; w[i]={...w[i],[k]:v}; setWinners(w); };
  const updatePlayer = (wi,pi,k,v) => {
    const w=[...winners];
    const pl=[...(w[wi].players||[])];
    pl[pi]={...pl[pi],[k]:v};
    w[wi]={...w[wi],players:pl};
    setWinners(w);
  };

  const publish = async () => {
    if (!selected) { setMsg("ম্যাচ বেছে নিন"); return; }
    const valid = winners.filter(w=>w.name.trim()&&w.prize);
    if (valid.length===0) { setMsg("অন্তত একজন বিজয়ী দিন"); return; }
    setSaving(true);
    try {
      const resultData = {
        matchId:selected.id, matchTitle:selected.title,
        winners: valid.map(w=>({ name:w.name.trim(), prize:Number(w.prize), kills:Number(w.kills||0), players:(w.players||[]).filter(p=>p.name.trim()) })),
        createdAt:new Date().toISOString(),
        autoDeleteAt: new Date(Date.now()+3*24*60*60*1000).toISOString(),
      };
      await addDoc(collection(db,"results"), resultData);

      // Distribute prizes + leaderboard update
      for (const w of valid) {
        const p = selected.participants?.find(p=>
          p.teamName?.toLowerCase()===w.name.toLowerCase()||
          p.name?.toLowerCase()===w.name.toLowerCase()
        );
        if (p?.uid) {
          const uSnap = await getDoc(doc(db,"users",p.uid));
          if (uSnap.exists()) {
            await updateDoc(doc(db,"users",p.uid), { wallet:(uSnap.data().wallet||0)+Number(w.prize), wins:increment(1) });
          }
          await addDoc(collection(db,"transactions"), {
            uid:p.uid, userName:p.name||w.name, type:"prize",
            amount:Number(w.prize), matchTitle:selected.title,
            status:"completed", createdAt:new Date().toISOString(),
          });
          // Notification
          await addDoc(collection(db,"notifications"), {
            uid:p.uid, type:"prize", title:"🏆 পুরস্কার পেয়েছেন!",
            body:`"${selected.title}" ম্যাচে ৳${w.prize} পুরস্কার পেয়েছেন`,
            read:false, createdAt:new Date().toISOString(),
          });
          // Leaderboard — use setDoc with uid as docId (no duplicates)
          const lbRef = doc(db,"leaderboard",p.uid);
          const lbSnap = await getDoc(lbRef);
          if (lbSnap.exists()) {
            await updateDoc(lbRef, { wins:increment(1), matches:increment(1), totalPrize:increment(Number(w.prize)), teamName:p.teamName||lbSnap.data().teamName||"", updatedAt:new Date().toISOString() });
          } else {
            await setDoc(lbRef, {
              uid:p.uid, name:uSnap?.data()?.name||w.name, avatar:uSnap?.data()?.avatar||"",
              teamName:p.teamName||"", wins:1, matches:1, totalPrize:Number(w.prize),
              updatedAt:new Date().toISOString(),
            });
          }
        }
      }

      setMsg("✅ ফলাফল প্রকাশিত ও পুরস্কার বিতরণ সম্পন্ন!");
      setSelected(null);
      setWinners([{ name:"",prize:"",kills:0,players:[] },{ name:"",prize:"",kills:0,players:[] },{ name:"",prize:"",kills:0,players:[] }]);
      setTimeout(()=>setMsg(""),3000);
    } catch(e) { setMsg("সমস্যা: "+e.message); }
    setSaving(false);
  };

  const deleteResult = async (id) => {
    if (!window.confirm("এই ফলাফল ডিলিট করবেন?")) return;
    await deleteDoc(doc(db,"results",id));
  };

  const copyResult = (r) => {
    let text = `🏆 ${r.matchTitle}\n${"=".repeat(28)}\n\n`;
    (r.winners||[]).forEach((w,i)=>{
      const medal = i===0?"🥇":i===1?"🥈":i===2?"🥉":"🎖️";
      text += `${medal} ${w.name}\n`;
      text += `   পুরস্কার: ৳${w.prize}`;
      if (w.kills) text += ` | মোট কিল: ${w.kills}`;
      text += `\n`;
      (w.players||[]).forEach(p=>{ text += `   - ${p.name}: ${p.kills||0} কিল\n`; });
      text += `\n`;
    });
    text += `${"=".repeat(28)}\nG-BATTLE 🎮`;
    navigator.clipboard.writeText(text);
    setCopiedId(r.id); setTimeout(()=>setCopiedId(null),2000);
  };

  return (
    <div>
      {msg && <div style={{ background:msg.startsWith("✅")?C.greenBg:C.redBg, color:msg.startsWith("✅")?C.green:C.red, borderRadius:10, padding:"11px 14px", fontSize:13, marginBottom:14, textAlign:"center" }}>{msg}</div>}

      <div style={{ ...card, marginBottom:16 }}>
        <div style={{ fontFamily:"Orbitron,sans-serif", fontSize:13, fontWeight:700, color:C.text, marginBottom:14 }}>🏆 ফলাফল প্রকাশ</div>

        <label style={label}>সমাপ্ত ম্যাচ বেছে নিন</label>
        {matches.length===0 ? (
          <div style={{ background:C.surface2, borderRadius:10, padding:14, textAlign:"center", color:C.textFaint, fontSize:12, marginBottom:14 }}>কোনো সমাপ্ত ম্যাচ নেই</div>
        ) : (
          <div style={{ display:"flex", gap:8, overflowX:"auto", marginBottom:14, paddingBottom:4 }}>
            {matches.map(m=>(
              <button key={m.id} onClick={()=>setSelected(m)} style={{ ...btn(selected?.id===m.id?"primary":"ghost"), whiteSpace:"nowrap", flexShrink:0, fontSize:11 }}>{m.title}</button>
            ))}
          </div>
        )}

        {selected && (
          <>
            {winners.map((w,i)=>(
              <div key={i} style={{ background:C.surface2, borderRadius:12, padding:14, marginBottom:12 }}>
                <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:10 }}>
                  <span style={{ fontSize:20 }}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":"🎖️"}</span>
                  <input style={{ ...input, flex:2, marginBottom:0 }} value={w.name} onChange={e=>updateWinner(i,"name",e.target.value)} placeholder="টিম/ইন-গেম নাম" />
                  <input style={{ ...input, flex:1, marginBottom:0 }} type="number" value={w.prize} onChange={e=>updateWinner(i,"prize",e.target.value)} placeholder="৳" />
                  <input style={{ ...input, flex:1, marginBottom:0 }} type="number" value={w.kills} onChange={e=>updateWinner(i,"kills",e.target.value)} placeholder="কিল" />
                  {i>2 && <button onClick={()=>removeWinner(i)} style={{ ...btn("red"), padding:"9px 12px" }}>✕</button>}
                </div>
                {/* PLAYER KILLS */}
                {(w.players||[]).map((p,pi)=>(
                  <div key={pi} style={{ display:"flex", gap:6, marginBottom:6, paddingLeft:28 }}>
                    <input style={{ ...input, flex:2, marginBottom:0, fontSize:11 }} value={p.name} onChange={e=>updatePlayer(i,pi,"name",e.target.value)} placeholder={`প্লেয়ার ${pi+1} নাম`} />
                    <input style={{ ...input, flex:1, marginBottom:0, fontSize:11 }} type="number" value={p.kills||0} onChange={e=>updatePlayer(i,pi,"kills",e.target.value)} placeholder="কিল" />
                  </div>
                ))}
                <button onClick={()=>{ const w2=[...winners]; w2[i]={...w2[i],players:[...(w2[i].players||[]),{name:"",kills:0}]}; setWinners(w2); }} style={{ ...btn("ghost"), fontSize:10, padding:"6px 12px", marginLeft:28 }}>+ প্লেয়ার যোগ</button>
              </div>
            ))}
            <button onClick={addWinner} style={{ ...btn("ghost"), width:"100%", marginBottom:14 }}>➕ আরো বিজয়ী</button>
            <button onClick={publish} disabled={saving} style={{ ...btn("primary"), width:"100%", opacity:saving?0.7:1 }}>{saving?"প্রকাশ হচ্ছে...":"🏆 ফলাফল প্রকাশ করুন"}</button>
          </>
        )}
      </div>

      {/* PUBLISHED */}
      <div style={{ fontFamily:"Orbitron,sans-serif", fontSize:12, fontWeight:700, color:C.textDim, marginBottom:12 }}>প্রকাশিত ফলাফল ({results.length})</div>
      {results.map(r=>(
        <div key={r.id} style={{ ...card, marginBottom:10 }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
            <div style={{ fontSize:13, fontWeight:600, color:C.text }}>{r.matchTitle}</div>
            <div style={{ display:"flex", gap:6 }}>
              <button onClick={()=>copyResult(r)} style={{ ...btn(copiedId===r.id?"green":"ghost"), padding:"4px 10px", fontSize:10 }}>{copiedId===r.id?"✓ কপি হয়েছে":"📋 কপি"}</button>
              <button onClick={()=>deleteResult(r.id)} style={{ ...btn("red"), padding:"4px 10px", fontSize:10 }}>🗑</button>
            </div>
          </div>
          {(r.winners||[]).map((w,i)=>(
            <div key={i} style={{ fontSize:12, color:C.textDim, marginBottom:4 }}>
              {i===0?"🥇":i===1?"🥈":i===2?"🥉":"🎖️"} {w.name}
              {w.kills>0&&<span style={{ color:"#f87171", marginLeft:8 }}>💀{w.kills}</span>}
              <span style={{ fontFamily:"Orbitron,sans-serif", color:C.green, marginLeft:8 }}>৳{fmt(w.prize)}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
