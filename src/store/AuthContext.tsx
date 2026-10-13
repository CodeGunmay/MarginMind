import React,{createContext,useContext,useEffect,useState} from 'react';
interface User {id:string;phone:string;owner:string;phoneVerified:boolean;}
const Context=createContext<{user:User|null;loading:boolean;setUser:(u:User|null)=>void;logout:()=>Promise<void>}>({user:null,loading:true,setUser:()=>{},logout:async()=>{}});
export const useAuth=()=>useContext(Context);
export async function authRequest(path:string,body?:unknown){
 const res=await fetch('/api/auth/'+path,{method:body?'POST':'GET',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
 const data=await res.json();if(!res.ok)throw new Error(data.error||'Unable to sign in');return data;
}
export function AuthProvider({children}:{children:React.ReactNode}){
 const [user,setUser]=useState<User|null>(null),[loading,setLoading]=useState(true);
 useEffect(()=>{let live=true;authRequest('me').then(r=>{if(live)setUser(r.user);}).catch(()=>{}).finally(()=>{if(live)setLoading(false);});const expired=()=>setUser(null);window.addEventListener('mm-session-expired',expired);return()=>{live=false;window.removeEventListener('mm-session-expired',expired);};},[]);
 async function logout(){await authRequest('logout',{});setUser(null);}
 return <Context.Provider value={{user,loading,setUser,logout}}>{children}</Context.Provider>;
}
