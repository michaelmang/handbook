import fs from "fs";
import { parseDocxSmart } from "../src/lib/import/smart-docx";

const path = process.argv[2] ?? "samples/handbook-headings.docx";
const buf = fs.readFileSync(path);

parseDocxSmart(buf)
  .then((r) => {
    console.log("mode:", r.importMode);
    console.log("sections:", r.blocks.length);
    console.log(
      "titles:",
      r.blocks.map((b) => `d${b.relativeDepth} ${b.title}`)
    );
    const usedLlm = r.warnings.some((w) =>
      w.includes("LLM structure confidence")
    );
    const refined = r.warnings.some((w) => w.includes("refinement applied"));
    console.log("llm_used:", usedLlm);
    console.log("refined:", refined);
    if (!usedLlm) {
      console.log("warnings:", r.warnings.join("\n"));
    } else {
      console.log(
        "llm:",
        r.warnings.find((w) => w.includes("LLM structure confidence"))
      );
    }
  })
  .catch((e) => {
    console.error("FAILED:", e instanceof Error ? e.message : e);
    process.exit(1);
  });
