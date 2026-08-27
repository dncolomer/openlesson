function Snippet(props: { children: string }) {
  return (
    <pre
      className="w-full overflow-x-auto rounded-sm border border-zinc-800 bg-zinc-950 px-3 py-3 font-mono text-[11px] leading-relaxed text-zinc-300"
      data-tapbench-experiment-snippet
    >
      <code>{props.children}</code>
    </pre>
  );
}

/**
 * Developer tutorial for the TAPBench experiment. Lives on the Experiment tab.
 */
export function TapbenchExperimentTutorial() {
  return (
    <section className="w-full" data-tapbench-experiment>
      <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
        Experiment
      </h2>
      <div
        className="mt-5 space-y-4 text-sm leading-relaxed text-zinc-400"
        data-tapbench-experiment-tutorial
      >
        <p>
          TAPBench is a public 64-dimensional knowledge-config benchmark. Each row in Results is
          one catalog workspace owned by{" "}
          <span className="text-zinc-300">tapbench@uncertain.systems</span>. You construct a
          knowledge region from several guest TAP runs on that workspace. The table then reports
          Euclidean distances, in native{" "}
          <span className="text-zinc-300">knowledgecfg-v1-d64</span>, between that region and the
          owner account&apos;s latest snapshot.
        </p>
        <p>
          The operator credential is a TAPBench key, prefix{" "}
          <span className="font-mono text-[11px] text-zinc-300">tbk_</span>. Issue it from the
          Results row (or{" "}
          <span className="font-mono text-[11px] text-zinc-300">POST /api/v3/tapbench/keys</span>
          ). The key is scoped to one <span className="text-zinc-300">workspace_id</span>. Put it
          on every request:
        </p>
        <Snippet>{`Authorization: Bearer tbk_<secret>`}</Snippet>
        <p>
          The experimental subject is <span className="text-zinc-300">guest_user_id</span> (a
          UUID). Mint guests under the key, then send that id as{" "}
          <span className="font-mono text-[11px] text-zinc-300">X-Tapbench-Guest</span> on every
          TAP call. PoW, snapshots, and the later region are stored against those guest ids.
        </p>
        <p>
          Read the task goals first. Demonstrate <span className="text-zinc-300">goals[].text</span>
          ; if the array is empty, demonstrate <span className="text-zinc-300">workspace_goal</span>.
        </p>
        <Snippet>{`GET /api/v3/tapbench/tasks/{workspace_id}/goals
Authorization: Bearer tbk_<secret>`}</Snippet>
        <p>Mint a cohort of guest runs. Each guest is one subject / one snapshot later:</p>
        <Snippet>{`POST /api/v3/tapbench/tasks/{workspace_id}/guests
Authorization: Bearer tbk_<secret>
Content-Type: application/json

{ "count": 5 }`}</Snippet>
        <p>
          Stream TAP live through Stash. Buffer writes a thought unit. Stash flushes System 1;
          Submit flushes System 2. Loop buffer into both flushes. Keep each buffer payload a
          distinct thought.
        </p>
        <Snippet>{`POST /api/v3/stash/workspaces/{workspace_id}/proof-of-work
Authorization: Bearer tbk_<secret>
X-Tapbench-Guest: <guest_user_id>
Content-Type: application/json

{
  "type": "tool",
  "mime_type": "application/json",
  "data": "<base64 of {\\"text\\":\\"<this thought>\\"}>",
  "tool_name": "reason",
  "tool_action": "think",
  "metadata": {
    "text": "<this thought>",
    "tooling": { "agentic_harness": "", "model": "", "notes": "" }
  }
}

POST /api/v3/stash/workspaces/{workspace_id}/stash
Authorization: Bearer tbk_<secret>
X-Tapbench-Guest: <guest_user_id>

POST /api/v3/stash/workspaces/{workspace_id}/submit
Authorization: Bearer tbk_<secret>
X-Tapbench-Guest: <guest_user_id>`}</Snippet>
        <p>
          When a guest run is finished, encode its traces as a 64D knowledge-config snapshot.
          Pass one id, or omit the field to snapshot every guest on the key.
        </p>
        <Snippet>{`POST /api/v3/tapbench/tasks/{workspace_id}/snapshot
Authorization: Bearer tbk_<secret>
Content-Type: application/json

{ "guest_user_id": "<guest_user_id>" }`}</Snippet>
        <p>
          After several snapshots, build the region.{" "}
          <span className="text-zinc-300">name</span> is the public Results label (default is the
          task title plus &quot;region&quot;). Pass explicit guest ids, or omit them to use every
          snapshotted guest on this key.
        </p>
        <Snippet>{`POST /api/v3/tapbench/tasks/{workspace_id}/region
Authorization: Bearer tbk_<secret>
Content-Type: application/json

{
  "guest_user_ids": ["<guest_user_id>", "<guest_user_id>"],
  "name": "optional"
}`}</Snippet>
        <p>
          Scoring is geometry in R^64 after unit-normalizing the owner snapshot and the region
          centroid. Membership is cosine similarity at or above the region{" "}
          <span className="text-zinc-300">cosine_threshold</span>.{" "}
          <span className="text-zinc-300">Center</span> is L2 to the centroid.{" "}
          <span className="text-zinc-300">Border</span> is L2 to the cosine-threshold sphere
          around that centroid. Results shows, per workspace, the region with the closest owner
          snapshot.
        </p>
        <Snippet>{`GET /api/v3/tapbench/results`}</Snippet>
      </div>
    </section>
  );
}
