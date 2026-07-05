import { useState, useEffect } from "react";
import { db } from "../../firebase/config";
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, getDoc, increment, deleteDoc, setDoc } from "firebase/firestore";
import { C, card, input, label, btn, fmt } from "../../utils/ui";

// Free Fire official placement points
const PLACEMENT_POINTS = { 1:12, 2:9, 3:8, 4:7, 5:6, 6:5, 7:4, 8:3, 9:2, 10:1 };
const placementPts = (pos) => PLACEMENT_POINTS[pos] || 0;

export default function ResultsTab() {
  const [matches, setMatches] = useState([]);
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [rows, setRows] = useState([]); // auto-loaded from participants
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

  // When match selected → auto-load joined participants as rows
  const selectMatch = (m) => {
    setSelected(m);
    const parts = m.participants || [];
    const loaded = parts.map((p, idx) => ({
      uid: p.uid || null,
      teamName: p.teamName || "",
      name: p.name || p.inGameName || p.teamName || `Player ${idx+1}`,
      players: p.players ? p.players.map(pl=>({ name:pl.name, uid:pl.uid||null, kills:0 })) : null,
      position: "",   // admin enters
      kills: "",      // admin enters (team total for duo/squad, or solo kills)
    }));
    setRows(loaded);
  };

  const updateRow = (i, k, v) => { const r=[...rows]; r[i]={...r[i],[k]:v}; setRows(r); };

  // Get prize for a position from match.prizes
  const prizeForPosition = (pos) => {
    if (!selected?.prizes) return 0;
    const p = selected.prizes[pos-1];
    return p ? Number(p.amount) : 0;
  };

  const publish = async () => {
    if (!selected) { setMsg("ম্যাচ বেছে নিন"); return; }
    const filled = rows.filter(r => r.position && Number(r.position) > 0);
    if (filled.length===0) { setMsg("অন্তত একজনের পজিশন দিন"); return; }
    setSaving(true);
    try {
      // Build winners with auto points + auto prize
      const winners = filled.map(r => {
        const pos = Number(r.position);
        const kills = Number(r.kills)||0;
        const points = placementPts(pos) + kills;
        const prize = prizeForPosition(pos);
        return {
          uid: r.uid, name: r.teamName || r.name, teamName: r.teamName || "",
          position: pos, kills, points, prize,
          players: r.players || [],
        };
      }).sort((a,b)=>a.position-b.position);

      const resultData = {
        matchId:selected.id, matchTitle:selected.title, mode:selected.mode||"", format:selected.format||"",
        winners,
        participants: (selected.participants||[]).map(p=>({ uid:p.uid||null, name:p.name||p.teamName||"" })),
        createdAt:new Date().toISOString(),
        autoDeleteAt: new Date(Date.now()+7*24*60*60*1000).toISOString(),
      };
      await addDoc(collection(db,"results"), resultData);

      // Distribute to each winner
      for (const w of winners) {
        if (!w.uid) continue;
        const uSnap = await getDoc(doc(db,"users",w.uid));
        const hasPrize = w.prize > 0;
        if (uSnap.exists()) {
          const upd = { totalMatches:increment(1) };
          if (hasPrize) { upd.wallet = increment(w.prize); upd.totalWins = increment(1); upd.totalEarned = increment(w.prize); }
          await updateDoc(doc(db,"users",w.uid), upd);
        }
        if (hasPrize) {
          await addDoc(collection(db,"transactions"), {
            uid:w.uid, userName:w.name, type:"prize", amount:w.prize,
            matchTitle:selected.title, status:"completed", createdAt:new Date().toISOString(),
          });
        }
        // Notification (everyone with a position gets one)
        await addDoc(collection(db,"notifications"), {
          uid:w.uid, type:"prize", matchId:selected.id,
          title: w.position===1?"🥇 চ্যাম্পিয়ন!":w.position===2?"🥈 রানার আপ!":w.position===3?"🥉 ৩য় স্থান!":"🏆 ফলাফল প্রকাশিত",
          body:`"${selected.title}" — পজিশন #${w.position}, ${w.kills} কিল, ${w.points} পয়েন্ট${hasPrize?`, ৳${w.prize} জিতেছেন!`:""}`,
          read:false, createdAt:new Date().toISOString(),
        });
        // Leaderboard (docId = uid, no duplicates)
        const lbRef = doc(db,"leaderboard",w.uid);
        const lbSnap = await getDoc(lbRef);
        if (lbSnap.exists()) {
          await updateDoc(lbRef, {
            points:increment(w.points), matches:increment(1),
            wins:increment(w.position===1?1:0), totalPrize:increment(w.prize),
            teamName:w.teamName||lbSnap.data().teamName||"", updatedAt:new Date().toISOString(),
          });
        } else {
          await setDoc(lbRef, {
            uid:w.uid, name:uSnap?.data()?.name||w.name, avatar:uSnap?.data()?.avatar||"",
            teamName:w.teamName||"", points:w.points, matches:1,
            wins:w.position===1?1:0, totalPrize:w.prize, updatedAt:new Date().toISOString(),
          });
        }
      }

      setMsg("✅ ফলাফল প্রকাশিত! পয়েন্ট, পুরস্কার ও লিডারবোর্ড আপডেট হয়েছে।");
      setSelected(null); setRows([]);
      setTimeout(()=>setMsg(""),3500);
    } catch(e) { setMsg("সমস্যা: "+e.message); }
    setSaving(false);
  };

  const deleteResult = async (id) => {
    if (!window.confirm("এই ফলাফল ডিলিট করবেন?")) return;
    await deleteDoc(doc(db,"results",id));
  };

  const copyResult = (r) => {
    let text = `🏆 ${r.matchTitle}\n${"=".repeat(28)}\n\n`;
    (r.winners||[]).forEach((w)=>{
      const medal = w.position===1?"🥇":w.position===2?"🥈":w.position===3?"🥉":"🎖️";
      text += `${medal} #${w.position} ${w.name}\n`;
      text += `   ${w.kills} কিল · ${w.points} পয়েন্ট`;
      if (w.prize>0) text += ` · ৳${w.prize}`;
      text += `\n`;
      (w.players||[]).forEach(p=>{ if(p.name) text += `   - ${p.name}: ${p.kills||0} কিল\n`; });
      text += `\n`;
    });
    text += `${"=".repeat(28)}\nG-BATTLE 🎮`;
    navigator.clipboard.writeText(text);
    setCopiedId(r.id); setTimeout(()=>setCopiedId(null),2000);
  };

  // Live preview of points as admin types
  const previewPoints = (r) => {
    if (!r.position) return null;
    const pos = Number(r.position);
    const kills = Number(r.kills)||0;
    return placementPts(pos) + kills;
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
              <button key={m.id} onClick={()=>selectMatch(m)} style={{ ...btn(selected?.id===m.id?"primary":"ghost"), whiteSpace:"nowrap", flexShrink:0, fontSize:11 }}>{m.title}</button>
            ))}
          </div>
        )}

        {selected && (
          <>
            {/* Info banner */}
            <div style={{ background:"rgba(124,58,237,0.08)", border:"1px solid rgba(167,139,250,0.25)", borderRadius:12, padding:"10px 14px", marginBottom:14 }}>
              <div style={{ fontSize:12, color:C.text, marginBottom:4 }}>📋 {rows.length} জন অংশগ্রহণকারী · {selected.format||"Solo"}</div>
              <div style={{ fontSize:11, color:C.textFaint, lineHeight:1.5 }}>শুধু পজিশন ও কিল দিন — পয়েন্ট অটো হিসাব হবে (১ম=12, ২য়=9, ৩য়=8...+প্রতি কিল=1)। প্রাইজ ম্যাচ সেটিং অনুযায়ী অটো।</div>
            </div>

            {rows.length===0 ? (
              <div style={{ background:C.surface2, borderRadius:10, padding:20, textAlign:"center", color:C.textFaint, fontSize:12, marginBottom:14 }}>এই ম্যাচে কেউ জয়েন করেনি</div>
            ) : rows.map((r,i)=>{
              const pts = previewPoints(r);
              const prize = r.position ? prizeForPosition(Number(r.position)) : 0;
              return (
                <div key={i} style={{ background:C.surface2, borderRadius:12, padding:12, marginBottom:10 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:r.players?8:0 }}>
                    <div style={{ flex:2, minWidth:0 }}>
                      {r.teamName && <div style={{ fontSize:10, color:C.primary, fontFamily:"Orbitron,sans-serif", fontWeight:700, marginBottom:2 }}>🛡️ {r.teamName}</div>}
                      <div style={{ fontSize:12, color:C.text, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.name}</div>
                    </div>
                    <input style={{ ...input, width:60, marginBottom:0, textAlign:"center", flexShrink:0 }} type="number" value={r.position} onChange={e=>updateRow(i,"position",e.target.value)} placeholder="পজি" />
                    <input style={{ ...input, width:60, marginBottom:0, textAlign:"center", flexShrink:0 }} type="number" value={r.kills} onChange={e=>updateRow(i,"kills",e.target.value)} placeholder="কিল" />
                  </div>
                  {/* Live points + prize preview */}
                  {r.position && (
                    <div style={{ display:"flex", gap:8, marginTop:8, paddingTop:8, borderTop:`1px solid ${C.border}` }}>
                      <span style={{ fontSize:11, color:C.amber, fontFamily:"Orbitron,sans-serif" }}>⭐ {pts} পয়েন্ট</span>
                      {prize>0 && <span style={{ fontSize:11, color:C.green, fontFamily:"Orbitron,sans-serif" }}>💰 ৳{prize}</span>}
                      <span style={{ fontSize:11, color:C.textFaint }}>({placementPts(Number(r.position))} + {Number(r.kills)||0} কিল)</span>
                    </div>
                  )}
                  {/* Per-player kills for duo/squad */}
                  {r.players && r.players.length>0 && (
                    <div style={{ marginTop:8, paddingLeft:8 }}>
                      {r.players.map((pl,pi)=>(
                        <div key={pi} style={{ display:"flex", gap:6, marginBottom:5, alignItems:"center" }}>
                          <span style={{ fontSize:11, color:C.textDim, flex:2 }}>{pl.name}</span>
                          <input style={{ ...input, width:55, marginBottom:0, fontSize:11, textAlign:"center" }} type="number" value={pl.kills||0} onChange={e=>{
                            const r2=[...rows]; const pls=[...r2[i].players]; pls[pi]={...pls[pi],kills:e.target.value}; r2[i]={...r2[i],players:pls}; setRows(r2);
                          }} placeholder="কিল" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {rows.length>0 && (
              <button onClick={publish} disabled={saving} style={{ ...btn("primary"), width:"100%", opacity:saving?0.7:1 }}>{saving?"প্রকাশ হচ্ছে...":"🏆 ফলাফল প্রকাশ করুন"}</button>
            )}
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
          {(r.winners||[]).slice(0,5).map((w,i)=>(
            <div key={i} style={{ fontSize:12, color:C.textDim, marginBottom:4 }}>
              {w.position===1?"🥇":w.position===2?"🥈":w.position===3?"🥉":"🎖️"} #{w.position} {w.name}
              {w.kills>0&&<span style={{ color:"#f87171", marginLeft:8 }}>💀{w.kills}</span>}
              {w.points>0&&<span style={{ color:C.amber, marginLeft:8 }}>⭐{w.points}</span>}
              {w.prize>0&&<span style={{ fontFamily:"Orbitron,sans-serif", color:C.green, marginLeft:8 }}>৳{fmt(w.prize)}</span>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
