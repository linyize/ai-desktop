import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// 禁用默认右键菜单
document.addEventListener("contextmenu", (e) => e.preventDefault());

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
