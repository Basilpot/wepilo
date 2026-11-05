import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler, getMcpAuthContext } from "agents/mcp/server";
import type { Env } from "@/env";
import { registerBuilderTools } from "./builder-tools";
import { isConnectionProps } from "./props";
import { registerStaffTools } from "./tools";

const INSTRUCTIONS = `Wepilo runs a travel agency's trips, departure dates, bookings, inquiries and website content.
You are connected as one staff member of one agency; every action uses their Wepilo permissions.
Start with today_summary when asked what needs attention. Prices are USD. Bookings are reservation requests: the agency collects payment itself.
Nothing you do here emails travellers; when a traveller needs a reply, draft it for the user to send.
Trips and posts you create are hidden drafts that the user reviews and publishes in the Wepilo dashboard. Confirm with the user before cancelling a booking.
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
