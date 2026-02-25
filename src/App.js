// eslint-disable-next-line
import React, { useState, useRef } from "react";

// ── Seed Data ────────────────────────────────────────────────────
const SEED_TAXPAYERS = [
  { id: "TXP-0001", name: "Kwame Asante", type: "Individual", tin: "G-10042301", phone: "0241234567", email: "k.asante@email.com", address: "Adum, Kumasi", registeredDate: "2023-01-15", status: "active" },
  { id: "TXP-0002", name: "Asante Goldfields Ltd", type: "Corporate", tin: "C-20089412", phone: "0302123456", email: "finance@agl.com", address: "Mining Ave, Obuasi", registeredDate: "2023-03-22", status: "active" },
  { id: "TXP-0003", name: "Ama Boateng", type: "Individual", tin: "G-10056789", phone: "0551987654", email: "ama.b@gmail.com", address: "Bantama, Kumasi", registeredDate: "2023-06-10", status: "active" },
  { id: "TXP-0004", name: "Nkrumah Traders Co.", type: "SME", tin: "S-30012456", phone: "0209876543", email: "nkrumahtraders@business.com", address: "Kejetia Market, Kumasi", registeredDate: "2024-01-05", status: "active" },
  { id: "TXP-0005", name: "Kofi Mensah", type: "Individual", tin: "G-10078901", phone: "0277345678", email: "kofi.m@mail.com", address: "Nhyiaeso, Kumasi", registeredDate: "2024-02-20", status: "active" },
];

const SEED_BILLS = [
  { id: "BILL-001", taxpayerId: "TXP-0001", taxpayerName: "Kwame Asante", type: "Income Tax", period: "Q1 2024", amount: 3200, dueDate: "2024-04-30", status: "paid", issuedDate: "2024-03-15" },
  { id: "BILL-002", taxpayerId: "TXP-0002", taxpayerName: "Asante Goldfields Ltd", type: "Corporate Tax", period: "FY 2023", amount: 185000, dueDate: "2024-03-31", status: "paid", issuedDate: "2024-01-10" },
  { id: "BILL-003", taxpayerId: "TXP-0003", taxpayerName: "Ama Boateng", type: "VAT", period: "Feb 2024", amount: 1450, dueDate: "2024-03-15", status: "overdue", issuedDate: "2024-02-28" },
  { id: "BILL-004", taxpayerId: "TXP-0004", taxpayerName: "Nkrumah Traders Co.", type: "Business Tax", period: "Q1 2024", amount: 8750, dueDate: "2024-05-15", status: "pending", issuedDate: "2024-04-01" },
  { id: "BILL-005", taxpayerId: "TXP-0005", taxpayerName: "Kofi Mensah", type: "Income Tax", period: "Q1 2024", amount: 920, dueDate: "2024-04-30", status: "overdue", issuedDate: "2024-03-15" },
  { id: "BILL-006", taxpayerId: "TXP-0001", taxpayerName: "Kwame Asante", type: "Property Tax", period: "2024", amount: 2100, dueDate: "2024-06-30", status: "pending", issuedDate: "2024-04-15" },
  { id: "BILL-007", taxpayerId: "TXP-0002", taxpayerName: "Asante Goldfields Ltd", type: "WHT", period: "Q1 2024", amount: 42000, dueDate: "2024-04-15", status: "paid", issuedDate: "2024-03-30" },
];

const SEED_PAYMENTS = [
  { id: "REC-001", billId: "BILL-001", taxpayerId: "TXP-0001", taxpayerName: "Kwame Asante", amount: 3200, date: "2024-04-28", method: "Bank Transfer", reference: "BNK2024042801", taxType: "Income Tax" },
  { id: "REC-002", billId: "BILL-002", taxpayerId: "TXP-0002", taxpayerName: "Asante Goldfields Ltd", amount: 185000, date: "2024-03-28", method: "RTGS", reference: "RTGS2024032801", taxType: "Corporate Tax" },
  { id: "REC-003", billId: "BILL-007", taxpayerId: "TXP-0002", taxpayerName: "Asante Goldfields Ltd", amount: 42000, date: "2024-04-14", method: "RTGS", reference: "RTGS2024041401", taxType: "WHT" },
];

// ── Utilities ────────────────────────────────────────────────────
const fmt = (n) => "GHS " + Number(n).toLocaleString("en-GH", { minimumFractionDigits: 2 });
const today = () => new Date().toISOString().split("T")[0];
const uid = (prefix) => `${prefix}-${Date.now().toString(36).toUpperCase()}`;

