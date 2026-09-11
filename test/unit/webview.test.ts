/** @fileoverview Verifies outer webview discovery without counting nested content frames. */
import type { Frame, Page } from "playwright-core";
import { describe, expect, it, vi } from "vitest";
import { resolveWebview } from "../../src/driver/webview";

function webviewFrame(parent: Frame, visible = true): Frame {
  return {
    parentFrame: () => parent,
    isDetached: () => false,
    url: () => "vscode-webview://editor/index.html",
    frameElement: async () => ({
      getAttribute: async () => "vscode-webview://editor/index.html",
      isVisible: async () => visible,
    }),
    locator: vi.fn(() => ({ elementHandle: async () => ({ boundingBox: async () => ({ width: 100, height: 100 }) }) })),
  } as unknown as Frame;
}

describe("webview discovery", () => {
  it("skips an outer frame detached while its element is being inspected", async () => {
    const main = {} as Frame;
    const stale = webviewFrame(main);
    const current = webviewFrame(main);
    stale.frameElement = vi.fn(async () => { throw new Error("Frame has been detached."); });
    stale.isDetached = () => true;
    const page = { mainFrame: () => main, frames: () => [stale, current] } as unknown as Page;
    expect((await resolveWebview(page)).coordinateFrame).toBe(current);
  });

  it("retries when the chosen outer frame detaches during content lookup", async () => {
    const main = {} as Frame;
    const stale = webviewFrame(main);
    const current = webviewFrame(main);
    let detached = false;
    stale.isDetached = () => detached;
    stale.locator = vi.fn(() => ({ elementHandle: async () => {
      detached = true;
      throw new Error("Frame has been detached.");
    } })) as unknown as Frame["locator"];
    const page = { mainFrame: () => main, frames: () => detached ? [current] : [stale] } as unknown as Page;
    expect((await resolveWebview(page)).coordinateFrame).toBe(current);
  });

  it("does not swallow errors from an attached frame", async () => {
    const main = {} as Frame;
    const frame = webviewFrame(main);
    frame.frameElement = vi.fn(async () => { throw new Error("Unexpected lookup failure"); });
    const page = { mainFrame: () => main, frames: () => [frame] } as unknown as Page;
    await expect(resolveWebview(page)).rejects.toThrow("Unexpected lookup failure");
  });
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
