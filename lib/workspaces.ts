import type { Project, TripSummary } from "./types";
export type WorkspaceId="field-map"|"urg-2026";
export function projectWorkspace(project:Project):WorkspaceId {
 return project.workspace ?? (project.name.trim().toLowerCase()==="urg-2026"?"urg-2026":"field-map");
}
// My Field Map retains its existing all-projects overview.
export function projectsInWorkspace(workspace:WorkspaceId,projects:Project[]):Project[] {
 return workspace==="field-map"?projects:projects.filter(project=>projectWorkspace(project)===workspace);
}
export function workspaceUploadProject(workspace:WorkspaceId,projects:Project[],preferred:string|null):string|null {
 const allowed=projectsInWorkspace(workspace,projects);
 return allowed.find(project=>project.id===preferred)?.id ?? allowed[0]?.id ?? null;
}
export function workspacePath(workspace:WorkspaceId,base="/my-field-atlas/"):string {
 const root=base.endsWith("/")?base:base+"/";
 return workspace==="urg-2026"?root+"urg-2026/":root;
}
export function workspaceFromPath(pathname:string):WorkspaceId|null {
 const path=pathname.replace(/\/+$/,"")||"/";
 if(path.endsWith("/urg-2026"))return "urg-2026";
 if(path==="/"||path.endsWith("/my-field-atlas"))return "field-map";
 return null;
}
// Preserve old shared links and saved preferences while clean URLs replace hash routing.
export const workspaceHash=(workspace:WorkspaceId)=>"#/workspaces/"+workspace;
export function workspaceFromHash(hash:string):WorkspaceId|null {
 return hash==="#/workspaces/urg-2026"?"urg-2026":hash==="#/workspaces/field-map"?"field-map":null;
}
export function restoredProjectFiles(workspace:WorkspaceId,projects:Project[],files:TripSummary[],remembered:string|null):TripSummary[] {
 const allowed=workspace==="field-map"?files:files.filter(file=>projectsInWorkspace(workspace,projects).some(project=>project.id===file.projectId));
 const projectId=allowed.some(file=>file.projectId===remembered)?remembered:allowed[0]?.projectId;
 return projectId?allowed.filter(file=>file.projectId===projectId):allowed.filter(file=>!file.projectId);
}
export function readPreference(key:string):string|null {try{return localStorage.getItem("atlas:"+key);}catch{return null;}}
export function writePreference(key:string,value:string):void {try{localStorage.setItem("atlas:"+key,value);}catch{/* Browsing works when storage is unavailable. */}}