// ── Main App ─────────────────────────────────────────────────────
export default function TaxApp() {
  const [page, setPage] = useState("dashboard");
  const [taxpayers, setTaxpayers] = useState(SEED_TAXPAYERS);
  const [bills, setBills] = useState(SEED_BILLS);
  const [payments, setPayments] = useState(SEED_PAYMENTS);
  const [modal, setModal] = useState(null); // { type, data }
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  };

  // Derived stats
  const totalRevenue = payments.reduce((s, p) => s + p.amount, 0);
  const totalPaid = bills.filter(b => b.status === "paid").reduce((s, b) => s + b.amount, 0);
  const totalOwing = bills.filter(b => b.status !== "paid").reduce((s, b) => s + b.amount, 0);
  const overdueCount = bills.filter(b => b.status === "overdue").length;
  const overdueAmount = bills.filter(b => b.status === "overdue").reduce((s, b) => s + b.amount, 0);

  const handlePrint = (ref) => {
    const content = document.getElementById(ref);
    const win = window.open("", "_blank");
    win.document.write(`<html><head><title>Tax Authority - Document</title>
      <style>
        body { font-family: 'Georgia', serif; padding: 40px; color: #1a1a2e; }
        .header { text-align:center; border-bottom: 3px solid #c8a951; padding-bottom:16px; margin-bottom:24px; }
        .title { font-size:22px; font-weight:bold; color:#1a1a2e; }
        .subtitle { color:#666; font-size:13px; }
        table { width:100%; border-collapse:collapse; margin-top:16px; }
        th { background:#1a1a2e; color:#c8a951; padding:10px; text-align:left; }
        td { padding:10px; border-bottom:1px solid #eee; }
        .amount { font-weight:bold; font-size:18px; color:#1a1a2e; }
        .seal { text-align:center; margin-top:40px; font-style:italic; color:#888; font-size:12px; }
        @media print { body { padding: 20px; } }
      </style></head><body>
      ${content.innerHTML}
      <div class="seal">This is a computer-generated document. No signature required.</div>
      </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 300);
  };

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: "◈" },
    { id: "taxpayers", label: "Taxpayers", icon: "◉" },
    { id: "bills", label: "Bills", icon: "◎" },
    { id: "payments", label: "Payments", icon: "◆" },
    { id: "receipts", label: "Receipts", icon: "◇" },
  ];

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f0ede6", fontFamily: "'DM Serif Display', 'Georgia', serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Mono:wght@300;400;500&family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --ink: #1a1a2e;
          --gold: #c8a951;
          --gold-light: #e8d49a;
          --cream: #f0ede6;
          --parchment: #e8e2d5;
          --red: #c0392b;
          --green: #1a6b3c;
          --blue: #1a3a6b;
          --surface: #fff;
          --border: #d4cfc5;
        }
        body { overflow-x: hidden; }
        button { cursor: pointer; font-family: 'DM Sans', sans-serif; }
        input, select, textarea { font-family: 'DM Sans', sans-serif; }
        .nav-link { display:flex; align-items:center; gap:10px; padding:12px 20px; color:#9a9080; text-decoration:none; cursor:pointer; border-radius:6px; transition:all .2s; font-family:'DM Sans',sans-serif; font-size:14px; font-weight:500; border:none; background:none; width:100%; text-align:left; }
        .nav-link:hover { background:rgba(200,169,81,0.12); color:var(--gold); }
        .nav-link.active { background:var(--gold); color:var(--ink); font-weight:600; }
        .card { background:var(--surface); border-radius:12px; border:1px solid var(--border); padding:24px; }
        .stat-card { background:var(--surface); border-radius:12px; border:1px solid var(--border); padding:20px; position:relative; overflow:hidden; }
        .stat-card::before { content:''; position:absolute; top:0; left:0; right:0; height:3px; background:var(--gold); }
        .badge { display:inline-flex; align-items:center; padding:3px 10px; border-radius:20px; font-size:11px; font-weight:600; font-family:'DM Mono',monospace; }
        .badge-paid { background:#dcf5e7; color:var(--green); }
        .badge-pending { background:#fef9e7; color:#b7770d; }
        .badge-overdue { background:#fde8e6; color:var(--red); }
        .badge-active { background:#e3f0ff; color:var(--blue); }
        .btn { display:inline-flex; align-items:center; gap:6px; padding:9px 18px; border-radius:8px; font-size:13px; font-weight:600; border:none; transition:all .15s; font-family:'DM Sans',sans-serif; }
        .btn-primary { background:var(--ink); color:var(--gold); }
        .btn-primary:hover { background:#2d2d50; }
        .btn-gold { background:var(--gold); color:var(--ink); }
        .btn-gold:hover { background:#b8933f; }
        .btn-outline { background:transparent; border:1.5px solid var(--border); color:var(--ink); }
        .btn-outline:hover { border-color:var(--gold); color:var(--gold); }
        .btn-danger { background:#fde8e6; color:var(--red); border:none; }
        .table-wrap { overflow-x:auto; }
        table { width:100%; border-collapse:collapse; font-family:'DM Sans',sans-serif; font-size:13.5px; }
        th { background:var(--ink); color:var(--gold); padding:10px 14px; text-align:left; font-size:11px; letter-spacing:1px; text-transform:uppercase; font-family:'DM Mono',monospace; }
        td { padding:12px 14px; border-bottom:1px solid var(--border); color:var(--ink); vertical-align:middle; }
        tr:hover td { background:rgba(200,169,81,0.04); }
        .form-group { margin-bottom:16px; }
        .form-group label { display:block; font-size:12px; font-weight:600; color:#666; margin-bottom:6px; letter-spacing:.5px; text-transform:uppercase; font-family:'DM Mono',monospace; }
        .form-group input, .form-group select, .form-group textarea { width:100%; padding:10px 12px; border:1.5px solid var(--border); border-radius:8px; font-size:14px; background:var(--cream); color:var(--ink); outline:none; transition:border .15s; }
        .form-group input:focus, .form-group select:focus, .form-group textarea:focus { border-color:var(--gold); background:#fff; }
        .modal-overlay { position:fixed; inset:0; background:rgba(26,26,46,.6); z-index:100; display:flex; align-items:center; justify-content:center; padding:16px; backdrop-filter:blur(2px); }
        .modal { background:var(--surface); border-radius:16px; max-width:580px; width:100%; max-height:90vh; overflow-y:auto; border:1px solid var(--border); }
        .modal-header { padding:24px 24px 0; display:flex; align-items:center; justify-content:space-between; }
        .modal-body { padding:24px; }
        .toast { position:fixed; bottom:24px; right:24px; z-index:999; padding:14px 20px; border-radius:10px; font-family:'DM Sans',sans-serif; font-size:14px; font-weight:500; box-shadow:0 8px 24px rgba(0,0,0,.18); animation: slideUp .3s ease; }
        .toast-success { background:var(--green); color:#fff; }
        .toast-error { background:var(--red); color:#fff; }
        @keyframes slideUp { from { transform:translateY(20px); opacity:0; } to { transform:translateY(0); opacity:1; } }
        .page-title { font-size:28px; color:var(--ink); margin-bottom:4px; }
        .page-sub { font-size:13px; color:#888; font-family:'DM Sans',sans-serif; }
        .search-input { padding:9px 14px; border:1.5px solid var(--border); border-radius:8px; font-size:13px; background:var(--surface); color:var(--ink); outline:none; width:220px; }
        .search-input:focus { border-color:var(--gold); }
        .logo-text { font-size:20px; color:var(--gold); font-family:'DM Serif Display'; }
        .logo-sub { font-size:10px; color:#9a9080; letter-spacing:2px; text-transform:uppercase; font-family:'DM Mono',monospace; }
        @media (max-width:768px) {
          .sidebar { position:fixed; left:-260px; top:0; bottom:0; z-index:200; transition:left .25s; }
          .sidebar.open { left:0; }
          .main-content { margin-left:0 !important; }
          .mobile-header { display:flex !important; }
          .page-title { font-size:22px; }
          .stat-grid { grid-template-columns: 1fr 1fr !important; }
          .search-input { width: 100%; }
        }
        .mobile-header { display:none; align-items:center; justify-content:space-between; padding:14px 16px; background:var(--ink); }
        .hamburger { background:none; border:none; color:var(--gold); font-size:22px; cursor:pointer; }
      `}</style>

      {/* Sidebar */}
      <aside className={`sidebar${mobileMenu ? " open" : ""}`} style={{ width: 240, background: "#1a1a2e", display: "flex", flexDirection: "column", padding: "0 0 24px", borderRight: "1px solid #2d2d50", flexShrink: 0 }}>
        <div style={{ padding: "28px 20px 20px", borderBottom: "1px solid #2d2d50" }}>
          <div className="logo-text">⚖ TaxAuthority</div>
          <div className="logo-sub">Revenue Management</div>
        </div>
        <nav style={{ flex: 1, padding: "16px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
          {navItems.map(n => (
            <button key={n.id} className={`nav-link${page === n.id ? " active" : ""}`} onClick={() => { setPage(n.id); setMobileMenu(false); }}>
              <span style={{ fontSize: 16 }}>{n.icon}</span> {n.label}
            </button>
          ))}
        </nav>
        <div style={{ padding: "0 20px", fontSize: 11, color: "#4a4a6a", fontFamily: "'DM Mono', monospace" }}>
          Ghana Revenue Authority<br />
          © 2024 Tax Management System
        </div>
      </aside>

      {/* Overlay for mobile */}
      {mobileMenu && <div onClick={() => setMobileMenu(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 199 }} />}

      {/* Main */}
      <div className="main-content" style={{ flex: 1, display: "flex", flexDirection: "column", marginLeft: 0, minWidth: 0 }}>
        {/* Mobile Header */}
        <div className="mobile-header">
          <button className="hamburger" onClick={() => setMobileMenu(true)}>☰</button>
          <span className="logo-text" style={{ fontSize: 16 }}>⚖ TaxAuthority</span>
          <span style={{ width: 28 }} />
        </div>

        <main style={{ flex: 1, padding: "32px 28px", overflowY: "auto" }}>
          {page === "dashboard" && <Dashboard taxpayers={taxpayers} bills={bills} payments={payments} totalRevenue={totalRevenue} totalPaid={totalPaid} totalOwing={totalOwing} overdueCount={overdueCount} overdueAmount={overdueAmount} />}
          {page === "taxpayers" && <Taxpayers taxpayers={taxpayers} setTaxpayers={setTaxpayers} setModal={setModal} showToast={showToast} search={search} setSearch={setSearch} />}
          {page === "bills" && <Bills bills={bills} setBills={setBills} taxpayers={taxpayers} setModal={setModal} showToast={showToast} handlePrint={handlePrint} search={search} setSearch={setSearch} />}
          {page === "payments" && <Payments payments={payments} setPayments={setPayments} bills={bills} setBills={setBills} taxpayers={taxpayers} setModal={setModal} showToast={showToast} search={search} setSearch={setSearch} />}
          {page === "receipts" && <Receipts payments={payments} handlePrint={handlePrint} search={search} setSearch={setSearch} />}
        </main>
      </div>

      {/* Modals */}
      {modal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setModal(null)}>
          {modal.type === "addTaxpayer" && <AddTaxpayerModal setTaxpayers={setTaxpayers} setModal={setModal} showToast={showToast} />}
          {modal.type === "editTaxpayer" && <AddTaxpayerModal taxpayer={modal.data} setTaxpayers={setTaxpayers} setModal={setModal} showToast={showToast} />}
          {modal.type === "issueBill" && <IssueBillModal taxpayers={taxpayers} setBills={setBills} setModal={setModal} showToast={showToast} />}
          {modal.type === "recordPayment" && <RecordPaymentModal bill={modal.data} setPayments={setPayments} setBills={setBills} setModal={setModal} showToast={showToast} />}
          {modal.type === "viewBill" && <ViewBillModal bill={modal.data} handlePrint={handlePrint} setModal={setModal} />}
          {modal.type === "viewReceipt" && <ViewReceiptModal payment={modal.data} handlePrint={handlePrint} setModal={setModal} />}
        </div>
      )}

      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}

