import type { Project, TripSummary } from "./types";
export type ProjectGroup={id:string;name:string;files:TripSummary[];unassigned:boolean};
export function groupFiles(projects:Project[],files:TripSummary[]):ProjectGroup[]{
 const groups:ProjectGroup[]=projects.map(project=>({id:project.id,name:project.name,files:[],unassigned:false}));
 const byId=new Map(groups.map(group=>[group.id,group]));
 const unassigned:ProjectGroup={id:"__unassigned__",name:"Unassigned files",files:[],unassigned:true};
 for(const file of files)(file.projectId?byId.get(file.projectId)||unassigned:unassigned).files.push(file);
 if(unassigned.files.length)groups.push(unassigned);
 for(const group of groups)group.files.sort((a,b)=>(a.date&&b.date?a.date.localeCompare(b.date):0)||a.name.localeCompare(b.name,undefined,{numeric:true}));
 return groups;
}
export function groupVisibility(files:TripSummary[],visible:Set<string>):boolean|"indeterminate"{
 const count=files.filter(file=>visible.has(file.id)).length;
 return count===0?false:count===files.length?true:"indeterminate";
}
