import { z } from "zod";
const coordinate=z.union([
  z.tuple([z.number().finite().min(-180).max(180),z.number().finite().min(-90).max(90)]),
  z.tuple([z.number().finite().min(-180).max(180),z.number().finite().min(-90).max(90),z.number().finite().min(-15000).max(100000)])
]);
export const tripDataSchema=z.object({
 routes:z.array(z.object({name:z.string().max(200),coordinates:z.array(coordinate).min(2).max(200000)})).max(1000),
 points:z.array(z.object({id:z.string().max(100),name:z.string().max(300),description:z.string().max(5000),coordinates:coordinate,time:z.string().max(100).optional(),photos:z.array(z.object({id:z.string().max(100),url:z.string().max(2048),name:z.string().max(500)})).max(100)})).max(2000),
 warnings:z.array(z.string().max(500)).max(20),
}).refine(d=>d.routes.reduce((n,r)=>n+r.coordinates.length,0)<=200000,"Too many track points.")
 .refine(d=>d.routes.length+d.points.length>0,"The trip contains no coordinates.")
 .refine(d=>d.points.reduce((n,p)=>n+p.photos.length,0)<=3000,"Too many photo references.");
export const beginSchema=z.object({
 projectId:z.string().uuid(),author:z.string().trim().max(120).default(""),
 name:z.string().trim().min(1).max(120),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
 note:z.string().max(2000),color:z.string().regex(/^#[a-fA-F0-9]{6}$/),fileName:z.string().max(250).regex(/\.(kmz|kml)$/i),
 size:z.number().int().min(1).max(512*1024*1024),
}).refine(d=>!/\.kml$/i.test(d.fileName)||d.size<=12*1024*1024,"KML documents must be smaller than 12 MB.");
export const projectSchema=z.object({name:z.string().trim().min(1).max(120)});
export const fileDetailsSchema=z.object({projectId:z.string().uuid(),name:z.string().trim().min(1).max(120),author:z.string().trim().max(120)});
