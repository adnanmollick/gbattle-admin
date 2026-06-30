import { useState, useEffect } from "react";
import { db } from "../../firebase/config";
import { doc, onSnapshot, setDoc, collection, addDoc, deleteDoc, updateDoc } from "firebase/firestore";
import { C, card, input, label, btn, badge, compressImg } from "../../utils/ui";

export default function ContentTab() {
  const [section, setSection] = useState("banners");

  const SECTIONS = [
    { id: "banners", icon: "🖼️", label: "ব্যানার" },
    { id: "scroll", icon: "📢", label: "স্ক্রল টেক্সট" },
    { id: "topbar", icon: "🔗", label: "টপবার লিংক" },
    { id: "rules", icon: "📋", label: "নিয়মাবলী" },
    { id: "categories", icon: "🗂️", label: "ক্যাটাগরি" },
  ];

  return (
    <div>
      <div style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 18, scrollbarWidth: "none" }}>
        {SECTIONS.map(s => (
          <button key={s.id} onClick={() => setSection(s.id)} style={{ ...btn(section === s.id ? "primary" : "ghost"), whiteSpace: "nowrap", flexShrink: 0 }}>
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      {section === "banners" && <BannersSection />}
      {section === "scroll" && <ScrollSection />}
      {section === "topbar" && <TopbarSection />}
      {section === "rules" && <RulesSection />}
      {section === "categories" && <CategoriesSection />}
    </div>
  );
}

// ============ BANNERS ============
function BannersSection() {
  const [banners, setBanners] = useState([]);
  const [title, setTitle] = useState("");
  const [sub, setSub] = useState("");
  const [link, setLink] = useState("");
  const [image, setImage] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "app"), (snap) => {
      if (snap.exists()) setBanners(snap.data().banners || []);
    });
    return unsub;
  }, []);

  const pickImage = async (e) => {
    const f = e.target.files[0];
    if (f) { try { setImage(await compressImg(f, 900, 0.72)); } catch { setMsg("ছবি প্রসেস ব্যর্থ"); } }
  };

  const addBanner = async () => {
    if (!image && !title) { setMsg("ছবি অথবা টাইটেল দিন"); return; }
    setSaving(true);
    try {
      const newBanner = { title, sub, link, image, createdAt: new Date().toISOString() };
      await setDoc(doc(db, "settings", "app"), { banners: [...banners, newBanner] }, { merge: true });
      setTitle(""); setSub(""); setLink(""); setImage("");
      setMsg("✅ ব্যানার যোগ হয়েছে");
      setTimeout(() => setMsg(""), 2500);
    } catch (e) { setMsg("সমস্যা: " + e.message); }
    setSaving(false);
  };

  const removeBanner = async (idx) => {
    const updated = banners.filter((_, i) => i !== idx);
    await setDoc(doc(db, "settings", "app"), { banners: updated }, { merge: true });
  };

  return (
    <div>
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ fontFamily: "Orbitron,sans-serif", fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 14 }}>➕ নতুন ব্যানার</div>

        <label style={label}>ব্যানার ছবি (recommended)</label>
        <label style={{ display: "block", marginBottom: 14, cursor: "pointer" }}>
          <div style={{ height: image ? 140 : 90, borderRadius: 12, border: `1.5px dashed ${C.border}`, background: image ? `url(${image}) center/cover` : C.surface2, display: "flex", alignItems: "center", justifyContent: "center", color: C.textFaint, fontSize: 13 }}>
            {!image && "📷 ছবি আপলোড করুন"}
          </div>
          <input type="file" accept="image/*" onChange={pickImage} style={{ display: "none" }} />
        </label>

        <label style={label}>টাইটেল</label>
        <input style={{ ...input, marginBottom: 12 }} value={title} onChange={e => setTitle(e.target.value)} placeholder="ব্যানার টাইটেল" />
        <label style={label}>সাব-টাইটেল</label>
        <input style={{ ...input, marginBottom: 12 }} value={sub} onChange={e => setSub(e.target.value)} placeholder="ছোট বর্ণনা" />
        <label style={label}>লিংক (ক্লিক করলে যেখানে যাবে)</label>
        <input style={{ ...input, marginBottom: 14 }} value={link} onChange={e => setLink(e.target.value)} placeholder="https://..." />

        {msg && <div style={{ background: msg.startsWith("✅") ? C.greenBg : C.redBg, color: msg.startsWith("✅") ? C.green : C.red, borderRadius: 8, padding: "9px 12px", fontSize: 12, marginBottom: 12, textAlign: "center" }}>{msg}</div>}
        <button onClick={addBanner} disabled={saving} style={{ ...btn("primary"), width: "100%", opacity: saving ? 0.7 : 1 }}>{saving ? "যোগ হচ্ছে..." : "ব্যানার যোগ করুন"}</button>
      </div>

      <div style={{ fontFamily: "Orbitron,sans-serif", fontSize: 12, fontWeight: 700, color: C.textDim, marginBottom: 12 }}>বর্তমান ব্যানার ({banners.length})</div>
      {banners.map((b, i) => (
        <div key={i} style={{ ...card, marginBottom: 10, padding: 0, overflow: "hidden", display: "flex", alignItems: "center" }}>
          <div style={{ width: 80, height: 70, background: b.image ? `url(${b.image}) center/cover` : C.grad, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{!b.image && "🖼️"}</div>
          <div style={{ flex: 1, padding: "10px 14px", minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{b.title || "(টাইটেল নেই)"}</div>
            <div style={{ fontSize: 11, color: C.textFaint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.link || b.sub || "—"}</div>
          </div>
          <button onClick={() => removeBanner(i)} style={{ ...btn("red"), margin: "0 12px", padding: "8px 12px" }}>🗑</button>
        </div>
      ))}
    </div>
  );
}

// ============ SCROLL TEXT ============
function ScrollSection() {
  const [text, setText] = useState("");
  const [active, setActive] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "app"), (snap) => {
      if (snap.exists()) { setText(snap.data().scrollText || ""); setActive(snap.data().scrollActive || false); }
    });
    return unsub;
  }, []);

  const save = async () => {
    await setDoc(doc(db, "settings", "app"), { scrollText: text, scrollActive: active }, { merge: true });
    setMsg("✅ সেভ হয়েছে"); setTimeout(() => setMsg(""), 2500);
  };

  return (
    <div style={card}>
      <div style={{ fontFamily: "Orbitron,sans-serif", fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 14 }}>📢 চলমান নিউজ টেক্সট</div>
      <label style={label}>টেক্সট</label>
      <textarea style={{ ...input, minHeight: 70, resize: "vertical", marginBottom: 14 }} value={text} onChange={e => setText(e.target.value)} placeholder="হোম পেজে চলমান নিউজ..." />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <button onClick={() => setActive(!active)} style={{ width: 48, height: 26, borderRadius: 20, border: "none", cursor: "pointer", background: active ? C.green : C.surface2, position: "relative", transition: "all 0.2s" }}>
          <div style={{ position: "absolute", top: 3, left: active ? 25 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "all 0.2s" }}></div>
        </button>
        <span style={{ fontSize: 13, color: C.textDim }}>{active ? "চালু আছে" : "বন্ধ আছে"}</span>
      </div>
      {msg && <div style={{ background: C.greenBg, color: C.green, borderRadius: 8, padding: "9px 12px", fontSize: 12, marginBottom: 12, textAlign: "center" }}>{msg}</div>}
      <button onClick={save} style={{ ...btn("primary"), width: "100%" }}>সেভ করুন</button>
    </div>
  );
}

