/**
 * Shared validation functions for Meta Ads API compliance.
 * Prevents API rejections, account bans, and policy violations.
 */

// ============================================================
// ENUMS — All valid values from Meta API documentation
// ============================================================

export const VALID_OBJECTIVES = [
  "OUTCOME_AWARENESS",
  "OUTCOME_TRAFFIC",
  "OUTCOME_ENGAGEMENT",
  "OUTCOME_LEADS",
  "OUTCOME_SALES",
  "OUTCOME_APP_PROMOTION",
] as const;

export const VALID_SPECIAL_AD_CATEGORIES = [
  "NONE",
  "EMPLOYMENT",
  "HOUSING",
  "FINANCIAL_PRODUCTS_SERVICES",
  "ISSUES_ELECTIONS_POLITICS",
  "ONLINE_GAMBLING_AND_GAMING",
] as const;

export const VALID_BID_STRATEGIES = [
  "LOWEST_COST_WITHOUT_CAP",
  "LOWEST_COST_WITH_BID_CAP",
  "COST_CAP",
  "LOWEST_COST_WITH_MIN_ROAS",
] as const;

export const VALID_OPTIMIZATION_GOALS = [
  "APP_INSTALLS",
  "AD_RECALL_LIFT",
  "ENGAGED_USERS",
  "EVENT_RESPONSES",
  "IMPRESSIONS",
  "LEAD_GENERATION",
  "QUALITY_LEAD",
  "LINK_CLICKS",
  "OFFSITE_CONVERSIONS",
  "PAGE_LIKES",
  "POST_ENGAGEMENT",
  "QUALITY_CALL",
  "REACH",
  "LANDING_PAGE_VIEWS",
  "VISIT_INSTAGRAM_PROFILE",
  "VALUE",
  "THRUPLAY",
  "CONVERSATIONS",
  "IN_APP_VALUE",
  "MESSAGING_PURCHASE_CONVERSION",
  "SUBSCRIBERS",
  "REMINDERS_SET",
  "MEANINGFUL_CALL_ATTEMPT",
  "PROFILE_VISIT",
] as const;

export const VALID_BILLING_EVENTS = [
  "APP_INSTALLS",
  "IMPRESSIONS",
  "LINK_CLICKS",
  "NONE",
  "OFFER_CLAIMS",
  "PAGE_LIKES",
  "POST_ENGAGEMENT",
  "THRUPLAY",
  "PURCHASE",
  "LISTING_INTERACTION",
] as const;

export const VALID_CTA_TYPES = [
  "LEARN_MORE",
  "SHOP_NOW",
  "SIGN_UP",
  "SUBSCRIBE",
  "CONTACT_US",
  "SEND_MESSAGE",
  "APPLY_NOW",
  "BOOK_TRAVEL",
  "BOOK_NOW",
  "DOWNLOAD",
  "GET_OFFER",
  "GET_QUOTE",
  "INSTALL_APP",
  "LIKE_PAGE",
  "OPEN_LINK",
  "BUY_NOW",
  "WATCH_MORE",
  "CALL_NOW",
  "DONATE",
  "MESSAGE_PAGE",
  "WHATSAPP_MESSAGE",
  "WHATSAPP_LINK",
  "CHAT_ON_WHATSAPP",
] as const;

// Special ad categories that restrict targeting
const RESTRICTED_SAC = new Set([
  "EMPLOYMENT",
  "HOUSING",
  "FINANCIAL_PRODUCTS_SERVICES",
]);

// Geo types prohibited under restricted special ad categories
const PROHIBITED_GEO_TYPES = new Set([
  "subcity",
  "neighborhood",
  "metro_area",
  "small_geo_area",
  "subneighborhood",
  "electoral_district",
  "zips",
  "zip",
]);

// ============================================================
// BUDGET VALIDATION
// ============================================================

/** Maximum daily budget in standard currency (safety cap: $50,000/day) */
const MAX_DAILY_BUDGET = 50000;

