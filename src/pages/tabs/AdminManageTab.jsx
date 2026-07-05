import { useState, useEffect } from "react";
import { db } from "../../firebase/config";
import { collection, onSnapshot, doc, updateDoc, getDocs, query, where } from "firebase/firestore";
import { C, card, input, label, btn, fmt } from "../../utils/ui";

const ALL_MODES = ["BR Match", "Clash Squad", "2V2", "Lone Wolf"];

export default function AdminManageTab() {
  const [admins, setAdmins] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [expanded, setExpanded] = useState(null);
  const [msg, setMsg] = useState("");
  const [searchQ, setSearchQ] = useState("");

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, "users"), snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllUsers(all);
      setAdmins(all.filter(u => u.role === "admin"));
    });
    const unsubMatches = onSnapshot(collection(db, "matches"), snap => {
      setMatches(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubTx = onSnapshot(collection(db, "transactions"), snap => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubUsers(); unsubMatches(); unsubTx(); };
  }, []);

  const showMsg = (m) => { setMsg(m); setTimeout(() => setMsg(""), 2500); };

  // Toggle a mode permission for an admin
  const toggleMode = async (adminId, mode) => {
    const admin = admins.find(a => a.id === adminId);
    const current = admin.allowedModes || ALL_MODES;
    const next = current.includes(mode) ? current.filter(m => m !== mode) : [...current, mode];
    await updateDoc(doc(db, "users", adminId), { allowedModes: next });
  };

  const setCommission = async (adminId, pct) => {
    await updateDoc(doc(db, "users", adminId), { commissionPercent: Number(pct) || 0 });
  };

  const toggleManualAdd = async (adminId) => {
    const admin = admins.find(a => a.id === adminId);
    await updateDoc(doc(db, "users", adminId), { manualAddEnabled: !(admin.manualAddEnabled !== false) });
  };

  const makeAdmin = async () => {
    const q = searchQ.toLowerCase().trim();
    if (!q) return;
    const found = allUsers.find(u => u.username === q || u.email?.toLowerCase() === q);
    if (!found) { showMsg("ইউজার পাওয়া যায়নি"); return; }
    if (found.role === "admin") { showMsg("ইতিমধ্যে এডমিন"); return; }
    await updateDoc(doc(db, "users", found.id), {
      role: "admin", allowedModes: ALL_MODES, commissionPercent: 20, manualAddEnabled: true,
    });
    showMsg(`✅ ${found.name} এখন এডমিন`);
    setSearchQ("");
  };

  const removeAdmin = async (adminId) => {
    if (!window.confirm("এই এডমিনকে সরিয়ে দেবেন?")) return;
    await updateDoc(doc(db, "users", adminId), { role: "user" });
  };

  // Monthly stats per admin
  const adminStats = (adminId) => {
    const myMatches = matches.filter(m => m.createdBy === adminId && (m.createdAt || "").startsWith(month));
    let totalProfit = 0;
    myMatches.forEach(m => {
      const collected = (Number(m.entryFee) || 0) * (m.participants?.length || 0);
      const prizesPaid = (m.prizes || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
      totalProfit += Math.max(0, collected - prizesPaid);
    });
    // Manual deposits approved by this admin
    const manualAdded = transactions
      .filter(t => t.type === "deposit" && t.status === "approved" && t.approvedBy === adminId && (t.createdAt || "").startsWith(month))
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);
    return { matchCount: myMatches.length, totalProfit, manualAdded };
  };

  return (
    <div>
      {msg && <div style={{ background: C.greenBg, color: C.green, borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 14, textAlign: "center" }}>{msg}</div>}

      {/* HEADER */}
      <div style={{ ...card, marginBottom: 16, background: "linear-gradient(135deg,rgba(124,58,237,0.15),rgba(167,139,250,0.05))", border: "1px solid rgba(167,139,250,0.3)" }}>
        <div style={{ fontFamily: "Orbitron,sans-serif", fontSize: 15, fontWeight: 800, color: "#fff", marginBottom: 4 }}>👑 এডমিন ম্যানেজমেন্ট</div>
        <div style={{ fontSize: 12, color: C.textFaint }}>সুপার এডমিন কন্ট্রোল — মোড অনুমতি, কমিশন, রিপোর্ট</div>
      </div>

      {/* ADD ADMIN */}
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ fontFamily: "Orbitron,sans-serif", fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 10 }}>➕ নতুন এডমিন বানান</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input style={{ ...input, flex: 1, marginBottom: 0 }} value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="ইউজারনেম বা ইমেইল" />
          <button onClick={makeAdmin} style={{ ...btn("primary"), padding: "10px 16px" }}>যোগ</button>
        </div>
      </div>

      {/* MONTH SELECTOR */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontFamily: "Orbitron,sans-serif", fontSize: 12, fontWeight: 700, color: C.textDim }}>এডমিন সমূহ ({admins.length})</div>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{ ...input, width: "auto", padding: "6px 10px", fontSize: 12, marginBottom: 0 }} />
      </div>

      {/* ADMIN LIST */}
      {admins.length === 0 ? (
        <div style={{ ...card, textAlign: "center", color: C.textFaint, fontSize: 13, padding: 24 }}>কোনো এডমিন নেই</div>
      ) : admins.map(admin => {
        const stats = adminStats(admin.id);
        const allowedModes = admin.allowedModes || ALL_MODES;
        const commission = admin.commissionPercent ?? 20;
        const manualOn = admin.manualAddEnabled !== false;
        const commissionEarned = Math.round(stats.totalProfit * commission / 100);
        const isOpen = expanded === admin.id;
        return (
          <div key={admin.id} style={{ ...card, marginBottom: 12, padding: 0, overflow: "hidden" }}>
            {/* SUMMARY ROW */}
            <div onClick={() => setExpanded(isOpen ? null : admin.id)} style={{ padding: 16, cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: admin.avatar ? "transparent" : "linear-gradient(135deg,#7c3aed,#a78bfa)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {admin.avatar ? <img src={admin.avatar} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 20 }}>👤</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{admin.name}</div>
                <div style={{ fontSize: 11, color: C.textFaint }}>@{admin.username} · {stats.matchCount} ম্যাচ · কমিশন {commission}%</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: "Orbitron,sans-serif", fontSize: 14, fontWeight: 700, color: C.green }}>৳{fmt(commissionEarned)}</div>
                <div style={{ fontSize: 10, color: C.textFaint }}>কমিশন</div>
              </div>
              <span style={{ color: C.textFaint, fontSize: 12 }}>{isOpen ? "▲" : "▼"}</span>
            </div>

            {/* EXPANDED CONTROLS */}
            {isOpen && (
              <div style={{ padding: "0 16px 16px", borderTop: `1px solid ${C.border}` }}>
                {/* STATS */}
                <div style={{ display: "flex", gap: 8, margin: "14px 0" }}>
                  <div style={{ flex: 1, background: C.surface2, borderRadius: 10, padding: "10px 6px", textAlign: "center" }}>
                    <div style={{ fontFamily: "Orbitron,sans-serif", fontSize: 14, fontWeight: 700, color: C.blue }}>{stats.matchCount}</div>
                    <div style={{ fontSize: 9, color: C.textFaint, marginTop: 2 }}>ম্যাচ</div>
                  </div>
                  <div style={{ flex: 1, background: C.surface2, borderRadius: 10, padding: "10px 6px", textAlign: "center" }}>
                    <div style={{ fontFamily: "Orbitron,sans-serif", fontSize: 14, fontWeight: 700, color: C.amber }}>৳{fmt(stats.totalProfit)}</div>
                    <div style={{ fontSize: 9, color: C.textFaint, marginTop: 2 }}>মোট লাভ</div>
                  </div>
                  <div style={{ flex: 1, background: C.surface2, borderRadius: 10, padding: "10px 6px", textAlign: "center" }}>
                    <div style={{ fontFamily: "Orbitron,sans-serif", fontSize: 14, fontWeight: 700, color: C.green }}>৳{fmt(stats.manualAdded)}</div>
                    <div style={{ fontSize: 9, color: C.textFaint, marginTop: 2 }}>ম্যানুয়াল অ্যাড</div>
                  </div>
                </div>

                {/* CURRENT WALLET (accumulated commission) */}
                <div style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: C.textDim }}>বর্তমান জমা কমিশন (ব্যালেন্স)</span>
                  <span style={{ fontFamily: "Orbitron,sans-serif", fontSize: 15, fontWeight: 800, color: C.green }}>৳{fmt(admin.wallet || 0)}</span>
                </div>

                {/* COMMISSION % */}
                <label style={label}>কমিশন % (লাভের কত %)</label>
                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  <input style={{ ...input, flex: 1, marginBottom: 0 }} type="number" defaultValue={commission} id={`comm-${admin.id}`} placeholder="20" />
                  <button onClick={() => setCommission(admin.id, document.getElementById(`comm-${admin.id}`).value)} style={{ ...btn("primary"), padding: "10px 16px" }}>সেট</button>
                </div>

                {/* MODE PERMISSIONS */}
                <label style={label}>অনুমোদিত মোড</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                  {ALL_MODES.map(mode => {
                    const on = allowedModes.includes(mode);
                    return (
                      <button key={mode} onClick={() => toggleMode(admin.id, mode)} style={{ ...btn(on ? "green" : "ghost"), padding: "7px 12px", fontSize: 10 }}>
                        {on ? "✓ " : ""}{mode}
                      </button>
                    );
                  })}
                </div>

                {/* MANUAL ADD TOGGLE */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: C.surface2, borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>ম্যানুয়াল টাকা অ্যাড</div>
                    <div style={{ fontSize: 10, color: C.textFaint, marginTop: 2 }}>ডিপোজিট approve করার অনুমতি</div>
                  </div>
                  <button onClick={() => toggleManualAdd(admin.id)} style={{ width: 48, height: 26, borderRadius: 20, cursor: "pointer", background: manualOn ? C.green : C.surface2, position: "relative", border: manualOn ? "none" : `1px solid ${C.border}` }}>
                    <div style={{ position: "absolute", top: 3, left: manualOn ? 25 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "all 0.2s" }}></div>
                  </button>
                </div>

                {/* REMOVE */}
                <button onClick={() => removeAdmin(admin.id)} style={{ ...btn("red"), width: "100%" }}>🗑 এডমিন সরান</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
