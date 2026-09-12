import { ApiError, bodyJson, bucket, db, errorResponse, objectKey, requireWrite, requireProject, summaryOf, type TripRow } from "@/lib/server";
import { beginSchema } from "@/lib/validation";
import type { TripSummary } from "@/lib/types";
export const dynamic="force-dynamic";
export async function GET() {
  try {
    const result=await db().prepare("SELECT * FROM atlas_trips WHERE status='ready' ORDER BY created_at DESC").all<TripRow>();
    return Response.json({trips:result.results.map(summaryOf)},{headers:{"Cache-Control":"no-store"}});
  }catch(e){return errorResponse(e);}
}
export async function POST(request:Request) {
  try {
    await requireWrite(request);
    const parsed=beginSchema.safeParse(await bodyJson(request));
    if(!parsed.success)throw new ApiError("Check the project, file name, author, date, and file size.");
    await requireProject(parsed.data.projectId);
    const pending=await db().prepare("SELECT COUNT(*) AS n FROM atlas_trips WHERE status!='ready'").first<{n:number}>();
    if((pending?.n||0)>=20)throw new ApiError("There are too many unfinished uploads. Open Upload access to clear them.",409);
    const id=crypto.randomUUID(),now=new Date().toISOString();
    const metadata:TripSummary={...parsed.data,id,distance:0,pointCount:0,routeCount:0,photoCount:0,createdAt:now};
    const upload=await bucket().createMultipartUpload(objectKey(id,"original"),{httpMetadata:{contentType:/\.kmz$/i.test(parsed.data.fileName)?"application/vnd.google-earth.kmz":"application/xml"}});
    try {await db().prepare("INSERT INTO atlas_trips (id,status,summary,upload_id,created_at,project_id,author) VALUES (?,'draft',?,?,?,?,?)").bind(id,JSON.stringify(metadata),upload.uploadId,now,parsed.data.projectId,parsed.data.author).run();}
    catch(e){await upload.abort();throw e;}
    return Response.json({id},{status:201});
  }catch(e){return errorResponse(e);}
}
