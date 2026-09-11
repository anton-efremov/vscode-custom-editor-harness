/**
 * @fileoverview Resolves the single visible VS Code webview and its root locator.
 */
import type { Frame, Locator, Page } from "playwright-core";

export interface ResolvedWebview {
  root: Locator;
  coordinateFrame: Frame;
}

/** Waits for and resolves the single visible extension webview on a workbench page. */
export async function resolveWebview(page: Page): Promise<ResolvedWebview> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const visible: Frame[] = [];
    // The content iframe can also have a vscode-webview URL after reopening.
    // Only direct children of the workbench are independent editor webviews.
    for (const frame of page.frames().filter((candidate) => candidate.parentFrame() === page.mainFrame())) {
      try {
        const element = await frame.frameElement();
        const source = await element.getAttribute("src");
        if (!frame.url().startsWith("vscode-webview://") && !source?.startsWith("vscode-webview://")) continue;
        if (await element.isVisible()) visible.push(frame);
      } catch (error) {
        if (!frame.isDetached()) throw error;
      }
    }
    const attached = visible.filter((frame) => !frame.isDetached());
    if (attached.length > 1) throw new Error("More than one visible VS Code webview was found");
    if (attached.length === 1) {
      const frame = attached[0];
      try {
        const active = await frame.locator("iframe#active-frame").elementHandle();
        if (active && await active.boundingBox() && !frame.isDetached()) {
          return { root: frame.locator("vscodewebview=*"), coordinateFrame: frame };
        }
      } catch (error) {
        if (!frame.isDetached()) throw error;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Timed out waiting for a visible VS Code webview");
}
