export const hex=(bytes:ArrayBuffer|Uint8Array)=>Array.from(new Uint8Array(bytes as ArrayBuffer)).map(b=>b.toString(16).padStart(2,"0")).join("");
export async function digest(value:string){return hex(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)));}
export function constantEqual(a:string,b:string){let difference=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)difference|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return difference===0;}
export async function passwordMatches(candidate:string,secret:string){return !!secret && constantEqual(await digest(candidate),await digest(secret));}
// Binding sessions to the server secret also invalidates them when it changes.
export async function sessionDigest(token:string,secret:string){
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 return hex(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode("field-atlas-upload-v2:"+token)));
}
