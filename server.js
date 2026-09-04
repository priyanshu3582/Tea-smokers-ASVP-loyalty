
const express=require("express");
const path=require("path");
const crypto=require("crypto");
const QRCode=require("qrcode");
const jwt=require("jsonwebtoken");
const bcrypt=require("bcryptjs");
const Database=require("better-sqlite3");

const app=express(), PORT=process.env.PORT||3000;
const BASE_URL=process.env.BASE_URL||`http://localhost:${PORT}`;
const SECRET=process.env.JWT_SECRET||"dev-only-change-me";
const db=new Database(path.join(__dirname,"tea-smokers.db"));
db.pragma("journal_mode=WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS customers(
 id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,phone TEXT NOT NULL UNIQUE,
 stamps INTEGER NOT NULL DEFAULT 0,total_spent INTEGER NOT NULL DEFAULT 0,
 rewards_earned INTEGER NOT NULL DEFAULT 0,rewards_redeemed INTEGER NOT NULL DEFAULT 0,
 token TEXT NOT NULL UNIQUE,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS visits(
 id INTEGER PRIMARY KEY AUTOINCREMENT,customer_id INTEGER NOT NULL,bill_amount INTEGER NOT NULL,
 stamps_added INTEGER NOT NULL,reward_unlocked INTEGER NOT NULL DEFAULT 0,
 staff TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);
app.use(express.json({limit:"1mb"}));
app.use(express.static(path.join(__dirname,"public")));

function phone(v){return String(v||"").replace(/\D/g,"").replace(/^91/,"").slice(-10)}
function pub(c){return {id:c.id,name:c.name,phone:c.phone,stamps:c.stamps,total_spent:c.total_spent,rewards_earned:c.rewards_earned,rewards_redeemed:c.rewards_redeemed,token:c.token}}
function auth(req,res,next){
 const h=req.headers.authorization||"";
 try{req.user=jwt.verify(h.replace("Bearer ",""),SECRET);next()}catch(e){return res.status(401).json({error:"Staff login required"})}
}
async function sendWhatsApp(to,text){
 const token=process.env.WHATSAPP_TOKEN, id=process.env.WHATSAPP_PHONE_NUMBER_ID;
 if(!token||!id) return {sent:false,reason:"WhatsApp API not configured"};
 const version=process.env.WHATSAPP_GRAPH_VERSION||"v23.0";
 const r=await fetch(`https://graph.facebook.com/${version}/${id}/messages`,{
   method:"POST",headers:{"Authorization":`Bearer ${token}`,"Content-Type":"application/json"},
   body:JSON.stringify({messaging_product:"whatsapp",to:"91"+to,type:"text",text:{body:text}})
 });
 return {sent:r.ok,status:r.status};
}
app.post("/api/staff/login",async(req,res)=>{
 const u=String(req.body.username||""), p=String(req.body.password||"");
 if(u!==process.env.ADMIN_USER || p!==process.env.ADMIN_PASSWORD) return res.status(401).json({error:"Invalid staff credentials"});
 res.json({token:jwt.sign({user:u},SECRET,{expiresIn:"12h"})});
});
app.get("/api/customer/:token",(req,res)=>{
 const c=db.prepare("SELECT * FROM customers WHERE token=?").get(req.params.token);
 if(!c)return res.status(404).json({error:"Customer not found"});
 res.json(pub(c));
});
app.post("/api/customers",async(req,res)=>{
 const name=String(req.body.name||"").trim(), ph=phone(req.body.phone);
 if(!name||ph.length!==10)return res.status(400).json({error:"Enter valid name and 10-digit mobile number"});
 let c=db.prepare("SELECT * FROM customers WHERE phone=?").get(ph);
 if(!c){
   const token=crypto.randomBytes(20).toString("hex");
   const x=db.prepare("INSERT INTO customers(name,phone,token) VALUES(?,?,?)").run(name,ph,token);
   c=db.prepare("SELECT * FROM customers WHERE id=?").get(x.lastInsertRowid);
 } else {
   db.prepare("UPDATE customers SET name=? WHERE id=?").run(name,c.id);
   c=db.prepare("SELECT * FROM customers WHERE id=?").get(c.id);
 }
 const msg=`Hi ${c.name}! ☕ Welcome to Tea Smokers Loyalty. Your card is ready. ₹150 spent = 1 stamp and 10 stamps = ₹150 OFF.`;
 let wa={sent:false};
 try{wa=await sendWhatsApp(c.phone,msg)}catch(e){}
 res.json({customer:pub(c),cardUrl:`${BASE_URL}/?customer=${c.token}`,whatsapp:wa});
});
app.get("/api/qr/:token",async(req,res)=>{
 const c=db.prepare("SELECT token FROM customers WHERE token=?").get(req.params.token);
 if(!c)return res.status(404).send("Not found");
 res.type("png").send(await QRCode.toBuffer(`${BASE_URL}/?customer=${c.token}`,{width:800,margin:2,errorCorrectionLevel:"H"}));
});
app.get("/api/customer/:token/visits",(req,res)=>{
 const c=db.prepare("SELECT id FROM customers WHERE token=?").get(req.params.token);
 if(!c)return res.status(404).json({error:"Customer not found"});
 res.json(db.prepare("SELECT bill_amount,stamps_added,reward_unlocked,created_at FROM visits WHERE customer_id=? ORDER BY id DESC LIMIT 30").all(c.id));
});
app.get("/api/admin/customers",auth,(req,res)=>{
 const rows=db.prepare("SELECT * FROM customers ORDER BY id DESC").all().map(pub);res.json(rows)
});
app.get("/api/admin/stats",auth,(req,res)=>{
 const s=db.prepare("SELECT COUNT(*) customers,COALESCE(SUM(total_spent),0) revenue,COALESCE(SUM(stamps),0) active_stamps,COALESCE(SUM(rewards_earned),0) rewards FROM customers").get();
 const today=db.prepare("SELECT COUNT(*) visits,COALESCE(SUM(bill_amount),0) sales,COALESCE(SUM(stamps_added),0) stamps FROM visits WHERE date(created_at)=date('now','localtime')").get();
 res.json({all:s,today});
});
app.post("/api/admin/stamps",auth,async(req,res)=>{
 const ph=phone(req.body.phone), bill=Math.floor(Number(req.body.billAmount));
 if(ph.length!==10||!Number.isFinite(bill)||bill<150)return res.status(400).json({error:"Minimum bill ₹150"});
 const c=db.prepare("SELECT * FROM customers WHERE phone=?").get(ph);
 if(!c)return res.status(404).json({error:"Customer not found"});
 const earned=Math.floor(bill/150), total=c.stamps+earned, unlocked=Math.floor(total/10), newStamps=total%10;
 db.transaction(()=>{
   db.prepare("UPDATE customers SET stamps=?,total_spent=total_spent+?,rewards_earned=rewards_earned+? WHERE id=?").run(newStamps,bill,unlocked,c.id);
   db.prepare("INSERT INTO visits(customer_id,bill_amount,stamps_added,reward_unlocked,staff) VALUES(?,?,?,?,?)").run(c.id,bill,earned,unlocked,req.user.user);
 })();
 const updated=db.prepare("SELECT * FROM customers WHERE id=?").get(c.id);
 let msg=`☕ Tea Smokers: ${earned} stamp(s) added! You now have ${updated.stamps}/10 stamps.`;
 if(unlocked)msg+=` 🎉 ${unlocked} reward unlocked: ₹150 OFF.`;
 let wa={sent:false};try{wa=await sendWhatsApp(c.phone,msg)}catch(e){}
 res.json({customer:pub(updated),earned,rewardsUnlocked:unlocked,whatsapp:wa});
});
app.post("/api/admin/redeem",auth,(req,res)=>{
 const ph=phone(req.body.phone),c=db.prepare("SELECT * FROM customers WHERE phone=?").get(ph);
 if(!c)return res.status(404).json({error:"Customer not found"});
 if(c.rewards_earned<=c.rewards_redeemed)return res.status(400).json({error:"No ₹150 reward available"});
 db.prepare("UPDATE customers SET rewards_redeemed=rewards_redeemed+1 WHERE id=?").run(c.id);
 res.json({customer:pub(db.prepare("SELECT * FROM customers WHERE id=?").get(c.id)),redeemed:150});
});
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,()=>console.log(`Tea Smokers Loyalty: ${BASE_URL}`));