/** Maximum lifetime budget in standard currency (safety cap: $500,000) */
const MAX_LIFETIME_BUDGET = 500000;

/** Minimum daily budget in standard currency */
const MIN_DAILY_BUDGET = 1;

export interface BudgetValidationResult {
  valid: boolean;
  error?: string;
}

export function validateBudget(
  dailyBudget?: number,
  lifetimeBudget?: number,
  endTime?: string
): BudgetValidationResult {
  if (dailyBudget !== undefined && lifetimeBudget !== undefined) {
    return {
      valid: false,
      error:
        "Cannot set both daily_budget and lifetime_budget. Choose one.",
    };
  }

  if (dailyBudget !== undefined) {
    if (dailyBudget < MIN_DAILY_BUDGET) {
      return {
        valid: false,
        error: `daily_budget must be at least ${MIN_DAILY_BUDGET} (currency unit). Got: ${dailyBudget}`,
      };
    }
    if (dailyBudget > MAX_DAILY_BUDGET) {
      return {
        valid: false,
        error: `daily_budget of ${dailyBudget} exceeds safety limit of ${MAX_DAILY_BUDGET}. If intentional, contact support.`,
      };
    }
  }

  if (lifetimeBudget !== undefined) {
    if (lifetimeBudget < MIN_DAILY_BUDGET) {
      return {
        valid: false,
        error: `lifetime_budget must be at least ${MIN_DAILY_BUDGET} (currency unit). Got: ${lifetimeBudget}`,
      };
    }
    if (lifetimeBudget > MAX_LIFETIME_BUDGET) {
      return {
        valid: false,
        error: `lifetime_budget of ${lifetimeBudget} exceeds safety limit of ${MAX_LIFETIME_BUDGET}. If intentional, contact support.`,
      };
    }
    if (!endTime) {
      return {
        valid: false,
        error:
          "end_time is required when using lifetime_budget. Meta API will reject the request without it.",
      };
    }
  }

  return { valid: true };
}

// ============================================================
// SPECIAL AD CATEGORY TARGETING VALIDATION
// ============================================================

export interface TargetingValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate targeting object against special ad category restrictions.
 * Housing, Employment, and Financial Products/Services have strict rules.
 */
