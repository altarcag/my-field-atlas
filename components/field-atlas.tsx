"use client";
import { useCallback,useEffect,useMemo,useRef,useState } from "react";
import { flushSync } from "react-dom";
import { Map as MapIcon, Mountain, Satellite, Upload, Library, LockKeyhole, Unlock, ChevronRight, ChevronLeft, ChevronDown, MapPinned, Route, Camera, Crosshair, Download, Trash2, X, LoaderCircle, AlertCircle, Layers, Check, FileArchive, MapPin, FolderPlus, Pencil, UserRound } from "lucide-react";
import { SidebarProvider,Sidebar,SidebarHeader,SidebarContent,SidebarFooter,SidebarMenu,SidebarMenuItem,SidebarMenuButton,SidebarTrigger,useSidebar } from "@/components/ui/sidebar";
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription } from "@/components/ui/dialog";
import { AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction } from "@/components/ui/alert-dialog";
import { RadioGroup,RadioGroupItem } from "@/components/ui/radio-group";
import { NativeSelect } from "@/components/ui/native-select";
import ProjectTree from "./project-tree";
import { groupFiles } from "@/lib/projects";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import AtlasMap,{type MapHandle,type MapMode} from "./atlas-map";
import UploadDialog from "./upload-dialog";
import { api,jsonRequest,fileSize,apiUrl,assetUrl } from "@/lib/client-api";
import type { Access,Trip,TripSummary,Waypoint,FieldPhoto,Project } from "@/lib/types";
import { workspacePath,workspaceFromPath,workspaceHash,workspaceFromHash,restoredProjectFiles,readPreference,writePreference,type WorkspaceId } from "@/lib/workspaces";
import "./field-atlas.css";

