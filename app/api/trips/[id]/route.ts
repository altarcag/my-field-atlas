import { bucket, errorResponse, objectKey, removeTrip, requireWrite, summaryOf, tripRow, ApiError, bodyJson, db, requireProject } from "@/lib/server";
import { fileDetailsSchema } from "@/lib/validation";
type Context={params:Promise<{id:string}>};
export const dynamic="force-dynamic";
export async function GET(_request:Request,ctx:Context) {
  try {
    const {id}=await ctx.params,row=await tripRow(id);
    if(row.status!=="ready")throw new ApiError("This trip is still uploading.",409);
    const data=await bucket().get(objectKey(id,"data.json"));
    if(!data)throw new ApiError("Trip data is temporarily unavailable.",503);
    return Response.json({...summaryOf(row),...await data.json() as object},{headers:{"Cache-Control":"no-store"}});
  }catch(e){return errorResponse(e);}
}
export async function DELETE(request:Request,ctx:Context) {
  try {
    const state=await requireWrite(request);
    const {id}=await ctx.params,row=await tripRow(id);
    if(new URL(request.url).searchParams.get("draft")==="true" && row.status==="ready")return Response.json({alreadySaved:true});
    if(row.status==="ready" && !state.isOwner)throw new ApiError("Only the owner can delete saved trips.",403);
    if(row.status==="finalizing")throw new ApiError("The trip is being saved. Try again shortly.",409);
    await removeTrip(row);return Response.json({ok:true});
  }catch(e){return errorResponse(e);}
}
export async function PATCH(request:Request,ctx:Context) {
 try {
  await requireWrite(request);
  const {id}=await ctx.params,row=await tripRow(id);
  if(row.status!=="ready")throw new ApiError("Wait until this file has finished uploading.",409);
  const parsed=fileDetailsSchema.safeParse(await bodyJson(request));
  if(!parsed.success)throw new ApiError("Check the project, file name, and author.");
  await requireProject(parsed.data.projectId);
  const summary={...summaryOf(row),...parsed.data};
  await db().prepare("UPDATE atlas_trips SET project_id=?,author=?,summary=? WHERE id=? AND status='ready'").bind(summary.projectId,summary.author,JSON.stringify(summary),id).run();
  return Response.json(summary);
 }catch(e){return errorResponse(e);}
}
