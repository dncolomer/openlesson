import {
  KNOWLEDGE_REGION_API_BASE,
  PROTOCOL_API_BASE,
  PUBLIC_AGENT_API_FAMILIES,
  type PublicAgentApiFamily,
} from "@/lib/api/agent-api-paths";
import {
  AGENT_API_PUBLIC_ERRORS,
  AGENT_API_SCHEMAS,
  AGENT_API_STRATEGY_CATALOG,
  agentApiErrorEnvelope,
  agentApiErrorSnippets,
  errorsForTool,
  schemasForTool,
} from "@/lib/pow-api/agent-api-docs";
import { agentApiExampleSnippets } from "@/lib/pow-api/agent-api-examples";
import { agentToolsByFamily } from "@/lib/pow-api/agent-tool-surface";
import { DocsMagiTab, DocsMagiTabs } from "./docs-magi-tabs";

const sectionClass = "console-copy p-5 sm:p-6";
const labelClass = "font-mono text-[10px] uppercase tracking-[2px] text-neutral-500";
const codeBlockClass =
  "mt-2 overflow-x-auto border border-white/20 bg-black p-3 font-mono text-xs text-neutral-300";

const FAMILY_COPY: Record<
  PublicAgentApiFamily,
  { kicker: string; title: string; path: string }
> = {
  protocol: {
    kicker: "Endpoint index",
    title: "Protocol API",
    path: PROTOCOL_API_BASE,
  },
  knowledge_region: {
    kicker: "Endpoint index",
    title: "Knowledge Regions API",
    path: KNOWLEDGE_REGION_API_BASE,
  },
};

function CodeBlock({ children }: { children: string }) {
  return <pre className={codeBlockClass}>{children}</pre>;
}

