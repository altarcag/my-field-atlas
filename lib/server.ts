import { env } from "cloudflare:workers";
import type { TripSummary } from "./types";
import { sessionDigest } from "./upload-auth";
export { hex, digest, constantEqual } from "./upload-auth";
export const db = () => {
  const database=env.DB;
  if(!database) throw new ApiError("Storage is temporarily unavailable. Please try again.",503);
  return database;
};
export const bucket = () => {
  const storage=env.BUCKET;
  if(!storage) throw new ApiError("File storage is temporarily unavailable. Please try again.",503);
  return storage;
};
export class ApiError extends Error { constructor(message:string,public status=400){super(message);} }
export function errorResponse(error:unknown) {
  if(error instanceof ApiError) return Response.json({error:error.message},{status:error.status});
  console.error("Field Atlas request failed",error);
  return Response.json({error:"The request could not be completed. Your original file is safe; please try again."},{status:500});
}
export function allowedOrigins(){return (env.ALLOWED_ORIGIN||"").split(",").map(origin=>origin.trim()).filter(Boolean);}
export function sameOrigin(request:Request) {
 const origin=request.headers.get("origin");
 if(origin && origin!==new URL(request.url).origin && !allowedOrigins().includes(origin))throw new ApiError("This website is not allowed to upload here.",403);
}
export function bearerToken(request:Request){return request.headers.get("authorization")?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];}
export const adminPassword=()=>env.ADMIN_PASSWORD||"";
export async function bodyBytes(request:Request,max:number) {
  if(Number(request.headers.get("content-length")||0)>max) throw new ApiError("This upload exceeds the request size limit.",413);
  const reader=request.body?.getReader();
  if(!reader) throw new ApiError("The request is empty.");
  const chunks:Uint8Array[]=[];let size=0;
  try {for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw new ApiError("This upload exceeds the request size limit.",413);}chunks.push(value);}}
  finally{reader.releaseLock();}
  const result=new Uint8Array(size);let off=0;for(const c of chunks){result.set(c,off);off+=c.length;}return result;
}
export async function bodyJson(request:Request,max=16384):Promise<unknown> {
  try {return JSON.parse(new TextDecoder().decode(await bodyBytes(request,max)));}catch(e){if(e instanceof ApiError)throw e;throw new ApiError("The request contains invalid JSON.");}
}
export const uploadPassword=()=>env.UPLOAD_PASSWORD||"";
export async function access(request:Request) {
 const token=bearerToken(request),secret=uploadPassword(),admin=adminPassword();
 if(!token)return {configured:!!secret,unlocked:false,isOwner:false};
 const uploadHash=secret?await sessionDigest(token,secret):"",adminHash=admin&&admin!==secret?await sessionDigest(token,admin):"";
 const session=await db().prepare("SELECT token FROM atlas_sessions WHERE token IN (?,?) AND expires>?").bind(uploadHash,adminHash,Date.now()).first<{token:string}>();
 return {configured:!!secret,unlocked:!!session,isOwner:!!session&&!!adminHash&&session.token===adminHash};
}
export async function requireWrite(request:Request) {
  sameOrigin(request);
  const state=await access(request);if(!state.unlocked)throw new ApiError(state.configured?"Enter the upload password to continue.":"Uploads are temporarily unavailable. Please contact the owner.",401);
  return state;
}
export type TripRow={id:string;project_id:string|null;author:string;status:string;summary:string;upload_id:string|null;created_at:string};
export async function tripRow(id:string) {
  if(!/^[a-f0-9-]{36}$/.test(id)) throw new ApiError("Trip not found.",404);
  const row=await db().prepare("SELECT * FROM atlas_trips WHERE id=?").bind(id).first<TripRow>();
  if(!row)throw new ApiError("Trip not found.",404);return row;
}
export const summaryOf=(row:TripRow)=>({...JSON.parse(row.summary),projectId:row.project_id,author:row.author||""}) as TripSummary;
export async function requireProject(id:string){
  const project=await db().prepare("SELECT id FROM atlas_projects WHERE id=?").bind(id).first();
  if(!project)throw new ApiError("Choose an existing project or create a new one.",404);
}
export const objectKey=(id:string,file:string)=>"trips/"+id+"/"+file;
export async function removeTrip(row:TripRow) {
  if(row.upload_id && row.status!=="ready") {
    try{await bucket().resumeMultipartUpload(objectKey(row.id,"original"),row.upload_id).abort();}catch{/* Completed or already aborted. */}
  }
  let cursor:string|undefined;
  do {
    const result=await bucket().list({prefix:"trips/"+row.id+"/",limit:1000,cursor});
    if(result.objects.length) await bucket().delete(result.objects.map(o=>o.key));
    cursor=result.truncated?result.cursor:undefined;
  }while(cursor);
  await db().prepare("DELETE FROM atlas_trips WHERE id=?").bind(row.id).run();
}
