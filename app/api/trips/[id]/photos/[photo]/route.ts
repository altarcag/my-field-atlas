import { ApiError, bodyBytes, bucket, errorResponse, objectKey, requireWrite, tripRow, summaryOf, db } from "@/lib/server";
export const dynamic="force-dynamic";
export async function PUT(request:Request,ctx:{params:Promise<{id:string;photo:string}>}) {
  try {
    await requireWrite(request);const {id,photo}=await ctx.params,row=await tripRow(id);
    if(row.status!=="draft")throw new ApiError("This trip is no longer accepting photographs.",409);
    if(!/^p(?:[0-9]{1,3})\.jpg$/.test(photo))throw new ApiError("Invalid photograph identifier.");
    const bytes=await bodyBytes(request,8*1024*1024);
    if(bytes.length<4 || bytes[0]!==255 || bytes[1]!==216 || bytes[2]!==255)throw new ApiError("Use a JPEG photograph.");
    await bucket().put(objectKey(id,"photos/"+photo),bytes,{httpMetadata:{contentType:"image/jpeg",cacheControl:"private, max-age=86400"}});
    return Response.json({ok:true});
  }catch(e){return errorResponse(e);}
}

// Removal edits the published import, not the archived source KMZ.
export async function DELETE(request:Request,ctx:{params:Promise<{id:string;photo:string}>}) {
 try {
  const state=await requireWrite(request);
  if(!state.isOwner)throw new ApiError("Only the owner can remove photographs.",403);
  const {id,photo}=await ctx.params,row=await tripRow(id);
  if(row.status!=="ready")throw new ApiError("Wait for this file to finish uploading.",409);
  if(!/^p[0-9]{1,3}\.jpg$/.test(photo))throw new ApiError("Invalid photograph identifier.");
  const object=await bucket().get(objectKey(id,"data.json"));
  if(!object)throw new ApiError("File data is unavailable.",503);
  const data=await object.json<import("@/lib/types").TripData>();
  const url="/api/files/"+id+"/photos/"+photo;
  if(!data.points.some(point=>point.photos.some(item=>item.url===url)))throw new ApiError("Photograph not found.",404);
  data.points=data.points.map(point=>({...point,photos:point.photos.filter(item=>item.url!==url)}));
  const photos=data.points.flatMap(point=>point.photos);
  const summary={...summaryOf(row),photoCount:photos.length,cover:photos[0]?.url};
  await bucket().put(objectKey(id,"data.json"),JSON.stringify(data),{httpMetadata:{contentType:"application/json"}});
  await db().prepare("UPDATE atlas_trips SET summary=? WHERE id=?").bind(JSON.stringify(summary),id).run();
  await bucket().delete(objectKey(id,"photos/"+photo));
  return Response.json({...summary,...data});
 }catch(e){return errorResponse(e);}
}
