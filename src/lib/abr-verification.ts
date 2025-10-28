/**
 * ABR Verification Module
 * Uses public ABN Lookup API (data.business.gov.au)
 * NO GUID REQUIRED - Public endpoint
 */

export interface ABRResult {
  abn: string | null;
  acn: string | null;
  business_name: string | null;
  entity_status: string | null;
  entity_type: string | null;
  raw_response: any;
  lookup_successful: boolean;
  lookup_errors: string[];
}

/**
 * Query ABR public API for entity details
 * Endpoint: https://abr.business.gov.au/json/AbnDetails.aspx
 * 
 * CRITICAL: This provides the ground truth for trilogy verification
 */
export async function queryABR(abn: string): Promise<ABRResult> {
  try {
    // Clean ABN (remove spaces/hyphens)
    const cleanABN = abn.replace(/[\s\-]/g, '');
    
    if (cleanABN.length !== 11 || !/^\d+$/.test(cleanABN)) {
      return {
        abn: null,
        acn: null,
        business_name: null,
        entity_status: null,
        entity_type: null,
        raw_response: null,
        lookup_successful: false,
        lookup_errors: ['Invalid ABN format - must be 11 digits'],
      };
    }

    // Query public ABN API
    const url = `https://abr.business.gov.au/json/AbnDetails.aspx?abn=${cleanABN}&callback=callback`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      return {
        abn: null,
        acn: null,
        business_name: null,
        entity_status: null,
        entity_type: null,
        raw_response: null,
        lookup_successful: false,
        lookup_errors: [`ABR API returned status ${response.status}`],
      };
    }

    const text = await response.text();
    
    // Response is JSONP, need to extract JSON
    const jsonMatch = text.match(/callback\((.*)\)/);
    if (!jsonMatch) {
      return {
        abn: null,
        acn: null,
        business_name: null,
        entity_status: null,
        entity_type: null,
        raw_response: text,
        lookup_successful: false,
        lookup_errors: ['ABR API returned invalid JSONP format'],
      };
    }

    const data = JSON.parse(jsonMatch[1]);

    // Check if ABN was found
    if (data.Message) {
      return {
        abn: null,
        acn: null,
        business_name: null,
        entity_status: null,
        entity_type: null,
        raw_response: data,
        lookup_successful: false,
        lookup_errors: [data.Message],
      };
    }

    // Extract entity details
    const abrABN = data.Abn || null;
    const abrACN = data.Asic || null;
    
    // Get main business name (use MainName or first BusinessName)
    let businessName = null;
    if (data.EntityName) {
      businessName = data.EntityName;
    } else if (data.BusinessName && data.BusinessName.length > 0) {
      businessName = data.BusinessName[0];
    }

    // Get entity status
    const entityStatus = data.EntityStatus || data.AbnStatus || null;
    const entityType = data.EntityType || data.EntityTypeName || null;

    return {
      abn: abrABN,
      acn: abrACN,
      business_name: businessName ? businessName.trim() : null,
      entity_status: entityStatus,
      entity_type: entityType,
      raw_response: data,
      lookup_successful: true,
      lookup_errors: [],
    };
  } catch (error) {
    console.error('ABR lookup error:', error);
    return {
      abn: null,
      acn: null,
      business_name: null,
      entity_status: null,
      entity_type: null,
      raw_response: null,
      lookup_successful: false,
      lookup_errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

/**
 * Validate entity status is "Active"
 * CRITICAL: Non-active entities must be rejected
 */
export function isEntityActive(status: string | null): boolean {
  if (!status) return false;
  
  // Common active status values from ABR
  const activeStatuses = ['Active', 'ACTIVE', 'Current', 'CURRENT'];
  
  return activeStatuses.includes(status);
}
