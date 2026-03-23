declare module "openclaw/plugin-sdk/plugin-entry" {
  interface PluginEntryOptions {
    id: string;
    name: string;
    description: string;
    kind?: string;
    configSchema?: unknown;
    register: (api: OpenClawPluginApi) => void;
  }

  interface OpenClawPluginApi {
    id: string;
    name: string;
    pluginConfig: Record<string, unknown>;
    logger: {
      debug: (...args: unknown[]) => void;
      info: (...args: unknown[]) => void;
      warn: (...args: unknown[]) => void;
      error: (...args: unknown[]) => void;
    };
    registerTool: (tool: unknown, opts?: unknown) => void;
    registerService: (service: unknown) => void;
    [key: string]: unknown;
  }

  export function definePluginEntry(opts: PluginEntryOptions): unknown;
}
