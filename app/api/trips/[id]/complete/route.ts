import { z } from "zod";
import { ApiError, bodyJson, bucket, db, errorResponse, objectKey, requireWrite, summaryOf, tripRow } from "@/lib/server";
import { tripDataSchema } from "@/lib/validation";
import { routeDistance } from "@/lib/types";
export const dynamic="force-dynamic";
export async function POST(request:Request,ctx:{params:Promise<{id:string}>}) {
  let claimed:string|undefined;
  try {
    await requireWrite(request);const {id}=await ctx.params,row=await tripRow(id);
    if(row.status==="ready")return Response.json(summaryOf(row));
    if(row.status!=="draft"||!row.upload_id)throw new ApiError("This trip is already being finalized.",409);
    const parsed=z.object({data:tripDataSchema,parts:z.array(z.object({partNumber:z.number().int().min(1).max(103),etag:z.string().max(300)})).min(1).max(103)}).safeParse(await bodyJson(request,20*1024*1024));
    if(!parsed.success)throw new ApiError("The trip data could not be validated. Try exporting the file again.");
    const {data,parts}=parsed.data,summary=summaryOf(row);
    if(parts.length!==Math.ceil(summary.size/(5*1024*1024))||parts.some((p,i)=>p.partNumber!==i+1))throw new ApiError("Some upload chunks are missing.");
    const uploaded=new Set<string>();let cursor:string|undefined;
    do {const list=await bucket().list({prefix:objectKey(id,"photos/"),cursor});list.objects.forEach(o=>uploaded.add(o.key));cursor=list.truncated?list.cursor:undefined;}while(cursor);
    for(const point of data.points) for(const photo of point.photos) {
      const prefix="/api/files/"+id+"/photos/";
      if(photo.url.startsWith(prefix)) {
        const name=photo.url.slice(prefix.length);
        if(!/^p[0-9]{1,3}\.jpg$/.test(name)||!uploaded.has(objectKey(id,"photos/"+name)))throw new ApiError("An embedded photograph has not finished uploading.");
      } else {
        let u:URL;try{u=new URL(photo.url);}catch{throw new ApiError("A photo URL is invalid.");}
        if(u.protocol!=="https:" || u.username || u.password)throw new ApiError("External photos must use HTTPS.");
      }
    }
    const update=await db().prepare("UPDATE atlas_trips SET status='finalizing' WHERE id=? AND status='draft'").bind(id).run();
    if(update.meta.changes!==1)throw new ApiError("The trip is already being saved.",409);
    claimed=id;
    if(!await bucket().head(objectKey(id,"original")))await bucket().resumeMultipartUpload(objectKey(id,"original"),row.upload_id).complete(parts);
    const original=await bucket().head(objectKey(id,"original"));
    if(!original||original.size!==summary.size)throw new ApiError("The original file upload is incomplete.");
    await bucket().put(objectKey(id,"data.json"),JSON.stringify(data),{httpMetadata:{contentType:"application/json"}});
    const finished={...summary,distance:routeDistance(data.routes),routeCount:data.routes.length,pointCount:data.points.length,photoCount:data.points.reduce((n,p)=>n+p.photos.length,0),cover:data.points.find(p=>p.photos.length)?.photos[0].url};
    await db().prepare("UPDATE atlas_trips SET status='ready',summary=?,upload_id=NULL WHERE id=?").bind(JSON.stringify(finished),id).run();
    claimed=undefined;
    return Response.json(finished);
  }catch(e){
    if(claimed)try{await db().prepare("UPDATE atlas_trips SET status='draft' WHERE id=? AND status='finalizing'").bind(claimed).run();}catch{}
    return errorResponse(e);
  }
}
