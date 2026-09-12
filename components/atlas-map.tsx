"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { Map as LibreMap, GeoJSONSource, StyleSpecification, Marker } from "maplibre-gl";
import type { FeatureCollection, Feature, Geometry } from "geojson";
import { AlertCircle, LoaderCircle, RotateCcw } from "lucide-react";
import { apiUrl } from "@/lib/client-api";
import type { Trip, Waypoint } from "@/lib/types";
import "maplibre-gl/dist/maplibre-gl.css";

export type MapMode="map"|"satellite"|"terrain";
export type MapHandle={fit:(trips?:Trip[])=>void;focus:(point:Waypoint)=>void};
type Props={trips:Trip[];mode:MapMode;selectedId:string|null;photosVisible:boolean;onPoint:(trip:Trip,point:Waypoint)=>void;onBackground:()=>void;onMove:(lng:number,lat:number,zoom:number)=>void};
const EMPTY:FeatureCollection={type:"FeatureCollection",features:[]};
export const BASE_STYLE:StyleSpecification={
 version:8,
 sources:{
  osm:{type:"raster",tiles:["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],tileSize:256,maxzoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'},
  satellite:{type:"raster",tiles:["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],tileSize:256,maxzoom:19,attribution:'Imagery © <a href="https://www.esri.com/" target="_blank" rel="noopener">Esri</a>, Maxar, Earthstar Geographics, and the GIS User Community'},
 },
 layers:[
  {id:"base",type:"background",paint:{"background-color":"#e7ecec"}},
  {id:"osm",type:"raster",source:"osm",paint:{"raster-saturation":-.3,"raster-contrast":.02,"raster-fade-duration":200}},
  {id:"satellite",type:"raster",source:"satellite",layout:{visibility:"none"},paint:{"raster-fade-duration":200}},
 ]
};
const AtlasMap=forwardRef<MapHandle,Props>(function AtlasMap(props,ref) {
 const container=useRef<HTMLDivElement>(null),mapRef=useRef<LibreMap|null>(null),latest=useRef(props);
 latest.current=props;
 const markerClass=useRef<typeof Marker|null>(null),markers=useRef<Marker[]>([]),fitted=useRef<string|null>(null);
 const [ready,setReady]=useState(false),[error,setError]=useState(""),[retry,setRetry]=useState(0);
 function fit(trips=latest.current.trips) {
  const map=mapRef.current;if(!map)return;
  const all=trips.flatMap(t=>[...t.routes.flatMap(r=>r.coordinates),...t.points.map(p=>p.coordinates)]);
  if(!all.length){map.flyTo({center:[34.4,39.2],zoom:6.2,pitch:latest.current.mode==="terrain"?58:0,bearing:0});return;}
  // Unwrap longitudes around the first point so dateline-crossing tracks remain local.
  const anchor=all[0][0];
  const lngs=all.map(p=>anchor+((p[0]-anchor+540)%360)-180);
  let west=Infinity,east=-Infinity,south=Infinity,north=-Infinity;
  all.forEach((p,i)=>{west=Math.min(west,lngs[i]);east=Math.max(east,lngs[i]);south=Math.min(south,p[1]);north=Math.max(north,p[1]);});
  const rect=map.getContainer().getBoundingClientRect();
  const panel=document.querySelector(".trip-panel:not(.hidden-panel)")?.getBoundingClientRect();
  const strip=document.querySelector(".photo-strip")?.getBoundingClientRect();
  const mobile=window.innerWidth<768;
  const left=panel&&!mobile?Math.min(panel.right-rect.left+25,rect.width*.48):35;
  const bottom=Math.min(rect.height*.58,Math.max(70,strip?rect.bottom-strip.top+20:0,mobile&&panel?rect.bottom-panel.top+20:0));
  map.fitBounds([[west,south],[east,north]],{padding:{top:Math.min(115,rect.height*.22),bottom,left,right:Math.min(80,rect.width*.14)},maxZoom:16,duration:850});
 }
 useImperativeHandle(ref,()=>({fit,focus(point){const map=mapRef.current;if(map)map.easeTo({center:[point.coordinates[0],point.coordinates[1]],zoom:Math.max(map.getZoom(),15),duration:700});}}));
 useEffect(()=>{
  let disposed=false;let observer:ResizeObserver|undefined;
  setReady(false);setError("");fitted.current=null;
  import("maplibre-gl").then(gl=>{
   if(disposed||!container.current)return;
   gl.setWorkerUrl(__MAPLIBRE_WORKER_URL__);
   markerClass.current=gl.Marker;
   const map=new gl.Map({container:container.current,style:structuredClone(BASE_STYLE),center:[34.4,39.2],zoom:6.2,maxZoom:19,maxPitch:80,attributionControl:false,canvasContextAttributes:{antialias:true}});
   mapRef.current=map;
   map.addControl(new gl.NavigationControl({visualizePitch:true}),"top-right");
   map.addControl(new gl.ScaleControl({unit:"metric",maxWidth:100}),"bottom-right");
   map.addControl(new gl.AttributionControl({compact:false}),"bottom-right");
   observer=new ResizeObserver(()=>map.resize());observer.observe(container.current);
   let errors=0;
   map.on("error",()=>{errors++;if(errors>2)setError("Some map tiles couldn’t load. Try another map layer.");});
   map.on("sourcedata",e=>{if(e.isSourceLoaded && (e.sourceId==="osm"||e.sourceId==="satellite")){errors=0;setError("");}});
   map.on("click",()=>latest.current.onBackground());
   map.on("moveend",()=>{const c=map.getCenter();latest.current.onMove(c.lng,c.lat,map.getZoom());});
   map.on("load",()=>{
    map.addSource("trips-routes",{type:"geojson",data:EMPTY});
    map.addLayer({id:"route-outline",type:"line",source:"trips-routes",layout:{"line-cap":"round","line-join":"round"},paint:{"line-color":"#ffffff","line-width":7,"line-opacity":.9}});
    map.addLayer({id:"route-line",type:"line",source:"trips-routes",layout:{"line-cap":"round","line-join":"round"},paint:{"line-color":["get","color"],"line-width":["case",["get","selected"],4.5,3],"line-opacity":.95}});
    setReady(true);latest.current.onMove(34.4,39.2,6.2);
   });
  }).catch(()=>setError("The map could not start. This browser needs WebGL; try an updated Chrome, Firefox, or Safari."));
  return ()=>{disposed=true;observer?.disconnect();markers.current.forEach(marker=>marker.remove());markers.current=[];mapRef.current?.remove();mapRef.current=null;};
 },[retry]);
 useEffect(()=>{
  const map=mapRef.current;if(!ready||!map)return;
  const routes:Feature<Geometry>[]=[];
  props.trips.forEach(t=>{
   t.routes.forEach(r=>routes.push({type:"Feature",properties:{color:t.color,selected:t.id===props.selectedId},geometry:{type:"LineString",coordinates:r.coordinates.map(c=>[c[0],c[1]])}}));

  });
  (map.getSource("trips-routes") as GeoJSONSource).setData({type:"FeatureCollection",features:routes});
 },[ready,props.trips,props.selectedId,props.photosVisible]);
 useEffect(()=>{
  const map=mapRef.current,MarkerClass=markerClass.current;if(!ready||!map||!MarkerClass)return;
  markers.current.forEach(marker=>marker.remove());markers.current=[];
  for(const trip of props.trips)for(const point of trip.points){
   const photo=point.photos[0];if(photo&&!props.photosVisible)continue;
   let marker:Marker;
   if(photo){
    const shell=document.createElement("div");shell.className="map-photo-marker";shell.style.setProperty("--marker-color",trip.color);
    const button=document.createElement("button");button.type="button";button.className="map-photo-button";
    button.setAttribute("aria-label",`Open photo: ${point.name} · ${trip.name}`);button.title=point.name+" · "+trip.name;
    const image=document.createElement("img");image.src=apiUrl(photo.url);image.alt=photo.name;image.loading="lazy";image.decoding="async";
    image.addEventListener("error",()=>{image.remove();const fallback=document.createElement("span");fallback.className="map-photo-fallback";fallback.textContent="Photo";button.insertBefore(fallback,button.firstChild);},{once:true});
    button.appendChild(image);
    if(point.photos.length>1){const count=document.createElement("span");count.className="map-photo-count";count.textContent=String(point.photos.length);button.appendChild(count);}
    button.addEventListener("click",e=>{e.stopPropagation();latest.current.onPoint(trip,point);});shell.appendChild(button);
    marker=new MarkerClass({element:shell,anchor:"bottom",subpixelPositioning:true});
   }else{
    marker=new MarkerClass({color:trip.color,scale:.85});const element=marker.getElement();
    element.classList.add("map-waypoint-marker");element.tabIndex=0;element.setAttribute("role","button");
    element.setAttribute("aria-label",`Open waypoint: ${point.name} · ${trip.name}`);element.title=point.name+" · "+trip.name;
    const open=()=>latest.current.onPoint(trip,point);
    element.addEventListener("click",e=>{e.stopPropagation();open();});
    element.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();open();}});
   }
   marker.setLngLat([point.coordinates[0],point.coordinates[1]]).addTo(map);markers.current.push(marker);
  }
  return()=>{markers.current.forEach(marker=>marker.remove());markers.current=[];};
 },[ready,props.trips,props.photosVisible]);
 useEffect(()=>{
  if(!ready || !props.selectedId || fitted.current===props.selectedId)return;
  const selected=props.trips.find(t=>t.id===props.selectedId);
  if(selected){fit([selected]);fitted.current=props.selectedId;}
 },[ready,props.selectedId,props.trips]);
 useEffect(()=>{
  const map=mapRef.current;if(!ready||!map)return;
  setError("");
  map.setLayoutProperty("osm","visibility",props.mode==="map"?"visible":"none");
  map.setLayoutProperty("satellite","visibility",props.mode!=="map"?"visible":"none");
  if(props.mode==="terrain") {
   if(!map.getSource("terrain"))map.addSource("terrain",{type:"raster-dem",url:"https://tiles.mapterhorn.com/tilejson.json",attribution:'Terrain: <a href="https://mapterhorn.com/attribution" target="_blank" rel="noopener">Mapterhorn</a>'});
   map.setTerrain({source:"terrain",exaggeration:1.2});
   map.easeTo({pitch:60,bearing:-20,duration:900});
  } else {map.setTerrain(null);map.easeTo({pitch:0,bearing:0,duration:700});}
 },[ready,props.mode]);
 return <div className="map-renderer">
  <div ref={container} className="map-canvas" aria-label="Interactive map of field trip routes and photographs" />
  {!ready&&!error&&<div className="map-loading" role="status"><LoaderCircle className="spin" size={18}/> Opening the map</div>}
  {error&&<div className="map-error" role="alert"><AlertCircle size={17}/><span>{error}</span><button onClick={()=>setRetry(n=>n+1)} aria-label="Reload map"><RotateCcw size={16}/></button></div>}
 </div>;
});
export default AtlasMap;
