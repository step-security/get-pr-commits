import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Guards the interface callers depend on.
 *
 * This is a drop-in replacement, so `action.yml` is fixed by the action it
 * replaces. Renaming an input, or declaring an output nothing sets, breaks
 * callers without failing any test of the implementation.
 */
const manifest = readFileSync(
  fileURLToPath(new URL("../action.yml", import.meta.url)),
  "utf8",
);

const inputsBlock = manifest.split(/^inputs:$/m)[1]!.split(/^outputs:$/m)[0]!;

function keysIn(block: string): string[] {
  return block
    .split("\n")
    .filter((line) => /^ {2}\S+:/.test(line))
    .map((line) => line.trim().replace(/:$/, ""));
}

describe("action.yml", () => {
  it("declares exactly the three expected inputs, with their original names", () => {
    // Snake case, not kebab. Renaming these would break every caller.
    expect(keysIn(inputsBlock)).toEqual([
      "token",
      "filter_out_pattern",
      "filter_out_flags",
    ]);
  });

  it("keeps token required and the filters optional", () => {
    expect(inputsBlock).toMatch(/token:[\s\S]*?required: true/);
    expect(inputsBlock).toMatch(/filter_out_pattern:[\s\S]*?required: false/);
    expect(inputsBlock).toMatch(/filter_out_flags:[\s\S]*?required: false/);
  });

  it("defaults both filter inputs to empty", () => {
    expect(inputsBlock).toMatch(/filter_out_pattern:[\s\S]*?default: ""/);
    expect(inputsBlock).toMatch(/filter_out_flags:[\s\S]*?default: ''/);
  });

  it("declares exactly one output, named commits", () => {
    const outputsBlock = manifest.split(/^outputs:$/m)[1]!.split(/^runs:$/m)[0]!;

    expect(keysIn(outputsBlock)).toEqual(["commits"]);
  });

  it("runs the committed bundle on node24", () => {
    expect(manifest).toMatch(/using: ['"]node24['"]/);
    expect(manifest).toMatch(/main: ['"]dist\/index\.js['"]/);
  });
});

describe("declared outputs are actually set", () => {
  const source = readFileSync(
    fileURLToPath(new URL("../src/main.ts", import.meta.url)),
    "utf8",
  );

  it("sets the commits output somewhere in main", () => {
    // An output declared in the manifest but never set is invisible to every
    // other test here, and has slipped through on sibling actions before.
    expect(source).toMatch(/setOutput\(\s*["']commits["']/);
  });
});