export function ProtocolApiEndpointIndex() {
  return (
    <div className="space-y-6" data-endpoint-index="">
      {PUBLIC_AGENT_API_FAMILIES.map((family) => {
        const copy = FAMILY_COPY[family];
        const tools = agentToolsByFamily(family);
        return (
          <section
            key={family}
            className={sectionClass}
            data-endpoint-index-family={family}
          >
            <p className={labelClass}>{copy.kicker}</p>
            <h2 className="mt-2 text-lg font-medium text-white">{copy.title}</h2>
            <p className="mt-2 text-sm text-neutral-400">
              <code className="text-neutral-300">{copy.path}</code>
              {" · "}
              MCP <code className="text-neutral-300">tools/list</code> is 1:1 with these REST
              twins. Expand an endpoint for tabbed curl, JavaScript, and Python, plus schemas
              and errors.
            </p>
            {family === "knowledge_region" ? (
              <div className="mt-3 border border-white/20 bg-black p-3" data-strategy-catalog="">
                <p className={labelClass}>Exploration strategy ids</p>
                <ul className="mt-2 space-y-1 text-sm text-neutral-400">
                  {AGENT_API_STRATEGY_CATALOG.map((strategy) => (
                    <li key={strategy.id}>
                      <code className="text-neutral-300">{strategy.id}</code>
                      {" · "}
                      <span className="text-neutral-200">{strategy.name}</span>
                      {" · "}
                      {strategy.description}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-neutral-500">
                  Pass <code className="text-neutral-300">custom_strategies</code> as a prompt
                  string, <code className="text-neutral-300">{`{ prompt }`}</code>, or{" "}
                  <code className="text-neutral-300">{`{ name, prompt }`}</code>. Custom walks
                  are included even when their generated ids are omitted from{" "}
                  <code className="text-neutral-300">strategy_ids</code>.
                </p>
              </div>
            ) : null}
            <ul className="mt-3 space-y-2 text-sm">
              {tools.map((tool) => {
                const snippets = agentApiExampleSnippets(tool);
                const schemas = schemasForTool(tool.name);
                const errors = errorsForTool(tool.name);
                return (
                  <li key={tool.name} data-endpoint-index-item={tool.name}>
                    <span className="font-mono text-neutral-300">{tool.rest.method}</span>{" "}
                    <span className="text-neutral-400">{tool.rest.path}</span>
                    <span className="ml-2 font-mono text-neutral-500">{tool.name}</span>
                    <p className="mt-0.5 text-neutral-500">{tool.summary}</p>
                    <details
                      className="mt-2 border border-white/20 bg-black"
                      data-endpoint-examples={tool.name}
                    >
                      <summary className="cursor-pointer px-3 py-2 font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">
                        Examples, schemas, errors
                      </summary>
                      <div className="space-y-3 border-t border-white/20 p-3">
                        {tool.name === "get_protocol_url" ? (
                          <p className="text-xs text-neutral-500">
                            The example includes{" "}
                            <code className="text-neutral-300">identity</code>. Omit it for a
                            URL that asks the learner to identify.
                          </p>
                        ) : null}
                        <DocsMagiTabs data-tabs={`examples-${tool.name}`}>
                          {snippets.map((snippet) => (
                            <DocsMagiTab
                              key={snippet.language}
                              id={snippet.language}
                              label={snippet.label}
                            >
                              <div data-endpoint-example-language={snippet.language}>
                                <CodeBlock>{snippet.code}</CodeBlock>
                              </div>
                            </DocsMagiTab>
                          ))}
                        </DocsMagiTabs>
                        {schemas.length ? (
                          <div data-endpoint-schemas={tool.name}>
                            <p className={`${labelClass} mb-2`}>Schemas</p>
                            <DocsMagiTabs data-tabs={`schemas-${tool.name}`}>
                              {schemas.map((schema) => (
                                <DocsMagiTab key={schema.id} id={schema.id} label={schema.title}>
                                  <p className="mt-2 text-xs text-neutral-500">{schema.summary}</p>
                                  <CodeBlock>{JSON.stringify(schema.example, null, 2)}</CodeBlock>
                                </DocsMagiTab>
                              ))}
                            </DocsMagiTabs>
                          </div>
                        ) : null}
                        {errors.length ? (
                          <div data-endpoint-errors={tool.name}>
                            <p className={`${labelClass} mb-2`}>Errors</p>
                            <DocsMagiTabs data-tabs={`errors-${tool.name}`} labels="code">
                              {errors.map((error) => (
                                <DocsMagiTab key={error.code} id={error.code} label={error.code}>
                                  <div data-endpoint-error={error.code}>
                                    <p className="mt-2 text-xs text-neutral-500">
                                      HTTP {error.status}. {error.summary}
                                    </p>
                                    <CodeBlock>
                                      {JSON.stringify(agentApiErrorEnvelope(error), null, 2)}
                                    </CodeBlock>
                                  </div>
                                </DocsMagiTab>
                              ))}
                            </DocsMagiTabs>
                          </div>
                        ) : null}
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <section className={sectionClass} data-error-catalog="">
        <p className={labelClass}>Error responses</p>
        <h2 className="mt-2 text-lg font-medium text-white">Error envelope</h2>
        <p className="mt-2 text-sm text-neutral-400">
          Failures return{" "}
          <code className="text-neutral-300">{`{ error: { code, message, details? } }`}</code>.
          Tab an error, then curl, JavaScript, or Python.
        </p>
        <div className="mt-3 border border-white/20 bg-black">
          <DocsMagiTabs data-tabs="error-catalog" labels="code">
            {AGENT_API_PUBLIC_ERRORS.map((error) => (
              <DocsMagiTab key={error.code} id={error.code} label={error.code}>
                <div className="p-3" data-error-catalog-item={error.code}>
                  <p className="text-xs text-neutral-500">
                    HTTP {error.status}. {error.summary}
                  </p>
                  <CodeBlock>{JSON.stringify(agentApiErrorEnvelope(error), null, 2)}</CodeBlock>
                  <DocsMagiTabs data-tabs={`error-catalog-${error.code}`}>
                    {agentApiErrorSnippets(error).map((snippet) => (
                      <DocsMagiTab
                        key={snippet.language}
                        id={snippet.language}
                        label={snippet.label}
                      >
                        <div data-error-catalog-language={snippet.language}>
                          <CodeBlock>{snippet.code}</CodeBlock>
                        </div>
                      </DocsMagiTab>
                    ))}
                  </DocsMagiTabs>
                </div>
              </DocsMagiTab>
            ))}
          </DocsMagiTabs>
        </div>
      </section>

      <section className={sectionClass} data-schema-catalog="">
        <p className={labelClass}>Schemas</p>
        <h2 className="mt-2 text-lg font-medium text-white">Params and responses</h2>
        <p className="mt-2 text-sm text-neutral-400">
          Complex request and response bodies. The same catalog is in{" "}
          <code className="text-neutral-300">/skill.md</code>.
        </p>
        <div className="mt-3 border border-white/20 bg-black">
          <DocsMagiTabs data-tabs="schema-catalog">
            {AGENT_API_SCHEMAS.map((schema) => (
              <DocsMagiTab key={schema.id} id={schema.id} label={schema.title}>
                <div className="p-3" data-schema-catalog-item={schema.id}>
                  <p className="text-xs text-neutral-500">
                    {schema.kind}. {schema.summary}
                  </p>
                  <CodeBlock>{JSON.stringify(schema.example, null, 2)}</CodeBlock>
                </div>
              </DocsMagiTab>
            ))}
          </DocsMagiTabs>
        </div>
      </section>
    </div>
  );
}