// ============ TOPBAR LINK ============
function TopbarSection() {
  const [link, setLink] = useState("");
  const [labelText, setLabelText] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "app"), (snap) => {
      if (snap.exists()) { setLink(snap.data().topbarLink || ""); setLabelText(snap.data().topbarLinkLabel || ""); }
    });
    return unsub;
  }, []);

  const save = async () => {
    await setDoc(doc(db, "settings", "app"), { topbarLink: link, topbarLinkLabel: labelText }, { merge: true });
    setMsg("✅ সেভ হয়েছে"); setTimeout(() => setMsg(""), 2500);
  };

  return (
    <div style={card}>
      <div style={{ fontFamily: "Orbitron,sans-serif", fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 14 }}>🔗 টপবার লিংক বাটন</div>
      <div style={{ fontSize: 12, color: C.textFaint, marginBottom: 14, lineHeight: 1.6 }}>ইউজার প্যানেলের উপরে একটি বাটন দেখাবে। ক্লিক করলে এই লিংকে যাবে।</div>
      <label style={label}>বাটন টেক্সট</label>
      <input style={{ ...input, marginBottom: 12 }} value={labelText} onChange={e => setLabelText(e.target.value)} placeholder="🎁 অফার / 📺 লাইভ" />
      <label style={label}>লিংক URL</label>
      <input style={{ ...input, marginBottom: 14 }} value={link} onChange={e => setLink(e.target.value)} placeholder="https://..." />
      {msg && <div style={{ background: C.greenBg, color: C.green, borderRadius: 8, padding: "9px 12px", fontSize: 12, marginBottom: 12, textAlign: "center" }}>{msg}</div>}
      <button onClick={save} style={{ ...btn("primary"), width: "100%" }}>সেভ করুন</button>
      {(link || labelText) && <button onClick={() => { setLink(""); setLabelText(""); }} style={{ ...btn("ghost"), width: "100%", marginTop: 8 }}>মুছে ফেলুন</button>}
    </div>
  );
}

