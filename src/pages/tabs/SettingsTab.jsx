import { useState, useEffect } from "react";
import { db } from "../../firebase/config";
import { collection, onSnapshot, query, where, getDocs, deleteDoc, doc } from "firebase/firestore";
import { doc as fdoc, onSnapshot as fsnap, setDoc } from "firebase/firestore";
import { C, card, input, label, btn } from "../../utils/ui";

export default function SettingsTab() {
  const [settings, setSettings] = useState({
    appName:"G-BATTLE", bkashNumber:"", autoVerify:true,
    nagadEnabled:false, nagadNumber:"", nagadAutoVerify:false,
    rocketEnabled:false, rocketNumber:"", rocketAutoVerify:false,
    notice:"", noticeActive:false, resultAutoDelete:false,
    profitPercent:20,
    seoTitle:"", seoDescription:"", seoKeywords:"", seoImage:"",
    support:{ facebook:"", whatsapp:"", telegram:"", youtube:"", phone:"" },
  });
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = fsnap(fdoc(db,"settings","app"), snap=>{
      if(snap.exists()) setSettings(prev=>({ ...prev,...snap.data(),support:{ ...prev.support,...(snap.data().support||{}) } }));
    });
    return unsub;
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await setDoc(fdoc(db,"settings","app"), {
        appName:settings.appName, bkashNumber:settings.bkashNumber,
        autoVerify:settings.autoVerify, notice:settings.notice,
        nagadEnabled:settings.nagadEnabled, nagadNumber:settings.nagadNumber, nagadAutoVerify:settings.nagadAutoVerify,
        rocketEnabled:settings.rocketEnabled, rocketNumber:settings.rocketNumber, rocketAutoVerify:settings.rocketAutoVerify,
        noticeActive:settings.noticeActive, resultAutoDelete:settings.resultAutoDelete,
        seoTitle:settings.seoTitle, seoDescription:settings.seoDescription,
        seoKeywords:settings.seoKeywords, seoImage:settings.seoImage,
        support:settings.support,
      },{ merge:true });
      setMsg("✅ সেটিংস সেভ হয়েছে"); setTimeout(()=>setMsg(""),2500);
    } catch(e){ setMsg("সমস্যা: "+e.message); }
    setSaving(false);
  };

  const cleanOldResults = async () => {
    if(!settings.resultAutoDelete) return;
    const snap = await getDocs(collection(db,"results"));
    const now = new Date();
    let count=0;
    for(const d of snap.docs){
      const data=d.data();
      if(data.autoDeleteAt&&new Date(data.autoDeleteAt)<=now){
        await deleteDoc(doc(db,"results",d.id));
        count++;
      }
    }
    setMsg(`✅ ${count}টি পুরনো ফলাফল ডিলিট হয়েছে`);
    setTimeout(()=>setMsg(""),3000);
  };

  const upS = (k,v) => setSettings(s=>({ ...s,support:{ ...s.support,[k]:v } }));

  return (
    <div>
      {msg&&<div style={{ background:msg.startsWith("✅")?C.greenBg:C.redBg, color:msg.startsWith("✅")?C.green:C.red, borderRadius:10, padding:"11px 14px", fontSize:13, marginBottom:14, textAlign:"center" }}>{msg}</div>}

      {/* GENERAL */}
      <div style={{ ...card, marginBottom:16 }}>
        <div style={{ fontFamily:"Orbitron,sans-serif", fontSize:13, fontWeight:700, color:C.text, marginBottom:14 }}>⚙️ সাধারণ</div>
        <label style={label}>অ্যাপের নাম</label>
        <input style={{ ...input, marginBottom:12 }} value={settings.appName} onChange={e=>setSettings({...settings,appName:e.target.value})} />
        <label style={label}>নোটিশ</label>
        <input style={{ ...input, marginBottom:10 }} value={settings.notice} onChange={e=>setSettings({...settings,notice:e.target.value})} placeholder="ঘোষণা..." />
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <button onClick={()=>setSettings({...settings,noticeActive:!settings.noticeActive})} style={{ width:48,height:26,borderRadius:20,border:"none",cursor:"pointer",background:settings.noticeActive?C.green:C.surface2,position:"relative" }}>
            <div style={{ position:"absolute",top:3,left:settings.noticeActive?25:3,width:20,height:20,borderRadius:"50%",background:"#fff",transition:"all 0.2s" }}></div>
          </button>
          <span style={{ fontSize:13, color:C.textDim }}>নোটিশ চালু</span>
        </div>
      </div>

      {/* BKASH */}
      <div style={{ ...card, marginBottom:16 }}>
        <div style={{ fontFamily:"Orbitron,sans-serif", fontSize:13, fontWeight:700, color:C.text, marginBottom:14 }}>💳 bKash</div>
        <label style={label}>bKash নম্বর</label>
        <input style={{ ...input, marginBottom:12 }} value={settings.bkashNumber} onChange={e=>setSettings({...settings,bkashNumber:e.target.value})} placeholder="01XXXXXXXXX" />
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <button onClick={()=>setSettings({...settings,autoVerify:!settings.autoVerify})} style={{ width:48,height:26,borderRadius:20,border:"none",cursor:"pointer",background:settings.autoVerify?C.green:C.surface2,position:"relative" }}>
            <div style={{ position:"absolute",top:3,left:settings.autoVerify?25:3,width:20,height:20,borderRadius:"50%",background:"#fff",transition:"all 0.2s" }}></div>
          </button>
          <span style={{ fontSize:13, color:C.textDim }}>অটো ভেরিফাই</span>
        </div>
      </div>

      {/* NAGAD */}
      <div style={{ ...card, marginBottom:16, opacity:settings.nagadEnabled?1:0.7 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <div style={{ fontFamily:"Orbitron,sans-serif", fontSize:13, fontWeight:700, color:"#ec4899" }}>📱 নগদ (Nagad)</div>
          <button onClick={()=>setSettings({...settings,nagadEnabled:!settings.nagadEnabled})} style={{ width:48,height:26,borderRadius:20,border:"none",cursor:"pointer",background:settings.nagadEnabled?"#ec4899":C.surface2,position:"relative" }}>
            <div style={{ position:"absolute",top:3,left:settings.nagadEnabled?25:3,width:20,height:20,borderRadius:"50%",background:"#fff",transition:"all 0.2s" }}></div>
          </button>
        </div>
        {settings.nagadEnabled && (
          <>
            <label style={label}>নগদ নম্বর</label>
            <input style={{ ...input, marginBottom:12 }} value={settings.nagadNumber} onChange={e=>setSettings({...settings,nagadNumber:e.target.value})} placeholder="01XXXXXXXXX" />
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <button onClick={()=>setSettings({...settings,nagadAutoVerify:!settings.nagadAutoVerify})} style={{ width:48,height:26,borderRadius:20,border:"none",cursor:"pointer",background:settings.nagadAutoVerify?C.green:C.surface2,position:"relative" }}>
                <div style={{ position:"absolute",top:3,left:settings.nagadAutoVerify?25:3,width:20,height:20,borderRadius:"50%",background:"#fff",transition:"all 0.2s" }}></div>
              </button>
              <span style={{ fontSize:13, color:C.textDim }}>অটো ভেরিফাই (SMS অ্যাপ)</span>
            </div>
          </>
        )}
        {!settings.nagadEnabled && <div style={{ fontSize:11, color:C.textFaint }}>বন্ধ — ইউজার দেখবে না</div>}
      </div>

      {/* ROCKET */}
      <div style={{ ...card, marginBottom:16, opacity:settings.rocketEnabled?1:0.7 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <div style={{ fontFamily:"Orbitron,sans-serif", fontSize:13, fontWeight:700, color:"#8b5cf6" }}>🚀 রকেট (Rocket)</div>
          <button onClick={()=>setSettings({...settings,rocketEnabled:!settings.rocketEnabled})} style={{ width:48,height:26,borderRadius:20,border:"none",cursor:"pointer",background:settings.rocketEnabled?"#8b5cf6":C.surface2,position:"relative" }}>
            <div style={{ position:"absolute",top:3,left:settings.rocketEnabled?25:3,width:20,height:20,borderRadius:"50%",background:"#fff",transition:"all 0.2s" }}></div>
          </button>
        </div>
        {settings.rocketEnabled && (
          <>
            <label style={label}>রকেট নম্বর</label>
            <input style={{ ...input, marginBottom:12 }} value={settings.rocketNumber} onChange={e=>setSettings({...settings,rocketNumber:e.target.value})} placeholder="01XXXXXXXXX" />
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <button onClick={()=>setSettings({...settings,rocketAutoVerify:!settings.rocketAutoVerify})} style={{ width:48,height:26,borderRadius:20,border:"none",cursor:"pointer",background:settings.rocketAutoVerify?C.green:C.surface2,position:"relative" }}>
                <div style={{ position:"absolute",top:3,left:settings.rocketAutoVerify?25:3,width:20,height:20,borderRadius:"50%",background:"#fff",transition:"all 0.2s" }}></div>
              </button>
              <span style={{ fontSize:13, color:C.textDim }}>অটো ভেরিফাই (SMS অ্যাপ)</span>
            </div>
          </>
        )}
        {!settings.rocketEnabled && <div style={{ fontSize:11, color:C.textFaint }}>বন্ধ — ইউজার দেখবে না</div>}
      </div>

      {/* AUTO DELETE */}
      <div style={{ ...card, marginBottom:16 }}>
        <div style={{ fontFamily:"Orbitron,sans-serif", fontSize:13, fontWeight:700, color:C.text, marginBottom:14 }}>🗑 ফলাফল অটো ডিলিট</div>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
          <button onClick={()=>setSettings({...settings,resultAutoDelete:!settings.resultAutoDelete})} style={{ width:48,height:26,borderRadius:20,border:"none",cursor:"pointer",background:settings.resultAutoDelete?C.green:C.surface2,position:"relative" }}>
            <div style={{ position:"absolute",top:3,left:settings.resultAutoDelete?25:3,width:20,height:20,borderRadius:"50%",background:"#fff",transition:"all 0.2s" }}></div>
          </button>
          <span style={{ fontSize:13, color:C.textDim }}>৩ দিন পর অটো ডিলিট</span>
        </div>
        <div style={{ fontSize:11, color:C.textFaint, marginBottom:10 }}>লিডারবোর্ড ডাটা ডিলিট হবে না। এখনই পুরনো ফলাফল ডিলিট করতে:</div>
        <button onClick={cleanOldResults} style={{ ...btn("ghost"), width:"100%" }}>🗑 এখনই পুরনো ফলাফল ডিলিট করুন</button>
      </div>

      {/* SEO */}
      <div style={{ ...card, marginBottom:16 }}>
        <div style={{ fontFamily:"Orbitron,sans-serif", fontSize:13, fontWeight:700, color:C.text, marginBottom:6 }}>🔍 SEO সেটিংস</div>
        <div style={{ fontSize:11, color:C.textFaint, marginBottom:14, lineHeight:1.6 }}>Google সার্চ ও সোশ্যাল মিডিয়া শেয়ারের জন্য। ভালো কীওয়ার্ড দিলে সার্চে উপরে আসতে সাহায্য করবে।</div>
        <label style={label}>সাইট টাইটেল</label>
        <input style={{ ...input, marginBottom:12 }} value={settings.seoTitle} onChange={e=>setSettings({...settings,seoTitle:e.target.value})} placeholder="G-BATTLE — Free Fire Tournament BD" />
        <label style={label}>বর্ণনা (Description)</label>
        <textarea style={{ ...input, minHeight:60, resize:"vertical", marginBottom:12 }} value={settings.seoDescription} onChange={e=>setSettings({...settings,seoDescription:e.target.value})} placeholder="বাংলাদেশের সেরা Free Fire টুর্নামেন্ট..." />
        <label style={label}>কীওয়ার্ড (কমা দিয়ে আলাদা করুন)</label>
        <input style={{ ...input, marginBottom:12 }} value={settings.seoKeywords} onChange={e=>setSettings({...settings,seoKeywords:e.target.value})} placeholder="free fire, tournament, ফ্রি ফায়ার, gbattle" />
        <label style={label}>শেয়ার ছবি URL (OG Image)</label>
        <input style={input} value={settings.seoImage} onChange={e=>setSettings({...settings,seoImage:e.target.value})} placeholder="https://gbattle.shop/og-image.jpg" />
      </div>

      {/* SUPPORT */}
      <div style={{ ...card, marginBottom:16 }}>
        <div style={{ fontFamily:"Orbitron,sans-serif", fontSize:13, fontWeight:700, color:C.text, marginBottom:14 }}>🎧 সাপোর্ট লিংক</div>
        {[["facebook","📘 Facebook","https://facebook.com/..."],["whatsapp","💬 WhatsApp","https://wa.me/880..."],["telegram","✈️ Telegram","https://t.me/..."],["youtube","▶️ YouTube","https://youtube.com/..."],["phone","📞 ফোন","01XXXXXXXXX"]].map(([k,l,ph])=>(
          <div key={k} style={{ marginBottom:10 }}>
            <label style={label}>{l}</label>
            <input style={input} value={settings.support[k]||""} onChange={e=>upS(k,e.target.value)} placeholder={ph} />
          </div>
        ))}
      </div>

      <button onClick={save} disabled={saving} style={{ ...btn("primary"), width:"100%", padding:14, opacity:saving?0.7:1 }}>{saving?"সেভ হচ্ছে...":"💾 সব সেটিংস সেভ করুন"}</button>
    </div>
  );
}
