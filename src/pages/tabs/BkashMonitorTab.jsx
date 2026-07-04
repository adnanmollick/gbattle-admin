import { useState, useEffect } from "react";
import { db } from "../../firebase/config";
import { collection, onSnapshot, query } from "firebase/firestore";
import { C, card, badge, fmt } from "../../utils/ui";

export default function BkashMonitorTab() {
  const [smsList, setSmsList] = useState([]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "bkash_sms")), (snap) => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      all.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
      setSmsList(all);
    });
    return unsub;
  }, []);

  // Tick every 10s to re-evaluate connection status
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(t);
  }, []);

  // Connection = any SMS received in last 5 minutes
  const lastSms = smsList[0];
  const lastTime = lastSms ? new Date(lastSms.matchedAt || lastSms.timestamp || 0).getTime() : 0;
  const connected = lastTime && (now - lastTime) < 5 * 60 * 1000;

  const processedCount = smsList.filter(s => s.processed).length;
  const pendingCount = smsList.filter(s => !s.processed).length;
  const totalAmount = smsList.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);

  const timeAgo = (ts) => {
    if (!ts) return "—";
    const diff = now - new Date(ts).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "এইমাত্র";
    if (m < 60) return `${m} মিনিট আগে`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} ঘণ্টা আগে`;
    return `${Math.floor(h / 24)} দিন আগে`;
  };

  return (
    <div>
      {/* CONNECTION STATUS BULB */}
      <div style={{ ...card, marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", background: connected ? "rgba(52,211,153,0.06)" : "rgba(248,113,113,0.06)", border: `1px solid ${connected ? "rgba(52,211,153,0.25)" : "rgba(248,113,113,0.25)"}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ position: "relative", width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 18, height: 18, borderRadius: "50%", background: connected ? C.green : C.red, boxShadow: `0 0 18px ${connected ? C.green : C.red}`, animation: connected ? "pulse 1.5s ease-in-out infinite" : "none" }}></div>
          </div>
          <div>
            <div style={{ fontFamily: "Orbitron,sans-serif", fontWeight: 800, fontSize: 14, color: connected ? C.green : C.red }}>
              {connected ? "🟢 অ্যাপ কানেক্টেড" : "🔴 কানেক্টেড নয়"}
            </div>
            <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>
              {connected ? "Android অ্যাপ থেকে ডাটা আসছে" : "শেষ ৫ মিনিটে কোনো ডাটা আসেনি"}
            </div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 10, color: C.textFaint }}>শেষ SMS</div>
          <div style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>{lastSms ? timeAgo(lastSms.matchedAt || lastSms.timestamp) : "কখনো না"}</div>
        </div>
      </div>

      {/* STATS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 16 }}>
        {[
          ["মোট SMS", smsList.length, C.blue],
          ["প্রসেসড", processedCount, C.green],
          ["পেন্ডিং", pendingCount, C.amber],
        ].map(([l, v, c]) => (
          <div key={l} style={{ ...card, padding: 14, textAlign: "center" }}>
            <div style={{ fontFamily: "Orbitron,sans-serif", fontSize: 20, fontWeight: 800, color: c }}>{v}</div>
            <div style={{ fontSize: 10, color: C.textFaint, marginTop: 4 }}>{l}</div>
          </div>
        ))}
      </div>

      <div style={{ ...card, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12, color: C.textDim }}>মোট গৃহীত পরিমাণ</span>
        <span style={{ fontFamily: "Orbitron,sans-serif", fontSize: 18, fontWeight: 800, color: C.green }}>৳{fmt(totalAmount)}</span>
      </div>

      {/* SMS LOG */}
      <div style={{ fontFamily: "Orbitron,sans-serif", fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>
        📨 রিয়েল-টাইম SMS লগ
      </div>

      {smsList.length === 0 ? (
        <div style={{ ...card, textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
          <div style={{ color: C.textFaint, fontSize: 13 }}>এখনো কোনো bKash SMS আসেনি</div>
          <div style={{ color: C.textFaint, fontSize: 11, marginTop: 8, lineHeight: 1.6 }}>
            Android অ্যাপ ইনস্টল করুন এবং একটি bKash পেমেন্ট SMS<br />পাঠান — এখানে রিয়েল-টাইমে দেখা যাবে।
          </div>
        </div>
      ) : (
        <div style={{ ...card, padding: 0, overflow: "hidden" }}>
          {smsList.map((s) => (
            <div key={s.id} style={{ padding: "14px 16px", borderBottom: `1px solid ${C.borderLight}`, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: s.processed ? C.greenBg : C.amberBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                {s.processed ? "✅" : "⏳"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                  <span style={{ fontFamily: "Orbitron,sans-serif", fontSize: 13, fontWeight: 700, color: C.text }}>৳{fmt(s.amount)}</span>
                  <span style={badge(s.processed ? C.green : C.amber, s.processed ? C.greenBg : C.amberBg)}>
                    {s.processed ? "প্রসেসড" : "পেন্ডিং"}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: C.textDim }}>
                  TrxID: <b style={{ color: C.primary }}>{s.transaction_id || "—"}</b>
                  {s.phone_number ? ` · ${s.phone_number}` : ""}
                </div>
                <div style={{ fontSize: 10, color: C.textFaint, marginTop: 2 }}>
                  {timeAgo(s.timestamp)}{s.matchedUid ? " · ✅ ওয়ালেটে যোগ হয়েছে" : ""}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`@keyframes pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.3);opacity:0.7}}`}</style>
    </div>
  );
}
