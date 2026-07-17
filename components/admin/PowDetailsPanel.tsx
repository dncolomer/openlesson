"use client";

import Link from "next/link";
import {
  formatFileSize,
  type AdminProofOfWorkDetails,
} from "@/lib/admin/proof-of-work";

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-2 text-xs">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="min-w-0 break-words text-neutral-300">{children}</dd>
    </div>
  );
}

export function PowDetailsPanel({ details }: { details: AdminProofOfWorkDetails }) {
  const metadataKeys = Object.keys(details.metadata || {});
  const hasMetadata = metadataKeys.length > 0;
  const hasBandPowers =
    details.bandPowers &&
    typeof details.bandPowers === "object" &&
    Object.keys(details.bandPowers).length > 0;

  return (
    <div className="mt-3 space-y-2 rounded-md border border-neutral-800 bg-neutral-950/60 p-3">
      <dl className="space-y-1.5">
        <DetailRow label="Type">{details.proofOfWorkType}</DetailRow>
        <DetailRow label="File">
          {details.fileName}
          <span className="text-neutral-500"> · {details.mimeType}</span>
          <span className="text-neutral-500"> · {formatFileSize(details.fileSize)}</span>
        </DetailRow>
        {(details.toolName || details.toolAction) && (
          <DetailRow label="Tool">
            {details.toolName || "—"}
            {details.toolAction ? (
              <span className="text-neutral-500"> · {details.toolAction}</span>
            ) : null}
          </DetailRow>
        )}
        {details.deviceName && <DetailRow label="Device">{details.deviceName}</DetailRow>}
        {details.sampleCount != null && (
          <DetailRow label="Samples">{details.sampleCount}</DetailRow>
        )}
        <DetailRow label="Chunk">{details.chunkIndex}</DetailRow>
        {details.timestampMs != null && (
          <DetailRow label="Timestamp ms">{details.timestampMs}</DetailRow>
        )}
        {details.workspaceId && (
          <DetailRow label="Workspace">
            <Link
              href={`/admin/workspaces/${details.workspaceId}`}
              className="text-blue-400 hover:text-blue-300 hover:underline"
            >
              {details.workspaceTitle || details.workspaceId}
            </Link>
          </DetailRow>
        )}
        {details.sessionId && (
          <DetailRow label="Session">
            <Link
              href={`/admin/sessions/${details.sessionId}`}
              className="text-blue-400 hover:text-blue-300 hover:underline"
            >
              {details.sessionId}
            </Link>
          </DetailRow>
        )}
        {details.blockId && (
          <DetailRow label="Block">
            <span className="font-mono text-[11px] text-neutral-400">{details.blockId}</span>
          </DetailRow>
        )}
        {details.createdByApiKeyId && (
          <DetailRow label="API key">
            <span className="font-mono text-[11px] text-neutral-400">
              {details.createdByApiKeyId}
            </span>
          </DetailRow>
        )}
        <DetailRow label="ID">
          <span className="font-mono text-[11px] text-neutral-400">{details.id}</span>
        </DetailRow>
      </dl>

      {hasMetadata && (
        <div>
          <div className="mb-1 text-[11px] uppercase tracking-wide text-neutral-500">Metadata</div>
          <pre className="max-h-48 overflow-auto rounded border border-neutral-800 bg-black/40 p-2 text-[11px] leading-relaxed text-neutral-400">
            {JSON.stringify(details.metadata, null, 2)}
          </pre>
        </div>
      )}

      {hasBandPowers && (
        <div>
          <div className="mb-1 text-[11px] uppercase tracking-wide text-neutral-500">Band powers</div>
          <pre className="max-h-32 overflow-auto rounded border border-neutral-800 bg-black/40 p-2 text-[11px] leading-relaxed text-neutral-400">
            {JSON.stringify(details.bandPowers, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
