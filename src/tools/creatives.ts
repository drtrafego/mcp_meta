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
import { FieldsSchema, FilteringSchema, PaginationSchema, DateFormatSchema, EffectiveStatusSchema } from "../schemas/common.js";

const CREATIVE_FIELDS_DESC =
  "Fields to retrieve. Available: id, name, account_id, actor_id, adlabels, asset_feed_spec, authorization_category, body, call_to_action_type, effective_authorization_category, effective_instagram_media_id, effective_object_story_id, image_hash, image_url, instagram_permalink_url, instagram_story_id, instagram_user_id, link_url, object_id, object_story_id, object_story_spec, object_type, object_url, platform_customizations, product_set_id, status, template_url, thumbnail_url, title, url_tags, use_page_actor_override, video_id";

export function registerCreativeTools(server: McpServer): void {
  server.registerTool(
    "meta_ads_get_adcreatives_by_adaccount",
    {
      title: "Get Meta Ad Creatives by Ad Account",
      description: `Retrieve all ad creatives belonging to a specific Meta ad account.

Useful for auditing all creative assets, finding creatives by status, or reviewing creative content across the account.

Args:
  - account_id (string): Ad account ID, e.g. 'act_663136558021878'
  - fields (string[]): ${CREATIVE_FIELDS_DESC}
  - effective_status (string[]): Filter by status: ACTIVE, DELETED, IN_PROCESS, WITH_ISSUES
  - filtering (object[]): Additional filter objects with field, operator, value
  - limit (number): Results per page (1-100, default: 25)
  - after / before (string): Pagination cursors

Returns:
  Object with data (creative array) and paging. Use meta_ads_fetch_pagination_url with paging.next for more results.

Examples:
  - Use when: "List all active creatives in my ad account"
  - Use when: "Show all creatives with issues in act_123456"`,
      inputSchema: z
        .object({
          account_id: z
            .string()
            .describe("Ad account ID, e.g. 'act_663136558021878'"),
          fields: FieldsSchema.describe(CREATIVE_FIELDS_DESC),
          effective_status: z
            .array(z.enum(["ACTIVE", "DELETED", "IN_PROCESS", "WITH_ISSUES"]))
            .optional()
            .describe("Filter by creative status: ACTIVE, DELETED, IN_PROCESS, WITH_ISSUES"),
          filtering: FilteringSchema,
        })
        .merge(PaginationSchema),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ account_id, fields, effective_status, filtering, limit, after, before }) => {
      try {
        const token = getAccessToken();
        const url = `${FB_GRAPH_URL}/${account_id}/adcreatives`;
        const params = prepareParams(
          { access_token: token },
          { fields, effective_status, filtering, limit, after, before }
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
    "meta_ads_get_ad_creative_by_id",
    {
      title: "Get Meta Ad Creative by ID",
      description: `Retrieve detailed information about a specific Meta ad creative.

Args:
  - creative_id (string): Ad creative ID, e.g., '23842312323312'
  - fields (string[]): ${CREATIVE_FIELDS_DESC}
  - thumbnail_width (number): Width of the thumbnail image in pixels (default: 64)
  - thumbnail_height (number): Height of the thumbnail image in pixels (default: 64)

Returns:
  Object with the requested creative fields.

Examples:
  - Use when: "Get the body text, title, and image URL for creative 23842312323312"
  - Use when: "What is the call-to-action type and status of this creative?"
  - Use when: "Get a larger thumbnail (300x200) for this creative"`,
      inputSchema: z.object({
        creative_id: z.string().describe("Ad creative ID, e.g., '23842312323312'"),
        fields: FieldsSchema.describe(CREATIVE_FIELDS_DESC),
        thumbnail_width: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Width of the thumbnail image in pixels (default: 64)"),
        thumbnail_height: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Height of the thumbnail image in pixels (default: 64)"),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ creative_id, fields, thumbnail_width, thumbnail_height }) => {
      try {
        const token = getAccessToken();
        const url = `${FB_GRAPH_URL}/${creative_id}`;
        const params = prepareParams(
          { access_token: token },
          {
            fields,
            ...(thumbnail_width !== undefined ? { thumbnail_width } : {}),
            ...(thumbnail_height !== undefined ? { thumbnail_height } : {}),
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
    "meta_ads_get_ad_creatives_by_ad_id",
    {
      title: "Get Meta Ad Creatives by Ad ID",
      description: `Retrieve the ad creatives associated with a specific Meta ad.

Args:
  - ad_id (string): Ad ID to retrieve creatives for, e.g., '23843211234567'
  - fields (string[]): ${CREATIVE_FIELDS_DESC}
  - limit (number): Maximum creatives per page (default: 25)
  - after / before (string): Pagination cursors from response.paging.cursors
  - date_format (string): Date format: 'U' for Unix timestamp, 'Y-m-d H:i:s' for MySQL datetime

Returns:
  Object with data (creative array) and paging. Use meta_ads_fetch_pagination_url with paging.next for more results.

Examples:
  - Use when: "What creatives are used by ad 23843211234567?"
  - Use when: "Get the image URLs and titles for all creatives on this ad"`,
      inputSchema: z
        .object({
          ad_id: z
            .string()
            .describe("Ad ID to retrieve creatives for, e.g., '23843211234567'"),
          fields: FieldsSchema.describe(CREATIVE_FIELDS_DESC),
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
    async ({ ad_id, fields, date_format, limit, after, before }) => {
      try {
        const token = getAccessToken();
        const url = `${FB_GRAPH_URL}/${ad_id}/adcreatives`;
        const params = prepareParams(
          { access_token: token },
          { fields, date_format, limit, after, before }
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

  server.registerTool("meta_ads_create_ad_creative", {
    description: "Create a single image or video ad creative.",
    inputSchema: z.object({
      account_id: z.string().describe("Ad account ID, e.g. 'act_663136558021878'"),
      page_id: z.string().describe("Facebook Page ID, e.g. '109902140539351'"),
      name: z.string(),
      title: z.string().optional().describe("Headline"),
      body: z.string().optional().describe("Primary text"),
      description: z.string().optional().describe("Description for link_data"),
      image_hash: z.string().optional(),
      video_id: z.string().optional(),
      thumbnail_url: z.string().optional(),
      call_to_action_type: z.enum(["LEARN_MORE", "SHOP_NOW", "SIGN_UP", "SUBSCRIBE", "CONTACT_US", "SEND_MESSAGE", "APPLY_NOW", "BOOK_TRAVEL", "WHATSAPP_MESSAGE", "WHATSAPP_LINK", "CHAT_ON_WHATSAPP"]).default("LEARN_MORE"),
      link_url: z.string().optional(),
      thumbnail_hash: z.string().optional().describe("image_hash to use as thumbnail for video creatives")
    }),
    annotations: {
      destructiveHint: false,
      readOnlyHint: false,
    }
  }, async (params) => {
    try {
      const actId = params.account_id;
      const pageId = params.page_id;

      const token = getAccessToken();
      const payload: Record<string, any> = {
        access_token: token,
        name: params.name,
      };

      const ctaType = params.call_to_action_type || 'LEARN_MORE';
      const isWhatsApp = ctaType === 'WHATSAPP_MESSAGE' || ctaType === 'WHATSAPP_LINK' || ctaType === 'CHAT_ON_WHATSAPP';
      const ctaValue: Record<string, any> = { link: params.link_url };
      if (isWhatsApp) ctaValue.app_destination = 'WHATSAPP';

      if (params.video_id) {
        const videoData: Record<string, any> = {
          video_id: params.video_id,
          message: params.body,
          title: params.title,
          call_to_action: { type: ctaType, value: ctaValue }
        };
        if (params.thumbnail_url) videoData.image_url = params.thumbnail_url;
        if (params.thumbnail_hash) videoData.image_hash = params.thumbnail_hash;
        payload.object_story_spec = { page_id: pageId, video_data: videoData };
      } else if (params.image_hash) {
        payload.object_story_spec = {
          page_id: pageId,
          link_data: {
            image_hash: params.image_hash,
            message: params.body,
            name: params.title,
            description: params.description,
            link: params.link_url,
            call_to_action: { type: ctaType, value: ctaValue }
          }
        };
      } else {
        throw new Error("You must provide either image_hash or video_id.");
      }

      const data = await makeGraphApiPostCall(`${FB_GRAPH_URL}/${actId}/adcreatives`, payload);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: handleApiError(err) }] };
    }
  });

  server.registerTool("meta_ads_create_carousel_ad_creative", {
    description: "Create a carousel ad creative. NEVER pass instagram_actor_id in carousels.",
    inputSchema: z.object({
      account_id: z.string().describe("Ad account ID, e.g. 'act_663136558021878'"),
      page_id: z.string().describe("Facebook Page ID, e.g. '109902140539351'"),
      name: z.string(),
      body: z.string().optional().describe("Primary text appearing above carousel"),
      link_url: z.string().describe("Fallback link URL for the carousel"),
      cards: z.array(z.object({
        name: z.string().optional().describe("Headline for the card"),
        description: z.string().optional(),
        image_hash: z.string().optional(),
        video_id: z.string().optional(),
        link: z.string().optional(),
        call_to_action_type: z.string().default("LEARN_MORE")
      }))
    }),
    annotations: {
      destructiveHint: false,
      readOnlyHint: false,
    }
  }, async (params) => {
    try {
      const actId = params.account_id;
      const pageId = params.page_id;
      // CRITICAL RULE: Never pass instagram_actor_id in carousel!
      
      const token = getAccessToken();
      const payload: Record<string, any> = {
        access_token: token,
        name: params.name,
      };

      const childAttachments = params.cards.map((card) => {
        const att: any = {
          name: card.name,
          description: card.description,
          link: card.link || params.link_url,
          call_to_action: {
            type: card.call_to_action_type,
            value: { link: card.link || params.link_url }
          }
        };
        if (card.image_hash) att.image_hash = card.image_hash;
        if (card.video_id) att.video_id = card.video_id;
        return att;
      });

      const objectStorySpec: any = {
        page_id: pageId,
        link_data: {
          child_attachments: childAttachments,
          message: params.body,
          link: params.link_url,
          caption: params.link_url
        }
      };

      payload.object_story_spec = JSON.stringify(objectStorySpec);

      const data = await makeGraphApiPostCall(`${FB_GRAPH_URL}/${actId}/adcreatives`, payload);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: handleApiError(err) }] };
    }
  });

  server.registerTool("meta_ads_bulk_get_ad_creatives", {
    description: "Fetch multiple creatives by their IDs.",
    inputSchema: z.object({
      creative_ids: z.array(z.string()),
      fields: FieldsSchema.describe(CREATIVE_FIELDS_DESC)
    })
  }, async (params) => {
    try {
      const token = getAccessToken();
      const url = `${FB_GRAPH_URL}/`;
      const queryParams = prepareParams(
        { access_token: token, ids: params.creative_ids.join(",") },
        { fields: params.fields }
      );
      const data = await makeGraphApiCall(url, queryParams);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: handleApiError(err) }] };
    }
  });

  server.registerTool("meta_ads_update_ad_creative", {
    description: "Update an ad creative (usually limited to name). Note: Usually you can't edit images/videos in existing creatives, you must recreate them.",
    inputSchema: z.object({
      creative_id: z.string(),
      name: z.string()
    })
  }, async (params) => {
    try {
      const token = getAccessToken();
      const payload: Record<string, any> = { access_token: token, name: params.name };
      const data = await makeGraphApiPostCall(`${FB_GRAPH_URL}/${params.creative_id}`, payload);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: handleApiError(err) }] };
    }
  });
}
