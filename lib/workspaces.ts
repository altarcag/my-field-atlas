import type { Project, TripSummary } from "./types";
export type WorkspaceId="field-map"|"urg-2026";
export const workspaceHash=(workspace:WorkspaceId)=>"#/workspaces/"+workspace;
export function workspaceFromHash(hash:string):WorkspaceId|null {
 return hash==="#/workspaces/urg-2026"?"urg-2026":hash==="#/workspaces/field-map"?"field-map":null;
}
export function restoredProjectFiles(workspace:WorkspaceId,projects:Project[],files:TripSummary[],remembered:string|null):TripSummary[] {
 const allowed=workspace==="field-map"?files:files.filter(file=>projects.some(project=>project.id===file.projectId&&project.name.trim().toLowerCase()==="urg-2026"));
 const projectId=allowed.some(file=>file.projectId===remembered)?remembered:allowed[0]?.projectId;
 return projectId?allowed.filter(file=>file.projectId===projectId):allowed.filter(file=>!file.projectId);
}
export function readPreference(key:string):string|null {try{return localStorage.getItem("atlas:"+key);}catch{return null;}}
export function writePreference(key:string,value:string):void {try{localStorage.setItem("atlas:"+key,value);}catch{/* Browsing works when storage is unavailable. */}}
