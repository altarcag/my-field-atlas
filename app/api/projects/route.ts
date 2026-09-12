import { ApiError, bodyJson, db, errorResponse, requireWrite } from "@/lib/server";
import { projectSchema } from "@/lib/validation";
import type { Project } from "@/lib/types";
export const dynamic="force-dynamic";
export async function GET() {
 try {
  const result=await db().prepare("SELECT id,name,created_at AS createdAt FROM atlas_projects ORDER BY created_at DESC").all<Project>();
  return Response.json({projects:result.results},{headers:{"Cache-Control":"no-store"}});
 }catch(e){return errorResponse(e);}
}
export async function POST(request:Request) {
 try {
  await requireWrite(request);
  const parsed=projectSchema.safeParse(await bodyJson(request));
  if(!parsed.success)throw new ApiError("Give the project a name of up to 120 characters.");
  const project:Project={id:crypto.randomUUID(),name:parsed.data.name,createdAt:new Date().toISOString()};
  const result=await db().prepare("INSERT INTO atlas_projects (id,name,created_at) VALUES (?,?,?) ON CONFLICT(name) DO NOTHING").bind(project.id,project.name,project.createdAt).run();
  if(result.meta.changes!==1)throw new ApiError("A project with this name already exists. Select it from the project list.",409);
  return Response.json(project,{status:201});
 }catch(e){return errorResponse(e);}
}
