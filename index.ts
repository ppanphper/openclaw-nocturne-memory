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
  // api.pluginConfig maps to plugins.entries.<id>.config in OpenClaw config
  const raw = api.pluginConfig as Record<string, unknown> | undefined;
  const config: NocturneMemoryConfig = {
    url: (raw?.url as string) ?? "",
    agents: (raw?.agents as NocturneMemoryConfig["agents"]) ?? [],
    defaultNamespace: (raw?.defaultNamespace as string) ?? "",
  };

  if (!config.url) {
    const log = api.logger ?? console;
    log.warn(
      '[nocturne-memory] Missing "url" in plugin config — skipping tool registration.\n' +
        "Set plugins.entries.nocturne-memory.config.url in your OpenClaw config.",
    );
    return;
  }

  if (!config.agents?.length) {
    (api.logger ?? console).info(
      "[nocturne-memory] No agent namespace mappings — all agents share the default namespace.",
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