// ── Dashboard ────────────────────────────────────────────────────
function Dashboard({ taxpayers, bills, payments, totalRevenue, totalPaid, totalOwing, overdueCount, overdueAmount }) {
  const collectionRate = totalPaid > 0 ? Math.round((totalPaid / (totalPaid + totalOwing)) * 100) : 0;

  const taxBreakdown = payments.reduce((acc, p) => {
    acc[p.taxType] = (acc[p.taxType] || 0) + p.amount;
    return acc;
  }, {});

  const topOwers = bills.filter(b => b.status !== "paid")
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  const recentPayments = [...payments].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 className="page-title">Revenue Dashboard</h1>
        <p className="page-sub">Live overview · Updated {new Date().toLocaleString()}</p>
      </div>

      {/* Stats */}
      <div className="stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Total Revenue Collected", val: fmt(totalRevenue), accent: "#1a6b3c", icon: "▲" },
          { label: "Total Outstanding", val: fmt(totalOwing), accent: "#c0392b", icon: "▼" },
          { label: "Overdue Amount", val: fmt(overdueAmount), accent: "#d35400", sub: `${overdueCount} bills overdue`, icon: "⚠" },
          { label: "Collection Rate", val: `${collectionRate}%`, accent: "#1a3a6b", sub: `${taxpayers.length} taxpayers`, icon: "◉" },
        ].map((s, i) => (
          <div key={i} className="stat-card" style={{ "--gold": s.accent }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 11, color: "#888", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>{s.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: s.accent, fontFamily: "'DM Serif Display'" }}>{s.val}</div>
                {s.sub && <div style={{ fontSize: 12, color: "#888", marginTop: 4, fontFamily: "'DM Sans', sans-serif" }}>{s.sub}</div>}
              </div>
              <div style={{ fontSize: 28, color: s.accent, opacity: .2 }}>{s.icon}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Collection progress */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ fontSize: 16, color: "var(--ink)" }}>Revenue Collection Progress</h3>
          <span style={{ fontSize: 13, color: "#888", fontFamily: "'DM Sans', sans-serif" }}>Target: {fmt(totalPaid + totalOwing)}</span>
        </div>
        <div style={{ height: 14, background: "#f0ede6", borderRadius: 8, overflow: "hidden", marginBottom: 8 }}>
          <div style={{ height: "100%", width: `${collectionRate}%`, background: "linear-gradient(90deg, #1a6b3c, #2ecc71)", borderRadius: 8, transition: "width 1s ease" }} />
        </div>
        <div style={{ display: "flex", gap: 24, fontFamily: "'DM Mono', monospace", fontSize: 12 }}>
          <span style={{ color: "#1a6b3c" }}>● Collected: {fmt(totalPaid)}</span>
          <span style={{ color: "#c0392b" }}>● Outstanding: {fmt(totalOwing)}</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Tax breakdown */}
        <div className="card">
          <h3 style={{ fontSize: 16, marginBottom: 16 }}>Revenue by Tax Type</h3>
          {Object.entries(taxBreakdown).map(([k, v]) => (
            <div key={k} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>
                <span>{k}</span><span style={{ fontWeight: 600 }}>{fmt(v)}</span>
              </div>
              <div style={{ height: 6, background: "#f0ede6", borderRadius: 4 }}>
                <div style={{ height: "100%", width: `${Math.round((v / totalRevenue) * 100)}%`, background: "var(--gold)", borderRadius: 4 }} />
              </div>
            </div>
          ))}
        </div>

        {/* Top owing */}
        <div className="card">
          <h3 style={{ fontSize: 16, marginBottom: 16 }}>Top Outstanding Bills</h3>
          {topOwers.length === 0 ? <p style={{ color: "#888", fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>No outstanding bills.</p> :
            topOwers.map(b => (
              <div key={b.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #f0ede6", fontFamily: "'DM Sans', sans-serif" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{b.taxpayerName}</div>
                  <div style={{ fontSize: 11, color: "#888" }}>{b.type} · {b.period}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: b.status === "overdue" ? "var(--red)" : "var(--ink)" }}>{fmt(b.amount)}</div>
                  <span className={`badge badge-${b.status}`}>{b.status}</span>
                </div>
              </div>
            ))
          }
        </div>

        {/* Recent payments */}
        <div className="card" style={{ gridColumn: "1 / -1" }}>
          <h3 style={{ fontSize: 16, marginBottom: 16 }}>Recent Payments</h3>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Receipt</th><th>Taxpayer</th><th>Tax Type</th><th>Amount</th><th>Date</th><th>Method</th></tr></thead>
              <tbody>
                {recentPayments.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "#888" }}>{p.id}</td>
                    <td style={{ fontWeight: 500 }}>{p.taxpayerName}</td>
                    <td>{p.taxType}</td>
                    <td style={{ fontWeight: 700, color: "var(--green)" }}>{fmt(p.amount)}</td>
                    <td style={{ fontFamily: "'DM Mono', monospace", fontSize: 12 }}>{p.date}</td>
                    <td>{p.method}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Taxpayers ────────────────────────────────────────────────────
