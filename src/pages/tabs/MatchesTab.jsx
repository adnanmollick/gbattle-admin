import { useState, useEffect } from "react";
import { db } from "../../firebase/config";
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { C, card, input, label, btn, badge, compressImg } from "../../utils/ui";

const MAPS = ["Bermuda","Purgatory","Kalahari","Alpine","NeXTerra"];
const MODES = ["BR Match","Clash Squad","2V2","Lone Wolf"];

export default function MatchesTab() {
  const [matches, setMatches] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [roomModal, setRoomModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [thumbnail, setThumbnail] = useState("");

  const emptyForm = {
    title:"", mode:"BR Match", maps:["Bermuda"],
    entryFee:20, prize:500, maxPlayers:12, perKill:5,
    scheduledAt:"", duration:60, rules:"", isFree:false,
    requirePlayerInfo:false,
    prizes:[{ place:"১ম স্থান",amount:300 },{ place:"২য় স্থান",amount:150 },{ place:"৩য় স্থান",amount:50 }],
  };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db,"matches"), orderBy("createdAt","desc")),
      snap => setMatches(snap.docs.map(d=>({id:d.id,...d.data()})))
    );
    return unsub;
  }, []);

  // Auto status + room release
  useEffect(() => {
    const iv = setInterval(async () => {
      const now = new Date();
      for (const m of matches) {
        if (m.status==="upcoming"&&m.scheduledAt&&new Date(m.scheduledAt)<=now)
          await updateDoc(doc(db,"matches",m.id), { status:"live" });
        if (m.status==="live"&&m.scheduledAt&&m.duration) {
          const end = new Date(new Date(m.scheduledAt).getTime()+m.duration*60000);
          if (now>=end) await updateDoc(doc(db,"matches",m.id), { status:"finished" });
        }
        if (m.roomID&&!m.roomReleased&&m.roomReleaseAt&&new Date(m.roomReleaseAt)<=now)
          await updateDoc(doc(db,"matches",m.id), { roomReleased:true });
      }
    }, 20000);
    return ()=>clearInterval(iv);
  }, [matches]);

  const toggleMap = (map) => setForm(f=>({ ...f, maps:f.maps.includes(map)?f.maps.filter(m=>m!==map):[...f.maps,map] }));
  const addPrize = () => setForm(f=>({ ...f, prizes:[...f.prizes,{ place:`${f.prizes.length+1}ম স্থান`,amount:0 }] }));
  const removePrize = (i) => setForm(f=>({ ...f, prizes:f.prizes.filter((_,idx)=>idx!==i) }));
  const updatePrize = (i,k,v) => setForm(f=>{ const p=[...f.prizes]; p[i]={...p[i],[k]:v}; return {...f,prizes:p}; });

  const handleThumb = async (e) => {
    const f=e.target.files[0];
    if(f){ try{ setThumbnail(await compressImg(f,800,0.72)); }catch{ setMsg("ছবি ব্যর্থ"); } }
  };

  const openCreate = () => { setForm(emptyForm); setThumbnail(""); setEditId(null); setMsg(""); setShowForm(true); };

  const save = async () => {
    if(!form.title.trim()){ setMsg("ম্যাচের নাম দিন"); return; }
    if(form.maps.length===0){ setMsg("কমপক্ষে একটি ম্যাপ"); return; }
    setSaving(true);
    try {
      const data = {
        title:form.title.trim(), mode:form.mode, maps:form.maps, map:form.maps[0],
        entryFee:form.isFree?0:Number(form.entryFee), isFree:form.isFree,
        prize:Number(form.prize), maxPlayers:Number(form.maxPlayers),
        perKill:Number(form.perKill), scheduledAt:form.scheduledAt||null,
        duration:Number(form.duration), rules:form.rules,
        prizes:form.prizes.map(p=>({ place:p.place,amount:Number(p.amount) })),
        thumbnail:thumbnail||"", requirePlayerInfo:form.requirePlayerInfo,
      };
      if(editId){ await updateDoc(doc(db,"matches",editId),data); setMsg("✅ আপডেট হয়েছে"); }
      else { await addDoc(collection(db,"matches"),{ ...data,status:"upcoming",players:0,participants:[],createdAt:new Date().toISOString() }); setMsg("✅ ম্যাচ তৈরি হয়েছে"); }
      setTimeout(()=>{ setShowForm(false); setMsg(""); },1000);
    } catch(e){ setMsg("সমস্যা: "+e.message); }
    setSaving(false);
  };

  const edit = (m) => {
    setForm({ title:m.title||"", mode:m.mode||"BR Match", maps:Array.isArray(m.maps)?m.maps:[m.map||"Bermuda"], entryFee:m.entryFee||0, prize:m.prize||0, maxPlayers:m.maxPlayers||12, perKill:m.perKill||0, scheduledAt:m.scheduledAt?m.scheduledAt.slice(0,16):"", duration:m.duration||60, rules:m.rules||"", isFree:m.isFree||false, requirePlayerInfo:m.requirePlayerInfo||false, prizes:m.prizes?.length?m.prizes:[{place:"১ম স্থান",amount:m.prize||0}] });
    setThumbnail(m.thumbnail||""); setEditId(m.id); setMsg(""); setShowForm(true);
  };

  const remove = async (id) => { if(window.confirm("মুছে ফেলবেন?")) await deleteDoc(doc(db,"matches",id)); };

  const toggleLive = async (m) => {
    if(m.status==="upcoming") await updateDoc(doc(db,"matches",m.id),{ status:"live" });
    else if(m.status==="live") await updateDoc(doc(db,"matches",m.id),{ status:"finished" });
  };

  const releaseRoom = async () => {
    if(!roomModal.roomID?.trim()){ setMsg("Room ID দিন"); return; }
    await updateDoc(doc(db,"matches",roomModal.id),{ roomID:roomModal.roomID.trim(), roomPass:roomModal.roomPass?.trim()||"", roomReleased:roomModal.releaseNow, roomReleaseAt:roomModal.releaseNow?null:(roomModal.roomReleaseAt||null) });
    // Notify all participants
    const m = matches.find(x=>x.id===roomModal.id);
    if(m?.participants?.length) {
      for(const p of m.participants) {
        if(p.uid) {
          await addDoc(collection(db,"notifications"),{ uid:p.uid, type:"room", matchId:m.id, title:"🔑 Room ID প্রকাশিত!", body:`"${m.title}" এর Room ID: ${roomModal.roomID}`, read:false, createdAt:new Date().toISOString() });
        }
      }
    }
    setRoomModal(null); setMsg("✅ Room সেভ ও নোটিফিকেশন পাঠানো হয়েছে"); setTimeout(()=>setMsg(""),2500);
  };

  return (
    <div>
      {msg&&!showForm&&!roomModal&&<div style={{ background:msg.startsWith("✅")?C.greenBg:C.redBg, color:msg.startsWith("✅")?C.green:C.red, borderRadius:10, padding:"11px 14px", fontSize:13, marginBottom:14, textAlign:"center" }}>{msg}</div>}

      <button onClick={openCreate} style={{ ...btn("primary"), width:"100%", marginBottom:16, padding:14 }}>➕ নতুন ম্যাচ তৈরি</button>

      {matches.map(m=>(
        <div key={m.id} style={{ ...card, marginBottom:12, padding:0, overflow:"hidden" }}>
          <div style={{ height:90, background:m.thumbnail?`url(${m.thumbnail}) center/cover`:C.grad, position:"relative" }}>
            <div style={{ position:"absolute", inset:0, background:"linear-gradient(to bottom,transparent,rgba(0,0,0,0.75))" }}></div>
            <div style={{ position:"absolute", top:8, left:10, display:"flex", gap:6 }}>
              <span style={badge(m.status==="live"?C.green:m.status==="finished"?C.textFaint:C.blue, m.status==="live"?C.greenBg:m.status==="finished"?C.surface2:C.blueBg)}>
                {m.status==="live"?"● LIVE":m.status==="finished"?"FINISHED":"UPCOMING"}
              </span>
              {m.requirePlayerInfo && <span style={badge(C.amber,C.amberBg)}>👥 INFO</span>}
            </div>
            <div style={{ position:"absolute", bottom:8, left:12, right:12 }}>
              <div style={{ fontFamily:"Orbitron,sans-serif", fontSize:13, fontWeight:700, color:"#fff" }}>{m.title}</div>
              <div style={{ fontSize:10, color:"rgba(255,255,255,0.7)" }}>{m.mode} · {Array.isArray(m.maps)?m.maps.join(", "):m.map} · {m.players||0}/{m.maxPlayers}</div>
            </div>
          </div>
          <div style={{ padding:"10px 12px", display:"flex", gap:8, flexWrap:"wrap" }}>
            {m.status!=="finished" && (
              <button onClick={()=>toggleLive(m)} style={{ ...btn(m.status==="live"?"red":"green"), flex:1, padding:"9px", fontSize:11 }}>
                {m.status==="live"?"⏹ শেষ করুন":"▶ Live করুন"}
              </button>
            )}
            <button onClick={()=>setRoomModal({ id:m.id,roomID:m.roomID||"",roomPass:m.roomPass||"",releaseNow:m.roomReleased||false,roomReleaseAt:m.roomReleaseAt?m.roomReleaseAt.slice(0,16):"" })} style={{ ...btn(m.roomID?"green":"ghost"), flex:1, padding:"9px", fontSize:11 }}>🔑 Room{m.roomID?"✓":""}</button>
            <button onClick={()=>edit(m)} style={{ ...btn("ghost"), flex:1, padding:"9px", fontSize:11 }}>✏️</button>
            <button onClick={()=>remove(m.id)} style={{ ...btn("red"), padding:"9px 14px", fontSize:11 }}>🗑</button>
          </div>
        </div>
      ))}

      {/* CREATE/EDIT FORM */}
      {showForm && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", backdropFilter:"blur(8px)", display:"flex", alignItems:"flex-start", justifyContent:"center", zIndex:200, overflowY:"auto", padding:"20px 0" }}>
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:18, padding:22, width:"94%", maxWidth:520, margin:"auto" }}>
            <div style={{ fontFamily:"Orbitron,sans-serif", fontSize:15, fontWeight:700, color:C.text, marginBottom:16 }}>{editId?"✏️ এডিট":"➕ নতুন ম্যাচ"}</div>

            <label style={label}>থাম্বনেইল (800×450px প্রস্তাবিত)</label>
            <label style={{ display:"block", marginBottom:14, cursor:"pointer" }}>
              <div style={{ height:thumbnail?120:70, borderRadius:12, border:`1.5px dashed ${C.border}`, background:thumbnail?`url(${thumbnail}) center/cover`:C.surface2, display:"flex", alignItems:"center", justifyContent:"center", color:C.textFaint, fontSize:12, position:"relative" }}>
                {!thumbnail&&"📷 ছবি আপলোড (800×450px)"}
                {thumbnail&&<div style={{ position:"absolute", bottom:4, right:8, fontSize:10, color:"rgba(255,255,255,0.6)", background:"rgba(0,0,0,0.5)", padding:"2px 6px", borderRadius:4 }}>800×450px</div>}
              </div>
              <input type="file" accept="image/*" onChange={handleThumb} style={{ display:"none" }} />
            </label>

            <label style={label}>ম্যাচের নাম *</label>
            <input style={{ ...input, marginBottom:12 }} value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="যেমন: Friday BR Championship" />

            <label style={label}>মোড</label>
            <div style={{ display:"flex", gap:6, marginBottom:12, flexWrap:"wrap" }}>
              {MODES.map(mode=><button key={mode} onClick={()=>setForm({...form,mode})} style={{ ...btn(form.mode===mode?"primary":"ghost"), padding:"8px 12px", fontSize:10 }}>{mode}</button>)}
            </div>

            <label style={label}>ম্যাপ (একাধিক)</label>
            <div style={{ display:"flex", gap:6, marginBottom:12, flexWrap:"wrap" }}>
              {MAPS.map(map=><button key={map} onClick={()=>toggleMap(map)} style={{ ...btn(form.maps.includes(map)?"primary":"ghost"), padding:"8px 12px", fontSize:10 }}>{form.maps.includes(map)?"✓ ":""}{map}</button>)}
            </div>

            <div style={{ display:"flex", gap:10, marginBottom:12 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <button onClick={()=>setForm({...form,isFree:!form.isFree})} style={{ width:44,height:24,borderRadius:20,border:"none",cursor:"pointer",background:form.isFree?C.green:C.surface2,position:"relative" }}>
                  <div style={{ position:"absolute",top:2,left:form.isFree?22:2,width:20,height:20,borderRadius:"50%",background:"#fff",transition:"all 0.2s" }}></div>
                </button>
                <span style={{ fontSize:12, color:C.textDim }}>ফ্রি ম্যাচ</span>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <button onClick={()=>setForm({...form,requirePlayerInfo:!form.requirePlayerInfo})} style={{ width:44,height:24,borderRadius:20,border:"none",cursor:"pointer",background:form.requirePlayerInfo?C.primary:C.surface2,position:"relative" }}>
                  <div style={{ position:"absolute",top:2,left:form.requirePlayerInfo?22:2,width:20,height:20,borderRadius:"50%",background:"#fff",transition:"all 0.2s" }}></div>
                </button>
                <span style={{ fontSize:12, color:C.textDim }}>প্লেয়ার তথ্য</span>
              </div>
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
              {!form.isFree&&<div><label style={label}>প্রবেশ মূল্য</label><input style={input} type="number" value={form.entryFee} onChange={e=>setForm({...form,entryFee:e.target.value})} /></div>}
              <div><label style={label}>মোট পুরস্কার</label><input style={input} type="number" value={form.prize} onChange={e=>setForm({...form,prize:e.target.value})} /></div>
              <div><label style={label}>সর্বোচ্চ প্লেয়ার</label><input style={input} type="number" value={form.maxPlayers} onChange={e=>setForm({...form,maxPlayers:e.target.value})} /></div>
              <div><label style={label}>প্রতি কিল (৳)</label><input style={input} type="number" value={form.perKill} onChange={e=>setForm({...form,perKill:e.target.value})} /></div>
              <div><label style={label}>সময়</label><input style={input} type="datetime-local" value={form.scheduledAt} onChange={e=>setForm({...form,scheduledAt:e.target.value})} /></div>
              <div><label style={label}>সময়কাল (মিনিট)</label><input style={input} type="number" value={form.duration} onChange={e=>setForm({...form,duration:e.target.value})} /></div>
            </div>

            <label style={label}>পুরস্কার তালিকা</label>
            {form.prizes.map((p,i)=>(
              <div key={i} style={{ display:"flex", gap:8, marginBottom:8 }}>
                <input style={{ ...input, flex:2 }} value={p.place} onChange={e=>updatePrize(i,"place",e.target.value)} placeholder="স্থান" />
                <input style={{ ...input, flex:1 }} type="number" value={p.amount} onChange={e=>updatePrize(i,"amount",e.target.value)} placeholder="৳" />
                <button onClick={()=>removePrize(i)} style={{ ...btn("red"), padding:"9px 12px" }}>✕</button>
              </div>
            ))}
            <button onClick={addPrize} style={{ ...btn("ghost"), width:"100%", marginBottom:14 }}>➕ পুরস্কার যোগ</button>

            <label style={label}>নিয়মাবলী</label>
            <textarea style={{ ...input, minHeight:60, resize:"vertical", marginBottom:14 }} value={form.rules} onChange={e=>setForm({...form,rules:e.target.value})} placeholder="ম্যাচের নিয়ম..." />

            {msg&&<div style={{ background:msg.startsWith("✅")?C.greenBg:C.redBg, color:msg.startsWith("✅")?C.green:C.red, borderRadius:8, padding:"9px 12px", fontSize:12, marginBottom:12, textAlign:"center" }}>{msg}</div>}
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={()=>setShowForm(false)} style={{ ...btn("ghost"), flex:1 }}>বাতিল</button>
              <button onClick={save} disabled={saving} style={{ ...btn("primary"), flex:2, opacity:saving?0.7:1 }}>{saving?"সেভ হচ্ছে...":editId?"✅ আপডেট":"✅ তৈরি করুন"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ROOM MODAL */}
      {roomModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", backdropFilter:"blur(8px)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200, padding:20 }}>
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:18, padding:22, width:"100%", maxWidth:420 }}>
            <div style={{ fontFamily:"Orbitron,sans-serif", fontSize:15, fontWeight:700, color:C.text, marginBottom:16 }}>🔑 Room তথ্য</div>
            <label style={label}>Room ID</label>
            <input style={{ ...input, marginBottom:12 }} value={roomModal.roomID} onChange={e=>setRoomModal({...roomModal,roomID:e.target.value})} placeholder="12345678" />
            <label style={label}>Password</label>
            <input style={{ ...input, marginBottom:14 }} value={roomModal.roomPass} onChange={e=>setRoomModal({...roomModal,roomPass:e.target.value})} placeholder="1234" />
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
              <button onClick={()=>setRoomModal({...roomModal,releaseNow:!roomModal.releaseNow})} style={{ width:48,height:26,borderRadius:20,border:"none",cursor:"pointer",background:roomModal.releaseNow?C.green:C.surface2,position:"relative" }}>
                <div style={{ position:"absolute",top:3,left:roomModal.releaseNow?25:3,width:20,height:20,borderRadius:"50%",background:"#fff",transition:"all 0.2s" }}></div>
              </button>
              <span style={{ fontSize:13, color:C.textDim }}>এখনই দেখান + নোটিফিকেশন</span>
            </div>
            {!roomModal.releaseNow&&(
              <>
                <label style={label}>অটো-রিলিজ সময়</label>
                <input style={{ ...input, marginBottom:14 }} type="datetime-local" value={roomModal.roomReleaseAt} onChange={e=>setRoomModal({...roomModal,roomReleaseAt:e.target.value})} />
              </>
            )}
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={()=>setRoomModal(null)} style={{ ...btn("ghost"), flex:1 }}>বাতিল</button>
              <button onClick={releaseRoom} style={{ ...btn("green"), flex:2 }}>✅ সেভ করুন</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