export function validateTargetingForSAC(
  targeting: Record<string, any>,
  specialAdCategories: string[]
): TargetingValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const hasRestriction = specialAdCategories.some((c) =>
    RESTRICTED_SAC.has(c)
  );

  if (!hasRestriction) {
    return { valid: true, errors, warnings };
  }

  const sacLabel = specialAdCategories.filter((c) => RESTRICTED_SAC.has(c)).join(", ");

  // Age must be 18-65+
  if (targeting.age_min !== undefined && targeting.age_min < 18) {
    errors.push(
      `Special Ad Category (${sacLabel}): age_min must be 18 or higher. Got: ${targeting.age_min}`
    );
  }
  if (targeting.age_max !== undefined && targeting.age_max !== 65) {
    warnings.push(
      `Special Ad Category (${sacLabel}): age_max should be 65 (65+). Got: ${targeting.age_max}`
    );
  }

  // Gender cannot be specified
  if (targeting.genders && targeting.genders.length > 0) {
    errors.push(
      `Special Ad Category (${sacLabel}): gender targeting is prohibited. Remove 'genders' from targeting.`
    );
  }

  // No detailed targeting exclusions
  if (targeting.exclusions) {
    errors.push(
      `Special Ad Category (${sacLabel}): detailed targeting exclusions are prohibited. Remove 'exclusions'.`
    );
  }

  // No interest exclusions within flexible_spec
  if (targeting.excluded_flexible_spec) {
    errors.push(
      `Special Ad Category (${sacLabel}): interest exclusions (excluded_flexible_spec) are prohibited.`
    );
  }

  // Check geo_locations for prohibited types
  const geoLocations = targeting.geo_locations;
  if (geoLocations) {
    for (const geoType of Object.keys(geoLocations)) {
      if (PROHIBITED_GEO_TYPES.has(geoType)) {
        errors.push(
          `Special Ad Category (${sacLabel}): location type '${geoType}' is prohibited. Use broader location types (country, region, city).`
        );
      }
    }

    // Check location exclusions
    if (targeting.excluded_geo_locations) {
      errors.push(
        `Special Ad Category (${sacLabel}): location exclusions are prohibited.`
      );
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ============================================================
// BULK OPERATION VALIDATION
// ============================================================

export function validateBulkSize(
  ids: string[],
  maxSize: number = 50,
  entityName: string = "items"
): string | null {
  if (ids.length === 0) {
    return `At least one ${entityName} ID is required.`;
  }
  if (ids.length > maxSize) {
    return `Too many ${entityName} (${ids.length}). Maximum is ${maxSize} per bulk operation to avoid rate limiting.`;
  }
  return null;
}

// ============================================================
// CREATIVE VALIDATION
// ============================================================

export function validateImageHash(hash: string): boolean {
  return /^[a-f0-9]{32}$/i.test(hash);
}

export function validateUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function validateCarouselCards(
  cards: any[]
): { valid: boolean; error?: string } {
  if (cards.length < 2) {
    return {
      valid: false,
      error: "Carousel requires at least 2 cards. Got: " + cards.length,
    };
  }
  if (cards.length > 10) {
    return {
      valid: false,
      error: "Carousel allows maximum 10 cards. Got: " + cards.length,
    };
  }
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    if (!card.image_hash && !card.video_id) {
      return {
        valid: false,
        error: `Card ${i + 1} must have either image_hash or video_id.`,
      };
    }
    if (card.image_hash && !validateImageHash(card.image_hash)) {
      return {
        valid: false,
        error: `Card ${i + 1} has invalid image_hash format. Must be 32 hex characters.`,
      };
    }
  }
  return { valid: true };
}

// ============================================================
// ENUM VALIDATION HELPER
// ============================================================

export function validateEnum(
  value: string,
  validValues: readonly string[],
  fieldName: string
): string | null {
  if (!validValues.includes(value)) {
    return `Invalid ${fieldName}: '${value}'. Valid values: ${validValues.join(", ")}`;
  }
  return null;
}

// ============================================================
// ADSET NAME VALIDATION
// ============================================================

export function validateAdSetName(name: string): string | null {
  if (name.length > 400) {
    return `Ad set name exceeds 400 character limit (${name.length} chars).`;
  }
  return null;
}

// ============================================================
// CREATIVE NAME VALIDATION
// ============================================================

export function validateCreativeName(name: string): string | null {
  if (name.length > 100) {
    return `Creative name exceeds 100 character limit (${name.length} chars).`;
  }
  return null;
}

// ============================================================
// DEPRECATED VALUE CHECKS
// ============================================================

/**
 * Check for deprecated values and return warnings/errors.
 */
export function checkDeprecatedValues(params: Record<string, any>): string[] {
  const warnings: string[] = [];

  // CREDIT is deprecated since Jan 14, 2025 — use FINANCIAL_PRODUCTS_SERVICES
  if (params.special_ad_categories) {
    const cats = Array.isArray(params.special_ad_categories)
      ? params.special_ad_categories
      : [params.special_ad_categories];
    if (cats.includes("CREDIT")) {
      warnings.push(
        "DEPRECATED: 'CREDIT' special ad category was replaced by 'FINANCIAL_PRODUCTS_SERVICES' on Jan 14, 2025. The API will reject 'CREDIT'."
      );
    }
  }

  // date_preset=lifetime is deprecated — use 'maximum'
  if (params.date_preset === "lifetime") {
    warnings.push(
      "DEPRECATED: date_preset 'lifetime' is deprecated. Use 'maximum' instead (covers up to 37 months)."
    );
  }

  return warnings;
}
