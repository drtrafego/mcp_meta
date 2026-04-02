/**
 * CRM sync tools: WhatsApp leads, Instagram conversations, and lead lookup.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import axios from "axios";
import { syncLead, checkLead, handleCrmError } from "../services/crm.js";
import { getAccessToken } from "../services/graph-api.js";

const IG_GRAPH_URL = "https://graph.instagram.com/v22.0";

export function registerCrmTools(server: McpServer): void {
  // ── Tool 1: crm_sync_whatsapp_lead ──────────────────────────────
  server.registerTool(
    "crm_sync_whatsapp_lead",
    {
      title: "Sync WhatsApp Lead to CRM",
      description: `Envia um lead do WhatsApp para o CRM. Deve ser chamada na PRIMEIRA mensagem de um contato novo.

Args:
  - org_slug (string): slug da org no CRM (ex: agente24horas, admin)
  - name (string): nome do contato
  - phone (string): telefone com DDI (ex: 5511999999999)
  - message (string, opcional): texto da primeira mensagem
  - campaign (string, opcional): nome da campanha se veio de anuncio

Returns:
  status "created" (lead novo) ou "exists" (ja existia, dedup).`,
      inputSchema: z.object({
        org_slug: z.string().describe("Slug da org no CRM (ex: agente24horas, admin)"),
        name: z.string().describe("Nome do contato"),
        phone: z.string().describe("Telefone com DDI (ex: 5511999999999)"),
        message: z.string().optional().describe("Texto da primeira mensagem"),
        campaign: z.string().optional().describe("Nome da campanha se veio de anuncio"),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ org_slug, name, phone, message, campaign }) => {
      try {
        const result = await syncLead({
          orgSlug: org_slug,
          name,
          whatsapp: phone,
          source: "WhatsApp",
          message,
          utmCampaign: campaign,
        });
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleCrmError(error) }] };
      }
    }
  );

  // ── Tool 2: crm_sync_instagram_conversations ────────────────────
  server.registerTool(
    "crm_sync_instagram_conversations",
    {
      title: "Sync Instagram Conversations to CRM",
      description: `Puxa conversas recentes do Instagram Direct e cria leads no CRM para contatos novos.

Args:
  - org_slug (string): slug da org no CRM
  - ig_user_id (string): ID do Instagram Business (ou "me")

Returns:
  Lista de leads processados com status (created/exists/error) para cada conversa.`,
      inputSchema: z.object({
        org_slug: z.string().describe("Slug da org no CRM (ex: agente24horas, admin)"),
        ig_user_id: z.string().default("me").describe('ID do Instagram Business (ou "me")'),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ org_slug, ig_user_id }) => {
      try {
        const token = getAccessToken();
        const results: Array<{ username: string; status: string; error?: string }> = [];

        // Passo 1: listar conversas
        const convRes = await axios.get(
          `${IG_GRAPH_URL}/${ig_user_id}/conversations`,
          {
            params: { platform: "instagram", access_token: token },
            timeout: 15000,
          }
        );

        const conversations: Array<{ id: string }> = convRes.data?.data ?? [];
        if (conversations.length === 0) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ message: "Nenhuma conversa encontrada", synced: 0 }, null, 2) }],
          };
        }

        for (const conv of conversations) {
          try {
            // Passo 2: pegar ultima mensagem da conversa
            const msgListRes = await axios.get(
              `${IG_GRAPH_URL}/${conv.id}`,
              {
                params: { fields: "messages", access_token: token },
                timeout: 15000,
              }
            );

            const messages: Array<{ id: string }> = msgListRes.data?.messages?.data ?? [];
            if (messages.length === 0) continue;

            const firstMsgId = messages[0].id;
            const msgRes = await axios.get(
              `${IG_GRAPH_URL}/${firstMsgId}`,
              {
                params: { fields: "id,created_time,from,to,message", access_token: token },
                timeout: 15000,
              }
            );

            const msg = msgRes.data;
            const from = msg.from;
            if (!from) continue;

            const username = from.username ? `@${from.username}` : from.name ?? "Desconhecido";

            // Passo 3: criar lead no CRM
            const result = await syncLead({
              orgSlug: org_slug,
              name: username,
              whatsapp: username,
              source: "Direct",
              message: msg.message,
            });

            results.push({ username, status: result.status });
          } catch (convError) {
            results.push({
              username: conv.id,
              status: "error",
              error: convError instanceof Error ? convError.message : String(convError),
            });
          }
        }

        const summary = {
          total: conversations.length,
          created: results.filter((r) => r.status === "created").length,
          exists: results.filter((r) => r.status === "exists").length,
          errors: results.filter((r) => r.status === "error").length,
          details: results,
        };

        return {
          content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }],
        };
      } catch (error) {
        const msg = axios.isAxiosError(error)
          ? `Instagram API Error (${error.response?.status}): ${error.response?.data?.error?.message ?? error.message}`
          : handleCrmError(error);
        return { content: [{ type: "text" as const, text: msg }] };
      }
    }
  );

  // ── Tool 3: crm_check_lead ──────────────────────────────────────
  server.registerTool(
    "crm_check_lead",
    {
      title: "Check Lead in CRM",
      description: `Verifica se um lead ja existe no CRM antes de criar.

Args:
  - org_slug (string): slug da org no CRM
  - phone_or_identifier (string): telefone ou @username

Returns:
  { exists: true/false, leadId: "uuid" }`,
      inputSchema: z.object({
        org_slug: z.string().describe("Slug da org no CRM"),
        phone_or_identifier: z.string().describe("Telefone com DDI ou @username do Instagram"),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ org_slug, phone_or_identifier }) => {
      try {
        const result = await checkLead(org_slug, phone_or_identifier);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleCrmError(error) }] };
      }
    }
  );
}
