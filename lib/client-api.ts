const API_BASE=(import.meta.env.VITE_API_BASE_URL||"").replace(/\/$/,"");
type Session={token:string;expiresAt:number};
let memory:Session|null=null;
function session(){
 try{const saved=sessionStorage.getItem("my-field-atlas-session");if(saved)memory=JSON.parse(saved);}catch{}
 if(memory&&memory.expiresAt<=Date.now())clearSession();
 return memory;
}
function clearSession(){memory=null;try{sessionStorage.removeItem("my-field-atlas-session");}catch{}}
export function apiUrl(path:string){return path.startsWith("/api/")?API_BASE+path:path;}
export function assetUrl(path:string){return import.meta.env.BASE_URL+path.replace(/^\//,"");}
export async function api<T=Record<string,unknown>>(path:string,init:RequestInit={}):Promise<T> {
 if(!API_BASE&&!import.meta.env.DEV)throw new Error("The upload service is not connected yet. Configure VITE_API_BASE_URL and publish again.");
 const headers=new Headers(init.headers),current=session();if(current)headers.set("Authorization","Bearer "+current.token);
 const response=await fetch(apiUrl(path),{...init,headers,credentials:"omit"});
 let data;
 try{data=await response.json();}catch{throw new Error("The server did not respond correctly. Please try again.");}
 if(!response.ok){
  if(response.status===401){clearSession();window.dispatchEvent(new Event("atlas-session-expired"));}
  throw new Error(typeof data === "object" && data !== null && "error" in data && typeof data.error === "string" ? data.error : "The request failed. Please try again.");
 }
 if(path==="/api/access"&&init.method==="POST"){
  if(typeof data==="object"&&data!==null&&"sessionToken" in data&&"expiresAt" in data&&typeof data.sessionToken==="string"&&typeof data.expiresAt==="number"){
   memory={token:data.sessionToken,expiresAt:data.expiresAt};try{sessionStorage.setItem("my-field-atlas-session",JSON.stringify(memory));}catch{}
  }else if(typeof init.body==="string"&&JSON.parse(init.body).action==="lock")clearSession();
 }
 return data as T;
}
export const jsonRequest=(data:unknown):RequestInit=>({method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
export function fileSize(size:number) {return size>=1024*1024?(size/1024/1024).toFixed(1)+" MB":Math.max(1,Math.round(size/1024))+" KB";}
