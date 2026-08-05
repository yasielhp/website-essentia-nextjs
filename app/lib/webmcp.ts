"use client";

/**
 * Registration helper for WebMCP tools.
 *
 * WebMCP lets a page hand a browser agent a set of named tools with typed
 * inputs, instead of leaving it to read the rendered DOM. It is the in-page
 * counterpart of the MCP server at `/api/mcp`: same idea, but the agent is
 * inside the browser and never talks to our server directly.
 *
 * The API is a draft behind a Chrome flag, so everything here degrades to
 * nothing when it is absent — which is every browser today.
 */

/** Chrome 150+ exposes it on `document`; 146–149 used the deprecated `navigator`. */
function getModelContext(): ModelContext | null {
  if (typeof document === "undefined") return null;
  return document.modelContext ?? navigator.modelContext ?? null;
}

export function registerWebMcpTools(tools: ModelContextTool[]) {
  const modelContext = getModelContext();
  if (!modelContext) return () => {};

  const controller = new AbortController();
  const registered: string[] = [];

  // Registration is asynchronous from Chrome 151 on — the promise resolves
  // once the tool is visible across the frame tree. Each tool keeps its own
  // try/catch so one bad registration never abandons the rest, and `await`
  // still works on older builds that registered synchronously.
  void Promise.all(
    tools.map(async (tool) => {
      try {
        await modelContext.registerTool(tool, { signal: controller.signal });
        registered.push(tool.name);
      } catch (error) {
        console.error(`WebMCP: could not register "${tool.name}"`, error);
      }
    }),
  );

  return () => {
    // `unregisterTool` is gone from Chrome 148 on, where aborting the signal
    // does the same job. Both run so either build cleans up.
    for (const name of registered.splice(0).reverse()) {
      try {
        modelContext.unregisterTool?.(name);
      } catch {
        // A tool already dropped by a route change is not worth reporting.
      }
    }
    controller.abort();
  };
}