// ============ RULES ============
function RulesSection() {
  const [rules, setRules] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "app"), (snap) => {
      if (snap.exists()) setRules(snap.data().rules || "");
    });
    return unsub;
  }, []);

  const save = async () => {
    await setDoc(doc(db, "settings", "app"), { rules }, { merge: true });
    setMsg("✅ সেভ হয়েছে"); setTimeout(() => setMsg(""), 2500);
  };

  return (
    <div style={card}>
      <div style={{ fontFamily: "Orbitron,sans-serif", fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 14 }}>📋 নিয়মাবলী</div>
      <div style={{ fontSize: 12, color: C.textFaint, marginBottom: 14 }}>ইউজার প্যানেলের প্রোফাইল সেকশনে দেখাবে।</div>
      <textarea style={{ ...input, minHeight: 200, resize: "vertical", marginBottom: 14, lineHeight: 1.7 }} value={rules} onChange={e => setRules(e.target.value)} placeholder={"১. প্রতিটি ম্যাচে সময়মতো যোগ দিন\n২. হ্যাকিং নিষিদ্ধ\n৩. ..."} />
      {msg && <div style={{ background: C.greenBg, color: C.green, borderRadius: 8, padding: "9px 12px", fontSize: 12, marginBottom: 12, textAlign: "center" }}>{msg}</div>}
      <button onClick={save} style={{ ...btn("primary"), width: "100%" }}>সেভ করুন</button>
    </div>
  );
}

