/**
 * WebMCP — the in-page tool surface Chrome exposes to browser agents.
 *
 * The API is a Community Group draft behind a flag, so it is absent from
 * `lib.dom`. These declarations describe only the part this site uses.
 *
 * The getter moved from `Navigator` to `Document` in Chrome 150;
 * `navigator.modelContext` is deprecated and both are declared so the
 * feature-detection fallback keeps type-checking.
 */

type ModelContextClient = {
  requestUserInteraction(callback: () => Promise<unknown>): Promise<unknown>;
};

type ModelContextTool = {
  name: string;
  title?: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  annotations?: {
    readOnlyHint?: boolean;
    untrustedContentHint?: boolean;
  };
  execute(
    input: Record<string, unknown>,
    client: ModelContextClient,
  ): Promise<unknown> | unknown;
};

type ModelContextRegisterOptions = {
  signal?: AbortSignal;
  exposedTo?: string[];
};

interface ModelContext {
  /** Returns void on Chrome 146–150 and a Promise on 151+; `await` covers both. */
  registerTool(
    tool: ModelContextTool,
    options?: ModelContextRegisterOptions,
  ): Promise<void> | void;
  /** Removed in Chrome 148 — call through optional chaining only. */
  unregisterTool?(name: string): void;
}

interface Document {
  readonly modelContext?: ModelContext;
}

interface Navigator {
  readonly modelContext?: ModelContext;
}
