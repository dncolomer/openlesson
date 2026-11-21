import { describe, expect, it } from "vitest";
import {
  LTI_AGS_TAG_AVERAGE,
  LTI_AGS_TAG_LATEST,
  ltiAgsComment,
  ltiUnsysScores,
  meanUnsysDistance,
} from "@/lib/lti/unsys-score";
import { agsScoresForUnsys, buildUnsysLineItems } from "@/lib/lti/ags";

describe("lti unsys scores", () => {
  it("averages finite distances and reads projectedPolicy.distance", () => {
    expect(meanUnsysDistance([2, 4, 6])).toBe(4);
    const scores = ltiUnsysScores({
      latestRaw: { projectedPolicy: { distance: 10 } },
      distances: [10, 20, 30],
    });
    expect(scores.latest).toBe(10);
    expect(scores.average).toBe(20);
    expect(ltiAgsComment(scores)).toContain("unsys_distance=10");
    expect(ltiAgsComment(scores)).toContain("unsys_average=20");
  });

  it("builds latest and average AGS line items", () => {
    const items = buildUnsysLineItems({ flowName: "Ohm", resourceLinkId: "rl-1" });
    expect(items.map((item) => item.tag)).toEqual([LTI_AGS_TAG_LATEST, LTI_AGS_TAG_AVERAGE]);
    const posts = agsScoresForUnsys({
      userId: "sub-1",
      scores: { latest: 10, average: 20, observationCount: 3, scoredCount: 3 },
    });
    expect(posts[0]?.body.scoreGiven).toBe(10);
    expect(posts[0]?.body.activityProgress).toBe("Completed");
    expect(posts[1]?.body.scoreGiven).toBe(20);
  });
});
