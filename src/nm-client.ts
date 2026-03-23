/**
 * Nocturne Memory MCP client — maintains one connection per namespace.
 */

import { Client } from "@modelcontextprotocol/sdk/client";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { getMcpEndpoint } from "./config.js";

interface ToolResult {
  content: Array<{ type: string; text?: string }>;
  isError?: boolean;
}

const clients = new Map<string, Client>();

let baseUrl = "http://localhost:8000";

export function setBaseUrl(url: string): void {
  baseUrl = url.replace(/\/+$/, "");
}

async function getClient(namespace: string): Promise<Client> {
  const key = namespace;
  const existing = clients.get(key);
  if (existing) return existing;

  const endpoint = getMcpEndpoint(baseUrl, namespace);
  const client = new Client({
    name: "openclaw-nocturne-memory",
    version: "0.1.0",
  });
  const transport = new StreamableHTTPClientTransport(new URL(endpoint));
  await client.connect(transport);

  clients.set(key, client);
  return client;
}

export async function callNMTool(
  namespace: string,
  toolName: string,
  args: Record<string, unknown>,
): Promise<string> {
  try {
    const client = await getClient(namespace);
    const result = (await client.callTool({
      name: toolName,
      arguments: args,
    })) as ToolResult;

    const texts: string[] = [];
    for (const item of result.content) {
      if (item.type === "text" && item.text) texts.push(item.text);
    }
    return texts.join("\n") || "(empty response)";
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Nocturne Memory (${toolName}, ns="${namespace}") failed: ${msg}`,
    );
  }
}

export async function closeAll(): Promise<void> {
  const closing = [...clients.values()].map(async (c) => {
    try {
      await c.close();
    } catch {
      /* best effort */
    }
  });
  await Promise.all(closing);
  clients.clear();
}
