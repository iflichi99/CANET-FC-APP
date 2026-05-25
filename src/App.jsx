import { useState, useEffect, useCallback } from "react";
import { loadData, saveData } from "./firebase.js";

// ─── CONSTANTS ───────────────────────────────────────────────
const COORD_PIN = "0000";
const CATEGORIES = ["S8","S9","S10","S11","S12","S14","S16","Juvenil","Alevín Femenino","Infantil Femenino","Cadete Femenino","Juvenil Femenino"];
const RPE_CATS   = ["S12","S14","S16","Juvenil","Infantil Femenino","Cadete Femenino","Juvenil Femenino"];
const DURATION   = {"Juvenil":90,"Juvenil Femenino":90,default:75};
const POSITIONS  = ["Portero","Defensa Central","Lateral Derecho","Lateral Izquierdo","Pivote","Mediocentro","Interior","Extremo Derecho","Extremo Izquierdo","Delantero Centro"];
const INJURY_TYPES      = ["Muscular","Ligamentosa","Ósea","Contusión","Sobrecarga","Otra"];
const JUSTIFIED_REASONS = ["Enfermo","Estudios","Viaje","Trabajo","Otros"];
const PLAYER_STATES     = ["Disponible","Lesionado","Sancionado","Baja temporal"];
const COMPETITIONS      = ["Liga","Copa","Torneo","Amistoso","Play-off"];
const MEETING_TYPES = ["Entrenadores","Padres","Jugadores","Cuerpo técnico","Otro"];
const TACTIC_PHASES = ["MCB","MSB","Transiciones","Sistema","ABP"];
const SESSION_TYPES = [
  {id:"tactical", label:"Táctico",  color:"#2563eb"},
  {id:"physical", label:"Físico",   color:"#f97316"},
  {id:"technical",label:"Técnico",  color:"#8b5cf6"},
  {id:"motriz",   label:"Motriz",   color:"#06b6d4"},
  {id:"rondo",    label:"Rondo",    color:"#ec4899"},
  {id:"game",     label:"Juego",    color:"#22c55e"},
];
const RATINGS = [
  {value:"green", label:"Verde",   color:"#22c55e"},
  {value:"yellow",label:"Amarillo",color:"#eab308"},
  {value:"red",   label:"Rojo",    color:"#ef4444"},
];
const ATT_STATES = [
  {value:"present",  label:"Presente",   icon:"✓",color:"#22c55e"},
  {value:"absent",   label:"Ausente",    icon:"✗",color:"#ef4444"},
  {value:"justified",label:"Justificado",icon:"J",color:"#3b82f6"},
  {value:"injured",  label:"Lesionado",  icon:"⚕",color:"#f97316"},
];
const SORT_OPTIONS = [{id:"number",label:"Por dorsal"},{id:"position",label:"Por posición"},{id:"alpha",label:"Alfabético"}];
const POS_ORDER    = ["Portero","Defensa Central","Lateral Derecho","Lateral Izquierdo","Pivote","Mediocentro","Interior","Extremo Derecho","Extremo Izquierdo","Delantero Centro"];
const OBJ_TYPES    = ["Táctico","Técnico","Motriz"];
const STATE_COLORS = {"Disponible":"#22c55e","Lesionado":"#ef4444","Sancionado":"#eab308","Baja temporal":"#6b7280"};
const DEFAULT_TEAMS = [
  {id:"t1",name:"Juvenil A",       category:"Juvenil",         pin:"1111",players:[],sessions:[],matches:[],weekNotes:{},monthNotes:{},coordinatorNotes:[],seasons:[],broadcasts:[],meetings:[],scoutPlayers:[]},
  {id:"t2",name:"Juvenil Femenino",category:"Juvenil Femenino",pin:"2222",players:[],sessions:[],matches:[],weekNotes:{},monthNotes:{},coordinatorNotes:[],seasons:[],broadcasts:[],meetings:[],scoutPlayers:[]},
];

// ─── HELPERS ─────────────────────────────────────────────────
const genId    = () => Math.random().toString(36).slice(2,10);
const today    = () => new Date().toISOString().slice(0,10);
const getWeekKey = date => {
  const d=new Date(date),day=d.getDay()||7;
  d.setDate(d.getDate()+4-day);
  const y=d.getFullYear(),w=Math.ceil(((d-new Date(y,0,1))/86400000+1)/7);
  return `${y}-W${String(w).padStart(2,"0")}`;
};
const getMonthKey  = d => d.slice(0,7);
const fmtDate  = d => { if(!d)return""; const[y,m,day]=d.split("-"); return`${day}/${m}/${y}`; };
const fmtWeek  = wk => {
  const[y,w]=wk.split("-W");
  const d=new Date(y,0,1+(parseInt(w)-1)*7),day=d.getDay()||7;
  d.setDate(d.getDate()+1-day);
  const e=new Date(d); e.setDate(e.getDate()+6);
  return `Sem.${w} · ${fmtDate(d.toISOString().slice(0,10))}–${fmtDate(e.toISOString().slice(0,10))}`;
};
const fmtMonth = mk => {
  const[y,m]=mk.split("-");
  return `${["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"][parseInt(m)-1]} ${y}`;
};
const sortPlayers = (players,order) => {
  const c=[...players];
  if(order==="number")   return c.sort((a,b)=>(parseInt(a.number)||99)-(parseInt(b.number)||99));
  if(order==="position") return c.sort((a,b)=>(POS_ORDER.indexOf(a.position)||99)-(POS_ORDER.indexOf(b.position)||99));
  return c.sort((a,b)=>a.name.localeCompare(b.name));
};
const isComplete = s => Object.keys(s.attendance||{}).length>0;
const unread = (notes,role) => (notes||[]).filter(n=>n.from!==role&&!n.read).length;

// ─── STORAGE (Firebase) ───────────────────────────────────────
const load = async() => { try{ return await loadData(); }catch{ return null; }};
const save = async(k,v) => { try{ await saveData(v); }catch{}};

// ─── EXPORT CSV ───────────────────────────────────────────────
function exportCSV(team) {
  const allS=[...(team.sessions||[]).map(s=>({...s,type:"training"})),...(team.matches||[]).map(s=>({...s,type:"match"}))].sort((a,b)=>a.date.localeCompare(b.date));
  const players=team.players||[];
  const dur=DURATION[team.category]||DURATION.default;
  const headers=["Jugador","Posición","Dorsal","Estado",...allS.map(s=>`${fmtDate(s.date)} ${s.type==="training"?"[E]":"[P]"} ${s.topic||s.rival||""}`),"Total","% Presencia","% Aus.NJ","% Justif.","% Lesión","Convocatorias","Minutos","RPE medio","Carga media"];
  const rows=players.map(p=>{
    let present=0,absent=0,justified=0,injured=0,total=0,rpeSum=0,rpeCount=0,loadSum=0,conv=0,mins=0;
    const cells=allS.map(s=>{
      const a=s.attendance?.[p.id]; if(!a)return"-"; total++;
      if(a.state==="present")present++; else if(a.state==="absent")absent++; else if(a.state==="justified")justified++; else if(a.state==="injured")injured++;
      if(s.type==="training"&&s.rpe?.[p.id]){rpeSum+=s.rpe[p.id];rpeCount++;loadSum+=s.rpe[p.id]*dur;}
      if(s.type==="match"){if(s.convocados?.includes(p.id))conv++;if(s.matchData?.[p.id]?.minutes)mins+=parseInt(s.matchData[p.id].minutes)||0;}
      return ATT_STATES.find(x=>x.value===a.state)?.label||"-";
    });
    return[p.name,p.position||"",p.number||"",p.state||"Disponible",...cells,total,total?`${Math.round(present/total*100)}%`:"0%",total?`${Math.round(absent/total*100)}%`:"0%",total?`${Math.round(justified/total*100)}%`:"0%",total?`${Math.round(injured/total*100)}%`:"0%",conv,mins,rpeCount?(rpeSum/rpeCount).toFixed(1):"-",rpeCount?Math.round(loadSum/rpeCount):"-"];
  });
  const csv=[headers,...rows].map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a"); a.href=url; a.download=`${team.name}_asistencia.csv`; a.click();
  URL.revokeObjectURL(url);
}

// ─── CSS ─────────────────────────────────────────────────────
const css=`
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'DM Sans',sans-serif;background:#0d0f18;color:#e2e4f0;min-height:100vh;}
::-webkit-scrollbar{width:5px;}::-webkit-scrollbar-track{background:#13161f;}::-webkit-scrollbar-thumb{background:#252836;border-radius:3px;}
.app{min-height:100vh;}
.login-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;}
.login-card{background:#13161f;border:1px solid #252836;border-radius:22px;padding:44px 36px;width:100%;max-width:400px;}
.login-logo{display:flex;align-items:center;gap:12px;margin-bottom:32px;}
.logo-mark{width:42px;height:42px;background:#2563eb;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:20px;}
.pin-dots{display:flex;gap:14px;justify-content:center;margin-bottom:28px;}
.pin-dot{width:14px;height:14px;border-radius:50%;border:2px solid #252836;transition:all .2s;}
.pin-dot.on{background:#2563eb;border-color:#2563eb;}
.pin-pad{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;}
.pin-key{background:#1c1f2e;border:1px solid #252836;border-radius:13px;padding:17px;font-size:19px;font-weight:600;color:#e2e4f0;cursor:pointer;transition:all .15s;font-family:'DM Mono',monospace;text-align:center;}
.pin-key:hover{background:#252836;}.pin-key:active{transform:scale(.93);}
.pin-err{color:#ef4444;font-size:13px;text-align:center;margin-top:14px;}
.role-btn{background:#1c1f2e;border:1px solid #252836;border-radius:14px;padding:16px 18px;text-align:left;cursor:pointer;color:#e2e4f0;width:100%;margin-bottom:10px;transition:all .15s;}
.role-btn:hover{border-color:#2563eb;background:#1a2040;}
.header{background:#13161f;border-bottom:1px solid #252836;padding:0 20px;height:56px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;}
.hmark{width:30px;height:30px;background:#2563eb;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:15px;}
.nav{background:#13161f;border-bottom:1px solid #252836;padding:0 14px;display:flex;gap:1px;overflow-x:auto;}
.nav-tab{padding:13px 10px;font-size:12px;font-weight:500;color:#6b7280;cursor:pointer;border-bottom:2px solid transparent;white-space:nowrap;transition:all .15s;position:relative;}
.nav-tab:hover{color:#e2e4f0;}.nav-tab.active{color:#2563eb;border-bottom-color:#2563eb;}
.unread-badge{position:absolute;top:8px;right:2px;background:#ef4444;color:white;border-radius:10px;font-size:9px;font-weight:700;padding:1px 4px;min-width:15px;text-align:center;}
.content{padding:18px;max-width:960px;margin:0 auto;}
.card{background:#13161f;border:1px solid #252836;border-radius:16px;padding:18px;margin-bottom:12px;}
.card-sm{background:#13161f;border:1px solid #252836;border-radius:12px;padding:12px 14px;margin-bottom:8px;}
.card-title{font-size:14px;font-weight:700;margin-bottom:12px;}
.sec-title{font-size:17px;font-weight:700;margin-bottom:16px;}
.frow{display:flex;gap:9px;flex-wrap:wrap;margin-bottom:9px;}
.fg{display:flex;flex-direction:column;gap:5px;flex:1;min-width:110px;}
.flabel{font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px;}
.finput{background:#1c1f2e;border:1px solid #252836;border-radius:9px;padding:8px 11px;color:#e2e4f0;font-size:13px;font-family:'DM Sans',sans-serif;outline:none;width:100%;transition:border-color .15s;}
.finput:focus{border-color:#2563eb;}
.fselect{background:#1c1f2e;border:1px solid #252836;border-radius:9px;padding:8px 11px;color:#e2e4f0;font-size:13px;font-family:'DM Sans',sans-serif;outline:none;width:100%;cursor:pointer;}
.ftextarea{background:#1c1f2e;border:1px solid #252836;border-radius:9px;padding:8px 11px;color:#e2e4f0;font-size:13px;font-family:'DM Sans',sans-serif;outline:none;width:100%;resize:vertical;min-height:68px;}
.ftextarea:focus{border-color:#2563eb;}
.btn{border-radius:9px;padding:8px 14px;font-size:13px;font-weight:600;cursor:pointer;transition:all .15s;border:none;font-family:'DM Sans',sans-serif;display:inline-flex;align-items:center;gap:5px;}
.btn-primary{background:#2563eb;color:white;}.btn-primary:hover{background:#1d4ed8;}
.btn-success{background:#22c55e18;color:#22c55e;border:1px solid #22c55e35;}.btn-success:hover{background:#22c55e28;}
.btn-danger{background:#ef444415;color:#ef4444;border:1px solid #ef444430;}.btn-danger:hover{background:#ef444425;}
.btn-ghost{background:transparent;border:1px solid #252836;color:#9ca3af;}.btn-ghost:hover{border-color:#4b5563;color:#e2e4f0;}
.btn-outline{background:transparent;border:1px solid #252836;color:#9ca3af;}.btn-outline:hover{border-color:#4b5563;color:#e2e4f0;}
.btn-sm{padding:5px 10px;font-size:12px;border-radius:7px;}
.btn-xs{padding:3px 7px;font-size:11px;border-radius:6px;}
.tabs{display:flex;gap:3px;background:#1c1f2e;border-radius:11px;padding:3px;margin-bottom:15px;}
.tab{flex:1;text-align:center;padding:6px 3px;border-radius:8px;font-size:11px;font-weight:500;cursor:pointer;transition:all .15s;color:#6b7280;}
.tab.active{background:#2563eb;color:white;}
.week-block{background:#13161f;border:1px solid #252836;border-radius:13px;margin-bottom:10px;overflow:hidden;}
.week-hdr{display:flex;align-items:center;justify-content:space-between;padding:11px 14px;cursor:pointer;background:#1c1f2e;}
.sess-card{border-bottom:1px solid #1a1d2a;}.sess-card:last-child{border-bottom:none;}
.sess-main{flex:1;cursor:pointer;padding:11px 13px;}
.sess-actions{display:flex;flex-direction:column;border-left:1px solid #1a1d2a;flex-shrink:0;min-width:42px;}
.sess-act-btn{flex:1;background:transparent;border:none;cursor:pointer;font-size:14px;padding:0 13px;display:flex;align-items:center;justify-content:center;}
.sess-act-btn:first-child{border-bottom:1px solid #1a1d2a;}
.att-list{display:flex;flex-direction:column;gap:6px;}
.att-player{background:#1c1f2e;border-radius:11px;padding:11px 13px;}
.att-btns{display:flex;gap:5px;flex-wrap:wrap;}
.att-btn{padding:7px 10px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;border:2px solid transparent;transition:all .15s;min-height:34px;}
.att-extra{padding-top:8px;display:flex;gap:6px;flex-wrap:wrap;align-items:center;}
.rpe-wrap{display:flex;gap:3px;flex-wrap:wrap;}
.rpe-btn{width:29px;height:29px;border-radius:7px;border:2px solid #252836;background:#13161f;font-size:11px;font-weight:700;cursor:pointer;transition:all .15s;color:#9ca3af;font-family:'DM Mono',monospace;}
.rpe-btn:hover{border-color:#4b5563;}.rpe-btn.on{color:white;border-color:transparent;}
.rat-btn{flex:1;padding:6px 5px;border-radius:8px;border:2px solid #252836;background:#13161f;cursor:pointer;text-align:center;transition:all .15s;font-size:11px;font-weight:600;}
.rat-btn:hover{border-color:#4b5563;}
.player-row{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #1a1d2a;cursor:pointer;}
.player-row:last-child{border-bottom:none;}
.player-row:hover .pname{color:#2563eb;}
.pavatar{width:34px;height:34px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;}
.pname{font-size:13px;font-weight:600;transition:color .15s;}
.pmeta{font-size:11px;color:#6b7280;}
.stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:9px;margin-bottom:12px;}
.stat-box{background:#1c1f2e;border-radius:11px;padding:12px;text-align:center;}
.stat-val{font-size:22px;font-weight:700;font-family:'DM Mono',monospace;}
.stat-lbl{font-size:10px;color:#6b7280;margin-top:3px;}
.pbar{background:#252836;border-radius:100px;height:6px;overflow:hidden;margin-top:5px;}
.pfill{height:100%;border-radius:100px;transition:width .5s;}
.stat-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #1a1d2a;font-size:13px;}
.stat-row:last-child{border-bottom:none;}
.note-bubble{background:#1c1f2e;border-radius:10px;padding:10px 13px;margin-bottom:7px;}
.note-bubble.coord{background:#2563eb10;border:1px solid #2563eb25;}
.note-meta{font-size:11px;color:#6b7280;margin-bottom:4px;}
.note-text{font-size:13px;line-height:1.5;}
.overlay{position:fixed;inset:0;background:#00000090;display:flex;align-items:center;justify-content:center;z-index:300;padding:20px;}
.confirm-box{background:#13161f;border:1px solid #252836;border-radius:16px;padding:24px;max-width:330px;width:100%;}
.divider{border:none;border-top:1px solid #252836;margin:12px 0;}
.empty{text-align:center;padding:30px 16px;color:#4b5563;}
.empty-icon{font-size:28px;margin-bottom:10px;}
.alert{padding:10px 13px;border-radius:9px;font-size:13px;margin-bottom:10px;}
.alert-warn{background:#ef444412;border:1px solid #ef444428;color:#fca5a5;}
.alert-info{background:#2563eb12;border:1px solid #2563eb28;color:#93c5fd;}
.alert-orange{background:#f9731612;border:1px solid #f9731628;color:#fb923c;}
.back-btn{display:inline-flex;align-items:center;gap:6px;color:#6b7280;font-size:13px;cursor:pointer;margin-bottom:16px;transition:color .15s;}
.back-btn:hover{color:#e2e4f0;}
.conv-player{display:flex;align-items:center;gap:9px;padding:8px 10px;background:#13161f;border-radius:8px;cursor:pointer;border:1px solid transparent;transition:all .15s;margin-bottom:5px;}
.conv-player.on{border-color:#22c55e;background:#22c55e06;}
.conv-check{width:18px;height:18px;border-radius:5px;border:2px solid #252836;display:flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0;transition:all .15s;}
.conv-check.on{background:#22c55e;border-color:#22c55e;}
.inj-tag{background:#f9731612;border:1px solid #f9731628;color:#fb923c;border-radius:6px;padding:2px 6px;font-size:10px;font-weight:600;}
.type-pill{display:inline-flex;padding:2px 7px;border-radius:20px;font-size:10px;font-weight:600;cursor:pointer;border:2px solid transparent;transition:all .15s;margin:2px;}
.complete-dot{width:7px;height:7px;border-radius:50%;background:#22c55e;flex-shrink:0;}
.incomplete-dot{width:7px;height:7px;border-radius:50%;background:#f97316;flex-shrink:0;}
.broadcast-bubble{background:#2563eb10;border:1px solid #2563eb25;border-radius:10px;padding:10px 13px;margin-bottom:7px;}
.cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:3px;margin-bottom:14px;}
.cal-day-hdr{text-align:center;font-size:10px;color:#6b7280;font-weight:600;padding:4px 0;}
.cal-day{min-height:38px;border-radius:7px;padding:3px;background:#1c1f2e;border:1px solid transparent;}
.cal-day.today{border-color:#2563eb;}
.cal-day-num{font-size:10px;color:#9ca3af;margin-bottom:2px;}
.cal-dot{width:5px;height:5px;border-radius:50%;display:inline-block;margin:1px;}
.chart-wrap{display:flex;align-items:flex-end;gap:5px;height:90px;margin-top:8px;}
.chart-bar{flex:1;border-radius:4px 4px 0 0;min-width:18px;transition:height .4s;position:relative;min-height:4px;}
.chart-lbl{font-size:8px;color:#6b7280;text-align:center;margin-top:3px;}
.chart-val{position:absolute;top:-16px;left:50%;transform:translateX(-50%);font-size:8px;color:#9ca3af;white-space:nowrap;}
@media(max-width:600px){.content{padding:12px;}.header{padding:0 12px;}.stat-grid{grid-template-columns:repeat(2,1fr);}.tabs .tab{font-size:10px;padding:5px 2px;}}
`;