function Taxpayers({ taxpayers, setTaxpayers, setModal, showToast, search, setSearch }) {
  const filtered = taxpayers.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.tin.toLowerCase().includes(search.toLowerCase()) ||
    t.id.toLowerCase().includes(search.toLowerCase())
  );

  const del = (id) => {
  if (window.confirm("Delete this taxpayer?")) {
    setTaxpayers(prev => prev.filter(t => t.id !== id));
    showToast("Taxpayer removed.", "error");
  }
};

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 className="page-title">Taxpayers</h1>
          <p className="page-sub">{taxpayers.length} registered taxpayers</p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input className="search-input" placeholder="Search by name, TIN…" value={search} onChange={e => setSearch(e.target.value)} />
          <button className="btn btn-primary" onClick={() => setModal({ type: "addTaxpayer" })}>+ Register Taxpayer</button>
        </div>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead><tr><th>ID</th><th>Name</th><th>TIN</th><th>Type</th><th>Phone</th><th>Address</th><th>Registered</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id}>
                  <td style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "#888" }}>{t.id}</td>
                  <td style={{ fontWeight: 600 }}>{t.name}</td>
                  <td style={{ fontFamily: "'DM Mono', monospace", fontSize: 12 }}>{t.tin}</td>
                  <td>{t.type}</td>
                  <td style={{ fontFamily: "'DM Mono', monospace", fontSize: 12 }}>{t.phone}</td>
                  <td style={{ color: "#666", fontSize: 13 }}>{t.address}</td>
                  <td style={{ fontFamily: "'DM Mono', monospace", fontSize: 12 }}>{t.registeredDate}</td>
                  <td><span className={`badge badge-${t.status}`}>{t.status}</span></td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn btn-outline" style={{ padding: "5px 10px", fontSize: 12 }} onClick={() => setModal({ type: "editTaxpayer", data: t })}>Edit</button>
                      <button className="btn btn-danger" style={{ padding: "5px 10px", fontSize: 12 }} onClick={() => del(t.id)}>Del</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={9} style={{ textAlign: "center", padding: 32, color: "#888", fontFamily: "'DM Sans', sans-serif" }}>No taxpayers found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Bills ────────────────────────────────────────────────────────
