import { useState, useEffect } from "react";
import { db } from "../../firebase/config";
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { C, card, input, label, btn, badge } from "../../utils/ui";

export default function PointTableTab() {
  const [matches, setMatches] = useState([]);
  const [tables, setTables] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [editingTable, setEditingTable] = useState(null);
  const [teams, setTeams] = useState([]);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db,"matches"), where("status","in",["live","upcoming"])),
      snap => setMatches(snap.docs.map(d=>({id:d.id,...d.data()})))
    );
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db,"point_tables"), snap=>{
      const all = snap.docs.map(d=>({id:d.id,...d.data()}));
      all.sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0));
      setTables(all);
    });
    return unsub;
  }, []);

  const showMsg = (m) => { setMsg(m); setTimeout(()=>setMsg(""),2500); };

  const addTeam = (name="") => setTeams(prev=>[...prev, { name, points:0, kills:0 }]);
  const removeTeam = (i) => setTeams(teams.filter((_,idx)=>idx!==i));
  const updateTeam = (i,k,v) => { const t=[...teams]; t[i]={...t[i],[k]:k==="name"?v:Number(v)}; setTeams(t); };

  // Participant team names from the match (sidebar)
  const participantTeams = selectedMatch?.participants?.map(p=>p.teamName||p.name).filter(Boolean) || [];
  const addedNames = teams.map(t=>t.name.trim().toLowerCase());

  const startNew = (match) => {
    setSelectedMatch(match);
    setEditingTable(null);
    setTeams([]);
    setMsg("");
  };

  const startEdit = (table) => {
    const match = matches.find(m=>m.id===table.matchId) || { id:table.matchId, title:table.matchName, participants:[] };
    setEditingTable(table);
    setSelectedMatch(match);
    setTeams(table.teams?.length?table.teams:[]);
    setMsg("");
  };

  const save = async () => {
    if (!selectedMatch) { showMsg("ম্যাচ সিলেক্ট করুন"); return; }
    const validTeams = teams.filter(t=>t.name.trim());
    if (validTeams.length===0) { showMsg("অন্তত একটি টিম দিন"); return; }
    setSaving(true);
    try {
      const data = {
        matchId: selectedMatch.id, matchName: selectedMatch.title,
        teams: validTeams.map(t=>({ name:t.name.trim(), points:Number(t.points)||0, kills:Number(t.kills)||0 })),
        updatedAt: new Date().toISOString(),
      };
      if (editingTable) { await updateDoc(doc(db,"point_tables",editingTable.id), data); showMsg("✅ আপডেট হয়েছে"); }
      else { await addDoc(collection(db,"point_tables"), { ...data, createdAt:new Date().toISOString() }); showMsg("✅ তৈরি হয়েছে"); }
      setSelectedMatch(null); setEditingTable(null); setTeams([]);
    } catch(e) { showMsg("সমস্যা: "+e.message); }
    setSaving(false);
  };

  const removeTable = async (id) => { if(window.confirm("ডিলিট করবেন?")) await deleteDoc(doc(db,"point_tables",id)); };

  // COPY as text
  const copyTable = (table) => {
    const sorted = [...(table.teams||[])].sort((a,b)=>(b.points||0)-(a.points||0));
    let text = `🏆 ${table.matchName}\n${"=".repeat(28)}\n\n`;
    sorted.forEach((t,i)=>{
      text += `${i+1}. ${t.name}\n   পয়েন্ট: ${t.points||0} | কিল: ${t.kills||0}\n\n`;
    });
    text += `${"=".repeat(28)}\nG-BATTLE`;
    navigator.clipboard.writeText(text);
    setCopied(table.id); setTimeout(()=>setCopied(false),2000);
  };

  return (
    <div>
      {msg && <div style={{ background:msg.startsWith("✅")?C.greenBg:C.redBg, color:msg.startsWith("✅")?C.green:C.red, borderRadius:10, padding:"11px 14px", fontSize:13, marginBottom:14, textAlign:"center" }}>{msg}</div>}

      {/* MATCH SELECTOR */}
      {!selectedMatch && (
        <div style={{ ...card, marginBottom:16 }}>
          <div style={{ fontFamily:"Orbitron,sans-serif", fontSize:13, fontWeight:700, color:C.text, marginBottom:6 }}>🎯 নতুন পয়েন্ট টেবিল</div>
          <div style={{ fontSize:12, color:C.textFaint, marginBottom:14 }}>চলমান ম্যাচ থেকে সিলেক্ট করুন</div>
          {matches.length===0 ? (
            <div style={{ background:C.surface2, borderRadius:10, padding:14, textAlign:"center", color:C.textFaint, fontSize:12 }}>কোনো চলমান ম্যাচ নেই</div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {matches.map(m=>(
                <button key={m.id} onClick={()=>startNew(m)} style={{ ...card, padding:"12px 14px", cursor:"pointer", textAlign:"left", display:"flex", justifyContent:"space-between", alignItems:"center", border:`1px solid ${C.border}` }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600, color:C.text }}>{m.title}</div>
                    <div style={{ fontSize:11, color:C.textFaint }}>{m.mode} · {m.participants?.length||0} টিম</div>
                  </div>
                  <span style={badge(m.status==="live"?C.green:C.blue, m.status==="live"?C.greenBg:C.blueBg)}>{m.status==="live"?"● LIVE":"UPCOMING"}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TEAM EDITOR */}
      {selectedMatch && (
        <div style={{ ...card, marginBottom:16 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <div style={{ fontFamily:"Orbitron,sans-serif", fontSize:13, fontWeight:700, color:C.primary }}>🎯 {selectedMatch.title}</div>
            <button onClick={()=>{ setSelectedMatch(null); setEditingTable(null); setTeams([]); }} style={{ ...btn("ghost"), padding:"6px 12px", fontSize:11 }}>✕ বাতিল</button>
          </div>

          {/* PARTICIPANT TEAM CHIPS — click to add */}
          {participantTeams.length>0 && (
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:11, color:C.textFaint, marginBottom:8, fontFamily:"Orbitron,sans-serif" }}>👥 ম্যাচের টিম (ক্লিক করে যোগ করুন)</div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {participantTeams.map((name,i)=>{
                  const already = addedNames.includes(name.toLowerCase());
                  return (
                    <button key={i} onClick={()=>!already&&addTeam(name)} disabled={already} style={{ background:already?C.surface2:`${C.primary}22`, border:`1px solid ${already?C.border:C.primary+"55"}`, borderRadius:20, padding:"6px 14px", fontSize:12, color:already?C.textFaint:C.primary, cursor:already?"default":"pointer", fontFamily:"'Hind Siliguri',sans-serif", fontWeight:600 }}>
                      {already?"✓ ":""}{name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* TEAM ROWS */}
          {teams.length>0 && (
            <div style={{ display:"flex", gap:8, marginBottom:8, padding:"0 4px" }}>
              <div style={{ flex:2, fontSize:10, color:C.textFaint, fontFamily:"Orbitron,sans-serif" }}>টিম</div>
              <div style={{ width:60, fontSize:10, color:C.textFaint, fontFamily:"Orbitron,sans-serif", textAlign:"center" }}>পয়েন্ট</div>
              <div style={{ width:50, fontSize:10, color:C.textFaint, fontFamily:"Orbitron,sans-serif", textAlign:"center" }}>কিল</div>
              <div style={{ width:36 }}></div>
            </div>
          )}
          {teams.map((t,i)=>(
            <div key={i} style={{ display:"flex", gap:8, marginBottom:8, alignItems:"center" }}>
              <input style={{ ...input, flex:2, marginBottom:0 }} value={t.name} onChange={e=>updateTeam(i,"name",e.target.value)} placeholder={`টিম ${i+1}`} />
              <input style={{ ...input, width:60, marginBottom:0, textAlign:"center" }} type="number" value={t.points} onChange={e=>updateTeam(i,"points",e.target.value)} />
              <input style={{ ...input, width:50, marginBottom:0, textAlign:"center" }} type="number" value={t.kills} onChange={e=>updateTeam(i,"kills",e.target.value)} />
              <button onClick={()=>removeTeam(i)} style={{ ...btn("red"), padding:"9px 11px", flexShrink:0 }}>✕</button>
            </div>
          ))}

          <button onClick={()=>addTeam()} style={{ ...btn("ghost"), width:"100%", marginTop:6, marginBottom:14 }}>➕ ম্যানুয়াল টিম যোগ</button>
          <button onClick={save} disabled={saving} style={{ ...btn("primary"), width:"100%", opacity:saving?0.7:1 }}>{saving?"সেভ হচ্ছে...":editingTable?"✅ আপডেট করুন":"✅ সেভ করুন"}</button>
        </div>
      )}

      {/* EXISTING TABLES */}
      {!selectedMatch && (
        <>
          <div style={{ fontFamily:"Orbitron,sans-serif", fontSize:12, fontWeight:700, color:C.textDim, marginBottom:12 }}>তৈরি করা পয়েন্ট টেবিল ({tables.length})</div>
          {tables.map(table=>(
            <div key={table.id} style={{ ...card, marginBottom:12 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                <div style={{ fontFamily:"Orbitron,sans-serif", fontSize:13, fontWeight:700, color:C.text }}>🎯 {table.matchName}</div>
                <div style={{ display:"flex", gap:6 }}>
                  <button onClick={()=>copyTable(table)} style={{ ...btn(copied===table.id?"green":"ghost"), padding:"6px 10px", fontSize:11 }}>{copied===table.id?"✓ কপি":"📋 কপি"}</button>
                  <button onClick={()=>startEdit(table)} style={{ ...btn("ghost"), padding:"6px 10px", fontSize:11 }}>✏️</button>
                  <button onClick={()=>removeTable(table.id)} style={{ ...btn("red"), padding:"6px 10px", fontSize:11 }}>🗑</button>
                </div>
              </div>
              {[...(table.teams||[])].sort((a,b)=>(b.points||0)-(a.points||0)).map((t,i)=>(
                <div key={i} style={{ display:"flex", alignItems:"center", padding:"7px 10px", borderRadius:8, marginBottom:4, background:i<3?C.surface2:"transparent" }}>
                  <div style={{ width:24, fontSize:12, fontWeight:700, color:i===0?"#fbbf24":i===1?"#d1d5db":i===2?"#cd7c39":C.textFaint }}>{i+1}</div>
                  <div style={{ flex:1, fontSize:13, color:C.text }}>{t.name}</div>
                  <div style={{ width:50, textAlign:"center", fontSize:12, color:"#f87171" }}>💀{t.kills||0}</div>
                  <div style={{ width:50, textAlign:"right", fontFamily:"Orbitron,sans-serif", fontSize:13, fontWeight:700, color:"#4ade80" }}>{t.points||0}</div>
                </div>
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
