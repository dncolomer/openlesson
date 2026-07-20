import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { ileTokenFromPowBody } from "@/lib/pow-api/workspace-session-access";
import { buildIleSessionUrl } from "@/lib/ile-link";

const REPO_ROOT = path.resolve(__dirname, "../..");

describe("ileTokenFromPowBody", () => {
  it("accepts ileToken, ile_token, privateToken, and private_token", () => {
    expect(ileTokenFromPowBody({ ileToken: "abc" })).toBe("abc");
    expect(ileTokenFromPowBody({ ile_token: " def " })).toBe("def");
    expect(ileTokenFromPowBody({ privateToken: "tok" })).toBe("tok");
    expect(ileTokenFromPowBody({ private_token: "pt" })).toBe("pt");
    expect(ileTokenFromPowBody({})).toBeNull();
    expect(ileTokenFromPowBody({ ileToken: "" })).toBeNull();
  });
});

describe("buildIleSessionUrl", () => {
  it("builds shareable /ile/session/{token} URLs without trailing slash doubling", () => {
    expect(buildIleSessionUrl("https://app.example.com/", "token123")).toBe(
      "https://app.example.com/ile/session/token123",
    );
    expect(buildIleSessionUrl("https://app.example.com", "token123")).toBe(
      "https://app.example.com/ile/session/token123",
    );
  });
});

describe("shareable ILE guest PoW wiring", () => {
  const accessSource = fs.readFileSync(
    path.join(REPO_ROOT, "lib/pow-api/workspace-session-access.ts"),
    "utf8",
  );
  const speechSource = fs.readFileSync(
    path.join(REPO_ROOT, "app/api/workspace-ile/speech/route.ts"),
    "utf8",
  );
  const idleSource = fs.readFileSync(
    path.join(REPO_ROOT, "app/api/workspace-ile/idle/route.ts"),
    "utf8",
  );
  const powSource = fs.readFileSync(
    path.join(REPO_ROOT, "app/api/workspace/proof-of-work/route.ts"),
    "utf8",
  );
  const sessionSource = fs.readFileSync(
    path.join(REPO_ROOT, "components/SessionView.tsx"),
    "utf8",
  );
  const perfSource = fs.readFileSync(
    path.join(REPO_ROOT, "components/WorkspacePerformancePanel.tsx"),
    "utf8",
  );
  const middlewareSource = fs.readFileSync(path.join(REPO_ROOT, "middleware.ts"), "utf8");

  it("resolves ILE private tokens in session PoW access helper", () => {
    expect(accessSource).toContain("resolveIleLinkAccess");
    expect(accessSource).toContain("resolveIleLinkSessionAccess");
    expect(accessSource).toContain("ileToken");
    expect(accessSource).toContain('key_id: "ile-link"');
  });

  it("wires ileToken into ILE speech, idle, and proof-of-work API routes", () => {
    expect(speechSource).toContain("ileTokenFromPowBody");
    expect(idleSource).toContain("ileTokenFromPowBody");
    expect(powSource).toContain("ileTokenFromPowBody");
    expect(speechSource).toContain("ileToken:");
    expect(idleSource).toContain("ileToken:");
    expect(powSource).toContain("ileToken:");
  });

  it("sends the shareable ILE token from SessionView guest PoW context", () => {
    expect(sessionSource).toContain("privateToken: ileToken");
    expect(sessionSource).toContain("ileToken ? { ileToken }");
  });

  it("renders TAP&ILE knowledge subview full width", () => {
    expect(perfSource).toContain('activeSubview === "tap"');
    expect(perfSource).toMatch(/activeSubview === "tap"[\s\S]*?max-w-none/);
    expect(perfSource).not.toMatch(/activeSubview === "tap"[\s\S]*?max-w-3xl/);
  });

  it("treats /ile/session as a public middleware route like TAP", () => {
    expect(middlewareSource).toContain('"/ile/session"');
    expect(middlewareSource).toContain('"/tap/session"');
    expect(middlewareSource).toContain('"/ile/session/"');
  });
});
