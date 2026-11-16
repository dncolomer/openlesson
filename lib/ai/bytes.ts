export function bytesToBase64(bytes: Uint8Array | Buffer | string): string {
  if (typeof bytes === "string") return bytes.replace(/\s+/g, "");
  return Buffer.from(bytes).toString("base64");
}
