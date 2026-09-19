import { ApiError, bodyJson, db, errorResponse, requireWrite, requireProject, removeTrip, type TripRow } from "@/lib/server";
import { projectSchema } from "@/lib/validation";
import type { Project } from "@/lib/types";
export const dynamic="force-dynamic";
export async function GET() {
 try {
  const result=await db().prepare("SELECT id,name,workspace,created_at AS createdAt FROM atlas_projects ORDER BY created_at DESC").all<Project>();
  return Response.json({projects:result.results},{headers:{"Cache-Control":"no-store"}});
 }catch(e){return errorResponse(e);}
}
export async function POST(request:Request) {
 try {
  await requireWrite(request);
  const parsed=projectSchema.safeParse(await bodyJson(request));
  if(!parsed.success)throw new ApiError("Give the project a name of up to 120 characters.");
  const project:Project={id:crypto.randomUUID(),name:parsed.data.name,workspace:parsed.data.workspace??(parsed.data.name.toLowerCase()==="urg-2026"?"urg-2026":"field-map"),createdAt:new Date().toISOString()};
  const result=await db().prepare("INSERT INTO atlas_projects (id,name,workspace,created_at) VALUES (?,?,?,?) ON CONFLICT(name) DO NOTHING").bind(project.id,project.name,project.workspace,project.createdAt).run();
  if(result.meta.changes!==1)throw new ApiError("A project with this name already exists. Select it from the project list.",409);
  return Response.json(project,{status:201});
 }catch(e){return errorResponse(e);}
}

export async function DELETE(request:Request) {
 try {
  const state=await requireWrite(request);
  if(!state.isOwner)throw new ApiError("Only the owner can delete projects.",403);
  const id=new URL(request.url).searchParams.get("id")||"";
  await requireProject(id);
  const rows=await db().prepare("SELECT * FROM atlas_trips WHERE project_id=?").bind(id).all<TripRow>();
  if(rows.results.some(row=>row.status!=="ready"))throw new ApiError("Wait for uploads in this project to finish before deleting it.",409);
  for(const row of rows.results)await removeTrip(row);
  await db().prepare("DELETE FROM atlas_projects WHERE id=?").bind(id).run();
  return Response.json({ok:true});
 }catch(e){return errorResponse(e);}
}
