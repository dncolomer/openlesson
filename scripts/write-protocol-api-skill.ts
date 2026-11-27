import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { protocolApiSkillMarkdown } from "@/lib/pow-api/agent-api-docs";

const dest = join(process.cwd(), "public/skill.md");
writeFileSync(dest, protocolApiSkillMarkdown());
console.log(`wrote ${dest}`);
