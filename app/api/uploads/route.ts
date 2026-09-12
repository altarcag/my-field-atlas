import { access, ApiError, db, errorResponse, removeTrip, requireWrite, type TripRow } from "@/lib/server";
export const dynamic="force-dynamic";
export async function DELETE(request:Request) {
  try {
    const state=await requireWrite(request);if(!state.isOwner)throw new ApiError("Only the owner can clear unfinished uploads.",403);
    const rows=await db().prepare("SELECT * FROM atlas_trips WHERE status='draft'").all<TripRow>();
    for(const row of rows.results)await removeTrip(row);
    return Response.json({removed:rows.results.length});
  }catch(e){return errorResponse(e);}
}
