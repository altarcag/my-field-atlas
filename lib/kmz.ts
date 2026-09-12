import { inflateSync } from "fflate";
import { parseTrack } from "./parse-track";
import type { TripData } from "./types";

type Entry={name:string; compressed:number; size:number; offset:number; method:number; crc:number};
const MAX_ARCHIVE=512*1024*1024, MAX_UNPACKED=768*1024*1024;
export const CHUNK_SIZE=5*1024*1024;
const decoder=new TextDecoder();
const pathKey=(s:string)=>s.replace(/\\/g,"/").split("/").filter(p=>p&&p!==".").join("/").normalize("NFC");
const crcTable=Uint32Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
function crc32(data:Uint8Array) {let c=0xffffffff;for(const byte of data)c=crcTable[(c^byte)&255]^(c>>>8);return (c^0xffffffff)>>>0;}

export async function openKmz(file:Blob) {
  if(file.size>MAX_ARCHIVE) throw new Error("The maximum upload is 512 MB. Split larger trips into separate days.");
  const tail=new Uint8Array(await file.slice(Math.max(0,file.size-65557)).arrayBuffer());
  const tv=new DataView(tail.buffer); let eocd=-1;
  for(let i=tail.length-22;i>=0;i--) if(tv.getUint32(i,true)===0x06054b50 && i+22+tv.getUint16(i+20,true)===tail.length){eocd=i;break;}
  if(eocd<0) throw new Error("This KMZ is not a complete ZIP archive.");
  const count=tv.getUint16(eocd+10,true), length=tv.getUint32(eocd+12,true), offset=tv.getUint32(eocd+16,true);
  if(tv.getUint16(eocd+4,true)||tv.getUint16(eocd+6,true)||count===65535||offset===0xffffffff||length>4*1024*1024||offset+length>file.size||count>4000) throw new Error("This archive uses an unsupported ZIP layout. Export a smaller standard KMZ.");
  const central=new Uint8Array(await file.slice(offset,offset+length).arrayBuffer()),v=new DataView(central.buffer);
  const entries=new Map<string,Entry>();let at=0,total=0;
  for(let i=0;i<count;i++) {
    if(at+46>central.length||v.getUint32(at,true)!==0x02014b50) throw new Error("The KMZ directory is damaged.");
    const flags=v.getUint16(at+8,true),method=v.getUint16(at+10,true),crc=v.getUint32(at+16,true),compressed=v.getUint32(at+20,true),size=v.getUint32(at+24,true);
    const nameLength=v.getUint16(at+28,true),extra=v.getUint16(at+30,true),comment=v.getUint16(at+32,true),local=v.getUint32(at+42,true);
    if(at+46+nameLength+extra+comment>central.length) throw new Error("The KMZ directory is incomplete.");
    const original=decoder.decode(central.subarray(at+46,at+46+nameLength));
    at+=46+nameLength+extra+comment;
    if(original.endsWith("/")) continue;
    if(flags&1 || ![0,8].includes(method)) throw new Error("Encrypted or unusually compressed KMZ files are not supported.");
    if(/(^|[\\/])\.\.([\\/]|$)|^[\\/]|^[a-z]:|\0/i.test(original)) throw new Error("The KMZ contains an unsafe file path.");
    if(size===0xffffffff||compressed===0xffffffff||local===0xffffffff||size>40*1024*1024||local+compressed>file.size) throw new Error("A file inside this KMZ is too large or damaged.");
    total+=size;if(total>MAX_UNPACKED) throw new Error("This archive expands beyond 768 MB. Split the trip into smaller files.");
    const name=pathKey(original);
    if(entries.has(name)) throw new Error("The KMZ contains duplicate file paths.");
    entries.set(name,{name,method,compressed,size,offset:local,crc});
  }
  async function read(entry:Entry) {
    const header=new DataView(await file.slice(entry.offset,entry.offset+30).arrayBuffer());
    if(header.byteLength!==30||header.getUint32(0,true)!==0x04034b50) throw new Error("A KMZ file header is damaged.");
    const start=entry.offset+30+header.getUint16(26,true)+header.getUint16(28,true);
    if(start+entry.compressed>offset) throw new Error("A KMZ file extends outside its data area.");
    const compressed=new Uint8Array(await file.slice(start,start+entry.compressed).arrayBuffer());
    const data=entry.method===0?compressed:inflateSync(compressed,{out:new Uint8Array(entry.size)});
    if(data.length!==entry.size || crc32(data)!==entry.crc) throw new Error("A file inside this KMZ failed its integrity check.");
    return data;
  }
  const kmls=[...entries.values()].filter(e=>/\.kml$/i.test(e.name));
  if(!kmls.length) throw new Error("No KML document was found inside the KMZ.");
  const main=kmls.find(e=>e.name.toLowerCase()==="doc.kml")||kmls.find(e=>/\/doc\.kml$/i.test(e.name))||kmls[0];
  if(main.size>12*1024*1024) throw new Error("The KML document exceeds 12 MB.");
  const parsed=parseTrack(decoder.decode(await read(main)));
  if(kmls.length>1) parsed.warnings.push("Multiple KML documents found. Imported "+main.name+"; linked subdocuments are not combined.");
  const folder=main.name.includes("/")?main.name.slice(0,main.name.lastIndexOf("/")+1):"";
  function findPhoto(ref:string) {
    if(/^[a-z]+:|^\/\//i.test(ref)) return undefined;
    let decoded=ref;try{decoded=decodeURIComponent(ref);}catch{}
    const normalized=pathKey(decoded.split(/[?#]/)[0]);
    const stack:string[]=[];
    for(const part of (folder+normalized).split("/")){if(!part||part===".")continue;if(part===".."){if(!stack.length)return undefined;stack.pop();}else stack.push(part);}
    const resolved=pathKey(stack.join("/"));
    const exact=entries.get(resolved)||entries.get(normalized);
    if(exact) return exact;
    const matches=[...entries.values()].filter(e=>e.name.toLowerCase()===resolved.toLowerCase());
    return matches.length===1?matches[0]:undefined;
  }
  return {parsed,findPhoto,read};
}

export type PreparedImport={data:TripData;suggestedDate:string|null;images:{ref:string;read:()=>Promise<Uint8Array>}[];externalCount:number};
export async function prepareImport(file:File):Promise<PreparedImport> {
  const extension=file.name.split(".").pop()?.toLowerCase();
  if(extension!=="kmz" && extension!=="kml") throw new Error("Choose a .kmz or .kml file exported by your GPS app.");
  if(file.size>MAX_ARCHIVE) throw new Error("Choose a file smaller than 512 MB.");
  if(extension==="kml" && file.size>12*1024*1024) throw new Error("KML documents must be smaller than 12 MB.");
  const zip=extension==="kmz"?await openKmz(file):null;
  const parsed=zip?.parsed||parseTrack(await file.text());
  const images:PreparedImport["images"]=[], known=new Set<string>();let missing=0,externalCount=0;
  const data:TripData={routes:parsed.routes,points:parsed.points,warnings:[...parsed.warnings]};
  for(const point of data.points) point.photos=point.photos.filter(photo=>{
    if(/^https:\/\//i.test(photo.url)) {externalCount++;return true;}
    const entry=zip?.findPhoto(photo.url);
    if(!entry || !/\.(jpe?g|png|webp)$/i.test(entry.name)) {missing++;return false;}
    if(!known.has(photo.url)){known.add(photo.url);images.push({ref:photo.url,read:()=>zip!.read(entry)});}
    return true;
  });
  if(images.length>1000) throw new Error("A trip can contain up to 1,000 embedded photos. Split this trip into smaller days.");
  if(missing) data.warnings.push(missing+" photo reference(s) could not be resolved. Export KMZ with photographs included; loose KML cannot include local photos.");
  if(externalCount) data.warnings.push(externalCount+" photo reference(s) link to external websites. They remain dependent on those websites.");
  return {data,suggestedDate:parsed.suggestedDate,images,externalCount};
}

export async function webPhoto(bytes:Uint8Array):Promise<Blob> {
  const blob=new Blob([bytes as BlobPart]);
  let bitmap:ImageBitmap;
  try {bitmap=await createImageBitmap(blob,{imageOrientation:"from-image"});}catch {throw new Error("An embedded photo could not be decoded. Use JPEG, PNG, or WebP photos.");}
  try {
    if(bitmap.width*bitmap.height>80000000) throw new Error("An embedded photograph is larger than 80 megapixels.");
    const ratio=Math.min(1,2000/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));
    const ctx=canvas.getContext("2d");if(!ctx) throw new Error("This browser cannot prepare photographs.");
    ctx.fillStyle="#ffffff";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
    const result=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,"image/jpeg",.86));
    if(!result) throw new Error("A photograph could not be prepared.");
    return result;
  } finally {bitmap.close();}
}
