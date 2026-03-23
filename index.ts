/**
 * OpenClaw Nocturne Memory Plugin
 *
 * Provides multi-agent long-term memory with namespace isolation.
 * Each agent operates in its own namespace, unaware of others' memories.
 */

import { Type } from "@sinclair/typebox";
import { resolveNamespace, getMcpEndpoint } from "./src/config.js";
import type { NocturneMemoryConfig } from "./src/config.js";
import { setBaseUrl, callNMTool, closeAll } from "./src/nm-client.js";

type ToolContent = { type: "text"; text: string };
type ToolResult = { content: ToolContent[] };

function textResult(text: string): ToolResult {
  return { content: [{ type: "text", text }] };
}

async function proxy(
  config: NocturneMemoryConfig,
  agentId: string,
  tool: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const ns = resolveNamespace(config, agentId);
  const text = await callNMTool(ns, tool, args);
  return textResult(text);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Api = any;

function registerAllTools(api: Api, config: NocturneMemoryConfig): void {
  api.registerTool({
    name: "read_memory",
    description: [
      "Reads a memory by its URI.",
      "",
      "Special System URIs:",
      "- system://boot   : Loads your core memories (startup only).",
      "- system://index  : Full index of all available memories.",
      "- system://index/<domain> : Index of memories under a domain.",
      "- system://recent : Recently modified memories (default 10).",
      "- system://recent/N : The N most recently modified memories.",
      "- system://glossary : All glossary keywords and their bound nodes.",
    ].join("\n"),
    parameters: Type.Object({
      uri: Type.String({ description: 'Memory URI (e.g. "core://agent")' }),
    }),
    async execute(agentId: string, params: { uri: string }) {
      return proxy(config, agentId, "read_memory", params);
    },
  });

  api.registerTool({
    name: "create_memory",
    description: [
      "Creates a new memory under a parent URI.",
      "parent_uri MUST point to an existing node.",
    ].join("\n"),
    parameters: Type.Object({
      parent_uri: Type.String({
        description:
          'Parent URI (e.g. "core://agent"). Use "core://" for root.',
      }),
      content: Type.String({ description: "Memory content" }),
      priority: Type.Integer({
        description: "Retrieval priority (lower = higher priority, min 0)",
        minimum: 0,
      }),
      title: Type.Optional(
        Type.String({
          description:
            "Child title (becomes URI segment). Auto-generated if omitted.",
        }),
      ),
      disclosure: Type.Optional(
        Type.String({
          description:
            'When to disclose this memory (e.g. "When asked about pets")',
          default: "",
        }),
      ),
    }),
    async execute(
      agentId: string,
      params: {
        parent_uri: string;
        content: string;
        priority: number;
        title?: string;
        disclosure?: string;
      },
    ) {
      return proxy(config, agentId, "create_memory", params);
    },
  });

  api.registerTool({
    name: "update_memory",
    description: [
      "Updates an existing memory. Read it first to know what you are overwriting.",
      "Two content-editing modes (mutually exclusive):",
      "- old_string / new_string : Replace a substring.",
      "- append : Append text to the end.",
    ].join("\n"),
    parameters: Type.Object({
      uri: Type.String({ description: "Memory URI to update" }),
      old_string: Type.Optional(
        Type.String({ description: "Substring to replace" }),
      ),
      new_string: Type.Optional(
        Type.String({ description: "Replacement text" }),
      ),
      append: Type.Optional(Type.String({ description: "Text to append" })),
      priority: Type.Optional(
        Type.Integer({ description: "New priority", minimum: 0 }),
      ),
      disclosure: Type.Optional(
        Type.String({ description: "New disclosure condition" }),
      ),
    }),
    async execute(
      agentId: string,
      params: {
        uri: string;
        old_string?: string;
        new_string?: string;
        append?: string;
        priority?: number;
        disclosure?: string;
      },
    ) {
      return proxy(config, agentId, "update_memory", params);
    },
  });

  api.registerTool({
    name: "delete_memory",
    description:
      "Deletes a memory by cutting its URI path. Read it first to confirm what you are removing.",
    parameters: Type.Object({
      uri: Type.String({
        description: 'URI to delete (e.g. "core://agent/old_note")',
      }),
    }),
    async execute(agentId: string, params: { uri: string }) {
      return proxy(config, agentId, "delete_memory", params);
    },
  });

  api.registerTool({
    name: "add_alias",
    description: [
      "Creates an alias URI pointing to the same memory as target_uri.",
      "Aliases can cross domains. Subtree paths are cascaded automatically.",
    ].join("\n"),
    parameters: Type.Object({
      new_uri: Type.String({ description: "New alias URI" }),
      target_uri: Type.String({ description: "Existing URI to alias" }),
      priority: Type.Optional(
        Type.Integer({
          description: "Retrieval priority for this alias context",
          minimum: 0,
          default: 0,
        }),
      ),
      disclosure: Type.Optional(
        Type.String({ description: "Disclosure condition for this alias" }),
      ),
    }),
    async execute(
      agentId: string,
      params: {
        new_uri: string;
        target_uri: string;
        priority?: number;
        disclosure?: string;
      },
    ) {
      return proxy(config, agentId, "add_alias", params);
    },
  });

  api.registerTool({
    name: "manage_triggers",
    description: [
      "Binds / unbinds trigger words to a memory.",
      "A memory without triggers will never surface automatically.",
    ].join("\n"),
    parameters: Type.Object({
      uri: Type.String({ description: "Target memory URI" }),
      add: Type.Optional(
        Type.Array(Type.String(), { description: "Trigger words to add" }),
      ),
      remove: Type.Optional(
        Type.Array(Type.String(), { description: "Trigger words to remove" }),
      ),
    }),
    async execute(
      agentId: string,
      params: { uri: string; add?: string[]; remove?: string[] },
    ) {
      return proxy(config, agentId, "manage_triggers", params);
    },
  });

  api.registerTool({
    name: "search_memory",
    description: [
      "Full-text search over memories by path and content.",
      "Lexical search, not semantic. Use specific keywords.",
    ].join("\n"),
    parameters: Type.Object({
      query: Type.String({ description: "Search keywords" }),
      domain: Type.Optional(
        Type.String({
          description: 'Optional domain filter (e.g. "core", "writer")',
        }),
      ),
      limit: Type.Optional(
        Type.Integer({
          description: "Max results (default 10)",
          minimum: 1,
          default: 10,
        }),
      ),
    }),
    async execute(
      agentId: string,
      params: { query: string; domain?: string; limit?: number },
    ) {
      return proxy(config, agentId, "search_memory", params);
    },
  });
}

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
      (api.logger ?? console).warn(
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
    registerAllTools(api, config);

    api.registerService?.({
      name: "nocturne-memory",
      async stop() {
        await closeAll();
      },
    });
  },
};
