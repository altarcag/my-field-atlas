import { ApiError, bodyBytes, bucket, errorResponse, objectKey, requireWrite, summaryOf, tripRow } from "@/lib/server";
export const dynamic="force-dynamic";
export async function PUT(request:Request,ctx:{params:Promise<{id:string}>}) {
  try {
    await requireWrite(request);
    const {id}=await ctx.params,row=await tripRow(id);
    if(row.status!=="draft"||!row.upload_id)throw new ApiError("This trip is no longer accepting upload chunks.",409);
    const part=Number(new URL(request.url).searchParams.get("part"));
    const expected=summaryOf(row).size,chunk=5*1024*1024,count=Math.ceil(expected/chunk);
    if(!Number.isInteger(part)||part<1||part>count)throw new ApiError("Invalid upload chunk.");
    const bytes=await bodyBytes(request,chunk),wanted=part===count?expected-(count-1)*chunk:chunk;
    if(bytes.length!==wanted)throw new ApiError("An upload chunk is incomplete. Please retry.");
    const uploaded=await bucket().resumeMultipartUpload(objectKey(id,"original"),row.upload_id).uploadPart(part,bytes);
    return Response.json(uploaded);
  }catch(e){return errorResponse(e);}
}
