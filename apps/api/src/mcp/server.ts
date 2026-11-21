import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler, getMcpAuthContext } from "agents/mcp/server";
import type { Env } from "@/env";
import { registerBuilderTools } from "./builder-tools";
import { isConnectionProps } from "./props";
import { registerStaffTools } from "./tools";

const INSTRUCTIONS = `Wepilo runs a travel agency's trips, departure dates and website content (pages and journal posts), in every language the agency publishes in.
You are connected as one staff member of one agency; every action uses their Wepilo permissions, including whether they may publish.
Start with today_summary when asked what needs attention. Prices are USD.
Wepilo doesn't take bookings or keep an enquiry inbox: website enquiries are emailed straight to the agency, and departures show seats left that the agency keeps up to date. Nothing you do here emails travellers.
Create trips and posts as drafts. Publish them, or schedule them with publishAt, only when the user asks you to.
To translate, pass a language code (update_trip with language, translate_post) and only the translated text; the original stays as it is.
When helping build or edit the agency's public website, call get_website_connection first and never put an API key in browser code.`;

/** One MCP server per request, scoped to the staff member whose OAuth grant authorised it. */
export function mcpHandler(env: Env, ctx: ExecutionContext) {
  return createMcpHandler(
    () => {
      const server = new McpServer({ name: "wepilo", title: "Wepilo", version: "1.0.0" }, { instructions: INSTRUCTIONS });
      const props = getMcpAuthContext()?.props;
      if (!isConnectionProps(props)) return server;
      registerStaffTools(server, env, ctx, props);
      registerBuilderTools(server, env, ctx, props);
      return server;
    },
    {
      route: "/mcp",
      allowedHostnames: [new URL(env.API_BASE_URL).hostname, "localhost", "127.0.0.1"],
    },
  );
}