function Bills({ bills, setBills, taxpayers, setModal, showToast, handlePrint, search, setSearch }) {
  const [filter, setFilter] = useState("all");
  const filtered = bills.filter(b => {
    const matchSearch = b.taxpayerName.toLowerCase().includes(search.toLowerCase()) || b.id.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || b.status === filter;
    return matchSearch && matchFilter;
  });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 className="page-title">Bills</h1>
          <p className="page-sub">{bills.length} total bills issued</p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input className="search-input" placeholder="Search bills…" value={search} onChange={e => setSearch(e.target.value)} />
          <button className="btn btn-primary" onClick={() => setModal({ type: "issueBill" })}>+ Issue Bill</button>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["all", "paid", "pending", "overdue"].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: "6px 16px", borderRadius: 20, border: "1.5px solid", borderColor: filter === f ? "var(--gold)" : "var(--border)", background: filter === f ? "var(--gold)" : "transparent", color: filter === f ? "var(--ink)" : "#666", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Mono', monospace", textTransform: "capitalize" }}>
            {f}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Bill ID</th><th>Taxpayer</th><th>Tax Type</th><th>Period</th><th>Amount</th><th>Due Date</th><th>Issued</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.map(b => (
                <tr key={b.id}>
                  <td style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "#888" }}>{b.id}</td>
                  <td style={{ fontWeight: 600 }}>{b.taxpayerName}</td>
                  <td>{b.type}</td>
                  <td style={{ fontSize: 12, color: "#666" }}>{b.period}</td>
                  <td style={{ fontWeight: 700 }}>{fmt(b.amount)}</td>
                  <td style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: b.status === "overdue" ? "var(--red)" : "inherit" }}>{b.dueDate}</td>
                  <td style={{ fontFamily: "'DM Mono', monospace", fontSize: 12 }}>{b.issuedDate}</td>
                  <td><span className={`badge badge-${b.status}`}>{b.status}</span></td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn btn-outline" style={{ padding: "5px 10px", fontSize: 12 }} onClick={() => setModal({ type: "viewBill", data: b })}>View/Print</button>
                      {b.status !== "paid" && <button className="btn btn-gold" style={{ padding: "5px 10px", fontSize: 12 }} onClick={() => setModal({ type: "recordPayment", data: b })}>Pay</button>}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={9} style={{ textAlign: "center", padding: 32, color: "#888", fontFamily: "'DM Sans', sans-serif" }}>No bills found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Payments ─────────────────────────────────────────────────────
