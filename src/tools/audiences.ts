import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FB_GRAPH_URL } from "../constants.js";
import {
  getAccessToken,
  makeGraphApiCall,
  prepareParams,
  handleApiError,
  getAccountId
} from "../services/graph-api.js";

export function registerAudiencesTools(server: McpServer): void {
  server.registerTool("meta_ads_search_interests", {
    description: "Search for ad interests targeting based on keywords.",
    inputSchema: z.object({
      query: z.string().describe("Keyword to search for, e.g., 'fitness' or 'business'")
    })
  }, async (params) => {
    try {
      const token = getAccessToken();
      const url = `${FB_GRAPH_URL}/search`;
      const queryParams = prepareParams({ access_token: token, type: 'adinterest', q: params.query }, {});
      const data = await makeGraphApiCall(url, queryParams);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: handleApiError(err) }] };
    }
  });

  server.registerTool("meta_ads_bulk_search_interests", {
    description: "Search for multiple interest keywords at once.",
    inputSchema: z.object({
      queries: z.array(z.string()).describe("Array of keywords")
    })
  }, async (params) => {
    try {
      const token = getAccessToken();
      const url = `${FB_GRAPH_URL}/search`;
      const results: any[] = [];
      for (const query of params.queries) {
        try {
          const queryParams = prepareParams({ access_token: token, type: 'adinterest', q: query }, {});
          const data = await makeGraphApiCall(url, queryParams);
          results.push({ query, data });
        } catch (e: any) {
          results.push({ query, error: e?.response?.data || e.message });
        }
      }
      return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: handleApiError(err) }] };
    }
  });

  server.registerTool("meta_ads_get_interest_suggestions", {
    description: "Get suggestions for ad interests based on existing interests.",
    inputSchema: z.object({
      interest_list: z.array(z.string()).describe("List of interest names/keywords to base suggestions on")
    })
  }, async (params) => {
    try {
      const token = getAccessToken();
      const url = `${FB_GRAPH_URL}/search`;
      const queryParams = prepareParams({
        access_token: token,
        type: 'adinterestsuggestion',
        interest_list: JSON.stringify(params.interest_list)
      }, {});
      const data = await makeGraphApiCall(url, queryParams);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: handleApiError(err) }] };
    }
  });

  server.registerTool("meta_ads_search_geo_locations", {
    description: "Search for geo locations (countries, regions, cities, zips).",
    inputSchema: z.object({
      query: z.string(),
      location_types: z.array(z.enum(["country", "region", "city", "zip", "custom_location"])).optional()
    })
  }, async (params) => {
    try {
      const token = getAccessToken();
      const url = `${FB_GRAPH_URL}/search`;
      const queryParams: Record<string, any> = { access_token: token, type: 'adgeolocation', q: params.query };
      if (params.location_types) {
        queryParams.location_types = JSON.stringify(params.location_types);
      }
      const data = await makeGraphApiCall(url, queryParams);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: handleApiError(err) }] };
    }
  });

  server.registerTool("meta_ads_estimate_audience_size", {
    description: "Estimate the audience size for a given targeting configuration.",
    inputSchema: z.object({
      cenario_id: z.string().describe("ID do cenário/cliente"),
      optimization_goal: z.string().default("IMPRESSIONS"),
      targeting_spec: z.record(z.any()).describe("The complete targeting object you plan to use")
    })
  }, async (params) => {
    try {
      const actId = getAccountId(params.cenario_id);
      const token = getAccessToken();
      const url = `${FB_GRAPH_URL}/${actId}/delivery_estimate`;
      const queryParams = prepareParams({
        access_token: token,
        optimization_goal: params.optimization_goal,
        targeting_spec: JSON.stringify(params.targeting_spec)
      }, {});
      const data = await makeGraphApiCall(url, queryParams);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: handleApiError(err) }] };
    }
  });

  server.registerTool("meta_ads_search_pages_by_name", {
    description: "Search Facebook public pages by name.",
    inputSchema: z.object({
      query: z.string()
    })
  }, async (params) => {
    try {
      const token = getAccessToken();
      const url = `${FB_GRAPH_URL}/search`;
      const queryParams = prepareParams({ access_token: token, type: 'page', q: params.query, fields: "id,name,link,verification_status" }, {});
      const data = await makeGraphApiCall(url, queryParams);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: handleApiError(err) }] };
    }
  });

  server.registerTool("meta_ads_get_custom_audiences", {
    description: "Retrieve native or imported Custom Audiences from an Ad Account.",
    inputSchema: z.object({
      cenario_id: z.string().describe("ID do cenário/cliente"),
      fields: z.array(z.string()).default(["id", "name", "description", "approximate_count_upper_bound", "approximate_count_lower_bound"])
    })
  }, async (params) => {
    try {
      const actId = getAccountId(params.cenario_id);
      const token = getAccessToken();
      const url = `${FB_GRAPH_URL}/${actId}/customaudiences`;
      const queryParams: Record<string, any> = { access_token: token };
      if (params.fields && params.fields.length > 0) {
        queryParams.fields = params.fields.join(",");
      }
      const data = await makeGraphApiCall(url, queryParams);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: handleApiError(err) }] };
    }
  });
}
