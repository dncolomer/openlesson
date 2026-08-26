import { describe, expect, it } from "vitest";
import { parseJsonResponse } from "@/lib/tapbench/parse-json-response";

describe("parseJsonResponse", () => {
  it("parses JSON bodies", async () => {
    const res = new Response(JSON.stringify({ keys: [1] }), { status: 201 });
    const body = await parseJsonResponse<{ keys: number[] }>(res);
    expect(body.keys).toEqual([1]);
  });

  it("rejects empty bodies without Unexpected end of JSON input", async () => {
    const res = new Response("", { status: 500 });
    await expect(parseJsonResponse(res)).rejects.toThrow(/Empty response \(500\)/);
  });
});
