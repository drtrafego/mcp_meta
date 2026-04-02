/**
 * CRM sync service for casaldotrafego.com
 * Handles lead creation and lookup via the CRM API.
 */

import axios from "axios";

const CRM_DEFAULTS = {
  baseUrl: "https://crm.casaldotrafego.com",
  syncToken: "b1ld3r-crm-s3cr3t-k3y-gener4t3d-f0r-d3v-m0d3-123456",
};

function getCrmBaseUrl(): string {
  const url = process.env.CRM_BASE_URL || CRM_DEFAULTS.baseUrl;
  return url.replace(/\/$/, "");
}

function getCrmSyncToken(): string {
  const token = process.env.CRM_SYNC_TOKEN || CRM_DEFAULTS.syncToken;
  return token;
}

export interface SyncLeadInput {
  orgSlug: string;
  name: string;
  whatsapp: string;
  source: "WhatsApp" | "Direct";
  message?: string;
  utmCampaign?: string;
}

export interface SyncLeadResult {
  status: "created" | "exists";
  leadId?: string;
}

export interface CheckLeadResult {
  exists: boolean;
  leadId?: string;
}

/**
 * Create or deduplicate a lead in the CRM.
 * Returns 201 for new leads, 200 for existing ones.
 */
export async function syncLead(input: SyncLeadInput): Promise<SyncLeadResult> {
  const url = `${getCrmBaseUrl()}/api/sync/leads`;
  const token = getCrmSyncToken();

  const body: Record<string, string> = {
    orgSlug: input.orgSlug,
    name: input.name,
    whatsapp: input.whatsapp,
    source: input.source,
  };
  if (input.message) body.message = input.message;
  if (input.utmCampaign) body.utmCampaign = input.utmCampaign;

  const response = await axios.post(url, body, {
    headers: {
      "Content-Type": "application/json",
      "x-sync-token": token,
    },
    timeout: 15000,
    validateStatus: (s) => s === 200 || s === 201,
  });

  return {
    status: response.status === 201 ? "created" : "exists",
    leadId: response.data?.leadId ?? response.data?.id,
  };
}

/**
 * Check if a lead already exists in the CRM.
 */
export async function checkLead(
  orgSlug: string,
  phoneOrIdentifier: string
): Promise<CheckLeadResult> {
  const url = `${getCrmBaseUrl()}/api/sync/leads`;
  const token = getCrmSyncToken();

  const response = await axios.get(url, {
    params: { orgSlug, whatsapp: phoneOrIdentifier },
    headers: { "x-sync-token": token },
    timeout: 15000,
  });

  return {
    exists: response.data?.exists ?? false,
    leadId: response.data?.leadId,
  };
}

export function handleCrmError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const msg = error.response?.data?.error ?? error.response?.data?.message ?? error.message;
    return `CRM Error (${status ?? "network"}): ${msg}`;
  }
  return `CRM Error: ${error instanceof Error ? error.message : String(error)}`;
}
