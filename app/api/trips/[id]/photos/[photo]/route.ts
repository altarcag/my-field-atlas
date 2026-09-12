import { ApiError, bodyBytes, bucket, errorResponse, objectKey, requireWrite, tripRow } from "@/lib/server";
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