// ─── MAIN APP ─────────────────────────────────────────────────
export default function App() {
  const [teams,   setTeams]  = useState(null);
  const [view,    setView]   = useState("login");
  const [teamId,  setTeamId] = useState(null);
  const [pin,     setPin]    = useState("");
  const [pinErr,  setPinErr] = useState("");
  const [step,    setStep]   = useState("role");
  const [role,    setRole]   = useState(null);
  const [tab,     setTab]    = useState("sessions");
  const [loading, setLoading]= useState(true);

  useEffect(()=>{
    load().then(d=>{ setTeams(d||DEFAULT_TEAMS); setLoading(false); });
  },[]);

  const persist   = useCallback(u=>{ setTeams([...u]); save("canet_v4",u); },[]);
  const updateTeam= useCallback((id,fn)=>{ setTeams(prev=>{ const next=prev.map(t=>t.id===id?{...fn(t)}:t); save("canet_v4",next); return [...next]; }); },[]);

  const pressPin = digit => {
    if(pin.length>=4) return;
    const p=pin+digit; setPin(p);
    if(p.length===4) setTimeout(()=>checkPin(p),120);
  };
  const checkPin = p => {
    if(role==="coordinator"){
      if(p===COORD_PIN){setView("coordinator");setPin("");setPinErr("");}
      else{setPinErr("PIN incorrecto");setPin("");}
    } else {
      const t=teams.find(x=>x.pin===p);
      if(t){setTeamId(t.id);setView("team");setTab("sessions");setPin("");setPinErr("");setStep("role");}
      else{setPinErr("PIN incorrecto");setPin("");}
    }
  };

  if(loading) return <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#0d0f18",color:"#6b7280"}}>Cargando...</div>;
  const team=teams?.find(t=>t.id===teamId);
  return <><style>{css}</style><div className="app">
    {view==="login"       && <Login step={step} setStep={setStep} role={role} setRole={setRole} pin={pin} press={pressPin} del={()=>{setPin(p=>p.slice(0,-1));setPinErr("");}} err={pinErr}/>}
    {view==="team"        && team && <TeamView team={team} teams={teams} tab={tab} setTab={setTab} updateTeam={updateTeam} logout={()=>{setView("login");setStep("role");}}/>}
    {view==="coordinator" && <CoordView teams={teams} persist={persist} updateTeam={updateTeam} logout={()=>{setView("login");setStep("role");}}/>}
  </div></>;
}

function Confirm({msg,onOk,onCancel}){
  return <div className="overlay"><div className="confirm-box">
    <div style={{fontSize:15,fontWeight:700,marginBottom:10}}>¿Estás seguro?</div>
    <div style={{fontSize:13,color:"#9ca3af",marginBottom:20,lineHeight:1.5}}>{msg}</div>
    <div style={{display:"flex",gap:8}}>
      <button className="btn btn-danger" style={{flex:1}} onClick={onOk}>Eliminar</button>
      <button className="btn btn-outline" style={{flex:1}} onClick={onCancel}>Cancelar</button>
    </div>
  </div></div>;
}

function Login({step,setStep,role,setRole,pin,press,del,err}){
  return <div className="login-wrap"><div className="login-card">
    <div className="login-logo"><div className="logo-mark">⚽</div>
      <div><div style={{fontSize:17,fontWeight:700}}>Canet F.C.</div><div style={{fontSize:11,color:"#6b7280"}}>Gestión de Asistencia</div></div>
    </div>
    {step==="role"&&<>
      <div style={{fontSize:21,fontWeight:700,marginBottom:6}}>Bienvenido</div>
      <div style={{fontSize:13,color:"#6b7280",marginBottom:22}}>¿Cómo accedes?</div>
      <button className="role-btn" onClick={()=>{setRole("trainer");setStep("pin");}}>
        <div style={{fontWeight:600,fontSize:14}}>🧑‍🏫 Entrenador</div><div style={{fontSize:12,color:"#6b7280",marginTop:3}}>Accede a tu equipo</div>
      </button>
      <button className="role-btn" onClick={()=>{setRole("coordinator");setStep("pin");}}>
        <div style={{fontWeight:600,fontSize:14}}>📊 Coordinador</div><div style={{fontSize:12,color:"#6b7280",marginTop:3}}>Panel global del club</div>
      </button>
    </>}
    {step==="pin"&&<>
      <div style={{fontSize:21,fontWeight:700,marginBottom:6}}>{role==="coordinator"?"PIN Coordinador":"PIN Entrenador"}</div>
      <div style={{fontSize:13,color:"#6b7280",marginBottom:22}}>Introduce tu PIN de 4 dígitos</div>
      <div className="pin-dots">{[0,1,2,3].map(i=><div key={i} className={`pin-dot${pin.length>i?" on":""}`}/>)}</div>
      <div className="pin-pad">
        {[1,2,3,4,5,6,7,8,9].map(d=><button key={d} className="pin-key" onClick={()=>press(String(d))}>{d}</button>)}
        <button className="pin-key" style={{fontSize:12,color:"#6b7280"}} onClick={()=>setStep("role")}>←</button>
        <button className="pin-key" onClick={()=>press("0")}>0</button>
        <button className="pin-key" onClick={del}>⌫</button>
      </div>
      {err&&<div className="pin-err">{err}</div>}
    </>}
  </div></div>;
}

function TypePicker({value=[],onChange}){
  const toggle=id=>onChange(value.includes(id)?value.filter(x=>x!==id):[...value,id]);
  return <div style={{display:"flex",flexWrap:"wrap",gap:2}}>
    {SESSION_TYPES.map(t=>{const on=value.includes(t.id);return<span key={t.id} className="type-pill"
      style={{background:on?t.color+"22":"#13161f",borderColor:on?t.color:"#252836",color:on?t.color:"#6b7280"}}
      onClick={()=>toggle(t.id)}>{t.label}</span>;})}
  </div>;
}

function TeamView({team,teams,tab,setTab,updateTeam,logout}){
  const hasRPE=RPE_CATS.includes(team.category);
  const [calOpenId,setCalOpenId]=useState(null);
  const noteCount=unread(team.coordinatorNotes,"trainer");
  const bcCount=(team.broadcasts||[]).filter(b=>!b.readBy?.includes("trainer_"+team.id)).length;
  const meetingCount=(team.meetings||[]).filter(m=>!m.readBy?.includes("trainer_"+team.id)&&new Date(m.date)>=new Date(today())).length;
  const totalUnread=noteCount+bcCount+meetingCount;
  const tabs=[
    {id:"sessions",label:"📋 Sesiones"},
    {id:"calendar",label:"📅 Cal."},
    {id:"players", label:"👥 Jugadores"},
    {id:"stats",   label:"📊 Stats"},
    {id:"notes",   label:"💬 Notas",badge:totalUnread},
  ];
  const handleCalOpen=(id)=>{ setCalOpenId(id); setTab("sessions"); };
  return <div>
    <div className="header">
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div className="hmark">⚽</div>
        <div><div style={{fontSize:14,fontWeight:700}}>{team.name}</div><div style={{fontSize:11,color:"#6b7280"}}>{team.category}</div></div>
      </div>
      <button className="btn btn-ghost btn-sm" onClick={logout}>Salir</button>
    </div>
    <div className="nav">{tabs.map(t=><div key={t.id} className={`nav-tab${tab===t.id?" active":""}`} onClick={()=>setTab(t.id)}>{t.label}{t.badge>0&&<span className="unread-badge">{t.badge}</span>}</div>)}</div>
    <div className="content">
      {tab==="sessions" && <SessionsTab team={team} updateTeam={updateTeam} hasRPE={hasRPE} initialOpenId={calOpenId} onConsumeOpenId={()=>setCalOpenId(null)}/>}
      {tab==="calendar" && <CalendarTab team={team} updateTeam={updateTeam} hasRPE={hasRPE} onOpenSession={handleCalOpen}/>}
      {tab==="players"  && <PlayersTab  team={team} updateTeam={updateTeam}/>}
      {tab==="stats"    && <StatsTab    team={team}/>}
      {tab==="notes"    && <NotesTab    team={team} updateTeam={updateTeam} isCoord={false}/>}
    </div>
  </div>;
}

