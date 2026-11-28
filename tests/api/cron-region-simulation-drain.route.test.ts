import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockDrain } = vi.hoisted(() => ({
  mockDrain: vi.fn(),
}));

vi.mock("@/lib/region-simulation-jobs", () => ({
  drainRegionSimulationJobs: mockDrain,
}));

import { GET, POST } from "@/app/api/cron/region-simulation-drain/route";

describe("/api/cron/region-simulation-drain", () => {
  const prevCronSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    mockDrain.mockReset();
    process.env.CRON_SECRET = "super-secret-cron-token-123";
  });

  afterEach(() => {
    if (prevCronSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = prevCronSecret;
  });

  it("rejects requests without Authorization header", async () => {
    const req = new NextRequest("http://localhost/api/cron/region-simulation-drain");
    const res = await GET(req);
    expect(res.status).toBe(401);
    expect(mockDrain).not.toHaveBeenCalled();
  });

  it("rejects requests with wrong-length or mismatched bearer tokens", async () => {
    const shortReq = new NextRequest("http://localhost/api/cron/region-simulation-drain", {
      headers: { authorization: "Bearer short" },
    });
    expect((await GET(shortReq)).status).toBe(401);

    const wrongReq = new NextRequest("http://localhost/api/cron/region-simulation-drain", {
      headers: { authorization: "Bearer super-secret-cron-token-999" },
    });
    expect((await POST(wrongReq)).status).toBe(401);
    expect(mockDrain).not.toHaveBeenCalled();
  });

  it("drains queued simulation jobs when authorized", async () => {
    mockDrain.mockResolvedValue(["job-1", "job-2"]);
    const req = new NextRequest("http://localhost/api/cron/region-simulation-drain", {
      headers: { authorization: "Bearer super-secret-cron-token-123" },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, ticked: 2, jobIds: ["job-1", "job-2"] });
    expect(mockDrain).toHaveBeenCalledTimes(1);
  });
});
