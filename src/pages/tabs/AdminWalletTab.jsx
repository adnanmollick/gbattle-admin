import { useState, useEffect } from "react";
import { db } from "../../firebase/config";
import { collection, query, where, onSnapshot, addDoc, doc, getDoc } from "firebase/firestore";
import { C, card, input, label, btn, fmt, sendMoneyCharge } from "../../utils/ui";
import { useAdminAuth } from "../../context/AdminAuthContext";

export default function AdminWalletTab() {
  const { adminData } = useAdminAuth();
  const [wallet, setWallet] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [amount, setAmount] = useState("");
  const [number, setNumber] = useState("");
  const [method, setMethod] = useState("bKash");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const uid = adminData?.uid;

  useEffect(() => {
    if (!uid) return;
    const unsubUser = onSnapshot(doc(db, "users", uid), snap => {
      if (snap.exists()) setWallet(snap.data().wallet || 0);
    });
    const unsubTx = onSnapshot(query(collection(db, "transactions"), where("uid", "==", uid)), snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setTransactions(all.filter(t => t.type === "commission" || t.type === "admin_withdraw"));
    });
    return () => { unsubUser(); unsubTx(); };
  }, [uid]);

  const charge = amount ? sendMoneyCharge(amount) : 0;
  const net = amount ? Math.max(0, Number(amount) - charge) : 0;

  const requestWithdraw = async () => {
    const amt = Number(amount);
    if (!amt || amt < 100) { setMsg("সর্বনিম্ন উত্তোলন ৳১০০"); return; }
    if (!number.trim()) { setMsg("নম্বর দিন"); return; }
    if (amt > wallet) { setMsg("পর্যাপ্ত কমিশন নেই"); return; }
    setLoading(true);
    try {
      await addDoc(collection(db, "transactions"), {
        uid, userName: adminData?.name || "Admin", type: "admin_withdraw",
        amount: amt, charge, net, method, accountNumber: number.trim(),
        status: "pending", isAdminWithdraw: true, createdAt: new Date().toISOString(),
      });
      setMsg("✅ উত্তোলন রিকোয়েস্ট পাঠানো হয়েছে");
      setAmount(""); setNumber("");
      setTimeout(() => setMsg(""), 3000);
    } catch (e) { setMsg("সমস্যা: " + e.message); }
    setLoading(false);
  };

  const statusLabel = (s) => ({ pending: "⏳ অপেক্ষমান", approved: "✅ টাকা পাঠানো হয়েছে", rejected: "❌ বাতিল" }[s] || s);
  const statusColor = (s) => ({ pending: C.amber, approved: C.green, rejected: C.red }[s] || C.textFaint);

  return (
    <div>
      {msg && <div style={{ background: msg.startsWith("✅") ? C.greenBg : C.redBg, color: msg.startsWith("✅") ? C.green : C.red, borderRadius: 10, padding: "11px 14px", fontSize: 13, marginBottom: 14, textAlign: "center" }}>{msg}</div>}

      {/* WALLET CARD */}
      <div style={{ ...card, marginBottom: 16, background: "linear-gradient(135deg,#065f46,#047857)", border: "none", textAlign: "center", padding: "24px 20px" }}>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", letterSpacing: 1, fontFamily: "Orbitron,sans-serif", marginBottom: 8 }}>আপনার জমা কমিশন</div>
        <div style={{ fontFamily: "Orbitron,sans-serif", fontSize: 34, fontWeight: 900, color: "#fff" }}>৳{fmt(wallet)}</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 4 }}>প্রতি ম্যাচ শেষে অটো জমা হয়</div>
      </div>

      {/* WITHDRAW FORM */}
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ fontFamily: "Orbitron,sans-serif", fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 14 }}>💸 কমিশন উত্তোলন</div>

        <label style={label}>মেথড</label>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {["bKash", "Nagad", "Rocket"].map(m => (
            <button key={m} onClick={() => setMethod(m)} style={{ ...btn(method === m ? "primary" : "ghost"), flex: 1, padding: "10px 0", fontSize: 11 }}>{m}</button>
          ))}
        </div>

        <label style={label}>{method} নম্বর</label>
        <input style={input} value={number} onChange={e => setNumber(e.target.value)} placeholder="01XXXXXXXXX" type="tel" />

        <label style={label}>পরিমাণ (৳) — সর্বনিম্ন ১০০</label>
        <input style={input} value={amount} onChange={e => setAmount(e.target.value)} placeholder="1000" type="number" />

        {/* CHARGE PREVIEW */}
        {amount && Number(amount) >= 100 && (
          <div style={{ background: "rgba(251,146,60,0.08)", border: "1px solid rgba(251,146,60,0.2)", borderRadius: 12, padding: 14, marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: C.textDim }}>উত্তোলন</span>
              <span style={{ fontSize: 13, color: C.text, fontFamily: "Orbitron,sans-serif" }}>৳{fmt(amount)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: "#fb923c" }}>সেন্ড মানি চার্জ</span>
              <span style={{ fontSize: 13, color: "#fb923c", fontFamily: "Orbitron,sans-serif" }}>− ৳{charge}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 12, color: C.green, fontWeight: 600 }}>আপনি পাবেন</span>
              <span style={{ fontSize: 15, color: C.green, fontFamily: "Orbitron,sans-serif", fontWeight: 800 }}>৳{fmt(net)}</span>
            </div>
          </div>
        )}

        <button onClick={requestWithdraw} disabled={loading} style={{ ...btn("primary"), width: "100%", opacity: loading ? 0.7 : 1 }}>{loading ? "পাঠানো হচ্ছে..." : "উত্তোলন রিকোয়েস্ট"}</button>
      </div>

      {/* HISTORY */}
      <div style={{ fontFamily: "Orbitron,sans-serif", fontSize: 12, fontWeight: 700, color: C.textDim, marginBottom: 12 }}>লেনদেন ইতিহাস</div>
      {transactions.length === 0 ? (
        <div style={{ ...card, textAlign: "center", color: C.textFaint, fontSize: 12, padding: 20 }}>কোনো লেনদেন নেই</div>
      ) : transactions.map(tx => (
        <div key={tx.id} style={{ ...card, marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>{tx.type === "commission" ? "💰 কমিশন" : "💸 উত্তোলন"}{tx.matchTitle ? ` · ${tx.matchTitle}` : ""}</div>
            <div style={{ fontSize: 10, color: C.textFaint, marginTop: 2 }}>{new Date(tx.createdAt).toLocaleDateString("bn-BD")}{tx.type === "admin_withdraw" && tx.net ? ` · net ৳${fmt(tx.net)}` : ""}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "Orbitron,sans-serif", fontSize: 14, fontWeight: 700, color: tx.type === "commission" ? C.green : C.text }}>{tx.type === "commission" ? "+" : "−"}৳{fmt(tx.amount)}</div>
            {tx.type === "admin_withdraw" && <div style={{ fontSize: 10, color: statusColor(tx.status), fontWeight: 600 }}>{statusLabel(tx.status)}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