function CalendarTab({team,updateTeam,hasRPE,onOpenSession}){
  const [calView,setCalView]=useState("month");
  const [curDate,setCurDate]=useState(new Date());
  const [selDate,setSelDate]=useState(null);
  const [showCreate,setShowCreate]=useState(false);
  const [fType,setFType]=useState("training");
  const [fTopic,setFTopic]=useState("");
  const [fSTypes,setFSTypes]=useState([]);

  const allS=[
    ...(team.sessions||[]).map(s=>({...s,type:"training"})),
    ...(team.matches||[]).map(s=>({...s,type:"match"})),
    ...(team.meetings||[]).map(m=>({...m,type:"meeting"})),
  ];
  const byDate={};
  allS.forEach(s=>{ if(!byDate[s.date])byDate[s.date]=[]; byDate[s.date].push(s); });
  const todayStr=today();
  const y=curDate.getFullYear(),m=curDate.getMonth();

  const createFromCal=()=>{
    if(!selDate)return;
    const id=genId(),base={id,date:selDate,topic:fTopic,sessionTypes:fSTypes,attendance:{},notes:""};
    if(fType==="training") updateTeam(team.id,t=>({...t,sessions:[...(t.sessions||[]),{...base,rpe:{},ratings:{}}]}));
    else updateTeam(team.id,t=>({...t,matches:[...(t.matches||[]),{...base,rival:fTopic,goalsFor:"",goalsAgainst:"",competition:"Liga",matchday:"",homeAway:"Local",ratings:{},convocados:[],matchData:{}}]}));
    setShowCreate(false);setFTopic("");setFSTypes([]);
    if(onOpenSession) onOpenSession(id);
  };

  const DayPanel=()=>{
    if(!selDate)return null;
    const daySess=byDate[selDate]||[];
    const [wd,d,mo]=[ ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"][new Date(selDate+"T12:00").getDay()], selDate.slice(8), fmtMonth(selDate.slice(0,7)) ];
    return <div className="card" style={{marginBottom:14,borderColor:"#2563eb40"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
        <div><span style={{fontWeight:700,fontSize:15}}>{wd} {d}</span><span style={{fontSize:12,color:"#6b7280",marginLeft:8}}>{mo}</span></div>
        <button className="btn btn-ghost btn-xs" onClick={()=>{setSelDate(null);setShowCreate(false);}}>✕</button>
      </div>
      {daySess.length===0&&<div style={{fontSize:12,color:"#4b5563",marginBottom:10}}>Sin sesiones este día</div>}
      {daySess.map(s=>{
        if(s.type==="meeting") return <div key={s.id} style={{background:"#8b5cf618",border:"1px solid #8b5cf630",borderRadius:8,padding:"8px 11px",marginBottom:6}}>
          <div style={{fontSize:13,fontWeight:600,color:"#a78bfa"}}>📅 {s.title||"Reunión"}</div>
          <div style={{fontSize:11,color:"#6b7280",marginTop:2}}>{s.time||""} · {s.type_label||s.type||""}{s.description?` · ${s.description}`:""}</div>
        </div>;
        return <div key={s.id} style={{background:s.type==="training"?"#2563eb12":"#22c55e12",border:`1px solid ${s.type==="training"?"#2563eb30":"#22c55e30"}`,borderRadius:8,padding:"8px 11px",marginBottom:6,cursor:"pointer"}}
          onClick={()=>onOpenSession&&onOpenSession(s.id)}>
          <div style={{fontSize:13,fontWeight:600,color:s.type==="training"?"#2563eb":"#22c55e"}}>{s.type==="training"?"🏃":"⚽"} {s.topic||s.rival||"Sin título"}</div>
          <div style={{fontSize:11,color:"#6b7280",marginTop:2,display:"flex",gap:8}}>
            <span>{s.competition||""}</span>
            <span>{Object.keys(s.attendance||{}).length} reg.</span>
            <span style={{color:isComplete(s)?"#22c55e":"#f97316"}}>{isComplete(s)?"✓ Completo":"⏳ Pendiente"}</span>
          </div>
        </div>;
      })}
      {!showCreate&&<button className="btn btn-primary btn-sm" style={{width:"100%",justifyContent:"center",marginTop:4}} onClick={()=>setShowCreate(true)}>+ Crear sesión aquí</button>}
      {showCreate&&<div style={{background:"#1c1f2e",borderRadius:9,padding:11,marginTop:6}}>
        <div className="tabs" style={{marginBottom:9}}>
          <div className={`tab${fType==="training"?" active":""}`} onClick={()=>setFType("training")}>🏃 Entreno</div>
          <div className={`tab${fType==="match"?" active":""}`}    onClick={()=>setFType("match")}>⚽ Partido</div>
        </div>
        <div className="fg" style={{marginBottom:8}}><label className="flabel">{fType==="training"?"Contenido":"Rival"}</label>
          <input className="finput" style={{fontSize:12}} value={fTopic} onChange={e=>setFTopic(e.target.value)} placeholder={fType==="training"?"Cuadrado Interior...":"Rival"}/>
        </div>
        {fType==="training"&&<div className="fg" style={{marginBottom:8}}><label className="flabel">Tipo</label><TypePicker value={fSTypes} onChange={setFSTypes}/></div>}
        <div style={{display:"flex",gap:7}}>
          <button className="btn btn-primary btn-sm" onClick={createFromCal}>Crear</button>
          <button className="btn btn-outline btn-sm" onClick={()=>{setShowCreate(false);setFTopic("");setFSTypes([]);}}>Cancelar</button>
        </div>
      </div>}
    </div>;
  };

  if(calView==="week"){
    const ws=new Date(curDate),wd=ws.getDay()||7; ws.setDate(ws.getDate()-wd+1);
    const days=Array.from({length:7},(_,i)=>{ const d=new Date(ws); d.setDate(d.getDate()+i); return d; });
    return <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:8}}>
        <div className="tabs" style={{margin:0,width:"auto"}}>
          <div className={`tab${calView==="month"?" active":""}`} style={{padding:"5px 12px"}} onClick={()=>setCalView("month")}>Mes</div>
          <div className={`tab${calView==="week"?" active":""}`}  style={{padding:"5px 12px"}} onClick={()=>setCalView("week")}>Semana</div>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <button className="btn btn-ghost btn-sm" onClick={()=>setCurDate(d=>{const n=new Date(d);n.setDate(n.getDate()-7);return n;})}>←</button>
          <span style={{fontSize:12,fontWeight:600}}>{fmtDate(days[0].toISOString().slice(0,10))}–{fmtDate(days[6].toISOString().slice(0,10))}</span>
          <button className="btn btn-ghost btn-sm" onClick={()=>setCurDate(d=>{const n=new Date(d);n.setDate(n.getDate()+7);return n;})}>→</button>
        </div>
      </div>
      {selDate&&<DayPanel/>}
      {days.map(d=>{
        const ds=d.toISOString().slice(0,10),daySess=byDate[ds]||[],isToday=ds===todayStr,isSel=ds===selDate;
        return <div key={ds} className="card-sm" style={{borderColor:isSel?"#2563eb":isToday?"#2563eb40":"#252836",marginBottom:7,cursor:"pointer"}} onClick={()=>{setSelDate(ds===selDate?null:ds);setShowCreate(false);}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:daySess.length?7:0}}>
            <div style={{fontWeight:600,fontSize:13,color:isSel||isToday?"#2563eb":"#e2e4f0"}}>{["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"][d.getDay()===0?6:d.getDay()-1]} {d.getDate()}</div>
            {daySess.length===0&&<span style={{fontSize:11,color:"#4b5563"}}>Toca para programar</span>}
            {daySess.length>0&&<span style={{fontSize:11,color:"#6b7280"}}>{daySess.length} sesión{daySess.length>1?"es":""}</span>}
          </div>
          {daySess.map(s=>{
            if(s.type==="meeting") return <div key={s.id} style={{background:"#8b5cf618",border:"1px solid #8b5cf630",borderRadius:7,padding:"5px 9px",marginBottom:3}}>
              <div style={{fontSize:12,fontWeight:600,color:"#a78bfa"}}>📅 {s.title||"Reunión"} {s.time?`· ${s.time}`:""}</div>
            </div>;
            return <div key={s.id} style={{background:s.type==="training"?"#2563eb12":"#22c55e12",border:`1px solid ${s.type==="training"?"#2563eb25":"#22c55e25"}`,borderRadius:7,padding:"5px 9px",marginBottom:3}}>
              <div style={{fontSize:12,fontWeight:600,color:s.type==="training"?"#2563eb":"#22c55e"}}>{s.type==="training"?"🏃":"⚽"} {s.topic||s.rival||""}</div>
              <div style={{fontSize:11,color:isComplete(s)?"#22c55e40":"#f97316",marginTop:1}}>{isComplete(s)?"✓":"⏳"} {Object.keys(s.attendance||{}).length} reg.</div>
            </div>;
          })}
        </div>;
      })}
    </div>;
  }

  const firstDay=new Date(y,m,1).getDay()||7, daysInMonth=new Date(y,m+1,0).getDate();
  const cells=[];
  for(let i=1;i<firstDay;i++) cells.push(null);
  for(let i=1;i<=daysInMonth;i++) cells.push(i);

  return <div>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:8}}>
      <div className="tabs" style={{margin:0,width:"auto"}}>
        <div className={`tab${calView==="month"?" active":""}`} style={{padding:"5px 12px"}} onClick={()=>setCalView("month")}>Mes</div>
        <div className={`tab${calView==="week"?" active":""}`}  style={{padding:"5px 12px"}} onClick={()=>setCalView("week")}>Semana</div>
      </div>
      <div style={{display:"flex",gap:6,alignItems:"center"}}>
        <button className="btn btn-ghost btn-sm" onClick={()=>setCurDate(d=>{const n=new Date(d);n.setMonth(n.getMonth()-1);return n;})}>←</button>
        <span style={{fontSize:13,fontWeight:600}}>{fmtMonth(`${y}-${String(m+1).padStart(2,"0")}`)}</span>
        <button className="btn btn-ghost btn-sm" onClick={()=>setCurDate(d=>{const n=new Date(d);n.setMonth(n.getMonth()+1);return n;})}>→</button>
      </div>
    </div>
    {selDate&&<DayPanel/>}
    <div className="cal-grid">
      {["L","M","X","J","V","S","D"].map(d=><div key={d} className="cal-day-hdr">{d}</div>)}
      {cells.map((day,i)=>{
        if(!day) return <div key={`e${i}`}/>;
        const ds=`${y}-${String(m+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
        const daySess=byDate[ds]||[],isToday=ds===todayStr,isSel=ds===selDate;
        return <div key={ds} className={`cal-day${isToday?" today":""}`}
          style={{cursor:"pointer",borderColor:isSel?"#2563eb":isToday?"#2563eb":"transparent",background:isSel?"#2563eb18":"#1c1f2e"}}
          onClick={()=>{setSelDate(ds===selDate?null:ds);setShowCreate(false);}}>
          <div className="cal-day-num" style={{color:isSel||isToday?"#2563eb":"#9ca3af",fontWeight:isSel?"700":"400"}}>{day}</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:1}}>
            {daySess.map(s=><span key={s.id} className="cal-dot" style={{background:s.type==="training"?"#2563eb":s.type==="meeting"?"#8b5cf6":"#22c55e"}}/>)}
          </div>
        </div>;
      })}
    </div>
    <div style={{display:"flex",gap:10,fontSize:11,color:"#6b7280",marginTop:6,flexWrap:"wrap"}}>
      <span><span className="cal-dot" style={{background:"#2563eb",display:"inline-block"}}/> Entreno</span>
      <span><span className="cal-dot" style={{background:"#22c55e",display:"inline-block"}}/> Partido</span>
      <span><span className="cal-dot" style={{background:"#8b5cf6",display:"inline-block"}}/> Reunión</span>
      <span style={{color:"#4b5563"}}>Toca cualquier día</span>
    </div>
  </div>;
}

function SessionsTab({team,updateTeam,hasRPE,initialOpenId,onConsumeOpenId}){
  const [showForm,setShowForm]=useState(false);
  const [activeId,setActiveId]=useState(null);
  const [fType,setFType]=useState("training");
  const [fDate,setFDate]=useState(today());
  const [fTopic,setFTopic]=useState("");
  const [fSTypes,setFSTypes]=useState([]);

  // Open session from calendar
  useEffect(()=>{ if(initialOpenId){setActiveId(initialOpenId);onConsumeOpenId&&onConsumeOpenId();} },[initialOpenId]);

  const allSessions=[...(team.sessions||[]).map(s=>({...s,type:"training"})),...(team.matches||[]).map(s=>({...s,type:"match"}))];
  const current=allSessions.find(s=>s.id===activeId);

  const create=()=>{
    if(!fDate) return;
    const id=genId(),base={id,date:fDate,topic:fTopic,sessionTypes:fSTypes,attendance:{},notes:""};
    if(fType==="training") updateTeam(team.id,t=>({...t,sessions:[...(t.sessions||[]),{...base,type:"training",rpe:{},ratings:{}}]}));
    else updateTeam(team.id,t=>({...t,matches:[...(t.matches||[]),{...base,type:"match",rival:fTopic,result:"",goalsFor:"",goalsAgainst:"",competition:"Liga",matchday:"",homeAway:"Local",ratings:{},convocados:[],matchData:{}}]}));
    setActiveId(id); setShowForm(false); setFTopic(""); setFSTypes([]);
  };

  const duplicate=s=>{
    const id=genId(),dup={...s,id,date:today(),attendance:{},notes:"",ratings:{}};
    if(s.type==="training"){const d2={...dup,rpe:{}};updateTeam(team.id,t=>({...t,sessions:[...(t.sessions||[]),d2]}));}
    else{const d2={...dup,convocados:[],result:"",goalsFor:"",goalsAgainst:"",matchData:{}};updateTeam(team.id,t=>({...t,matches:[...(t.matches||[]),d2]}));}
    setActiveId(id);
  };

  if(activeId&&current){
    return current.type==="training"
      ? <TrainingDetail session={current} team={team} updateTeam={updateTeam} hasRPE={hasRPE} onBack={()=>setActiveId(null)} onDuplicate={()=>duplicate(current)}/>
      : <MatchDetail    session={current} team={team} updateTeam={updateTeam}                 onBack={()=>setActiveId(null)} onDuplicate={()=>duplicate(current)}/>;
  }

  const byWeek={};
  allSessions.sort((a,b)=>b.date.localeCompare(a.date)).forEach(s=>{
    const wk=getWeekKey(s.date); if(!byWeek[wk])byWeek[wk]=[]; byWeek[wk].push(s);
  });

  return <div>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
      <div className="sec-title" style={{marginBottom:0}}>Sesiones</div>
      <button className="btn btn-primary btn-sm" onClick={()=>setShowForm(!showForm)}>+ Nueva</button>
    </div>
    {showForm&&<div className="card">
      <div className="card-title">Nueva sesión</div>
      <div className="tabs">
        <div className={`tab${fType==="training"?" active":""}`} onClick={()=>setFType("training")}>🏃 Entrenamiento</div>
        <div className={`tab${fType==="match"?" active":""}`}    onClick={()=>setFType("match")}>⚽ Partido</div>
      </div>
      <div className="frow">
        <div className="fg"><label className="flabel">Fecha</label><input type="date" className="finput" value={fDate} onChange={e=>setFDate(e.target.value)}/></div>
        <div className="fg"><label className="flabel">{fType==="training"?"Contenido":"Rival"}</label><input className="finput" value={fTopic} onChange={e=>setFTopic(e.target.value)} placeholder={fType==="training"?"Cuadrado Interior...":"Rival"}/></div>
      </div>
      {fType==="training"&&<div className="fg" style={{marginBottom:12}}>
        <label className="flabel">Tipo de sesión</label><TypePicker value={fSTypes} onChange={setFSTypes}/>
      </div>}
      <div style={{display:"flex",gap:8}}>
        <button className="btn btn-primary btn-sm" onClick={create}>Crear</button>
        <button className="btn btn-outline btn-sm" onClick={()=>setShowForm(false)}>Cancelar</button>
      </div>
    </div>}
    {Object.keys(byWeek).length===0&&<div className="empty"><div className="empty-icon">📋</div>Sin sesiones todavía</div>}
    {Object.entries(byWeek).sort((a,b)=>b[0].localeCompare(a[0])).map(([wk,list])=>
      <WeekBlock key={wk} weekKey={wk} sessions={list} team={team} updateTeam={updateTeam} onSelect={setActiveId} onDuplicate={duplicate}/>
    )}
  </div>;
}

function WeekBlock({weekKey,sessions,team,updateTeam,onSelect,onDuplicate}){
  const [open,setOpen]=useState(true);
  const [toDelete,setToDelete]=useState(null);
  const incomplete=sessions.filter(s=>!isComplete(s)).length;

  const doDelete=()=>{
    if(!toDelete)return;
    if(toDelete.type==="training") updateTeam(team.id,t=>({...t,sessions:(t.sessions||[]).filter(x=>x.id!==toDelete.id)}));
    else updateTeam(team.id,t=>({...t,matches:(t.matches||[]).filter(x=>x.id!==toDelete.id)}));
    setToDelete(null);
  };

  return <div className="week-block">
    {toDelete&&<Confirm msg={`¿Eliminar ${toDelete.type==="training"?"el entrenamiento":"el partido"} del ${fmtDate(toDelete.date)}?`} onOk={doDelete} onCancel={()=>setToDelete(null)}/>}
    <div className="week-hdr" onClick={()=>setOpen(!open)}>
      <div style={{fontSize:12,fontWeight:600}}>{fmtWeek(weekKey)}</div>
      <div style={{display:"flex",alignItems:"center",gap:7}}>
        {incomplete>0&&<span style={{fontSize:10,color:"#f97316",fontWeight:600}}>{incomplete} pend.</span>}
        <span style={{color:"#6b7280",fontSize:11}}>{open?"▲":"▼"}</span>
      </div>
    </div>
    {open&&<div style={{padding:"5px 10px 12px"}}>
      {sessions.map(s=>{
        const pills=(s.sessionTypes||[]).map(id=>SESSION_TYPES.find(t=>t.id===id)).filter(Boolean);
        return <div key={s.id} className="sess-card">
          <div style={{display:"flex",alignItems:"stretch"}}>
            <div className="sess-main" onClick={()=>onSelect(s.id)}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                <div className={isComplete(s)?"complete-dot":"incomplete-dot"}/>
                <span style={{fontWeight:600,fontSize:13}}>{fmtDate(s.date)} · {s.topic||s.rival||"Sin título"}</span>
              </div>
              <div style={{display:"flex",gap:3,flexWrap:"wrap",alignItems:"center"}}>
                <span style={{background:s.type==="training"?"#2563eb18":"#22c55e18",color:s.type==="training"?"#2563eb":"#22c55e",fontSize:10,fontWeight:700,padding:"2px 6px",borderRadius:20}}>{s.type==="training"?"Entreno":"Partido"}</span>
                {s.competition&&<span style={{background:"#8b5cf618",color:"#a78bfa",fontSize:10,fontWeight:600,padding:"2px 5px",borderRadius:20}}>{s.competition}</span>}
                {pills.map(tp=><span key={tp.id} style={{background:tp.color+"15",color:tp.color,fontSize:10,fontWeight:600,padding:"2px 5px",borderRadius:20}}>{tp.label}</span>)}
                <span style={{fontSize:11,color:"#6b7280"}}>{Object.keys(s.attendance||{}).length} reg.{s.goalsFor!==""&&s.goalsAgainst!==""?` · ${s.goalsFor}-${s.goalsAgainst}`:""}</span>
              </div>
            </div>
            <div className="sess-actions">
              <button className="sess-act-btn" style={{color:"#6b7280"}} onClick={()=>onDuplicate(s)}>⎘</button>
              <button className="sess-act-btn" style={{color:"#ef4444"}} onClick={()=>setToDelete(s)}>🗑</button>
            </div>
          </div>
        </div>;
      })}
      <div style={{marginTop:9}}>
        <label className="flabel" style={{display:"block",marginBottom:4}}>💬 Observaciones de la semana</label>
        <textarea className="ftextarea" style={{minHeight:48}} value={team.weekNotes?.[weekKey]||""} placeholder="Aspectos trabajados..."
          onChange={e=>updateTeam(team.id,t=>({...t,weekNotes:{...(t.weekNotes||{}),[weekKey]:e.target.value}}))}/>
      </div>
    </div>}
  </div>;
}

function TrainingDetail({session,team,updateTeam,hasRPE,onBack,onDuplicate}){
  const [sort,setSort]=useState(team.defaultSort||"number");
  const dur=DURATION[team.category]||DURATION.default;
  const players=sortPlayers(team.players||[],sort);
  const att=session.attendance||{},rpe=session.rpe||{},ratings=session.ratings||{};
  const setAtt  =(pid,val,extra={})=>updateTeam(team.id,t=>({...t,sessions:t.sessions.map(s=>s.id===session.id?{...s,attendance:{...s.attendance,[pid]:{state:val,...extra}}}:s)}));
  const setRPE  =(pid,val)=>updateTeam(team.id,t=>({...t,sessions:t.sessions.map(s=>s.id===session.id?{...s,rpe:{...s.rpe,[pid]:val}}:s)}));
  const setRat  =(pid,val)=>updateTeam(team.id,t=>({...t,sessions:t.sessions.map(s=>s.id===session.id?{...s,ratings:{...s.ratings,[pid]:val}}:s)}));
  const setNotes=(v)=>updateTeam(team.id,t=>({...t,sessions:t.sessions.map(s=>s.id===session.id?{...s,notes:v}:s)}));
  const setTypes=(v)=>updateTeam(team.id,t=>({...t,sessions:t.sessions.map(s=>s.id===session.id?{...s,sessionTypes:v}:s)}));
  const allPresent=()=>players.forEach(p=>{if(!att[p.id]||att[p.id].state!=="present")setAtt(p.id,"present");});

  return <div>
    <div className="back-btn" onClick={onBack}>← Volver</div>
    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap",gap:8}}>
      <div><div style={{fontSize:17,fontWeight:700}}>🏃 {fmtDate(session.date)}</div><div style={{fontSize:12,color:"#6b7280",marginTop:2}}>{session.topic||"Entrenamiento"} · {dur} min</div></div>
      <button className="btn btn-ghost btn-sm" onClick={onDuplicate}>⎘ Duplicar</button>
    </div>
    <div className="card" style={{padding:11,marginBottom:11}}>
      <div className="frow" style={{marginBottom:0}}>
        <div className="fg"><label className="flabel">Tipo de sesión</label><TypePicker value={session.sessionTypes||[]} onChange={setTypes}/></div>
        <div className="fg" style={{maxWidth:135}}><label className="flabel">Ordenar</label>
          <select className="fselect" style={{fontSize:12}} value={sort} onChange={e=>setSort(e.target.value)}>
            {SORT_OPTIONS.map(o=><option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </div>
      </div>
    </div>
    {players.length===0&&<div className="alert alert-info">Añade jugadores en la pestaña Jugadores.</div>}
    {players.length>0&&<button className="btn btn-success" style={{width:"100%",justifyContent:"center",padding:11,marginBottom:9,fontSize:14}} onClick={allPresent}>✓ Todos presentes</button>}
    <div className="att-list">
      {players.map(p=>{
        const a=att[p.id]||{},r=rpe[p.id],rat=ratings[p.id];
        return <div key={p.id} className="att-player">
          <div style={{display:"flex",alignItems:"center",gap:9,flexWrap:"wrap"}}>
            <div style={{flex:1,minWidth:110,fontWeight:600,fontSize:13}}>
              {p.number&&<span style={{color:"#6b7280",fontSize:12,marginRight:4}}>#{p.number}</span>}{p.name}
              {a.state==="injured"&&<span className="inj-tag" style={{marginLeft:6}}>⚕ {a.injuryType||"Lesión"}</span>}
            </div>
            <div className="att-btns">
              {ATT_STATES.map(st=>{const on=a.state===st.value;return<button key={st.value} className="att-btn"
                style={{background:on?st.color+"22":"#13161f",borderColor:on?st.color:"#252836",color:on?st.color:"#6b7280"}}
                onClick={()=>setAtt(p.id,st.value)}>{st.icon} {st.label}</button>;})}
            </div>
          </div>
          {a.state==="justified"&&<div className="att-extra">
            <select className="fselect" style={{maxWidth:160,fontSize:12}} value={a.reason||""} onChange={e=>setAtt(p.id,"justified",{reason:e.target.value})}>
              <option value="">Motivo...</option>{JUSTIFIED_REASONS.map(r=><option key={r} value={r}>{r}</option>)}
            </select>
          </div>}
          {a.state==="injured"&&<div className="att-extra">
            <select className="fselect" style={{maxWidth:140,fontSize:12}} value={a.injuryType||""} onChange={e=>setAtt(p.id,"injured",{...a,injuryType:e.target.value})}>
              <option value="">Tipo...</option>{INJURY_TYPES.map(i=><option key={i} value={i}>{i}</option>)}
            </select>
            <input type="date" className="finput" style={{maxWidth:140,fontSize:12}} value={a.injuryStart||today()} onChange={e=>setAtt(p.id,"injured",{...a,injuryStart:e.target.value})}/>
            <input type="date" className="finput" style={{maxWidth:140,fontSize:12}} value={a.injuryEnd||""} placeholder="Alta" onChange={e=>setAtt(p.id,"injured",{...a,injuryEnd:e.target.value})}/>
          </div>}
          {a.state==="present"&&<div className="att-extra">
            <span style={{fontSize:11,color:"#9ca3af",whiteSpace:"nowrap"}}>Val:</span>
            {RATINGS.map(rt=><button key={rt.value} className="rat-btn"
              style={{borderColor:rat===rt.value?rt.color:"#252836",background:rat===rt.value?rt.color+"20":"#13161f",color:rat===rt.value?rt.color:"#6b7280",maxWidth:74}}
              onClick={()=>setRat(p.id,rt.value)}>{rt.label}</button>)}
            {hasRPE&&<><span style={{fontSize:11,color:"#9ca3af",marginLeft:3,whiteSpace:"nowrap"}}>RPE:</span>
              <div className="rpe-wrap">
                {[1,2,3,4,5,6,7,8,9,10].map(n=>{const col=n<=3?"#22c55e":n<=6?"#eab308":"#ef4444";return<button key={n} className={`rpe-btn${r===n?" on":""}`}
                  style={r===n?{background:col,borderColor:col,color:"white"}:{}} onClick={()=>setRPE(p.id,n)}>{n}</button>;})}
              </div>
              {r&&<span style={{fontSize:11,color:"#6b7280",whiteSpace:"nowrap"}}>Carga:<b style={{color:"#e2e4f0",marginLeft:3}}>{r*dur}</b></span>}
            </>}
          </div>}
        </div>;
      })}
    </div>
    <div style={{marginTop:14}}>
      <label className="flabel" style={{display:"block",marginBottom:5}}>Valoración de la sesión</label>
      <textarea className="ftextarea" value={session.notes||""} onChange={e=>setNotes(e.target.value)} placeholder="¿Cómo ha ido? Notas para el coordinador..."/>
    </div>
  </div>;
}

function MatchDetail({session,team,updateTeam,onBack,onDuplicate}){
  const [sort,setSort]=useState(team.defaultSort||"number");
  const [mTab,setMTab]=useState("info");
  const players=sortPlayers(team.players||[],sort);
  const conv=session.convocados||[],att=session.attendance||{},matchData=session.matchData||{};
  const setF  =(f,v)=>updateTeam(team.id,t=>({...t,matches:t.matches.map(m=>m.id===session.id?{...m,[f]:v}:m)}));
  const toggleConv=pid=>updateTeam(team.id,t=>({...t,matches:t.matches.map(m=>m.id===session.id?{...m,convocados:conv.includes(pid)?conv.filter(x=>x!==pid):[...conv,pid]}:m)}));
  const setAtt=(pid,val,extra={})=>updateTeam(team.id,t=>({...t,matches:t.matches.map(m=>m.id===session.id?{...m,attendance:{...m.attendance,[pid]:{state:val,...extra}}}:m)}));
  const setRat=(pid,val)=>updateTeam(team.id,t=>({...t,matches:t.matches.map(m=>m.id===session.id?{...m,ratings:{...m.ratings,[pid]:val}}:m)}));
  const setMD =(pid,field,val)=>updateTeam(team.id,t=>({...t,matches:t.matches.map(m=>m.id===session.id?{...m,matchData:{...(m.matchData||{}),[pid]:{...(m.matchData||{})[pid],[field]:val}}}:m)}));
  const convPlayers=players.filter(p=>conv.includes(p.id));
  const allPresent=()=>convPlayers.forEach(p=>{if(!att[p.id]||att[p.id].state!=="present")setAtt(p.id,"present");});

  return <div>
    <div className="back-btn" onClick={onBack}>← Volver</div>
    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap",gap:8}}>
      <div><div style={{fontSize:17,fontWeight:700}}>⚽ {fmtDate(session.date)}</div>
        <div style={{fontSize:12,color:"#6b7280",marginTop:2}}>{session.rival?`vs ${session.rival}`:""}{session.goalsFor!==""&&session.goalsAgainst!==""?` · ${session.goalsFor}-${session.goalsAgainst}`:""}{session.competition?` · ${session.competition}`:""}</div>
      </div>
      <button className="btn btn-ghost btn-sm" onClick={onDuplicate}>⎘ Duplicar</button>
    </div>
    <div className="tabs">
      <div className={`tab${mTab==="info"?" active":""}`}        onClick={()=>setMTab("info")}>Info</div>
      <div className={`tab${mTab==="scouting"?" active":""}`}    onClick={()=>setMTab("scouting")}>Scout</div>
      <div className={`tab${mTab==="convocatoria"?" active":""}`} onClick={()=>setMTab("convocatoria")}>Convoc.({conv.length})</div>
      <div className={`tab${mTab==="asistencia"?" active":""}`}   onClick={()=>setMTab("asistencia")}>Asist.</div>
      <div className={`tab${mTab==="rendimiento"?" active":""}`}  onClick={()=>setMTab("rendimiento")}>Rend.</div>
    </div>
    {mTab==="info"&&<div className="card">
      <div className="frow">
        <div className="fg"><label className="flabel">Rival</label><input className="finput" value={session.rival||""} onChange={e=>setF("rival",e.target.value)} placeholder="Rival"/></div>
        <div className="fg" style={{maxWidth:105}}><label className="flabel">Competición</label>
          <select className="fselect" value={session.competition||"Liga"} onChange={e=>setF("competition",e.target.value)}>{COMPETITIONS.map(c=><option key={c} value={c}>{c}</option>)}</select>
        </div>
      </div>
      <div className="frow">
        <div className="fg" style={{maxWidth:75}}><label className="flabel">Jornada</label><input className="finput" value={session.matchday||""} onChange={e=>setF("matchday",e.target.value)} placeholder="J1"/></div>
        <div className="fg" style={{maxWidth:105}}><label className="flabel">Local/Visit.</label>
          <select className="fselect" value={session.homeAway||"Local"} onChange={e=>setF("homeAway",e.target.value)}><option>Local</option><option>Visitante</option></select>
        </div>
        <div className="fg" style={{maxWidth:65}}><label className="flabel">Goles ✓</label><input className="finput" type="number" min="0" value={session.goalsFor||""} onChange={e=>setF("goalsFor",e.target.value)} placeholder="0"/></div>
        <div className="fg" style={{maxWidth:65}}><label className="flabel">Goles ✗</label><input className="finput" type="number" min="0" value={session.goalsAgainst||""} onChange={e=>setF("goalsAgainst",e.target.value)} placeholder="0"/></div>
      </div>
      <textarea className="ftextarea" value={session.notes||""} onChange={e=>setF("notes",e.target.value)} placeholder="Análisis del partido..."/>
    </div>}
    {mTab==="convocatoria"&&<div>
      <div style={{fontSize:12,color:"#6b7280",marginBottom:9}}>{conv.length} convocados de {players.length}</div>
      {players.map(p=><div key={p.id} className={`conv-player${conv.includes(p.id)?" on":""}`} onClick={()=>toggleConv(p.id)}>
        <div className={`conv-check${conv.includes(p.id)?" on":""}`}>{conv.includes(p.id)?"✓":""}</div>
        <div style={{flex:1}}><div style={{fontWeight:600,fontSize:13}}>{p.number?`#${p.number} `:""}{p.name}</div><div style={{fontSize:11,color:"#6b7280"}}>{p.position||"—"}</div></div>
      </div>)}
      {conv.length>0&&<button className="btn btn-primary" style={{width:"100%",justifyContent:"center",marginTop:10}} onClick={()=>setMTab("asistencia")}>Continuar →</button>}
    </div>}
    {mTab==="asistencia"&&<div>
      {convPlayers.length===0&&<div className="alert alert-info">Define primero la convocatoria</div>}
      {convPlayers.length>0&&<button className="btn btn-success" style={{width:"100%",justifyContent:"center",padding:11,marginBottom:9}} onClick={allPresent}>✓ Todos presentes</button>}
      <div className="att-list">
        {convPlayers.map(p=>{const a=att[p.id]||{};return<div key={p.id} className="att-player">
          <div style={{display:"flex",alignItems:"center",gap:9,flexWrap:"wrap"}}>
            <div style={{flex:1,minWidth:110,fontWeight:600,fontSize:13}}>{p.number?`#${p.number} `:""}{p.name}</div>
            <div className="att-btns">{ATT_STATES.map(st=>{const on=a.state===st.value;return<button key={st.value} className="att-btn"
              style={{background:on?st.color+"22":"#13161f",borderColor:on?st.color:"#252836",color:on?st.color:"#6b7280"}}
              onClick={()=>setAtt(p.id,st.value)}>{st.icon} {st.label}</button>;})}</div>
          </div>
          {a.state==="justified"&&<div className="att-extra"><select className="fselect" style={{maxWidth:160,fontSize:12}} value={a.reason||""} onChange={e=>setAtt(p.id,"justified",{reason:e.target.value})}><option value="">Motivo...</option>{JUSTIFIED_REASONS.map(r=><option key={r} value={r}>{r}</option>)}</select></div>}
          {a.state==="injured"&&<div className="att-extra"><select className="fselect" style={{maxWidth:140,fontSize:12}} value={a.injuryType||""} onChange={e=>setAtt(p.id,"injured",{...a,injuryType:e.target.value})}><option value="">Tipo...</option>{INJURY_TYPES.map(i=><option key={i} value={i}>{i}</option>)}</select></div>}
        </div>;})}
      </div>
    </div>}
    {mTab==="scouting"&&<ScoutingTab session={session} team={team} updateTeam={updateTeam}/>}
    {mTab==="rendimiento"&&<div>
      <div style={{fontSize:12,color:"#6b7280",marginBottom:9}}>Minutos, posición y valoración táctica</div>
      {convPlayers.length===0&&<div className="alert alert-info">Define primero la convocatoria</div>}
      <div className="att-list">
        {convPlayers.map(p=>{const rat=session.ratings?.[p.id],md=matchData[p.id]||{};return<div key={p.id} className="att-player">
          <div style={{fontWeight:600,fontSize:13,marginBottom:8}}>{p.number?`#${p.number} `:""}{p.name}</div>
          <div className="frow" style={{marginBottom:8}}>
            <div className="fg" style={{maxWidth:85}}><label className="flabel">Minutos</label>
              <input className="finput" type="number" min="0" max="120" style={{fontSize:12}} value={md.minutes||""} onChange={e=>setMD(p.id,"minutes",e.target.value)} placeholder="0"/>
            </div>
            <div className="fg"><label className="flabel">Posición jugada</label>
              <select className="fselect" style={{fontSize:12}} value={md.position||p.position||""} onChange={e=>setMD(p.id,"position",e.target.value)}>
                <option value="">—</option>{POSITIONS.map(pos=><option key={pos} value={pos}>{pos}</option>)}
              </select>
            </div>
          </div>
          <div style={{display:"flex",gap:5,alignItems:"center",flexWrap:"wrap"}}>
            <span style={{fontSize:11,color:"#9ca3af",whiteSpace:"nowrap"}}>Aplicación:</span>
            {RATINGS.map(rt=><button key={rt.value} className="rat-btn"
              style={{borderColor:rat===rt.value?rt.color:"#252836",background:rat===rt.value?rt.color+"20":"#13161f",color:rat===rt.value?rt.color:"#6b7280"}}
              onClick={()=>setRat(p.id,rt.value)}>{rt.label}</button>)}
          </div>
        </div>;})}
      </div>
    </div>}
  </div>;
}

