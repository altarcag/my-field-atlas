declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    UPLOAD_PASSWORD?: string;
    ADMIN_PASSWORD?: string;
    ALLOWED_ORIGIN?: string;
  }
}
declare const __MAPLIBRE_WORKER_URL__: string;
