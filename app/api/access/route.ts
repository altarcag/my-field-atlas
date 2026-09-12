import { z } from "zod";
import { access, ApiError, bodyJson, db, digest, errorResponse, hex, sameOrigin, uploadPassword, adminPassword, bearerToken } from "@/lib/server";
import { passwordMatches, sessionDigest } from "@/lib/upload-auth";
export const dynamic="force-dynamic";
export async function GET(request:Request) {try{return Response.json(await access(request),{headers:{"Cache-Control":"no-store"}});}catch(e){return errorResponse(e);}}
export async function POST(request:Request) {
 try {
  sameOrigin(request);
  const data=z.object({action:z.enum(["unlock","lock"]),password:z.string().max(256).optional()}).safeParse(await bodyJson(request));
  if(!data.success)throw new ApiError("Choose unlock or lock uploads.");
  const secret=uploadPassword(),admin=adminPassword();
  if(data.data.action==="lock") {
   const token=bearerToken(request);
   if(token){
    const hashes=await Promise.all([secret,admin].filter(Boolean).map(value=>sessionDigest(token,value)));
    for(const hash of hashes)await db().prepare("DELETE FROM atlas_sessions WHERE token=?").bind(hash).run();
   }
   return Response.json({ok:true},{headers:{"Cache-Control":"no-store"}});
  }
  if(!secret)throw new ApiError("Uploads are temporarily unavailable. Please contact the owner.",503);
  const now=Date.now(),window=Math.floor(now/900000),ip=request.headers.get("cf-connecting-ip")||"shared";
  const key=await digest(ip+":"+window);
  await db().prepare("INSERT INTO atlas_attempts (key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1").bind(key,(window+1)*900000).run();
  const attempt=await db().prepare("SELECT count FROM atlas_attempts WHERE key=?").bind(key).first<{count:number}>();
  if((attempt?.count||0)>10)throw new ApiError("Too many attempts. Please try again in 15 minutes.",429);
  const isAdmin=!!admin&&admin!==secret&&await passwordMatches(data.data.password||"",admin);
  if(!isAdmin&&!await passwordMatches(data.data.password||"",secret))throw new ApiError("That password is incorrect.",401);
  const token=hex(crypto.getRandomValues(new Uint8Array(32)));
  await db().batch([
   db().prepare("INSERT INTO atlas_sessions (token,expires) VALUES (?,?)").bind(await sessionDigest(token,isAdmin?admin:secret),now+8*3600000),
   db().prepare("DELETE FROM atlas_sessions WHERE expires<?").bind(now),
   db().prepare("DELETE FROM atlas_attempts WHERE expires<? OR key=?").bind(now,key),
  ]);
  return Response.json({ok:true,sessionToken:token,expiresAt:now+8*3600000},{headers:{"Cache-Control":"no-store"}});
 }catch(e){return errorResponse(e);}
}
