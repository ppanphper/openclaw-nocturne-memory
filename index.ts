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

export default {
  id: "nocturne-memory",
  name: "Nocturne Memory",
  description:
    "Multi-agent long-term memory powered by Nocturne Memory with namespace isolation.",

  register(api: Api): void {
    const raw = api.pluginConfig as Record<string, unknown> | undefined;
    const config: NocturneMemoryConfig = {
      url: (raw?.url as string) ?? "",
      agents: (raw?.agents as NocturneMemoryConfig["agents"]) ?? [],
      defaultNamespace: (raw?.defaultNamespace as string) ?? "",
    };

    if (!config.url) {
      api.logger?.warn?.(
        'Missing "url" in plugin config — skipping tool registration.\n' +
          "Set plugins.entries.nocturne-memory.config.url in your OpenClaw config.",
      );
      return;
    }

    if (!config.agents?.length) {
      api.logger?.info?.(
        "No agent namespace mappings configured — all agents will share the default namespace.",
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
  },
};
