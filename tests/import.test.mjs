import test from "node:test";
import assert from "node:assert/strict";
import { zipSync,strToU8 } from "fflate";
import { parseTrack } from "../.sites-runtime/check-modules/parse-track.mjs";
import { openKmz,prepareImport } from "../.sites-runtime/check-modules/kmz.mjs";
import { routeDistance } from "../.sites-runtime/check-modules/types.mjs";
import { tripDataSchema } from "../.sites-runtime/check-modules/validation.mjs";
const png=Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=","base64"));
function xml(contents){return '<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2"><Document>'+contents+"</Document></kml>";}
const track='<Placemark><name>Field route</name><LineString><coordinates>32.5,39.5,1100 32.51,39.51,1105 32.52,39.52,1110</coordinates></LineString></Placemark>';
function waypoint(ref='files/photo.png'){return '<Placemark><name>Outcrop A</name><description><![CDATA[<img src="'+ref+'">Bedded limestone]]></description><ExtendedData><Data name="wptPhotos"><value>'+ref+'</value></Data></ExtendedData><Point><coordinates>32.51,39.51,1105</coordinates></Point></Placemark>';}

test("a single intact AlpineQuest-style KMZ supplies route, located photos, and original image bytes",async()=>{
 const file=new File([zipSync({"doc.kml":strToU8(xml(track+waypoint())),"files/photo.png":png})],"Field day.kmz");
 const imported=await prepareImport(file);
 assert.equal(imported.data.routes.length,1);
 assert.deepEqual(imported.data.points[0].coordinates,[32.51,39.51,1105]);
 assert.equal(imported.data.points[0].photos.length,1,"duplicate description/ExtendedData references must collapse");
 assert.equal(imported.images.length,1);
 assert.deepEqual(await imported.images[0].read(),png);
 assert.equal(imported.data.warnings.length,0);
});
test("nested, URL-encoded Unicode photo paths resolve inside the KMZ",async()=>{
 const file=new File([zipSync({"day/doc.kml":strToU8(xml(track+waypoint("files/%C3%B6rnek%20kaya.PNG"))),"day/files/örnek kaya.PNG":png})],"Nested.kmz");
 const imported=await prepareImport(file);
 assert.equal(imported.images.length,1);assert.deepEqual(await imported.images[0].read(),png);
});
test("separate tracks and invalid coordinate gaps are never joined",()=>{
 const result=parseTrack(xml('<Placemark><MultiGeometry><LineString><coordinates>0,0 0,0.01 invalid 30,40 30,40.01</coordinates></LineString><LineString><coordinates>60,60 60,60.01</coordinates></LineString></MultiGeometry></Placemark>'));
 assert.equal(result.routes.length,3);
 assert.ok(routeDistance(result.routes)<4);
 assert.ok(result.warnings.some(w=>w.includes("invalid")));
});
test("gx:MultiTrack keeps segment boundaries and timestamps",()=>{
 const result=parseTrack(xml('<Placemark><name>Track</name><gx:MultiTrack><gx:Track><when>2026-09-01T08:00:00Z</when><gx:coord>32 39 100</gx:coord><gx:coord>32.01 39.01 105</gx:coord></gx:Track><gx:Track><gx:coord>33 39 100</gx:coord><gx:coord>33.01 39.01 105</gx:coord></gx:Track></gx:MultiTrack></Placemark>'));
 assert.equal(result.routes.length,2);assert.equal(result.suggestedDate,"2026-09-01");
});
test("missing local photos produce an explicit warning and never gain invented locations",async()=>{
 const file=new File([zipSync({"doc.kml":strToU8(xml(track+waypoint("missing.jpg")))})],"Missing.kmz");
 const result=await prepareImport(file);
 assert.equal(result.images.length,0);assert.equal(result.data.points[0].photos.length,0);assert.match(result.data.warnings[0],/could not be resolved/);
});
test("a KMZ without routes but with geotagged photos is valid",async()=>{
 const result=await prepareImport(new File([zipSync({"doc.kml":strToU8(xml(waypoint())),"files/photo.png":png})],"Photos.kmz"));
 assert.equal(result.data.routes.length,0);assert.equal(result.images.length,1);
});
test("standalone KML keeps routes and waypoints and reports missing local photos",async()=>{
 const result=await prepareImport(new File([xml(track+waypoint())],"Day 2.kml"));
 assert.equal(result.data.routes.length,1);assert.equal(result.data.points.length,1);
 assert.equal(result.images.length,0);assert.match(result.data.warnings[0],/loose KML/);
});
test("untrusted XML declarations and unsafe archive paths are rejected",async()=>{
 assert.throws(()=>parseTrack('<!DOCTYPE kml [<!ENTITY x SYSTEM "file:///etc/passwd">]><kml>&x;</kml>'),/unsupported/);
 await assert.rejects(()=>openKmz(new Blob([zipSync({"../doc.kml":strToU8(xml(track))})])),/unsafe file path/);
 assert.throws(()=>parseTrack("<html>not a route</html>"),/Choose/);
});
test("damaged photo bytes fail CRC validation",async()=>{
 const bytes=zipSync({"doc.kml":strToU8(xml(track+waypoint())),"files/photo.png":png},{level:0});
 const signature=Array.from(png.subarray(0,8));let index=-1;
 for(let i=0;i<bytes.length-8;i++)if(signature.every((v,j)=>bytes[i+j]===v)){index=i;break;}
 assert.ok(index>0);bytes[index+20]^=1;
 const zip=await openKmz(new Blob([bytes]));
 await assert.rejects(()=>zip.read(zip.findPhoto("files/photo.png")),/integrity check/);
});
test("server validation rejects out-of-range coordinates, excessive text, and empty imports",()=>{
 assert.equal(tripDataSchema.safeParse({routes:[],points:[],warnings:[]}).success,false);
 const data=parseTrack(xml(track+waypoint()));delete data.suggestedDate;
 assert.equal(tripDataSchema.safeParse(data).success,true);
 data.points[0].coordinates=[32,100];
 assert.equal(tripDataSchema.safeParse(data).success,false);
});
