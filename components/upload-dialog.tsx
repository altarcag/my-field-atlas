"use client";
import { useEffect,useRef,useState } from "react";
import { Upload, FileArchive, Route, Camera, MapPin, X, ArrowRight, LockKeyhole, LoaderCircle, Check, AlertCircle, FolderPlus } from "lucide-react";
import { Dialog,DialogContent,DialogTitle,DialogDescription,DialogHeader } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { RadioGroup,RadioGroupItem } from "@/components/ui/radio-group";
import { NativeSelect } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
import { api,fileSize,jsonRequest } from "@/lib/client-api";
import type { WorkspaceId } from "@/lib/workspaces";
import type { PreparedImport } from "@/lib/kmz";
import { ROUTE_COLORS,type Access,type TripSummary,type Project } from "@/lib/types";

type Props={workspace:WorkspaceId;open:boolean;onOpenChange:(v:boolean)=>void;access:Access|null;onAccess:(a:Access)=>void;onSaved:(trip:TripSummary)=>Promise<void>;projects:Project[];preferredProjectId:string|null;purpose:"file"|"project";onProjectSaved:(project:Project)=>void};
export default function UploadDialog({workspace,open,onOpenChange,access,onAccess,onSaved,projects,preferredProjectId,purpose,onProjectSaved}:Props) {
 const [file,setFile]=useState<File|null>(null),[prepared,setPrepared]=useState<PreparedImport|null>(null),[name,setName]=useState(""),[date,setDate]=useState(""),[note,setNote]=useState(""),[color,setColor]=useState(ROUTE_COLORS[0]);
 const [password,setPassword]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false),[reading,setReading]=useState(false),[status,setStatus]=useState(""),[progress,setProgress]=useState(0),[dragging,setDragging]=useState(false);
 const input=useRef<HTMLInputElement>(null),controller=useRef<AbortController|null>(null),activeId=useRef<string|null>(null),readGeneration=useRef(0);
 const [projectId,setProjectId]=useState("__new__"),[projectName,setProjectName]=useState(""),[author,setAuthor]=useState("");
 useEffect(()=>{if(open){setProjectId(preferredProjectId||projects[0]?.id||"__new__");setProjectName("");setError("");}},[open,preferredProjectId,purpose,workspace]);
 const locked=!access?.unlocked;
 async function createProject(){
  const project=await api<Project>("/api/projects",jsonRequest({name:projectName.trim(),workspace}));
  onProjectSaved(project);setProjectId(project.id);return project.id;
 }
 async function saveProject(e:React.FormEvent){
  e.preventDefault();setBusy(true);setError("");
  try{await createProject();onOpenChange(false);}catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 async function unlock(e:React.FormEvent) {
  e.preventDefault();setError("");
  setBusy(true);
  try {
   await api("/api/access",jsonRequest({action:"unlock",password}));
   onAccess(await api<Access>("/api/access"));setPassword("");
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 async function choose(next:File|undefined) {
  if(!next)return;
  const generation=++readGeneration.current;
  setError("");setReading(true);setPrepared(null);setFile(next);
  setName(next.name.replace(/\.(kmz|kml)$/i,"").replace(/[_-]+/g," ").slice(0,120));
  try {const {prepareImport}=await import("@/lib/kmz");const result=await prepareImport(next);if(generation!==readGeneration.current)return;setPrepared(result);setDate(result.suggestedDate||"");}
  catch(e){if(generation===readGeneration.current)setError((e as Error).message);}finally{if(generation===readGeneration.current)setReading(false);}
 }
 async function save(e:React.FormEvent) {
  e.preventDefault();if(!file||!prepared||!name.trim())return;
  setBusy(true);setError("");setProgress(0);setStatus("Preparing your file…");
  const abort=new AbortController();controller.current=abort;
  try {
   const {CHUNK_SIZE,webPhoto}=await import("@/lib/kmz");
   const targetProject=projectId==="__new__"?await createProject():projectId;
   const {id}=await api<{id:string}>("/api/trips",{...jsonRequest({projectId:targetProject,author:author.trim(),name:name.trim(),date:date||null,note,color,fileName:file.name,size:file.size}),signal:abort.signal});
   activeId.current=id;
   const parts:{partNumber:number;etag:string}[]=[];
   for(let start=0,index=1;start<file.size;start+=CHUNK_SIZE,index++){
    abort.signal.throwIfAborted();setStatus("Saving original file · "+fileSize(Math.min(start+CHUNK_SIZE,file.size))+" of "+fileSize(file.size));
    const part=await api<{partNumber:number;etag:string}>("/api/trips/"+id+"/archive?part="+index,{method:"PUT",body:file.slice(start,start+CHUNK_SIZE),signal:abort.signal});
    parts.push(part);setProgress(Math.round(Math.min(1,(start+CHUNK_SIZE)/file.size)*45));
   }
   const data=structuredClone(prepared.data),urls=new Map<string,string>();
   for(let i=0;i<prepared.images.length;i++){
    abort.signal.throwIfAborted();setStatus("Preparing and saving photograph "+(i+1)+" of "+prepared.images.length);
    const item=prepared.images[i],image=await webPhoto(await item.read());
    await api("/api/trips/"+id+"/photos/p"+i+".jpg",{method:"PUT",headers:{"Content-Type":"image/jpeg"},body:image,signal:abort.signal});
    urls.set(item.ref,"/api/files/"+id+"/photos/p"+i+".jpg");
    setProgress(45+Math.round((i+1)/prepared.images.length*45));
   }
   data.points.forEach(p=>p.photos.forEach(photo=>{if(urls.has(photo.url))photo.url=urls.get(photo.url)!;}));
   setStatus("Finishing your file…");setProgress(95);
   const trip=await api<TripSummary>("/api/trips/"+id+"/complete",{...jsonRequest({data,parts}),signal:abort.signal});
   activeId.current=null;setProgress(100);
   await onSaved(trip);
   onOpenChange(false);setFile(null);setPrepared(null);setNote("");setName("");
  }catch(e){
   const id=activeId.current;
   if(id) {
    // A response can be lost after a successful save. Check before cleaning up.
    try {const trip=await api<TripSummary>("/api/trips/"+id);activeId.current=null;await onSaved(trip);onOpenChange(false);setFile(null);setPrepared(null);return;}catch{}
    try{await api("/api/trips/"+id+"?draft=true",{method:"DELETE"});activeId.current=null;}catch{}
   }
   setError(abort.signal.aborted?"Upload cancelled. You can start again with the same file.":(e as Error).message);
  }finally{controller.current=null;setBusy(false);setStatus("");}
 }
 const photos=prepared?.data.points.reduce((n,p)=>n+p.photos.length,0)||0;
 return <Dialog open={open} onOpenChange={v=>{if(!busy){onOpenChange(v);setError("");}}}>
  <DialogContent className="atlas-dialog upload-dialog" showCloseButton={!busy} onInteractOutside={e=>{if(busy)e.preventDefault();}} onEscapeKeyDown={e=>{if(busy)e.preventDefault();}}>
   <DialogHeader>
    <div className="dialog-icon">{locked?<LockKeyhole size={22}/>:<Upload size={23}/>}</div>
    <DialogTitle>{locked?"Unlock uploads":purpose==="project"?"Create a project":"Add a file"}</DialogTitle>
    <DialogDescription>{locked?"Enter the shared upload password, or your owner password to manage files.":purpose==="project"?"One field trip, with room for every day and contributor.":"Add a KMZ or KML to a project. Embedded photos are handled automatically."}</DialogDescription>
   </DialogHeader>
   {locked?<form onSubmit={unlock} className="dialog-form">
    {!access?<p className="subtle"><LoaderCircle size={16} className="spin"/> Checking upload access…</p>:!access.configured?<p className="subtle">Uploads are temporarily unavailable. Please contact the owner.</p>:<>
    <label className="field-label">Upload password<input autoFocus type="password" minLength={1} maxLength={256} required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter the shared password"/></label>
    {error&&<p className="form-error" role="alert"><AlertCircle size={16}/>{error}</p>}
    <Button type="submit" disabled={busy} className="wine-button full">{busy?<LoaderCircle size={17} className="spin"/>:null}Unlock uploads<ArrowRight size={17}/></Button>
    </>}
   </form>:purpose==="project"?<form onSubmit={saveProject} className="dialog-form">
    <label className="field-label">Project name<input autoFocus required maxLength={120} disabled={busy} value={projectName} onChange={e=>setProjectName(e.target.value)} placeholder="e.g. URG-2026"/></label>
    <p className="small-note">Workspace: {workspace==="urg-2026"?"URG-2026":"My Field Map"}. Add Day 1, Day 2, and more as separate files inside this project.</p>
    {error&&<p className="form-error" role="alert">{error}</p>}
    <div className="dialog-actions"><Button type="button" variant="outline" disabled={busy} onClick={()=>onOpenChange(false)}>Cancel</Button><Button type="submit" className="wine-button" disabled={busy||!projectName.trim()}>{busy?<LoaderCircle size={16} className="spin"/>:<FolderPlus size={16}/>}Create project</Button></div>
   </form>:<form onSubmit={save} className="dialog-form">
    <label className="field-label">Project<NativeSelect value={projectId} onChange={e=>setProjectId(e.target.value)} disabled={busy}>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}<option value="__new__">+ Create a new project</option></NativeSelect></label>
    {projectId==="__new__"&&<label className="field-label">New project name<input required maxLength={120} disabled={busy} value={projectName} onChange={e=>setProjectName(e.target.value)} placeholder="e.g. URG-2026"/></label>}
    {!file?<button type="button" className={"upload-drop "+(dragging?"is-dragging":"")} onClick={()=>input.current?.click()} onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);if(e.dataTransfer.files.length>1){setError("Choose one file at a time. You can add more files to the same project afterward.");return;}void choose(e.dataTransfer.files[0]);}}>
     <div className="drop-icon"><FileArchive size={30} strokeWidth={1.4}/></div>
     <strong>Drop your KMZ or KML here</strong><span>or click to choose a file</span><small>KMZ up to 512 MB · KML up to 12 MB</small>
    </button>:<div className="chosen-file"><FileArchive size={25}/><div><strong>{file.name}</strong><span>{fileSize(file.size)}{reading?" · Reading your file…":""}</span></div><button type="button" aria-label="Choose a different file" disabled={busy||reading} onClick={()=>{readGeneration.current++;setFile(null);setPrepared(null);setError("");}}><X size={18}/></button></div>}
    <input ref={input} type="file" accept=".kmz,.kml,application/vnd.google-earth.kmz,application/vnd.google-earth.kml+xml" className="sr-only" aria-label="Choose a KMZ or KML file" onChange={e=>void choose(e.target.files?.[0])}/>
    {reading&&<div className="subtle"><LoaderCircle size={17} className="spin"/> Finding the route and embedded photos…</div>}
    {prepared&&<>
     <div className="import-counts"><span><Route size={17}/>{prepared.data.routes.length} routes</span><span><Camera size={17}/>{photos} photos</span><span><MapPin size={17}/>{prepared.data.points.length} waypoints</span></div>
     <label className="field-label">File title<input required maxLength={120} value={name} disabled={busy} onChange={e=>setName(e.target.value)} placeholder="e.g. Day 1 — Northern traverse"/></label>
     <label className="field-label">Author <span className="optional">Optional</span><input maxLength={120} value={author} disabled={busy} onChange={e=>setAuthor(e.target.value)} placeholder="Your name, or the names of your group"/></label>
     <div className="form-row"><label className="field-label">Date <span className="optional">Optional</span><input type="date" value={date} disabled={busy} onChange={e=>setDate(e.target.value)}/></label>
      <div className="field-label">Route color<RadioGroup className="color-picker" value={color} onValueChange={setColor} disabled={busy} aria-label="Route color">{ROUTE_COLORS.map((c,i)=><label key={c} style={{"--swatch":c} as React.CSSProperties} className={color===c?"selected":""}><RadioGroupItem className="sr-only" value={c} aria-label={["Burgundy","Amber","Teal","Violet","Olive","Rose","Blue","Emerald","Cyan","Charcoal"][i]}/>{color===c&&<Check size={13}/>}</label>)}</RadioGroup></div>
     </div>
     <label className="field-label">Field notes <span className="optional">Optional</span><textarea rows={2} maxLength={2000} value={note} disabled={busy} onChange={e=>setNote(e.target.value)} placeholder="Location, course, or a few words about the day"/></label>
     {prepared.data.warnings.length>0&&<div className="import-warnings">{prepared.data.warnings.map((w,i)=><p key={i}><AlertCircle size={15}/>{w}</p>)}</div>}
    </>}
    {error&&<p className="form-error" role="alert"><AlertCircle size={16}/>{error}</p>}
    {busy&&<div className="upload-progress" role="status" aria-live="polite"><div><span>{status}</span><strong>{progress}%</strong></div><Progress value={progress}/><p>Keep this tab open until the upload finishes.</p></div>}
    <div className="dialog-actions"><Button type="button" variant="outline" onClick={()=>{if(busy)controller.current?.abort();else onOpenChange(false);}}>{busy?"Cancel upload":"Cancel"}</Button><Button type="submit" className="wine-button" disabled={!prepared||!name.trim()||busy||(projectId==="__new__"&&!projectName.trim())}>{busy?<LoaderCircle size={16} className="spin"/>:<Upload size={16}/>}Save file</Button></div>
   </form>}
  </DialogContent>
 </Dialog>;
}
