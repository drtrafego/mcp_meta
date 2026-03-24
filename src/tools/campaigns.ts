import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FB_GRAPH_URL } from "../constants.js";
import {
  getAccessToken,
  makeGraphApiCall,
  makeGraphApiPostCall,
  fetchNode,
  prepareParams,
  handleApiError,
  getAccountId
} from "../services/graph-api.js";
import {
  FieldsSchema,
  FilteringSchema,
  PaginationSchema,
  TimeRangeSchema,
  DatePresetSchema,
  DateFormatSchema,
  EffectiveStatusSchema,
} from "../schemas/common.js";
import { getCenario } from "../cenarios.js";

export function registerCampaignTools(server: McpServer): void {
  server.registerTool(
    "meta_ads_get_campaign_by_id",
    {
      title: "Get Meta Campaign by ID",
      description: `Retrieve detailed information about a specific Meta ad campaign.

Args:
  - campaign_id (string): Campaign ID, e.g., '23843xxxxx'
  - fields (string[]): Fields to retrieve. Available: id, name, account_id, objective, status, effective_status, configured_status, daily_budget, lifetime_budget, budget_remaining, spend_cap, bid_strategy, buying_type, created_time, updated_time, start_time, stop_time, special_ad_categories, pacing_type, promoted_object, issues_info, recommendations
  - date_format (string): Date format: 'U' for Unix timestamp, 'Y-m-d H:i:s' for MySQL datetime, default: ISO 8601

Returns:
  Object with the requested campaign fields.

Examples:
  - Use when: "Get details for campaign 23843xxxxx"
  - Use when: "What is the objective and status of my campaign?"`,
      inputSchema: z.object({
        campaign_id: z.string().describe("Campaign ID, e.g., '23843xxxxx'"),
        fields: FieldsSchema,
        date_format: DateFormatSchema,
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ campaign_id, fields, date_format }) => {
      try {
        const data = await fetchNode(campaign_id, {
          fields,
          ...(date_format ? { date_format } : {}),
        });
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
          structuredContent: data as Record<string, unknown>,
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool(
    "meta_ads_get_campaigns_by_adaccount",
    {
      title: "Get Meta Campaigns by Ad Account",
      description: `Retrieve all campaigns from a specific Meta ad account with filtering and pagination.

Args:
  - cenario_id (string): ID do cenário/cliente, e.g., 'drtrafego_esp'
  - fields (string[]): Fields per campaign. Common: id, name, objective, effective_status, created_time, daily_budget, lifetime_budget, budget_remaining
  - effective_status (string[]): Filter by status: ACTIVE, PAUSED, DELETED, PENDING_REVIEW, DISAPPROVED, PREAPPROVED, PENDING_BILLING_INFO, ARCHIVED, WITH_ISSUES
  - objective (string[]): Filter by objective: APP_INSTALLS, BRAND_AWARENESS, CONVERSIONS, EVENT_RESPONSES, LEAD_GENERATION, LINK_CLICKS, MESSAGES, PAGE_LIKES, POST_ENGAGEMENT, PRODUCT_CATALOG_SALES, REACH, VIDEO_VIEWS
  - filtering (object[]): Additional filter objects with field, operator, value
  - limit (number): Results per page (1-100, default: 25)
  - after / before (string): Pagination cursors
  - date_preset / time_range: Date filter for campaigns
  - updated_since (number): Return campaigns updated since this Unix timestamp
  - is_completed (boolean): True = only completed, False = only active, null = both
  - special_ad_categories (string[]): Filter by: EMPLOYMENT, HOUSING, CREDIT, ISSUES_ELECTIONS_POLITICS, NONE
  - include_drafts (boolean): Include draft campaigns if true
  - date_format (string): Date format for response

Returns:
  Object with data (campaign array) and paging. Use meta_ads_fetch_pagination_url with paging.next for more results.`,
      inputSchema: z
        .object({
          cenario_id: z
            .string()
            .describe("ID do cenário/cliente, e.g., 'drtrafego_esp'"),
          fields: FieldsSchema,
          filtering: FilteringSchema,
          date_preset: DatePresetSchema,
          time_range: TimeRangeSchema.optional(),
          updated_since: z
            .number()
            .int()
            .optional()
            .describe("Return campaigns updated since this Unix timestamp"),
          effective_status: EffectiveStatusSchema,
          is_completed: z
            .boolean()
            .optional()
            .describe("True = only completed, False = only active, null = both"),
          special_ad_categories: z
            .array(z.enum(["EMPLOYMENT", "HOUSING", "CREDIT", "ISSUES_ELECTIONS_POLITICS", "NONE"]))
            .optional()
            .describe(
              "Filter by special ad categories: EMPLOYMENT, HOUSING, CREDIT, ISSUES_ELECTIONS_POLITICS, NONE"
            ),
          objective: z
            .array(z.string())
            .optional()
            .describe(
              "Filter by objective: APP_INSTALLS, BRAND_AWARENESS, CONVERSIONS, EVENT_RESPONSES, LEAD_GENERATION, LINK_CLICKS, MESSAGES, PAGE_LIKES, POST_ENGAGEMENT, PRODUCT_CATALOG_SALES, REACH, VIDEO_VIEWS"
            ),
          buyer_guarantee_agreement_status: z
            .array(z.enum(["APPROVED", "NOT_APPROVED"]))
            .optional()
            .describe("Filter by buyer guarantee agreement status: APPROVED, NOT_APPROVED"),
          date_format: DateFormatSchema,
          include_drafts: z
            .boolean()
            .optional()
            .describe("Include draft campaigns in results if true"),
        })
        .merge(PaginationSchema),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({
      cenario_id,
      fields,
      filtering,
      date_preset,
      time_range,
      updated_since,
      effective_status,
      is_completed,
      special_ad_categories,
      objective,
      buyer_guarantee_agreement_status,
      date_format,
      include_drafts,
      limit,
      after,
      before,
    }) => {
      try {
        const act_id = getCenario(cenario_id as string).account_id;
        const token = getAccessToken();
        const url = `${FB_GRAPH_URL}/${act_id}/campaigns`;
        const params = prepareParams(
          { access_token: token },
          {
            fields,
            filtering,
            date_preset,
            time_range,
            updated_since,
            effective_status,
            special_ad_categories,
            objective,
            buyer_guarantee_agreement_status,
            date_format,
            limit,
            after,
            before,
            ...(is_completed !== undefined ? { is_completed } : {}),
            ...(include_drafts !== undefined ? { include_drafts } : {}),
          }
        );
        const data = await makeGraphApiCall(url, params);
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
          structuredContent: data as Record<string, unknown>,
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  server.registerTool("meta_ads_create_campaign", {
    description: "Create a new campaign using cenario_id. Budget is entered in standard currency and multiplied by 100 automatically.",
    inputSchema: z.object({
      cenario_id: z.string().describe("ID do cenário/cliente, ex: drtrafego_esp"),
      name: z.string(),
      objective: z.enum(["OUTCOME_AWARENESS", "OUTCOME_TRAFFIC", "OUTCOME_ENGAGEMENT", "OUTCOME_LEADS", "OUTCOME_SALES", "OUTCOME_APP_PROMOTION"]).describe("Must be an ODAX objective"),
      status: z.enum(["ACTIVE", "PAUSED"]).default("PAUSED"),
      special_ad_categories: z.array(z.string()).default(["NONE"]),
      daily_budget: z.number().optional(),
      lifetime_budget: z.number().optional(),
      bid_strategy: z.string().default("LOWEST_COST_WITHOUT_CAP"),
    }),
    annotations: {
      destructiveHint: false,
      readOnlyHint: false,
    }
  }, async (params) => {
    try {
      const actId = getAccountId(params.cenario_id);
      const token = getAccessToken();
      const payload: Record<string, any> = {
        access_token: token,
        name: params.name,
        objective: params.objective,
        status: params.status,
        special_ad_categories: params.special_ad_categories,
        bid_strategy: params.bid_strategy
      };
      if (params.daily_budget) payload.daily_budget = Math.round(params.daily_budget * 100);
      if (params.lifetime_budget) payload.lifetime_budget = Math.round(params.lifetime_budget * 100);

      const data = await makeGraphApiPostCall(`${FB_GRAPH_URL}/${actId}/campaigns`, payload);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: handleApiError(err) }] };
    }
  });

  server.registerTool("meta_ads_update_campaign", {
    description: "Update an existing campaign.",
    inputSchema: z.object({
      campaign_id: z.string(),
      name: z.string().optional(),
      status: z.enum(["ACTIVE", "PAUSED", "ARCHIVED", "DELETED"]).optional(),
      daily_budget: z.number().optional(),
      lifetime_budget: z.number().optional()
    }),
    annotations: {
      destructiveHint: false,
      readOnlyHint: false,
    }
  }, async (params) => {
    try {
      const token = getAccessToken();
      const payload: Record<string, any> = { access_token: token };
      if (params.name) payload.name = params.name;
      if (params.status) payload.status = params.status;
      if (params.daily_budget !== undefined) payload.daily_budget = Math.round(params.daily_budget * 100);
      if (params.lifetime_budget !== undefined) payload.lifetime_budget = Math.round(params.lifetime_budget * 100);

      const data = await makeGraphApiPostCall(`${FB_GRAPH_URL}/${params.campaign_id}`, payload);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: handleApiError(err) }] };
    }
  });

  server.registerTool("meta_ads_duplicate_campaign", {
    description: "Duplicate a campaign.",
    inputSchema: z.object({
      campaign_id: z.string(),
      name: z.string().optional().describe("Name of the new campaign"),
      status_option: z.enum(["ACTIVE", "PAUSED", "INHERIT"]).default("PAUSED")
    }),
    annotations: {
      destructiveHint: false,
      readOnlyHint: false,
    }
  }, async (params) => {
    try {
      const token = getAccessToken();
      const payload: Record<string, any> = { access_token: token, status_option: params.status_option };
      if (params.name) payload.rename_options = { rename_prefix: params.name }; 

      const data = await makeGraphApiPostCall(`${FB_GRAPH_URL}/${params.campaign_id}/copies`, payload);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: handleApiError(err) }] };
    }
  });

  server.registerTool("meta_ads_bulk_update_campaigns", {
    description: "Update multiple campaigns at once. Note: Operations are sequential.",
    inputSchema: z.object({
      campaign_ids: z.array(z.string()),
      status: z.enum(["ACTIVE", "PAUSED", "ARCHIVED", "DELETED"]).optional(),
      daily_budget: z.number().optional()
    }),
    annotations: {
      destructiveHint: false,
      readOnlyHint: false,
    }
  }, async (params) => {
    try {
      const token = getAccessToken();
      const results: any[] = [];
      const payloadBase: Record<string, any> = { access_token: token };
      if (params.status) payloadBase.status = params.status;
      if (params.daily_budget !== undefined) payloadBase.daily_budget = Math.round(params.daily_budget * 100);

      for (const id of params.campaign_ids) {
        try {
          const res = await makeGraphApiPostCall(`${FB_GRAPH_URL}/${id}`, payloadBase);
          results.push({ id, status: "success", data: res });
        } catch (e: any) {
          results.push({ id, status: "error", error: e?.response?.data || e.message });
        }
      }
      return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: handleApiError(err) }] };
    }
  });
}
