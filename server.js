"use strict";
const express=require("express"),crypto=require("crypto"),fs=require("fs"),path=require("path");
const app=express();app.set("trust proxy",1);app.disable("x-powered-by");
app.use(express.json({limit:"8mb"}));

const DIR=process.env.DATA_DIR||path.join(__dirname,"data"),FILE=path.join(DIR,"db.json");
fs.mkdirSync(DIR,{recursive:true});
const SEED=[
 ["CleanBot X1","Uy",2890000,98,"Aqlli changyutgich robot, xarita tuzadi","#0f6b6b"],
 ["MopMate Pro","Uy",3490000,90,"Changyutadi va polni yuvadi","#2a7fba"],
 ["LawnGo 500","Uy",5900000,70,"Maysazor o'ruvchi robot","#5a9a3a"],
 ["Kodi Mini","Ta'lim",690000,95,"Bolalar uchun dasturlash roboti, 6+ yosh","#e08a00"],
 ["STEM Kit 120","Ta'lim",1250000,85,"120 detalli konstruktor, Arduino bilan","#8a4fd0"],
 ["Talker Owl","Ta'lim",890000,80,"Ingliz tilini o'rgatuvchi robot","#c0392b"],
 ["ArmBot M3","Sanoat",7800000,60,"3 o'qli robot qo'l, 500 g gacha yuk","#34495e"],
 ["Carry AGV","Sanoat",12500000,55,"Omborxona uchun yuk tashuvchi","#16a085"],
 ["Pet Buddy","O'yin",1450000,92,"Sezgir sensorli robot-it","#d35400"],
 ["Battle Duo","O'yin",1790000,88,"Telefondan boshqariladigan jang robotlari","#7f3fbf"],
 ["Sparky Mini","O'yin",390000,75,"Cho'ntak robot, raqs tushadi","#e84393"],
 ["Guard Eye","Uy",2100000,82,"Uyni kuzatuvchi harakatlanuvchi kamera","#2c3e50"]
].map((a,i)=>({id:i+1,code:"RB-"+String(i+1).padStart(2,"0"),n:a[0],c:a[1],pr:a[2],r:a[3],d:a[4],col:a[5],img:""}));
const hash=(p,s)=>crypto.scryptSync(String(p),s,32).toString("hex");
const mkAdmin=(u,p)=>{const s=crypto.randomBytes(16).toString("hex");return{u,s,h:hash(p,s)}};
let db={p:SEED,a:[],promo:[],o:[],tg:"",phone:"",card:"",holder:"",logo:""};
try{db=Object.assign(db,JSON.parse(fs.readFileSync(FILE,"utf8")))}catch(e){}
if(!db.a.length)db.a.push(mkAdmin(process.env.ADMIN_USER||"ibrohim",process.env.ADMIN_PASS||"2013"));
function save(){const t=FILE+".tmp";fs.writeFileSync(t,JSON.stringify(db));fs.renameSync(t,FILE)}
save();

/* auth */
const tokens=new Map(),TTL=12*3600e3,tries=new Map();
function auth(req,res,next){
  const t=(req.headers.authorization||"").replace("Bearer ","");const s=tokens.get(t);
  if(!s||s.exp<Date.now()){tokens.delete(t);return res.status(401).json({error:"Qayta kiring"})}
  req.user=s.u;next();
}
app.post("/api/login",(req,res)=>{
  const ip=req.ip,now=Date.now();let t=tries.get(ip)||{n:0,t:now};
  if(now-t.t>9e5)t={n:0,t:now};
  if(t.n>=10)return res.status(429).json({error:"Ko'p urinish"});
  const{u,p}=req.body||{};const a=db.a.find(x=>x.u===String(u||""));
  const ok=a&&crypto.timingSafeEqual(Buffer.from(hash(p||"",a.s)),Buffer.from(a.h));
  if(!ok){t.n++;tries.set(ip,t);return res.status(401).json({error:"Login yoki parol noto'g'ri"})}
  tries.delete(ip);
  const token=crypto.randomBytes(32).toString("hex");tokens.set(token,{u:a.u,exp:now+TTL});
  res.json({u:a.u,token});
});

