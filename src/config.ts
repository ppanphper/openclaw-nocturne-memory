/**
 * Plugin configuration types.
 *
 * Example openclaw.json5 config:
 * ```json5
 * {
 *   plugins: {
 *     "nocturne-memory": {
 *       url: "http://localhost:8000",
 *       agents: [
 *         { agentId: "main", namespace: "main" },
 *         { agentId: "research", namespace: "research" }
 *       ],
 *       defaultNamespace: ""   // optional fallback for unconfigured agents
 *     }
 *   }
 * }
 * ```
 */

export interface AgentNamespaceMapping {
  agentId: string;
  namespace: string;
}

export interface NocturneMemoryConfig {
  /** NM server base URL (e.g. "http://localhost:8000") */
  url: string;
  /** Per-agent namespace mappings */
  agents: AgentNamespaceMapping[];
  /** Fallback namespace for agents not in the list (default: "") */
  defaultNamespace?: string;
}

export function resolveNamespace(
  config: NocturneMemoryConfig,
  agentId: string,
): string {
  const mapping = config.agents.find((a) => a.agentId === agentId);
  if (mapping) return mapping.namespace;
  return config.defaultNamespace ?? "";
}

export function getMcpEndpoint(baseUrl: string, namespace: string): string {
  const url = new URL("/mcp", baseUrl);
  if (namespace) {
    url.searchParams.set("namespace", namespace);
  }
  return url.toString();
}
