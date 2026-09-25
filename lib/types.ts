export type Coordinate = [number, number, number?];
export type Route = { name: string; coordinates: Coordinate[] };
export type FieldPhoto = { id: string; url: string; name: string };
export type Waypoint = { id: string; name: string; description: string; coordinates: Coordinate; photos: FieldPhoto[]; time?: string };
export type TripData = { routes: Route[]; points: Waypoint[]; warnings: string[] };
export type Project = { id: string; name: string; createdAt: string; workspace?: "field-map" | "urg-2026" };
// A Trip is one imported file; a project can contain any number of these files.
export type TripSummary = { id: string; projectId: string | null; author: string; name: string; date: string | null; note: string; color: string; distance: number; routeCount: number; pointCount: number; photoCount: number; fileName: string; size: number; createdAt: string; archive?: boolean; cover?: string; sourceUrl?: string };
export type Trip = TripSummary & TripData;
export type Access = { configured: boolean; unlocked: boolean; isOwner: boolean };
export const ROUTE_COLORS = ["#b6324d", "#d17f3c", "#347f91", "#7165aa", "#647d40", "#bd596c", "#4279bd", "#169b62", "#00a6d6", "#374151"];

export function routeDistance(routes: Route[]): number {
  let sum=0;
  const rad=Math.PI/180;
  for(const route of routes) for(let i=1;i<route.coordinates.length;i++) {
    const a=route.coordinates[i-1], b=route.coordinates[i];
    const h=Math.sin((b[1]-a[1])*rad/2)**2 + Math.cos(a[1]*rad)*Math.cos(b[1]*rad)*Math.sin((b[0]-a[0])*rad/2)**2;
    sum += 6371 * 2 * Math.asin(Math.min(1,Math.sqrt(h)));
  }
  return sum;
}
