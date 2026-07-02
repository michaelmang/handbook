import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { visit } from "unist-util-visit";
import type { Root, Heading } from "mdast";

export async function validateMarkdown(markdown: string): Promise<boolean> {
  try {
    await remark().use(remarkParse).use(remarkGfm).parse(markdown);
    return true;
  } catch {
    return false;
  }
}

export function extractHeadings(
  markdown: string
): Array<{ depth: number; text: string }> {
  const headings: Array<{ depth: number; text: string }> = [];
  const tree = remark().use(remarkParse).use(remarkGfm).parse(markdown) as Root;

  visit(tree, "heading", (node: Heading) => {
    const text = node.children
      .map((child) => ("value" in child ? String(child.value) : ""))
      .join("");
    headings.push({ depth: node.depth, text });
  });

  return headings;
}
