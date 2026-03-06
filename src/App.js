import { useState, useEffect, useCallback, useRef } from "react";
import { auth, db, storage } from "./firebase";
import {
  signInWithEmailAndPassword, signOut,
  createUserWithEmailAndPassword, onAuthStateChanged,
  sendPasswordResetEmail,
} from "firebase/auth";
import {
  collection, doc, getDoc, setDoc, updateDoc, addDoc,
  onSnapshot, query, orderBy, serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

// =============================================================================
// BEKWAI MUNICIPAL ASSEMBLY — REVENUE MANAGEMENT SYSTEM
// Full-featured edition with all high + medium priority features
// =============================================================================

const ROLES = {
  SUPER_ADMIN:     { label:"Super Administrator", color:"#7c3aed", bg:"rgba(124,58,237,0.1)", permissions:["dashboard","ratepayers","payments","receipts","defaulters","iam","reports","audit"], description:"Full system access including officer management" },
  REVENUE_MANAGER: { label:"Revenue Manager",     color:"#1a5c2a", bg:"rgba(26,92,42,0.1)",   permissions:["dashboard","ratepayers","payments","receipts","defaulters","reports"],             description:"Full revenue operations — no IAM access" },
  COLLECTOR:       { label:"Revenue Collector",   color:"#0369a1", bg:"rgba(3,105,161,0.1)",  permissions:["dashboard","payments","receipts"],                                                  description:"Collect payments and print receipts only" },
  REGISTRAR:       { label:"Registrar",           color:"#b45309", bg:"rgba(180,83,9,0.1)",   permissions:["dashboard","ratepayers"],                                                           description:"Register and manage ratepayers only" },
  AUDITOR:         { label:"Auditor",             color:"#0f766e", bg:"rgba(15,118,110,0.1)", permissions:["dashboard","payments","receipts","defaulters","reports","audit"],                   description:"Read-only access to financial records" },
};

const LEVY_TYPES = ["Property Rate","Basic Rate","Business Operating Permit","Market Tolls","Hawkers & Traders Levy","Building Permit Fee","Sanitation Levy","Advertisement Permit","Slaughterhouse Fee","Burial Permit Fee"];
const WARDS      = ["All Wards","Central Ward","Market Ward","Ankaase Ward","Dominase Ward","Jacobu Ward","New Town Ward","Industrial Ward","Manso Ward"];
const MOMO_NETS  = ["MTN Mobile Money","Telecel Cash","AirtelTigo Money"];
const SESSION_MS = 30 * 60 * 1000;

const fmt     = n  => `GH₵ ${Number(n).toLocaleString("en-GH",{minimumFractionDigits:2})}`;
const fmtDate = d  => d ? new Date(d).toLocaleDateString("en-GH",{day:"2-digit",month:"short",year:"numeric"}) : "—";
const today   = () => new Date().toISOString().split("T")[0];
const canDo   = (o,p) => o && ROLES[o.role]?.permissions.includes(p);

async function logAudit(officerId, officerName, action, details) {
  try { await addDoc(collection(db,"audit_logs"),{ officerId, officerName, action, details, timestamp: serverTimestamp() }); }
  catch(e){ console.warn("Audit log failed:", e.message); }
}

// ─── PRINT ────────────────────────────────────────────────────────────────────
const PS=`body{font-family:Georgia,serif;max-width:620px;margin:40px auto;padding:24px;color:#111}.hdr{text-align:center;padding-bottom:16px;margin-bottom:16px;border-bottom:3px double #1a5c2a}.org{font-size:18px;font-weight:bold;color:#1a5c2a;letter-spacing:1px}.sub{font-size:12px;color:#555;margin-top:2px}.motto{font-size:11px;color:#8a6a00;font-style:italic;margin-top:3px}h2{color:#1a5c2a;margin:0 0 14px}.row{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #eee}.lbl{color:#555;font-size:13px}.val{font-weight:bold;font-size:13px}.amt{font-size:26px;font-weight:bold;text-align:center;padding:16px;border-radius:8px;margin:16px 0}.stamp{display:inline-block;border:3px solid;padding:7px 18px;border-radius:4px;font-weight:bold;font-size:15px;transform:rotate(-10deg);margin-top:8px}.note{padding:11px;margin:12px 0;font-size:12px;border-left:4px solid;border-radius:0 6px 6px 0}.ftr{text-align:center;color:#888;font-size:11px;margin-top:26px;border-top:1px solid #eee;padding-top:13px}table{width:100%;border-collapse:collapse;margin:12px 0}th{background:#f0faf2;color:#1a5c2a;padding:8px;font-size:12px;text-align:left}td{padding:7px 8px;font-size:12px;border-bottom:1px solid #eee}`;
const HDR=`<div class="hdr"><img src="${window.location.origin}/logo.png" alt="BMA Logo" style="width:60px;height:60px;object-fit:contain;margin-bottom:6px;" /><div class="org">BEKWAI MUNICIPAL ASSEMBLY</div><div class="sub">Ashanti Region, Ghana | Revenue &amp; Rating Department</div><div class="motto">"Unity, Progress &amp; Development"</div></div>`;
function openPrint(html){const w=window.open("","_blank","width=800,height=600");w.document.write(html);w.document.close();w.focus();setTimeout(()=>{w.print();w.close();},600);}
function receiptHTML(p,rp,off){const momoInfo=p.paymentMethod==="Mobile Money"?`<div class="row"><span class="lbl">Payment Method</span><span class="val">📱 ${p.momoNetwork||"Mobile Money"}</span></div><div class="row"><span class="lbl">MoMo Reference</span><span class="val">${p.momoRef||"—"}</span></div>`:"";return `<!DOCTYPE html><html><head><title>${p.receiptNo}</title><style>${PS}</style></head><body>${HDR}<h2>Official Revenue Receipt</h2><div class="row"><span class="lbl">Receipt No.</span><span class="val">${p.receiptNo}</span></div><div class="row"><span class="lbl">Ratepayer</span><span class="val">${rp.name}</span></div><div class="row"><span class="lbl">PIN</span><span class="val">${rp.pin}</span></div><div class="row"><span class="lbl">Ward</span><span class="val">${rp.ward}</span></div><div class="row"><span class="lbl">Levy Type</span><span class="val">${p.type}</span></div><div class="row"><span class="lbl">Period</span><span class="val">${p.period}</span></div><div class="row"><span class="lbl">Payment Date</span><span class="val">${fmtDate(p.date)}</span></div>${momoInfo}<div class="row"><span class="lbl">Collected By</span><span class="val">${off?off.name+" ("+off.staffId+")":"—"}</span></div><div class="amt" style="background:#f0faf3;color:#1a5c2a">Amount Paid: ${fmt(p.amount)}</div><div style="text-align:center"><span class="stamp" style="border-color:#1a5c2a;color:#1a5c2a">PAID IN FULL ✓</span></div><div class="ftr">Official receipt — Bekwai Municipal Assembly | Printed: ${fmtDate(today())}</div></body></html>`;}
function billHTML(p,rp){const ov=p.dueDate<today()&&p.status==="owing";return `<!DOCTYPE html><html><head><title>Bill ${p.id}</title><style>${PS}</style></head><body>${HDR}<h2>Demand Notice / Rate Bill</h2><div class="row"><span class="lbl">Bill Ref</span><span class="val">${p.id}</span></div><div class="row"><span class="lbl">Ratepayer</span><span class="val">${rp.name}</span></div><div class="row"><span class="lbl">PIN</span><span class="val">${rp.pin}</span></div><div class="row"><span class="lbl">Ward</span><span class="val">${rp.ward}</span></div><div class="row"><span class="lbl">Levy Type</span><span class="val">${p.type}</span></div><div class="row"><span class="lbl">Period</span><span class="val">${p.period}</span></div><div class="row"><span class="lbl">Due Date</span><span class="val">${fmtDate(p.dueDate)}</span></div><div class="amt" style="background:${ov?"#fff0f0":"#fffbf0"};color:${ov?"#c0392b":"#8a6a00"}">Amount Due: ${fmt(p.amount)}</div><div class="note" style="background:${ov?"#fff0f0":"#fffbf0"};border-color:${ov?"#c0392b":"#c9a800"}">${ov?"⚠️ OVERDUE — Failure to pay may result in legal action under the Local Governance Act, 2016 (Act 936).":"📅 Please pay on or before "+fmtDate(p.dueDate)+" to avoid surcharges."}</div><div class="ftr">Pay at Bekwai Municipal Assembly Revenue Office or via Mobile Money (MTN/Telecel/AirtelTigo). Quote Ref: ${p.id}</div></body></html>`;}

// ─── ICONS ────────────────────────────────────────────────────────────────────
const IP={dashboard:"M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",users:"M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",payments:"M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z",receipt:"M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01",alert:"M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",shield:"M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",plus:"M12 4v16m8-8H4",search:"M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",print:"M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z",check:"M5 13l4 4L19 7",x:"M6 18L18 6M6 6l12 12",trend:"M13 7h8m0 0v8m0-8l-8 8-4-4-6 6",menu:"M4 6h16M4 12h16M4 18h16",logout:"M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1",lock:"M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",eye:"M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z",eyeoff:"M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21",edit:"M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",ban:"M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636",wifi:"M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0",phone:"M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z",map:"M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z",camera:"M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z M15 13a3 3 0 11-6 0 3 3 0 016 0z",clock:"M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",download:"M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4",chart:"M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",list:"M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",trash:"M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16",refresh:"M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"};
function Ic({n,s=18}){return <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d={IP[n]||IP.check}/></svg>;}

// ─── SHARED UI ────────────────────────────────────────────────────────────────
const inp ={width:"100%",background:"#f8faf8",border:"1px solid #d4e8d4",borderRadius:8,padding:"10px 14px",color:"#1a2e1a",fontSize:14,boxSizing:"border-box",outline:"none",fontFamily:"inherit"};
const sel ={...inp,cursor:"pointer"};
const card={background:"#fff",border:"1px solid #e8f0e8",borderRadius:14,boxShadow:"0 2px 8px rgba(26,92,42,0.05)"};
const btn =(c="#1a5c2a")=>({display:"flex",alignItems:"center",gap:7,background:`linear-gradient(135deg,${c},${c}dd)`,color:"#fff",border:"none",borderRadius:10,padding:"10px 16px",cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"inherit"});

function Fld({label,children}){return <div style={{marginBottom:16}}><label style={{display:"block",fontSize:11,color:"#4a7a58",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.07em",fontWeight:700}}>{label}</label>{children}</div>;}
function Toast({toasts}){return <div style={{position:"fixed",top:16,right:16,zIndex:9999,display:"flex",flexDirection:"column",gap:8,pointerEvents:"none"}}>{toasts.map(t=><div key={t.id} style={{background:t.type==="success"?"#14532d":t.type==="error"?"#7f1d1d":t.type==="offline"?"#374151":t.type==="warning"?"#92400e":"#1e3a5f",color:"#fff",padding:"11px 16px",borderRadius:10,fontSize:13,boxShadow:"0 4px 20px rgba(0,0,0,0.25)",display:"flex",alignItems:"center",gap:8,fontFamily:"inherit",animation:"slideIn 0.3s ease"}}><Ic n={t.type==="success"?"check":t.type==="offline"?"wifi":t.type==="warning"?"clock":"alert"} s={15}/>{t.msg}</div>)}</div>;}
function Modal({title,onClose,children,wide=false,fullscreen=false}){const mw=fullscreen?"98vw":wide?720:540;return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={e=>e.target===e.currentTarget&&onClose()}><div style={{...card,width:"100%",maxWidth:mw,maxHeight:"94vh",overflowY:"auto"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"18px 24px",borderBottom:"1px solid #f0f0f0",position:"sticky",top:0,background:"#fff",zIndex:1}}><h3 style={{margin:0,color:"#1a2e1a",fontSize:17,fontFamily:"Cormorant Garamond,serif"}}>{title}</h3><button onClick={onClose} style={{background:"none",border:"none",color:"#9ab89a",cursor:"pointer",padding:4}}><Ic n="x" s={20}/></button></div><div style={{padding:24}}>{children}</div></div></div>;}
function StatCard({label,value,icon,color,sub,onClick}){return <div onClick={onClick} style={{...card,padding:"20px 22px",position:"relative",overflow:"hidden",cursor:onClick?"pointer":"default"}}><div style={{position:"absolute",top:0,right:0,width:70,height:70,background:color+"18",borderRadius:"0 14px 0 70px"}}/><div style={{position:"absolute",top:14,right:14,color}}><Ic n={icon} s={20}/></div><div style={{fontSize:11,color:"#7a9a78",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8,fontWeight:700}}>{label}</div><div style={{fontSize:26,fontWeight:700,color:"#1a2e1a",fontFamily:"Cormorant Garamond,serif",lineHeight:1.2}}>{value}</div>{sub&&<div style={{fontSize:12,color:"#9ab89a",marginTop:5}}>{sub}</div>}</div>;}
function AccessDenied({role}){return <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:80,textAlign:"center"}}><div style={{fontSize:52,marginBottom:16}}>🔒</div><h3 style={{fontFamily:"Cormorant Garamond,serif",color:"#1a2e1a",fontSize:22,margin:"0 0 8px"}}>Access Restricted</h3><p style={{color:"#4a7a58",fontSize:14,maxWidth:360,margin:0}}>Your role <strong>({ROLES[role]?.label})</strong> does not have permission to access this section.</p></div>;}
function LoadingScreen({msg="Loading…"}){return <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"#f0faf2",fontFamily:"Outfit,sans-serif"}}><style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600&display=swap');@keyframes bar{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}`}</style><img src="/logo.png" alt="BMA" style={{width:56,height:56,objectFit:"contain",marginBottom:16}}/><div style={{fontSize:14,color:"#4a7a58",fontWeight:500,marginBottom:14}}>{msg}</div><div style={{width:44,height:3,background:"#c8e6c8",borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",background:"#1a5c2a",borderRadius:2,animation:"bar 1.1s ease-in-out infinite"}}/></div></div>;}
function OfflineBanner({show}){if(!show)return null;return <div style={{background:"#374151",color:"#e5e7eb",textAlign:"center",padding:"7px 16px",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}><Ic n="wifi" s={13}/>Offline — data will sync when connected</div>;}
function SessionBanner({remaining}){if(!remaining||remaining>5*60*1000)return null;const mins=Math.floor(remaining/60000);const secs=Math.floor((remaining%60000)/1000);return <div style={{background:"#92400e",color:"#fef3c7",textAlign:"center",padding:"7px 16px",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center",gap:8,fontWeight:600}}><Ic n="clock" s={13}/>Session expires in {mins}:{String(secs).padStart(2,"0")} — move your mouse to stay signed in</div>;}

// ─── GPS ──────────────────────────────────────────────────────────────────────
function useGPS(){
  const [gps,setGps]=useState(null);const [gpsLoading,setGpsLoading]=useState(false);const [gpsError,setGpsError]=useState(null);
  function capture(){if(!navigator.geolocation){setGpsError("GPS not supported");return;}setGpsLoading(true);setGpsError(null);navigator.geolocation.getCurrentPosition(pos=>{setGps({lat:pos.coords.latitude,lng:pos.coords.longitude,accuracy:Math.round(pos.coords.accuracy)});setGpsLoading(false);},err=>{setGpsError("Could not get location: "+err.message);setGpsLoading(false);},{enableHighAccuracy:true,timeout:10000});}
  return {gps,gpsLoading,gpsError,capture};
}
async function uploadImage(file,path){const r=ref(storage,path);await uploadBytes(r,file);return await getDownloadURL(r);}
function GPSField({gps,gpsLoading,gpsError,onCapture}){return <div style={{marginBottom:16}}><label style={{display:"block",fontSize:11,color:"#4a7a58",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.07em",fontWeight:700}}>GPS Location</label><div style={{display:"flex",gap:8,alignItems:"flex-start"}}><div style={{flex:1,background:"#f8faf8",border:"1px solid #d4e8d4",borderRadius:8,padding:"10px 14px",fontSize:13,color:gps?"#1a2e1a":"#9ab89a",minHeight:42,display:"flex",alignItems:"center",gap:6}}>{gpsLoading?<><div style={{width:12,height:12,border:"2px solid #1a5c2a",borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>Getting location…</>:gps?<><Ic n="map" s={13}/>{gps.lat.toFixed(6)}, {gps.lng.toFixed(6)} <span style={{color:"#9ab89a",fontSize:11}}>(±{gps.accuracy}m)</span></>:<><Ic n="map" s={13}/>Not captured</>}</div><button type="button" onClick={onCapture} disabled={gpsLoading} style={{padding:"10px 14px",background:"linear-gradient(135deg,#1a5c2a,#2d8a45)",color:"#fff",border:"none",borderRadius:8,cursor:gpsLoading?"not-allowed":"pointer",fontSize:12,fontFamily:"inherit",fontWeight:600,display:"flex",alignItems:"center",gap:5,whiteSpace:"nowrap"}}><Ic n="map" s={13}/>{gps?"Re-capture":"Capture GPS"}</button></div>{gps&&<a href={`https://maps.google.com/?q=${gps.lat},${gps.lng}`} target="_blank" rel="noreferrer" style={{fontSize:11,color:"#1a5c2a",textDecoration:"none",marginTop:4,display:"inline-flex",alignItems:"center",gap:3}}><Ic n="map" s={11}/>View on Google Maps</a>}{gpsError&&<div style={{fontSize:11,color:"#ef4444",marginTop:4}}>{gpsError}</div>}</div>;}
function ImageField({label,preview,onChange,loading}){const fileRef=useRef();return <div style={{marginBottom:16}}><label style={{display:"block",fontSize:11,color:"#4a7a58",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.07em",fontWeight:700}}>{label}</label><div style={{display:"flex",gap:10,alignItems:"center"}}>{preview?<img src={preview} alt="preview" style={{width:70,height:70,objectFit:"cover",borderRadius:8,border:"1px solid #d4e8d4"}}/>:<div style={{width:70,height:70,background:"#f0faf2",border:"2px dashed #c8e6c8",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",color:"#9ab89a"}}><Ic n="camera" s={24}/></div>}<div><button type="button" onClick={()=>fileRef.current.click()} disabled={loading} style={{padding:"8px 14px",background:"#f0faf2",color:"#1a5c2a",border:"1px solid #c8e6c8",borderRadius:8,cursor:"pointer",fontSize:12,fontFamily:"inherit",fontWeight:600,display:"flex",alignItems:"center",gap:5}}>{loading?<><div style={{width:11,height:11,border:"2px solid #1a5c2a",borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>Uploading…</>:<><Ic n="camera" s={13}/>{preview?"Change Photo":"Take / Upload Photo"}</>}</button><div style={{fontSize:10,color:"#9ab89a",marginTop:4}}>JPG, PNG · Max 5MB</div><input ref={fileRef} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={onChange}/></div></div></div>;}

// ─── CSV EXPORT ───────────────────────────────────────────────────────────────
function exportCSV(rows, filename) {
  if(!rows.length)return;
  const headers=Object.keys(rows[0]);
  const csv=[headers.join(","),...rows.map(r=>headers.map(h=>`"${(r[h]||"").toString().replace(/"/g,'""')}"`).join(","))].join("\n");
  const blob=new Blob([csv],{type:"text/csv"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=filename;a.click();
}

// =============================================================================
// LOGIN
// =============================================================================
function LoginPage({addToast}){
  const [email,setEmail]=useState("");const [pass,setPass]=useState("");const [showP,setShowP]=useState(false);const [err,setErr]=useState("");const [loading,setLoading]=useState(false);const [resetMode,setResetMode]=useState(false);const [resetSent,setResetSent]=useState(false);

  async function doLogin(){
    setErr("");setLoading(true);
    try{
      const cred=await signInWithEmailAndPassword(auth,email,pass);
      const snap=await getDoc(doc(db,"Officers",cred.user.uid));
      if(!snap.exists()){setErr("Officer profile not found. Contact the System Administrator.");await signOut(auth);setLoading(false);return;}
      const officer={id:snap.id,...snap.data()};
      if(officer.status==="suspended"){setErr("Your account has been suspended. Contact the System Administrator.");await signOut(auth);setLoading(false);return;}
      await updateDoc(doc(db,"Officers",officer.id),{lastLogin:today()});
    }catch(e){setErr(e.code==="auth/user-not-found"||e.code==="auth/wrong-password"||e.code==="auth/invalid-credential"?"Invalid email or password.":e.code==="auth/too-many-requests"?"Too many failed attempts. Wait a few minutes.":e.code==="auth/network-request-failed"?"No internet connection.":"Login failed: "+e.message);}
    setLoading(false);
  }

  async function doReset(){
    if(!email)return setErr("Enter your email address first.");
    setLoading(true);
    try{await sendPasswordResetEmail(auth,email);setResetSent(true);setErr("");}
    catch(e){setErr("Could not send reset email: "+e.message);}
    setLoading(false);
  }

  return <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#f0faf2,#e8f5ec 50%,#f5f9f5)",display:"flex",alignItems:"center",justifyContent:"center",padding:16,fontFamily:"Outfit,sans-serif"}}>
    <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Outfit:wght@400;500;600;700&display=swap');*{box-sizing:border-box}@keyframes fadeUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}@keyframes slideIn{from{transform:translateX(20px);opacity:0}to{transform:translateX(0);opacity:1}}@keyframes spin{to{transform:rotate(360deg)}}@keyframes bar{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}input:focus,select:focus{border-color:#1a5c2a!important;box-shadow:0 0 0 3px rgba(26,92,42,0.1)!important;outline:none}`}</style>
    <div style={{width:"100%",maxWidth:420,animation:"fadeUp 0.5s ease"}}>
      <div style={{textAlign:"center",marginBottom:26}}>
        <img src="/logo.png" alt="BMA" style={{width:66,height:66,objectFit:"contain",margin:"0 auto 14px",display:"block"}}/>
        <h1 style={{fontFamily:"Cormorant Garamond,serif",fontSize:23,color:"#1a2e1a",margin:"0 0 4px",fontWeight:700}}>Bekwai Municipal Assembly</h1>
        <p style={{color:"#4a7a58",fontSize:13,margin:0}}>Revenue Management System — Officer Portal</p>
      </div>
      <div style={{...card,padding:26}}>
        {resetSent?<div style={{textAlign:"center",padding:"12px 0"}}><div style={{fontSize:40,marginBottom:10}}>📧</div><div style={{color:"#1a5c2a",fontSize:15,fontWeight:700,marginBottom:6}}>Reset email sent!</div><p style={{color:"#4a7a58",fontSize:13,margin:"0 0 16px"}}>Check your inbox for a password reset link from Firebase.</p><button onClick={()=>{setResetMode(false);setResetSent(false);}} style={{...btn(),width:"100%",justifyContent:"center"}}>Back to Sign In</button></div>:
        resetMode?<>
          <div style={{fontSize:13,color:"#4a7a58",marginBottom:16}}>Enter your official email address and we will send you a password reset link.</div>
          <Fld label="Official Email *"><input style={inp} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="yourname@bekwaiassembly.gov.gh"/></Fld>
          {err&&<div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"9px 13px",marginBottom:14,color:"#dc2626",fontSize:13,display:"flex",gap:7,alignItems:"center"}}><Ic n="alert" s={14}/>{err}</div>}
          <button onClick={doReset} disabled={loading} style={{...btn(),width:"100%",justifyContent:"center",marginBottom:10}}>{loading?"Sending…":"Send Reset Email"}</button>
          <button onClick={()=>{setResetMode(false);setErr("");}} style={{width:"100%",padding:"10px",background:"transparent",border:"none",color:"#4a7a58",cursor:"pointer",fontSize:13,fontFamily:"inherit"}}>← Back to Sign In</button>
        </>:<>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20,padding:"10px 13px",background:"#f0faf2",borderRadius:10,border:"1px solid #c8e6c8"}}><Ic n="shield" s={16}/><div><div style={{fontSize:13,fontWeight:700,color:"#1a5c2a"}}>Authorised Officers Only</div><div style={{fontSize:11,color:"#4a7a58"}}>Session auto-expires after 30 minutes of inactivity</div></div></div>
          <Fld label="Official Email *"><input style={inp} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="yourname@bekwaiassembly.gov.gh" onKeyDown={e=>e.key==="Enter"&&doLogin()}/></Fld>
          <Fld label="Password *"><div style={{position:"relative"}}><input style={{...inp,paddingRight:42}} type={showP?"text":"password"} value={pass} onChange={e=>setPass(e.target.value)} placeholder="Enter your password" onKeyDown={e=>e.key==="Enter"&&doLogin()}/><button onClick={()=>setShowP(v=>!v)} style={{position:"absolute",right:11,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"#4a7a58",padding:2}}><Ic n={showP?"eyeoff":"eye"} s={15}/></button></div></Fld>
          {err&&<div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"9px 13px",marginBottom:14,color:"#dc2626",fontSize:13,display:"flex",gap:7,alignItems:"center"}}><Ic n="alert" s={14}/>{err}</div>}
          <button onClick={doLogin} disabled={loading||!email||!pass} style={{...btn(),width:"100%",justifyContent:"center",opacity:loading||!email||!pass?0.6:1,marginBottom:10}}>{loading?"Verifying…":<><Ic n="lock" s={15}/>Sign In Securely</>}</button>
          <button onClick={()=>{setResetMode(true);setErr("");}} style={{width:"100%",padding:"8px",background:"transparent",border:"none",color:"#4a7a58",cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>Forgot password?</button>
        </>}
      </div>
      <p style={{textAlign:"center",color:"#7a9a78",fontSize:11,marginTop:16}}>© 2026 Bekwai Municipal Assembly · Ashanti Region, Ghana</p>
    </div>
  </div>;
}

// =============================================================================
// DASHBOARD with date filtering
// =============================================================================
function Dashboard({ratepayers,payments,Officers,me,setTab}){
  const [dateFrom,setDateFrom]=useState("");
  const [dateTo,setDateTo]=useState("");

  const allPaid=payments.filter(p=>p.status==="paid");
  const filtered=allPaid.filter(p=>(!dateFrom||p.date>=dateFrom)&&(!dateTo||p.date<=dateTo));
  const owing=payments.filter(p=>p.status==="owing");
  const totalR=filtered.reduce((s,p)=>s+p.amount,0);
  const totalO=owing.reduce((s,p)=>s+p.amount,0);
  const rate=payments.length?Math.round((allPaid.length/payments.length)*100):0;
  const overdue=owing.filter(p=>p.dueDate<today());
  const recent=[...filtered].sort((a,b)=>(b.date||"").localeCompare(a.date||"")).slice(0,6);
  const myTotal=filtered.filter(p=>p.collectedBy===me.id).reduce((s,p)=>s+p.amount,0);
  const momoTotal=filtered.filter(p=>p.paymentMethod==="Mobile Money").reduce((s,p)=>s+p.amount,0);
  const cashTotal=filtered.filter(p=>p.paymentMethod!=="Mobile Money").reduce((s,p)=>s+p.amount,0);
  const byType={};filtered.forEach(p=>{byType[p.type]=(byType[p.type]||0)+p.amount;});
  const maxB=Math.max(...Object.values(byType),1);
  const byWard={};filtered.forEach(p=>{const rp=ratepayers.find(r=>r.id===p.ratepayerId);const w=rp?.ward||"Unknown";byWard[w]=(byWard[w]||0)+p.amount;});

  return <div>
    <div style={{background:"linear-gradient(135deg,#1a5c2a,#2d8a45)",borderRadius:16,padding:"20px 24px",marginBottom:24,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12,boxShadow:"0 4px 16px rgba(26,92,42,0.25)"}}>
      <div><div style={{fontSize:12,color:"rgba(255,255,255,0.7)",marginBottom:4}}>Welcome back,</div><div style={{fontSize:22,fontWeight:700,color:"#fff",fontFamily:"Cormorant Garamond,serif"}}>{me.name}</div><div style={{fontSize:12,color:"rgba(255,255,255,0.6)",marginTop:3}}><span style={{background:"rgba(255,255,255,0.15)",padding:"2px 10px",borderRadius:20}}>{ROLES[me.role]?.label}</span><span style={{marginLeft:8}}>{me.ward}</span></div></div>
      <div style={{textAlign:"right"}}><div style={{fontSize:11,color:"rgba(255,255,255,0.6)",textTransform:"uppercase",letterSpacing:"0.07em"}}>Your Collections</div><div style={{fontSize:26,fontWeight:700,color:"#fff",fontFamily:"Cormorant Garamond,serif"}}>{fmt(myTotal)}</div></div>
    </div>

    <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
      <div style={{fontSize:13,color:"#4a7a58",fontWeight:600}}>Filter by date:</div>
      <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{...inp,width:"auto",fontSize:12,padding:"7px 10px"}}/>
      <span style={{color:"#9ab89a",fontSize:13}}>to</span>
      <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{...inp,width:"auto",fontSize:12,padding:"7px 10px"}}/>
      {(dateFrom||dateTo)&&<button onClick={()=>{setDateFrom("");setDateTo("");}} style={{background:"#f0faf2",color:"#1a5c2a",border:"1px solid #c8e6c8",borderRadius:8,padding:"7px 12px",cursor:"pointer",fontSize:12,fontFamily:"inherit",display:"flex",alignItems:"center",gap:5}}><Ic n="x" s={12}/>Clear</button>}
      {(dateFrom||dateTo)&&<span style={{fontSize:12,color:"#9ab89a"}}>{filtered.length} payments in range</span>}
    </div>

    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:14,marginBottom:22}}>
      <StatCard label="Total Revenue"      value={fmt(totalR)}  icon="trend"    color="#16a34a" sub={`${filtered.length} payments`}/>
      <StatCard label="Outstanding"        value={fmt(totalO)}  icon="alert"    color="#d97706" sub={`${owing.length} unpaid`} onClick={()=>setTab("defaulters")}/>
      <StatCard label="Mobile Money"       value={fmt(momoTotal)} icon="phone"  color="#7c3aed" sub="Digital payments"/>
      <StatCard label="Cash Payments"      value={fmt(cashTotal)} icon="payments" color="#0369a1" sub="In-person"/>
      <StatCard label="Collection Rate"    value={`${rate}%`}   icon="check"    color="#0f766e" sub="Compliance"/>
      {canDo(me,"iam")&&<StatCard label="Active Officers" value={Officers.filter(o=>o.status==="active").length} icon="shield" color="#b45309" sub="System users" onClick={()=>setTab("iam")}/>}
    </div>

    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:18,marginBottom:20}}>
      <div style={{...card,padding:20}}>
        <h3 style={{margin:"0 0 16px",color:"#4a7a58",fontSize:12,textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:700}}>Revenue by Levy Type</h3>
        {Object.keys(byType).length===0?<p style={{color:"#9ab89a",fontSize:13,margin:0}}>No revenue in this period.</p>:Object.entries(byType).sort((a,b)=>b[1]-a[1]).map(([type,amount])=><div key={type} style={{marginBottom:12}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><span style={{color:"#2a5a38",fontSize:12}}>{type}</span><span style={{color:"#1a5c2a",fontSize:12,fontWeight:700}}>{fmt(amount)}</span></div><div style={{height:5,background:"#e8f0e8",borderRadius:3}}><div style={{height:"100%",width:`${(amount/maxB)*100}%`,background:"linear-gradient(90deg,#1a5c2a,#4ade80)",borderRadius:3}}/></div></div>)}
      </div>
      <div style={{...card,padding:20}}>
        <h3 style={{margin:"0 0 16px",color:"#4a7a58",fontSize:12,textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:700}}>Revenue by Ward</h3>
        {Object.keys(byWard).length===0?<p style={{color:"#9ab89a",fontSize:13,margin:0}}>No revenue in this period.</p>:Object.entries(byWard).sort((a,b)=>b[1]-a[1]).map(([ward,amount])=>{const pct=Math.round((amount/totalR)*100)||0;return <div key={ward} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid #f5f5f5"}}><span style={{color:"#2a5a38",fontSize:13}}>{ward}</span><div style={{textAlign:"right"}}><span style={{color:"#1a5c2a",fontSize:13,fontWeight:700}}>{fmt(amount)}</span><span style={{color:"#9ab89a",fontSize:11,marginLeft:6}}>{pct}%</span></div></div>;})}
      </div>
    </div>

    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:18,marginBottom:20}}>
      <div style={{...card,padding:20,border:"1px solid #fde68a"}}>
        <h3 style={{margin:"0 0 16px",color:"#b45309",fontSize:12,textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:700}}>⚠ Overdue ({overdue.length})</h3>
        {overdue.length===0?<div style={{textAlign:"center",padding:"18px 0"}}><div style={{fontSize:32,marginBottom:8}}>🎉</div><p style={{color:"#4a7a58",fontSize:13,margin:0}}>All payments up to date!</p></div>:overdue.slice(0,5).map(p=>{const rp=ratepayers.find(r=>r.id===p.ratepayerId);return <div key={p.id} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #fef9c3"}}><div><div style={{color:"#1a2e1a",fontSize:13,fontWeight:500}}>{rp?.name}</div><div style={{color:"#7a9a78",fontSize:11}}>{p.type} · Due {fmtDate(p.dueDate)}</div></div><span style={{color:"#d97706",fontSize:13,fontWeight:700}}>{fmt(p.amount)}</span></div>;})}
      </div>
      <div style={{...card,padding:20,overflowX:"auto"}}>
        <h3 style={{margin:"0 0 16px",color:"#4a7a58",fontSize:12,textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:700}}>Recent Payments</h3>
        {recent.length===0?<p style={{color:"#9ab89a",fontSize:13,margin:0}}>No payments in this period.</p>:<table style={{width:"100%",borderCollapse:"collapse",minWidth:360}}><thead><tr>{["Ratepayer","Amount","Method","Date"].map(h=><th key={h} style={{textAlign:"left",padding:"6px 8px",fontSize:11,color:"#7a9a78",textTransform:"uppercase",borderBottom:"1px solid #f0f0f0",fontWeight:700}}>{h}</th>)}</tr></thead><tbody>{recent.map(p=>{const rp=ratepayers.find(r=>r.id===p.ratepayerId);return <tr key={p.id}><td style={{padding:"8px",fontSize:12,color:"#2a5a38",borderBottom:"1px solid #f8f8f8"}}>{rp?.name}</td><td style={{padding:"8px",fontSize:12,color:"#16a34a",borderBottom:"1px solid #f8f8f8",fontWeight:700}}>{fmt(p.amount)}</td><td style={{padding:"8px",fontSize:11,borderBottom:"1px solid #f8f8f8"}}>{p.paymentMethod==="Mobile Money"?"📱":"💵"}</td><td style={{padding:"8px",fontSize:11,color:"#9ab89a",borderBottom:"1px solid #f8f8f8"}}>{fmtDate(p.date)}</td></tr>;})}
        </tbody></table>}
      </div>
    </div>
  </div>;
}

// =============================================================================
// RATEPAYERS — register, edit, GPS, photo, duplicate check
// =============================================================================
function Ratepayers({ratepayers,me,addToast}){
  const [search,setSearch]=useState("");const [showForm,setShowForm]=useState(false);const [viewRp,setViewRp]=useState(null);const [editRp,setEditRp]=useState(null);const [saving,setSaving]=useState(false);const [imgLoading,setImgLoading]=useState(false);const [photoPreview,setPhotoPreview]=useState(null);const [photoFile,setPhotoFile]=useState(null);const {gps,gpsLoading,gpsError,capture}=useGPS();const [form,setForm]=useState({name:"",phone:"",email:"",address:"",ward:"Central Ward",category:"Resident"});
  const filtered=ratepayers.filter(r=>[r.name,r.pin,r.phone,r.ward,r.address,r.category].some(f=>f?.toLowerCase().includes(search.toLowerCase())));
  const catC={Resident:{bg:"rgba(37,99,235,0.1)",color:"#2563eb"},Business:{bg:"rgba(180,83,9,0.1)",color:"#b45309"},NGO:{bg:"rgba(124,58,237,0.1)",color:"#7c3aed"},Government:{bg:"rgba(15,118,110,0.1)",color:"#0f766e"}};

  function openAdd(){setForm({name:"",phone:"",email:"",address:"",ward:"Central Ward",category:"Resident"});setEditRp(null);setPhotoPreview(null);setPhotoFile(null);setShowForm(true);}
  function openEdit(r,e){e.stopPropagation();setForm({name:r.name,phone:r.phone||"",email:r.email||"",address:r.address||"",ward:r.ward,category:r.category});setEditRp(r);setPhotoPreview(r.photoURL||null);setPhotoFile(null);setShowForm(true);}
  function handlePhotoChange(e){const file=e.target.files[0];if(!file)return;if(file.size>5*1024*1024){addToast("Image must be under 5MB","error");return;}setPhotoFile(file);setPhotoPreview(URL.createObjectURL(file));}

  // Duplicate check
  function checkDuplicate(name,phone){return ratepayers.find(r=>r.id!==(editRp?.id)&&(r.name.toLowerCase()===name.toLowerCase()||(phone&&r.phone===phone)));}

  async function save(){
    if(!form.name||!form.phone)return addToast("Name and phone are required","error");
    const dup=checkDuplicate(form.name,form.phone);
    if(dup){if(!window.confirm(`A similar ratepayer exists: "${dup.name}" (${dup.pin}). Continue anyway?`))return;}
    setSaving(true);
    try{
      let photoURL=editRp?.photoURL||null;
      if(photoFile){setImgLoading(true);const id=editRp?.id||"BMA"+Date.now();photoURL=await uploadImage(photoFile,`ratepayers/${id}/photo`);setImgLoading(false);}
      if(editRp){
        await updateDoc(doc(db,"ratepayers",editRp.id),{...form,photoURL,updatedBy:me.id,updatedAt:today(),...(gps&&{gps:{lat:gps.lat,lng:gps.lng,accuracy:gps.accuracy,capturedAt:today()}})});
        await logAudit(me.id,me.name,"RATEPAYER_UPDATED",`${form.name} (${editRp.pin}) updated`);
        addToast(`${form.name} updated successfully!`,"success");
      }else{
        const id="BMA"+Date.now();const pin=`BMA-${new Date().getFullYear()}-${String(ratepayers.length+1).padStart(3,"0")}`;
        const data={...form,id,pin,registeredDate:today(),status:"active",createdBy:me.id,photoURL};
        if(gps)data.gps={lat:gps.lat,lng:gps.lng,accuracy:gps.accuracy,capturedAt:today()};
        await setDoc(doc(db,"ratepayers",id),data);
        await logAudit(me.id,me.name,"RATEPAYER_REGISTERED",`${form.name} (${pin}) registered`);
        addToast(`${form.name} registered successfully!`,"success");
      }
      setShowForm(false);
    }catch(e){addToast(navigator.onLine?"Failed: "+e.message:"Saved offline — will sync when connected","offline");}
    setSaving(false);
  }

  function doExport(){exportCSV(filtered.map(r=>({PIN:r.pin,Name:r.name,Category:r.category,Ward:r.ward,Phone:r.phone,Email:r.email||"",Address:r.address||"",Registered:r.registeredDate,GPS:r.gps?`${r.gps.lat},${r.gps.lng}`:""})),"ratepayers.csv");addToast("Ratepayers exported to CSV","success");}

  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24,flexWrap:"wrap",gap:12}}>
      <div><h2 style={{color:"#1a2e1a",fontFamily:"Cormorant Garamond,serif",margin:"0 0 4px",fontSize:26}}>Ratepayer Registry</h2><p style={{color:"#4a7a58",margin:0,fontSize:13}}>{ratepayers.length} registered · GPS &amp; photo enabled</p></div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <button onClick={doExport} style={{...btn("#0369a1"),fontSize:12}}><Ic n="download" s={14}/>Export CSV</button>
        <button onClick={openAdd} style={btn()}><Ic n="plus" s={14}/>Register Ratepayer</button>
      </div>
    </div>
    <div style={{position:"relative",marginBottom:16}}><div style={{position:"absolute",left:13,top:"50%",transform:"translateY(-50%)",color:"#9ab89a"}}><Ic n="search" s={15}/></div><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name, PIN, ward, phone, category…" style={{...inp,paddingLeft:38}}/></div>
    <div style={{...card,overflow:"hidden",overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse",minWidth:720}}>
        <thead><tr style={{background:"#f0faf2"}}>{["Photo","Name","PIN","Category","Ward","Phone","GPS","Registered",""].map(h=><th key={h} style={{textAlign:"left",padding:"12px 14px",fontSize:11,color:"#4a7a58",textTransform:"uppercase",letterSpacing:"0.07em",fontWeight:700}}>{h}</th>)}</tr></thead>
        <tbody>{filtered.length===0?<tr><td colSpan={9} style={{textAlign:"center",padding:40,color:"#9ab89a"}}>No ratepayers found.</td></tr>:
          filtered.map(r=>{const cc=catC[r.category]||catC.Resident;return <tr key={r.id} style={{borderTop:"1px solid #f5f5f5",cursor:"pointer"}} onClick={()=>setViewRp(r)}>
            <td style={{padding:"10px 14px"}}>{r.photoURL?<img src={r.photoURL} alt="" style={{width:36,height:36,borderRadius:8,objectFit:"cover",border:"1px solid #d4e8d4"}}/>:<div style={{width:36,height:36,background:"#f0faf2",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",color:"#9ab89a"}}><Ic n="camera" s={16}/></div>}</td>
            <td style={{padding:"10px 14px",color:"#1a2e1a",fontSize:13,fontWeight:600}}>{r.name}</td>
            <td style={{padding:"10px 14px",color:"#1a5c2a",fontSize:12,fontFamily:"monospace"}}>{r.pin}</td>
            <td style={{padding:"10px 14px"}}><span style={{background:cc.bg,color:cc.color,padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:500}}>{r.category}</span></td>
            <td style={{padding:"10px 14px",color:"#4a7a58",fontSize:13}}>{r.ward}</td>
            <td style={{padding:"10px 14px",color:"#7a9a78",fontSize:13}}>{r.phone}</td>
            <td style={{padding:"10px 14px"}}>{r.gps?<span style={{background:"rgba(22,163,74,0.1)",color:"#16a34a",padding:"2px 8px",borderRadius:20,fontSize:11}}>📍</span>:<span style={{color:"#9ab89a",fontSize:11}}>—</span>}</td>
            <td style={{padding:"10px 14px",color:"#9ab89a",fontSize:12}}>{fmtDate(r.registeredDate)}</td>
            <td style={{padding:"10px 14px"}} onClick={e=>e.stopPropagation()}><button onClick={e=>openEdit(r,e)} style={{background:"rgba(37,99,235,0.08)",color:"#2563eb",border:"none",borderRadius:6,padding:"5px 9px",cursor:"pointer",fontSize:11,display:"flex",alignItems:"center",gap:3}}><Ic n="edit" s={11}/>Edit</button></td>
          </tr>;})}
        </tbody>
      </table>
    </div>

    {showForm&&<Modal title={editRp?`Edit — ${editRp.name}`:"Register New Ratepayer"} onClose={()=>setShowForm(false)} wide>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <div>
          <Fld label="Full Name / Business Name *"><input style={inp} value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="e.g. Kwame Asante"/></Fld>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><Fld label="Category"><select style={sel} value={form.category} onChange={e=>setForm(p=>({...p,category:e.target.value}))}><option>Resident</option><option>Business</option><option>NGO</option><option>Government</option></select></Fld><Fld label="Ward"><select style={sel} value={form.ward} onChange={e=>setForm(p=>({...p,ward:e.target.value}))}>{WARDS.filter(w=>w!=="All Wards").map(w=><option key={w}>{w}</option>)}</select></Fld></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><Fld label="Phone *"><input style={inp} value={form.phone} onChange={e=>setForm(p=>({...p,phone:e.target.value}))} placeholder="0244XXXXXX"/></Fld><Fld label="Email"><input style={inp} type="email" value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))} placeholder="optional"/></Fld></div>
          <Fld label="Address"><input style={inp} value={form.address} onChange={e=>setForm(p=>({...p,address:e.target.value}))} placeholder="e.g. No. 5 Market Road"/></Fld>
        </div>
        <div><ImageField label="Ratepayer Photo" preview={photoPreview} onChange={handlePhotoChange} loading={imgLoading}/><GPSField gps={gps} gpsLoading={gpsLoading} gpsError={gpsError} onCapture={capture}/></div>
      </div>
      <div style={{display:"flex",gap:12,marginTop:8}}>
        <button onClick={()=>setShowForm(false)} style={{flex:1,padding:"11px",background:"#f8faf8",border:"1px solid #e0ede0",borderRadius:8,color:"#4a7a58",cursor:"pointer",fontSize:14,fontFamily:"inherit"}}>Cancel</button>
        <button onClick={save} disabled={saving||imgLoading} style={{flex:2,padding:"11px",background:saving?"#9ab89a":"linear-gradient(135deg,#1a5c2a,#2d8a45)",border:"none",borderRadius:8,color:"#fff",cursor:saving?"not-allowed":"pointer",fontSize:14,fontWeight:600,fontFamily:"inherit"}}>{saving?"Saving…":editRp?"Save Changes":"Register Ratepayer"}</button>
      </div>
    </Modal>}

    {viewRp&&<Modal title={viewRp.name} onClose={()=>setViewRp(null)} wide>
      <div style={{display:"grid",gridTemplateColumns:"auto 1fr",gap:20,alignItems:"start"}}>
        <div>{viewRp.photoURL?<img src={viewRp.photoURL} alt={viewRp.name} style={{width:100,height:100,objectFit:"cover",borderRadius:12,border:"2px solid #c8e6c8"}}/>:<div style={{width:100,height:100,background:"#f0faf2",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",color:"#9ab89a",border:"2px dashed #c8e6c8"}}><Ic n="camera" s={32}/></div>}</div>
        <div><div style={{fontSize:11,color:"#4a7a58",textTransform:"uppercase",letterSpacing:"0.07em",fontWeight:700,marginBottom:4}}>PIN</div><div style={{fontFamily:"monospace",color:"#1a5c2a",fontSize:15,marginBottom:12}}>{viewRp.pin}</div>{[["Ward",viewRp.ward],["Category",viewRp.category],["Phone",viewRp.phone],["Email",viewRp.email||"—"],["Address",viewRp.address],["Registered",fmtDate(viewRp.registeredDate)]].map(([l,v])=><div key={l} style={{display:"flex",gap:8,marginBottom:6}}><span style={{fontSize:12,color:"#7a9a78",width:80,flexShrink:0}}>{l}:</span><span style={{fontSize:13,color:"#1a2e1a",fontWeight:500}}>{v}</span></div>)}</div>
      </div>
      {viewRp.gps&&<div style={{marginTop:16,background:"#f0faf2",borderRadius:10,padding:"12px 14px",border:"1px solid #c8e6c8"}}><div style={{fontSize:11,color:"#4a7a58",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>📍 GPS Location</div><div style={{fontSize:13,color:"#1a2e1a"}}>{viewRp.gps.lat.toFixed(6)}, {viewRp.gps.lng.toFixed(6)} <span style={{color:"#9ab89a",fontSize:11}}>(±{viewRp.gps.accuracy}m)</span></div><a href={`https://maps.google.com/?q=${viewRp.gps.lat},${viewRp.gps.lng}`} target="_blank" rel="noreferrer" style={{fontSize:12,color:"#1a5c2a",textDecoration:"none",marginTop:4,display:"inline-flex",alignItems:"center",gap:4}}><Ic n="map" s={12}/>Open in Google Maps</a></div>}
      <div style={{marginTop:16,display:"flex",gap:8}}><button onClick={e=>openEdit(viewRp,e)} style={btn()}><Ic n="edit" s={14}/>Edit Profile</button></div>
    </Modal>}
  </div>;
}

// ─── CANCEL MODAL ─────────────────────────────────────────────────────────────
function CancelModal({bill,saving,onClose,onConfirm}){
  const [reason,setReason]=useState("");
  return <Modal title="Cancel Bill" onClose={onClose}>
    <div style={{textAlign:"center",marginBottom:16}}><div style={{fontSize:36,marginBottom:8}}>⚠️</div><div style={{color:"#1a2e1a",fontSize:16,fontWeight:700}}>Cancel Bill {bill.id}</div><div style={{color:"#7a9a78",fontSize:13,marginTop:4}}>{fmt(bill.amount)} · {bill.type}</div></div>
    <Fld label="Reason for Cancellation *"><textarea style={{...inp,minHeight:80,resize:"vertical"}} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Explain why this bill is being cancelled…"/></Fld>
    <div style={{display:"flex",gap:12}}><button onClick={onClose} style={{flex:1,padding:"11px",background:"#f8faf8",border:"1px solid #e0ede0",borderRadius:8,color:"#4a7a58",cursor:"pointer",fontSize:14,fontFamily:"inherit"}}>Keep Bill</button><button onClick={()=>onConfirm(reason)} disabled={saving} style={{flex:1,padding:"11px",background:saving?"#9ab89a":"linear-gradient(135deg,#dc2626,#ef4444)",border:"none",borderRadius:8,color:"#fff",cursor:saving?"not-allowed":"pointer",fontSize:14,fontWeight:600,fontFamily:"inherit"}}>{saving?"Cancelling…":"Cancel Bill"}</button></div>
  </Modal>;
}

// =============================================================================
// PAYMENTS — issue bills, record payments, cancel bills, bulk issue
// =============================================================================
function Payments({payments,ratepayers,Officers,me,addToast}){
  const [search,setSearch]=useState("");const [filter,setFilter]=useState("all");const [dateFrom,setDateFrom]=useState("");const [dateTo,setDateTo]=useState("");const [showForm,setShowForm]=useState(false);const [showBulk,setShowBulk]=useState(false);const [payModal,setPayModal]=useState(null);const [cancelModal,setCancelModal]=useState(null);const [saving,setSaving]=useState(false);const [form,setForm]=useState({ratepayerId:"",type:"Property Rate",period:"",amount:"",dueDate:""});const [payMethod,setPayMethod]=useState("Cash");const [momoNetwork,setMomoNetwork]=useState("MTN Mobile Money");const [momoPhone,setMomoPhone]=useState("");const [momoRef,setMomoRef]=useState("");const [bulkForm,setBulkForm]=useState({ward:"All Wards",category:"All",type:"Property Rate",period:"",amount:"",dueDate:""});const editable=me.role!=="AUDITOR";

  const filtered=payments.filter(p=>{
    const rp=ratepayers.find(r=>r.id===p.ratepayerId);
    const matchSearch=[rp?.name,p.type,p.period,p.id,rp?.ward].some(f=>f?.toLowerCase().includes(search.toLowerCase()));
    const matchFilter=filter==="all"||p.status===filter;
    const matchDate=(!dateFrom||(p.date||p.dueDate)>=dateFrom)&&(!dateTo||(p.date||p.dueDate)<=dateTo);
    return matchSearch&&matchFilter&&matchDate;
  });

  async function issueBill(){
    if(!form.ratepayerId||!form.period||!form.amount)return addToast("Fill all required fields","error");
    setSaving(true);
    try{
      const id="BILL"+Date.now();
      await setDoc(doc(db,"payments",id),{...form,id,amount:parseFloat(form.amount),status:"owing",date:null,receiptNo:null,collectedBy:null,createdBy:me.id,createdAt:today()});
      await logAudit(me.id,me.name,"BILL_ISSUED",`${id} — ${form.type} — ${fmt(parseFloat(form.amount))}`);
      setForm({ratepayerId:"",type:"Property Rate",period:"",amount:"",dueDate:""});setShowForm(false);
      addToast("Demand notice issued!","success");
    }catch(e){addToast(navigator.onLine?"Failed: "+e.message:"Saved offline","offline");}
    setSaving(false);
  }

  async function issueBulk(){
    if(!bulkForm.period||!bulkForm.amount||!bulkForm.dueDate)return addToast("Fill period, amount and due date","error");
    const targets=ratepayers.filter(r=>(bulkForm.ward==="All Wards"||r.ward===bulkForm.ward)&&(bulkForm.category==="All"||r.category===bulkForm.category));
    if(targets.length===0)return addToast("No ratepayers match the selected criteria","error");
    if(!window.confirm(`Issue ${targets.length} bills for ${bulkForm.type} (${fmt(parseFloat(bulkForm.amount))} each)? Total: ${fmt(targets.length*parseFloat(bulkForm.amount))}`))return;
    setSaving(true);
    try{
      for(const rp of targets){
        const id="BILL"+Date.now()+Math.random().toString(36).substr(2,4);
        await setDoc(doc(db,"payments",id),{ratepayerId:rp.id,type:bulkForm.type,period:bulkForm.period,amount:parseFloat(bulkForm.amount),dueDate:bulkForm.dueDate,id,status:"owing",date:null,receiptNo:null,collectedBy:null,createdBy:me.id,createdAt:today()});
      }
      await logAudit(me.id,me.name,"BULK_BILLS_ISSUED",`${targets.length} bills for ${bulkForm.type} — ${bulkForm.period}`);
      setShowBulk(false);addToast(`${targets.length} bills issued successfully!`,"success");
    }catch(e){addToast("Bulk issue failed: "+e.message,"error");}
    setSaving(false);
  }

  async function confirmPay(p){
    if(payMethod==="Mobile Money"&&!momoPhone)return addToast("Enter the MoMo phone number","error");
    setSaving(true);
    try{
      const paidCount=payments.filter(x=>x.status==="paid").length;
      const rno=`BMA-RCP-${String(paidCount+1).padStart(3,"0")}`;
      await updateDoc(doc(db,"payments",p.id),{status:"paid",date:today(),receiptNo:rno,collectedBy:me.id,paymentMethod: payMethod,...( payMethod==="Mobile Money"&&{momoNetwork,momoPhone,momoRef:momoRef||`MOMO-${Date.now()}`})});
      const rp=ratepayers.find(r=>r.id===p.ratepayerId);
      await logAudit(me.id,me.name,"PAYMENT_COLLECTED",`${rno} — ${fmt(p.amount)} from ${rp?.name} via ${payMethod}`);
      setPayModal(null);setMomoPhone("");setMomoRef("");setPayMethod("Cash");
      addToast(`Receipt ${rno} issued.`,"success");
    }catch(e){addToast(navigator.onLine?"Failed: "+e.message:"Saved offline","offline");}
    setSaving(false);
  }

  async function cancelBill(p,reason){
    setSaving(true);
    try{
      await updateDoc(doc(db,"payments",p.id),{status:"cancelled",cancelledBy:me.id,cancelledAt:today(),cancelReason:reason});
      await logAudit(me.id,me.name,"BILL_CANCELLED",`${p.id} cancelled by ${me.name}. Reason: ${reason}`);
      setCancelModal(null);addToast("Bill cancelled successfully","success");
    }catch(e){addToast("Failed: "+e.message,"error");}
    setSaving(false);
  }

  function doExport(){exportCSV(filtered.map(p=>{const rp=ratepayers.find(r=>r.id===p.ratepayerId);const off=Officers.find(o=>o.id===p.collectedBy);return{BillRef:p.id,Ratepayer:rp?.name||"",PIN:rp?.pin||"",Ward:rp?.ward||"",LevyType:p.type,Period:p.period,Amount:p.amount,DueDate:p.dueDate,Status:p.status,PaymentDate:p.date||"",ReceiptNo:p.receiptNo||"",Method:p.paymentMethod||"",CollectedBy:off?.name||""}}),"payments.csv");addToast("Exported to CSV","success");}

  function ss(p){const ov=p.dueDate<today()&&p.status==="owing";if(p.status==="paid")return{bg:"rgba(22,163,74,0.1)",color:"#16a34a",label:"PAID"};if(p.status==="cancelled")return{bg:"rgba(107,114,128,0.1)",color:"#6b7280",label:"CANCELLED"};if(ov)return{bg:"rgba(239,68,68,0.1)",color:"#ef4444",label:"OVERDUE"};return{bg:"rgba(217,119,6,0.1)",color:"#d97706",label:"OWING"};}

  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24,flexWrap:"wrap",gap:12}}>
      <div><h2 style={{color:"#1a2e1a",fontFamily:"Cormorant Garamond,serif",margin:"0 0 4px",fontSize:26}}>Levy &amp; Payment Tracker</h2><p style={{color:"#4a7a58",margin:0,fontSize:13}}>{payments.filter(p=>p.status==="paid").length} paid · {payments.filter(p=>p.status==="owing").length} outstanding</p></div>
      {editable&&<div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <button onClick={doExport} style={{...btn("#0369a1"),fontSize:12}}><Ic n="download" s={14}/>Export</button>
        <button onClick={()=>setShowBulk(true)} style={{...btn("#b45309"),fontSize:12}}><Ic n="list" s={14}/>Bulk Issue</button>
        <button onClick={()=>setShowForm(true)} style={btn()}><Ic n="plus" s={14}/>Issue Notice</button>
      </div>}
    </div>

    <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
      <div style={{flex:1,position:"relative",minWidth:200}}><div style={{position:"absolute",left:13,top:"50%",transform:"translateY(-50%)",color:"#9ab89a"}}><Ic n="search" s={15}/></div><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search…" style={{...inp,paddingLeft:38}}/></div>
      {["all","paid","owing","cancelled"].map(s=><button key={s} onClick={()=>setFilter(s)} style={{padding:"9px 14px",borderRadius:8,border:"1px solid",fontSize:12,cursor:"pointer",fontFamily:"inherit",borderColor:filter===s?"#1a5c2a":"#e0ede0",background:filter===s?"#e8f5ec":"#fff",color:filter===s?"#1a5c2a":"#7a9a78",fontWeight:filter===s?700:400}}>{s.charAt(0).toUpperCase()+s.slice(1)}</button>)}
      <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{...inp,width:"auto",fontSize:12,padding:"9px 10px"}}/>
      <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{...inp,width:"auto",fontSize:12,padding:"9px 10px"}}/>
    </div>

    <div style={{...card,overflow:"hidden",overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse",minWidth:900}}>
        <thead><tr style={{background:"#f0faf2"}}>{["Bill Ref","Ratepayer","Levy Type","Amount","Due Date","Status","Method","Actions"].map(h=><th key={h} style={{textAlign:"left",padding:"12px 12px",fontSize:11,color:"#4a7a58",textTransform:"uppercase",letterSpacing:"0.06em",fontWeight:700,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
        <tbody>{filtered.length===0?<tr><td colSpan={8} style={{textAlign:"center",padding:40,color:"#9ab89a"}}>No records found.</td></tr>:
          filtered.map(p=>{const rp=ratepayers.find(r=>r.id===p.ratepayerId);const s=ss(p);return <tr key={p.id} style={{borderTop:"1px solid #f5f5f5",opacity:p.status==="cancelled"?0.55:1}}>
            <td style={{padding:"10px 12px",color:"#1a5c2a",fontSize:11,fontFamily:"monospace"}}>{p.id}</td>
            <td style={{padding:"10px 12px",color:"#1a2e1a",fontSize:13,fontWeight:500}}>{rp?.name}<div style={{fontSize:10,color:"#9ab89a"}}>{rp?.ward}</div></td>
            <td style={{padding:"10px 12px",color:"#2a5a38",fontSize:13}}>{p.type}</td>
            <td style={{padding:"10px 12px",color:p.status==="paid"?"#16a34a":"#d97706",fontSize:13,fontWeight:700}}>{fmt(p.amount)}</td>
            <td style={{padding:"10px 12px",color:p.dueDate<today()&&p.status==="owing"?"#ef4444":"#7a9a78",fontSize:12}}>{fmtDate(p.dueDate)}</td>
            <td style={{padding:"10px 12px"}}><span style={{background:s.bg,color:s.color,padding:"3px 9px",borderRadius:20,fontSize:11,fontWeight:600}}>{s.label}</span></td>
            <td style={{padding:"10px 12px"}}>{p.paymentMethod==="Mobile Money"?<span style={{background:"rgba(124,58,237,0.1)",color:"#7c3aed",padding:"2px 8px",borderRadius:20,fontSize:11}}>📱 MoMo</span>:p.status==="paid"?<span style={{background:"rgba(3,105,161,0.1)",color:"#0369a1",padding:"2px 8px",borderRadius:20,fontSize:11}}>💵 Cash</span>:<span style={{color:"#9ab89a",fontSize:11}}>—</span>}</td>
            <td style={{padding:"10px 12px"}}><div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
              <button onClick={()=>openPrint(billHTML(p,rp))} style={{background:"rgba(180,83,9,0.08)",color:"#b45309",border:"none",borderRadius:6,padding:"5px 7px",cursor:"pointer",fontSize:11,display:"flex",alignItems:"center",gap:2}}><Ic n="print" s={11}/>Bill</button>
              {p.status==="owing"&&editable&&<button onClick={()=>setPayModal(p)} style={{background:"rgba(22,163,74,0.1)",color:"#16a34a",border:"none",borderRadius:6,padding:"5px 7px",cursor:"pointer",fontSize:11,display:"flex",alignItems:"center",gap:2}}><Ic n="check" s={11}/>Pay</button>}
              {p.status==="paid"&&<button onClick={()=>{const o2=Officers.find(o=>o.id===p.collectedBy);openPrint(receiptHTML(p,rp,o2));}} style={{background:"rgba(37,99,235,0.08)",color:"#2563eb",border:"none",borderRadius:6,padding:"5px 7px",cursor:"pointer",fontSize:11,display:"flex",alignItems:"center",gap:2}}><Ic n="receipt" s={11}/>Receipt</button>}
              {p.status==="owing"&&(me.role==="SUPER_ADMIN"||me.role==="REVENUE_MANAGER")&&<button onClick={()=>setCancelModal(p)} style={{background:"rgba(239,68,68,0.08)",color:"#ef4444",border:"none",borderRadius:6,padding:"5px 7px",cursor:"pointer",fontSize:11,display:"flex",alignItems:"center",gap:2}}><Ic n="x" s={11}/>Cancel</button>}
            </div></td>
          </tr>;})}
        </tbody>
      </table>
    </div>

    {showForm&&<Modal title="Issue Demand Notice" onClose={()=>setShowForm(false)}>
      <Fld label="Ratepayer *"><select style={sel} value={form.ratepayerId} onChange={e=>setForm(p=>({...p,ratepayerId:e.target.value}))}><option value="">— Select Ratepayer —</option>{ratepayers.map(r=><option key={r.id} value={r.id}>{r.name} — {r.ward} ({r.pin})</option>)}</select></Fld>
      <Fld label="Levy Type"><select style={sel} value={form.type} onChange={e=>setForm(p=>({...p,type:e.target.value}))}>{LEVY_TYPES.map(t=><option key={t}>{t}</option>)}</select></Fld>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><Fld label="Period *"><input style={inp} value={form.period} onChange={e=>setForm(p=>({...p,period:e.target.value}))} placeholder="e.g. Q2 2024"/></Fld><Fld label="Amount (GH₵) *"><input style={inp} type="number" value={form.amount} onChange={e=>setForm(p=>({...p,amount:e.target.value}))} placeholder="0.00"/></Fld></div>
      <Fld label="Due Date"><input style={inp} type="date" value={form.dueDate} onChange={e=>setForm(p=>({...p,dueDate:e.target.value}))}/></Fld>
      <div style={{display:"flex",gap:12,marginTop:8}}><button onClick={()=>setShowForm(false)} style={{flex:1,padding:"11px",background:"#f8faf8",border:"1px solid #e0ede0",borderRadius:8,color:"#4a7a58",cursor:"pointer",fontSize:14,fontFamily:"inherit"}}>Cancel</button><button onClick={issueBill} disabled={saving} style={{flex:2,padding:"11px",background:saving?"#9ab89a":"linear-gradient(135deg,#1a5c2a,#2d8a45)",border:"none",borderRadius:8,color:"#fff",cursor:saving?"not-allowed":"pointer",fontSize:14,fontWeight:600,fontFamily:"inherit"}}>{saving?"Saving…":"Issue Notice"}</button></div>
    </Modal>}

    {showBulk&&<Modal title="Bulk Issue Demand Notices" onClose={()=>setShowBulk(false)} wide>
      <div style={{background:"#fff8e1",border:"1px solid #fde68a",borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:13,color:"#92400e"}}>⚡ This will issue bills to ALL ratepayers matching the selected ward and category. Review carefully before confirming.</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Fld label="Ward"><select style={sel} value={bulkForm.ward} onChange={e=>setBulkForm(p=>({...p,ward:e.target.value}))}>{WARDS.map(w=><option key={w}>{w}</option>)}</select></Fld>
        <Fld label="Category"><select style={sel} value={bulkForm.category} onChange={e=>setBulkForm(p=>({...p,category:e.target.value}))}><option value="All">All Categories</option><option>Resident</option><option>Business</option><option>NGO</option><option>Government</option></select></Fld>
      </div>
      <Fld label="Levy Type"><select style={sel} value={bulkForm.type} onChange={e=>setBulkForm(p=>({...p,type:e.target.value}))}>{LEVY_TYPES.map(t=><option key={t}>{t}</option>)}</select></Fld>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}><Fld label="Period *"><input style={inp} value={bulkForm.period} onChange={e=>setBulkForm(p=>({...p,period:e.target.value}))} placeholder="e.g. Q1 2025"/></Fld><Fld label="Amount (GH₵) *"><input style={inp} type="number" value={bulkForm.amount} onChange={e=>setBulkForm(p=>({...p,amount:e.target.value}))} placeholder="0.00"/></Fld><Fld label="Due Date *"><input style={inp} type="date" value={bulkForm.dueDate} onChange={e=>setBulkForm(p=>({...p,dueDate:e.target.value}))}/></Fld></div>
      {bulkForm.amount&&<div style={{background:"#f0faf2",border:"1px solid #c8e6c8",borderRadius:10,padding:"12px 14px",marginBottom:12,fontSize:13,color:"#1a5c2a"}}>Will issue to <strong>{ratepayers.filter(r=>(bulkForm.ward==="All Wards"||r.ward===bulkForm.ward)&&(bulkForm.category==="All"||r.category===bulkForm.category)).length}</strong> ratepayers · Total: <strong>{fmt(ratepayers.filter(r=>(bulkForm.ward==="All Wards"||r.ward===bulkForm.ward)&&(bulkForm.category==="All"||r.category===bulkForm.category)).length*parseFloat(bulkForm.amount||0))}</strong></div>}
      <div style={{display:"flex",gap:12}}><button onClick={()=>setShowBulk(false)} style={{flex:1,padding:"11px",background:"#f8faf8",border:"1px solid #e0ede0",borderRadius:8,color:"#4a7a58",cursor:"pointer",fontSize:14,fontFamily:"inherit"}}>Cancel</button><button onClick={issueBulk} disabled={saving} style={{flex:2,padding:"11px",background:saving?"#9ab89a":"linear-gradient(135deg,#b45309,#d97706)",border:"none",borderRadius:8,color:"#fff",cursor:saving?"not-allowed":"pointer",fontSize:14,fontWeight:600,fontFamily:"inherit"}}>{saving?"Issuing bills…":"Issue Bulk Notices"}</button></div>
    </Modal>}

    {payModal&&(()=>{const rp=ratepayers.find(r=>r.id===payModal.ratepayerId);return <Modal title="Record Payment" onClose={()=>setPayModal(null)}>
      <div style={{textAlign:"center",marginBottom:16}}>
        <div style={{color:"#1a2e1a",fontSize:18,fontWeight:700,fontFamily:"Cormorant Garamond,serif"}}>{rp?.name}</div>
        <div style={{color:"#7a9a78",fontSize:12,marginTop:2}}>{rp?.ward} · {payModal.type} · {payModal.period}</div>
        <div style={{fontSize:30,fontWeight:800,color:"#16a34a",fontFamily:"Cormorant Garamond,serif",margin:"12px 0"}}>{fmt(payModal.amount)}</div>
      </div>
      <div style={{marginBottom:16}}><label style={{display:"block",fontSize:11,color:"#4a7a58",marginBottom:8,textTransform:"uppercase",letterSpacing:"0.07em",fontWeight:700}}>Payment Method</label><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>{["Cash","Mobile Money"].map(m=><button key={m} type="button" onClick={()=>setPayMethod(m)} style={{padding:"12px",border:`2px solid ${payMethod===m?"#1a5c2a":"#e0ede0"}`,borderRadius:10,background:payMethod===m?"#e8f5ec":"#fff",color:payMethod===m?"#1a5c2a":"#7a9a78",fontWeight:payMethod===m?700:400,cursor:"pointer",fontSize:13,fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>{m==="Cash"?"💵":"📱"}{m}</button>)}</div></div>
      {payMethod==="Mobile Money"&&<div style={{background:"#f5f0ff",border:"1px solid #ddd6fe",borderRadius:10,padding:"14px",marginBottom:16}}><div style={{fontSize:12,color:"#7c3aed",fontWeight:700,marginBottom:10}}>📱 Mobile Money Details</div><Fld label="Network *"><select style={{...sel,borderColor:"#ddd6fe"}} value={momoNetwork} onChange={e=>setMomoNetwork(e.target.value)}>{MOMO_NETS.map(n=><option key={n}>{n}</option>)}</select></Fld><Fld label="MoMo Phone Number *"><input style={{...inp,borderColor:"#ddd6fe"}} value={momoPhone} onChange={e=>setMomoPhone(e.target.value)} placeholder="e.g. 0244XXXXXX"/></Fld><Fld label="Transaction Reference (optional)"><input style={{...inp,borderColor:"#ddd6fe"}} value={momoRef} onChange={e=>setMomoRef(e.target.value)} placeholder="e.g. ABC123456789"/></Fld></div>}
      <div style={{background:"#f0faf2",border:"1px solid #c8e6c8",borderRadius:8,padding:"10px 14px",fontSize:12,color:"#1a5c2a",marginBottom:16}}><div>Collected by: <strong>{me.name}</strong> ({me.staffId})</div><div>Date: <strong>{fmtDate(today())}</strong></div></div>
      <div style={{display:"flex",gap:12}}><button onClick={()=>setPayModal(null)} style={{flex:1,padding:"12px",background:"#f8faf8",border:"1px solid #e0ede0",borderRadius:8,color:"#4a7a58",cursor:"pointer",fontSize:14,fontFamily:"inherit"}}>Cancel</button><button onClick={()=>confirmPay(payModal)} disabled={saving} style={{flex:1,padding:"12px",background:saving?"#9ab89a":"linear-gradient(135deg,#166534,#16a34a)",border:"none",borderRadius:8,color:"#fff",cursor:saving?"not-allowed":"pointer",fontSize:14,fontWeight:600,fontFamily:"inherit"}}>{saving?"Saving…":"✓ Confirm Payment"}</button></div>
    </Modal>;})()}

    {cancelModal&&<CancelModal bill={cancelModal} saving={saving} onClose={()=>setCancelModal(null)} onConfirm={(reason)=>{if(!reason)return addToast("Enter a reason","error");cancelBill(cancelModal,reason);}} addToast={addToast}/>}
  </div>;
}

// =============================================================================
// RECEIPTS
// =============================================================================
function Receipts({payments,ratepayers,Officers,addToast}){
  const [search,setSearch]=useState("");const [filterMethod,setFilterMethod]=useState("all");const [dateFrom,setDateFrom]=useState("");const [dateTo,setDateTo]=useState("");
  const paid=payments.filter(p=>p.status==="paid"&&p.receiptNo);
  const filtered=paid.filter(p=>{const rp=ratepayers.find(r=>r.id===p.ratepayerId);const matchSearch=[rp?.name,p.receiptNo,p.type,p.period,rp?.ward].some(f=>f?.toLowerCase().includes(search.toLowerCase()));const matchMethod=filterMethod==="all"||(filterMethod==="momo"&&p.paymentMethod==="Mobile Money")||(filterMethod==="cash"&&p.paymentMethod!=="Mobile Money");const matchDate=(!dateFrom||p.date>=dateFrom)&&(!dateTo||p.date<=dateTo);return matchSearch&&matchMethod&&matchDate;});
  function doExport(){exportCSV(filtered.map(p=>{const rp=ratepayers.find(r=>r.id===p.ratepayerId);const off=Officers.find(o=>o.id===p.collectedBy);return{ReceiptNo:p.receiptNo,Ratepayer:rp?.name||"",PIN:rp?.pin||"",Ward:rp?.ward||"",LevyType:p.type,Period:p.period,Amount:p.amount,Date:p.date,Method:p.paymentMethod||"Cash",MoMoNetwork:p.momoNetwork||"",MoMoPhone:p.momoPhone||"",MoMoRef:p.momoRef||"",CollectedBy:off?.name||""}}),"receipts.csv");addToast("Receipts exported","success");}
  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24,flexWrap:"wrap",gap:12}}>
      <div><h2 style={{color:"#1a2e1a",fontFamily:"Cormorant Garamond,serif",margin:"0 0 4px",fontSize:26}}>Revenue Receipts</h2><p style={{color:"#4a7a58",margin:0,fontSize:13}}>{paid.length} receipts · {paid.filter(p=>p.paymentMethod==="Mobile Money").length} via MoMo</p></div>
      <button onClick={doExport} style={{...btn("#0369a1"),fontSize:12}}><Ic n="download" s={14}/>Export CSV</button>
    </div>
    <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
      <div style={{flex:1,position:"relative",minWidth:200}}><div style={{position:"absolute",left:13,top:"50%",transform:"translateY(-50%)",color:"#9ab89a"}}><Ic n="search" s={15}/></div><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search receipts…" style={{...inp,paddingLeft:38}}/></div>
      {[["all","All"],["cash","💵 Cash"],["momo","📱 MoMo"]].map(([v,l])=><button key={v} onClick={()=>setFilterMethod(v)} style={{padding:"10px 14px",borderRadius:8,border:"1px solid",fontSize:12,cursor:"pointer",fontFamily:"inherit",borderColor:filterMethod===v?"#1a5c2a":"#e0ede0",background:filterMethod===v?"#e8f5ec":"#fff",color:filterMethod===v?"#1a5c2a":"#7a9a78",fontWeight:filterMethod===v?700:400}}>{l}</button>)}
      <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{...inp,width:"auto",fontSize:12,padding:"10px"}}/>
      <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{...inp,width:"auto",fontSize:12,padding:"10px"}}/>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:14}}>
      {filtered.length===0?<div style={{gridColumn:"1/-1",textAlign:"center",padding:60,color:"#9ab89a"}}>No receipts found.</div>:filtered.map(p=>{const rp=ratepayers.find(r=>r.id===p.ratepayerId);const off=Officers.find(o=>o.id===p.collectedBy);const isMomo=p.paymentMethod==="Mobile Money";return <div key={p.id} style={{...card,padding:18,border:`1px solid ${isMomo?"#ddd6fe":"#c8e6c8"}`}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}><span style={{background:isMomo?"rgba(124,58,237,0.1)":"rgba(22,163,74,0.1)",color:isMomo?"#7c3aed":"#16a34a",padding:"3px 10px",borderRadius:20,fontSize:10,fontWeight:700}}>{isMomo?"📱 MOMO":"✓ CASH"}</span><span style={{color:"#1a5c2a",fontSize:11,fontFamily:"monospace"}}>{p.receiptNo}</span></div>
        <div style={{color:"#1a2e1a",fontSize:15,fontWeight:700,marginBottom:2}}>{rp?.name}</div>
        <div style={{color:"#7a9a78",fontSize:12}}>{p.type} · {p.period}</div>
        {isMomo&&<div style={{color:"#7c3aed",fontSize:11,marginTop:3}}>📱 {p.momoNetwork} · {p.momoPhone}</div>}
        <div style={{color:"#9ab89a",fontSize:11,marginTop:2}}>Paid {fmtDate(p.date)} · {off?.name||"—"}</div>
        <div style={{fontSize:22,fontWeight:800,color:isMomo?"#7c3aed":"#16a34a",fontFamily:"Cormorant Garamond,serif",margin:"12px 0"}}>{fmt(p.amount)}</div>
        <button onClick={()=>{openPrint(receiptHTML(p,rp,off));addToast("Sent to printer","success");}} style={{width:"100%",background:isMomo?"#f5f0ff":"#f0faf2",color:isMomo?"#7c3aed":"#16a34a",border:`1px solid ${isMomo?"#ddd6fe":"#c8e6c8"}`,borderRadius:8,padding:"9px",cursor:"pointer",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center",gap:6,fontFamily:"inherit",fontWeight:500}}><Ic n="print" s={13}/>Print Receipt</button>
      </div>;})}
    </div>
  </div>;
}

// =============================================================================
// DEFAULTERS
// =============================================================================
function Defaulters({payments,ratepayers,addToast}){
  const owing=payments.filter(p=>p.status==="owing");
  const totalOwed=owing.reduce((s,p)=>s+p.amount,0);
  const byRp={};owing.forEach(p=>{if(!byRp[p.ratepayerId])byRp[p.ratepayerId]=[];byRp[p.ratepayerId].push(p);});
  const sorted=Object.entries(byRp).sort((a,b)=>b[1].reduce((s,p)=>s+p.amount,0)-a[1].reduce((s,p)=>s+p.amount,0));
  function doExport(){exportCSV(sorted.map(([rpId,bills])=>{const rp=ratepayers.find(r=>r.id===rpId);const total=bills.reduce((s,b)=>s+b.amount,0);return{PIN:rp?.pin||"",Name:rp?.name||"",Ward:rp?.ward||"",Phone:rp?.phone||"",TotalOwed:total,Bills:bills.length,OldestDue:bills.map(b=>b.dueDate).sort()[0]||""}}),"defaulters.csv");addToast("Exported defaulters list","success");}
  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24,flexWrap:"wrap",gap:12}}>
      <div><h2 style={{color:"#1a2e1a",fontFamily:"Cormorant Garamond,serif",margin:"0 0 4px",fontSize:26}}>Defaulters &amp; Arrears</h2><p style={{color:"#4a7a58",margin:0,fontSize:13}}>{sorted.length} ratepayers with outstanding levies</p></div>
      <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
        <div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:10,padding:"10px 16px"}}><div style={{fontSize:11,color:"#92400e",textTransform:"uppercase",fontWeight:700}}>Total Outstanding</div><div style={{color:"#b45309",fontSize:18,fontWeight:700,fontFamily:"Cormorant Garamond,serif"}}>{fmt(totalOwed)}</div></div>
        <button onClick={doExport} style={{...btn("#0369a1"),fontSize:12}}><Ic n="download" s={14}/>Export</button>
      </div>
    </div>
    {sorted.length===0?<div style={{textAlign:"center",padding:70}}><div style={{fontSize:52,marginBottom:12}}>🎉</div><div style={{fontSize:20,fontFamily:"Cormorant Garamond,serif",color:"#1a5c2a"}}>All levies are paid up!</div></div>:
      sorted.map(([rpId,bills])=>{const rp=ratepayers.find(r=>r.id===rpId);const total=bills.reduce((s,b)=>s+b.amount,0);const hasOv=bills.some(b=>b.dueDate<today());
        return <div key={rpId} style={{...card,marginBottom:14,overflow:"hidden",border:`1px solid ${hasOv?"#fde68a":"#e8f0e8"}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 20px",background:hasOv?"#fffbeb":"#f8faf8",flexWrap:"wrap",gap:10}}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>{rp?.photoURL&&<img src={rp.photoURL} alt="" style={{width:40,height:40,borderRadius:8,objectFit:"cover"}}/>}<div><div style={{color:"#1a2e1a",fontSize:16,fontWeight:700,fontFamily:"Cormorant Garamond,serif"}}>{rp?.name}</div><div style={{color:"#7a9a78",fontSize:12,marginTop:2}}>{rp?.pin} · {rp?.ward} · {rp?.phone}</div>{rp?.gps&&<a href={`https://maps.google.com/?q=${rp.gps.lat},${rp.gps.lng}`} target="_blank" rel="noreferrer" style={{fontSize:11,color:"#1a5c2a",textDecoration:"none",display:"inline-flex",alignItems:"center",gap:3,marginTop:2}}><Ic n="map" s={10}/>View on map</a>}</div></div>
            <div style={{textAlign:"right"}}><div style={{color:"#b45309",fontSize:20,fontWeight:800}}>{fmt(total)}</div><div style={{color:"#9ab89a",fontSize:11}}>{bills.length} bill{bills.length>1?"s":""} unpaid</div>{hasOv&&<div style={{color:"#ef4444",fontSize:11,fontWeight:700}}>⚠ OVERDUE</div>}</div>
          </div>
          <div style={{padding:"4px 20px 14px"}}>{bills.map(b=>{const isOv=b.dueDate<today();return <div key={b.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:"1px solid #f5f5f5",flexWrap:"wrap",gap:8}}><div><span style={{color:"#2a5a38",fontSize:13}}>{b.type}</span><span style={{color:"#9ab89a",margin:"0 6px"}}>·</span><span style={{color:"#7a9a78",fontSize:12}}>{b.period}</span><span style={{color:isOv?"#ef4444":"#9ab89a",fontSize:11,marginLeft:8}}>Due: {fmtDate(b.dueDate)}</span></div><div style={{display:"flex",alignItems:"center",gap:8}}><span style={{color:isOv?"#ef4444":"#b45309",fontWeight:700,fontSize:14}}>{fmt(b.amount)}</span><button onClick={()=>{openPrint(billHTML(b,rp));addToast("Notice printed","success");}} style={{background:"rgba(180,83,9,0.08)",color:"#b45309",border:"none",borderRadius:6,padding:"5px 10px",cursor:"pointer",fontSize:11,display:"flex",alignItems:"center",gap:4,fontFamily:"inherit"}}><Ic n="print" s={12}/>Notice</button></div></div>;})}
          </div>
        </div>;})}
  </div>;
}

// =============================================================================
// REPORTS — revenue summary with export
// =============================================================================
function Reports({payments,ratepayers,Officers,me}){
  const [dateFrom,setDateFrom]=useState(new Date().getFullYear()+"-01-01");
  const [dateTo,setDateTo]=useState(today());
  const [groupBy,setGroupBy]=useState("type");

  const paid=payments.filter(p=>p.status==="paid"&&(!dateFrom||p.date>=dateFrom)&&(!dateTo||p.date<=dateTo));
  const totalRevenue=paid.reduce((s,p)=>s+p.amount,0);
  const momoRevenue=paid.filter(p=>p.paymentMethod==="Mobile Money").reduce((s,p)=>s+p.amount,0);
  const cashRevenue=totalRevenue-momoRevenue;

  const grouped={};
  paid.forEach(p=>{
    let key;
    if(groupBy==="type")key=p.type;
    else if(groupBy==="ward"){const rp=ratepayers.find(r=>r.id===p.ratepayerId);key=rp?.ward||"Unknown";}
    else if(groupBy==="officer"){const off=Officers.find(o=>o.id===p.collectedBy);key=off?.name||"Unknown";}
    else if(groupBy==="month")key=p.date?.substr(0,7)||"Unknown";
    else key=p.paymentMethod||"Cash";
    if(!grouped[key])grouped[key]={total:0,count:0,momo:0};
    grouped[key].total+=p.amount;grouped[key].count++;
    if(p.paymentMethod==="Mobile Money")grouped[key].momo+=p.amount;
  });
  const rows=Object.entries(grouped).sort((a,b)=>b[1].total-a[1].total);
  const maxVal=Math.max(...rows.map(r=>r[1].total),1);

  function printReport(){
    const rowsHTML=rows.map(([k,v])=>`<tr><td>${k}</td><td style="text-align:right">${fmt(v.total)}</td><td style="text-align:right">${v.count}</td><td style="text-align:right">${v.total>0?Math.round((v.total/totalRevenue)*100):0}%</td></tr>`).join("");
    openPrint(`<!DOCTYPE html><html><head><title>Revenue Report</title><style>${PS}</style></head><body>${HDR}<h2>Revenue Report — ${fmtDate(dateFrom)} to ${fmtDate(dateTo)}</h2><div class="row"><span class="lbl">Total Revenue</span><span class="val">${fmt(totalRevenue)}</span></div><div class="row"><span class="lbl">Cash</span><span class="val">${fmt(cashRevenue)}</span></div><div class="row"><span class="lbl">Mobile Money</span><span class="val">${fmt(momoRevenue)}</span></div><div class="row"><span class="lbl">Total Payments</span><span class="val">${paid.length}</span></div><br/><h2>Breakdown by ${groupBy}</h2><table><thead><tr><th>${groupBy.charAt(0).toUpperCase()+groupBy.slice(1)}</th><th style="text-align:right">Amount</th><th style="text-align:right">Count</th><th style="text-align:right">Share</th></tr></thead><tbody>${rowsHTML}</tbody></table><div class="ftr">Generated by ${me.name} on ${fmtDate(today())} · Bekwai Municipal Assembly</div></body></html>`);
  }

  function doExport(){exportCSV(rows.map(([k,v])=>({[groupBy.charAt(0).toUpperCase()+groupBy.slice(1)]:k,TotalRevenue:v.total,Payments:v.count,MoMoRevenue:v.momo,CashRevenue:v.total-v.momo,SharePercent:totalRevenue>0?Math.round((v.total/totalRevenue)*100):0})),"revenue-report.csv");}

  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24,flexWrap:"wrap",gap:12}}>
      <div><h2 style={{color:"#1a2e1a",fontFamily:"Cormorant Garamond,serif",margin:"0 0 4px",fontSize:26}}>Revenue Reports</h2><p style={{color:"#4a7a58",margin:0,fontSize:13}}>Analyse and export revenue data</p></div>
      <div style={{display:"flex",gap:8}}><button onClick={doExport} style={{...btn("#0369a1"),fontSize:12}}><Ic n="download" s={14}/>Export CSV</button><button onClick={printReport} style={{...btn("#b45309"),fontSize:12}}><Ic n="print" s={14}/>Print Report</button></div>
    </div>

    <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
      <div><label style={{fontSize:11,color:"#4a7a58",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",display:"block",marginBottom:4}}>From</label><input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{...inp,width:"auto",fontSize:12,padding:"8px 10px"}}/></div>
      <div><label style={{fontSize:11,color:"#4a7a58",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",display:"block",marginBottom:4}}>To</label><input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{...inp,width:"auto",fontSize:12,padding:"8px 10px"}}/></div>
      <div><label style={{fontSize:11,color:"#4a7a58",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",display:"block",marginBottom:4}}>Group By</label><select value={groupBy} onChange={e=>setGroupBy(e.target.value)} style={{...sel,width:"auto",fontSize:13,padding:"8px 12px"}}><option value="type">Levy Type</option><option value="ward">Ward</option><option value="officer">Officer</option><option value="month">Month</option><option value="method">Payment Method</option></select></div>
    </div>

    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:14,marginBottom:24}}>
      <StatCard label="Total Revenue"  value={fmt(totalRevenue)} icon="trend"    color="#16a34a" sub={`${paid.length} payments`}/>
      <StatCard label="Cash"           value={fmt(cashRevenue)}  icon="payments" color="#0369a1" sub={`${paid.filter(p=>p.paymentMethod!=="Mobile Money").length} transactions`}/>
      <StatCard label="Mobile Money"   value={fmt(momoRevenue)}  icon="phone"    color="#7c3aed" sub={`${paid.filter(p=>p.paymentMethod==="Mobile Money").length} transactions`}/>
      <StatCard label="MoMo Share"     value={totalRevenue>0?Math.round((momoRevenue/totalRevenue)*100)+"%":"0%"} icon="chart" color="#b45309" sub="of total revenue"/>
    </div>

    <div style={{...card,padding:20}}>
      <h3 style={{margin:"0 0 20px",color:"#4a7a58",fontSize:12,textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:700}}>Breakdown by {groupBy.charAt(0).toUpperCase()+groupBy.slice(1)}</h3>
      {rows.length===0?<p style={{color:"#9ab89a",fontSize:13,margin:0}}>No payments in this period.</p>:rows.map(([k,v])=>{const pct=totalRevenue>0?Math.round((v.total/totalRevenue)*100):0;return <div key={k} style={{marginBottom:16}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:6,flexWrap:"wrap",gap:8}}><div><span style={{color:"#1a2e1a",fontSize:13,fontWeight:600}}>{k}</span><span style={{color:"#9ab89a",fontSize:11,marginLeft:8}}>{v.count} payment{v.count!==1?"s":""}</span></div><div style={{textAlign:"right"}}><span style={{color:"#1a5c2a",fontSize:14,fontWeight:700}}>{fmt(v.total)}</span><span style={{color:"#9ab89a",fontSize:11,marginLeft:6}}>{pct}%</span></div></div><div style={{height:8,background:"#e8f0e8",borderRadius:4}}><div style={{height:"100%",width:`${(v.total/maxVal)*100}%`,background:"linear-gradient(90deg,#1a5c2a,#4ade80)",borderRadius:4,transition:"width 0.5s ease"}}/></div>{v.momo>0&&<div style={{fontSize:11,color:"#7c3aed",marginTop:3}}>📱 {fmt(v.momo)} via MoMo</div>}</div>;})}
    </div>
  </div>;
}

// =============================================================================
// AUDIT TRAIL VIEWER
// =============================================================================
function AuditPage({me}){
  const [logs,setLogs]=useState([]);const [loading,setLoading]=useState(true);const [search,setSearch]=useState("");

  useEffect(()=>{
    const q=query(collection(db,"audit_logs"),orderBy("timestamp","desc"));
    const unsub=onSnapshot(q,snap=>{setLogs(snap.docs.map(d=>({id:d.id,...d.data(),ts:d.data().timestamp?.toDate?.()?.toISOString()?.substr(0,19).replace("T"," ")||""})));setLoading(false);});
    return()=>unsub();
  },[]);

  const filtered=logs.filter(l=>[l.action,l.officerName,l.details].some(f=>f?.toLowerCase().includes(search.toLowerCase())));
  const actionColor={RATEPAYER_REGISTERED:"#2563eb",RATEPAYER_UPDATED:"#0369a1",BILL_ISSUED:"#b45309",BULK_BILLS_ISSUED:"#92400e",PAYMENT_COLLECTED:"#16a34a",OFFICER_REGISTERED:"#7c3aed",OFFICER_UPDATED:"#6d28d9",OFFICER_STATUS:"#dc2626",PASSWORD_RESET:"#d97706",BILL_CANCELLED:"#ef4444"};

  if(loading)return <div style={{textAlign:"center",padding:60,color:"#9ab89a"}}>Loading audit logs…</div>;

  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24,flexWrap:"wrap",gap:12}}>
      <div><h2 style={{color:"#1a2e1a",fontFamily:"Cormorant Garamond,serif",margin:"0 0 4px",fontSize:26}}>Audit Trail</h2><p style={{color:"#4a7a58",margin:0,fontSize:13}}>{logs.length} total events · read-only</p></div>
    </div>
    <div style={{position:"relative",marginBottom:16}}><div style={{position:"absolute",left:13,top:"50%",transform:"translateY(-50%)",color:"#9ab89a"}}><Ic n="search" s={15}/></div><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by action, officer, details…" style={{...inp,paddingLeft:38}}/></div>
    <div style={{...card,overflow:"hidden"}}>
      {filtered.length===0?<div style={{textAlign:"center",padding:40,color:"#9ab89a"}}>No audit logs found.</div>:
        filtered.slice(0,200).map(l=><div key={l.id} style={{display:"flex",gap:14,padding:"12px 18px",borderBottom:"1px solid #f5f5f5",alignItems:"flex-start"}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:actionColor[l.action]||"#9ab89a",marginTop:5,flexShrink:0}}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:4}}>
              <span style={{background:(actionColor[l.action]||"#9ab89a")+"18",color:actionColor[l.action]||"#9ab89a",padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700}}>{l.action}</span>
              <span style={{color:"#9ab89a",fontSize:11}}>{l.ts}</span>
            </div>
            <div style={{color:"#1a2e1a",fontSize:13,marginTop:4,fontWeight:500}}>{l.details}</div>
            <div style={{color:"#7a9a78",fontSize:11,marginTop:2}}>By: {l.officerName}</div>
          </div>
        </div>)}
    </div>
  </div>;
}

// =============================================================================
// IAM
// =============================================================================
function IAMPage({Officers,me,addToast}){
  const [search,setSearch]=useState("");const [showForm,setShowForm]=useState(false);const [editT,setEditT]=useState(null);const [showP,setShowP]=useState(false);const [saving,setSaving]=useState(false);const [resetModal,setResetModal]=useState(null);const [form,setForm]=useState({name:"",email:"",phone:"",role:"COLLECTOR",ward:"Central Ward",staffId:"",password:"",confirm:""});
  const filtered=Officers.filter(o=>[o.name,o.email,o.staffId,o.ward,ROLES[o.role]?.label].some(f=>f?.toLowerCase().includes(search.toLowerCase())));
  function openAdd(){setForm({name:"",email:"",phone:"",role:"COLLECTOR",ward:"Central Ward",staffId:"",password:"",confirm:""});setEditT(null);setShowForm(true);}
  function openEdit(o){setForm({...o,password:"",confirm:""});setEditT(o);setShowForm(true);}

  async function save(){
    if(!form.name||!form.email||!form.staffId)return addToast("Name, email and Staff ID required","error");
    if(!editT&&!form.password)return addToast("Password required for new Officers","error");
    if(form.password&&form.password!==form.confirm)return addToast("Passwords do not match","error");
    if(form.password&&form.password.length<6)return addToast("Password must be at least 6 characters","error");
    setSaving(true);
    try{
      if(editT){await updateDoc(doc(db,"Officers",editT.id),{name:form.name,phone:form.phone,role:form.role,ward:form.ward,staffId:form.staffId});await logAudit(me.id,me.name,"OFFICER_UPDATED",`${form.name} updated by ${me.name}`);addToast(`${form.name} updated`,"success");}
      else{const cred=await createUserWithEmailAndPassword(auth,form.email,form.password);await setDoc(doc(db,"Officers",cred.user.uid),{id:cred.user.uid,name:form.name,email:form.email,phone:form.phone,role:form.role,ward:form.ward,staffId:form.staffId,status:"active",createdAt:today(),lastLogin:null});await logAudit(me.id,me.name,"OFFICER_REGISTERED",`${form.name} (${form.role}) registered by ${me.name}`);addToast(`Officer ${form.name} registered!`,"success");}
      setShowForm(false);
    }catch(e){addToast(e.code==="auth/email-already-in-use"?"Email already exists":"Failed: "+e.message,"error");}
    setSaving(false);
  }

  async function toggleStatus(o){
    if(o.id===me.id)return addToast("Cannot suspend your own account","error");
    const ns=o.status==="active"?"suspended":"active";
    try{await updateDoc(doc(db,"Officers",o.id),{status:ns});await logAudit(me.id,me.name,"OFFICER_STATUS",`${o.name} ${ns} by ${me.name}`);addToast(`${o.name} ${ns}`,ns==="active"?"success":"info");}
    catch(e){addToast("Failed: "+e.message,"error");}
  }

  async function sendReset(email){
    try{await sendPasswordResetEmail(auth,email);await logAudit(me.id,me.name,"PASSWORD_RESET",`Reset email sent to ${email} by ${me.name}`);addToast(`Password reset email sent to ${email}`,"success");setResetModal(null);}
    catch(e){addToast("Failed to send reset: "+e.message,"error");}
  }

  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24,flexWrap:"wrap",gap:12}}>
      <div><h2 style={{color:"#1a2e1a",fontFamily:"Cormorant Garamond,serif",margin:"0 0 4px",fontSize:26}}>Officer Management</h2><p style={{color:"#4a7a58",margin:0,fontSize:13}}>Firebase Auth · Real accounts · Real-time sync</p></div>
      <button onClick={openAdd} style={btn()}><Ic n="plus" s={14}/>Register Officer</button>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(172px,1fr))",gap:12,marginBottom:22}}>{Object.entries(ROLES).map(([key,role])=>{const cnt=Officers.filter(o=>o.role===key&&o.status==="active").length;return <div key={key} style={{...card,padding:"13px 15px",border:`1px solid ${role.color}25`}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}><span style={{background:role.bg,color:role.color,padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700,whiteSpace:"nowrap"}}>{role.label}</span><span style={{fontSize:20,fontWeight:700,color:"#1a2e1a",fontFamily:"Cormorant Garamond,serif"}}>{cnt}</span></div><div style={{fontSize:11,color:"#7a9a78",lineHeight:1.4}}>{role.description}</div></div>;})}
    </div>
    <div style={{position:"relative",marginBottom:16}}><div style={{position:"absolute",left:13,top:"50%",transform:"translateY(-50%)",color:"#9ab89a"}}><Ic n="search" s={15}/></div><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search Officers…" style={{...inp,paddingLeft:38}}/></div>
    <div style={{...card,overflow:"hidden",overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse",minWidth:820}}>
        <thead><tr style={{background:"#f0faf2"}}>{["Officer","Staff ID","Role","Ward","Status","Last Login","Actions"].map(h=><th key={h} style={{textAlign:"left",padding:"12px 14px",fontSize:11,color:"#4a7a58",textTransform:"uppercase",letterSpacing:"0.07em",fontWeight:700}}>{h}</th>)}</tr></thead>
        <tbody>{filtered.map(o=>{const role=ROLES[o.role];const isMe=o.id===me.id;return <tr key={o.id} style={{borderTop:"1px solid #f5f5f5",background:isMe?"#f0faf2":"transparent"}}>
          <td style={{padding:"12px 14px"}}><div style={{display:"flex",alignItems:"center",gap:10}}><div style={{width:36,height:36,background:role?.bg,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",color:role?.color,fontSize:14,fontWeight:700,flexShrink:0}}>{o.name.charAt(0)}</div><div><div style={{color:"#1a2e1a",fontSize:13,fontWeight:600}}>{o.name}{isMe&&<span style={{fontSize:10,background:"#e8f5ec",color:"#1a5c2a",padding:"1px 6px",borderRadius:10,marginLeft:6}}>You</span>}</div><div style={{color:"#7a9a78",fontSize:11}}>{o.email}</div></div></div></td>
          <td style={{padding:"12px 14px",color:"#2a5a38",fontSize:12,fontFamily:"monospace"}}>{o.staffId}</td>
          <td style={{padding:"12px 14px"}}><span style={{background:role?.bg,color:role?.color,padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:600,whiteSpace:"nowrap"}}>{role?.label}</span></td>
          <td style={{padding:"12px 14px",color:"#4a7a58",fontSize:13}}>{o.ward}</td>
          <td style={{padding:"12px 14px"}}><span style={{background:o.status==="active"?"rgba(22,163,74,0.1)":"rgba(239,68,68,0.1)",color:o.status==="active"?"#16a34a":"#ef4444",padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:600}}>{o.status==="active"?"● Active":"● Suspended"}</span></td>
          <td style={{padding:"12px 14px",color:"#9ab89a",fontSize:12}}>{o.lastLogin?fmtDate(o.lastLogin):"Never"}</td>
          <td style={{padding:"12px 14px"}}><div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
            <button onClick={()=>openEdit(o)} style={{background:"rgba(37,99,235,0.08)",color:"#2563eb",border:"none",borderRadius:6,padding:"5px 8px",cursor:"pointer",fontSize:11,display:"flex",alignItems:"center",gap:3}}><Ic n="edit" s={12}/>Edit</button>
            {!isMe&&<button onClick={()=>toggleStatus(o)} style={{background:o.status==="active"?"rgba(239,68,68,0.08)":"rgba(22,163,74,0.08)",color:o.status==="active"?"#ef4444":"#16a34a",border:"none",borderRadius:6,padding:"5px 8px",cursor:"pointer",fontSize:11,display:"flex",alignItems:"center",gap:3}}><Ic n={o.status==="active"?"ban":"check"} s={12}/>{o.status==="active"?"Suspend":"Restore"}</button>}
            <button onClick={()=>setResetModal(o)} style={{background:"rgba(180,83,9,0.08)",color:"#b45309",border:"none",borderRadius:6,padding:"5px 8px",cursor:"pointer",fontSize:11,display:"flex",alignItems:"center",gap:3}}><Ic n="lock" s={12}/>Reset</button>
          </div></td>
        </tr>;})}
        </tbody>
      </table>
    </div>

    {showForm&&<Modal title={editT?`Edit — ${editT.name}`:"Register New Officer"} onClose={()=>setShowForm(false)} wide>
      <div style={{background:"#f0faf2",border:"1px solid #c8e6c8",borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:13,color:"#1a5c2a"}}><strong>Role:</strong> {ROLES[form.role]?.description}</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><Fld label="Full Name *"><input style={inp} value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="e.g. Kwame Mensah"/></Fld><Fld label="Staff ID *"><input style={inp} value={form.staffId} onChange={e=>setForm(p=>({...p,staffId:e.target.value}))} placeholder="BMA-STAFF-XXX"/></Fld></div>
      <Fld label="Official Email *"><input style={{...inp,opacity:editT?0.6:1}} type="email" value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))} placeholder="name@bekwaiassembly.gov.gh" disabled={!!editT}/></Fld>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><Fld label="Phone"><input style={inp} value={form.phone} onChange={e=>setForm(p=>({...p,phone:e.target.value}))} placeholder="0244XXXXXX"/></Fld><Fld label="Ward"><select style={sel} value={form.ward} onChange={e=>setForm(p=>({...p,ward:e.target.value}))}>{WARDS.map(w=><option key={w}>{w}</option>)}</select></Fld></div>
      <Fld label="Access Role"><select style={sel} value={form.role} onChange={e=>setForm(p=>({...p,role:e.target.value}))}>{Object.entries(ROLES).map(([k,r])=><option key={k} value={k}>{r.label}</option>)}</select></Fld>
      {!editT&&<div style={{borderTop:"1px solid #f0f0f0",paddingTop:14}}><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><Fld label="Password *"><div style={{position:"relative"}}><input style={{...inp,paddingRight:40}} type={showP?"text":"password"} value={form.password} onChange={e=>setForm(p=>({...p,password:e.target.value}))} placeholder="Min 6 characters"/><button onClick={()=>setShowP(v=>!v)} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"#4a7a58"}}><Ic n={showP?"eyeoff":"eye"} s={14}/></button></div></Fld><Fld label="Confirm Password *"><input style={inp} type="password" value={form.confirm} onChange={e=>setForm(p=>({...p,confirm:e.target.value}))} placeholder="Repeat password"/></Fld></div></div>}
      <div style={{display:"flex",gap:12,marginTop:14}}><button onClick={()=>setShowForm(false)} style={{flex:1,padding:"11px",background:"#f8faf8",border:"1px solid #e0ede0",borderRadius:8,color:"#4a7a58",cursor:"pointer",fontSize:14,fontFamily:"inherit"}}>Cancel</button><button onClick={save} disabled={saving} style={{flex:2,padding:"11px",background:saving?"#9ab89a":"linear-gradient(135deg,#1a5c2a,#2d8a45)",border:"none",borderRadius:8,color:"#fff",cursor:saving?"not-allowed":"pointer",fontSize:14,fontWeight:600,fontFamily:"inherit"}}>{saving?"Saving…":editT?"Save Changes":"Register in Firebase"}</button></div>
    </Modal>}

    {resetModal&&<Modal title="Send Password Reset" onClose={()=>setResetModal(null)}>
      <div style={{textAlign:"center",padding:"8px 0"}}>
        <div style={{fontSize:40,marginBottom:10}}>🔑</div>
        <div style={{color:"#1a2e1a",fontSize:16,fontWeight:700,marginBottom:6}}>{resetModal.name}</div>
        <div style={{color:"#7a9a78",fontSize:13,marginBottom:16}}>{resetModal.email}</div>
        <p style={{color:"#4a7a58",fontSize:13,margin:"0 0 20px",lineHeight:1.6}}>Firebase will send a password reset link to this officer's email. They can then set a new password and log back in.</p>
        <div style={{display:"flex",gap:12}}><button onClick={()=>setResetModal(null)} style={{flex:1,padding:"11px",background:"#f8faf8",border:"1px solid #e0ede0",borderRadius:8,color:"#4a7a58",cursor:"pointer",fontSize:14,fontFamily:"inherit"}}>Cancel</button><button onClick={()=>sendReset(resetModal.email)} style={{flex:1,padding:"11px",background:"linear-gradient(135deg,#b45309,#d97706)",border:"none",borderRadius:8,color:"#fff",cursor:"pointer",fontSize:14,fontWeight:600,fontFamily:"inherit"}}>Send Reset Email</button></div>
      </div>
    </Modal>}
  </div>;
}

// =============================================================================
// ROOT APP
// =============================================================================
export default function App(){
  const [me,setMe]               = useState(null);
  const [authReady,setAuthReady] = useState(false);
  const [dataLoading,setDataLoading] = useState(false);
  const [Officers,setOfficers]   = useState([]);
  const [ratepayers,setRatepayers] = useState([]);
  const [payments,setPayments]   = useState([]);
  const [toasts,setToasts]       = useState([]);
  const [tab,setTab]             = useState("dashboard");
  const [mobileOpen,setMobileOpen] = useState(false);
  const [isOffline,setIsOffline] = useState(!navigator.onLine);
  const [sessionRemaining,setSessionRemaining] = useState(null);
  const sessionTimer=useRef(null);const countdownTimer=useRef(null);const sessionEnd=useRef(null);

  useEffect(()=>{const on=()=>setIsOffline(false);const off=()=>setIsOffline(true);window.addEventListener("online",on);window.addEventListener("offline",off);return()=>{window.removeEventListener("online",on);window.removeEventListener("offline",off);};},[]);

  useEffect(()=>{
    const unsub=onAuthStateChanged(auth,async user=>{
      if(user){
        try{const snap=await getDoc(doc(db,"Officers",user.uid));if(snap.exists()&&snap.data().status==="active"){setMe({id:snap.id,...snap.data()});setDataLoading(true);}else{await signOut(auth);}}
        catch(e){console.warn("Profile load failed:",e.message);}
      }else{setMe(null);setOfficers([]);setRatepayers([]);setPayments([]);setDataLoading(false);setSessionRemaining(null);}
      setAuthReady(true);
    });
    return()=>unsub();
  },[]);

  useEffect(()=>{
    if(!me)return;
    const u1=onSnapshot(collection(db,"ratepayers"),snap=>{setRatepayers(snap.docs.map(d=>({id:d.id,...d.data()})));setDataLoading(false);});
    const u2=onSnapshot(query(collection(db,"payments"),orderBy("dueDate","desc")),snap=>{setPayments(snap.docs.map(d=>({id:d.id,...d.data()})));});
    const u3=onSnapshot(collection(db,"Officers"),snap=>{setOfficers(snap.docs.map(d=>({id:d.id,...d.data()})));});
    return()=>{u1();u2();u3();};
  },[me]);

  const addToast=useCallback((msg,type="success")=>{const id=Date.now();setToasts(t=>[...t,{id,msg,type}]);setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),5000);},[]);

  const resetSession=useCallback(()=>{
    clearTimeout(sessionTimer.current);clearInterval(countdownTimer.current);
    sessionEnd.current=Date.now()+SESSION_MS;setSessionRemaining(SESSION_MS);
    sessionTimer.current=setTimeout(async()=>{await signOut(auth);addToast("Session expired. Please sign in again.","warning");},SESSION_MS);
    countdownTimer.current=setInterval(()=>{const r=sessionEnd.current-Date.now();if(r<=0){clearInterval(countdownTimer.current);setSessionRemaining(0);}else{setSessionRemaining(r);}},1000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  useEffect(()=>{
    if(!me)return;
    const events=["mousemove","keydown","touchstart","click","scroll"];
    events.forEach(e=>window.addEventListener(e,resetSession));
    resetSession();
    return()=>{clearTimeout(sessionTimer.current);clearInterval(countdownTimer.current);events.forEach(e=>window.removeEventListener(e,resetSession));};
  },[me,resetSession]);

  async function handleLogout(){await signOut(auth);setTab("dashboard");}

  if(!authReady)  return <LoadingScreen msg="Connecting to Firebase…"/>;
  if(!me)         return <LoginPage addToast={addToast}/>;
  if(dataLoading) return <LoadingScreen msg="Loading assembly data…"/>;

  const role=ROLES[me.role];
  const owingCount=payments.filter(p=>p.status==="owing").length;
  const NAV=[
    {id:"dashboard", icon:"dashboard",label:"Dashboard",    perm:"dashboard"},
    {id:"ratepayers",icon:"users",    label:"Ratepayers",   perm:"ratepayers"},
    {id:"payments",  icon:"payments", label:"Levies & Bills",perm:"payments"},
    {id:"receipts",  icon:"receipt",  label:"Receipts",     perm:"receipts"},
    {id:"defaulters",icon:"alert",    label:"Defaulters",   perm:"defaulters"},
    {id:"reports",   icon:"chart",    label:"Reports",      perm:"reports"},
    {id:"audit",     icon:"list",     label:"Audit Trail",  perm:"audit"},
    {id:"iam",       icon:"shield",   label:"Officers",     perm:"iam"},
  ].filter(item=>canDo(me,item.perm));

  const pp={ratepayers,payments,Officers,me,addToast,setTab};

  function Sidebar(){return <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
    <div style={{padding:"20px 18px 14px",borderBottom:"1px solid #e8f0e8"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
        <img src="/logo.png" alt="BMA" style={{width:40,height:40,objectFit:"contain",flexShrink:0}}/>
        <div style={{fontSize:13,fontWeight:700,color:"#1a2e1a",fontFamily:"Cormorant Garamond,serif",lineHeight:1.3}}>Bekwai Municipal<br/>Assembly</div>
      </div>
      <div style={{background:"#f0faf2",borderRadius:10,padding:"9px 11px",display:"flex",alignItems:"center",gap:8}}>
        <div style={{width:30,height:30,background:role?.bg,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",color:role?.color,fontSize:13,fontWeight:700,flexShrink:0}}>{me.name.charAt(0)}</div>
        <div style={{minWidth:0}}><div style={{color:"#1a2e1a",fontSize:12,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{me.name}</div><div style={{fontSize:10,color:role?.color,fontWeight:600}}>{role?.label}</div></div>
      </div>
      {isOffline&&<div style={{marginTop:8,background:"#374151",borderRadius:8,padding:"5px 10px",display:"flex",alignItems:"center",gap:6,fontSize:10,color:"#d1d5db"}}><Ic n="wifi" s={11}/>Offline mode</div>}
    </div>
    <nav style={{padding:"10px 10px",flex:1,overflowY:"auto"}}>
      {NAV.map(item=><button key={item.id} onClick={()=>{setTab(item.id);setMobileOpen(false);}} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,border:"none",cursor:"pointer",marginBottom:2,textAlign:"left",fontFamily:"inherit",fontSize:13,background:tab===item.id?"linear-gradient(135deg,#e8f5ec,#d4ede0)":"transparent",color:tab===item.id?"#1a5c2a":"#4a7a58",fontWeight:tab===item.id?700:400,borderLeft:tab===item.id?"3px solid #1a5c2a":"3px solid transparent",transition:"all 0.15s"}}>
        <Ic n={item.icon} s={16}/>{item.label}
        {item.id==="defaulters"&&owingCount>0&&<span style={{marginLeft:"auto",background:"#fef3c7",color:"#b45309",borderRadius:20,fontSize:10,padding:"2px 7px",fontWeight:700}}>{owingCount}</span>}
      </button>)}
    </nav>
    <div style={{padding:"12px 14px",borderTop:"1px solid #e8f0e8"}}>
      <button onClick={handleLogout} style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"10px 12px",borderRadius:10,border:"1px solid #fecaca",background:"#fff5f5",color:"#ef4444",cursor:"pointer",fontSize:13,fontFamily:"inherit",fontWeight:500}}><Ic n="logout" s={15}/>Sign Out</button>
      <div style={{marginTop:8,fontSize:10,color:"#9ab89a",textAlign:"center"}}>© 2026 Bekwai Municipal Assembly</div>
    </div>
  </div>;}

  return <div style={{display:"flex",minHeight:"100vh",background:"#f5f7f5",fontFamily:"Outfit,'Segoe UI',sans-serif",color:"#1a2e1a"}}>
    <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Outfit:wght@400;500;600;700&display=swap');*{box-sizing:border-box}::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-track{background:#f0f0f0}::-webkit-scrollbar-thumb{background:rgba(26,92,42,0.2);border-radius:2px}@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}@keyframes slideIn{from{transform:translateX(20px);opacity:0}to{transform:translateX(0);opacity:1}}@keyframes spin{to{transform:rotate(360deg)}}@keyframes bar{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}input:focus,select:focus,textarea:focus{border-color:#1a5c2a!important;box-shadow:0 0 0 3px rgba(26,92,42,0.1)!important;outline:none}button:active{transform:scale(0.98)}@media(max-width:768px){.dsk{display:none!important}.mtb{display:flex!important}.pad{padding:16px!important}}`}</style>
    <Toast toasts={toasts}/>
    <aside className="dsk" style={{width:224,background:"#fff",borderRight:"1px solid #e8f0e8",display:"flex",flexDirection:"column",position:"sticky",top:0,height:"100vh",flexShrink:0,boxShadow:"2px 0 8px rgba(26,92,42,0.05)"}}><Sidebar/></aside>
    {mobileOpen&&<div style={{position:"fixed",inset:0,zIndex:500}}><div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.4)"}} onClick={()=>setMobileOpen(false)}/><div style={{position:"absolute",left:0,top:0,bottom:0,width:240,background:"#fff",borderRight:"1px solid #e8f0e8",display:"flex",flexDirection:"column"}}><Sidebar/></div></div>}
    <main style={{flex:1,display:"flex",flexDirection:"column",minWidth:0}}>
      <OfflineBanner show={isOffline}/>
      <SessionBanner remaining={sessionRemaining}/>
      <div className="mtb" style={{display:"none",padding:"12px 16px",background:"#fff",borderBottom:"1px solid #e8f0e8",alignItems:"center",gap:12,position:"sticky",top:0,zIndex:100,boxShadow:"0 2px 4px rgba(26,92,42,0.06)"}}>
        <button onClick={()=>setMobileOpen(true)} style={{background:"none",border:"none",color:"#4a7a58",cursor:"pointer",padding:4}}><Ic n="menu" s={22}/></button>
        <img src={`${window.location.origin}/logo.png`} alt="BMA" style={{width:32,height:32,objectFit:"contain"}}/>
        <span style={{fontFamily:"Cormorant Garamond,serif",color:"#1a5c2a",fontWeight:700,fontSize:15}}>Bekwai Municipal Assembly</span>
      </div>
      <div className="pad" style={{flex:1,padding:28,maxWidth:1200,width:"100%",margin:"0 auto"}}>
        {tab==="dashboard"  &&<Dashboard   {...pp}/>}
        {tab==="ratepayers" &&(canDo(me,"ratepayers")?<Ratepayers {...pp}/>:<AccessDenied role={me.role}/>)}
        {tab==="payments"   &&(canDo(me,"payments")  ?<Payments   {...pp}/>:<AccessDenied role={me.role}/>)}
        {tab==="receipts"   &&(canDo(me,"receipts")  ?<Receipts   {...pp}/>:<AccessDenied role={me.role}/>)}
        {tab==="defaulters" &&(canDo(me,"defaulters")?<Defaulters {...pp}/>:<AccessDenied role={me.role}/>)}
        {tab==="reports"    &&(canDo(me,"reports")   ?<Reports    {...pp}/>:<AccessDenied role={me.role}/>)}
        {tab==="audit"      &&(canDo(me,"audit")     ?<AuditPage  {...pp}/>:<AccessDenied role={me.role}/>)}
        {tab==="iam"        &&(canDo(me,"iam")       ?<IAMPage    {...pp}/>:<AccessDenied role={me.role}/>)}
      </div>
    </main>
  </div>;
}
