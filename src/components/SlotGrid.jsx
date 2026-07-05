import { C } from "../utils/ui";

// Reusable slot grid — shows all slots, filled ones highlighted, click to select
// Used in: admin match view (see who joined), admin result (enter points)
export default function SlotGrid({ participants=[], teamSize=1, maxPlayers=48, selectedSlot=null, onSlotClick, resultMode=false }) {
  const totalSlots = Math.ceil(maxPlayers / teamSize);
  const bySlot = {};
  participants.forEach(p => { if (p.slot) bySlot[p.slot] = p; });

  return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:7 }}>
      {Array.from({length:totalSlots}, (_,idx) => {
        const slotNum = idx+1;
        const occupant = bySlot[slotNum];
        const filled = !!occupant;
        const isSelected = selectedSlot===slotNum;
        return (
          <button
            key={slotNum}
            onClick={() => onSlotClick && onSlotClick(slotNum, occupant)}
            style={{
              aspectRatio:"1", borderRadius:9, cursor:"pointer", padding:0,
              border: isSelected ? "2px solid #a78bfa" : filled ? `1px solid ${C.green}` : `1px solid ${C.border}`,
              background: isSelected ? "rgba(167,139,250,0.25)" : filled ? "rgba(52,211,153,0.12)" : C.surface2,
              color: filled ? C.green : C.textFaint,
              display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:1,
              position:"relative",
            }}
          >
            <span style={{ fontSize:12, fontFamily:"Orbitron,sans-serif", fontWeight:700 }}>{slotNum}</span>
            {filled && <span style={{ fontSize:7, lineHeight:1, maxWidth:"90%", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{occupant.teamName || occupant.name || "✓"}</span>}
            {resultMode && filled && occupant.position && (
              <span style={{ position:"absolute", top:-4, right:-4, background:C.amber, color:"#000", borderRadius:"50%", width:16, height:16, fontSize:9, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center" }}>{occupant.position}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
