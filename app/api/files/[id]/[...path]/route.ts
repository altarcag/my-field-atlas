import { ApiError, bucket, errorResponse, objectKey, summaryOf, tripRow } from "@/lib/server";
export const dynamic="force-dynamic";
export async function GET(_request:Request,ctx:{params:Promise<{id:string;path:string[]}>}) {
  try {
    const {id,path}=await ctx.params,row=await tripRow(id),file=path.join("/");
    if(row.status!=="ready")throw new ApiError("File not available.",404);
    if(file!=="original"&&!/^photos\/p[0-9]{1,3}\.jpg$/.test(file))throw new ApiError("File not found.",404);
    const object=await bucket().get(objectKey(id,file));if(!object)throw new ApiError("File not found.",404);
    const headers=new Headers({"X-Content-Type-Options":"nosniff","Cache-Control":"private, max-age=3600"});
    object.writeHttpMetadata(headers);
    if(file==="original")headers.set("Content-Disposition","attachment; filename*=UTF-8''"+encodeURIComponent(summaryOf(row).fileName));
    if(file.startsWith("photos/")&&new URL(_request.url).searchParams.get("download")==="1"){
      const requested=new URL(_request.url).searchParams.get("name")||file.split("/").pop()!;
      const base=requested.replace(/[^\p{L}\p{N} ._-]/gu,"_").slice(0,180).replace(/\.[^.]+$/,"")||"photo";
      headers.set("Content-Disposition","attachment; filename*=UTF-8''"+encodeURIComponent(base+".jpg").replace(/'/g,"%27"));
      headers.set("Cache-Control","no-store");
    }
    headers.set("ETag",object.httpEtag);
    return new Response(object.body,{headers});
  }catch(e){return errorResponse(e);}
}