function tripDate(s:string|null) {if(!s)return "No date added";return new Date(s+"T12:00:00").toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"});}
function CompassMark(){return <img src={assetUrl("favicon.svg")} width={38} height={38} alt="" />;}
function PhotoImage({photo,className=""}:{photo:FieldPhoto;className?:string}) {
 const [failed,setFailed]=useState(false);
 useEffect(()=>setFailed(false),[photo.url]);
 return failed?<div className={"unavailable-photo "+className}><Camera size={24}/><span>Photo unavailable</span></div>:<img src={apiUrl(photo.url)} alt={photo.name} loading="lazy" className={className} onError={()=>setFailed(true)}/>;
}

function Navigation({access,onAccess,activeWorkspace,onWorkspace}:{access:Access|null;onAccess:()=>void;activeWorkspace:WorkspaceId;onWorkspace:(workspace:WorkspaceId)=>void}) {
 const {setOpenMobile}=useSidebar();
 const chooseWorkspace=(workspace:WorkspaceId)=>{onWorkspace(workspace);setOpenMobile(false);};
 return <Sidebar className="atlas-sidebar">
  <SidebarHeader className="brand"><CompassMark/><div><strong>MY FIELD ATLAS</strong><span>Geological field notebook</span></div></SidebarHeader>
  <SidebarContent className="nav-content">
   <p className="nav-eyebrow">WORKSPACE</p>
   <SidebarMenu>
    <SidebarMenuItem><SidebarMenuButton isActive={activeWorkspace==="field-map"} className={"nav-item "+(activeWorkspace==="field-map"?"active":"")} onClick={()=>chooseWorkspace("field-map")}><MapIcon size={19}/><span>My Field Map</span><ChevronRight className="nav-arrow" size={15}/></SidebarMenuButton></SidebarMenuItem>
    <SidebarMenuItem><SidebarMenuButton isActive={activeWorkspace==="urg-2026"} className={"nav-item "+(activeWorkspace==="urg-2026"?"active":"")} onClick={()=>chooseWorkspace("urg-2026")}><Route size={19}/><span>URG-2026</span><ChevronRight className="nav-arrow" size={15}/></SidebarMenuButton></SidebarMenuItem>
    <SidebarMenuItem><SidebarMenuButton disabled className="nav-item library-nav" aria-label="Library, planned for a future version"><Library size={19}/><span>Library</span><span className="soon">Soon</span></SidebarMenuButton></SidebarMenuItem>
   </SidebarMenu>
   <div className="sidebar-divider"/>
   <div className="sidebar-note"><MapPinned size={20} strokeWidth={1.3}/><p>Routes, photographs,<br/>and days in the field.</p></div>
  </SidebarContent>
  <SidebarFooter className="nav-footer">
   <button className="access-nav" onClick={()=>{setOpenMobile(false);onAccess();}}>{access?.unlocked?<Unlock size={18}/>:<LockKeyhole size={18}/>}<span><strong>Upload access</strong><small>{access?.unlocked?"Uploads enabled":"Password protected"}</small></span><ChevronRight size={15}/></button>
   <div className="workspace-credit"><span className="avatar">A</span><span>Personal field notebook<small>MY FIELD ATLAS · V2</small></span></div>
  </SidebarFooter>
 </Sidebar>;
}
type PhotoSelection={trip:Trip;point:Waypoint;photoId?:string};
export default function FieldAtlas() {
 const [summaries,setSummaries]=useState<TripSummary[]>([]),[cache,setCache]=useState<Record<string,Trip>>({}),[visible,setVisible]=useState<Set<string>>(new Set()),[selectedId,setSelectedId]=useState<string|null>(null);
 const [loading,setLoading]=useState(true),[loadError,setLoadError]=useState(""),[loadingTrip,setLoadingTrip]=useState<string|null>(null),[access,setAccess]=useState<Access|null>(null);
 const [mode,setMode]=useState<MapMode>("map"),[photosVisible,setPhotosVisible]=useState(true),[uploadOpen,setUploadOpen]=useState(false),[accessOpen,setAccessOpen]=useState(false),[panelOpen,setPanelOpen]=useState(false);
 const [activeWorkspace,setActiveWorkspace]=useState<WorkspaceId>(()=>workspaceFromPath(window.location.pathname)||workspaceFromHash(window.location.hash)||workspaceFromHash(readPreference("workspace")||"")||"field-map"),[detailOpen,setDetailOpen]=useState(false);
 const [selection,setSelection]=useState<PhotoSelection|null>(null),[coords,setCoords]=useState({lng:34.4,lat:39.2,zoom:6.2}),[confirm,setConfirm]=useState<string|null>(null),[pendingDelete,setPendingDelete]=useState<string|null>(null),[removing,setRemoving]=useState(false);
 const [projects,setProjects]=useState<Project[]>([]),[uploadProject,setUploadProject]=useState<string|null>(null),[uploadPurpose,setUploadPurpose]=useState<"file"|"project">("file"),[loadingIds,setLoadingIds]=useState<Set<string>>(new Set());
 const [editing,setEditing]=useState<TripSummary|null>(null),[editProject,setEditProject]=useState(""),[editName,setEditName]=useState(""),[editAuthor,setEditAuthor]=useState(""),[editError,setEditError]=useState(""),[editBusy,setEditBusy]=useState(false);
 const map=useRef<MapHandle>(null),cacheRef=useRef(cache),inflight=useRef(new Map<string,Promise<Trip>>()),selectedRef=useRef(selectedId);
 cacheRef.current=cache;selectedRef.current=selectedId;
 const restoredWorkspace=useRef<WorkspaceId|null>(null),restoreGeneration=useRef(0);
 const urgProjectIds=useMemo(()=>new Set(projects.filter(project=>project.name.trim().toLocaleLowerCase()==="urg-2026").map(project=>project.id)),[projects]);
 const workspaceProjects=useMemo(()=>activeWorkspace==="field-map"?projects:projects.filter(project=>urgProjectIds.has(project.id)),[activeWorkspace,projects,urgProjectIds]);
 const workspaceSummaries=useMemo(()=>activeWorkspace==="field-map"?summaries:summaries.filter(file=>file.projectId&&urgProjectIds.has(file.projectId)),[activeWorkspace,summaries,urgProjectIds]);
 const groups=useMemo(()=>groupFiles(workspaceProjects,workspaceSummaries),[workspaceProjects,workspaceSummaries]);
 const visibleRef=useRef(visible);visibleRef.current=visible;
 const selected=selectedId?cache[selectedId]:undefined;
 const selectedSummary=summaries.find(t=>t.id===selectedId);
 const workspaceFileIds=useMemo(()=>new Set(workspaceSummaries.map(file=>file.id)),[workspaceSummaries]);
 const mapTrips=useMemo(()=>Object.values(cache).filter(t=>visible.has(t.id)&&workspaceFileIds.has(t.id)),[cache,visible,workspaceFileIds]);
 const gallery=useMemo(()=>(selected?[selected]:mapTrips).flatMap(trip=>trip.points.flatMap(point=>point.photos.map(photo=>({trip,point,photo})))),[selected,mapTrips]);
 const ensureTrip=useCallback(async(id:string)=>{
  if(cacheRef.current[id])return cacheRef.current[id];
  if(inflight.current.has(id))return inflight.current.get(id)!;
  const promise=api<Trip>("/api/trips/"+id).then(t=>{setCache(old=>({...old,[id]:t}));return t;}).finally(()=>inflight.current.delete(id));
  inflight.current.set(id,promise);return promise;
 },[]);
 const chooseTrip=useCallback(async(id:string,showDetails=true)=>{
  const projectId=summaries.find(file=>file.id===id)?.projectId;if(projectId)writePreference("project:"+activeWorkspace,projectId);
  setSelectedId(id);selectedRef.current=id;setDetailOpen(showDetails);setLoadingTrip(id);setVisible(v=>new Set(v).add(id));
  try {const trip=await ensureTrip(id);if(selectedRef.current===id&&visibleRef.current.has(id))map.current?.fit([trip]);}
  catch(e){toast.error((e as Error).message);throw e;}finally{setLoadingTrip(current=>current===id?null:current);}
 },[ensureTrip,summaries,activeWorkspace]);
 const load=useCallback(async()=>{
  setLoading(true);setLoadError("");
  const results=await Promise.allSettled([api<{trips:TripSummary[]}>("/api/trips"),api<Access>("/api/access"),api<{projects:Project[]}>("/api/projects")]);
  if(results[0].status==="fulfilled"){setSummaries(results[0].value.trips);}
  else setLoadError(results[0].reason.message);
  if(results[1].status==="fulfilled")setAccess(results[1].value);
  else setLoadError(previous=>previous||"Upload access is temporarily unavailable. Please retry.");
  if(results[2].status==="fulfilled")setProjects(results[2].value.projects);else setLoadError(previous=>previous||"Projects could not be loaded. Please retry.");
  setLoading(false);
 },[]);
 useEffect(()=>{void load();},[load]);
 useEffect(()=>{const lock=()=>setAccess({configured:true,unlocked:false,isOwner:false});window.addEventListener("atlas-session-expired",lock);return()=>window.removeEventListener("atlas-session-expired",lock);},[]);
 function openUpload(projectId:string|null=null,purpose:"file"|"project"="file"){
  setUploadProject(projectId);setUploadPurpose(purpose);setUploadOpen(true);
 }
 function changeWorkspace(workspace:WorkspaceId){
  const target=workspacePath(workspace,import.meta.env.BASE_URL);
  if(window.location.pathname!==target||window.location.hash)window.history.pushState(null,"",target);
  if(restoredWorkspace.current===workspace)return;
  restoreGeneration.current++;restoredWorkspace.current=null;
  setActiveWorkspace(workspace);setSelectedId(null);selectedRef.current=null;setDetailOpen(false);setSelection(null);setPanelOpen(false);
 }
 useEffect(()=>{
  const followLink=()=>{const workspace=workspaceFromPath(window.location.pathname)||workspaceFromHash(window.location.hash);if(workspace)changeWorkspace(workspace);};
  window.addEventListener("popstate",followLink);
  if(window.location.hash)window.history.replaceState(null,"",workspacePath(activeWorkspace,import.meta.env.BASE_URL));
  return()=>window.removeEventListener("popstate",followLink);
 },[]);
 useEffect(()=>{
  writePreference("workspace",workspaceHash(activeWorkspace));
  if(loading||loadError||restoredWorkspace.current===activeWorkspace)return;
  restoredWorkspace.current=activeWorkspace;
  const generation=++restoreGeneration.current;
  const files=restoredProjectFiles(activeWorkspace,projects,summaries,readPreference("project:"+activeWorkspace));
  if(files[0]?.projectId)writePreference("project:"+activeWorkspace,files[0].projectId);
  setVisible(new Set(files.map(file=>file.id)));setLoadingIds(new Set(files.map(file=>file.id)));
  void Promise.allSettled(files.map(file=>ensureTrip(file.id))).then(results=>{
   if(generation!==restoreGeneration.current)return;
   const loaded=results.flatMap(result=>result.status==="fulfilled"?[result.value]:[]);
   setLoadingIds(new Set());
   if(loaded.length!==files.length)toast.error("Some project files could not load. Tick them again to retry.");
   const failed=new Set(files.filter((_,index)=>results[index].status==="rejected").map(file=>file.id));
   setVisible(previous=>new Set([...previous].filter(id=>!failed.has(id))));
   map.current?.fit(loaded.filter(file=>visibleRef.current.has(file.id)));
  });
 },[activeWorkspace,loading,loadError,projects,summaries,ensureTrip]);
 function projectSaved(project:Project){setProjects(previous=>[project,...previous.filter(p=>p.id!==project.id)]);toast.success("Project created. Add as many files as you need.");}
 async function toggleFiles(files:TripSummary[],show:boolean){
  if(show&&files[0]?.projectId)writePreference("project:"+activeWorkspace,files[0].projectId);
  setVisible(previous=>{const next=new Set(previous);for(const file of files){if(show)next.add(file.id);else next.delete(file.id);}return next;});
  if(!show)return;
  setLoadingIds(previous=>new Set([...previous,...files.map(file=>file.id)]));
  const results=await Promise.allSettled(files.map(file=>ensureTrip(file.id)));
  const failed=files.filter((_,index)=>results[index].status==="rejected").map(file=>file.id);
  if(failed.length){setVisible(previous=>{const next=new Set(previous);failed.forEach(id=>next.delete(id));return next;});toast.error("Some files could not be loaded. Tick them again to retry.");}
  setLoadingIds(previous=>{const next=new Set(previous);files.forEach(file=>next.delete(file.id));return next;});
  if(files.length>1){const loaded=results.flatMap(result=>result.status==="fulfilled"&&visibleRef.current.has(result.value.id)?[result.value]:[]);if(loaded.length)map.current?.fit(loaded);}
 }
 function toggleTrip(id:string,show:boolean){const file=summaries.find(file=>file.id===id);if(file)void toggleFiles([file],show);}
 function editFile(file:TripSummary){setEditing(file);setEditProject(file.projectId||projects[0]?.id||"");setEditName(file.name);setEditAuthor(file.author);setEditError("");}
 async function saveFileDetails(e:React.FormEvent){
  e.preventDefault();if(!editing)return;setEditBusy(true);setEditError("");
  try{const updated=await api<TripSummary>("/api/trips/"+editing.id,{...jsonRequest({projectId:editProject,name:editName,author:editAuthor}),method:"PATCH"});
   setSummaries(previous=>previous.map(file=>file.id===updated.id?updated:file));
   setCache(previous=>previous[updated.id]?{...previous,[updated.id]:{...previous[updated.id],...updated}}:previous);
   setEditing(null);toast.success("File details saved.");
  }catch(e){setEditError((e as Error).message);}finally{setEditBusy(false);}
 }
 async function saved(trip:TripSummary) {
  setSummaries(prev=>[trip,...prev.filter(t=>t.id!==trip.id)]);
  if(trip.projectId)writePreference("project:"+activeWorkspace,trip.projectId);
  await chooseTrip(trip.id);setPanelOpen(true);toast.success("File saved in its project. Your map is ready.");
 }
 async function requestDelete(target:string) {
  if(access?.isOwner&&access.unlocked){setConfirm(target);return;}
  try {
   if(access?.unlocked){await api("/api/access",jsonRequest({action:"lock"}));setAccess(await api<Access>("/api/access"));}
   setPendingDelete(target);toast.info("Enter the owner password to continue.");
   openUpload();
  }catch(e){toast.error((e as Error).message);}
 }
 async function removeConfirmed() {
  if(!confirm)return;setRemoving(true);
  try {
   if(confirm==="drafts"){
    const result=await api<{removed:number}>("/api/uploads",{method:"DELETE"});toast.success(result.removed+" unfinished upload(s) cleared.");
   }else if(confirm.startsWith("photo:")){
    const [,id,photo]=confirm.split(":");
    const updated=await api<Trip>("/api/trips/"+id+"/photos/"+photo,{method:"DELETE"});
    setCache(prev=>({...prev,[id]:updated}));setSummaries(prev=>prev.map(t=>t.id===id?updated:t));setSelection(null);toast.success("Photo removed from the map.");
   }else if(confirm.startsWith("project:")){
    const id=confirm.slice(8);await api("/api/projects?id="+encodeURIComponent(id),{method:"DELETE"});
    const ids=new Set(summaries.filter(t=>t.projectId===id).map(t=>t.id));
    setProjects(prev=>prev.filter(p=>p.id!==id));setSummaries(prev=>prev.filter(t=>!ids.has(t.id)));
    setCache(prev=>Object.fromEntries(Object.entries(prev).filter(([key])=>!ids.has(key))));setVisible(prev=>new Set([...prev].filter(key=>!ids.has(key))));
    if(selectedId&&ids.has(selectedId)){setSelectedId(null);selectedRef.current=null;setDetailOpen(false);}if(selection&&ids.has(selection.trip.id))setSelection(null);toast.success("Project deleted.");
   }else{
    const id=confirm;await api("/api/trips/"+id,{method:"DELETE"});
    setSummaries(prev=>prev.filter(t=>t.id!==id));setCache(prev=>{const n={...prev};delete n[id];return n;});setVisible(prev=>{const n=new Set(prev);n.delete(id);return n;});
    if(selectedId===id){setSelectedId(null);selectedRef.current=null;setDetailOpen(false);}if(selection?.trip.id===id)setSelection(null);toast.success("File deleted.");
   }
   setConfirm(null);
  }catch(e){toast.error((e as Error).message);}finally{setRemoving(false);}
 }
 const viewerPhotos=selection?.trip.points.flatMap(point=>point.photos.map(photo=>({point,photo})))||[];
 const viewerIndex=Math.max(0,viewerPhotos.findIndex(p=>p.photo.id===selection?.photoId));
 const viewed=selection?.photoId?viewerPhotos[viewerIndex]:null;
 function nextPhoto(delta:number) {
  if(!selection||!viewerPhotos.length)return;
  const next=viewerPhotos[(viewerIndex+delta+viewerPhotos.length)%viewerPhotos.length];
  setSelection({trip:selection.trip,point:next.point,photoId:next.photo.id});
 }
 const nextPhotoRef=useRef(nextPhoto);nextPhotoRef.current=nextPhoto;
 useEffect(()=>{
  if(!selection?.photoId)return;
  const onKey=(e:KeyboardEvent)=>{if(e.key==="ArrowRight"){e.preventDefault();nextPhotoRef.current(1);}if(e.key==="ArrowLeft"){e.preventDefault();nextPhotoRef.current(-1);}};
  window.addEventListener("keydown",onKey);return()=>window.removeEventListener("keydown",onKey);
 },[selection?.photoId]);
 const stateRef=useRef({summaries,chooseTrip,setMode});stateRef.current={summaries,chooseTrip,setMode};
 useEffect(()=>{
  type Tool={name:string;description:string;inputSchema:object;annotations:object;execute:(input:unknown)=>unknown};
  const registry=(document as Document&{modelContext?:{registerTool:(tool:Tool,options:{signal:AbortSignal})=>void|Promise<void>}}).modelContext;
  if(!registry)return;const lifecycle=new AbortController();
  const definitions:Tool[]=[
   {name:"list_field_trips",description:"Read uploaded files, their authors, and parent project IDs in Field Atlas.",inputSchema:{type:"object",properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute(){return {trips:stateRef.current.summaries.map(({id,name,projectId,author,date,photoCount,distance})=>({id,name,projectId,author,date,photoCount,distanceKm:distance}))};}},
   {name:"set_map_view",description:"Switch the visible map to standard, satellite, or 3D terrain.",inputSchema:{type:"object",properties:{view:{type:"string",enum:["map","satellite","terrain"]}},required:["view"],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){const v=(input as {view?:string})?.view;if(!["map","satellite","terrain"].includes(v||""))throw new Error("Choose map, satellite, or terrain.");flushSync(()=>stateRef.current.setMode(v as MapMode));return {view:v};}},
   {name:"select_field_trip",description:"Select an existing uploaded file and display its route, waypoints, and photo locations.",inputSchema:{type:"object",properties:{id:{type:"string"}},required:["id"],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},async execute(input){const id=(input as {id?:string})?.id;if(!id||!stateRef.current.summaries.some(t=>t.id===id))throw new Error("Unknown field trip.");await stateRef.current.chooseTrip(id);return {selectedTrip:id};}}
  ];
  for(const tool of definitions)try{void Promise.resolve(registry.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}
  return()=>lifecycle.abort();
 },[]);
 const workspaceTitle=activeWorkspace==="field-map"?"My Field Map":"URG-2026";
 return <SidebarProvider style={{"--sidebar-width":"224px"} as React.CSSProperties} className="atlas-app">
  <Navigation access={access} onAccess={()=>setAccessOpen(true)} activeWorkspace={activeWorkspace} onWorkspace={changeWorkspace}/>
  <main className="atlas-main">
   <header className="workspace-header">
    <div className="heading-group"><SidebarTrigger className="mobile-nav-trigger"/><div><div className="breadcrumbs">WORKSPACE <ChevronRight size={11}/> {activeWorkspace==="field-map"?"COLLABORATIVE ATLAS":"FIELD NOTEBOOK"}</div><h1>{workspaceTitle}<span className="heading-dot">.</span></h1></div></div>
    {gallery.length>0&&<section className="header-gallery" aria-label="Field photographs">
     <span className="header-gallery-label"><Camera size={15}/><span>Photos</span><small>{gallery.length}</small></span>
     <div className="header-gallery-scroll">{gallery.map(({trip,point,photo},i)=><button key={trip.id+":"+photo.id} className="header-photo-thumb" onClick={()=>setSelection({trip,point,photoId:photo.id})} aria-label={"Open photograph "+(i+1)+": "+point.name}><PhotoImage photo={photo}/><span>{point.name}</span></button>)}</div>
    </section>}
    <div className="header-actions"><a className="workspace-share" href={workspacePath(activeWorkspace,import.meta.env.BASE_URL)} onClick={async e=>{e.preventDefault();try{await navigator.clipboard.writeText(window.location.origin+workspacePath(activeWorkspace,import.meta.env.BASE_URL));toast.success("Workspace link copied.");}catch{toast.error("Copy the workspace link from your address bar.");}}} title="Copy workspace link" aria-label="Copy workspace link"><MapPinned size={17}/></a><span className="trip-total">{workspaceProjects.length} project{workspaceProjects.length!==1?"s":""} · {workspaceSummaries.length} files</span><Button className="wine-button" onClick={()=>openUpload(selectedSummary?.projectId||null)}><Upload size={17}/>Add file</Button></div>
   </header>
   <section className={"map-workspace "+(!panelOpen?"panel-is-closed":"")} aria-label="Field map workspace">
    <AtlasMap ref={map} trips={mapTrips} mode={mode} selectedId={selectedId} photosVisible={photosVisible} onPoint={(trip,point)=>setSelection({trip,point,photoId:point.photos[0]?.id})} onBackground={()=>setDetailOpen(false)} onMove={(lng,lat,zoom)=>setCoords({lng,lat,zoom})}/>
    <div className="map-mode-wrap">
     <RadioGroup value={mode} onValueChange={v=>setMode(v as MapMode)} className="map-modes" orientation="horizontal" aria-label="Map layer">
      {([{value:"map",label:"Map",Icon:MapIcon},{value:"satellite",label:"Satellite",Icon:Satellite},{value:"terrain",label:"3D terrain",Icon:Mountain}] as const).map(({value,label,Icon})=><label key={value} className={mode===value?"chosen":""}><RadioGroupItem value={value} className="sr-only"/><Icon size={17}/><span>{label}</span></label>)}
     </RadioGroup>
     {mode==="terrain"&&<div className="terrain-hint"><Mountain size={13}/> Drag to pan · Right/Ctrl-drag to tilt & rotate</div>}
    </div>
    <button className="fit-control" aria-label="Fit visible files to map" title="Fit visible files" onClick={()=>map.current?.fit()}><Crosshair size={19}/></button>
    {!panelOpen&&<button className="open-trip-panel" onClick={()=>setPanelOpen(true)}><Layers size={17}/>Projects<span>{groups.length}</span></button>}
    <aside className={"trip-panel "+(!panelOpen?"hidden-panel":"")} aria-label="Fieldwork projects">
     <div className="panel-heading"><div><span className="panel-overline">{activeWorkspace==="field-map"?"SHARED FIELDWORK":"FIELD WORKSPACE"}</span><h2>Projects <span>{workspaceProjects.length}</span></h2></div><div className="panel-heading-actions"><button className="icon-button" title="Create a project" aria-label="Create a project" onClick={()=>openUpload(null,"project")}><FolderPlus size={18}/></button><button className="icon-button panel-collapse" aria-label="Collapse projects" onClick={()=>setPanelOpen(false)}><ChevronLeft size={18}/></button></div></div>
     {loading?<div className="panel-state"><LoaderCircle size={24} className="spin"/><p>Loading projects…</p></div>:loadError?<div className="panel-state"><AlertCircle size={26}/><h3>Couldn’t load your fieldwork</h3><p>{loadError}</p><Button variant="outline" onClick={()=>void load()}>Try again</Button></div>:!groups.length?<div className="empty-trips">
      <div className="empty-route-icon"><MapPinned size={37} strokeWidth={1.2}/></div>
      <span className="small-caps">THE FIRST OF MANY</span><h3>Your fieldwork,<br/>all in one place.</h3>
      <p>Create a project for your trip. Add each day’s KMZ or KML, with routes and photos together.</p>
      <Button className="wine-button" onClick={()=>openUpload(null,"project")}><FolderPlus size={16}/>Create a project</Button>
      <div className="kmz-note"><FileArchive size={14}/>Intact KMZs. No unpacking needed.</div>
     </div>:<>
      <ProjectTree groups={groups} visible={visible} selectedId={detailOpen?selectedId:null} loadingIds={new Set([...loadingIds,...(loadingTrip?[loadingTrip]:[])])} onToggle={toggleTrip} onToggleProject={(files,show)=>void toggleFiles(files,show)} onSelect={id=>{if(id===selectedId&&detailOpen)setDetailOpen(false);else void chooseTrip(id).catch(()=>{});}} onAdd={id=>openUpload(id)} onEdit={editFile} canEdit={!!access?.unlocked} onDeleteFile={requestDelete} onDeleteProject={id=>requestDelete("project:"+id)}/>
      {selectedSummary&&detailOpen&&workspaceFileIds.has(selectedSummary.id)&&<div className="trip-detail">
       <div className="detail-overline">SELECTED FILE<div><a href={apiUrl("/api/files/"+selectedSummary.id+"/original")} title="Download original file" aria-label="Download original file"><Download size={16}/></a>{<button aria-label="Delete selected file" title="Delete file" onClick={()=>requestDelete(selectedSummary.id)}><Trash2 size={15}/></button>}<button aria-label="Close selected file details" title="Close details" onClick={()=>setDetailOpen(false)}><X size={16}/></button></div></div>
       <h3>{selectedSummary.name}</h3>
       <p className="selected-file-meta"><UserRound size={13}/>{selectedSummary.author||"Author not added"}<span>·</span>{tripDate(selectedSummary.date)}</p>
       {access?.unlocked&&<button className="edit-details-link" onClick={()=>editFile(selectedSummary)}><Pencil size={13}/>Edit details / move to project</button>}
       <div className="trip-stats"><div><strong>{selectedSummary.distance.toFixed(1)}<small>km</small></strong><span>GPS distance</span></div><div><strong>{selectedSummary.photoCount}</strong><span>Photographs</span></div></div>
       {selectedSummary.note&&<p className="trip-note">{selectedSummary.note}</p>}
       <div className="photo-switch"><label htmlFor="show-photo-pins"><Camera size={15}/>Photo locations</label><Switch id="show-photo-pins" checked={photosVisible} onCheckedChange={setPhotosVisible}/></div>
       {selected&&<details className="waypoint-list"><summary>Waypoints <span>{selected.points.length}<ChevronDown size={14}/></span></summary><div>{selected.points.length?selected.points.map((p,i)=><button key={p.id} onClick={()=>{map.current?.focus(p);setSelection({trip:selected,point:p,photoId:p.photos[0]?.id});}}><span className="waypoint-number">{String(i+1).padStart(2,"0")}</span><span>{p.name}</span>{p.photos.length?<Camera size={14}/>:<MapPin size={14}/>}</button>):<p>No waypoints in this file.</p>}</div></details>}
       {selected?.warnings.length? <details className="trip-warnings"><summary><AlertCircle size={14}/>Import notes ({selected.warnings.length})</summary>{selected.warnings.map((w,i)=><p key={i}>{w}</p>)}</details>:null}
      </div>}
     </>}
     <div className="panel-foot"><span className="little-route-line"/><span>Tick a project or choose individual files</span></div>
    </aside>
    {!summaries.length&&!loading&&!loadError&&<div className="map-empty-caption"><span className="caption-line"/><p>Ready for your next<br/><strong>day in the field.</strong></p></div>}
    <div className="map-bottom-left"><span className="coordinates">{Math.abs(coords.lat).toFixed(4)}° {coords.lat>=0?"N":"S"}<span>/</span>{Math.abs(coords.lng).toFixed(4)}° {coords.lng>=0?"E":"W"}</span><span className="coordinate-system">WGS 84</span></div>
   </section>
  </main>
  <UploadDialog open={uploadOpen} onOpenChange={open=>{setUploadOpen(open);if(!open)setPendingDelete(null);}} access={access} onAccess={next=>{setAccess(next);if(pendingDelete&&next.isOwner){setUploadOpen(false);setConfirm(pendingDelete);setPendingDelete(null);}else if(pendingDelete&&next.unlocked)toast.error("Deletion requires the owner password.");}} onSaved={saved} projects={projects} preferredProjectId={uploadProject} purpose={uploadPurpose} onProjectSaved={projectSaved}/>
  <Dialog open={!!editing} onOpenChange={open=>{if(!open&&!editBusy)setEditing(null);}}><DialogContent className="atlas-dialog"><DialogHeader><DialogTitle>Edit file details</DialogTitle><DialogDescription>Choose its project and the author displayed beside this file.</DialogDescription></DialogHeader>
   <form className="dialog-form" onSubmit={saveFileDetails}>
    <label className="field-label">Project<NativeSelect required value={editProject} disabled={editBusy} onChange={e=>setEditProject(e.target.value)}><option value="" disabled>Choose a project</option>{projects.map(project=><option key={project.id} value={project.id}>{project.name}</option>)}</NativeSelect></label>
    {!projects.length&&<p className="small-note">Create a project with the folder + button in the project panel, then move this file into it.</p>}
    <label className="field-label">File title<input required maxLength={120} disabled={editBusy} value={editName} onChange={e=>setEditName(e.target.value)}/></label>
    <label className="field-label">Author<input maxLength={120} disabled={editBusy} value={editAuthor} onChange={e=>setEditAuthor(e.target.value)} placeholder="Who recorded this file?"/></label>
    {editError&&<p className="form-error" role="alert">{editError}</p>}
    <div className="dialog-actions"><Button type="button" variant="outline" disabled={editBusy} onClick={()=>setEditing(null)}>Cancel</Button><Button type="submit" className="wine-button" disabled={editBusy||!editProject||!editName.trim()}>{editBusy?"Saving…":"Save changes"}</Button></div>
   </form>
  </DialogContent></Dialog>
  <Dialog open={!!selection} onOpenChange={v=>{if(!v)setSelection(null);}}>
   <DialogContent className={"atlas-dialog photo-dialog "+(!viewed?"waypoint-dialog":"")}>
    <DialogHeader><DialogTitle>{selection?.point.name||"Field photograph"}</DialogTitle><DialogDescription>{selection?.trip.name}{viewed?" · Photograph "+(viewerIndex+1)+" of "+viewerPhotos.length:" · Waypoint"}</DialogDescription></DialogHeader>
    {viewed&&<div className="photo-viewer"><PhotoImage key={viewed.photo.url} photo={viewed.photo}/>{viewerPhotos.length>1&&<><button className="photo-prev" aria-label="Previous photograph" onClick={()=>nextPhoto(-1)}><ChevronLeft size={23}/></button><button className="photo-next" aria-label="Next photograph" onClick={()=>nextPhoto(1)}><ChevronRight size={23}/></button></>}</div>}
    {selection&&<div className="photo-info"><span><MapPin size={15}/>{selection.point.coordinates[1].toFixed(6)}°, {selection.point.coordinates[0].toFixed(6)}°</span>{selection.point.coordinates[2]!==undefined&&<span><Mountain size={15}/>{Math.round(selection.point.coordinates[2])} m</span>}<button onClick={()=>{map.current?.focus(selection.point);setSelection(null);}}><Crosshair size={15}/>Locate on map</button></div>}
    {viewed&&selection&&<Button variant="outline" onClick={()=>requestDelete("photo:"+selection.trip.id+":"+viewed.photo.url.split("/").pop())}><Trash2 size={15}/>Remove photo</Button>}
    {selection?.point.description&&<p className="waypoint-description">{selection.point.description}</p>}
   </DialogContent>
  </Dialog>
  <Dialog open={accessOpen} onOpenChange={setAccessOpen}><DialogContent className="atlas-dialog access-dialog"><DialogHeader><div className="dialog-icon"><LockKeyhole size={22}/></div><DialogTitle>Upload access</DialogTitle><DialogDescription>One shared password for your trusted fieldwork group.</DialogDescription></DialogHeader>
   <div className="access-state"><span className="access-status-icon">{access?.unlocked?<Unlock size={18}/>:<LockKeyhole size={18}/>}</span><div><strong>{access?.unlocked?"Uploads are unlocked":"Uploads are password protected"}</strong><p>Viewing the map does not require a password. Upload access lasts for eight hours in this tab. To enable delete buttons, lock uploads if already unlocked, then unlock using your owner password.</p></div></div>
   {!access?.unlocked?<Button className="wine-button" onClick={()=>{setAccessOpen(false);openUpload();}}>Unlock uploads<ArrowRightIcon/></Button>:<Button variant="outline" onClick={async()=>{try{await api("/api/access",jsonRequest({action:"lock"}));setAccess(await api<Access>("/api/access"));toast.success("Uploads locked.");}catch(e){toast.error((e as Error).message);}}}>Lock uploads</Button>}
   {access?.isOwner&&access.unlocked&&<button className="text-button" onClick={()=>setConfirm("drafts")}>Clear unfinished uploads</button>}
  </DialogContent></Dialog>
  <AlertDialog open={!!confirm} onOpenChange={v=>{if(!v&&!removing)setConfirm(null);}}><AlertDialogContent className="atlas-dialog"><AlertDialogHeader><AlertDialogTitle>{confirm==="drafts"?"Clear unfinished uploads?":confirm?.startsWith("project:")?"Delete this project and all its files?":confirm?.startsWith("photo:")?"Remove this photo?":"Delete this file?"}</AlertDialogTitle><AlertDialogDescription>{confirm==="drafts"?"This removes incomplete uploads, including any currently in progress. Completed files are kept.":confirm?.startsWith("project:")?"This permanently deletes the project and every file, route, and photograph inside it. Keep your own copies before deleting.":confirm?.startsWith("photo:")?"This removes the photo from the website’s map and gallery. Waypoints and routes are kept. The original KMZ download still contains the photo.":"The saved route, photographs, and original file will be permanently removed from this website. Keep your own copy before deleting."}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={removing}>Cancel</AlertDialogCancel><AlertDialogAction disabled={removing} className="wine-button" onClick={e=>{e.preventDefault();void removeConfirmed();}}>{removing?"Deleting…":confirm==="drafts"?"Clear uploads":confirm?.startsWith("project:")?"Delete project":confirm?.startsWith("photo:")?"Remove photo":"Delete file"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  <Toaster position="bottom-right" richColors/>
 </SidebarProvider>;
}
function ArrowRightIcon(){return <ChevronRight size={17}/>;}
