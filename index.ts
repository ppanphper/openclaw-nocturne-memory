/**
 * OpenClaw Nocturne Memory Plugin
 *
 * Provides multi-agent long-term memory with namespace isolation.
 * Each agent operates in its own namespace, unaware of others' memories.
 */

import { registerTools } from "./src/tools.js";
import { setBaseUrl, closeAll } from "./src/nm-client.js";
import type { NocturneMemoryConfig } from "./src/config.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Api = any;

export default function register(api: Api): void {
  const config = api.getConfig?.("nocturne-memory") as
    | NocturneMemoryConfig
    | undefined;

  if (!config?.url) {
    console.warn(
      '[nocturne-memory] Missing "url" in plugin config — skipping tool registration.',
    );
    return;
  }

  if (!config.agents?.length) {
    console.warn(
      '[nocturne-memory] No agent namespace mappings configured — all agents will share the default namespace.',
    );
  }

  setBaseUrl(config.url);

  registerTools(api, config);

  api.registerService?.({
    name: "nocturne-memory",
    async stop() {
      await closeAll();
    },
  });
}
