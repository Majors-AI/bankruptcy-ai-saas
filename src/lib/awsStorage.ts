// V1 scaffolding for AWS S3 client document storage.
//
// V1 keeps document WRITES on Supabase Storage (matches the existing pattern
// in DocumentChecklist.tsx and the questionnaire .jsx). This module is
// scaffolded today for the ZIP-generation pipeline only — reads from
// Supabase Storage and writes ZIP outputs to S3 for the temporary download
// links.
//
// Full doc-store migration to S3 is V1.1. Touchpoints planned for that
// migration:
//   - AWS SDK integration (@aws-sdk/client-s3, @aws-sdk/s3-request-presigner)
//   - IAM role + per-firm bucket policies
//   - Lifecycle rules (24-hour expiry on /client-zips/*; long-term on /docs/*)
//   - Storage-key prefix per firm (firms.aws_storage_prefix column already
//     exists in 20260527020000_firms_and_user_profiles.sql)

export interface S3DocumentRef {
  firm_id: string;
  client_id: string;
  phase: string;
  filename: string;
  bucket?: string;
}

// Canonical S3 key layout. Keep this in sync with the lifecycle policies
// added in V1.1 — the key prefix drives expiry rules.
export function buildS3Key(ref: S3DocumentRef): string {
  return `${ref.firm_id}/${ref.client_id}/${ref.phase}/${ref.filename}`;
}

// Convenience builder for ZIP exports — distinct prefix so the V1.1 lifecycle
// rule can clean up 24-hour ZIPs without touching the document store.
export function buildZipExportKey(firmId: string, clientId: string, exportId: string): string {
  return `client-zips/${firmId}/${clientId}/${exportId}.zip`;
}
