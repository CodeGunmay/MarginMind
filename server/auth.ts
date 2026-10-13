import { Router } from 'express';
import Database from 'better-sqlite3';
import { randomBytes, randomUUID, randomInt, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { hashSync, compareSync } from 'bcryptjs';
import path from 'node:path';
import fs from 'node:fs';
import { z } from 'zod';
import { ENV } from './env';
import { restaurantDb, saveSettings } from './db';
import { tenantScope } from './tenant';
import { handle, ah } from './validate';
import { sendOtp, smsProvider } from './sms';

const accounts = new Database(path.resolve(ENV.DATABASE_FILE));
accounts.pragma('journal_mode = WAL'); accounts.pragma('foreign_keys = ON');
accounts.exec(`CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,phone TEXT UNIQUE NOT NULL,owner TEXT NOT NULL,password TEXT NOT NULL,created TEXT NOT NULL,verified INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,userId TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS otps(id TEXT PRIMARY KEY,phone TEXT NOT NULL,purpose TEXT NOT NULL,hash TEXT NOT NULL,payload TEXT,created INTEGER NOT NULL,expires INTEGER NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,used INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS auth_migrations(name TEXT PRIMARY KEY);
CREATE INDEX IF NOT EXISTS otp_phone_created ON otps(phone,created);`);
// Preserve previous owner accounts and sessions; upgrade their scrypt hashes on successful login.
const oldFile = path.join(path.dirname(path.resolve(ENV.DATABASE_FILE)), 'accounts.db');
if (fs.existsSync(oldFile) && !accounts.prepare('SELECT 1 FROM auth_migrations WHERE name=?').get('legacy-accounts')) {
 const old = new Database(oldFile, {readonly:true});
 accounts.transaction(() => {
  for (const u of old.prepare('SELECT * FROM users').all() as any[]) accounts.prepare('INSERT OR IGNORE INTO users(id,phone,owner,password,created) VALUES (?,?,?,?,?)').run(u.id,u.phone,u.owner,u.password,u.created);
  for (const s of old.prepare('SELECT * FROM sessions').all() as any[]) accounts.prepare('INSERT OR IGNORE INTO sessions VALUES (?,?,?)').run(s.hash,s.userId,s.expires);
  accounts.prepare('INSERT INTO auth_migrations VALUES (?)').run('legacy-accounts');
 })(); old.close();
}
const phone = z.string().transform(s => s.replace(/[\s()-]/g,'')) .transform(s => /^\d{10}$/.test(s) ? '+91'+s : s).pipe(z.string().regex(/^\+91[6-9]\d{9}$/, 'Enter a valid Indian mobile number (+91 and 10 digits)'));
const password = z.string().min(10,'Password must have at least 10 characters').max(72,'Password must be at most 72 bytes').refine(s=>Buffer.byteLength(s,'utf8')<=72,'Password must be at most 72 bytes');
const login = z.object({phone,password});
const signup = login.extend({owner:z.string().trim().min(2).max(100),restaurant:z.string().trim().min(2).max(120).optional(),location:z.string().trim().min(2).max(160).optional()});
const proof = z.object({challengeId:z.string().uuid(),code:z.string().regex(/^\d{6}$/,'Enter the 6-digit OTP')});
const digest = (s:string) => createHash('sha256').update(s).digest('hex');
function verifyPassword(value:string,encoded:string) {
 if(encoded.startsWith('$2')) return compareSync(value,encoded);
 const [salt,hash] = encoded.split(':'); if(!salt||!hash||hash.length!==128)return false;
 return timingSafeEqual(scryptSync(value,salt,64),Buffer.from(hash,'hex'));
}
function token(req:any) {return String(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('mm_session='))?.slice(11)||'';}
function current(req:any) {const row=accounts.prepare('SELECT u.id,u.phone,u.owner,u.verified FROM sessions s JOIN users u ON u.id=s.userId WHERE s.hash=? AND s.expires>?').get(digest(token(req)),Date.now()) as any;return row?{id:row.id,phone:row.phone,owner:row.owner,phoneVerified:!!row.verified}:null;}
function setSession(res:any,id:string) {const raw=randomBytes(32).toString('hex');accounts.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());accounts.prepare('INSERT INTO sessions VALUES (?,?,?)').run(digest(raw),id,Date.now()+7*86400000);res.cookie('mm_session',raw,{httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production',maxAge:7*86400000,path:'/'});}
const attempts=new Map<string,{count:number,until:number}>();
function limit(req:any,res:any,next:any) {const now=Date.now();for(const [k,v] of attempts)if(v.until<now)attempts.delete(k);const key=String(req.ip);const state=attempts.get(key)||{count:0,until:now+15*60000};state.count++;attempts.set(key,state);if(state.count>60)return res.status(429).json({error:'Too many authentication attempts. Try again in 15 minutes.'});next();}
export function sameOrigin(req:any,res:any,next:any) {
 if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.headers.origin){const allowed=(process.env.APP_ORIGINS||'http://localhost:5173,http://127.0.0.1:5173,http://localhost:5181,http://127.0.0.1:5181,http://localhost:4000,http://127.0.0.1:4000,http://localhost:4020,http://127.0.0.1:4020').split(',');if(!allowed.includes(req.headers.origin))return res.status(403).json({error:'Request origin is not allowed'});}next();
}
async function issue(body:any,purpose:'signup'|'reset',res:any) {
 const now=Date.now();
 accounts.prepare('UPDATE otps SET payload=NULL,used=1 WHERE expires<=? AND used=0').run(now);
 const recent=accounts.prepare('SELECT COUNT(*) AS count,MAX(created) AS last FROM otps WHERE phone=? AND created>?').get(body.phone,now-3600000) as any;
 const retryAfter=recent.count>=5?3600:recent.last&&now-recent.last<30000?Math.ceil((30000-now+recent.last)/1000):0;
 if(retryAfter){res.set('Retry-After',String(retryAfter));return res.status(429).json({error:recent.count>=5?'OTP limit reached. Try again in one hour.':'Wait 30 seconds before requesting another OTP.',retryAfter});}
 const id=randomUUID(),code=String(randomInt(100000,1000000));
 const payload=purpose==='signup'?JSON.stringify({...body,password:hashSync(body.password,12)}):null;
 // Reserve the send before awaiting a provider, so concurrent requests cannot bypass limits.
 accounts.transaction(()=>{
  accounts.prepare('UPDATE otps SET used=1,payload=NULL WHERE phone=? AND purpose=?').run(body.phone,purpose);
  accounts.prepare('INSERT INTO otps(id,phone,purpose,hash,payload,created,expires) VALUES (?,?,?,?,?,?,?)').run(id,body.phone,purpose,digest(id+':'+code),payload,now,now+300000);
 })();
 try {await sendOtp(body.phone,code);} catch {accounts.prepare('UPDATE otps SET used=1,payload=NULL WHERE id=?').run(id);return res.status(503).json({error:'SMS sending is unavailable. Please try again later.'});}
 const demo=smsProvider()==='mock'&&process.env.DEMO_SHOW_OTP==='true';
 // Identical response and mock behaviour for registered and unregistered recovery numbers.
 res.status(202).json({challengeId:id,expiresIn:300,resendAfter:30,message:purpose==='reset'?'If this number has an account, use the verification code to reset its password.':'Enter the verification code.',...(demo?{demoOtp:code}: {})});
}
function consume(body:any,purpose:string) {
 const row=accounts.prepare('SELECT * FROM otps WHERE id=? AND purpose=?').get(body.challengeId,purpose) as any;
 if(!row||row.used||row.expires<=Date.now()||row.attempts>=5) return null;
 if(!timingSafeEqual(Buffer.from(row.hash,'hex'),Buffer.from(digest(row.id+':'+body.code),'hex'))){accounts.prepare('UPDATE otps SET attempts=attempts+1,used=CASE WHEN attempts>=4 THEN 1 ELSE used END,payload=CASE WHEN attempts>=4 THEN NULL ELSE payload END WHERE id=?').run(row.id);return null;}
 accounts.prepare('UPDATE otps SET used=1,payload=NULL WHERE id=?').run(row.id);return row;
}
export const auth=Router();auth.use(sameOrigin);
auth.get('/me',(req,res)=>res.json({user:current(req)}));
auth.post('/signup',limit,handle(signup),ah(async(req:any,res:any)=>{
 if(accounts.prepare('SELECT id FROM users WHERE phone=?').get(req.body.phone))return res.status(409).json({error:'This phone already has an account. Sign in instead.'});
 await issue(req.body,'signup',res);
}));
auth.post('/signup/verify',limit,handle(proof),(req:any,res:any)=>{
 let user:any;
 accounts.transaction(()=>{
  const otp=consume(req.body,'signup');if(!otp)return;
  const data=JSON.parse(otp.payload);if(accounts.prepare('SELECT id FROM users WHERE phone=?').get(otp.phone))return;
  const id=randomUUID();tenantScope.run(restaurantDb(id),()=>saveSettings({restaurant:data.restaurant||data.owner+"'s restaurant",location:data.location||''}));
  accounts.prepare('INSERT INTO users VALUES (?,?,?,?,?,1)').run(id,otp.phone,data.owner,data.password,new Date().toISOString());
  user={id,phone:otp.phone,owner:data.owner,phoneVerified:true};
 })();
 if(!user)return res.status(400).json({error:'OTP is invalid, expired or exhausted. Request a new code.'});setSession(res,user.id);res.status(201).json({user});
});
const dummy=hashSync('unused-timing-padding',12);
auth.post('/login',limit,handle(login),(req:any,res:any)=>{
 const user=accounts.prepare('SELECT * FROM users WHERE phone=?').get(req.body.phone) as any;
 if(!verifyPassword(req.body.password,user?.password||dummy)||!user)return res.status(401).json({error:'Phone number or password is incorrect.'});
 if(!user.password.startsWith('$2'))accounts.prepare('UPDATE users SET password=? WHERE id=?').run(hashSync(req.body.password,12),user.id);
 setSession(res,user.id);res.json({user:{id:user.id,phone:user.phone,owner:user.owner,phoneVerified:!!user.verified}});
});
auth.post('/forgot-password',limit,handle(z.object({phone})),ah(async(req:any,res:any)=>{await issue(req.body,'reset',res);}));
auth.post('/forgot-password/verify',limit,handle(proof.extend({password})),(req:any,res:any)=>{
 const encoded=hashSync(req.body.password,12);let valid=false;
 accounts.transaction(()=>{const otp=consume(req.body,'reset');if(!otp)return;valid=true;
  const user=accounts.prepare('SELECT id FROM users WHERE phone=?').get(otp.phone) as any;
  if(user){accounts.prepare('UPDATE users SET password=?,verified=1 WHERE id=?').run(encoded,user.id);accounts.prepare('DELETE FROM sessions WHERE userId=?').run(user.id);}
 })();
 if(!valid)return res.status(400).json({error:'OTP is invalid, expired or exhausted. Request a new code.'});res.clearCookie('mm_session',{path:'/',httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production'});res.json({ok:true,message:'If an account exists, its password has been updated. Sign in to continue.'});
});
auth.post('/logout',(req,res)=>{accounts.prepare('DELETE FROM sessions WHERE hash=?').run(digest(token(req)));res.clearCookie('mm_session',{path:'/',httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production'});res.json({ok:true});});
export function requireAccount(req:any,res:any,next:any) {const user=current(req);if(!user)return res.status(401).json({error:'Sign in to access your restaurant.'});req.user=user;tenantScope.run(restaurantDb(user.id),next);}
