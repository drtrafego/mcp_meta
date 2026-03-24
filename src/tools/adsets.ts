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
  getAccountId,
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

const ADSET_FIELDS_DESC =
  "Fields per ad set. Common: id, name, account_id, campaign_id, status, effective_status, daily_budget, lifetime_budget, budget_remaining, bid_amount, bid_strategy, billing_event, optimization_goal, targeting, start_time, end_time, created_time, updated_time, pacing_type, destination_type";

export function registerAdSetTools(server: McpServer): void {
  server.registerTool(
    "meta_ads_get_adset_by_id",
    {
      title: "Get Meta Ad Set by ID",
      description: `Retrieve detailed information about a specific Meta ad set.

Args:
  - adset_id (string): Ad set ID, e.g., '23843211234567'
  - fields (string[]): ${ADSET_FIELDS_DESC}

Returns:
  Object with the requested ad set fields.

Examples:
  - Use when: "Get the targeting and budget for ad set 23843211234567"
  - Use when: "What is the optimization goal and status of this ad set?"`,
      inputSchema: z.object({
        adset_id: z.string().describe("Ad set ID, e.g., '23843211234567'"),
        fields: FieldsSchema,
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ adset_id, fields }) => {
      try {
        const data = await fetchNode(adset_id, { fields });
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
    "meta_ads_get_adsets_by_ids",
    {
      title: "Get Multiple Meta Ad Sets by IDs",
      description: `Retrieve information for multiple Meta ad sets in a single API call (batch lookup).

Efficient when you need data for several ad sets at once.

Args:
  - adset_ids (string[]): List of ad set IDs to retrieve, e.g., ['23843211234567', '23843211234568']
  - fields (string[]): ${ADSET_FIELDS_DESC}
  - date_format (string): Date format: 'U' for Unix timestamp, 'Y-m-d H:i:s' for MySQL datetime

Returns:
  Object where keys are ad set IDs and values are the corresponding ad set details.

Examples:
  - Use when: "Get details for ad sets 23843211234567, 23843211234568, and 23843211234569"`,
      inputSchema: z.object({
        adset_ids: z
          .array(z.string())
          .min(1)
          .describe("List of ad set IDs, e.g., ['23843211234567', '23843211234568']"),
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
    async ({ adset_ids, fields, date_format }) => {
      try {
        const token = getAccessToken();
        const url = `${FB_GRAPH_URL}/`;
        const params = prepareParams(
          { access_token: token, ids: adset_ids.join(",") },
          { fields, ...(date_format ? { date_format } : {}) }
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

  server.registerTool(
    "meta_ads_get_adsets_by_adaccount",
    {
      title: "Get Meta Ad Sets by Ad Account",
      description: `Retrieve all ad sets from a specific Meta ad account with filtering and pagination.

Args:
  - cenario_id (string): ID do cenário/cliente, e.g., 'drtrafego_esp'
  - fields (string[]): ${ADSET_FIELDS_DESC}
  - effective_status (string[]): Filter by status: ACTIVE, PAUSED, DELETED, PENDING_REVIEW, DISAPPROVED, PREAPPROVED, PENDING_BILLING_INFO, CAMPAIGN_PAUSED, ARCHIVED, WITH_ISSUES
  - filtering (object[]): Additional filter objects, e.g., [{field: 'daily_budget', operator: 'GREATER_THAN', value: 1000}]
  - limit (number): Results per page (1-100, default: 25)
  - after / before (string): Pagination cursors
  - date_preset / time_range: Date filter
  - updated_since (number): Unix timestamp — return ad sets updated since this time
  - date_format (string): Date format for response

Returns:
  Object with data (ad set array) and paging. Use meta_ads_fetch_pagination_url with paging.next for more results.`,
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
            .describe("Return ad sets updated since this Unix timestamp"),
          effective_status: EffectiveStatusSchema,
          date_format: DateFormatSchema,
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
      date_format,
      limit,
      after,
      before,
    }) => {
      try {
        const act_id = getCenario(cenario_id as string).account_id;
        const token = getAccessToken();
        const url = `${FB_GRAPH_URL}/${act_id}/adsets`;
        const params = prepareParams(
          { access_token: token },
          {
            fields,
            filtering,
            date_preset,
            time_range,
            updated_since,
            effective_status,
            date_format,
            limit,
            after,
            before,
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

  server.registerTool(
    "meta_ads_get_adsets_by_campaign",
    {
      title: "Get Meta Ad Sets by Campaign",
      description: `Retrieve all ad sets belonging to a specific Meta campaign with filtering and pagination.

Args:
  - campaign_id (string): Campaign ID, e.g., '23843xxxxx'
  - fields (string[]): ${ADSET_FIELDS_DESC}
  - effective_status (string[]): Filter by status: ACTIVE, PAUSED, DELETED, PENDING_REVIEW, DISAPPROVED, PREAPPROVED, PENDING_BILLING_INFO, ARCHIVED, WITH_ISSUES
  - filtering (object[]): Additional filter objects, e.g., [{field: 'optimization_goal', operator: 'IN', value: ['OFFSITE_CONVERSIONS', 'VALUE']}]
  - limit (number): Results per page (1-100, default: 25)
  - after / before (string): Pagination cursors
  - date_format (string): Date format for response

Returns:
  Object with data (ad set array) and paging. Use meta_ads_fetch_pagination_url with paging.next for more results.`,
      inputSchema: z
        .object({
          campaign_id: z.string().describe("Campaign ID, e.g., '23843xxxxx'"),
          fields: FieldsSchema,
          filtering: FilteringSchema,
          effective_status: EffectiveStatusSchema,
          date_format: DateFormatSchema,
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
      campaign_id,
      fields,
      filtering,
      effective_status,
      date_format,
      limit,
      after,
      before,
    }) => {
      try {
        const token = getAccessToken();
        const url = `${FB_GRAPH_URL}/${campaign_id}/adsets`;
        const params = prepareParams(
          { access_token: token },
          { fields, filtering, effective_status, date_format, limit, after, before }
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

  server.registerTool("meta_ads_create_adset", {
    description: "Create an Ad Set. Budget is multiplied by 100.",
    inputSchema: z.object({
      cenario_id: z.string().describe("ID do cenário/cliente, ex: drtrafego_esp"),
      campaign_id: z.string(),
      name: z.string(),
      daily_budget: z.number().optional(),
      lifetime_budget: z.number().optional(),
      start_time: z.string().optional(),
      end_time: z.string().optional(),
      optimization_goal: z.string(),
      billing_event: z.string().default("IMPRESSIONS"),
      status: z.enum(["ACTIVE", "PAUSED"]).default("PAUSED"),
      promoted_object: z.record(z.any()).optional(),
      targeting: z.record(z.any()).describe("Targeting object. User is free to construct this. Must include advantage_audience: 0"),
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
        campaign_id: params.campaign_id,
        name: params.name,
        optimization_goal: params.optimization_goal,
        billing_event: params.billing_event,
        status: params.status,
        targeting: params.targeting
      };
      
      if (!payload.targeting.targeting_automation) {
        payload.targeting.targeting_automation = { advantage_audience: 0 };
      }
      
      if (params.daily_budget) payload.daily_budget = Math.round(params.daily_budget * 100);
      if (params.lifetime_budget) payload.lifetime_budget = Math.round(params.lifetime_budget * 100);
      if (params.start_time) payload.start_time = params.start_time;
      if (params.end_time) payload.end_time = params.end_time;
      if (params.promoted_object) payload.promoted_object = JSON.stringify(params.promoted_object);
      
      payload.targeting = JSON.stringify(payload.targeting);

      const data = await makeGraphApiPostCall(`${FB_GRAPH_URL}/${actId}/adsets`, payload);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: handleApiError(err) }] };
    }
  });

  server.registerTool("meta_ads_update_adset", {
    description: "Update an existing Ad Set.",
    inputSchema: z.object({
      adset_id: z.string(),
      name: z.string().optional(),
      status: z.enum(["ACTIVE", "PAUSED", "ARCHIVED", "DELETED"]).optional(),
      daily_budget: z.number().optional(),
      lifetime_budget: z.number().optional(),
      targeting: z.record(z.any()).optional()
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
      if (params.targeting) {
        if (!params.targeting.targeting_automation) params.targeting.targeting_automation = { advantage_audience: 0 };
        payload.targeting = JSON.stringify(params.targeting);
      }

      const data = await makeGraphApiPostCall(`${FB_GRAPH_URL}/${params.adset_id}`, payload);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: handleApiError(err) }] };
    }
  });

  server.registerTool("meta_ads_duplicate_adset", {
    description: "Duplicate an Ad Set.",
    inputSchema: z.object({
      adset_id: z.string(),
      name: z.string().optional().describe("Name of the new Ad Set"),
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

      const data = await makeGraphApiPostCall(`${FB_GRAPH_URL}/${params.adset_id}/copies`, payload);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: handleApiError(err) }] };
    }
  });

  server.registerTool("meta_ads_bulk_update_adsets", {
    description: "Update multiple Ad Sets sequentially.",
    inputSchema: z.object({
      adset_ids: z.array(z.string()),
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

      for (const id of params.adset_ids) {
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