function PlayersTab({team,updateTeam}){
  const [showForm,setShowForm]=useState(false);
  const [editId,setEditId]=useState(null);
  const [form,setForm]=useState({name:"",position:"",number:"",dob:"",state:"Disponible"});
  const [profileId,setProfileId]=useState(null);
  const [confirm,setConfirm]=useState(null);
  const [sort,setSort]=useState(team.defaultSort||"number");

  const doSave=()=>{
    if(!form.name.trim())return;
    if(editId) updateTeam(team.id,t=>({...t,players:t.players.map(p=>p.id===editId?{...p,...form}:p)}));
    else updateTeam(team.id,t=>({...t,players:[...(t.players||[]),{id:genId(),objectives:[],...form}]}));
    setForm({name:"",position:"",number:"",dob:"",state:"Disponible"});setShowForm(false);setEditId(null);
  };
  const startEdit=(p,e)=>{ e.stopPropagation(); setForm({name:p.name,position:p.position||"",number:p.number||"",dob:p.dob||"",state:p.state||"Disponible"}); setEditId(p.id); setShowForm(true); };
  const doRemove=p=>{ updateTeam(team.id,t=>({...t,players:t.players.filter(x=>x.id!==p.id)})); setConfirm(null); };

  const players=sortPlayers(team.players||[],sort);
  if(profileId){ const pl=players.find(p=>p.id===profileId); if(!pl){setProfileId(null);return null;} return <PlayerProfile player={pl} team={team} updateTeam={updateTeam} onBack={()=>setProfileId(null)}/>; }

  return <div>
    {confirm&&<Confirm msg={`¿Eliminar a ${confirm.name}?`} onOk={()=>doRemove(confirm)} onCancel={()=>setConfirm(null)}/>}
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:8}}>
      <div className="sec-title" style={{marginBottom:0}}>Jugadores ({players.length})</div>
      <div style={{display:"flex",gap:6}}>
        <select className="fselect" style={{fontSize:12,padding:"5px 8px"}} value={sort} onChange={e=>{setSort(e.target.value);updateTeam(team.id,t=>({...t,defaultSort:e.target.value}));}}>
          {SORT_OPTIONS.map(o=><option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        <button className="btn btn-primary btn-sm" onClick={()=>{setEditId(null);setForm({name:"",position:"",number:"",dob:"",state:"Disponible"});setShowForm(!showForm);}}>+ Añadir</button>
      </div>
    </div>
    {showForm&&<div className="card">
      <div className="card-title">{editId?"Editar jugador":"Nuevo jugador"}</div>
      <div className="frow">
        <div className="fg"><label className="flabel">Nombre</label><input className="finput" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Nombre completo"/></div>
        <div className="fg" style={{maxWidth:75}}><label className="flabel">Dorsal</label><input className="finput" type="number" value={form.number} onChange={e=>setForm({...form,number:e.target.value})} placeholder="#"/></div>
      </div>
      <div className="frow">
        <div className="fg"><label className="flabel">Posición</label><select className="fselect" value={form.position} onChange={e=>setForm({...form,position:e.target.value})}><option value="">—</option>{POSITIONS.map(p=><option key={p} value={p}>{p}</option>)}</select></div>
        <div className="fg"><label className="flabel">Fecha nac.</label><input type="date" className="finput" value={form.dob} onChange={e=>setForm({...form,dob:e.target.value})}/></div>
      </div>
      <div className="fg" style={{marginBottom:12}}><label className="flabel">Estado</label>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:4}}>
          {PLAYER_STATES.map(s=><button key={s} className="btn btn-sm" style={{background:form.state===s?STATE_COLORS[s]+"22":"#1c1f2e",border:`1px solid ${form.state===s?STATE_COLORS[s]:"#252836"}`,color:form.state===s?STATE_COLORS[s]:"#9ca3af"}} onClick={()=>setForm({...form,state:s})}>{s}</button>)}
        </div>
      </div>
      <div style={{display:"flex",gap:8}}>
        <button className="btn btn-primary btn-sm" onClick={doSave}>Guardar</button>
        <button className="btn btn-outline btn-sm" onClick={()=>{setShowForm(false);setEditId(null);}}>Cancelar</button>
      </div>
    </div>}
    <div className="card">
      {players.length===0&&<div className="empty"><div className="empty-icon">👥</div>Añade el primer jugador</div>}
      {players.map(p=>{
        const stColor=STATE_COLORS[p.state||"Disponible"]||"#22c55e";
        return <div key={p.id} className="player-row" onClick={()=>setProfileId(p.id)}>
          <div className="pavatar" style={{background:stColor+"20",color:stColor}}>{p.number||p.name[0]}</div>
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <div className="pname">{p.name}</div>
              {p.state&&p.state!=="Disponible"&&<span style={{background:stColor+"20",color:stColor,border:`1px solid ${stColor}30`,borderRadius:6,padding:"1px 6px",fontSize:10,fontWeight:600}}>{p.state}</span>}
            </div>
            <div className="pmeta">{p.position||"—"}{p.number?` · #${p.number}`:""}{p.dob?` · ${fmtDate(p.dob)}`:""}</div>
          </div>
          <button className="btn btn-ghost btn-xs" onClick={e=>startEdit(p,e)}>✏️</button>
          <button className="btn btn-danger btn-xs" onClick={e=>{e.stopPropagation();setConfirm(p);}}>✕</button>
        </div>;
      })}
    </div>
  </div>;
}

