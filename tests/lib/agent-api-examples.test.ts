import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ProtocolApiEndpointIndex } from "@/components/docs/protocol-api-endpoint-index";
import { AGENT_TOOL_SURFACE } from "@/lib/pow-api/agent-tool-surface";
import {
  AGENT_API_EXAMPLE_IDENTITY,
  agentApiExampleSnippets,
  agentApiRequestExample,
} from "@/lib/pow-api/agent-api-examples";

const ROOT = join(__dirname, "../..");

describe("agent API endpoint examples", () => {
  it("covers every public tool in curl, JavaScript, and Python", () => {
    expect(AGENT_TOOL_SURFACE.map((tool) => tool.name)).toContain("get_protocol_url");
    for (const tool of AGENT_TOOL_SURFACE) {
      const snippets = agentApiExampleSnippets(tool);
      expect(snippets.map((item) => item.language)).toEqual(["curl", "javascript", "python"]);
      for (const snippet of snippets) {
        expect(snippet.code).toContain(tool.rest.method);
        expect(snippet.code).toContain("Authorization");
        expect(snippet.code).toContain("Bearer sk_");
      }
    }
  });

  it("get_protocol_url includes a prepopulated identity and a path without one", () => {
    const tool = AGENT_TOOL_SURFACE.find((entry) => entry.name === "get_protocol_url");
    expect(tool).toBeTruthy();
    if (!tool) return;
    const req = agentApiRequestExample(tool);
    expect(req.method).toBe("GET");
    expect(req.path).toContain("/url");
    expect(req.query.identity).toBe(AGENT_API_EXAMPLE_IDENTITY);
    expect(req.url).toContain("identity=learner-42");
    expect(req.body).toBeNull();
  });

  it("docs endpoint index expands with those examples", () => {
    const page = readFileSync(join(ROOT, "app/docs/proof-of-work-api/page.tsx"), "utf8");
    const index = readFileSync(
      join(ROOT, "components/docs/protocol-api-endpoint-index.tsx"),
      "utf8",
    );
    expect(page).toContain("ProtocolApiEndpointIndex");
    expect(index).toContain("data-endpoint-examples");
    expect(index).toContain("agentApiExampleSnippets");
    expect(existsSync(join(ROOT, "app/api/v3/protocols/[protocolId]/url/route.ts"))).toBe(true);
    expect(readFileSync(join(ROOT, "public/skill.md"), "utf8")).toContain("get_protocol_url");
    expect(readFileSync(join(ROOT, "public/coding-agents.md"), "utf8")).toContain(
      "/api/v3/protocols/{protocol_id}/url",
    );
    const html = renderToStaticMarkup(createElement(ProtocolApiEndpointIndex));
    expect(html).toContain("data-endpoint-index");
    expect(html).toContain('data-endpoint-index-family="protocol"');
    expect(html).toContain('data-endpoint-index-family="knowledge_region"');
    expect(html).toContain("Protocol API");
    expect(html).toContain("Knowledge Regions API");
    expect(html).toContain('data-endpoint-examples="get_protocol_url"');
    expect(html).toContain("data-endpoint-example-language=\"curl\"");
    expect(html).toContain("data-endpoint-example-language=\"javascript\"");
    expect(html).toContain("data-endpoint-example-language=\"python\"");
    expect(html).toContain('data-docs-tabs="examples-get_protocol_url"');
    expect(html).toContain("data-error-catalog");
    expect(html).toContain('data-docs-tab-labels="code"');
    expect(html).toContain('data-docs-tab="organization_id_required"');
    expect(html).toContain('data-docs-tab="api_plan_required"');
    expect(html).toContain("data-schema-catalog");
    expect(html).toContain("data-strategy-catalog");
    expect(html).toContain("exploit-heavy");
    expect(html).toContain("information-seeking");
    expect(html).toContain("novelty-seeking");
    expect(html).toContain("balanced");
    expect(html).toContain("narrow-and-deep");
    expect(html).toContain("{ prompt }");
    expect(html).toContain("api_plan_required");
    expect(html).toContain("organization_id_required");
    expect(html).toContain("answers_model_seed");
    expect(html).toContain("/api/v3/protocols/{protocol_id}/url");
    expect((html.match(/data-endpoint-index-family=/g) || []).length).toBe(2);
    expect((html.match(/<details /g) || []).length).toBe(AGENT_TOOL_SURFACE.length);
  });
});
