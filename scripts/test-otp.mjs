import {spawn} from 'node:child_process';
import {once} from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
const directory=path.resolve('verification-data/otp-'+Date.now());fs.mkdirSync(directory,{recursive:true});
const file=path.join(directory,'main.db'),base='http://127.0.0.1:4621/api';
const env={...process.env,PORT:'4621',DATABASE_FILE:file,SMS_PROVIDER:'mock',DEMO_SHOW_OTP:'true'};
let p;let db;let passed=0;
const start=()=>spawn(process.execPath,['--import','tsx','server/index.ts'],{env,stdio:'ignore'});
async function ready(){for(let i=0;i<100;i++){try{if((await fetch(base+'/auth/me')).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw Error('startup timeout');}
async function stop(){const done=once(p,'exit');p.kill();await done;}
function check(label,condition){if(!condition)throw Error('FAIL '+label);passed++;console.log('PASS '+label);}
async function req(route,body,cookie=''){const r=await fetch(base+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify(body):undefined});return {status:r.status,json:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]||''};}
const data={owner:'Test Owner',phone:'9000000101',password:'TestPassword123'};
const proof=r=>({challengeId:r.json.challengeId,code:r.json.demoOtp});
try{
 p=start();await ready();db=new Database(file);
 check('all non-auth API protected',(await req('/health')).status===401);
 check('non-Indian phone rejected',(await req('/auth/signup',{...data,phone:'+12025550123'})).status===400);
 let r=await req('/auth/signup',data);check('signup waits for OTP',r.status===202&&!r.cookie);check('six digit OTP',/^\d{6}$/.test(r.json.demoOtp));
 check('no user before verification',db.prepare('SELECT count(*) AS n FROM users').get().n===0);
 const row=db.prepare('SELECT * FROM otps WHERE id=?').get(r.json.challengeId);check('OTP stored hashed',row.hash!==r.json.demoOtp&&row.hash.length===64);check('pending password bcrypt hashed',JSON.parse(row.payload).password.startsWith('$2'));
 check('wrong OTP rejected',(await req('/auth/signup/verify',{...proof(r),code:r.json.demoOtp==='111111'?'222222':'111111'})).status===400);
 let a=await req('/auth/signup/verify',proof(r));check('verified signup succeeds',a.status===201);check('OTP single use',(await req('/auth/signup/verify',proof(r))).status===400);
 check('password stored bcrypt',db.prepare('SELECT password FROM users').get().password.startsWith('$2'));
 check('login works without OTP',(await req('/auth/login',{phone:data.phone,password:data.password})).status===200);
 check('wrong password denied',(await req('/auth/login',{phone:data.phone,password:'WrongPassword123'})).status===401);
 check('immediate resend denied',(await req('/auth/forgot-password',{phone:data.phone})).status===429);
 db.prepare('UPDATE otps SET created=created-31000').run();
 r=await req('/auth/forgot-password',{phone:data.phone});
 const other=await req('/auth/forgot-password',{phone:'9000000102'});check('forgot response does not enumerate',r.status===other.status&&r.json.message===other.json.message&&Object.keys(r.json).join()===Object.keys(other.json).join());
 const newPassword='ReplacementPassword123';check('reset succeeds',(await req('/auth/forgot-password/verify',{...proof(r),password:newPassword})).status===200);
 check('old session revoked',(await req('/bootstrap',undefined,a.cookie)).status===401);check('old password denied',(await req('/auth/login',{phone:data.phone,password:data.password})).status===401);check('new password accepted',(await req('/auth/login',{phone:data.phone,password:newPassword})).status===200);
 check('unknown phone reset identical success',(await req('/auth/forgot-password/verify',{...proof(other),password:newPassword})).status===200);
 r=await req('/auth/signup',{...data,phone:'9000000103'});db.prepare('UPDATE otps SET expires=? WHERE id=?').run(Date.now()-1,r.json.challengeId);check('expired OTP denied',(await req('/auth/signup/verify',proof(r))).status===400);
 r=await req('/auth/signup',{...data,phone:'9000000104'});for(let i=0;i<5;i++)await req('/auth/signup/verify',{...proof(r),code:r.json.demoOtp==='111111'?'222222':'111111'});
 check('five wrong attempts exhaust code',(await req('/auth/signup/verify',proof(r))).status===400);
 for(let i=0;i<5;i++){db.prepare('UPDATE otps SET created=created-31000 WHERE phone=?').run('+919000000105');r=await req('/auth/forgot-password',{phone:'9000000105'});check('hourly allowed send '+(i+1),r.status===202);}
 db.prepare('UPDATE otps SET created=created-31000 WHERE phone=?').run('+919000000105');check('sixth hourly send denied',(await req('/auth/forgot-password',{phone:'9000000105'})).status===429);
 await stop();env.DEMO_SHOW_OTP='false';p=start();await ready();r=await req('/auth/signup',{...data,phone:'9000000106'});check('OTP not exposed unless enabled',r.status===202&&!('demoOtp' in r.json));
 console.log(`${passed} OTP checks passed`);
}catch(e){console.error(e);process.exitCode=1;}finally{db?.close();if(p?.exitCode===null)await stop();}