// ============ CATEGORIES ============
function CategoriesSection() {
  const [cats, setCats] = useState([]);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");
  const [thumbnail, setThumbnail] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "categories"), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (a.order || 0) - (b.order || 0));
      setCats(list);
    });
    return unsub;
  }, []);

  const pickThumb = async (e) => {
    const f = e.target.files[0];
    if (f) { try { setThumbnail(await compressImg(f, 500, 0.72)); } catch { setMsg("ছবি ব্যর্থ"); } }
  };

  const addCat = async () => {
    if (!name.trim()) { setMsg("নাম দিন"); return; }
    setSaving(true);
    try {
      await addDoc(collection(db, "categories"), {
        name: name.trim(), emoji: emoji || "🎮", thumbnail,
        visible: true, order: cats.length, createdAt: new Date().toISOString(),
      });
      setName(""); setEmoji(""); setThumbnail("");
      setMsg("✅ ক্যাটাগরি যোগ হয়েছে"); setTimeout(() => setMsg(""), 2500);
    } catch (e) { setMsg("সমস্যা: " + e.message); }
    setSaving(false);
  };

  const toggleVisible = async (cat) => {
    await updateDoc(doc(db, "categories", cat.id), { visible: !cat.visible });
  };

  const removeCat = async (id) => {
    await deleteDoc(doc(db, "categories", id));
  };

  return (
    <div>
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ fontFamily: "Orbitron,sans-serif", fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 14 }}>➕ নতুন ক্যাটাগরি</div>
        <label style={label}>থাম্বনেইল ছবি</label>
        <label style={{ display: "block", marginBottom: 14, cursor: "pointer" }}>
          <div style={{ height: thumbnail ? 110 : 70, borderRadius: 12, border: `1.5px dashed ${C.border}`, background: thumbnail ? `url(${thumbnail}) center/cover` : C.surface2, display: "flex", alignItems: "center", justifyContent: "center", color: C.textFaint, fontSize: 12 }}>
            {!thumbnail && "📷 আপলোড"}
          </div>
          <input type="file" accept="image/*" onChange={pickThumb} style={{ display: "none" }} />
        </label>
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 3 }}>
            <label style={label}>নাম</label>
            <input style={input} value={name} onChange={e => setName(e.target.value)} placeholder="BR MATCH" />
          </div>
          <div style={{ flex: 1 }}>
            <label style={label}>ইমোজি</label>
            <input style={input} value={emoji} onChange={e => setEmoji(e.target.value)} placeholder="🔫" />
          </div>
        </div>
        {msg && <div style={{ background: msg.startsWith("✅") ? C.greenBg : C.redBg, color: msg.startsWith("✅") ? C.green : C.red, borderRadius: 8, padding: "9px 12px", fontSize: 12, marginBottom: 12, textAlign: "center" }}>{msg}</div>}
        <button onClick={addCat} disabled={saving} style={{ ...btn("primary"), width: "100%", opacity: saving ? 0.7 : 1 }}>{saving ? "যোগ হচ্ছে..." : "ক্যাটাগরি যোগ করুন"}</button>
      </div>

      <div style={{ fontFamily: "Orbitron,sans-serif", fontSize: 12, fontWeight: 700, color: C.textDim, marginBottom: 12 }}>ক্যাটাগরি সমূহ ({cats.length})</div>
      {cats.map((c) => (
        <div key={c.id} style={{ ...card, marginBottom: 10, padding: 0, overflow: "hidden", display: "flex", alignItems: "center", opacity: c.visible ? 1 : 0.5 }}>
          <div style={{ width: 64, height: 60, background: c.thumbnail ? `url(${c.thumbnail}) center/cover` : C.grad, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{!c.thumbnail && (c.emoji || "🎮")}</div>
          <div style={{ flex: 1, padding: "10px 14px" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{c.emoji} {c.name}</div>
            <div style={{ fontSize: 11, color: c.visible ? C.green : C.textFaint }}>{c.visible ? "👁 দৃশ্যমান" : "🚫 লুকানো"}</div>
          </div>
          <button onClick={() => toggleVisible(c)} style={{ ...btn("ghost"), margin: "0 6px", padding: "8px 12px" }}>{c.visible ? "🙈" : "👁"}</button>
          <button onClick={() => removeCat(c.id)} style={{ ...btn("red"), marginRight: 12, padding: "8px 12px" }}>🗑</button>
        </div>
      ))}
    </div>
  );
}
