// eslint-disable-next-line no-unused-vars
import { useState, useEffect } from "react";
import { auth, db } from "./firebase";

// Firebase Auth
import { 
  signInWithEmailAndPassword,onAuthStateChanged,signOut
} from "firebase/auth";

// Firestore
import {
  collection,query,where,getDocs,updateDoc,doc
} from "firebase/firestore";
// ─────────────────────────────────────────────────────────────────────────────
// IAM ROLES & PERMISSIONS
// ─────────────────────────────────────────────────────────────────────────────
const ROLES = {
  SUPER_ADMIN: {
    label: "Super Administrator",
    color: "#7c3aed",
    bg: "rgba(124,58,237,0.12)",
    permissions: ["dashboard", "ratepayers", "payments", "receipts", "defaulters", "iam"],
    description: "Full system access including officer management",
  },
  REVENUE_MANAGER: {
    label: "Revenue Manager",
    color: "#1a5c2a",
    bg: "rgba(26,92,42,0.12)",
    permissions: ["dashboard", "ratepayers", "payments", "receipts", "defaulters"],
    description: "Full revenue operations, no IAM access",
  },
  COLLECTOR: {
    label: "Revenue Collector",
    color: "#0369a1",
    bg: "rgba(3,105,161,0.12)",
    permissions: ["dashboard", "payments", "receipts"],
    description: "Can collect payments and print receipts only",
  },
  REGISTRAR: {
    label: "Registrar",
    color: "#b45309",
    bg: "rgba(180,83,9,0.12)",
    permissions: ["dashboard", "ratepayers"],
    description: "Can register and manage ratepayers only",
  },
  AUDITOR: {
    label: "Auditor",
    color: "#0f766e",
    bg: "rgba(15,118,110,0.12)",
    permissions: ["dashboard", "payments", "receipts", "defaulters"],
    description: "Read-only access to financial records",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// INITIAL DATA
// ─────────────────────────────────────────────────────────────────────────────
const initialOfficers = [
  { id: "OFF001", name: "Kwadwo Mensah", email: "kwadwo@bekwaiassembly.gov.gh", phone: "0244100001", role: "SUPER_ADMIN", ward: "All Wards", staffId: "BMA-STAFF-001", status: "active", createdAt: "2024-01-01", lastLogin: "2024-07-15", password: "admin123" },
  { id: "OFF002", name: "Akosua Frimpong", email: "akosua@bekwaiassembly.gov.gh", phone: "0244100002", role: "REVENUE_MANAGER", ward: "All Wards", staffId: "BMA-STAFF-002", status: "active", createdAt: "2024-01-10", lastLogin: "2024-07-14", password: "manager123" },
  { id: "OFF003", name: "Yaw Boateng", email: "yaw@bekwaiassembly.gov.gh", phone: "0244100003", role: "COLLECTOR", ward: "Market Ward", staffId: "BMA-STAFF-003", status: "active", createdAt: "2024-02-01", lastLogin: "2024-07-13", password: "collect123" },
  { id: "OFF004", name: "Ama Serwaa", email: "ama@bekwaiassembly.gov.gh", phone: "0244100004", role: "REGISTRAR", ward: "Central Ward", staffId: "BMA-STAFF-004", status: "active", createdAt: "2024-02-15", lastLogin: "2024-07-10", password: "register123" },
  { id: "OFF005", name: "Kofi Darkwa", email: "kofi@bekwaiassembly.gov.gh", phone: "0244100005", role: "AUDITOR", ward: "All Wards", staffId: "BMA-STAFF-005", status: "suspended", createdAt: "2024-03-01", lastLogin: "2024-06-20", password: "audit123" },
];

const initialRatepayers = [
  { id: "BMA001", name: "Kwame Asante", pin: "BMA-2024-001", phone: "0244123456", email: "kwame@email.com", address: "Bekwai Central", ward: "Central Ward", category: "Resident", registeredDate: "2024-01-15", status: "active" },
  { id: "BMA002", name: "Ama's Trading Enterprise", pin: "BMA-2024-002", phone: "0322012345", email: "amas@trade.com", address: "Bekwai Market Area", ward: "Market Ward", category: "Business", registeredDate: "2024-02-01", status: "active" },
  { id: "BMA003", name: "Kofi Boateng", pin: "BMA-2024-003", phone: "0551234567", email: "kofi@email.com", address: "Ankaase", ward: "Ankaase Ward", category: "Resident", registeredDate: "2024-03-10", status: "active" },
  { id: "BMA004", name: "Bekwai Timber Works Ltd", pin: "BMA-2024-004", phone: "0322098765", email: "info@bekwaitimber.gh", address: "Industrial Area, Bekwai", ward: "Industrial Ward", category: "Business", registeredDate: "2024-03-20", status: "active" },
  { id: "BMA005", name: "Abena Owusu", pin: "BMA-2024-005", phone: "0207654321", email: "abena@email.com", address: "Dominase", ward: "Dominase Ward", category: "Resident", registeredDate: "2024-04-05", status: "active" },
];

const initialPayments = [
  { id: "BILL001", ratepayerId: "BMA001", amount: 480, type: "Property Rate", period: "Q1 2024", date: "2024-04-10", status: "paid", receiptNo: "BMA-RCP-001", dueDate: "2024-04-15", collectedBy: "OFF003" },
  { id: "BILL002", ratepayerId: "BMA002", amount: 1200, type: "Business Operating Permit", period: "2024", date: "2024-04-12", status: "paid", receiptNo: "BMA-RCP-002", dueDate: "2024-04-15", collectedBy: "OFF003" },
  { id: "BILL003", ratepayerId: "BMA003", amount: 320, type: "Property Rate", period: "Q1 2024", date: null, status: "owing", receiptNo: null, dueDate: "2024-04-15", collectedBy: null },
  { id: "BILL004", ratepayerId: "BMA004", amount: 3500, type: "Business Operating Permit", period: "2024", date: null, status: "owing", receiptNo: null, dueDate: "2024-04-15", collectedBy: null },
  { id: "BILL005", ratepayerId: "BMA001", amount: 480, type: "Property Rate", period: "Q2 2024", date: "2024-07-10", status: "paid", receiptNo: "BMA-RCP-003", dueDate: "2024-07-15", collectedBy: "OFF002" },
  { id: "BILL006", ratepayerId: "BMA005", amount: 280, type: "Property Rate", period: "Q1 2024", date: null, status: "owing", receiptNo: null, dueDate: "2024-04-15", collectedBy: null },
  { id: "BILL007", ratepayerId: "BMA002", amount: 600, type: "Market Tolls", period: "Q2 2024", date: "2024-07-14", status: "paid", receiptNo: "BMA-RCP-004", dueDate: "2024-07-15", collectedBy: "OFF003" },
];

const LEVY_TYPES = ["Property Rate", "Basic Rate", "Business Operating Permit", "Market Tolls", "Hawkers & Traders Levy", "Building Permit Fee", "Sanitation Levy", "Advertisement Permit", "Slaughterhouse Fee", "Burial Permit Fee"];
const WARDS = ["All Wards", "Central Ward", "Market Ward", "Ankaase Ward", "Dominase Ward", "Jacobu Ward", "New Town Ward", "Industrial Ward", "Manso Ward"];

// ─────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────────────────
const fmt = (n) => `GH₵ ${Number(n).toLocaleString("en-GH", { minimumFractionDigits: 2 })}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-GH", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const now = () => new Date().toISOString().split("T")[0];
const hasPermission = (officer, page) => officer && ROLES[officer.role]?.permissions.includes(page);

// ─────────────────────────────────────────────────────────────────────────────
// PRINT HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function printDoc(html) {
  const w = window.open("", "_blank", "width=800,height=600");
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); w.close(); }, 600);
}

const printStyles = `body{font-family:Georgia,serif;max-width:620px;margin:40px auto;padding:24px;color:#1a1a1a;}.header{text-align:center;padding-bottom:18px;margin-bottom:18px;border-bottom:3px double #1a5c2a;}.org{font-size:18px;font-weight:bold;color:#1a5c2a;letter-spacing:1px;}.sub{font-size:12px;color:#555;margin-top:2px;}.motto{font-size:11px;color:#8a6a00;font-style:italic;margin-top:4px;}h2{color:#1a5c2a;margin:0 0 16px;}.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee;}.label{color:#555;font-size:13px;}.value{font-weight:bold;font-size:13px;}.amount{font-size:28px;font-weight:bold;text-align:center;padding:18px;border-radius:8px;margin:18px 0;}.footer{text-align:center;color:#888;font-size:11px;margin-top:28px;border-top:1px solid #eee;padding-top:14px;}.stamp{display:inline-block;border:3px solid;padding:8px 20px;border-radius:4px;font-weight:bold;font-size:16px;transform:rotate(-10deg);margin-top:8px;}.note{padding:12px;margin:14px 0;font-size:12px;border-left:4px solid;border-radius:0 6px 6px 0;}`;

const headerHTML = `<div class="header"><img src="${window.location.origin}/logo.png" alt="BMA Logo" style="width:60px;height:60px;object-fit:contain;margin-bottom:6px;" /><div class="org">BEKWAI MUNICIPAL ASSEMBLY</div><div class="sub">Ashanti Region, Ghana | Revenue & Rating Department</div><div class="motto">"Unity, Progress &amp; Development"</div></div>`;

function buildReceiptHTML(payment, rp, officer) {
  return `<!DOCTYPE html><html><head><title>Receipt ${payment.receiptNo}</title><style>${printStyles}</style></head><body>${headerHTML}<h2>Official Revenue Receipt</h2><div class="row"><span class="label">Receipt No.</span><span class="value">${payment.receiptNo}</span></div><div class="row"><span class="label">Ratepayer</span><span class="value">${rp.name}</span></div><div class="row"><span class="label">PIN</span><span class="value">${rp.pin}</span></div><div class="row"><span class="label">Ward</span><span class="value">${rp.ward}</span></div><div class="row"><span class="label">Levy Type</span><span class="value">${payment.type}</span></div><div class="row"><span class="label">Period</span><span class="value">${payment.period}</span></div><div class="row"><span class="label">Payment Date</span><span class="value">${fmtDate(payment.date)}</span></div><div class="row"><span class="label">Collected By</span><span class="value">${officer?.name || "—"} (${officer?.staffId || "—"})</span></div><div class="amount" style="background:#f0faf3;color:#1a5c2a;">Amount Paid: ${fmt(payment.amount)}</div><div style="text-align:center"><span class="stamp" style="border-color:#1a5c2a;color:#1a5c2a;">PAID IN FULL ✓</span></div><div class="footer">Official receipt of the Bekwai Municipal Assembly<br>Revenue & Rating Department | P.O. Box BK-1, Bekwai, Ashanti<br>Tel: 032-209-XXXX | Date Printed: ${fmtDate(now())}</div></body></html>`;
}

function buildBillHTML(payment, rp) {
  const isOverdue = payment.dueDate < now() && payment.status === "owing";
  return `<!DOCTYPE html><html><head><title>Demand Notice ${payment.id}</title><style>${printStyles}</style></head><body>${headerHTML}<h2>Demand Notice / Rate Bill</h2><div class="row"><span class="label">Bill Ref</span><span class="value">${payment.id}</span></div><div class="row"><span class="label">Ratepayer</span><span class="value">${rp.name}</span></div><div class="row"><span class="label">PIN</span><span class="value">${rp.pin}</span></div><div class="row"><span class="label">Ward</span><span class="value">${rp.ward}</span></div><div class="row"><span class="label">Levy Type</span><span class="value">${payment.type}</span></div><div class="row"><span class="label">Period</span><span class="value">${payment.period}</span></div><div class="row"><span class="label">Due Date</span><span class="value">${fmtDate(payment.dueDate)}</span></div><div class="amount" style="background:${isOverdue ? "#fff0f0" : "#fffbf0"};color:${isOverdue ? "#c0392b" : "#8a6a00"};">Amount Due: ${fmt(payment.amount)}</div><div class="note" style="background:${isOverdue ? "#fff0f0" : "#fffbf0"};border-color:${isOverdue ? "#c0392b" : "#c9a800"};">${isOverdue ? "⚠️ OVERDUE. Failure to pay may result in legal action under the Local Governance Act, 2016 (Act 936)." : `📅 Please pay on or before ${fmtDate(payment.dueDate)}.`}</div><div class="footer">Pay at Bekwai Municipal Assembly Revenue Office or via MoMo<br>MTN: 024-XXX-XXXX | Quote Bill Ref: ${payment.id}</div></body></html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// ICONS
// ─────────────────────────────────────────────────────────────────────────────
const Icon = ({ name, size = 18 }) => {
  const icons = {
    dashboard: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
    users: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
    payments: "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z",
    receipt: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01",
    alert: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
    shield: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
    plus: "M12 4v16m8-8H4",
    search: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
    print: "M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z",
    check: "M5 13l4 4L19 7",
    x: "M6 18L18 6M6 6l12 12",
    trend: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6",
    menu: "M4 6h16M4 12h16M4 18h16",
    logout: "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1",
    lock: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
    eye: "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z",
    eyeoff: "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21",
    edit: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
    ban: "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636",
  };
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d={icons[name] || icons.check} />
    </svg>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────────────────────────────────────────
function Toast({ toasts }) {
  return (
    <div style={{ position: "fixed", top: 16, right: 16, zIndex: 9999, display: "flex", flexDirection: "column", gap: 8 }}>
      {toasts.map(t => (
        <div key={t.id} style={{ background: t.type === "success" ? "#14532d" : t.type === "error" ? "#7f1d1d" : "#1e3a5f", color: "#fff", padding: "12px 18px", borderRadius: 10, fontSize: 14, boxShadow: "0 4px 20px rgba(0,0,0,0.2)", display: "flex", alignItems: "center", gap: 8, fontFamily: "inherit", animation: "slideIn 0.3s ease" }}>
          <Icon name={t.type === "success" ? "check" : "alert"} size={16} />
          {t.msg}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL
// ─────────────────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children, maxWidth = 520 }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 60px rgba(0,0,0,0.2)", border: "1px solid #e0ede0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 24px", borderBottom: "1px solid #f0f0f0" }}>
          <h3 style={{ margin: 0, color: "#1a2e1a", fontSize: 17, fontFamily: "Cormorant Garamond, serif" }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#9ab89a", cursor: "pointer", padding: 4 }}><Icon name="x" size={20} /></button>
        </div>
        <div style={{ padding: 24 }}>{children}</div>
      </div>
    </div>
  );
}

const inputStyle = { width: "100%", background: "#f8faf8", border: "1px solid #d4e8d4", borderRadius: 8, padding: "10px 14px", color: "#1a2e1a", fontSize: 14, boxSizing: "border-box", outline: "none", fontFamily: "inherit" };
const selectStyle = { ...inputStyle, cursor: "pointer" };

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 11, color: "#4a7a58", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600 }}>{label}</label>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
function LoginPage({ officers, onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleLogin() {
    setError("");
    setLoading(true);
    setTimeout(() => {
      const officer = officers.find(o => o.email.toLowerCase() === email.toLowerCase() && o.password === password);
      if (!officer) { setError("Invalid email or password. Please try again."); setLoading(false); return; }
      if (officer.status === "suspended") { setError("Your account has been suspended. Contact the System Administrator."); setLoading(false); return; }
      onLogin(officer);
      setLoading(false);
    }, 800);
  }

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #f0faf2 0%, #e8f5ec 50%, #f5f9f5 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: "'Outfit', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Outfit:wght@400;500;600;700&display=swap');*{box-sizing:border-box;}@keyframes slideIn{from{transform:translateY(-10px);opacity:0}to{transform:translateY(0);opacity:1}}@keyframes fadeUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}input:focus{border-color:#1a5c2a!important;box-shadow:0 0 0 3px rgba(26,92,42,0.1)!important;outline:none;}`}</style>

      <div style={{ width: "100%", maxWidth: 440, animation: "fadeUp 0.6s ease" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <img src="/logo.png" alt="Bekwai Municipal Assembly" style={{ width: 56, height: 56, objectFit: "contain" }} />
          <h1 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 26, color: "#1a2e1a", margin: "0 0 4px", fontWeight: 700 }}>Bekwai Municipal Assembly</h1>
          <p style={{ color: "#4a7a58", fontSize: 13, margin: 0 }}>Revenue Management System — Officer Portal</p>
        </div>

        {/* Card */}
        <div style={{ background: "#fff", borderRadius: 20, padding: 32, boxShadow: "0 8px 40px rgba(26,92,42,0.1)", border: "1px solid #e0ede0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24, padding: "12px 16px", background: "#f0faf2", borderRadius: 10, border: "1px solid #c8e6c8" }}>
            <Icon name="shield" size={18} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#1a5c2a" }}>Authorised Officers Only</div>
              <div style={{ fontSize: 11, color: "#4a7a58" }}>Access restricted to registered assembly staff</div>
            </div>
          </div>

          <Field label="Official Email Address">
            <input style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="yourname@bekwaiassembly.gov.gh" onKeyDown={e => e.key === "Enter" && handleLogin()} />
          </Field>

          <Field label="Password">
            <div style={{ position: "relative" }}>
              <input style={{ ...inputStyle, paddingRight: 44 }} type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" onKeyDown={e => e.key === "Enter" && handleLogin()} />
              <button onClick={() => setShowPass(!showPass)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#4a7a58", padding: 2 }}>
                <Icon name={showPass ? "eyeoff" : "eye"} size={16} />
              </button>
            </div>
          </Field>

          {error && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", marginBottom: 16, display: "flex", alignItems: "center", gap: 8, animation: "slideIn 0.3s ease" }}>
              <Icon name="alert" size={15} />
              <span style={{ color: "#dc2626", fontSize: 13 }}>{error}</span>
            </div>
          )}

          <button onClick={handleLogin} disabled={loading || !email || !password}
            style={{ width: "100%", padding: "13px", background: loading ? "#9ab89a" : "linear-gradient(135deg, #1a5c2a, #2d8a45)", border: "none", borderRadius: 10, color: "#fff", fontSize: 15, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "opacity 0.2s" }}>
            {loading ? "Verifying…" : <><Icon name="lock" size={16} /> Sign In Securely</>}
          </button>

          {/* Demo hint */}
          <div style={{ marginTop: 20, padding: "12px 14px", background: "#f8faf8", borderRadius: 10, border: "1px solid #e8f0e8" }}>
            <div style={{ fontSize: 11, color: "#4a7a58", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Demo Credentials</div>
            {[
              { role: "Super Admin", email: "kwadwo@bekwaiassembly.gov.gh", pass: "admin123" },
              { role: "Collector", email: "yaw@bekwaiassembly.gov.gh", pass: "collect123" },
              { role: "Registrar", email: "ama@bekwaiassembly.gov.gh", pass: "register123" },
            ].map(d => (
              <div key={d.role} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: "#2a5a38", fontWeight: 500 }}>{d.role}</span>
                <button onClick={() => { setEmail(d.email); setPassword(d.pass); }} style={{ fontSize: 10, color: "#1a5c2a", background: "rgba(26,92,42,0.08)", border: "none", borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontFamily: "inherit" }}>Use</button>
              </div>
            ))}
          </div>
        </div>

        <p style={{ textAlign: "center", color: "#7a9a78", fontSize: 12, marginTop: 20 }}>
          © 2026 Bekwai Municipal Assembly · Ashanti Region, Ghana
        </p>
      </div>
    </div>
    );
  }

// ─────────────────────────────────────────────────────────────────────────────
// ACCESS DENIED
// ─────────────────────────────────────────────────────────────────────────────
function AccessDenied({ role }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 80, textAlign: "center" }}>
      <div style={{ fontSize: 52, marginBottom: 16 }}>🔒</div>
      <h3 style={{ fontFamily: "Cormorant Garamond, serif", color: "#1a2e1a", fontSize: 22, margin: "0 0 8px" }}>Access Restricted</h3>
      <p style={{ color: "#4a7a58", fontSize: 14, maxWidth: 360, margin: "0 0 16px" }}>
        Your role <strong>({ROLES[role]?.label})</strong> does not have permission to access this section. Contact the System Administrator if you require access.
      </p>
      <div style={{ background: "#fef9c3", border: "1px solid #fde047", borderRadius: 8, padding: "8px 16px", fontSize: 12, color: "#854d0e" }}>
        Required permission level: Super Administrator or Revenue Manager
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STAT CARD
// ─────────────────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, color, sub }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e8f0e8", borderRadius: 16, padding: "20px 22px", position: "relative", overflow: "hidden", boxShadow: "0 2px 8px rgba(26,92,42,0.06)" }}>
      <div style={{ position: "absolute", top: 0, right: 0, width: 70, height: 70, background: color + "18", borderRadius: "0 16px 0 70px" }} />
      <div style={{ position: "absolute", top: 14, right: 14, color }}><Icon name={icon} size={20} /></div>
      <div style={{ fontSize: 11, color: "#7a9a78", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: "#1a2e1a", fontFamily: "Cormorant Garamond, serif", lineHeight: 1.2 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#9ab89a", marginTop: 5 }}>{sub}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
function Dashboard({ ratepayers, payments, officers, currentOfficer }) {
  const totalRevenue = payments.filter(p => p.status === "paid").reduce((s, p) => s + p.amount, 0);
  const totalOwing = payments.filter(p => p.status === "owing").reduce((s, p) => s + p.amount, 0);
  const paidCount = payments.filter(p => p.status === "paid").length;
  const owingCount = payments.filter(p => p.status === "owing").length;
  const complianceRate = payments.length ? Math.round((paidCount / payments.length) * 100) : 0;
  const byType = {};
  payments.filter(p => p.status === "paid").forEach(p => { byType[p.type] = (byType[p.type] || 0) + p.amount; });
  const maxBar = Math.max(...Object.values(byType), 1);
  const overdue = payments.filter(p => p.status === "owing" && p.dueDate < now());
  const recent = [...payments].filter(p => p.status === "paid").sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 5);

  // Officer's own collections
  const myCollections = payments.filter(p => p.collectedBy === currentOfficer.id && p.status === "paid");
  const myTotal = myCollections.reduce((s, p) => s + p.amount, 0);

  return (
    <div>
      {/* Welcome Banner */}
      <div style={{ background: "linear-gradient(135deg, #1a5c2a, #2d8a45)", borderRadius: 16, padding: "20px 24px", marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 4 }}>Welcome back,</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#fff", fontFamily: "Cormorant Garamond, serif" }}>{currentOfficer.name}</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 2 }}>
            <span style={{ background: "rgba(255,255,255,0.15)", padding: "2px 10px", borderRadius: 20 }}>{ROLES[currentOfficer.role]?.label}</span>
            <span style={{ marginLeft: 8 }}>{currentOfficer.ward}</span>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.07em" }}>Your Collections Today</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#fff", fontFamily: "Cormorant Garamond, serif" }}>{fmt(myTotal)}</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>{myCollections.length} transactions</div>
        </div>
      </div>

      {/* Assembly info + live */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontSize: 13, color: "#4a7a58" }}>Bekwai Municipal Assembly — Revenue Dashboard</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#16a34a", fontSize: 12 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#16a34a", animation: "pulse 2s infinite" }} />
          Live · {new Date().toLocaleDateString("en-GH", { weekday: "short", day: "numeric", month: "short" })}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(185px, 1fr))", gap: 14, marginBottom: 24 }}>
        <StatCard label="Total Revenue" value={fmt(totalRevenue)} icon="trend" color="#16a34a" sub={`${paidCount} payments`} />
        <StatCard label="Outstanding" value={fmt(totalOwing)} icon="alert" color="#d97706" sub={`${owingCount} unpaid bills`} />
        <StatCard label="Ratepayers" value={ratepayers.length} icon="users" color="#2563eb" sub="Registered" />
        <StatCard label="Collection Rate" value={`${complianceRate}%`} icon="check" color="#7c3aed" sub="Compliance" />
        {hasPermission(currentOfficer, "iam") && <StatCard label="Officers" value={officers.filter(o => o.status === "active").length} icon="shield" color="#0f766e" sub="Active staff" />}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18, marginBottom: 20 }}>
        <div style={{ background: "#fff", border: "1px solid #e8f0e8", borderRadius: 14, padding: 20, boxShadow: "0 2px 8px rgba(26,92,42,0.05)" }}>
          <h3 style={{ margin: "0 0 16px", color: "#4a7a58", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>Revenue by Levy Type</h3>
          {Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([type, amount]) => (
            <div key={type} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ color: "#2a5a38", fontSize: 12 }}>{type}</span>
                <span style={{ color: "#1a5c2a", fontSize: 12, fontWeight: 700 }}>{fmt(amount)}</span>
              </div>
              <div style={{ height: 5, background: "#e8f0e8", borderRadius: 3 }}>
                <div style={{ height: "100%", width: `${(amount / maxBar) * 100}%`, background: "linear-gradient(90deg, #1a5c2a, #4ade80)", borderRadius: 3 }} />
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: "#fff", border: "1px solid #fde68a", borderRadius: 14, padding: 20, boxShadow: "0 2px 8px rgba(217,119,6,0.06)" }}>
          <h3 style={{ margin: "0 0 16px", color: "#b45309", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>⚠ Overdue Notices ({overdue.length})</h3>
          {overdue.length === 0 ? <p style={{ color: "#9ab89a", fontSize: 13 }}>All payments up to date! 🎉</p> :
            overdue.slice(0, 5).map(p => {
              const rp = ratepayers.find(r => r.id === p.ratepayerId);
              return (
                <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #fef9c3" }}>
                  <div>
                    <div style={{ color: "#1a2e1a", fontSize: 13, fontWeight: 500 }}>{rp?.name}</div>
                    <div style={{ color: "#7a9a78", fontSize: 11 }}>{p.type} · Due {fmtDate(p.dueDate)}</div>
                  </div>
                  <span style={{ color: "#d97706", fontSize: 13, fontWeight: 700 }}>{fmt(p.amount)}</span>
                </div>
              );
            })}
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e8f0e8", borderRadius: 14, padding: 20, overflowX: "auto", boxShadow: "0 2px 8px rgba(26,92,42,0.05)" }}>
        <h3 style={{ margin: "0 0 16px", color: "#4a7a58", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>Recent Payments</h3>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 500 }}>
          <thead><tr>{["Ratepayer", "Levy", "Period", "Amount", "Date", "Collected By"].map(h => (
            <th key={h} style={{ textAlign: "left", padding: "8px 12px", fontSize: 11, color: "#7a9a78", textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "1px solid #f0f0f0", fontWeight: 600 }}>{h}</th>
          ))}</tr></thead>
          <tbody>{recent.map(p => {
            const rp = ratepayers.find(r => r.id === p.ratepayerId);
            const off = officers.find(o => o.id === p.collectedBy);
            return <tr key={p.id}>{[rp?.name, p.type, p.period, fmt(p.amount), fmtDate(p.date), off?.name || "—"].map((v, i) => (
              <td key={i} style={{ padding: "10px 12px", fontSize: 13, color: i === 3 ? "#16a34a" : "#2a5a38", borderBottom: "1px solid #f8f8f8", fontWeight: i === 3 ? 700 : 400 }}>{v}</td>
            ))}</tr>;
          })}</tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// IAM — OFFICER MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────
function IAMPage({ officers, setOfficers, currentOfficer, addToast }) {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editOfficer, setEditOfficer] = useState(null);
  const [showPass, setShowPass] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", role: "COLLECTOR", ward: "Central Ward", staffId: "", password: "", confirmPassword: "" });

  const filtered = officers.filter(o => [o.name, o.email, o.staffId, o.ward, ROLES[o.role]?.label].some(f => f?.toLowerCase().includes(search.toLowerCase())));

  function openAdd() { setForm({ name: "", email: "", phone: "", role: "COLLECTOR", ward: "Central Ward", staffId: "", password: "", confirmPassword: "" }); setEditOfficer(null); setShowForm(true); }
  function openEdit(o) { setForm({ ...o, password: "", confirmPassword: "" }); setEditOfficer(o); setShowForm(true); }

  function save() {
    if (!form.name || !form.email || !form.staffId) return addToast("Name, email and Staff ID are required", "error");
    if (!editOfficer && !form.password) return addToast("Password is required for new officers", "error");
    if (form.password && form.password !== form.confirmPassword) return addToast("Passwords do not match", "error");
    if (!editOfficer && officers.find(o => o.email.toLowerCase() === form.email.toLowerCase())) return addToast("An officer with this email already exists", "error");

    if (editOfficer) {
      setOfficers(prev => prev.map(o => o.id === editOfficer.id ? { ...o, name: form.name, email: form.email, phone: form.phone, role: form.role, ward: form.ward, staffId: form.staffId, ...(form.password ? { password: form.password } : {}) } : o));
      addToast(`${form.name}'s profile updated`, "success");
    } else {
      const id = `OFF${String(officers.length + 1).padStart(3, "0")}`;
      setOfficers(prev => [...prev, { id, name: form.name, email: form.email, phone: form.phone, role: form.role, ward: form.ward, staffId: form.staffId, password: form.password, status: "active", createdAt: now(), lastLogin: null }]);
      addToast(`Officer ${form.name} registered successfully!`, "success");
    }
    setShowForm(false);
  }

  function toggleStatus(o) {
    if (o.id === currentOfficer.id) return addToast("You cannot suspend your own account", "error");
    const newStatus = o.status === "active" ? "suspended" : "active";
    setOfficers(prev => prev.map(x => x.id === o.id ? { ...x, status: newStatus } : x));
    addToast(`${o.name} has been ${newStatus === "active" ? "reactivated" : "suspended"}`, newStatus === "active" ? "success" : "info");
  }

  function resetPassword(o) {
    const temp = "Bekwai@" + Math.floor(1000 + Math.random() * 9000);
    setOfficers(prev => prev.map(x => x.id === o.id ? { ...x, password: temp } : x));
    addToast(`Temp password for ${o.name}: ${temp} (share securely)`, "success");
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ color: "#1a2e1a", fontFamily: "Cormorant Garamond, serif", margin: "0 0 4px", fontSize: 26 }}>Officer Management</h2>
          <p style={{ color: "#4a7a58", margin: 0, fontSize: 13 }}>Manage authorised revenue collection officers and their access levels</p>
        </div>
        <button onClick={openAdd} style={{ display: "flex", alignItems: "center", gap: 8, background: "linear-gradient(135deg, #1a5c2a, #2d8a45)", color: "#fff", border: "none", borderRadius: 10, padding: "11px 18px", cursor: "pointer", fontSize: 14, fontWeight: 600, fontFamily: "inherit", boxShadow: "0 2px 8px rgba(26,92,42,0.3)" }}>
          <Icon name="plus" size={16} /> Register Officer
        </button>
      </div>

      {/* Role summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 24 }}>
        {Object.entries(ROLES).map(([key, role]) => {
          const count = officers.filter(o => o.role === key && o.status === "active").length;
          return (
            <div key={key} style={{ background: "#fff", border: `1px solid ${role.color}30`, borderRadius: 12, padding: "14px 16px", boxShadow: "0 2px 6px rgba(0,0,0,0.04)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ background: role.bg, color: role.color, padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700 }}>{role.label}</span>
                <span style={{ fontSize: 20, fontWeight: 700, color: "#1a2e1a", fontFamily: "Cormorant Garamond, serif" }}>{count}</span>
              </div>
              <div style={{ fontSize: 11, color: "#7a9a78", lineHeight: 1.4 }}>{role.description}</div>
            </div>
          );
        })}
      </div>

      <div style={{ position: "relative", marginBottom: 16 }}>
        <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#9ab89a" }}><Icon name="search" size={16} /></div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search officers by name, email, role, ward…" style={{ ...inputStyle, paddingLeft: 40 }} />
      </div>

      <div style={{ background: "#fff", border: "1px solid #e8f0e8", borderRadius: 14, overflow: "hidden", overflowX: "auto", boxShadow: "0 2px 8px rgba(26,92,42,0.05)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 800 }}>
          <thead><tr style={{ background: "#f0faf2" }}>{["Officer", "Staff ID", "Role", "Ward", "Phone", "Status", "Last Login", "Actions"].map(h => (
            <th key={h} style={{ textAlign: "left", padding: "12px 14px", fontSize: 11, color: "#4a7a58", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 700 }}>{h}</th>
          ))}</tr></thead>
          <tbody>{filtered.map(o => {
            const role = ROLES[o.role];
            const isMe = o.id === currentOfficer.id;
            return (
              <tr key={o.id} style={{ borderTop: "1px solid #f5f5f5", background: isMe ? "#f0faf2" : "transparent" }}>
                <td style={{ padding: "12px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 36, height: 36, background: role?.bg, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: role?.color, fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
                      {o.name.charAt(0)}
                    </div>
                    <div>
                      <div style={{ color: "#1a2e1a", fontSize: 13, fontWeight: 600 }}>{o.name} {isMe && <span style={{ fontSize: 10, background: "#e8f5ec", color: "#1a5c2a", padding: "1px 6px", borderRadius: 10, marginLeft: 4 }}>You</span>}</div>
                      <div style={{ color: "#7a9a78", fontSize: 11 }}>{o.email}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: "12px 14px", color: "#2a5a38", fontSize: 12, fontFamily: "monospace" }}>{o.staffId}</td>
                <td style={{ padding: "12px 14px" }}>
                  <span style={{ background: role?.bg, color: role?.color, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>{role?.label}</span>
                </td>
                <td style={{ padding: "12px 14px", color: "#4a7a58", fontSize: 13 }}>{o.ward}</td>
                <td style={{ padding: "12px 14px", color: "#7a9a78", fontSize: 13 }}>{o.phone}</td>
                <td style={{ padding: "12px 14px" }}>
                  <span style={{ background: o.status === "active" ? "rgba(22,163,74,0.1)" : "rgba(239,68,68,0.1)", color: o.status === "active" ? "#16a34a" : "#ef4444", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                    {o.status === "active" ? "● Active" : "● Suspended"}
                  </span>
                </td>
                <td style={{ padding: "12px 14px", color: "#9ab89a", fontSize: 12 }}>{o.lastLogin ? fmtDate(o.lastLogin) : "Never"}</td>
                <td style={{ padding: "12px 14px" }}>
                  <div style={{ display: "flex", gap: 5 }}>
                    <button onClick={() => openEdit(o)} title="Edit" style={{ background: "rgba(37,99,235,0.08)", color: "#2563eb", border: "none", borderRadius: 6, padding: "5px 8px", cursor: "pointer", display: "flex", alignItems: "center", gap: 3, fontSize: 11 }}>
                      <Icon name="edit" size={12} /> Edit
                    </button>
                    {!isMe && (
                      <button onClick={() => toggleStatus(o)} title={o.status === "active" ? "Suspend" : "Reactivate"} style={{ background: o.status === "active" ? "rgba(239,68,68,0.08)" : "rgba(22,163,74,0.08)", color: o.status === "active" ? "#ef4444" : "#16a34a", border: "none", borderRadius: 6, padding: "5px 8px", cursor: "pointer", display: "flex", alignItems: "center", gap: 3, fontSize: 11 }}>
                        <Icon name={o.status === "active" ? "ban" : "check"} size={12} />
                        {o.status === "active" ? "Suspend" : "Restore"}
                      </button>
                    )}
                    <button onClick={() => resetPassword(o)} title="Reset Password" style={{ background: "rgba(180,83,9,0.08)", color: "#b45309", border: "none", borderRadius: 6, padding: "5px 8px", cursor: "pointer", display: "flex", alignItems: "center", gap: 3, fontSize: 11 }}>
                      <Icon name="lock" size={12} /> Reset
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>

      {showForm && (
        <Modal title={editOfficer ? `Edit Officer — ${editOfficer.name}` : "Register New Officer"} onClose={() => setShowForm(false)}>
          <div style={{ background: "#f0faf2", border: "1px solid #c8e6c8", borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: "#1a5c2a" }}>
            <strong>Role permissions:</strong> {ROLES[form.role]?.description}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Full Name *"><input style={inputStyle} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Kwame Mensah" /></Field>
            <Field label="Staff ID *"><input style={inputStyle} value={form.staffId} onChange={e => setForm(p => ({ ...p, staffId: e.target.value }))} placeholder="e.g. BMA-STAFF-010" /></Field>
          </div>
          <Field label="Official Email *"><input style={inputStyle} type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="name@bekwaiassembly.gov.gh" /></Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Phone"><input style={inputStyle} value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="0244XXXXXX" /></Field>
            <Field label="Assigned Ward">
              <select style={selectStyle} value={form.ward} onChange={e => setForm(p => ({ ...p, ward: e.target.value }))}>
                {WARDS.map(w => <option key={w}>{w}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Access Role">
            <select style={selectStyle} value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
              {Object.entries(ROLES).map(([key, r]) => <option key={key} value={key}>{r.label}</option>)}
            </select>
          </Field>

          {/* Permissions preview */}
          <div style={{ background: "#f8faf8", borderRadius: 10, padding: "12px 16px", marginBottom: 16, border: "1px solid #e8f0e8" }}>
            <div style={{ fontSize: 11, color: "#4a7a58", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Permissions granted</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {["dashboard", "ratepayers", "payments", "receipts", "defaulters", "iam"].map(p => {
                const granted = ROLES[form.role]?.permissions.includes(p);
                return <span key={p} style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 500, background: granted ? "rgba(22,163,74,0.1)" : "rgba(239,68,68,0.08)", color: granted ? "#16a34a" : "#ef4444" }}>{granted ? "✓" : "✗"} {p}</span>;
              })}
            </div>
          </div>

          <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: "#4a7a58", fontWeight: 700, marginBottom: 12 }}>{editOfficer ? "Change Password (leave blank to keep current)" : "Set Password *"}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Password">
                <div style={{ position: "relative" }}>
                  <input style={{ ...inputStyle, paddingRight: 40 }} type={showPass ? "text" : "password"} value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="Min 8 characters" />
                  <button onClick={() => setShowPass(!showPass)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#4a7a58" }}><Icon name={showPass ? "eyeoff" : "eye"} size={14} /></button>
                </div>
              </Field>
              <Field label="Confirm Password">
                <input style={inputStyle} type="password" value={form.confirmPassword} onChange={e => setForm(p => ({ ...p, confirmPassword: e.target.value }))} placeholder="Repeat password" />
              </Field>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={() => setShowForm(false)} style={{ flex: 1, padding: "11px", background: "#f8faf8", border: "1px solid #e0ede0", borderRadius: 8, color: "#4a7a58", cursor: "pointer", fontSize: 14, fontFamily: "inherit" }}>Cancel</button>
            <button onClick={save} style={{ flex: 2, padding: "11px", background: "linear-gradient(135deg, #1a5c2a, #2d8a45)", border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 600, fontFamily: "inherit" }}>
              {editOfficer ? "Save Changes" : "Register Officer"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RATEPAYERS
// ─────────────────────────────────────────────────────────────────────────────
function Ratepayers({ ratepayers, setRatepayers, addToast }) {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "", ward: "Central Ward", category: "Resident" });

  const filtered = ratepayers.filter(r => [r.name, r.pin, r.phone, r.ward, r.address].some(f => f?.toLowerCase().includes(search.toLowerCase())));

  function submit() {
    if (!form.name || !form.phone) return addToast("Name and phone are required", "error");
    const id = `BMA${String(ratepayers.length + 1).padStart(3, "0")}`;
    const pin = `BMA-${new Date().getFullYear()}-${String(ratepayers.length + 1).padStart(3, "0")}`;
    setRatepayers(prev => [...prev, { ...form, id, pin, registeredDate: now(), status: "active" }]);
    setForm({ name: "", phone: "", email: "", address: "", ward: "Central Ward", category: "Resident" });
    setShowForm(false);
    addToast(`${form.name} registered successfully!`, "success");
  }

  const catC = { Resident: { bg: "rgba(37,99,235,0.1)", color: "#2563eb" }, Business: { bg: "rgba(180,83,9,0.1)", color: "#b45309" }, NGO: { bg: "rgba(124,58,237,0.1)", color: "#7c3aed" } };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ color: "#1a2e1a", fontFamily: "Cormorant Garamond, serif", margin: "0 0 4px", fontSize: 26 }}>Ratepayer Registry</h2>
          <p style={{ color: "#4a7a58", margin: 0, fontSize: 13 }}>{ratepayers.length} registered ratepayers</p>
        </div>
        <button onClick={() => setShowForm(true)} style={{ display: "flex", alignItems: "center", gap: 8, background: "linear-gradient(135deg, #1a5c2a, #2d8a45)", color: "#fff", border: "none", borderRadius: 10, padding: "11px 18px", cursor: "pointer", fontSize: 14, fontWeight: 600, fontFamily: "inherit", boxShadow: "0 2px 8px rgba(26,92,42,0.25)" }}>
          <Icon name="plus" size={16} /> Register Ratepayer
        </button>
      </div>

      <div style={{ position: "relative", marginBottom: 16 }}>
        <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#9ab89a" }}><Icon name="search" size={16} /></div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, PIN, ward, phone…" style={{ ...inputStyle, paddingLeft: 40 }} />
      </div>

      <div style={{ background: "#fff", border: "1px solid #e8f0e8", borderRadius: 14, overflow: "hidden", overflowX: "auto", boxShadow: "0 2px 8px rgba(26,92,42,0.05)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
          <thead><tr style={{ background: "#f0faf2" }}>{["Name", "PIN", "Category", "Ward", "Phone", "Registered", "Status"].map(h => (
            <th key={h} style={{ textAlign: "left", padding: "12px 14px", fontSize: 11, color: "#4a7a58", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 700 }}>{h}</th>
          ))}</tr></thead>
          <tbody>{filtered.length === 0 ? <tr><td colSpan={7} style={{ textAlign: "center", padding: 40, color: "#9ab89a" }}>No ratepayers found.</td></tr> :
            filtered.map(r => {
              const cc = catC[r.category] || catC.Resident;
              return (
                <tr key={r.id} style={{ borderTop: "1px solid #f5f5f5" }}>
                  <td style={{ padding: "11px 14px", color: "#1a2e1a", fontSize: 13, fontWeight: 600 }}>{r.name}</td>
                  <td style={{ padding: "11px 14px", color: "#1a5c2a", fontSize: 12, fontFamily: "monospace" }}>{r.pin}</td>
                  <td style={{ padding: "11px 14px" }}><span style={{ background: cc.bg, color: cc.color, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 500 }}>{r.category}</span></td>
                  <td style={{ padding: "11px 14px", color: "#4a7a58", fontSize: 13 }}>{r.ward}</td>
                  <td style={{ padding: "11px 14px", color: "#7a9a78", fontSize: 13 }}>{r.phone}</td>
                  <td style={{ padding: "11px 14px", color: "#9ab89a", fontSize: 12 }}>{fmtDate(r.registeredDate)}</td>
                  <td style={{ padding: "11px 14px" }}><span style={{ background: "rgba(22,163,74,0.1)", color: "#16a34a", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 500 }}>Active</span></td>
                </tr>
              );
            })}</tbody>
        </table>
      </div>

      {showForm && (
        <Modal title="Register New Ratepayer" onClose={() => setShowForm(false)}>
          <Field label="Full Name / Business Name *"><input style={inputStyle} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Kwame Asante or ABC Ltd" /></Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Category">
              <select style={selectStyle} value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                <option>Resident</option><option>Business</option><option>NGO</option><option>Government</option>
              </select>
            </Field>
            <Field label="Ward">
              <select style={selectStyle} value={form.ward} onChange={e => setForm(p => ({ ...p, ward: e.target.value }))}>
                {WARDS.filter(w => w !== "All Wards").map(w => <option key={w}>{w}</option>)}
              </select>
            </Field>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Phone *"><input style={inputStyle} value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="0244XXXXXX" /></Field>
            <Field label="Email"><input style={inputStyle} type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="optional" /></Field>
          </div>
          <Field label="Address"><input style={inputStyle} value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder="e.g. No. 5 Market Road, Bekwai" /></Field>
          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            <button onClick={() => setShowForm(false)} style={{ flex: 1, padding: "11px", background: "#f8faf8", border: "1px solid #e0ede0", borderRadius: 8, color: "#4a7a58", cursor: "pointer", fontSize: 14, fontFamily: "inherit" }}>Cancel</button>
            <button onClick={submit} style={{ flex: 2, padding: "11px", background: "linear-gradient(135deg, #1a5c2a, #2d8a45)", border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 600, fontFamily: "inherit" }}>Register</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAYMENTS
// ─────────────────────────────────────────────────────────────────────────────
function Payments({ payments, setPayments, ratepayers, officers, currentOfficer, addToast }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [payModal, setPayModal] = useState(null);
  const [form, setForm] = useState({ ratepayerId: "", type: "Property Rate", period: "", amount: "", dueDate: "" });

  const canCreate = hasPermission(currentOfficer, "payments") && currentOfficer.role !== "AUDITOR";

  const filtered = payments.filter(p => {
    const rp = ratepayers.find(r => r.id === p.ratepayerId);
    return [rp?.name, p.type, p.period, p.id, rp?.ward].some(f => f?.toLowerCase().includes(search.toLowerCase())) && (filter === "all" || p.status === filter);
  });

  function addBill() {
    if (!form.ratepayerId || !form.period || !form.amount) return addToast("Fill all required fields", "error");
    const id = `BILL${String(payments.length + 1).padStart(3, "0")}`;
    setPayments(prev => [...prev, { ...form, id, amount: parseFloat(form.amount), status: "owing", date: null, receiptNo: null, collectedBy: null }]);
    setForm({ ratepayerId: "", type: "Property Rate", period: "", amount: "", dueDate: "" });
    setShowForm(false);
    addToast("Demand notice issued!", "success");
  }

  function markPaid(p) {
    const paidCount = payments.filter(x => x.status === "paid").length;
    const receiptNo = `BMA-RCP-${String(paidCount + 1).padStart(3, "0")}`;
    setPayments(prev => prev.map(x => x.id === p.id ? { ...x, status: "paid", date: now(), receiptNo, collectedBy: currentOfficer.id } : x));
    setPayModal(null);
    addToast(`Payment recorded. Receipt ${receiptNo} issued.`, "success");
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ color: "#1a2e1a", fontFamily: "Cormorant Garamond, serif", margin: "0 0 4px", fontSize: 26 }}>Levy & Payment Tracker</h2>
          <p style={{ color: "#4a7a58", margin: 0, fontSize: 13 }}>{payments.filter(p => p.status === "paid").length} paid · {payments.filter(p => p.status === "owing").length} outstanding</p>
        </div>
        {canCreate && (
          <button onClick={() => setShowForm(true)} style={{ display: "flex", alignItems: "center", gap: 8, background: "linear-gradient(135deg, #1a5c2a, #2d8a45)", color: "#fff", border: "none", borderRadius: 10, padding: "11px 18px", cursor: "pointer", fontSize: 14, fontWeight: 600, fontFamily: "inherit", boxShadow: "0 2px 8px rgba(26,92,42,0.25)" }}>
            <Icon name="plus" size={16} /> Issue Demand Notice
          </button>
        )}
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1, position: "relative", minWidth: 200 }}>
          <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#9ab89a" }}><Icon name="search" size={16} /></div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by ratepayer, levy, ward…" style={{ ...inputStyle, paddingLeft: 40 }} />
        </div>
        {["all", "paid", "owing"].map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid", fontSize: 13, cursor: "pointer", fontFamily: "inherit", borderColor: filter === s ? "#1a5c2a" : "#e0ede0", background: filter === s ? "#e8f5ec" : "#fff", color: filter === s ? "#1a5c2a" : "#7a9a78", fontWeight: filter === s ? 700 : 400 }}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <div style={{ background: "#fff", border: "1px solid #e8f0e8", borderRadius: 14, overflow: "hidden", overflowX: "auto", boxShadow: "0 2px 8px rgba(26,92,42,0.05)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 800 }}>
          <thead><tr style={{ background: "#f0faf2" }}>{["Bill Ref", "Ratepayer", "Ward", "Levy Type", "Amount", "Due Date", "Status", "Collected By", "Actions"].map(h => (
            <th key={h} style={{ textAlign: "left", padding: "12px 12px", fontSize: 11, color: "#4a7a58", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>
          ))}</tr></thead>
          <tbody>{filtered.length === 0 ? <tr><td colSpan={9} style={{ textAlign: "center", padding: 40, color: "#9ab89a" }}>No records found.</td></tr> :
            filtered.map(p => {
              const rp = ratepayers.find(r => r.id === p.ratepayerId);
              const off = officers.find(o => o.id === p.collectedBy);
              const isOverdue = p.dueDate < now() && p.status === "owing";
              return (
                <tr key={p.id} style={{ borderTop: "1px solid #f5f5f5" }}>
                  <td style={{ padding: "10px 12px", color: "#1a5c2a", fontSize: 12, fontFamily: "monospace" }}>{p.id}</td>
                  <td style={{ padding: "10px 12px", color: "#1a2e1a", fontSize: 13, fontWeight: 500 }}>{rp?.name}</td>
                  <td style={{ padding: "10px 12px", color: "#7a9a78", fontSize: 12 }}>{rp?.ward}</td>
                  <td style={{ padding: "10px 12px", color: "#2a5a38", fontSize: 13 }}>{p.type}</td>
                  <td style={{ padding: "10px 12px", color: p.status === "paid" ? "#16a34a" : "#d97706", fontSize: 13, fontWeight: 700 }}>{fmt(p.amount)}</td>
                  <td style={{ padding: "10px 12px", color: isOverdue ? "#ef4444" : "#7a9a78", fontSize: 12 }}>{fmtDate(p.dueDate)}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{ background: p.status === "paid" ? "rgba(22,163,74,0.1)" : isOverdue ? "rgba(239,68,68,0.1)" : "rgba(217,119,6,0.1)", color: p.status === "paid" ? "#16a34a" : isOverdue ? "#ef4444" : "#d97706", padding: "3px 9px", borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                      {p.status === "paid" ? "PAID" : isOverdue ? "OVERDUE" : "OWING"}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px", color: "#9ab89a", fontSize: 12 }}>{off ? off.name : "—"}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={() => { printDoc(buildBillHTML(p, rp)); addToast("Bill sent to printer", "success"); }} style={{ background: "rgba(180,83,9,0.08)", color: "#b45309", border: "none", borderRadius: 6, padding: "5px 7px", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", gap: 3 }}>
                        <Icon name="print" size={11} /> Bill
                      </button>
                      {p.status === "owing" && canCreate && (
                        <button onClick={() => setPayModal(p)} style={{ background: "rgba(22,163,74,0.1)", color: "#16a34a", border: "none", borderRadius: 6, padding: "5px 7px", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", gap: 3 }}>
                          <Icon name="check" size={11} /> Pay
                        </button>
                      )}
                      {p.status === "paid" && (
                        <button onClick={() => { const off2 = officers.find(o => o.id === p.collectedBy); printDoc(buildReceiptHTML(p, rp, off2)); addToast("Receipt sent to printer", "success"); }} style={{ background: "rgba(37,99,235,0.08)", color: "#2563eb", border: "none", borderRadius: 6, padding: "5px 7px", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", gap: 3 }}>
                          <Icon name="receipt" size={11} /> Receipt
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}</tbody>
        </table>
      </div>

      {showForm && (
        <Modal title="Issue Demand Notice" onClose={() => setShowForm(false)}>
          <Field label="Ratepayer *">
            <select style={selectStyle} value={form.ratepayerId} onChange={e => setForm(p => ({ ...p, ratepayerId: e.target.value }))}>
              <option value="">— Select Ratepayer —</option>
              {ratepayers.map(r => <option key={r.id} value={r.id}>{r.name} — {r.ward} ({r.pin})</option>)}
            </select>
          </Field>
          <Field label="Levy Type">
            <select style={selectStyle} value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
              {LEVY_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Period *"><input style={inputStyle} value={form.period} onChange={e => setForm(p => ({ ...p, period: e.target.value }))} placeholder="e.g. Q2 2024" /></Field>
            <Field label="Amount (GH₵) *"><input style={inputStyle} type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="0.00" /></Field>
          </div>
          <Field label="Due Date"><input style={inputStyle} type="date" value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} /></Field>
          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            <button onClick={() => setShowForm(false)} style={{ flex: 1, padding: "11px", background: "#f8faf8", border: "1px solid #e0ede0", borderRadius: 8, color: "#4a7a58", cursor: "pointer", fontSize: 14, fontFamily: "inherit" }}>Cancel</button>
            <button onClick={addBill} style={{ flex: 2, padding: "11px", background: "linear-gradient(135deg, #1a5c2a, #2d8a45)", border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 600, fontFamily: "inherit" }}>Issue Notice</button>
          </div>
        </Modal>
      )}

      {payModal && (() => {
        const rp = ratepayers.find(r => r.id === payModal.ratepayerId);
        return (
          <Modal title="Confirm Payment" onClose={() => setPayModal(null)}>
            <div style={{ textAlign: "center", padding: "8px 0" }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>💳</div>
              <div style={{ color: "#4a7a58", fontSize: 13, marginBottom: 4 }}>Recording payment from</div>
              <div style={{ color: "#1a2e1a", fontSize: 20, fontWeight: 700, fontFamily: "Cormorant Garamond, serif" }}>{rp?.name}</div>
              <div style={{ color: "#7a9a78", fontSize: 12, marginTop: 2 }}>{rp?.ward} · {payModal.type} · {payModal.period}</div>
              <div style={{ fontSize: 34, fontWeight: 800, color: "#16a34a", fontFamily: "Cormorant Garamond, serif", margin: "18px 0" }}>{fmt(payModal.amount)}</div>
              <div style={{ background: "#f0faf2", border: "1px solid #c8e6c8", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#1a5c2a", marginBottom: 18, textAlign: "left" }}>
                <div>Collected by: <strong>{currentOfficer.name}</strong> ({currentOfficer.staffId})</div>
                <div>Date: <strong>{fmtDate(now())}</strong></div>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={() => setPayModal(null)} style={{ flex: 1, padding: "12px", background: "#f8faf8", border: "1px solid #e0ede0", borderRadius: 8, color: "#4a7a58", cursor: "pointer", fontSize: 14, fontFamily: "inherit" }}>Cancel</button>
                <button onClick={() => markPaid(payModal)} style={{ flex: 1, padding: "12px", background: "linear-gradient(135deg, #166534, #16a34a)", border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 600, fontFamily: "inherit" }}>✓ Confirm & Issue Receipt</button>
              </div>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RECEIPTS
// ─────────────────────────────────────────────────────────────────────────────
function Receipts({ payments, ratepayers, officers, addToast }) {
  const [search, setSearch] = useState("");
  const paid = payments.filter(p => p.status === "paid" && p.receiptNo);
  const filtered = paid.filter(p => {
    const rp = ratepayers.find(r => r.id === p.ratepayerId);
    return [rp?.name, p.receiptNo, p.type, p.period, rp?.ward].some(f => f?.toLowerCase().includes(search.toLowerCase()));
  });

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ color: "#1a2e1a", fontFamily: "Cormorant Garamond, serif", margin: "0 0 4px", fontSize: 26 }}>Revenue Receipts</h2>
        <p style={{ color: "#4a7a58", margin: 0, fontSize: 13 }}>{paid.length} official receipts issued</p>
      </div>
      <div style={{ position: "relative", marginBottom: 20 }}>
        <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#9ab89a" }}><Icon name="search" size={16} /></div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search receipts…" style={{ ...inputStyle, paddingLeft: 40 }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
        {filtered.length === 0 ? <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 60, color: "#9ab89a" }}>No receipts found.</div> :
          filtered.map(p => {
            const rp = ratepayers.find(r => r.id === p.ratepayerId);
            const off = officers.find(o => o.id === p.collectedBy);
            return (
              <div key={p.id} style={{ background: "#fff", border: "1px solid #c8e6c8", borderRadius: 14, padding: 18, boxShadow: "0 2px 8px rgba(22,163,74,0.06)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ background: "rgba(22,163,74,0.1)", color: "#16a34a", padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700 }}>✓ PAID</span>
                  <span style={{ color: "#1a5c2a", fontSize: 11, fontFamily: "monospace" }}>{p.receiptNo}</span>
                </div>
                <div style={{ color: "#1a2e1a", fontSize: 15, fontWeight: 700, marginBottom: 2 }}>{rp?.name}</div>
                <div style={{ color: "#7a9a78", fontSize: 11 }}>{rp?.ward}</div>
                <div style={{ color: "#7a9a78", fontSize: 12, marginTop: 2 }}>{p.type} · {p.period}</div>
                <div style={{ color: "#9ab89a", fontSize: 11, marginBottom: 2 }}>Paid {fmtDate(p.date)}</div>
                <div style={{ color: "#9ab89a", fontSize: 11, marginBottom: 12 }}>By: {off?.name || "—"}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#16a34a", fontFamily: "Cormorant Garamond, serif", marginBottom: 14 }}>{fmt(p.amount)}</div>
                <button onClick={() => { printDoc(buildReceiptHTML(p, rp, off)); addToast("Receipt sent to printer", "success"); }} style={{ width: "100%", background: "#f0faf2", color: "#16a34a", border: "1px solid #c8e6c8", borderRadius: 8, padding: "9px", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "inherit", fontWeight: 500 }}>
                  <Icon name="print" size={13} /> Print Official Receipt
                </button>
              </div>
            );
          })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULTERS
// ─────────────────────────────────────────────────────────────────────────────
function Defaulters({ payments, ratepayers, addToast }) {
  const owing = payments.filter(p => p.status === "owing");
  const totalOwed = owing.reduce((s, p) => s + p.amount, 0);
  const byRp = {};
  owing.forEach(p => { if (!byRp[p.ratepayerId]) byRp[p.ratepayerId] = []; byRp[p.ratepayerId].push(p); });
  const sorted = Object.entries(byRp).sort((a, b) => b[1].reduce((s, p) => s + p.amount, 0) - a[1].reduce((s, p) => s + p.amount, 0));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ color: "#1a2e1a", fontFamily: "Cormorant Garamond, serif", margin: "0 0 4px", fontSize: 26 }}>Defaulters & Arrears</h2>
          <p style={{ color: "#4a7a58", margin: 0, fontSize: 13 }}>{sorted.length} ratepayers with outstanding levies</p>
        </div>
        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "12px 18px" }}>
          <div style={{ fontSize: 11, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 2, fontWeight: 600 }}>Total Outstanding</div>
          <div style={{ color: "#b45309", fontSize: 20, fontWeight: 700, fontFamily: "Cormorant Garamond, serif" }}>{fmt(totalOwed)}</div>
        </div>
      </div>
      {sorted.length === 0 ? (
        <div style={{ textAlign: "center", padding: 70 }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>🎉</div>
          <div style={{ fontSize: 20, fontFamily: "Cormorant Garamond, serif", color: "#1a5c2a" }}>All levies are paid up!</div>
        </div>
      ) : sorted.map(([rpId, bills]) => {
        const rp = ratepayers.find(r => r.id === rpId);
        const total = bills.reduce((s, b) => s + b.amount, 0);
        const hasOverdue = bills.some(b => b.dueDate < now());
        return (
          <div key={rpId} style={{ background: "#fff", border: `1px solid ${hasOverdue ? "#fde68a" : "#e8f0e8"}`, borderRadius: 14, marginBottom: 14, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", background: hasOverdue ? "#fffbeb" : "#f8faf8", flexWrap: "wrap", gap: 10 }}>
              <div>
                <div style={{ color: "#1a2e1a", fontSize: 16, fontWeight: 700, fontFamily: "Cormorant Garamond, serif" }}>{rp?.name}</div>
                <div style={{ color: "#7a9a78", fontSize: 12, marginTop: 2 }}>{rp?.pin} · {rp?.ward} · {rp?.phone}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ color: "#b45309", fontSize: 20, fontWeight: 800 }}>{fmt(total)}</div>
                <div style={{ color: "#9ab89a", fontSize: 11 }}>{bills.length} bill{bills.length > 1 ? "s" : ""} unpaid</div>
                {hasOverdue && <div style={{ color: "#ef4444", fontSize: 11, fontWeight: 700 }}>⚠ OVERDUE</div>}
              </div>
            </div>
            <div style={{ padding: "4px 20px 14px" }}>
              {bills.map(b => {
                const isOverdue = b.dueDate < now();
                return (
                  <div key={b.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid #f5f5f5", flexWrap: "wrap", gap: 8 }}>
                    <div>
                      <span style={{ color: "#2a5a38", fontSize: 13 }}>{b.type}</span>
                      <span style={{ color: "#9ab89a", fontSize: 12, margin: "0 8px" }}>·</span>
                      <span style={{ color: "#7a9a78", fontSize: 12 }}>{b.period}</span>
                      <span style={{ color: isOverdue ? "#ef4444" : "#9ab89a", fontSize: 11, marginLeft: 8 }}>Due: {fmtDate(b.dueDate)}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ color: isOverdue ? "#ef4444" : "#b45309", fontWeight: 700, fontSize: 14 }}>{fmt(b.amount)}</span>
                      <button onClick={() => { printDoc(buildBillHTML(b, rp)); addToast("Demand notice printed", "success"); }} style={{ background: "rgba(180,83,9,0.08)", color: "#b45309", border: "none", borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", gap: 4, fontFamily: "inherit" }}>
                        <Icon name="print" size={12} /> Demand Notice
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────────────────────
export default function BekwaiApp() {
  const [currentOfficer, setCurrentOfficer] = useState(null);
  const [officers, setOfficers] = useState(initialOfficers);
  const [ratepayers, setRatepayers] = useState(initialRatepayers);
  const [payments, setPayments] = useState(initialPayments);
  const [tab, setTab] = useState("dashboard");
  const [toasts, setToasts] = useState([]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    setCurrentUser(user);
    setLoading(false);
  });
  const handleLogin = async (email, password) => {
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      console.log("Logged in:", userCredential.user.uid);

    } catch (error) {
      console.error("Login error:", error.message);
      alert(error.message);
    }
  };
  return () => unsubscribe();
}, []);

  function addToast(msg, type = "success") {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }

  function handleLogin(officer) {
    setOfficers(prev => prev.map(o => o.id === officer.id ? { ...o, lastLogin: now() } : o));
    setCurrentOfficer(officer);
    setTab("dashboard");
    addToast(`Welcome back, ${officer.name}!`, "success");
  }

  function handleLogout() {
    setCurrentOfficer(null);
    setTab("dashboard");
    addToast("You have been signed out.", "success");
  }

  
  if (!currentOfficer) return <LoginPage officers={officers} onLogin={handleLogin} />;

  const role = ROLES[currentOfficer.role];
  const owingCount = payments.filter(p => p.status === "owing").length;

  const navItems = [
    { id: "dashboard", icon: "dashboard", label: "Dashboard", perm: "dashboard" },
    { id: "ratepayers", icon: "users", label: "Ratepayers", perm: "ratepayers" },
    { id: "payments", icon: "payments", label: "Levies & Bills", perm: "payments" },
    { id: "receipts", icon: "receipt", label: "Receipts", perm: "receipts" },
    { id: "defaulters", icon: "alert", label: "Defaulters", perm: "defaulters" },
    { id: "iam", icon: "shield", label: "Officers", perm: "iam" },
  ].filter(item => hasPermission(currentOfficer, item.perm));

  const NavContent = () => (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Logo */}
      <div style={{ padding: "20px 18px 14px", borderBottom: "1px solid #e8f0e8" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <img src="/logo.png" alt="Bekwai Municipal Assembly" style={{ width: 42, height: 42, objectFit: "contain" }} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#1a2e1a", fontFamily: "Cormorant Garamond, serif", lineHeight: 1.3 }}>Bekwai Municipal<br />Assembly</div>
          </div>
        </div>
        {/* Officer info */}
        <div style={{ background: "#f0faf2", borderRadius: 10, padding: "10px 12px", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 30, height: 30, background: role?.bg, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: role?.color, fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
            {currentOfficer.name.charAt(0)}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: "#1a2e1a", fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{currentOfficer.name}</div>
            <div style={{ fontSize: 10, color: role?.color, fontWeight: 500 }}>{role?.label}</div>
          </div>
        </div>
      </div>

      <nav style={{ padding: "10px 10px", flex: 1 }}>
        {navItems.map(item => (
          <button key={item.id} onClick={() => { setTab(item.id); setMobileOpen(false); }}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, border: "none", cursor: "pointer", marginBottom: 2, textAlign: "left", fontFamily: "inherit", fontSize: 13, background: tab === item.id ? "linear-gradient(135deg, #e8f5ec, #d4ede0)" : "transparent", color: tab === item.id ? "#1a5c2a" : "#4a7a58", fontWeight: tab === item.id ? 700 : 400, borderLeft: tab === item.id ? "3px solid #1a5c2a" : "3px solid transparent", transition: "all 0.15s" }}>
            <Icon name={item.icon} size={16} />
            {item.label}
            {item.id === "defaulters" && owingCount > 0 && <span style={{ marginLeft: "auto", background: "#fef3c7", color: "#b45309", borderRadius: 20, fontSize: 10, padding: "2px 7px", fontWeight: 700 }}>{owingCount}</span>}
          </button>
        ))}
      </nav>

      <div style={{ padding: "12px 14px", borderTop: "1px solid #e8f0e8" }}>
        <button onClick={handleLogout} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 10, border: "1px solid #fecaca", background: "#fff5f5", color: "#ef4444", cursor: "pointer", fontSize: 13, fontFamily: "inherit", fontWeight: 500 }}>
          <Icon name="logout" size={15} /> Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f5f7f5", fontFamily: "'Outfit', 'Segoe UI', sans-serif", color: "#1a2e1a" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Outfit:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box;}
        ::-webkit-scrollbar{width:4px;height:4px;}
        ::-webkit-scrollbar-track{background:#f0f0f0;}
        ::-webkit-scrollbar-thumb{background:rgba(26,92,42,0.2);border-radius:2px;}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        @keyframes slideIn{from{transform:translateX(20px);opacity:0}to{transform:translateX(0);opacity:1}}
        @keyframes fadeUp{from{transform:translateY(10px);opacity:0}to{transform:translateY(0);opacity:1}}
        input:focus,select:focus{border-color:#1a5c2a!important;box-shadow:0 0 0 3px rgba(26,92,42,0.1)!important;outline:none;}
        button:active{transform:scale(0.98);}
        .desktop-sidebar{display:flex!important;}
        @media(max-width:768px){.desktop-sidebar{display:none!important;}.mobile-topbar{display:flex!important;}.main-pad{padding:16px!important;}}
      `}</style>

      <Toast toasts={toasts} />

      <aside className="desktop-sidebar" style={{ width: 224, background: "#fff", borderRight: "1px solid #e8f0e8", display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh", flexShrink: 0, boxShadow: "2px 0 8px rgba(26,92,42,0.05)" }}>
        <NavContent />
      </aside>

      {mobileOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 500 }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} onClick={() => setMobileOpen(false)} />
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 240, background: "#fff", borderRight: "1px solid #e8f0e8", display: "flex", flexDirection: "column" }}>
            <NavContent />
          </div>
        </div>
      )}

      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div className="mobile-topbar" style={{ display: "none", padding: "12px 16px", background: "#fff", borderBottom: "1px solid #e8f0e8", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 100, boxShadow: "0 2px 4px rgba(26,92,42,0.06)" }}>
          <button onClick={() => setMobileOpen(true)} style={{ background: "none", border: "none", color: "#4a7a58", cursor: "pointer", padding: 4 }}><Icon name="menu" size={22} /></button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <img src="/logo.png" alt="BMA" style={{ width: 28, height: 28, objectFit: "contain" }} />
            <span style={{ fontFamily: "Cormorant Garamond, serif", color: "#1a5c2a", fontWeight: 700, fontSize: 15 }}>Bekwai Municipal Assembly</span>
          </div>
        </div>

        <div className="main-pad" style={{ flex: 1, padding: "28px", maxWidth: 1120, width: "100%", margin: "0 auto" }}>
          {tab === "dashboard" && <Dashboard ratepayers={ratepayers} payments={payments} officers={officers} currentOfficer={currentOfficer} />}
          {tab === "ratepayers" && (hasPermission(currentOfficer, "ratepayers") ? <Ratepayers ratepayers={ratepayers} setRatepayers={setRatepayers} addToast={addToast} /> : <AccessDenied role={currentOfficer.role} />)}
          {tab === "payments" && (hasPermission(currentOfficer, "payments") ? <Payments payments={payments} setPayments={setPayments} ratepayers={ratepayers} officers={officers} currentOfficer={currentOfficer} addToast={addToast} /> : <AccessDenied role={currentOfficer.role} />)}
          {tab === "receipts" && (hasPermission(currentOfficer, "receipts") ? <Receipts payments={payments} ratepayers={ratepayers} officers={officers} addToast={addToast} /> : <AccessDenied role={currentOfficer.role} />)}
          {tab === "defaulters" && (hasPermission(currentOfficer, "defaulters") ? <Defaulters payments={payments} ratepayers={ratepayers} addToast={addToast} /> : <AccessDenied role={currentOfficer.role} />)}
          {tab === "iam" && (hasPermission(currentOfficer, "iam") ? <IAMPage officers={officers} setOfficers={setOfficers} currentOfficer={currentOfficer} addToast={addToast} /> : <AccessDenied role={currentOfficer.role} />)}
        </div>
      </main>
    </div>
  );
}
