import { useState, useEffect } from "react";
import { db } from "../../firebase/config";
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { C, card, input, label, btn, badge, compressImg } from "../../utils/ui";
import { useAdminAuth } from "../../context/AdminAuthContext";
import SlotGrid from "../../components/SlotGrid";

const MAPS = ["Bermuda","Purgatory","Kalahari","Alpine","NeXTerra"];
const MODES = ["BR Match","Clash Squad","2V2","Lone Wolf"];

// Free Fire official mode config (web-verified real rules)
// Each mode auto-sets teamSize + maxPlayers. Some have format sub-options.
const MODE_CONFIG = {
  "BR Match": {
    hasFormat: true, // Solo/Duo/Squad
    formats: [
      { f:"Solo", teamSize:1, maxPlayers:48, label:"Solo" },
      { f:"Duo", teamSize:2, maxPlayers:48, label:"Duo" },
      { f:"Squad", teamSize:4, maxPlayers:48, label:"Squad" },
    ],
    default: "Solo",
  },
  "Clash Squad": {
    hasFormat: false, // always 4v4
    teamSize: 4, maxPlayers: 8, format: "Squad",
    note: "৪v৪ — ২ টিম, ৪ জন করে (মোট ৮)",
  },
  "2V2": {
    hasFormat: false, // always 2v2
    teamSize: 2, maxPlayers: 4, format: "Duo",
    note: "২v২ — ২ টিম, ২ জন করে (মোট ৪)",
  },
  "Lone Wolf": {
    hasFormat: true, // 1v1 or 2v2
    formats: [
      { f:"1v1", teamSize:1, maxPlayers:2, label:"1v1 (১ জন)" },
      { f:"2v2", teamSize:2, maxPlayers:4, label:"2v2 (২ জন)" },
    ],
    default: "1v1",
  },
};

// Apply mode config to form (returns partial form update)
function applyModeConfig(mode, formatChoice) {
  const cfg = MODE_CONFIG[mode];
  if (!cfg) return { mode };
  if (cfg.hasFormat) {
    const fmt = cfg.formats.find(f => f.f === formatChoice) || cfg.formats.find(f => f.f === cfg.default);
    return { mode, format:fmt.f, teamSize:fmt.teamSize, maxPlayers:fmt.maxPlayers, requirePlayerInfo:fmt.teamSize>1 };
  }
  return { mode, format:cfg.format, teamSize:cfg.teamSize, maxPlayers:cfg.maxPlayers, requirePlayerInfo:cfg.teamSize>1 };
}


