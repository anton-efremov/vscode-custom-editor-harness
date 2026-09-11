/** @fileoverview Verifies outer webview discovery without counting nested content frames. */
import type { Frame, Page } from "playwright-core";
import { describe, expect, it, vi } from "vitest";
import { resolveWebview } from "../../src/driver/webview";

function webviewFrame(parent: Frame, visible = true): Frame {
  return {
    parentFrame: () => parent,
    url: () => "vscode-webview://editor/index.html",
    frameElement: async () => ({
      getAttribute: async () => "vscode-webview://editor/index.html",
      isVisible: async () => visible,
    }),
    locator: vi.fn(() => ({ elementHandle: async () => ({ boundingBox: async () => ({ width: 100, height: 100 }) }) })),
  } as unknown as Frame;
}

describe("webview discovery", () => {
  it("does not count the nested content frame as a second editor after reopening", async () => {
    const main = {} as Frame;
    const outer = webviewFrame(main);
    const content = webviewFrame(outer);
    const hidden = webviewFrame(main, false);
    const page = { mainFrame: () => main, frames: () => [outer, content, hidden] } as unknown as Page;
    expect((await resolveWebview(page)).coordinateFrame).toBe(outer);
  });

  it("still rejects two visible editor webviews", async () => {
    const main = {} as Frame;
    const page = { mainFrame: () => main, frames: () => [webviewFrame(main), webviewFrame(main)] } as unknown as Page;
    await expect(resolveWebview(page)).rejects.toThrow("More than one visible VS Code webview");
  });
});
