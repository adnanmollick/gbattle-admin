import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// Global styles
const style = document.createElement("style");
style.textContent = `
  * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
  body { margin: 0; }
  input:focus, textarea:focus {
    border-color: rgba(167,139,250,0.6) !important;
    box-shadow: 0 0 0 3px rgba(167,139,250,0.15) !important;
  }
  ::-webkit-scrollbar { width: 0; height: 0; }
`;
document.head.appendChild(style);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
