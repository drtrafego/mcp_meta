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
import { validateBulkSize } from "../services/validators.js";
import { BULK_DELAY_MS, MAX_BULK_ITEMS, sleep } from "../services/rate-limiter.js";

const AD_FIELDS_DESC =
  "Fields per ad. Common: id, name, account_id, adset_id, campaign_id, status, effective_status, configured_status, creative, bid_amount, bid_type, created_time, updated_time, targeting, conversion_specs, recommendations, preview_shareable_link";

export function registerAdTools(server: McpServer): void {
  server.registerTool(
    "meta_ads_get_ad_by_id",
    {
      title: "Get Meta Ad by ID",
      description: `Retrieve detailed information about a specific Meta ad.

Args:
  - ad_id (string): Ad ID, e.g., '23843211234567'
  - fields (string[]): ${AD_FIELDS_DESC}

Returns:
  Object with the requested ad fields.

Examples:
  - Use when: "Get details for ad 23843211234567"
  - Use when: "What creative and status does this ad have?"`,
      inputSchema: z.object({
        ad_id: z.string().describe("Ad ID, e.g., '23843211234567'"),
        fields: FieldsSchema,
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ ad_id, fields }) => {
      try {
        const data = await fetchNode(ad_id, { fields });
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
    "meta_ads_get_ads_by_adaccount",
    {
      title: "Get Meta Ads by Ad Account",
      description: `Retrieve all ads from a specific Meta ad account with filtering and pagination.

Args:
  - account_id (string): Ad account ID, e.g. 'act_663136558021878'
  - fields (string[]): ${AD_FIELDS_DESC}
  - effective_status (string[]): Filter by status: ACTIVE, PAUSED, DELETED, PENDING_REVIEW, DISAPPROVED, PREAPPROVED, PENDING_BILLING_INFO, CAMPAIGN_PAUSED, ARCHIVED, ADSET_PAUSED, IN_PROCESS, WITH_ISSUES
  - filtering (object[]): Additional filter objects with field, operator, value
  - limit (number): Results per page (1-100, default: 25)
  - after / before (string): Pagination cursors
  - date_preset / time_range: Date filter
  - updated_since (number): Unix timestamp — return ads updated since this time

Returns:
  Object with data (ad array) and paging. Use meta_ads_fetch_pagination_url with paging.next for more results.`,
      inputSchema: z
        .object({
          account_id: z
            .string()
            .describe("Ad account ID, e.g. 'act_663136558021878'"),
          fields: FieldsSchema,
          filtering: FilteringSchema,
          date_preset: DatePresetSchema,
          time_range: TimeRangeSchema.optional(),
          updated_since: z
            .number()
            .int()
            .optional()
            .describe("Return ads updated since this Unix timestamp"),
          effective_status: EffectiveStatusSchema,
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
      account_id,
      fields,
      filtering,
      date_preset,
      time_range,
      updated_since,
      effective_status,
      limit,
      after,
      before,
    }) => {
      try {
        const token = getAccessToken();
        const url = `${FB_GRAPH_URL}/${account_id}/ads`;
        const params = prepareParams(
          { access_token: token },
          {
            fields,
            filtering,
            date_preset,
            time_range,
            updated_since,
            effective_status,
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
    "meta_ads_get_ads_by_campaign",
    {
      title: "Get Meta Ads by Campaign",
      description: `Retrieve all ads belonging to a specific Meta campaign with filtering and pagination.

Args:
  - campaign_id (string): Campaign ID, e.g., '23843xxxxx'
  - fields (string[]): ${AD_FIELDS_DESC}
  - effective_status (string[]): Filter by status: ACTIVE, PAUSED, DELETED, PENDING_REVIEW, DISAPPROVED, PREAPPROVED, PENDING_BILLING_INFO, ADSET_PAUSED, ARCHIVED, IN_PROCESS, WITH_ISSUES
  - filtering (object[]): Additional filter objects with field, operator, value
  - limit (number): Results per page (1-100, default: 25)
  - after / before (string): Pagination cursors

Returns:
  Object with data (ad array) and paging. Use meta_ads_fetch_pagination_url with paging.next for more results.`,
      inputSchema: z
        .object({
          campaign_id: z.string().describe("Campaign ID, e.g., '23843xxxxx'"),
          fields: FieldsSchema,
          filtering: FilteringSchema,
          effective_status: EffectiveStatusSchema,
        })
        .merge(PaginationSchema),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ campaign_id, fields, filtering, effective_status, limit, after, before }) => {
      try {
        const token = getAccessToken();
        const url = `${FB_GRAPH_URL}/${campaign_id}/ads`;
        const params = prepareParams(
          { access_token: token },
          { fields, filtering, effective_status, limit, after, before }
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
    "meta_ads_get_ads_by_adset",
    {
      title: "Get Meta Ads by Ad Set",
      description: `Retrieve all ads belonging to a specific Meta ad set with filtering and pagination.

Args:
  - adset_id (string): Ad set ID, e.g., '23843211234567'
  - fields (string[]): ${AD_FIELDS_DESC}
  - effective_status (string[]): Filter by status: ACTIVE, PAUSED, DELETED, PENDING_REVIEW, DISAPPROVED, PREAPPROVED, PENDING_BILLING_INFO, CAMPAIGN_PAUSED, ARCHIVED, IN_PROCESS, WITH_ISSUES
  - filtering (object[]): Filter objects. Operators: EQUAL, NOT_EQUAL, GREATER_THAN, GREATER_THAN_OR_EQUAL, LESS_THAN, LESS_THAN_OR_EQUAL, IN_RANGE, NOT_IN_RANGE, CONTAIN, NOT_CONTAIN, IN, NOT_IN, EMPTY, NOT_EMPTY
  - limit (number): Results per page (1-100, default: 25, max: 100)
  - after / before (string): Pagination cursors
  - date_format (string): Date format for response

Returns:
  Object with data (ad array) and paging. Use meta_ads_fetch_pagination_url with paging.next for more results.`,
      inputSchema: z
        .object({
          adset_id: z.string().describe("Ad set ID, e.g., '23843211234567'"),
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
    async ({ adset_id, fields, filtering, effective_status, date_format, limit, after, before }) => {
      try {
        const token = getAccessToken();
        const url = `${FB_GRAPH_URL}/${adset_id}/ads`;
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

  server.registerTool("meta_ads_create_ad", {
    description: "Create a new Ad linked to an Ad Set and a Creative.",
    inputSchema: z.object({
      account_id: z.string().describe("Ad account ID, e.g. 'act_663136558021878'"),
      adset_id: z.string(),
      creative_id: z.string(),
      name: z.string(),
      status: z.enum(["ACTIVE", "PAUSED"]).default("PAUSED")
    }),
    annotations: {
      destructiveHint: false,
      readOnlyHint: false,
    }
  }, async (params) => {
    try {
      const actId = params.account_id;
      const token = getAccessToken();
      const payload: Record<string, any> = {
        access_token: token,
        adset_id: params.adset_id,
        creative: JSON.stringify({ creative_id: params.creative_id }),
        name: params.name,
        status: params.status
      };

      const data = await makeGraphApiPostCall(`${FB_GRAPH_URL}/${actId}/ads`, payload);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: handleApiError(err) }] };
    }
  });

  server.registerTool("meta_ads_update_ad", {
    description: "Update an existing Ad.",
    inputSchema: z.object({
      ad_id: z.string(),
      name: z.string().optional(),
      status: z.enum(["ACTIVE", "PAUSED", "ARCHIVED", "DELETED"]).optional(),
      creative_id: z.string().optional()
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
      if (params.creative_id) payload.creative = JSON.stringify({ creative_id: params.creative_id });

      const data = await makeGraphApiPostCall(`${FB_GRAPH_URL}/${params.ad_id}`, payload);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: handleApiError(err) }] };
    }
  });

  server.registerTool("meta_ads_duplicate_ad", {
    description: "Duplicate an Ad.",
    inputSchema: z.object({
      ad_id: z.string(),
      name: z.string().optional().describe("Name of the new Ad"),
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

      const data = await makeGraphApiPostCall(`${FB_GRAPH_URL}/${params.ad_id}/copies`, payload);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: handleApiError(err) }] };
    }
  });

  server.registerTool("meta_ads_bulk_update_ads", {
    description: `Update multiple Ads sequentially with rate-limit-safe delays. Maximum ${MAX_BULK_ITEMS} ads per call.`,
    inputSchema: z.object({
      ad_ids: z.array(z.string()).max(MAX_BULK_ITEMS),
      status: z.enum(["ACTIVE", "PAUSED", "ARCHIVED", "DELETED"]).optional(),
    }),
    annotations: {
      destructiveHint: false,
      readOnlyHint: false,
    }
  }, async (params) => {
    try {
      const bulkError = validateBulkSize(params.ad_ids, MAX_BULK_ITEMS, "ads");
      if (bulkError) {
        return { content: [{ type: "text", text: `Validation Error: ${bulkError}` }] };
      }

      const token = getAccessToken();
      const results: any[] = [];
      const payloadBase: Record<string, any> = { access_token: token };
      if (params.status) payloadBase.status = params.status;

      for (let i = 0; i < params.ad_ids.length; i++) {
        const id = params.ad_ids[i];
        try {
          const res = await makeGraphApiPostCall(`${FB_GRAPH_URL}/${id}`, { ...payloadBase });
          results.push({ id, status: "success", data: res });
        } catch (e: any) {
          results.push({ id, status: "error", error: e?.response?.data || e.message });
        }
        if (i < params.ad_ids.length - 1) await sleep(BULK_DELAY_MS);
      }
      return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: handleApiError(err) }] };
    }
  });

  server.registerTool("meta_ads_pause_underperforming_ads", {
    description: `Pause specific ads that you have identified as underperforming. Maximum ${MAX_BULK_ITEMS} ads per call.`,
    inputSchema: z.object({
      ad_ids: z.array(z.string()).max(MAX_BULK_ITEMS).describe("List of ad IDs to pause"),
      reason: z.string().optional().describe("Why are they being paused (useful for auditing)")
    }),
    annotations: {
      destructiveHint: false,
      readOnlyHint: false,
    }
  }, async (params) => {
    try {
      const bulkError = validateBulkSize(params.ad_ids, MAX_BULK_ITEMS, "ads");
      if (bulkError) {
        return { content: [{ type: "text", text: `Validation Error: ${bulkError}` }] };
      }

      const token = getAccessToken();
      const results: any[] = [];
      const payloadBase: Record<string, any> = { access_token: token, status: "PAUSED" };

      for (let i = 0; i < params.ad_ids.length; i++) {
        const id = params.ad_ids[i];
        try {
          const res = await makeGraphApiPostCall(`${FB_GRAPH_URL}/${id}`, { ...payloadBase });
          results.push({ id, status: "paused success", reason: params.reason, data: res });
        } catch (e: any) {
          results.push({ id, status: "error", error: e?.response?.data || e.message });
        }
        if (i < params.ad_ids.length - 1) await sleep(BULK_DELAY_MS);
      }
      return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: handleApiError(err) }] };
    }
  });
}
