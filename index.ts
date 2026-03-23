/**
 * OpenClaw Nocturne Memory Plugin
 *
 * Provides multi-agent long-term memory with namespace isolation.
 * Each agent operates in its own namespace, unaware of others' memories.
 */

import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { registerTools } from "./src/tools.js";
import { setBaseUrl, closeAll } from "./src/nm-client.js";
import type { NocturneMemoryConfig } from "./src/config.js";

export default definePluginEntry({
  id: "nocturne-memory",
  name: "Nocturne Memory",
  description:
    "Multi-agent long-term memory powered by Nocturne Memory with namespace isolation.",

  register(api) {
    const raw = api.pluginConfig as Record<string, unknown> | undefined;
    const config: NocturneMemoryConfig = {
      url: (raw?.url as string) ?? "",
      agents: (raw?.agents as NocturneMemoryConfig["agents"]) ?? [],
      defaultNamespace: (raw?.defaultNamespace as string) ?? "",
    };

    if (!config.url) {
      api.logger.warn(
        '[nocturne-memory] Missing "url" in plugin config — skipping tool registration.\n' +
          "Set plugins.entries.nocturne-memory.config.url in your OpenClaw config.",
      );
      return;
    }

    if (!config.agents?.length) {
      api.logger.info(
        "[nocturne-memory] No agent namespace mappings — all agents share the default namespace.",
      );
    }

    setBaseUrl(config.url);

    registerTools(api, config);

    api.registerService({
      name: "nocturne-memory",
      async stop() {
        await closeAll();
      },
    });
  },
});
