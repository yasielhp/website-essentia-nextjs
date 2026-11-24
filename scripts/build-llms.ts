import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildLlmsFullTxt, buildLlmsTxt } from "../app/lib/llms";

/**
 * Writes `public/llms.txt` and `public/llms-full.txt` from the site's own data
 * (see `app/lib/llms.ts`). Run it with `bun run build:llms` whenever
 * `llms.test.ts` says the two files are behind: a treatment was added, renamed
 * or described anew, or the centre's details changed.
 */
const PUBLIC = join(import.meta.dir, "..", "public");

writeFileSync(join(PUBLIC, "llms.txt"), buildLlmsTxt());
writeFileSync(join(PUBLIC, "llms-full.txt"), buildLlmsFullTxt());

console.log("public/llms.txt and public/llms-full.txt rebuilt");
