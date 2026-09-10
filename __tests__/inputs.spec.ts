import { describe, expect, it, vi } from "vitest";

const core = { getInput: vi.fn<(name: string, options?: unknown) => string>() };
vi.mock("@actions/core", () => core);

const { readInputs } = await import("../src/inputs.js");

describe("readInputs", () => {
  it("reads the three declared inputs under their manifest names", () => {
    core.getInput.mockImplementation((name) => {
      switch (name) {
        case "token":
          return "gh-token";
        case "filter_out_pattern":
          return "^fixup!";
        case "filter_out_flags":
          return "i";
        default:
          throw new Error(`unexpected input ${name}`);
      }
    });

    expect(readInputs()).toEqual({
      token: "gh-token",
      filterOutPattern: "^fixup!",
      filterOutFlags: "i",
    });
  });

  it("does not enforce the token, matching the original", () => {
    // action.yml marks token required, but the runner does not enforce that
    // and neither did the action this replaces. An empty token yields an
    // unauthenticated client, which still works on a public repository.
    core.getInput.mockReturnValue("");

    expect(readInputs().token).toBe("");
    expect(core.getInput).toHaveBeenCalledWith("token");
    expect(core.getInput).not.toHaveBeenCalledWith("token", {
      required: true,
    });
  });
});