/* public */
app.get("/",(q,r)=>r.sendFile(path.join(__dirname,"index.html")));
app.get("/healthz",(q,r)=>r.send("ok"));
app.get("/api/public",(q,r)=>r.json({p:db.p,tg:db.tg,phone:db.phone,logo:db.logo}));
const findPromo=c=>db.promo.find(x=>String(x.c).toUpperCase()===String(c||"").trim().toUpperCase());
app.post("/api/promo",(req,res)=>{const f=findPromo((req.body||{}).code);f?res.json({pct:f.pct}):res.status(404).json({error:"Bunday promokod yo'q"})});
app.post("/api/order",(req,res)=>{
  const b=req.body||{},name=String(b.name||"").trim().slice(0,80),phone=String(b.phone||"").replace(/[\s-]/g,""),addr=String(b.addr||"").trim().slice(0,200);
  if(!name||!/^\+?\d{9,13}$/.test(phone)||!addr)return res.status(400).json({error:"Ism, telefon va manzilni to'g'ri kiriting."});
  const items=[];let sum=0;
  for(const it of(Array.isArray(b.items)?b.items.slice(0,50):[])){
    const p=db.p.find(x=>x.id===Number(it.id)),q=Math.floor(Number(it.q));
    if(p&&q>=1&&q<=99){items.push({n:p.n,q,pr:p.pr});sum+=p.pr*q}
  }
  if(!items.length)return res.status(400).json({error:"Savat bo'sh."});
  const f=findPromo(b.code),pct=f?f.pct:0,total=sum-Math.round(sum*pct/100);
  let no;do{no=Math.floor(100000+Math.random()*900000)}while(db.o.some(o=>o.no===no));
  db.o.unshift({no,name,phone,addr,items,total,pct,date:new Date().toLocaleString("ru-RU",{timeZone:"Asia/Tashkent"}),done:false});
  db.o=db.o.slice(0,2000);save();
  res.json({no,total,card:db.card,holder:db.holder});
});

/* admin */
const img=s=>typeof s==="string"&&s.length<600000&&/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(s)?s:"";
const str=(s,n)=>String(s==null?"":s).trim().slice(0,n);
const adminList=()=>db.a.map(x=>({u:x.u}));
app.get("/api/admin/data",auth,(q,r)=>r.json({p:db.p,promo:db.promo,o:db.o,a:adminList(),tg:db.tg,phone:db.phone,card:db.card,holder:db.holder,logo:db.logo}));
app.put("/api/admin/all",auth,(req,res)=>{
  const b=req.body||{};
  if(!Array.isArray(b.p)||b.p.length>500||!Array.isArray(b.promo))return res.status(400).json({error:"Noto'g'ri ma'lumot"});
  db.p=b.p.map(p=>({id:Number(p.id)||Date.now(),code:str(p.code,30),n:str(p.n,100),c:str(p.c,40),d:str(p.d,300),pr:Math.max(0,Number(p.pr)||0),r:Number(p.r)||50,col:/^#[0-9a-f]{6}$/i.test(p.col)?p.col:"#0f6b6b",img:img(p.img)}));
  db.promo=b.promo.slice(0,200).map(x=>({c:str(x.c,30).toUpperCase(),pct:Math.min(90,Math.max(1,Math.round(Number(x.pct))||1))})).filter(x=>x.c);
  db.tg=str(b.tg,64).replace("@","");db.phone=str(b.phone,20).replace(/[^\d+]/g,"");db.card=str(b.card,20).replace(/\D/g,"");db.holder=str(b.holder,60);db.logo=img(b.logo);
  save();res.json({ok:true});
});
app.patch("/api/admin/orders/:no",auth,(req,res)=>{const o=db.o.find(x=>x.no===+req.params.no);if(!o)return res.status(404).json({error:"Topilmadi"});o.done=!!(req.body||{}).done;save();res.json({ok:true})});
app.delete("/api/admin/orders/:no",auth,(req,res)=>{db.o=db.o.filter(x=>x.no!==+req.params.no);save();res.json({ok:true})});
app.post("/api/admin/admins",auth,(req,res)=>{
  const u=str((req.body||{}).u,40),p=String((req.body||{}).p||"");
  if(!u||p.length<6||db.a.some(x=>x.u===u))return res.status(400).json({error:"Login bo'sh yoki band, yoki parol 6 belgidan qisqa."});
  db.a.push(mkAdmin(u,p));save();res.json({a:adminList()});
});
app.delete("/api/admin/admins/:u",auth,(req,res)=>{
  const u=req.params.u;
  if(u===req.user||db.a.length<2)return res.status(400).json({error:"Bu adminni o'chirib bo'lmaydi."});
  db.a=db.a.filter(x=>x.u!==u);save();res.json({a:adminList()});
});

app.use((q,r)=>r.status(404).json({error:"Topilmadi"}));
const PORT=process.env.PORT||3000;
app.listen(PORT,()=>console.log("RoboShop http://localhost:"+PORT));
