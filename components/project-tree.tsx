"use client";
import { useState } from "react";
import { Trash2, Camera, ChevronDown, ChevronRight, FolderOpen, LoaderCircle, Plus, Route, UserRound } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import type { ProjectGroup } from "@/lib/projects";
import { groupVisibility } from "@/lib/projects";
import type { TripSummary } from "@/lib/types";
type Props={groups:ProjectGroup[];visible:Set<string>;selectedId:string|null;loadingIds:Set<string>;onToggle:(id:string,show:boolean)=>void;onToggleProject:(files:TripSummary[],show:boolean)=>void;onSelect:(id:string)=>void;onAdd:(projectId:string)=>void;onEdit:(file:TripSummary)=>void;onDeleteFile:(id:string)=>void;onDeleteProject:(id:string)=>void;canEdit:boolean};
export default function ProjectTree({groups,visible,selectedId,loadingIds,onToggle,onToggleProject,onSelect,onAdd,onEdit,canEdit,onDeleteFile,onDeleteProject}:Props){
 const [collapsed,setCollapsed]=useState<Set<string>>(new Set());
 return <div className="project-tree">{groups.map(group=>{
  const closed=collapsed.has(group.id),shown=group.files.filter(file=>visible.has(file.id)).length;
  return <section className="project-group" key={group.id} aria-label={group.name}>
   <div className="project-heading">
    <Checkbox checked={groupVisibility(group.files,visible)} disabled={!group.files.length} aria-label={"Show all files in "+group.name} onCheckedChange={checked=>onToggleProject(group.files,checked===true)}/>
    <button className="project-title" aria-expanded={!closed} onClick={()=>setCollapsed(previous=>{const next=new Set(previous);if(closed)next.delete(group.id);else next.add(group.id);return next;})}>{closed?<ChevronRight size={15}/>:<ChevronDown size={15}/>}<span><strong>{group.name}</strong><small>{group.files.length} file{group.files.length!==1?"s":""}{shown>0?" · "+shown+" visible":""}</small></span></button>
    {!group.unassigned&&<button className="icon-button" title={"Add a file to "+group.name} aria-label={"Add a file to "+group.name} onClick={()=>onAdd(group.id)}><Plus size={17}/></button>}

   </div>
   {!group.unassigned&&<button className="delete-project-button" onClick={()=>onDeleteProject(group.id)} aria-label={"Delete project "+group.name}><Trash2 size={14}/>Delete project</button>}
   {!closed&&<div className="project-files">{!group.files.length?<button className="empty-project" onClick={()=>onAdd(group.id)}><FolderOpen size={18}/><span>Add your first KMZ or KML</span><Plus size={15}/></button>:group.files.map(file=><div className={"trip-row "+(selectedId===file.id?"selected":"")} key={file.id}>
    <Checkbox aria-label={"Show "+file.name+" on the map"} checked={visible.has(file.id)} onCheckedChange={checked=>onToggle(file.id,checked===true)} style={{"--primary":file.color} as React.CSSProperties}/>
    <button className="trip-select" onClick={()=>onSelect(file.id)}><strong>{file.name}</strong><span className="file-author"><UserRound size={12}/>{file.author||"Author not added"}</span><small><Route size={12}/>{file.distance.toFixed(1)} km<span className="mini-dot"/><Camera size={12}/>{file.photoCount}{file.date&&<><span className="mini-dot"/>{new Date(file.date+"T12:00:00").toLocaleDateString("en-GB",{day:"numeric",month:"short"})}</>}</small></button>
    <div className="file-row-actions">{loadingIds.has(file.id)?<LoaderCircle size={15} className="spin"/>:<span className="route-color" style={{background:file.color}}/>}{canEdit&&<button className="file-edit-button" aria-label={"Edit "+file.name} onClick={()=>onEdit(file)}>Edit</button>}{<button className="icon-button" title="Delete file" aria-label={"Delete file "+file.name} onClick={()=>onDeleteFile(file.id)}><Trash2 size={15}/></button>}</div>
   </div>)}</div>}
   {group.unassigned&&!closed&&<p className="unassigned-hint">Your earlier uploads are preserved. Unlock uploads, then use Edit to choose a project.</p>}
  </section>;
 })}</div>;
}
