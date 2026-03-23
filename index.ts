/**
 * OpenClaw Nocturne Memory Plugin
 *
 * Provides multi-agent long-term memory with namespace isolation.
 * Each agent operates in its own namespace, unaware of others' memories.
 */

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

const TOOLS = [
  {
    name: "read_memory",
    description:
      "Reads a memory by its URI.\n\nSpecial System URIs:\n- system://boot   : Loads your core memories (startup only).\n- system://index  : Full index of all available memories.\n- system://index/<domain> : Index of memories under a domain.\n- system://recent : Recently modified memories (default 10).\n- system://recent/N : The N most recently modified memories.\n- system://glossary : All glossary keywords and their bound nodes.",
    parameters: {
      type: "object" as const,
      required: ["uri"],
      properties: {
        uri: { type: "string", description: 'Memory URI (e.g. "core://agent")' },
      },
    },
    mcpName: "read_memory",
  },
  {
    name: "create_memory",
    description:
      "Creates a new memory under a parent URI. parent_uri MUST point to an existing node.",
    parameters: {
      type: "object" as const,
      required: ["parent_uri", "content", "priority"],
      properties: {
        parent_uri: {
          type: "string",
          description: 'Parent URI (e.g. "core://agent"). Use "core://" for root.',
        },
        content: { type: "string", description: "Memory content" },
        priority: {
          type: "integer",
          description: "Retrieval priority (lower = higher priority, min 0)",
          minimum: 0,
        },
        title: {
          type: "string",
          description: "Child title (becomes URI segment). Auto-generated if omitted.",
        },
        disclosure: {
          type: "string",
          description: 'When to disclose this memory (e.g. "When asked about pets")',
        },
      },
    },
    mcpName: "create_memory",
  },
  {
    name: "update_memory",
    description:
      "Updates an existing memory. Read it first to know what you are overwriting.\nTwo content-editing modes (mutually exclusive):\n- old_string / new_string : Replace a substring.\n- append : Append text to the end.",
    parameters: {
      type: "object" as const,
      required: ["uri"],
      properties: {
        uri: { type: "string", description: "Memory URI to update" },
        old_string: { type: "string", description: "Substring to replace" },
        new_string: { type: "string", description: "Replacement text" },
        append: { type: "string", description: "Text to append" },
        priority: { type: "integer", description: "New priority", minimum: 0 },
        disclosure: { type: "string", description: "New disclosure condition" },
      },
    },
    mcpName: "update_memory",
  },
  {
    name: "delete_memory",
    description:
      "Deletes a memory by cutting its URI path. Read it first to confirm what you are removing.",
    parameters: {
      type: "object" as const,
      required: ["uri"],
      properties: {
        uri: {
          type: "string",
          description: 'URI to delete (e.g. "core://agent/old_note")',
        },
      },
    },
    mcpName: "delete_memory",
  },
  {
    name: "add_alias",
    description:
      "Creates an alias URI pointing to the same memory as target_uri. Aliases can cross domains. Subtree paths are cascaded automatically.",
    parameters: {
      type: "object" as const,
      required: ["new_uri", "target_uri"],
      properties: {
        new_uri: { type: "string", description: "New alias URI" },
        target_uri: { type: "string", description: "Existing URI to alias" },
        priority: {
          type: "integer",
          description: "Retrieval priority for this alias context",
          minimum: 0,
        },
        disclosure: { type: "string", description: "Disclosure condition for this alias" },
      },
    },
    mcpName: "add_alias",
  },
  {
    name: "manage_triggers",
    description:
      "Binds / unbinds trigger words to a memory. A memory without triggers will never surface automatically.",
    parameters: {
      type: "object" as const,
      required: ["uri"],
      properties: {
        uri: { type: "string", description: "Target memory URI" },
        add: { type: "array", items: { type: "string" }, description: "Trigger words to add" },
        remove: {
          type: "array",
          items: { type: "string" },
          description: "Trigger words to remove",
        },
      },
    },
    mcpName: "manage_triggers",
  },
  {
    name: "search_memory",
    description:
      "Full-text search over memories by path and content. Lexical search, not semantic. Use specific keywords.",
    parameters: {
      type: "object" as const,
      required: ["query"],
      properties: {
        query: { type: "string", description: "Search keywords" },
        domain: {
          type: "string",
          description: 'Optional domain filter (e.g. "core", "writer")',
        },
        limit: {
          type: "integer",
          description: "Max results (default 10)",
          minimum: 1,
        },
      },
    },
    mcpName: "search_memory",
  },
] as const;

// PluginToolContext shape exposed by OpenClaw — only agentId is needed here.
type PluginToolContext = { agentId?: string };

function registerAllTools(api: Api, config: NocturneMemoryConfig): void {
  const log = api.logger ?? console;

  for (const tool of TOOLS) {
    try {
      // Use the ToolFactory pattern so that ctx.agentId is correctly captured
      // at resolve-time rather than at call-time.
      //
      // Previously the tool was registered as a plain object and OpenClaw would
      // call execute(toolCallId, params, ...) — the first argument being a call
      // ID string like "call_abc123", not the agent ID.  That caused every agent
      // to fall back to defaultNamespace and share the same memory namespace.
      api.registerTool(
        (ctx: PluginToolContext) => ({
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
          async execute(_toolCallId: string, params: Record<string, unknown>) {
            return proxy(config, ctx.agentId ?? "", tool.mcpName, params);
          },
        }),
        { name: tool.name },
      );
      log.info(`[nocturne-memory] registered tool: ${tool.name}`);
    } catch (err) {
      log.error(
        `[nocturne-memory] FAILED to register tool "${tool.name}": ${err}`,
      );
      throw err;
    }
  }
}

export default {
  id: "nocturne-memory",
  name: "Nocturne Memory",
  description:
    "Multi-agent long-term memory powered by Nocturne Memory with namespace isolation.",

  register(api: Api): void {
    const log = api.logger ?? console;

    // Debug: show what pluginConfig actually contains
    log.info(
      `[nocturne-memory] api.pluginConfig = ${JSON.stringify(api.pluginConfig)}`,
    );

    const raw = api.pluginConfig as Record<string, unknown> | undefined;
    const config: NocturneMemoryConfig = {
      url: (raw?.url as string) ?? "",
      agents: (raw?.agents as NocturneMemoryConfig["agents"]) ?? [],
      defaultNamespace: (raw?.defaultNamespace as string) ?? "",
    };

    if (!config.url) {
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
    registerAllTools(api, config);

    api.registerService?.({
      id: "nocturne-memory",
      start() {},
      async stop() {
        await closeAll();
      },
    });
  },
};
