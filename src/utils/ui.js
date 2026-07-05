// Professional Admin Panel design system
export const C = {
  bg: "#0b0a14",
  bgGrad: "linear-gradient(180deg,#0d0b1a 0%,#0b0a14 100%)",
  surface: "#16131f",
  surface2: "#1d1929",
  border: "rgba(255,255,255,0.08)",
  borderLight: "rgba(255,255,255,0.04)",
  text: "#f1eefb",
  textDim: "rgba(241,238,251,0.6)",
  textFaint: "rgba(241,238,251,0.38)",
  primary: "#8b5cf6",
  primaryDeep: "#7c3aed",
  grad: "linear-gradient(135deg,#7c3aed,#a78bfa)",
  green: "#34d399",
  greenBg: "rgba(52,211,153,0.12)",
  red: "#f87171",
  redBg: "rgba(248,113,113,0.12)",
  amber: "#fbbf24",
  amberBg: "rgba(251,191,36,0.12)",
  blue: "#60a5fa",
  blueBg: "rgba(96,165,250,0.12)",
};

export const card = {
  background: C.surface,
  border: `1px solid ${C.border}`,
  borderRadius: 16,
  padding: 18,
};

export const input = {
  width: "100%",
  background: C.surface2,
  border: `1px solid ${C.border}`,
  borderRadius: 10,
  padding: "11px 14px",
  color: C.text,
  fontSize: 13,
  outline: "none",
  fontFamily: "Inter,sans-serif",
  boxSizing: "border-box",
};

export const label = {
  fontSize: 11,
  color: C.textDim,
  fontFamily: "Orbitron,sans-serif",
  fontWeight: 600,
  display: "block",
  marginBottom: 6,
  letterSpacing: 0.3,
};

export const btn = (variant = "primary") => {
  const base = {
    border: "none", borderRadius: 10, padding: "11px 18px",
    fontFamily: "Orbitron,sans-serif", fontWeight: 700, fontSize: 12,
    cursor: "pointer", transition: "all 0.15s",
  };
  const variants = {
    primary: { ...base, background: C.grad, color: "#fff", boxShadow: "0 4px 14px rgba(124,58,237,0.35)" },
    green: { ...base, background: "linear-gradient(135deg,#059669,#34d399)", color: "#fff" },
    red: { ...base, background: "rgba(248,113,113,0.15)", color: C.red, border: `1px solid rgba(248,113,113,0.3)` },
    ghost: { ...base, background: C.surface2, color: C.textDim, border: `1px solid ${C.border}` },
  };
  return variants[variant] || variants.primary;
};

export const badge = (color, bg) => ({
  display: "inline-block",
  background: bg, color: color,
  fontSize: 10, fontFamily: "Orbitron,sans-serif", fontWeight: 700,
  padding: "3px 10px", borderRadius: 20, letterSpacing: 0.5,
});

export function fmt(n) {
  const v = Number(n) || 0;
  return v.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function compressImg(file, maxSize = 800, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxSize) { height = (height * maxSize) / width; width = maxSize; }
        else if (height > maxSize) { width = (width * maxSize) / height; height = maxSize; }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Send Money charge (fixed range-based, per user's bKash rule)
// ≤ ৳25,000 → ৳5 ; > ৳25,000 → ৳10
export function sendMoneyCharge(amount) {
  const amt = Number(amount) || 0;
  if (amt <= 25000) return 5;
  return 10;
}
