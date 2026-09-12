import * as access from "../app/api/access/route";
import * as projects from "../app/api/projects/route";
import * as trips from "../app/api/trips/route";
import * as file from "../app/api/trips/[id]/route";
import * as archive from "../app/api/trips/[id]/archive/route";
import * as photo from "../app/api/trips/[id]/photos/[photo]/route";
import * as complete from "../app/api/trips/[id]/complete/route";
import * as files from "../app/api/files/[id]/[...path]/route";
import * as uploads from "../app/api/uploads/route";
import { allowedOrigins, errorResponse, sameOrigin } from "../lib/server";
async function dispatch(request:Request):Promise<Response>{
 const {pathname}=new URL(request.url),method=request.method;
 if(pathname==="/api/health"&&method==="GET")return Response.json({ok:true,application:"my-field-atlas"});
 if(pathname==="/api/access"){if(method==="GET")return access.GET(request);if(method==="POST")return access.POST(request);}
 if(pathname==="/api/projects"){if(method==="GET")return projects.GET();if(method==="POST")return projects.POST(request);}
 if(pathname==="/api/trips"){if(method==="GET")return trips.GET();if(method==="POST")return trips.POST(request);}
 if(pathname==="/api/uploads"&&method==="DELETE")return uploads.DELETE(request);
 let match=pathname.match(/^\/api\/trips\/([a-f0-9-]{36})(?:\/(archive|complete|photos\/p[0-9]{1,3}\.jpg))?$/);
 if(match){const id=match[1],action=match[2],ctx={params:Promise.resolve({id})};
  if(!action){if(method==="GET")return file.GET(request,ctx);if(method==="PATCH")return file.PATCH(request,ctx);if(method==="DELETE")return file.DELETE(request,ctx);}
  if(action==="archive"&&method==="PUT")return archive.PUT(request,ctx);
  if(action==="complete"&&method==="POST")return complete.POST(request,ctx);
  if(action?.startsWith("photos/")&&method==="PUT")return photo.PUT(request,{params:Promise.resolve({id,photo:action.slice(7)})});
 }
 match=pathname.match(/^\/api\/files\/([a-f0-9-]{36})\/(original|photos\/p[0-9]{1,3}\.jpg)$/);
 if(match&&method==="GET")return files.GET(request,{params:Promise.resolve({id:match[1],path:match[2].split("/")})});
 return Response.json({error:"Endpoint not found."},{status:404});
}
export default {
 async fetch(request:Request):Promise<Response>{
  const origin=request.headers.get("origin"),allowed=origin&&allowedOrigins().includes(origin);
  let response:Response;
  try{sameOrigin(request);response=request.method==="OPTIONS"?new Response(null,{status:204}):await dispatch(request);}catch(error){response=errorResponse(error);}
  const headers=new Headers(response.headers);
  headers.set("X-Content-Type-Options","nosniff");headers.set("Vary","Origin");
  if(allowed){headers.set("Access-Control-Allow-Origin",origin);headers.set("Access-Control-Allow-Methods","GET, POST, PUT, PATCH, DELETE, OPTIONS");headers.set("Access-Control-Allow-Headers","Authorization, Content-Type");headers.set("Access-Control-Max-Age","600");}
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
 }
};