function PlayerProfile({player,team,updateTeam,onBack}){
  const hasRPE=RPE_CATS.includes(team.category),dur=DURATION[team.category]||DURATION.default;
  const [showObjForm,setShowObjForm]=useState(false);
  const [objForm,setObjForm]=useState({type:"Táctico",text:""});
  const all=[...(team.sessions||[]).map(s=>({...s,type:"training"})),...(team.matches||[]).map(s=>({...s,type:"match"}))].sort((a,b)=>b.date.localeCompare(a.date));

  let present=0,absent=0,justified=0,injured=0,total=0,rpeSum=0,rpeCount=0,loadSum=0;
  let tG=0,tY=0,tR=0,tN=0,mG=0,mY=0,mR=0,mN=0,conv=0,totalMins=0,cur=0,bestStreak=0;
  const injuries=[];
  [...all].reverse().forEach(s=>{
    const a=s.attendance?.[player.id]; if(!a)return; total++;
    if(a.state==="present"){present++;cur++;if(cur>bestStreak)bestStreak=cur;}else cur=0;
    if(a.state==="absent")absent++; if(a.state==="justified")justified++;
    if(a.state==="injured"){injured++;if(!injuries.find(i=>i.start===a.injuryStart&&i.type===a.injuryType))injuries.push({type:a.injuryType,start:a.injuryStart,end:a.injuryEnd});}
    if(s.type==="training"){if(s.rpe?.[player.id]){rpeSum+=s.rpe[player.id];rpeCount++;loadSum+=s.rpe[player.id]*dur;}const rt=s.ratings?.[player.id];if(rt){tN++;if(rt==="green")tG++;else if(rt==="yellow")tY++;else tR++;}}
    if(s.type==="match"){if(s.convocados?.includes(player.id))conv++;const rt=s.ratings?.[player.id];if(rt){mN++;if(rt==="green")mG++;else if(rt==="yellow")mY++;else mR++;}if(s.matchData?.[player.id]?.minutes)totalMins+=parseInt(s.matchData[player.id].minutes)||0;}
  });
  const streak=cur;
  const pct=n=>total?Math.round(n/total*100):0;
  const rpct=(n,t)=>t?Math.round(n/t*100):0;
  const objectives=player.objectives||[];
  const addObj=()=>{
    if(!objForm.text.trim())return;
    updateTeam(team.id,t=>({...t,players:t.players.map(p=>p.id===player.id?{...p,objectives:[...(p.objectives||[]),{id:genId(),...objForm,done:false,date:today()}]}:p)}));
    setObjForm({type:"Táctico",text:""});setShowObjForm(false);
  };
  const toggleObj=id=>updateTeam(team.id,t=>({...t,players:t.players.map(p=>p.id===player.id?{...p,objectives:(p.objectives||[]).map(o=>o.id===id?{...o,done:!o.done}:o)}:p)}));
  const removeObj=id=>updateTeam(team.id,t=>({...t,players:t.players.map(p=>p.id===player.id?{...p,objectives:(p.objectives||[]).filter(o=>o.id!==id)}:p)}));
  const stColor=STATE_COLORS[player.state||"Disponible"]||"#22c55e";

  return <div>
    <div className="back-btn" onClick={onBack}>← Volver a jugadores</div>
    <div className="card" style={{display:"flex",alignItems:"center",gap:12,padding:14,marginBottom:11}}>
      <div style={{width:50,height:50,background:stColor+"20",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:700,color:stColor,flexShrink:0}}>{player.number||player.name[0]}</div>
      <div style={{flex:1}}>
        <div style={{fontSize:17,fontWeight:700}}>{player.name}</div>
        <div style={{fontSize:12,color:"#6b7280",marginTop:2}}>{player.position||"—"}{player.number?` · #${player.number}`:""}{player.dob?` · ${fmtDate(player.dob)}`:""}</div>
        <span style={{background:stColor+"20",color:stColor,border:`1px solid ${stColor}30`,borderRadius:6,padding:"2px 7px",fontSize:11,fontWeight:600,display:"inline-block",marginTop:4}}>{player.state||"Disponible"}</span>
      </div>
    </div>

    <div className="card">
      <div className="card-title">📋 Asistencia ({total} sesiones)</div>
      <div className="stat-grid" style={{gridTemplateColumns:"repeat(2,1fr)",gap:7}}>
        {[{v:`${pct(present)}%`,n:present,l:"Presencia",c:"#22c55e"},{v:`${pct(absent)}%`,n:absent,l:"Aus. NJ",c:"#ef4444"},{v:`${pct(justified)}%`,n:justified,l:"Justificadas",c:"#3b82f6"},{v:`${pct(injured)}%`,n:injured,l:"Lesiones",c:"#f97316"}].map((s,i)=><div key={i} className="stat-box" style={{padding:9}}>
          <div className="stat-val" style={{fontSize:19,color:s.c}}>{s.v}</div><div className="stat-lbl">{s.l} ({s.n})</div>
          <div className="pbar"><div className="pfill" style={{width:s.v,background:s.c}}/></div>
        </div>)}
      </div>
      <div style={{display:"flex",gap:8,marginTop:5}}>
        <div className="stat-box" style={{flex:1,padding:9}}><div className="stat-val" style={{fontSize:17}}>{streak}</div><div className="stat-lbl">Racha actual</div></div>
        <div className="stat-box" style={{flex:1,padding:9}}><div className="stat-val" style={{fontSize:17}}>{bestStreak}</div><div className="stat-lbl">Mejor racha</div></div>
      </div>
    </div>

    {tN>0&&<div className="card"><div className="card-title">🏃 Entrenamientos ({tN} valorados)</div>
      <div style={{display:"flex",gap:7}}>{[["🟢",tG,tN,"#22c55e","Verde"],["🟡",tY,tN,"#eab308","Amarillo"],["🔴",tR,tN,"#ef4444","Rojo"]].map(([ic,n,tot,c,l],i)=><div key={i} style={{flex:1,background:`${c}12`,border:`1px solid ${c}28`,borderRadius:9,padding:9,textAlign:"center"}}>
        <div style={{fontSize:15}}>{ic}</div><div style={{fontSize:19,fontWeight:700,color:c,fontFamily:"DM Mono"}}>{rpct(n,tot)}%</div><div style={{fontSize:10,color:"#6b7280"}}>{l}</div>
      </div>)}</div>
    </div>}

    {(mN>0||conv>0)&&<div className="card"><div className="card-title">⚽ Partidos</div>
      <div style={{display:"flex",gap:8,marginBottom:mN>0?10:0}}>
        <div className="stat-box" style={{flex:1,padding:9}}><div className="stat-val" style={{fontSize:19}}>{conv}</div><div className="stat-lbl">Convocatorias</div></div>
        <div className="stat-box" style={{flex:1,padding:9}}><div className="stat-val" style={{fontSize:19}}>{totalMins}'</div><div className="stat-lbl">Minutos totales</div></div>
      </div>
      {mN>0&&<div style={{display:"flex",gap:7}}>{[["🟢",mG,mN,"#22c55e","Verde"],["🟡",mY,mN,"#eab308","Amarillo"],["🔴",mR,mN,"#ef4444","Rojo"]].map(([ic,n,tot,c,l],i)=><div key={i} style={{flex:1,background:`${c}12`,border:`1px solid ${c}28`,borderRadius:9,padding:9,textAlign:"center"}}>
        <div style={{fontSize:15}}>{ic}</div><div style={{fontSize:19,fontWeight:700,color:c,fontFamily:"DM Mono"}}>{rpct(n,tot)}%</div><div style={{fontSize:10,color:"#6b7280"}}>{l}</div>
      </div>)}</div>}
    </div>}

    {hasRPE&&rpeCount>0&&<div className="card"><div className="card-title">💪 Carga</div>
      <div style={{display:"flex",gap:8}}>{[{v:(rpeSum/rpeCount).toFixed(1),l:"RPE medio"},{v:Math.round(loadSum/rpeCount),l:"Carga media"},{v:loadSum,l:"Carga total"}].map((s,i)=><div key={i} className="stat-box" style={{flex:1,padding:9}}><div className="stat-val" style={{fontSize:17}}>{s.v}</div><div className="stat-lbl">{s.l}</div></div>)}</div>
    </div>}

    <div className="card">
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:11}}>
        <div className="card-title" style={{marginBottom:0}}>🎯 Objetivos individuales</div>
        <button className="btn btn-primary btn-sm" onClick={()=>setShowObjForm(!showObjForm)}>+ Añadir</button>
      </div>
      {showObjForm&&<div style={{background:"#1c1f2e",borderRadius:9,padding:11,marginBottom:11}}>
        <div className="frow" style={{marginBottom:7}}>
          <div className="fg" style={{maxWidth:115}}><label className="flabel">Tipo</label>
            <select className="fselect" style={{fontSize:12}} value={objForm.type} onChange={e=>setObjForm({...objForm,type:e.target.value})}>{OBJ_TYPES.map(t=><option key={t} value={t}>{t}</option>)}</select>
          </div>
          <div className="fg"><label className="flabel">Objetivo</label><input className="finput" style={{fontSize:12}} value={objForm.text} onChange={e=>setObjForm({...objForm,text:e.target.value})} placeholder="Mejorar pressing sin balón..."/></div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={addObj}>Guardar</button>
      </div>}
      {objectives.length===0&&<div style={{fontSize:13,color:"#4b5563",textAlign:"center",padding:"10px 0"}}>Sin objetivos definidos</div>}
      {objectives.map(o=>{const tc=o.type==="Táctico"?"#2563eb":o.type==="Técnico"?"#8b5cf6":"#06b6d4";return<div key={o.id} style={{display:"flex",alignItems:"center",gap:9,padding:"8px 0",borderBottom:"1px solid #1a1d2a"}}>
        <div onClick={()=>toggleObj(o.id)} style={{width:17,height:17,borderRadius:5,border:`2px solid ${o.done?"#22c55e":"#252836"}`,background:o.done?"#22c55e":"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:"white",flexShrink:0}}>{o.done?"✓":""}</div>
        <div style={{flex:1}}><span style={{background:tc+"20",color:tc,border:`1px solid ${tc}30`,borderRadius:5,padding:"1px 5px",fontSize:10,fontWeight:600,marginRight:5}}>{o.type}</span>
          <span style={{fontSize:13,color:o.done?"#6b7280":"#e2e4f0",textDecoration:o.done?"line-through":"none"}}>{o.text}</span></div>
        <button className="btn btn-danger btn-xs" onClick={()=>removeObj(o.id)}>✕</button>
      </div>;})}
    </div>

    {injuries.length>0&&<div className="card"><div className="card-title">⚕ Historial lesiones</div>
      {[...injuries].reverse().map((inj,i)=><div key={i} className="stat-row">
        <div><div style={{fontWeight:600,fontSize:13}}>{inj.type||"Sin especificar"}</div><div style={{fontSize:11,color:"#6b7280"}}>{fmtDate(inj.start)}{inj.end?` → ${fmtDate(inj.end)}`:""}</div></div>
        <span className="inj-tag">⚕</span>
      </div>)}
    </div>}

    <div className="card"><div className="card-title">📅 Últimas sesiones</div>
      {all.slice(0,10).map(s=>{
        const a=s.attendance?.[player.id]; if(!a)return null;
        const st=ATT_STATES.find(x=>x.value===a.state),rat=s.ratings?.[player.id],ro=rat?RATINGS.find(x=>x.value===rat):null,md=s.matchData?.[player.id];
        return <div key={s.id} className="stat-row">
          <div><div style={{fontSize:12,fontWeight:600}}>{fmtDate(s.date)} · {s.type==="training"?"Entreno":"Partido"}</div>
            <div style={{fontSize:11,color:"#6b7280"}}>{s.topic||s.rival||""}{md?.minutes?` · ${md.minutes}'`:""}{md?.position?` · ${md.position}`:""}</div>
          </div>
          <div style={{display:"flex",gap:4,alignItems:"center"}}>
            {ro&&<span style={{background:ro.color+"20",color:ro.color,fontSize:10,fontWeight:600,padding:"2px 5px",borderRadius:20}}>{ro.label}</span>}
            {st&&<span style={{background:st.color+"20",color:st.color,fontSize:10,fontWeight:600,padding:"2px 5px",borderRadius:20}}>{st.label}</span>}
          </div>
        </div>;
      }).filter(Boolean)}
    </div>
  </div>;
}

function StatsTab({team}){
  const [period,setPeriod]=useState("all"),[profileId,setProfileId]=useState(null);
  const hasRPE=RPE_CATS.includes(team.category),dur=DURATION[team.category]||DURATION.default;
  const players=team.players||[];
  if(profileId){const pl=players.find(p=>p.id===profileId);if(!pl){setProfileId(null);return null;}return<PlayerProfile player={pl} team={team} updateTeam={()=>{}} onBack={()=>setProfileId(null)}/>;}
  const now=new Date();
  const all=[...(team.sessions||[]).map(s=>({...s,type:"training"})),...(team.matches||[]).map(s=>({...s,type:"match"}))];
  const filtered=period==="month"?all.filter(s=>s.date.startsWith(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`)):all;
  const wkLoads={};
  filtered.filter(s=>s.type==="training").forEach(s=>{
    const wk=getWeekKey(s.date); if(!wkLoads[wk])wkLoads[wk]=0;
    players.forEach(p=>{if(s.rpe?.[p.id])wkLoads[wk]+=s.rpe[p.id]*dur;});
  });
  const wkKeys=Object.keys(wkLoads).sort().slice(-8);
  const maxLoad=Math.max(...wkKeys.map(k=>wkLoads[k]),1);
  const stats=players.map(p=>{
    let present=0,absent=0,justified=0,injured=0,total=0,rpeSum=0,rpeCount=0,load=0,tG=0,tY=0,tR=0,tN=0,mG=0,mY=0,mR=0,mN=0,conv=0;
    filtered.forEach(s=>{const a=s.attendance?.[p.id];if(!a)return;total++;if(a.state==="present")present++;else if(a.state==="absent")absent++;else if(a.state==="justified")justified++;else if(a.state==="injured")injured++;
      if(s.type==="training"){if(s.rpe?.[p.id]){rpeSum+=s.rpe[p.id];rpeCount++;load+=s.rpe[p.id]*dur;}const rt=s.ratings?.[p.id];if(rt){tN++;if(rt==="green")tG++;else if(rt==="yellow")tY++;else tR++;}}
      if(s.type==="match"){if(s.convocados?.includes(p.id))conv++;const rt=s.ratings?.[p.id];if(rt){mN++;if(rt==="green")mG++;else if(rt==="yellow")mY++;else mR++;}}
    });
    return{...p,present,absent,justified,injured,total,pp:total?Math.round(present/total*100):0,ap:total?Math.round(absent/total*100):0,jp:total?Math.round(justified/total*100):0,ip:total?Math.round(injured/total*100):0,avgRPE:rpeCount?(rpeSum/rpeCount).toFixed(1):"-",tG,tY,tR,tN,mG,mY,mR,mN,conv};
  });

  return <div>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:8}}>
      <div className="sec-title" style={{marginBottom:0}}>Estadísticas</div>
      <div className="tabs" style={{margin:0,width:"auto"}}>
        <div className={`tab${period==="all"?" active":""}`}   style={{padding:"5px 12px"}} onClick={()=>setPeriod("all")}>Total</div>
        <div className={`tab${period==="month"?" active":""}`} style={{padding:"5px 12px"}} onClick={()=>setPeriod("month")}>Este mes</div>
      </div>
    </div>
    {hasRPE&&wkKeys.length>1&&<div className="card">
      <div className="card-title">📈 Carga semanal del equipo</div>
      <div className="chart-wrap">
        {wkKeys.map(wk=>{const h=Math.round((wkLoads[wk]/maxLoad)*100),col=h>75?"#ef4444":h>45?"#eab308":"#22c55e";
          return<div key={wk} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center"}}>
            <div className="chart-bar" style={{height:`${h}%`,background:col,width:"100%"}}><span className="chart-val">{wkLoads[wk]}</span></div>
            <div className="chart-lbl">S{wk.split("-W")[1]}</div>
          </div>;
        })}
      </div>
    </div>}
    {stats.length===0&&<div className="empty"><div className="empty-icon">📊</div>Sin datos todavía</div>}
    {stats.map(s=><div key={s.id} className="card" style={{padding:13,cursor:"pointer"}} onClick={()=>setProfileId(s.id)}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:9}}>
        <div className="pavatar" style={{width:34,height:34,background:STATE_COLORS[s.state||"Disponible"]+"20",color:STATE_COLORS[s.state||"Disponible"]}}>{s.number||s.name[0]}</div>
        <div style={{flex:1}}>
          <div style={{fontWeight:700,fontSize:13}}>{s.name}</div>
          <div style={{fontSize:11,color:"#2563eb"}}>{s.total} ses. · Ver perfil →</div>
        </div>
        {s.state&&s.state!=="Disponible"&&<span style={{background:STATE_COLORS[s.state]+"20",color:STATE_COLORS[s.state],border:`1px solid ${STATE_COLORS[s.state]}30`,borderRadius:6,padding:"1px 6px",fontSize:10,fontWeight:600}}>{s.state}</span>}
      </div>
      <div className="stat-grid" style={{gridTemplateColumns:"repeat(4,1fr)",gap:5}}>
        {[{v:`${s.pp}%`,l:"Presencia",c:"#22c55e"},{v:`${s.ap}%`,l:"Aus.NJ",c:"#ef4444"},{v:`${s.jp}%`,l:"Justif.",c:"#3b82f6"},{v:`${s.ip}%`,l:"Lesiones",c:"#f97316"}].map((st,i)=><div key={i} className="stat-box" style={{padding:6}}>
          <div className="stat-val" style={{fontSize:14,color:st.c}}>{st.v}</div><div className="stat-lbl" style={{fontSize:9}}>{st.l}</div>
          <div className="pbar"><div className="pfill" style={{width:st.v,background:st.c}}/></div>
        </div>)}
      </div>
      {(s.tN>0||s.mN>0)&&<div style={{display:"flex",gap:3,marginTop:7,flexWrap:"wrap"}}>
        {s.tN>0&&[["🟢",s.tG,s.tN,"#22c55e"],["🟡",s.tY,s.tN,"#eab308"],["🔴",s.tR,s.tN,"#ef4444"]].map(([ic,n,tot,c],i)=><span key={i} style={{background:`${c}12`,border:`1px solid ${c}28`,color:c,fontSize:10,fontWeight:600,padding:"2px 5px",borderRadius:20}}>{ic}{tot?Math.round(n/tot*100):0}%E</span>)}
        {s.mN>0&&[["🟢",s.mG,s.mN,"#22c55e"],["🟡",s.mY,s.mN,"#eab308"],["🔴",s.mR,s.mN,"#ef4444"]].map(([ic,n,tot,c],i)=><span key={`m${i}`} style={{background:`${c}12`,border:`1px solid ${c}28`,color:c,fontSize:10,fontWeight:600,padding:"2px 5px",borderRadius:20}}>{ic}{tot?Math.round(n/tot*100):0}%P</span>)}
        {hasRPE&&s.avgRPE!=="-"&&<span style={{background:"#8b5cf618",border:"1px solid #8b5cf628",color:"#a78bfa",fontSize:10,fontWeight:600,padding:"2px 5px",borderRadius:20}}>RPE {s.avgRPE}</span>}
      </div>}
    </div>)}
  </div>;
}

function NotesTab({team,updateTeam,isCoord}){
  const [msg,setMsg]=useState("");
  const notes=team.coordinatorNotes||[];
  const broadcasts=[...(team.broadcasts||[])].reverse();
  const send=()=>{
    if(!msg.trim())return;
    const n={id:genId(),text:msg.trim(),from:isCoord?"coordinator":"trainer",name:isCoord?"Coordinador":"Entrenador",date:today(),read:false};
    updateTeam(team.id,t=>({...t,coordinatorNotes:[...(t.coordinatorNotes||[]),n]}));
    setMsg("");
  };
  return <div>
    <div className="sec-title">💬 Comunicación</div>
    {broadcasts.length>0&&<div className="card" style={{marginBottom:12}}>
      <div className="card-title" style={{marginBottom:9}}>📢 Comunicados del club</div>
      {broadcasts.map(b=><div key={b.id} className="broadcast-bubble"><div className="note-meta">Coordinador · {fmtDate(b.date)}</div><div className="note-text">{b.text}</div></div>)}
    </div>}
    <div className="card">
      <div className="card-title" style={{marginBottom:9}}>Chat con coordinador</div>
      {notes.length===0&&<div className="empty" style={{padding:"12px 0"}}><div className="empty-icon">💬</div>Sin mensajes</div>}
      {notes.map(n=><div key={n.id} className={`note-bubble${n.from==="coordinator"?" coord":""}`}><div className="note-meta">{n.name} · {fmtDate(n.date)}</div><div className="note-text">{n.text}</div></div>)}
      <div className="divider"/>
      <textarea className="ftextarea" style={{minHeight:60}} placeholder="Escribe un mensaje..." value={msg} onChange={e=>setMsg(e.target.value)}/>
      <button className="btn btn-primary" style={{marginTop:7,width:"100%",justifyContent:"center"}} onClick={send} disabled={!msg.trim()}>Enviar</button>
    </div>
  </div>;
}

function CoordView({teams,persist,updateTeam,logout}){
  const [tab,setTab]=useState("overview"),[selTeam,setSelTeam]=useState(null);
  const totalUnread=teams.reduce((acc,t)=>acc+unread(t.coordinatorNotes,"coordinator"),0);
  const tabs=[
    {id:"overview", label:"📊 Global"},
    {id:"teams",    label:"🗂️ Equipos"},
    {id:"injuries", label:"⚕ Lesiones"},
    {id:"alerts",   label:"🚨 Alertas"},
    {id:"broadcast",label:"📢 Comuni.",badge:totalUnread},
    {id:"scout",    label:"🔍 Scout"},
    {id:"meetings", label:"📅 Reuniones"},
  ];
  return <div>
    <div className="header">
      <div style={{display:"flex",alignItems:"center",gap:10}}><div className="hmark">⚽</div><div><div style={{fontSize:14,fontWeight:700}}>Canet F.C.</div><div style={{fontSize:11,color:"#6b7280"}}>Coordinador</div></div></div>
      <div style={{display:"flex",gap:6}}>
        <button className="btn btn-ghost btn-sm" onClick={()=>teams.forEach(t=>exportCSV(t))}>⬇ Todo</button>
        <button className="btn btn-ghost btn-sm" onClick={logout}>Salir</button>
      </div>
    </div>
    <div className="nav">{tabs.map(t=><div key={t.id} className={`nav-tab${tab===t.id?" active":""}`} onClick={()=>{setTab(t.id);setSelTeam(null);}}>{t.label}{t.badge>0&&<span className="unread-badge">{t.badge}</span>}</div>)}</div>
    <div className="content">
      {tab==="overview"  && <GlobalOverview teams={teams}/>}
      {tab==="teams"     && !selTeam && <TeamsManager teams={teams} persist={persist} onSelect={setSelTeam}/>}
      {tab==="teams"     && selTeam  && <TeamDetailCoord team={teams.find(t=>t.id===selTeam)} updateTeam={updateTeam} onBack={()=>setSelTeam(null)}/>}
      {tab==="injuries"  && <InjuriesView teams={teams}/>}
      {tab==="alerts"    && <AlertsView teams={teams}/>}
      {tab==="broadcast" && <BroadcastTab teams={teams} persist={persist}/>}
      {tab==="scout"     && <ScoutGlobalView teams={teams}/>}
      {tab==="meetings"  && <MeetingsCoordView teams={teams} persist={persist}/>}
    </div>
  </div>;
}

function GlobalOverview({teams}){
  const thisWeek=getWeekKey(today());
  let tp=0,ta=0,tj=0,ti=0,tr=0;
  teams.forEach(t=>[...(t.sessions||[]),...(t.matches||[])].forEach(s=>Object.values(s.attendance||{}).forEach(a=>{tr++;if(a.state==="present")tp++;else if(a.state==="absent")ta++;else if(a.state==="justified")tj++;else if(a.state==="injured")ti++;})));
  const totalP=teams.reduce((a,t)=>a+(t.players||[]).length,0),totalS=teams.reduce((a,t)=>a+(t.sessions||[]).length+(t.matches||[]).length,0);

  const teamStats=teams.map(t=>{
    let p=0,total=0,wins=0,draws=0,losses=0;
    [...(t.sessions||[]),...(t.matches||[])].forEach(s=>{Object.values(s.attendance||{}).forEach(a=>{total++;if(a.state==="present")p++;});
      if(s.goalsFor!==""&&s.goalsAgainst!==""){const gf=parseInt(s.goalsFor),ga=parseInt(s.goalsAgainst);if(gf>ga)wins++;else if(gf===ga)draws++;else losses++;}
    });
    const wkS=[...(t.sessions||[]),...(t.matches||[])].filter(s=>getWeekKey(s.date)===thisWeek);
    return{...t,presencePct:total?Math.round(p/total*100):null,wins,draws,losses,hasSessions:wkS.length>0,hasIncomplete:wkS.some(s=>!isComplete(s))};
  });

  return <div>
    <div className="sec-title">Resumen del Club</div>
    <div className="stat-grid">
      {[{v:teams.length,l:"Equipos",c:"#2563eb"},{v:totalP,l:"Jugadores",c:"#22c55e"},{v:totalS,l:"Sesiones",c:"#8b5cf6"},{v:tr?`${Math.round(tp/tr*100)}%`:"—",l:"Asistencia media",c:"#22c55e"}].map((s,i)=><div key={i} className="stat-box"><div className="stat-val" style={{color:s.c}}>{s.v}</div><div className="stat-lbl">{s.l}</div></div>)}
    </div>
    {tr>0&&<div className="card"><div className="card-title">Distribución global</div>
      {[{l:"Presencia",v:tp,c:"#22c55e"},{l:"Ausencias NJ",v:ta,c:"#ef4444"},{l:"Justificadas",v:tj,c:"#3b82f6"},{l:"Lesiones",v:ti,c:"#f97316"}].map((r,i)=><div key={i} style={{marginBottom:9}}>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}><span style={{color:"#9ca3af"}}>{r.l}</span><span style={{fontWeight:600,color:r.c}}>{tr?Math.round(r.v/tr*100):0}% ({r.v})</span></div>
        <div className="pbar"><div className="pfill" style={{width:`${tr?r.v/tr*100:0}%`,background:r.c}}/></div>
      </div>)}
    </div>}

    <div style={{fontSize:14,fontWeight:700,marginBottom:9}}>Comparación de equipos</div>
    {teamStats.sort((a,b)=>(b.presencePct||0)-(a.presencePct||0)).map(t=><div key={t.id} className="card-sm" style={{marginBottom:7}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:5}}>
        <div style={{flex:1,minWidth:130}}>
          <div style={{fontWeight:600,fontSize:13}}>{t.name}</div>
          <div style={{fontSize:11,color:"#6b7280"}}>{t.category} · {(t.players||[]).length} jug.{t.wins+t.draws+t.losses>0?` · ${t.wins}V ${t.draws}E ${t.losses}D`:""}</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {!t.hasSessions&&<span style={{fontSize:10,color:"#f97316",fontWeight:600}}>⚠️ Sin sesiones</span>}
          {t.hasSessions&&t.hasIncomplete&&<span style={{fontSize:10,color:"#eab308",fontWeight:600}}>⏳ Incompleta</span>}
          {t.hasSessions&&!t.hasIncomplete&&<span style={{fontSize:10,color:"#22c55e",fontWeight:600}}>✓ Al día</span>}
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:17,fontWeight:700,color:"#22c55e",fontFamily:"DM Mono"}}>{t.presencePct!==null?`${t.presencePct}%`:"—"}</div>
            <div style={{fontSize:10,color:"#6b7280"}}>asistencia</div>
          </div>
        </div>
      </div>
      {t.presencePct!==null&&<div className="pbar" style={{marginTop:5}}><div className="pfill" style={{width:`${t.presencePct}%`,background:"#22c55e"}}/></div>}
    </div>)}
  </div>;
}

function BroadcastTab({teams,persist}){
  const [msg,setMsg]=useState("");
  const allNotes=[];
  teams.forEach(t=>(t.coordinatorNotes||[]).filter(n=>n.from==="trainer").forEach(n=>allNotes.push({...n,teamName:t.name})));
  allNotes.sort((a,b)=>b.date.localeCompare(a.date));
  const send=()=>{
    if(!msg.trim())return;
    const bc={id:genId(),text:msg.trim(),date:today()};
    persist(teams.map(t=>({...t,broadcasts:[...(t.broadcasts||[]),bc]})));
    setMsg("");
  };
  return <div>
    <div className="sec-title">📢 Comunicados y mensajes</div>
    <div className="card">
      <div className="card-title">Enviar comunicado a todos los equipos</div>
      <textarea className="ftextarea" style={{minHeight:75}} placeholder="Escribe un comunicado para todos los entrenadores..." value={msg} onChange={e=>setMsg(e.target.value)}/>
      <button className="btn btn-primary" style={{marginTop:7,width:"100%",justifyContent:"center"}} onClick={send} disabled={!msg.trim()}>📢 Enviar a todos</button>
    </div>
    {allNotes.length>0&&<div className="card">
      <div className="card-title">Mensajes de entrenadores ({allNotes.length})</div>
      {allNotes.slice(0,20).map(n=><div key={n.id} className="note-bubble" style={{marginBottom:7}}>
        <div className="note-meta">{n.teamName} · {fmtDate(n.date)}</div>
        <div className="note-text">{n.text}</div>
      </div>)}
    </div>}
  </div>;
}

function InjuriesView({teams}){
  const injuries=[];
  teams.forEach(team=>{
    const seen=new Set();
    [...(team.sessions||[]),...(team.matches||[])].sort((a,b)=>b.date.localeCompare(a.date)).forEach(s=>{
      Object.entries(s.attendance||{}).forEach(([pid,a])=>{
        if(a.state!=="injured")return;
        const key=`${pid}_${a.injuryStart||s.date}`; if(seen.has(key))return; seen.add(key);
        const p=(team.players||[]).find(x=>x.id===pid);
        if(p) injuries.push({player:p.name,team:team.name,type:a.injuryType||"Sin especificar",start:a.injuryStart||s.date,end:a.injuryEnd,active:!a.injuryEnd});
      });
    });
  });
  injuries.sort((a,b)=>(b.start||"").localeCompare(a.start||""));
  const active=injuries.filter(i=>i.active),past=injuries.filter(i=>!i.active);
  return <div>
    <div className="sec-title">⚕ Lesiones del Club</div>
    <div style={{fontSize:14,fontWeight:700,marginBottom:9}}>Activas ({active.length})</div>
    {active.length===0&&<div className="alert alert-info">No hay lesiones activas ✓</div>}
    {active.map((inj,i)=><div key={i} className="card-sm" style={{marginBottom:7,borderColor:"#f9731628"}}>
      <div style={{fontWeight:600,fontSize:13}}>{inj.player} <span className="inj-tag">⚕ {inj.type}</span></div>
      <div style={{fontSize:11,color:"#6b7280",marginTop:2}}>{inj.team} · Desde {fmtDate(inj.start)}</div>
    </div>)}
    {past.length>0&&<><div style={{fontSize:14,fontWeight:700,margin:"14px 0 9px"}}>Historial ({past.length})</div>
    {past.map((inj,i)=><div key={i} className="card-sm" style={{marginBottom:6}}>
      <div style={{fontWeight:600,fontSize:13}}>{inj.player} · <span style={{color:"#9ca3af",fontWeight:400}}>{inj.type}</span></div>
      <div style={{fontSize:11,color:"#6b7280"}}>{inj.team} · {fmtDate(inj.start)} → {fmtDate(inj.end)}</div>
    </div>)}</>}
  </div>;
}

function AlertsView({teams}){
  const alerts=[];
  teams.forEach(team=>{
    const all=[...(team.sessions||[]),...(team.matches||[])];
    (team.players||[]).forEach(p=>{
      let total=0,absent=0;
      all.forEach(s=>{const a=s.attendance?.[p.id];if(!a)return;total++;if(a.state==="absent")absent++;});
      if(total>=3&&absent/total>=0.3) alerts.push({type:"absence",team:team.name,player:p.name,pct:Math.round(absent/total*100),absent,total});
    });
    const incomplete=all.filter(s=>!isComplete(s)&&new Date(s.date)<new Date());
    if(incomplete.length>0) alerts.push({type:"incomplete",team:team.name,count:incomplete.length});
    const injSeen=new Set();
    all.forEach(s=>Object.entries(s.attendance||{}).forEach(([pid,a])=>{
      if(a.state==="injured"&&!a.injuryEnd&&!injSeen.has(pid)){injSeen.add(pid);const p=(team.players||[]).find(x=>x.id===pid);if(p)alerts.push({type:"injury",team:team.name,player:p.name});}
    }));
    (team.players||[]).filter(p=>p.state&&p.state!=="Disponible").forEach(p=>alerts.push({type:"state",team:team.name,player:p.name,state:p.state}));
  });
  return <div>
    <div className="sec-title">Alertas del Club</div>
    {alerts.length===0&&<div className="empty"><div className="empty-icon">✅</div>Sin alertas. Todo en orden.</div>}
    {alerts.filter(a=>a.type==="absence").map((a,i)=><div key={i} className="alert alert-warn" style={{marginBottom:7}}><strong>⚠️ {a.player}</strong> — {a.team}<br/><span style={{fontSize:12}}>{a.pct}% ausencias NJ ({a.absent}/{a.total})</span></div>)}
    {alerts.filter(a=>a.type==="incomplete").map((a,i)=><div key={i} className="alert alert-orange" style={{marginBottom:7}}><strong>⏳ {a.team}</strong><br/><span style={{fontSize:12}}>{a.count} sesión(es) sin registrar</span></div>)}
    {alerts.filter(a=>a.type==="injury").map((a,i)=><div key={i} className="alert alert-orange" style={{marginBottom:7}}><strong>⚕ {a.player}</strong> — {a.team}<br/><span style={{fontSize:12}}>Lesión activa sin fecha de alta</span></div>)}
    {alerts.filter(a=>a.type==="state").map((a,i)=><div key={i} className="alert" style={{background:"#eab30812",border:"1px solid #eab30828",color:"#fde68a",marginBottom:7}}><strong>⚡ {a.player}</strong> — {a.team}<br/><span style={{fontSize:12}}>Estado: {a.state}</span></div>)}
  </div>;
}

function TeamsManager({teams,persist,onSelect}){
  const [showAdd,setShowAdd]=useState(false),[form,setForm]=useState({name:"",category:CATEGORIES[0],pin:""}),[confirm,setConfirm]=useState(null);
  const add=()=>{if(!form.name||form.pin.length!==4)return;persist([...teams,{id:genId(),...form,players:[],sessions:[],matches:[],weekNotes:{},monthNotes:{},coordinatorNotes:[],seasons:[],broadcasts:[],meetings:[],scoutPlayers:[]}]);setForm({name:"",category:CATEGORIES[0],pin:""});setShowAdd(false);};
  return <div>
    {confirm&&<Confirm msg={`¿Eliminar "${confirm.name}"? Se pierden todos sus datos.`} onOk={()=>{persist(teams.filter(t=>t.id!==confirm.id));setConfirm(null);}} onCancel={()=>setConfirm(null)}/>}
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
      <div className="sec-title" style={{marginBottom:0}}>Equipos</div>
      <button className="btn btn-primary btn-sm" onClick={()=>setShowAdd(!showAdd)}>+ Nuevo</button>
    </div>
    {showAdd&&<div className="card">
      <div className="frow">
        <div className="fg"><label className="flabel">Nombre</label><input className="finput" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Ej: Infantil A"/></div>
        <div className="fg"><label className="flabel">Categoría</label><select className="fselect" value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
        <div className="fg" style={{maxWidth:100}}><label className="flabel">PIN</label><input className="finput" value={form.pin} onChange={e=>setForm({...form,pin:e.target.value.replace(/\D/g,"")})} maxLength={4} placeholder="4 dígitos"/></div>
      </div>
      <div style={{display:"flex",gap:8}}><button className="btn btn-primary btn-sm" onClick={add}>Crear</button><button className="btn btn-outline btn-sm" onClick={()=>setShowAdd(false)}>Cancelar</button></div>
    </div>}
    {teams.map(t=><TeamMgrRow key={t.id} team={t} onSelect={onSelect} onRemove={setConfirm} persist={persist} teams={teams}/>)}
  </div>;
}

function TeamMgrRow({team,onSelect,onRemove,persist,teams}){
  const [showPin,setShowPin]=useState(false),[newPin,setNewPin]=useState("");
  return <div className="card-sm" style={{marginBottom:7}}>
    <div style={{display:"flex",alignItems:"center",gap:9,flexWrap:"wrap"}}>
      <div style={{flex:1,minWidth:130}}>
        <div style={{fontWeight:600,fontSize:14}}>{team.name}</div>
        <div style={{fontSize:11,color:"#6b7280"}}>{team.category} · {(team.players||[]).length} jug. · PIN: {showPin?team.pin:"••••"}</div>
      </div>
      <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
        <button className="btn btn-ghost btn-sm" onClick={()=>onSelect(team.id)}>Ver</button>
        <button className="btn btn-ghost btn-sm" onClick={()=>exportCSV(team)}>⬇CSV</button>
        <button className="btn btn-ghost btn-sm" onClick={()=>setShowPin(!showPin)}>PIN</button>
        <button className="btn btn-danger btn-sm" onClick={()=>onRemove(team)}>✕</button>
      </div>
    </div>
    {showPin&&<div style={{marginTop:9,display:"flex",gap:6,alignItems:"center"}}>
      <input className="finput" style={{maxWidth:105}} placeholder="Nuevo PIN" maxLength={4} value={newPin} onChange={e=>setNewPin(e.target.value.replace(/\D/g,""))}/>
      <button className="btn btn-primary btn-sm" onClick={()=>{if(newPin.length===4){persist(teams.map(t=>t.id===team.id?{...t,pin:newPin}:t));setNewPin("");setShowPin(false);}}}>Cambiar</button>
    </div>}
  </div>;
}

function TeamDetailCoord({team,updateTeam,onBack}){
  const [tab,setTab]=useState("stats");
  if(!team)return null;
  return <div>
    <div className="back-btn" onClick={onBack}>← Equipos</div>
    <div style={{fontSize:17,fontWeight:700,marginBottom:2}}>{team.name}</div>
    <div style={{fontSize:12,color:"#6b7280",marginBottom:11}}>{team.category}</div>
    <button className="btn btn-ghost btn-sm" style={{marginBottom:12}} onClick={()=>exportCSV(team)}>⬇ Exportar CSV</button>
    <div className="tabs">
      <div className={`tab${tab==="sessions"?" active":""}`}  onClick={()=>setTab("sessions")}>Sesiones</div>
      <div className={`tab${tab==="players"?" active":""}`}   onClick={()=>setTab("players")}>Jugadores</div>
      <div className={`tab${tab==="stats"?" active":""}`}     onClick={()=>setTab("stats")}>Stats</div>
      <div className={`tab${tab==="notes"?" active":""}`}     onClick={()=>setTab("notes")}>Mensajes</div>
      <div className={`tab${tab==="planning"?" active":""}`}  onClick={()=>setTab("planning")}>Planif.</div>
      <div className={`tab${tab==="injuries"?" active":""}`}  onClick={()=>setTab("injuries")}>Lesiones</div>
      <div className={`tab${tab==="load"?" active":""}`}      onClick={()=>setTab("load")}>Carga</div>
      <div className={`tab${tab==="seasons"?" active":""}`}   onClick={()=>setTab("seasons")}>Temp.</div>
    </div>
    {tab==="sessions"  && <SessionsTab  team={team} updateTeam={updateTeam} hasRPE={RPE_CATS.includes(team.category)}/>}
    {tab==="players"   && <PlayersTab   team={team} updateTeam={updateTeam}/>}
    {tab==="stats"     && <StatsTab     team={team}/>}
    {tab==="notes"     && <NotesTab     team={team} updateTeam={updateTeam} isCoord={true}/>}
    {tab==="planning"  && <PlanningTab  team={team} updateTeam={updateTeam}/>}
    {tab==="injuries"  && <TeamInjuries team={team}/>}
    {tab==="load"      && <LoadTab      team={team}/>}
    {tab==="seasons"   && <SeasonsTab   team={team} updateTeam={updateTeam}/>}
  </div>;
}

function LoadTab({team}){
  const hasRPE=RPE_CATS.includes(team.category),dur=DURATION[team.category]||DURATION.default;
  if(!hasRPE)return<div className="empty"><div className="empty-icon">💪</div>Esta categoría no registra RPE</div>;
  const sessions=(team.sessions||[]).filter(s=>Object.keys(s.rpe||{}).length>0);
  const wkData={};
  sessions.forEach(s=>{
    const wk=getWeekKey(s.date); if(!wkData[wk])wkData[wk]={load:0,rpeSum:0,count:0};
    const rpes=Object.values(s.rpe||{}).filter(Boolean);
    if(rpes.length){const avg=rpes.reduce((a,b)=>a+b,0)/rpes.length;wkData[wk].load+=avg*dur;wkData[wk].rpeSum+=avg;wkData[wk].count++;}
  });
  const wkKeys=Object.keys(wkData).sort().slice(-12),maxL=Math.max(...wkKeys.map(k=>wkData[k].load),1);
  return <div>
    <div style={{fontSize:14,fontWeight:700,marginBottom:13}}>Carga semanal del equipo</div>
    {wkKeys.length<2&&<div className="alert alert-info">Se necesitan al menos 2 semanas con datos RPE</div>}
    {wkKeys.length>=2&&<div className="card">
      <div className="chart-wrap" style={{height:110}}>
        {wkKeys.map(wk=>{const d=wkData[wk],h=Math.round((d.load/maxL)*100),col=h>80?"#ef4444":h>50?"#eab308":"#22c55e";
          return<div key={wk} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center"}}>
            <div className="chart-bar" style={{height:`${h}%`,background:col,width:"100%"}}><span className="chart-val">{Math.round(d.load)}</span></div>
            <div className="chart-lbl">S{wk.split("-W")[1]}</div>
          </div>;
        })}
      </div>
      <div style={{display:"flex",gap:8,marginTop:10,flexWrap:"wrap"}}>
        {wkKeys.map(wk=><span key={wk} style={{fontSize:10,color:"#6b7280"}}>S{wk.split("-W")[1]}: RPE {wkData[wk].count?(wkData[wk].rpeSum/wkData[wk].count).toFixed(1):"—"}</span>)}
      </div>
    </div>}
    <div style={{fontSize:11,color:"#4b5563",marginTop:6}}>🟢 Baja · 🟡 Media · 🔴 Alta</div>
  </div>;
}

function PlanningTab({team,updateTeam}){
  const all=[...(team.sessions||[]),...(team.matches||[])];
  const months=[...new Set(all.map(s=>getMonthKey(s.date)))].sort((a,b)=>b.localeCompare(a));
  if(months.length===0)return<div className="empty"><div className="empty-icon">📅</div>Sin sesiones todavía</div>;
  return <div>{months.map(mk=>{
    const weeks=[...new Set(all.filter(s=>getMonthKey(s.date)===mk).map(s=>getWeekKey(s.date)))].sort((a,b)=>b.localeCompare(a));
    return<div key={mk} className="card">
      <div className="card-title">{fmtMonth(mk)}</div>
      <div style={{marginBottom:11}}><label className="flabel" style={{display:"block",marginBottom:4}}>Objetivos del mes</label>
        <textarea className="ftextarea" placeholder="Objetivos mensuales..." value={team.monthNotes?.[mk]||""} onChange={e=>updateTeam(team.id,t=>({...t,monthNotes:{...(t.monthNotes||{}),[mk]:e.target.value}}))}/>
      </div>
      {weeks.map(wk=><div key={wk} style={{marginBottom:9,paddingLeft:11,borderLeft:"2px solid #252836"}}>
        <div style={{fontSize:11,fontWeight:600,color:"#9ca3af",marginBottom:4}}>{fmtWeek(wk)}</div>
        <textarea className="ftextarea" style={{minHeight:46}} placeholder="Contenidos de la semana..." value={team.weekNotes?.[wk]||""} onChange={e=>updateTeam(team.id,t=>({...t,weekNotes:{...(t.weekNotes||{}),[wk]:e.target.value}}))}/>
      </div>)}
    </div>;
  })}</div>;
}

function TeamInjuries({team}){
  const injuries=[],seen=new Set();
  [...(team.sessions||[]),...(team.matches||[])].sort((a,b)=>b.date.localeCompare(a.date)).forEach(s=>{
    Object.entries(s.attendance||{}).forEach(([pid,a])=>{
      if(a.state!=="injured")return;
      const key=`${pid}_${a.injuryStart||s.date}`; if(seen.has(key))return; seen.add(key);
      const p=(team.players||[]).find(x=>x.id===pid);
      if(p) injuries.push({player:p.name,type:a.injuryType||"Sin especificar",start:a.injuryStart||s.date,end:a.injuryEnd,active:!a.injuryEnd});
    });
  });
  const active=injuries.filter(i=>i.active),past=injuries.filter(i=>!i.active);
  return<div>
    <div style={{fontSize:14,fontWeight:700,marginBottom:9}}>Activas ({active.length})</div>
    {active.length===0&&<div className="alert alert-info">Sin lesiones activas ✓</div>}
    {active.map((inj,i)=><div key={i} className="card-sm" style={{marginBottom:7,borderColor:"#f9731628"}}><div style={{fontWeight:600,fontSize:13}}>{inj.player} <span className="inj-tag">⚕ {inj.type}</span></div><div style={{fontSize:11,color:"#6b7280",marginTop:2}}>Desde {fmtDate(inj.start)}</div></div>)}
    {past.length>0&&<><div style={{fontSize:14,fontWeight:700,margin:"13px 0 8px"}}>Historial</div>
    {past.map((inj,i)=><div key={i} className="card-sm" style={{marginBottom:6}}><div style={{fontWeight:600,fontSize:13}}>{inj.player} · <span style={{color:"#9ca3af",fontWeight:400}}>{inj.type}</span></div><div style={{fontSize:11,color:"#6b7280"}}>{fmtDate(inj.start)} → {fmtDate(inj.end)}</div></div>)}</>}
  </div>;
}

function SeasonsTab({team,updateTeam}){
  const [confirm,setConfirm]=useState(false);
  const seasons=team.seasons||[];
  const archive=()=>{
    const y=new Date().getFullYear();
    const archived={id:genId(),name:`Temporada ${y-1}/${y}`,date:today(),sessions:team.sessions||[],matches:team.matches||[],weekNotes:team.weekNotes||{},monthNotes:team.monthNotes||{}};
    updateTeam(team.id,t=>({...t,seasons:[...(t.seasons||[]),archived],sessions:[],matches:[],weekNotes:{},monthNotes:{},coordinatorNotes:[]}));
    setConfirm(false);
  };
  return<div>
    {confirm&&<Confirm msg="¿Archivar temporada y empezar de cero? Los jugadores se mantienen." onOk={archive} onCancel={()=>setConfirm(false)}/>}
    <div className="card" style={{marginBottom:13}}>
      <div style={{fontWeight:600,fontSize:14,marginBottom:5}}>Temporada actual</div>
      <div style={{fontSize:12,color:"#6b7280",marginBottom:13}}>{(team.sessions||[]).length} entrenamientos · {(team.matches||[]).length} partidos</div>
      <button className="btn btn-danger btn-sm" onClick={()=>setConfirm(true)}>🗄️ Archivar y empezar nueva</button>
    </div>
    {seasons.length>0&&<><div style={{fontSize:14,fontWeight:700,marginBottom:9}}>Temporadas archivadas</div>
    {[...seasons].reverse().map(s=><div key={s.id} className="card-sm" style={{marginBottom:7}}>
      <div style={{fontWeight:600,fontSize:13}}>{s.name}</div>
      <div style={{fontSize:11,color:"#6b7280"}}>{fmtDate(s.date)} · {(s.sessions||[]).length} entrenos · {(s.matches||[]).length} partidos</div>
    </div>)}</>}
  </div>;
}

// ─── SCOUTING TAB (dentro de partido) ────────────────────────
function ScoutingTab({session,team,updateTeam}){
  const scout=session.scout||{};
  const [newPlayer,setNewPlayer]=useState({dorsal:"",name:"",notes:""});
  const setS=(field,val)=>updateTeam(team.id,t=>({...t,matches:t.matches.map(m=>m.id===session.id?{...m,scout:{...(m.scout||{}),[field]:val}}:m)}));
  const addScoutPlayer=()=>{
    if(!newPlayer.name.trim())return;
    const players=[...(scout.players||[]),{id:genId(),...newPlayer}];
    setS("players",players); setNewPlayer({dorsal:"",name:"",notes:""});
  };
  const removeScoutPlayer=id=>setS("players",(scout.players||[]).filter(p=>p.id!==id));

  return <div>
    <div className="card">
      <div className="card-title">🎯 Táctica rival</div>
      <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10}}>
        {TACTIC_PHASES.map(ph=><span key={ph} style={{background:"#2563eb18",color:"#93c5fd",border:"1px solid #2563eb28",borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:600}}>{ph}</span>)}
      </div>
      {TACTIC_PHASES.map(ph=><div key={ph} className="fg" style={{marginBottom:10}}>
        <label className="flabel">{ph}</label>
        <textarea className="ftextarea" style={{minHeight:52}} value={scout[ph]||""} onChange={e=>setS(ph,e.target.value)} placeholder={
          ph==="MCB"?"Cómo defienden con balón...":
          ph==="MSB"?"Cómo defienden sin balón, pressing...":
          ph==="Transiciones"?"Transiciones ofensivas y defensivas...":
          ph==="Sistema"?"Sistema de juego, variantes...":
          "Balón parado: córners, falta directa, saque de banda..."}/>
      </div>)}
      <div className="fg" style={{marginBottom:0}}>
        <label className="flabel">Fortalezas / Debilidades generales</label>
        <textarea className="ftextarea" value={scout.general||""} onChange={e=>setS("general",e.target.value)} placeholder="Resumen general del rival..."/>
      </div>
    </div>

    <div className="card">
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
        <div className="card-title" style={{marginBottom:0}}>👀 Jugadores a seguir</div>
      </div>
      <div style={{background:"#1c1f2e",borderRadius:9,padding:11,marginBottom:11}}>
        <div className="frow" style={{marginBottom:7}}>
          <div className="fg" style={{maxWidth:70}}><label className="flabel">Dorsal</label><input className="finput" style={{fontSize:12}} value={newPlayer.dorsal} onChange={e=>setNewPlayer({...newPlayer,dorsal:e.target.value})} placeholder="#"/></div>
          <div className="fg"><label className="flabel">Nombre</label><input className="finput" style={{fontSize:12}} value={newPlayer.name} onChange={e=>setNewPlayer({...newPlayer,name:e.target.value})} placeholder="Nombre del jugador"/></div>
        </div>
        <div className="fg" style={{marginBottom:7}}>
          <label className="flabel">Notas</label>
          <input className="finput" style={{fontSize:12}} value={newPlayer.notes} onChange={e=>setNewPlayer({...newPlayer,notes:e.target.value})} placeholder="Por qué lo seguimos..."/>
        </div>
        <button className="btn btn-primary btn-sm" onClick={addScoutPlayer}>+ Añadir</button>
      </div>
      {(scout.players||[]).length===0&&<div style={{fontSize:12,color:"#4b5563",textAlign:"center",padding:"8px 0"}}>Sin jugadores añadidos</div>}
      {(scout.players||[]).map(p=><div key={p.id} style={{display:"flex",alignItems:"center",gap:9,padding:"9px 0",borderBottom:"1px solid #1a1d2a"}}>
        <div style={{width:32,height:32,background:"#2563eb18",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:"#2563eb",flexShrink:0}}>#{p.dorsal||"?"}</div>
        <div style={{flex:1}}>
          <div style={{fontWeight:600,fontSize:13}}>{p.name}</div>
          {p.notes&&<div style={{fontSize:11,color:"#6b7280",marginTop:1}}>{p.notes}</div>}
        </div>
        <button className="btn btn-danger btn-xs" onClick={()=>removeScoutPlayer(p.id)}>✕</button>
      </div>)}
    </div>
  </div>;
}

// ─── SCOUT GLOBAL (coordinador) ───────────────────────────────
function ScoutGlobalView({teams}){
  const [filterTeam,setFilterTeam]=useState("all");
  const allScouts=[];
  teams.forEach(team=>{
    (team.matches||[]).forEach(m=>{
      (m.scout?.players||[]).forEach(p=>{
        allScouts.push({...p,rival:m.rival||"Sin rival",matchDate:m.date,teamName:team.name,teamCategory:team.category,matchId:m.id});
      });
    });
  });
  const filtered=filterTeam==="all"?allScouts:allScouts.filter(s=>s.teamName===filterTeam);
  filtered.sort((a,b)=>b.matchDate.localeCompare(a.matchDate));

  const byCategory={};
  filtered.forEach(s=>{if(!byCategory[s.teamCategory])byCategory[s.teamCategory]=[];byCategory[s.teamCategory].push(s);});

  return <div>
    <div className="sec-title">🔍 Jugadores a seguir</div>
    <div style={{marginBottom:14}}>
      <select className="fselect" value={filterTeam} onChange={e=>setFilterTeam(e.target.value)}>
        <option value="all">Todos los equipos</option>
        {teams.map(t=><option key={t.id} value={t.name}>{t.name}</option>)}
      </select>
    </div>
    {filtered.length===0&&<div className="empty"><div className="empty-icon">🔍</div>Sin jugadores scouting todavía</div>}
    {Object.entries(byCategory).map(([cat,players])=><div key={cat} className="card">
      <div className="card-title">{cat} ({players.length})</div>
      {players.map((p,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:"1px solid #1a1d2a"}}>
        <div style={{width:34,height:34,background:"#2563eb18",borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:"#2563eb",flexShrink:0}}>#{p.dorsal||"?"}</div>
        <div style={{flex:1}}>
          <div style={{fontWeight:600,fontSize:13}}>{p.name}</div>
          <div style={{fontSize:11,color:"#6b7280",marginTop:1}}>{p.rival} · {fmtDate(p.matchDate)} · {p.teamName}</div>
          {p.notes&&<div style={{fontSize:11,color:"#9ca3af",marginTop:1}}>{p.notes}</div>}
        </div>
        <span style={{background:"#22c55e18",color:"#22c55e",border:"1px solid #22c55e28",borderRadius:6,padding:"2px 7px",fontSize:10,fontWeight:600}}>Seguir</span>
      </div>)}
    </div>)}
  </div>;
}

// ─── MEETINGS COORD VIEW ──────────────────────────────────────
function MeetingsCoordView({teams,persist}){
  const [showForm,setShowForm]=useState(false);
  const [form,setForm]=useState({title:"",date:today(),time:"18:00",type:"Entrenadores",description:"",teamIds:[]});
  const [confirm,setConfirm]=useState(null);

  const allMeetings=[];
  teams.forEach(t=>(t.meetings||[]).forEach(m=>{if(!allMeetings.find(x=>x.id===m.id))allMeetings.push({...m,teamNames:teams.filter(tt=>(m.teamIds||[]).includes(tt.id)).map(tt=>tt.name)});}));
  allMeetings.sort((a,b)=>a.date.localeCompare(b.date));
  const upcoming=allMeetings.filter(m=>m.date>=today());
  const past=allMeetings.filter(m=>m.date<today());

  const toggleTeam=id=>setForm(f=>({...f,teamIds:f.teamIds.includes(id)?f.teamIds.filter(x=>x!==id):[...f.teamIds,id]}));

  const create=()=>{
    if(!form.title.trim()||!form.date||form.teamIds.length===0)return;
    const m={id:genId(),...form};
    persist(teams.map(t=>form.teamIds.includes(t.id)?{...t,meetings:[...(t.meetings||[]),m]}:t));
    setForm({title:"",date:today(),time:"18:00",type:"Entrenadores",description:"",teamIds:[]});
    setShowForm(false);
  };

  const remove=meeting=>{
    persist(teams.map(t=>({...t,meetings:(t.meetings||[]).filter(m=>m.id!==meeting.id)})));
    setConfirm(null);
  };

  const MeetingCard=({m})=><div className="card-sm" style={{marginBottom:8,borderColor:m.date===today()?"#2563eb40":"#252836"}}>
    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8}}>
      <div style={{flex:1}}>
        <div style={{fontWeight:600,fontSize:14}}>{m.title}</div>
        <div style={{fontSize:12,color:"#6b7280",marginTop:2}}>{fmtDate(m.date)}{m.time?` · ${m.time}`:""} · <span style={{color:"#a78bfa"}}>{m.type}</span></div>
        <div style={{fontSize:11,color:"#4b5563",marginTop:2}}>{m.teamNames?.join(", ")}</div>
        {m.description&&<div style={{fontSize:12,color:"#9ca3af",marginTop:4}}>{m.description}</div>}
      </div>
      <button className="btn btn-danger btn-xs" onClick={()=>setConfirm(m)}>✕</button>
    </div>
  </div>;

  return <div>
    {confirm&&<Confirm msg={`¿Eliminar la reunión "${confirm.title}"?`} onOk={()=>remove(confirm)} onCancel={()=>setConfirm(null)}/>}
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
      <div className="sec-title" style={{marginBottom:0}}>📅 Reuniones</div>
      <button className="btn btn-primary btn-sm" onClick={()=>setShowForm(!showForm)}>+ Nueva</button>
    </div>
    {showForm&&<div className="card">
      <div className="card-title">Nueva reunión</div>
      <div className="frow">
        <div className="fg"><label className="flabel">Título</label><input className="finput" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Reunión de coordinación..."/></div>
        <div className="fg" style={{maxWidth:110}}><label className="flabel">Tipo</label>
          <select className="fselect" value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>
            {MEETING_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>
      <div className="frow">
        <div className="fg"><label className="flabel">Fecha</label><input type="date" className="finput" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></div>
        <div className="fg" style={{maxWidth:100}}><label className="flabel">Hora</label><input type="time" className="finput" value={form.time} onChange={e=>setForm({...form,time:e.target.value})}/></div>
      </div>
      <div className="fg" style={{marginBottom:10}}>
        <label className="flabel">Descripción / Orden del día</label>
        <textarea className="ftextarea" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Puntos a tratar..."/>
      </div>
      <div className="fg" style={{marginBottom:12}}>
        <label className="flabel">Equipos convocados</label>
        <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:4}}>
          {teams.map(t=><button key={t.id} className="btn btn-sm"
            style={{background:form.teamIds.includes(t.id)?"#2563eb22":"#1c1f2e",border:`1px solid ${form.teamIds.includes(t.id)?"#2563eb":"#252836"}`,color:form.teamIds.includes(t.id)?"#2563eb":"#9ca3af"}}
            onClick={()=>toggleTeam(t.id)}>{t.name}</button>)}
        </div>
      </div>
      <div style={{display:"flex",gap:8}}>
        <button className="btn btn-primary btn-sm" onClick={create}>Crear</button>
        <button className="btn btn-outline btn-sm" onClick={()=>setShowForm(false)}>Cancelar</button>
      </div>
    </div>}
    {upcoming.length===0&&past.length===0&&<div className="empty"><div className="empty-icon">📅</div>Sin reuniones programadas</div>}
    {upcoming.length>0&&<><div style={{fontSize:14,fontWeight:700,marginBottom:10}}>Próximas ({upcoming.length})</div>
    {upcoming.map(m=><MeetingCard key={m.id} m={m}/>)}</>}
    {past.length>0&&<><div style={{fontSize:14,fontWeight:700,margin:"16px 0 10px",color:"#6b7280"}}>Pasadas</div>
    {past.map(m=><MeetingCard key={m.id} m={m}/>)}</>}
  </div>;
}

// ─── MEETINGS en calendario de entrenador ─────────────────────
// Injected into CalendarTab via allEvents

// ─── GOOGLE LOGIN SCREEN ──────────────────────────────────────
function GoogleLogin({onLogin}){
  const [email,setEmail]=useState("");
  const [pass,setPass]=useState("");
  const [err,setErr]=useState("");
  const [loading,setLoading]=useState(false);
  const submit=async()=>{
    if(!email||!pass)return;
    setLoading(true);setErr("");
    try{ await onLogin(email,pass); }
    catch(e){ setErr("Email o contraseña incorrectos"); setLoading(false); }
  };
  return <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#0d0f18",padding:24}}>
    <div style={{background:"#13161f",border:"1px solid #252836",borderRadius:22,padding:"44px 36px",width:"100%",maxWidth:380}}>
      <div style={{textAlign:"center",marginBottom:32}}>
        <div style={{width:56,height:56,background:"#2563eb",borderRadius:16,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,margin:"0 auto 16px"}}>⚽</div>
        <div style={{fontSize:22,fontWeight:700,marginBottom:6}}>Canet F.C.</div>
        <div style={{fontSize:13,color:"#6b7280"}}>Gestión de Asistencia</div>
      </div>
      <div style={{marginBottom:12}}>
        <label style={{fontSize:11,fontWeight:600,color:"#9ca3af",textTransform:"uppercase",letterSpacing:".5px",display:"block",marginBottom:5}}>Email</label>
        <input style={{background:"#1c1f2e",border:"1px solid #252836",borderRadius:9,padding:"10px 12px",color:"#e2e4f0",fontSize:14,width:"100%",outline:"none"}}
          type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@email.com"/>
      </div>
      <div style={{marginBottom:20}}>
        <label style={{fontSize:11,fontWeight:600,color:"#9ca3af",textTransform:"uppercase",letterSpacing:".5px",display:"block",marginBottom:5}}>Contraseña</label>
        <input style={{background:"#1c1f2e",border:"1px solid #252836",borderRadius:9,padding:"10px 12px",color:"#e2e4f0",fontSize:14,width:"100%",outline:"none"}}
          type="password" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} placeholder="••••••••"/>
      </div>
      {err&&<div style={{color:"#ef4444",fontSize:13,marginBottom:12,textAlign:"center"}}>{err}</div>}
      <button onClick={submit} disabled={loading} style={{width:"100%",background:"#2563eb",border:"none",borderRadius:12,padding:"14px",fontSize:15,fontWeight:600,color:"white",cursor:"pointer"}}>
        {loading?"Entrando...":"Entrar"}
      </button>
      <div style={{fontSize:11,color:"#4b5563",marginTop:14,textAlign:"center"}}>Solo usuarios autorizados por el club</div>
    </div>
  </div>;
}
