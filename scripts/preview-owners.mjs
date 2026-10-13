import {spawn} from 'node:child_process';
const child=spawn(process.execPath,['--import','tsx','server/index.ts'],{env:{...process.env,PORT:'4020',APP_ORIGINS:'http://localhost:4020,http://127.0.0.1:4020'},stdio:'inherit'});
child.on('exit',code=>process.exit(code||0));
setTimeout(async()=>{for(const route of ['/','/api/auth/me']){try{const r=await fetch('http://127.0.0.1:4020'+route);console.log('VERIFIED',route,r.status);}catch(e){console.error(e.message);}}},2000);
setInterval(()=>{},60000);