function Payments({ payments, setPayments, bills, setBills, taxpayers, setModal, showToast, search, setSearch }) {
  const filtered = payments.filter(p =>
    p.taxpayerName.toLowerCase().includes(search.toLowerCase()) ||
    p.id.toLowerCase().includes(search.toLowerCase()) ||
    p.reference.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 className="page-title">Payments</h1>
          <p className="page-sub">{payments.length} payments recorded · Total: {fmt(payments.reduce((s, p) => s + p.amount, 0))}</p>
        </div>
        <input className="search-input" placeholder="Search payments…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Receipt ID</th><th>Bill</th><th>Taxpayer</th><th>Tax Type</th><th>Amount</th><th>Date</th><th>Method</th><th>Reference</th><th>Action</th></tr></thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id}>
                  <td style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "var(--green)", fontWeight: 700 }}>{p.id}</td>
                  <td style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "#888" }}>{p.billId}</td>
                  <td style={{ fontWeight: 600 }}>{p.taxpayerName}</td>
                  <td>{p.taxType}</td>
                  <td style={{ fontWeight: 700, color: "var(--green)" }}>{fmt(p.amount)}</td>
                  <td style={{ fontFamily: "'DM Mono', monospace", fontSize: 12 }}>{p.date}</td>
                  <td>{p.method}</td>
                  <td style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#888" }}>{p.reference}</td>
                  <td>
                    <button className="btn btn-outline" style={{ padding: "5px 10px", fontSize: 12 }} onClick={() => setModal({ type: "viewReceipt", data: p })}>Receipt</button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={9} style={{ textAlign: "center", padding: 32, color: "#888", fontFamily: "'DM Sans', sans-serif" }}>No payments found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Receipts ─────────────────────────────────────────────────────