export default function MatchesTab() {
  const { adminData, isSuperAdmin } = useAdminAuth();
  // Super admin sees all modes; sub-admin sees only allowed modes
  const allowedModes = isSuperAdmin ? MODES : (adminData?.allowedModes || MODES);
  const [matches, setMatches] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [roomModal, setRoomModal] = useState(null);
  const [partModal, setPartModal] = useState(null);
  const [viewSlot, setViewSlot] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [thumbnail, setThumbnail] = useState("");

  const emptyForm = {
    title:"", mode:"BR Match", maps:["Bermuda"], format:"Solo", teamSize:1,
    entryFee:20, prize:500, maxPlayers:48, perKill:5,
    scheduledAt:"", duration:60, rules:"", isFree:false, streamUrl:"",
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

  // Auto prize calculation: total collected − profit% → round down to clean number
  const [profitPct, setProfitPct] = useState(20);
  const [autoCalc, setAutoCalc] = useState(false);
  useEffect(() => {
    import("firebase/firestore").then(({ doc:d, onSnapshot:os }) => {
      os(d(db,"settings","app"), snap => { if(snap.exists()&&snap.data().profitPercent!=null) setProfitPct(snap.data().profitPercent); });
    });
  }, []);

  // Compute prize pool + weighted distribution across N positions
  // Weight: 1st gets most, decreasing gradually (weight[i] = N-i)
  const computePrize = (entry, players, profit, numPositions=3) => {
    const total = entry * players;
    const afterProfit = total * (1 - profit/100);
    const pool = Math.floor(afterProfit/10)*10; // round to 10
    const N = Math.max(1, numPositions);
    const totalWeight = N*(N+1)/2; // sum of 1..N
    const amounts = [];
    let distributed = 0;
    for (let i=0; i<N; i++) {
      const weight = N - i; // 1st = N, 2nd = N-1, ... last = 1
      let amt = Math.floor((pool * weight / totalWeight)/10)*10;
      amounts.push(amt);
      distributed += amt;
    }
    // Give rounding remainder to 1st place
    if (amounts.length > 0) amounts[0] += (pool - distributed);
    return { total, pool, amounts };
  };

  // LIVE auto-calc: recompute whenever entry/players/profit/positionCount change
  useEffect(() => {
    if (!autoCalc) return;
    const entry = Number(form.entryFee)||0;
    const players = Number(form.maxPlayers)||0;
    if (entry===0 || players===0) return;
    const numPos = form.prizes.length || 3;
    const { pool, amounts } = computePrize(entry, players, profitPct, numPos);
    setForm(f=>({ ...f, prize:pool, prizes:f.prizes.map((p,i)=>({
      place: p.place || `${i+1}ম স্থান`,
      amount: amounts[i] ?? 0,
    }))}));
  }, [form.entryFee, form.maxPlayers, profitPct, autoCalc, form.prizes.length]);

  const liveCalc = (Number(form.entryFee)>0 && Number(form.maxPlayers)>0)
    ? computePrize(Number(form.entryFee), Number(form.maxPlayers), profitPct, form.prizes.length||3)
    : null;


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
        format:form.format, teamSize:Number(form.teamSize)||1, streamUrl:form.streamUrl?.trim()||"",
        entryFee:form.isFree?0:Number(form.entryFee), isFree:form.isFree,
        prize:Number(form.prize), maxPlayers:Number(form.maxPlayers),
        perKill:Number(form.perKill), scheduledAt:form.scheduledAt||null,
        duration:Number(form.duration), rules:form.rules,
        prizes:form.prizes.map(p=>({ place:p.place,amount:Number(p.amount) })),
        thumbnail:thumbnail||"", requirePlayerInfo:form.requirePlayerInfo,
      };
      if(editId){
        // If admin set a future time, reactivate the match (upcoming) so it can run again
        const updateData = { ...data };
        if (form.scheduledAt && new Date(form.scheduledAt) > new Date()) {
          updateData.status = "upcoming";
        }
        await updateDoc(doc(db,"matches",editId),updateData); setMsg("✅ আপডেট হয়েছে");
      }
      else { await addDoc(collection(db,"matches"),{ ...data,status:"upcoming",players:0,participants:[],createdBy:adminData?.uid||null,createdByName:adminData?.name||"",createdAt:new Date().toISOString() }); setMsg("✅ ম্যাচ তৈরি হয়েছে"); }
      setTimeout(()=>{ setShowForm(false); setMsg(""); },1000);
    } catch(e){ setMsg("সমস্যা: "+e.message); }
    setSaving(false);
  };

  const edit = (m) => {
    setForm({ title:m.title||"", mode:m.mode||"BR Match", maps:Array.isArray(m.maps)?m.maps:[m.map||"Bermuda"], format:m.format||"Solo", teamSize:m.teamSize||1, streamUrl:m.streamUrl||"", entryFee:m.entryFee||0, prize:m.prize||0, maxPlayers:m.maxPlayers||48, perKill:m.perKill||0, scheduledAt:m.scheduledAt?m.scheduledAt.slice(0,16):"", duration:m.duration||60, rules:m.rules||"", isFree:m.isFree||false, requirePlayerInfo:m.requirePlayerInfo||false, prizes:m.prizes?.length?m.prizes:[{place:"১ম স্থান",amount:m.prize||0}] });
    setThumbnail(m.thumbnail||""); setEditId(m.id); setMsg(""); setShowForm(true);
  };

  const remove = async (id) => { if(window.confirm("মুছে ফেলবেন?")) await deleteDoc(doc(db,"matches",id)); };

  // Match cancel with auto refund to all participants
  const cancelMatch = async (m) => {
    if (!window.confirm(`"${m.title}" বাতিল করবেন? সব প্লেয়ারের টাকা ফেরত যাবে।`)) return;
    const { increment } = await import("firebase/firestore");
    const entryFee = Number(m.entryFee)||0;
    for (const p of (m.participants||[])) {
      const teamSize = p.players?.length || 1;
      const refund = entryFee * teamSize;
      if (p.uid && refund>0 && !m.isFree) {
        await updateDoc(doc(db,"users",p.uid), { wallet:increment(refund) });
        await addDoc(collection(db,"transactions"), { uid:p.uid, type:"refund", amount:refund, matchTitle:m.title, status:"completed", createdAt:new Date().toISOString() });
      }
      if (p.uid) await addDoc(collection(db,"notifications"), { uid:p.uid, type:"match", matchId:m.id, title:"❌ ম্যাচ বাতিল", body:`"${m.title}" ম্যাচটি বাতিল হয়েছে${!m.isFree&&refund>0?`, ৳${refund} ফেরত দেওয়া হয়েছে`:""}`, read:false, createdAt:new Date().toISOString() });
    }
    await updateDoc(doc(db,"matches",m.id), { status:"cancelled", participants:[], players:0 });
    setMsg("✅ ম্যাচ বাতিল ও রিফান্ড সম্পন্ন");
    setTimeout(()=>setMsg(""),2500);
  };

  // Remove single participant with auto refund
  const removeParticipant = async (m, idx) => {
    const p = m.participants[idx];
    if (!window.confirm(`${p.teamName||p.name||"এই প্লেয়ার"} কে বাদ দেবেন? টাকা ফেরত যাবে।`)) return;
    const { increment } = await import("firebase/firestore");
    const teamSize = p.players?.length || 1;
    const refund = (Number(m.entryFee)||0) * teamSize;
    if (p.uid && refund>0 && !m.isFree) {
      await updateDoc(doc(db,"users",p.uid), { wallet:increment(refund) });
      await addDoc(collection(db,"transactions"), { uid:p.uid, type:"refund", amount:refund, matchTitle:m.title, status:"completed", createdAt:new Date().toISOString() });
      await addDoc(collection(db,"notifications"), { uid:p.uid, type:"match", matchId:m.id, title:"⚠️ ম্যাচ থেকে বাদ", body:`"${m.title}" থেকে আপনাকে বাদ দেওয়া হয়েছে, ৳${refund} ফেরত দেওয়া হয়েছে`, read:false, createdAt:new Date().toISOString() });
    }
    const newParts = m.participants.filter((_,i)=>i!==idx);
    await updateDoc(doc(db,"matches",m.id), { participants:newParts, players:newParts.length });
    setPartModal(pm => pm ? { ...pm, participants:newParts } : null);
  };

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
            <button onClick={()=>setPartModal({ id:m.id, title:m.title, entryFee:m.entryFee, isFree:m.isFree, participants:m.participants||[] })} style={{ ...btn("ghost"), flex:1, padding:"9px", fontSize:11 }}>👥 {m.participants?.length||0}</button>
            <button onClick={()=>edit(m)} style={{ ...btn("ghost"), flex:1, padding:"9px", fontSize:11 }}>✏️</button>
            {m.status!=="finished" && m.status!=="cancelled" && (m.participants?.length>0) && (
              <button onClick={()=>cancelMatch(m)} style={{ ...btn("ghost"), padding:"9px 12px", fontSize:11, color:"#fb923c", border:"1px solid rgba(251,146,60,0.3)" }}>🚫</button>
            )}
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
              {allowedModes.map(mode=><button key={mode} onClick={()=>setForm({...form, ...applyModeConfig(mode, MODE_CONFIG[mode]?.default)})} style={{ ...btn(form.mode===mode?"primary":"ghost"), padding:"8px 12px", fontSize:10 }}>{mode}</button>)}
            </div>

            {/* FORMAT SUB-SELECT (only for modes that have formats: BR, Lone Wolf) */}
            {MODE_CONFIG[form.mode]?.hasFormat && (
              <>
                <label style={label}>ফরম্যাট</label>
                <div style={{ display:"flex", gap:6, marginBottom:12 }}>
                  {MODE_CONFIG[form.mode].formats.map(({f,label:lbl})=>(
                    <button key={f} onClick={()=>setForm({...form, ...applyModeConfig(form.mode, f)})} style={{ ...btn(form.format===f?"primary":"ghost"), flex:1, padding:"9px 4px", fontSize:10 }}>{lbl}</button>
                  ))}
                </div>
              </>
            )}

            {/* AUTO CONFIG INFO — shows current player/slot setup */}
            <div style={{ background:"rgba(96,165,250,0.08)", border:"1px solid rgba(96,165,250,0.25)", borderRadius:10, padding:"10px 14px", marginBottom:12 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                <span style={{ fontSize:11, color:C.textFaint }}>
                  {form.teamSize===1 ? "সর্বোচ্চ প্লেয়ার" : "স্লট সংখ্যা (টিম)"}
                </span>
                <span style={{ fontFamily:"Orbitron,sans-serif", fontSize:14, fontWeight:800, color:C.blue }}>
                  {form.teamSize===1 ? form.maxPlayers : Math.ceil(form.maxPlayers/form.teamSize)}
                  {form.teamSize>1 && <span style={{ fontSize:10, color:C.textFaint, marginLeft:4 }}>স্লট</span>}
                </span>
              </div>
              <div style={{ fontSize:10, color:C.textFaint, lineHeight:1.5 }}>
                {MODE_CONFIG[form.mode]?.note
                  ? MODE_CONFIG[form.mode].note
                  : form.teamSize===1
                    ? `👤 ${form.maxPlayers} জন একক প্লেয়ার, প্রতি স্লটে ১ জন`
                    : `${form.teamSize===2?"👥":"🛡️"} ${Math.ceil(form.maxPlayers/form.teamSize)} টিম × ${form.teamSize} জন = ${form.maxPlayers} জন`}
              </div>
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
              {form.mode==="BR Match"
                ? <div><label style={label}>সর্বোচ্চ প্লেয়ার</label><input style={input} type="number" value={form.maxPlayers} onChange={e=>setForm({...form,maxPlayers:e.target.value})} /></div>
                : <div><label style={label}>সর্বোচ্চ প্লেয়ার (স্থির)</label><input style={{ ...input, opacity:0.6 }} type="number" value={form.maxPlayers} disabled /></div>
              }
              <div><label style={label}>প্রতি কিল (৳)</label><input style={input} type="number" value={form.perKill} onChange={e=>setForm({...form,perKill:e.target.value})} /></div>
              <div><label style={label}>সময়</label><input style={input} type="datetime-local" value={form.scheduledAt} onChange={e=>setForm({...form,scheduledAt:e.target.value})} /></div>
              <div><label style={label}>সময়কাল (মিনিট)</label><input style={input} type="number" value={form.duration} onChange={e=>setForm({...form,duration:e.target.value})} /></div>
            </div>

            {/* AUTO CALC TOGGLE + LIVE PREVIEW */}
            <div style={{ background:"rgba(124,58,237,0.08)", border:"1px solid rgba(167,139,250,0.25)", borderRadius:14, padding:14, marginBottom:14 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:autoCalc||liveCalc?10:0 }}>
                <div>
                  <div style={{ fontFamily:"Orbitron,sans-serif", fontSize:12, fontWeight:700, color:C.text }}>⚡ অটো প্রাইজ ক্যালকুলেশন</div>
                  <div style={{ fontSize:10, color:C.textFaint, marginTop:2 }}>এন্ট্রি + প্লেয়ার সংখ্যা দিলেই অটো হিসাব</div>
                </div>
                <button onClick={()=>setAutoCalc(!autoCalc)} style={{ width:48, height:26, borderRadius:20, border:"none", cursor:"pointer", background:autoCalc?C.primary:C.surface2, position:"relative", flexShrink:0 }}>
                  <div style={{ position:"absolute", top:3, left:autoCalc?25:3, width:20, height:20, borderRadius:"50%", background:"#fff", transition:"all 0.2s" }}></div>
                </button>
              </div>
              {liveCalc && (
                <div style={{ display:"flex", gap:8, marginTop:10 }}>
                  <div style={{ flex:1, background:"rgba(255,255,255,0.04)", borderRadius:10, padding:"8px 6px", textAlign:"center" }}>
                    <div style={{ fontFamily:"Orbitron,sans-serif", fontSize:13, fontWeight:800, color:C.blue }}>৳{liveCalc.total}</div>
                    <div style={{ fontSize:9, color:C.textFaint, marginTop:2 }}>মোট কালেকশন</div>
                  </div>
                  <div style={{ flex:1, background:"rgba(255,255,255,0.04)", borderRadius:10, padding:"8px 6px", textAlign:"center" }}>
                    <div style={{ fontFamily:"Orbitron,sans-serif", fontSize:13, fontWeight:800, color:C.amber }}>৳{liveCalc.pool}</div>
                    <div style={{ fontSize:9, color:C.textFaint, marginTop:2 }}>প্রাইজ পুল</div>
                  </div>
                  <div style={{ flex:1, background:"rgba(255,255,255,0.04)", borderRadius:10, padding:"8px 6px", textAlign:"center" }}>
                    <div style={{ fontFamily:"Orbitron,sans-serif", fontSize:13, fontWeight:800, color:C.green }}>৳{liveCalc.total-liveCalc.pool}</div>
                    <div style={{ fontSize:9, color:C.textFaint, marginTop:2 }}>আপনার লাভ</div>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
              <label style={{ ...label, marginBottom:0 }}>পুরস্কার তালিকা {autoCalc&&<span style={{ fontSize:9, color:C.primary }}>(অটো)</span>}</label>
            </div>
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

            <label style={label}>🔴 Live Stream URL (ঐচ্ছিক — YouTube লিংক)</label>
            <input style={{ ...input, marginBottom:14 }} value={form.streamUrl} onChange={e=>setForm({...form,streamUrl:e.target.value})} placeholder="https://youtube.com/watch?v=..." />

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

      {/* PARTICIPANT MODAL */}
      {partModal && (
        <div onClick={()=>{setPartModal(null);setViewSlot(null);}} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", backdropFilter:"blur(8px)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div onClick={e=>e.stopPropagation()} style={{ ...card, width:"100%", maxWidth:440, maxHeight:"85vh", overflowY:"auto" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
              <div style={{ fontFamily:"Orbitron,sans-serif", fontSize:14, fontWeight:700, color:C.text }}>📍 স্লট ভিউ</div>
              <button onClick={()=>{setPartModal(null);setViewSlot(null);}} style={{ background:C.surface2, border:"none", borderRadius:8, width:30, height:30, color:C.textDim, cursor:"pointer" }}>✕</button>
            </div>
            {(() => {
              const pm = matches.find(x=>x.id===partModal.id) || partModal;
              const ts = pm.teamSize || 1;
              const filled = pm.participants?.length || 0;
              const totalSlots = Math.ceil((pm.maxPlayers||48)/ts);
              return (
                <>
                  <div style={{ fontSize:12, color:C.textFaint, marginBottom:14 }}>{pm.title} · {filled}/{totalSlots} স্লট পূর্ণ · {pm.format||"Solo"}</div>
                  <SlotGrid participants={pm.participants||[]} teamSize={ts} maxPlayers={pm.maxPlayers||48} selectedSlot={viewSlot} onSlotClick={(slot,occ)=>setViewSlot(viewSlot===slot?null:slot)} />

                  {/* Selected slot details */}
                  {viewSlot && (() => {
                    const occ = (pm.participants||[]).find(p=>p.slot===viewSlot);
                    const idx = (pm.participants||[]).findIndex(p=>p.slot===viewSlot);
                    if (!occ) return (
                      <div style={{ marginTop:14, background:C.surface2, borderRadius:12, padding:16, textAlign:"center", color:C.textFaint, fontSize:13 }}>
                        স্লট #{viewSlot} খালি
                      </div>
                    );
                    return (
                      <div style={{ marginTop:14, background:"rgba(124,58,237,0.08)", border:"1px solid rgba(167,139,250,0.25)", borderRadius:12, padding:16 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                          <span style={{ fontFamily:"Orbitron,sans-serif", fontSize:13, fontWeight:700, color:C.primary }}>📍 স্লট #{viewSlot}</span>
                          <button onClick={()=>{ removeParticipant(pm, idx); setViewSlot(null); }} style={{ ...btn("red"), padding:"5px 12px", fontSize:11 }}>❌ বাদ দিন</button>
                        </div>
                        {occ.teamName && <div style={{ fontFamily:"Orbitron,sans-serif", fontSize:13, fontWeight:700, color:C.text, marginBottom:8 }}>🛡️ {occ.teamName}</div>}
                        {occ.players ? occ.players.map((pl,pi)=>(
                          <div key={pi} style={{ display:"flex", alignItems:"center", gap:8, fontSize:13, color:C.text, padding:"4px 0" }}>
                            <span style={{ width:22, height:22, borderRadius:6, background:"rgba(124,58,237,0.2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11 }}>{pi+1}</span>
                            {pl.name}
                          </div>
                        )) : (
                          <div style={{ fontSize:14, color:C.text }}>👤 {occ.name||occ.inGameName}</div>
                        )}
                        <div style={{ fontSize:10, color:C.textFaint, marginTop:8 }}>যোগ দিয়েছে: {occ.joinedAt?new Date(occ.joinedAt).toLocaleString("bn-BD"):"—"}</div>
                      </div>
                    );
                  })()}

                  {filled===0 && <div style={{ textAlign:"center", padding:20, color:C.textFaint, fontSize:13, marginTop:10 }}>এখনো কেউ যোগ দেয়নি</div>}
                </>
              );
            })()}
            <button onClick={()=>{setPartModal(null);setViewSlot(null);}} style={{ ...btn("ghost"), width:"100%", marginTop:14 }}>বন্ধ করুন</button>
          </div>
        </div>
      )}
    </div>
  );
}
