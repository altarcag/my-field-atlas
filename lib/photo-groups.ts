import type { Trip, Waypoint } from "./types";

export type PhotoPoint = { trip: Trip; point: Waypoint };
export type PhotoGroup = { members: PhotoPoint[]; count: number };

// Horizontal WGS84-coordinate distance in metres. Original coordinates are never modified.
export function photoDistance(a: Waypoint, b: Waypoint): number {
 const rad = Math.PI / 180;
 const [lngA, latA] = a.coordinates, [lngB, latB] = b.coordinates;
 const h = Math.sin((latB-latA)*rad/2)**2
  + Math.cos(latA*rad)*Math.cos(latB*rad)*Math.sin((lngB-lngA)*rad/2)**2;
 return 6371008.8 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function groupMapPhotos(trips: Trip[]): PhotoGroup[] {
 const groups: PhotoGroup[] = [];
 // Stable ordering keeps membership independent of file loading order.
 const entries = trips.flatMap(trip => trip.points
  .filter(point => point.photos.length > 0).map(point => ({trip, point})))
  .sort((a,b) => a.trip.id.localeCompare(b.trip.id) || a.point.id.localeCompare(b.point.id));
 for (const entry of entries) {
  // Complete-link grouping avoids chains whose endpoints exceed five metres.
  const group = groups.find(candidate =>
   candidate.members.every(member => photoDistance(member.point, entry.point) <= 5 + 1e-7));
  if (group) {
   group.members.push(entry);
   group.count += entry.point.photos.length;
  } else {
   groups.push({members:[entry], count:entry.point.photos.length});
  }
 }
 return groups;
}
