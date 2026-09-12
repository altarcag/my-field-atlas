import { DOMParser } from "@xmldom/xmldom";
import type { Element } from "@xmldom/xmldom";
import type { Coordinate, Route, TripData, Waypoint } from "./types";

const all = (el: Element, name: string): Element[] => Array.from(el.getElementsByTagName("*")).filter(n => n.localName === name);
const first = (el: Element, name: string) => all(el, name)[0];
const value = (el: Element, name: string) => first(el, name)?.textContent?.trim() || "";
const ownValue = (el: Element, name: string) => Array.from(el.childNodes).find(n => n.nodeType === 1 && (n as Element).localName === name)?.textContent?.trim() || "";
function coordinate(values: number[]): Coordinate | null {
  const [lng,lat,ele] = values;
  if (!Number.isFinite(lng) || !Number.isFinite(lat) || Math.abs(lng)>180 || Math.abs(lat)>90) return null;
  return Number.isFinite(ele) ? [lng,lat,ele] : [lng,lat];
}
function plain(s: string) {
  return s.replace(/<script[\s\S]*?<\/script>/gi,"").replace(/<style[\s\S]*?<\/style>/gi,"")
    .replace(/<br\s*\/?>/gi,"\n").replace(/<[^>]+>/g,"").replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").trim().slice(0,5000);
}
export function normalizePhotoUrl(s: string): string {
  try {
    const u=new URL(s);
    if(u.protocol!=="https:") return "";
    if(u.hostname==="github.com" && u.pathname.includes("/blob/")) return "https://raw.githubusercontent.com"+u.pathname.replace("/blob/","/");
    return u.href;
  } catch { return s.trim(); }
}
function photoRefs(el: Element) {
  const description=value(el,"description");
  const refs: string[]=[];
  for(const m of description.matchAll(/<img\b[^>]*\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi)) refs.push(m[1]||m[2]||m[3]);
  for(const d of all(el,"Data")) if(/^(wptPhotos|photo|photos|image)$/i.test(d.getAttribute("name")||"")) {
    const ref=value(d,"value"); if(ref) refs.push(...ref.split(/[\r\n]+/).filter(Boolean));
  }
  for(const d of all(el,"SimpleData")) if(/^(wptPhotos|photo|image)$/i.test(d.getAttribute("name")||"")) if(d.textContent) refs.push(d.textContent.trim());
  for(const link of all(el,"link")) {
    const href=link.getAttribute("href")||"";
    if(/\.(jpe?g|png|webp)(?:[?#]|$)/i.test(href)||value(link,"type").startsWith("image/")) refs.push(href);
  }
  if(el.localName==="PhotoOverlay") { const icon=first(el,"Icon"); if(icon) refs.push(value(icon,"href")); }
  return [...new Set(refs.map(r=>normalizePhotoUrl(r.replace(/&amp;/g,"&"))).filter(Boolean))];
}

export function parseTrack(xml: string): TripData & { suggestedDate: string | null } {
  if(xml.length>12*1024*1024) throw new Error("The route document exceeds 12 MB. Split the trip into smaller days.");
  if(/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("This XML contains unsupported document declarations.");
  let parseError=false;
  const doc=new DOMParser({onError: (level: string)=> { if(level!=="warning") parseError=true; }}).parseFromString(xml,"text/xml");
  if(parseError || !doc.documentElement) throw new Error("This file is not valid KML or GPX.");
  const root=doc.documentElement;
  const routes: Route[]=[], points: Waypoint[]=[], warnings: string[]=[], dates: string[]=[];
  let invalid=0;
  function addLine(name: string, coords: (Coordinate|null)[]) {
    let part: Coordinate[]=[];
    const flush=()=>{ if(part.length>1) routes.push({name:name.slice(0,200)||"GPS route",coordinates:part}); part=[]; };
    for(const p of coords) { if(p) part.push(p); else {invalid++;flush();} }
    flush();
  }
  function addPoint(el: Element, coords: Coordinate|null) {
    if(!coords) { invalid++;return; }
    const id="w"+points.length;
    const name=(ownValue(el,"name")||"Waypoint "+(points.length+1)).slice(0,300);
    const time=value(el,"when")||value(el,"time");
    if(time) dates.push(time);
    const photos=photoRefs(el).map((url,i)=>({id:id+"p"+i,url,name:url.split("/").pop()?.split("?")[0]||"Field photograph"}));
    points.push({id,name,description:plain(ownValue(el,"description")||ownValue(el,"desc")),coordinates:coords,photos,...(time?{time}: {})});
  }
  if(root.localName==="kml") {
    for(const pm of [...all(root,"Placemark"),...all(root,"PhotoOverlay")]) {
      const name=ownValue(pm,"name");
      for(const line of all(pm,"LineString")) addLine(name,value(line,"coordinates").trim().split(/\s+/).filter(Boolean).map(c=>coordinate(c.split(",").map(v=>v.trim()===""?NaN:Number(v)))));
      for(const track of all(pm,"Track")) {
        addLine(name,all(track,"coord").map(c=>coordinate((c.textContent||"").trim().split(/\s+/).map(Number))));
        const when=value(track,"when"); if(when) dates.push(when);
      }
      const p=first(pm,"Point");
      if(p) addPoint(pm,coordinate(value(p,"coordinates").split(/\s+/)[0].split(",").map(v=>v.trim()===""?NaN:Number(v))));
    }
    if(all(root,"NetworkLink").length) warnings.push("Linked KML documents are not fetched. Export a self-contained KMZ to include them.");
    if(all(root,"Polygon").length || all(root,"GroundOverlay").length) warnings.push("Polygon and ground-image overlays are not imported in this version.");
  } else if(root.localName==="gpx") {
    const gcoord=(el:Element)=>coordinate([Number(el.getAttribute("lon")??NaN),Number(el.getAttribute("lat")??NaN),value(el,"ele")?Number(value(el,"ele")):NaN]);
    for(const trk of all(root,"trk")) for(const seg of all(trk,"trkseg")) {
      const entries=all(seg,"trkpt");
      addLine(ownValue(trk,"name"),entries.map(gcoord));
      if(entries[0] && value(entries[0],"time")) dates.push(value(entries[0],"time"));
    }
    for(const rte of all(root,"rte")) addLine(ownValue(rte,"name"),all(rte,"rtept").map(gcoord));
    for(const wpt of all(root,"wpt")) addPoint(wpt,gcoord(wpt));
  } else throw new Error("Choose a KMZ, KML, or GPX file.");
  if(invalid) warnings.push(invalid+" invalid coordinate(s) were skipped; route gaps are preserved.");
  if(!routes.length&&!points.length) throw new Error("No GPS routes or located waypoints were found in this file.");
  if(routes.reduce((n,r)=>n+r.coordinates.length,0)>200000 || points.length>2000 || routes.length>1000) throw new Error("This track is too large. Export individual days or simplify the GPS track.");
  const firstDate=dates.filter(d=>/^\d{4}-\d{2}-\d{2}/.test(d)).sort()[0];
  return {routes,points,warnings,suggestedDate:firstDate?.slice(0,10)||null};
}