function Receipts({ payments, handlePrint, search, setSearch }) {
  const filtered = payments.filter(p =>
    p.taxpayerName.toLowerCase().includes(search.toLowerCase()) ||
    p.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 className="page-title">Receipts</h1>
          <p className="page-sub">All issued receipts</p>
        </div>
        <input className="search-input" placeholder="Search receipts…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
        {filtered.map(p => (
          <div key={p.id} className="card" style={{ position: "relative", borderLeft: "4px solid var(--green)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: "var(--green)", fontWeight: 700 }}>{p.id}</span>
              <span style={{ fontSize: 11, color: "#888", fontFamily: "'DM Mono', monospace" }}>{p.date}</span>
            </div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{p.taxpayerName}</div>
            <div style={{ fontSize: 13, color: "#666", fontFamily: "'DM Sans', sans-serif", marginBottom: 12 }}>{p.taxType} · {p.method}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--ink)", marginBottom: 4, fontFamily: "'DM Serif Display'" }}>{fmt(p.amount)}</div>
            <div style={{ fontSize: 11, color: "#888", fontFamily: "'DM Mono', monospace", marginBottom: 16 }}>REF: {p.reference}</div>
            <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={() => {
              // inline print
              const win = window.open("", "_blank");
              win.document.write(`<html><head><title>Receipt ${p.id}</title>
                <style>
                  body{font-family:Georgia,serif;padding:60px;max-width:500px;margin:0 auto;color:#1a1a2e}
                  .header{text-align:center;border-bottom:3px solid #c8a951;padding-bottom:20px;margin-bottom:30px}
                  .logo{font-size:24px;font-weight:bold;color:#1a1a2e}
                  .tag{font-size:11px;color:#888;letter-spacing:2px;text-transform:uppercase;margin-top:4px}
                  .rec-title{font-size:20px;color:#1a6b3c;margin-top:20px;letter-spacing:1px}
                  .row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #eee;font-size:14px}
                  .label{color:#666}
                  .val{font-weight:600}
                  .amount-box{background:#1a1a2e;color:#c8a951;text-align:center;padding:20px;border-radius:8px;margin:24px 0;font-size:28px;font-weight:bold}
                  .seal{text-align:center;margin-top:40px;font-style:italic;color:#aaa;font-size:12px}
                  .stamp{display:inline-block;border:3px solid #1a6b3c;border-radius:50%;padding:14px;color:#1a6b3c;font-weight:bold;font-size:14px;text-align:center;margin-top:20px}
                </style></head><body>
                <div class="header">
                  <div class="logo">⚖ Ghana Revenue Authority</div>
                  <div class="tag">Official Payment Receipt</div>
                  <div class="rec-title">RECEIPT</div>
                </div>
                <div class="row"><span class="label">Receipt No.</span><span class="val">${p.id}</span></div>
                <div class="row"><span class="label">Taxpayer</span><span class="val">${p.taxpayerName}</span></div>
                <div class="row"><span class="label">Bill Reference</span><span class="val">${p.billId}</span></div>
                <div class="row"><span class="label">Tax Type</span><span class="val">${p.taxType}</span></div>
                <div class="row"><span class="label">Payment Date</span><span class="val">${p.date}</span></div>
                <div class="row"><span class="label">Payment Method</span><span class="val">${p.method}</span></div>
                <div class="row"><span class="label">Transaction Ref</span><span class="val">${p.reference}</span></div>
                <div class="amount-box">GHS ${Number(p.amount).toLocaleString("en-GH", { minimumFractionDigits: 2 })}</div>
                <div style="text-align:center"><span class="stamp">PAID ✓</span></div>
                <div class="seal">This is an official receipt. Keep for your records.<br>Ghana Revenue Authority · Tax Management System</div>
              </body></html>`);
              win.document.close();
              setTimeout(() => { win.print(); win.close(); }, 300);
            }}>🖨 Print Receipt</button>
          </div>
        ))}
        {filtered.length === 0 && <p style={{ color: "#888", fontFamily: "'DM Sans', sans-serif" }}>No receipts found.</p>}
      </div>
    </div>
  );
}

// ── Modals ────────────────────────────────────────────────────────
function AddTaxpayerModal({ taxpayer, setTaxpayers, setModal, showToast }) {
  const editing = !!taxpayer;
  const [form, setForm] = useState(taxpayer || { name: "", type: "Individual", tin: "", phone: "", email: "", address: "" });
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const submit = () => {
    if (!form.name || !form.tin) return alert("Name and TIN are required.");
    if (editing) {
      setTaxpayers(prev => prev.map(t => t.id === taxpayer.id ? { ...t, ...form } : t));
      showToast("Taxpayer updated.");
    } else {
      const id = uid("TXP");
      setTaxpayers(prev => [...prev, { ...form, id, registeredDate: today(), status: "active" }]);
      showToast("Taxpayer registered!");
    }
    setModal(null);
  };

  return (
    <div className="modal">
      <div className="modal-header">
        <h2 style={{ fontSize: 20 }}>{editing ? "Edit Taxpayer" : "Register Taxpayer"}</h2>
        <button className="btn btn-outline" style={{ padding: "6px 12px" }} onClick={() => setModal(null)}>✕</button>
      </div>
      <div className="modal-body">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div className="form-group" style={{ gridColumn: "1/-1" }}><label>Full Name / Company Name</label><input value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Kofi Mensah" /></div>
          <div className="form-group"><label>TIN</label><input value={form.tin} onChange={e => set("tin", e.target.value)} placeholder="G-10000000" /></div>
          <div className="form-group"><label>Type</label><select value={form.type} onChange={e => set("type", e.target.value)}><option>Individual</option><option>Corporate</option><option>SME</option><option>NGO</option></select></div>
          <div className="form-group"><label>Phone</label><input value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="02XXXXXXXX" /></div>
          <div className="form-group"><label>Email</label><input value={form.email} onChange={e => set("email", e.target.value)} placeholder="email@example.com" /></div>
          <div className="form-group" style={{ gridColumn: "1/-1" }}><label>Address</label><textarea value={form.address} onChange={e => set("address", e.target.value)} rows={2} placeholder="Street, City" /></div>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
          <button className="btn btn-outline" onClick={() => setModal(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={submit}>{editing ? "Save Changes" : "Register"}</button>
        </div>
      </div>
    </div>
  );
}

function IssueBillModal({ taxpayers, setBills, setModal, showToast }) {
  const [form, setForm] = useState({ taxpayerId: "", type: "Income Tax", period: "", amount: "", dueDate: "" });
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const submit = () => {
    if (!form.taxpayerId || !form.amount || !form.dueDate || !form.period) return alert("All fields required.");
    const tp = taxpayers.find(t => t.id === form.taxpayerId);
    const bill = { id: uid("BILL"), taxpayerId: form.taxpayerId, taxpayerName: tp.name, type: form.type, period: form.period, amount: parseFloat(form.amount), dueDate: form.dueDate, status: "pending", issuedDate: today() };
    setBills(prev => [...prev, bill]);
    showToast("Bill issued!");
    setModal(null);
  };

  return (
    <div className="modal">
      <div className="modal-header">
        <h2 style={{ fontSize: 20 }}>Issue New Bill</h2>
        <button className="btn btn-outline" style={{ padding: "6px 12px" }} onClick={() => setModal(null)}>✕</button>
      </div>
      <div className="modal-body">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div className="form-group" style={{ gridColumn: "1/-1" }}><label>Taxpayer</label>
            <select value={form.taxpayerId} onChange={e => set("taxpayerId", e.target.value)}>
              <option value="">— Select taxpayer —</option>
              {taxpayers.map(t => <option key={t.id} value={t.id}>{t.name} ({t.tin})</option>)}
            </select>
          </div>
          <div className="form-group"><label>Tax Type</label><select value={form.type} onChange={e => set("type", e.target.value)}><option>Income Tax</option><option>Corporate Tax</option><option>VAT</option><option>Property Tax</option><option>Business Tax</option><option>WHT</option><option>Capital Gains</option></select></div>
          <div className="form-group"><label>Period</label><input value={form.period} onChange={e => set("period", e.target.value)} placeholder="e.g. Q2 2024" /></div>
          <div className="form-group"><label>Amount (GHS)</label><input type="number" value={form.amount} onChange={e => set("amount", e.target.value)} placeholder="0.00" /></div>
          <div className="form-group"><label>Due Date</label><input type="date" value={form.dueDate} onChange={e => set("dueDate", e.target.value)} /></div>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
          <button className="btn btn-outline" onClick={() => setModal(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={submit}>Issue Bill</button>
        </div>
      </div>
    </div>
  );
}

function RecordPaymentModal({ bill, setPayments, setBills, setModal, showToast }) {
  const [form, setForm] = useState({ method: "Bank Transfer", reference: "", date: today() });
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const submit = () => {
    if (!form.reference) return alert("Transaction reference required.");
    const payment = { id: uid("REC"), billId: bill.id, taxpayerId: bill.taxpayerId, taxpayerName: bill.taxpayerName, amount: bill.amount, date: form.date, method: form.method, reference: form.reference, taxType: bill.type };
    setPayments(prev => [...prev, payment]);
    setBills(prev => prev.map(b => b.id === bill.id ? { ...b, status: "paid" } : b));
    showToast("Payment recorded & receipt generated!");
    setModal(null);
  };

  return (
    <div className="modal">
      <div className="modal-header">
        <h2 style={{ fontSize: 20 }}>Record Payment</h2>
        <button className="btn btn-outline" style={{ padding: "6px 12px" }} onClick={() => setModal(null)}>✕</button>
      </div>
      <div className="modal-body">
        <div className="card" style={{ background: "#f0ede6", marginBottom: 20 }}>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{bill.taxpayerName}</div>
            <div style={{ color: "#666" }}>{bill.type} · {bill.period} · Bill: {bill.id}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--ink)", marginTop: 8, fontFamily: "'DM Serif Display'" }}>{fmt(bill.amount)}</div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div className="form-group"><label>Payment Method</label><select value={form.method} onChange={e => set("method", e.target.value)}><option>Bank Transfer</option><option>RTGS</option><option>Mobile Money</option><option>Cash</option><option>Cheque</option></select></div>
          <div className="form-group"><label>Payment Date</label><input type="date" value={form.date} onChange={e => set("date", e.target.value)} /></div>
          <div className="form-group" style={{ gridColumn: "1/-1" }}><label>Transaction Reference</label><input value={form.reference} onChange={e => set("reference", e.target.value)} placeholder="Bank/Mobile Money reference" /></div>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
          <button className="btn btn-outline" onClick={() => setModal(null)}>Cancel</button>
          <button className="btn btn-gold" onClick={submit}>Confirm Payment</button>
        </div>
      </div>
    </div>
  );
}

function ViewBillModal({ bill, handlePrint, setModal }) {
  return (
    <div className="modal">
      <div className="modal-header">
        <h2 style={{ fontSize: 20 }}>Bill Details</h2>
        <button className="btn btn-outline" style={{ padding: "6px 12px" }} onClick={() => setModal(null)}>✕</button>
      </div>
      <div className="modal-body">
        <div id="bill-print-area">
          <div style={{ textAlign: "center", borderBottom: "3px solid #c8a951", paddingBottom: 16, marginBottom: 24 }}>
            <div style={{ fontSize: 22, fontWeight: 700 }}>⚖ Ghana Revenue Authority</div>
            <div style={{ fontSize: 12, color: "#888", letterSpacing: 2, textTransform: "uppercase", marginTop: 4 }}>Official Tax Bill</div>
            <div style={{ fontSize: 18, color: "#1a3a6b", marginTop: 12, fontFamily: "'DM Serif Display'" }}>TAX BILL</div>
          </div>
          {[["Bill Number", bill.id], ["Issued Date", bill.issuedDate], ["Taxpayer", bill.taxpayerName], ["Tax Type", bill.type], ["Period", bill.period], ["Due Date", bill.dueDate]].map(([l, v]) => (
            <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #f0ede6", fontFamily: "'DM Sans', sans-serif", fontSize: 14 }}>
              <span style={{ color: "#666" }}>{l}</span><span style={{ fontWeight: 600 }}>{v}</span>
            </div>
          ))}
          <div style={{ background: "#1a1a2e", color: "#c8a951", textAlign: "center", padding: 20, borderRadius: 8, margin: "24px 0" }}>
            <div style={{ fontSize: 12, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Amount Due</div>
            <div style={{ fontSize: 32, fontWeight: 700, fontFamily: "'DM Serif Display'" }}>{fmt(bill.amount)}</div>
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <span className={`badge badge-${bill.status}`} style={{ fontSize: 14, padding: "6px 20px" }}>{bill.status.toUpperCase()}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
          <button className="btn btn-outline" onClick={() => setModal(null)}>Close</button>
          <button className="btn btn-primary" onClick={() => handlePrint("bill-print-area")}>🖨 Print Bill</button>
        </div>
      </div>
    </div>
  );
}

function ViewReceiptModal({ payment, handlePrint, setModal }) {
  return (
    <div className="modal">
      <div className="modal-header">
        <h2 style={{ fontSize: 20 }}>Receipt</h2>
        <button className="btn btn-outline" style={{ padding: "6px 12px" }} onClick={() => setModal(null)}>✕</button>
      </div>
      <div className="modal-body">
        <div id="receipt-print-area">
          <div style={{ textAlign: "center", borderBottom: "3px solid #c8a951", paddingBottom: 16, marginBottom: 24 }}>
            <div style={{ fontSize: 22, fontWeight: 700 }}>⚖ Ghana Revenue Authority</div>
            <div style={{ fontSize: 12, color: "#888", letterSpacing: 2, textTransform: "uppercase", marginTop: 4 }}>Official Payment Receipt</div>
            <div style={{ fontSize: 18, color: "#1a6b3c", marginTop: 12, fontFamily: "'DM Serif Display'" }}>PAYMENT RECEIPT</div>
          </div>
          {[["Receipt No.", payment.id], ["Taxpayer", payment.taxpayerName], ["Bill Reference", payment.billId], ["Tax Type", payment.taxType], ["Payment Date", payment.date], ["Payment Method", payment.method], ["Transaction Ref.", payment.reference]].map(([l, v]) => (
            <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #f0ede6", fontFamily: "'DM Sans', sans-serif", fontSize: 14 }}>
              <span style={{ color: "#666" }}>{l}</span><span style={{ fontWeight: 600 }}>{v}</span>
            </div>
          ))}
          <div style={{ background: "#1a1a2e", color: "#c8a951", textAlign: "center", padding: 20, borderRadius: 8, margin: "24px 0" }}>
            <div style={{ fontSize: 12, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Amount Paid</div>
            <div style={{ fontSize: 32, fontWeight: 700, fontFamily: "'DM Serif Display'" }}>{fmt(payment.amount)}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <span style={{ border: "3px solid #1a6b3c", borderRadius: "50%", padding: "12px 20px", color: "#1a6b3c", fontWeight: 700, fontSize: 16, fontFamily: "'DM Mono', monospace" }}>✓ PAID</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
          <button className="btn btn-outline" onClick={() => setModal(null)}>Close</button>
          <button className="btn btn-primary" onClick={() => handlePrint("receipt-print-area")}>🖨 Print Receipt</button>
        </div>
      </div>
    </div>
  );
}
