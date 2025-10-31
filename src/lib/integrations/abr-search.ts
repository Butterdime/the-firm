/**
 * ABR Search Integration
 * Searches Australian Business Register by name and postcode
 * Uses ABR XML Search API (requires GUID registration)
 */

import pool from '../../config/database';

export interface ABREntity {
  abn: string;
  acn: string | null;
  business_name: string;
  entity_status: string;
  entity_type: string;
}

interface ABRSearchResult {
  entities: ABREntity[];
  from_cache: boolean;
  search_count: number;
}

/**
 * Search ABR by business name and postcode
 * Uses cached results if available (24-hour cache)
 */
export async function searchByNameAndPostcode(
  name: string,
  postcode: string
): Promise<ABREntity[]> {
  // Check cache first
  const cached = await pool.query(`
    SELECT entities_data, entities_found
    FROM abr_search_cache
    WHERE search_name = $1
      AND search_postcode = $2
      AND cache_expires_at > NOW()
    LIMIT 1
  `, [name.trim(), postcode.trim()]);

  if (cached.rows.length > 0) {
    console.log('ABR search cache hit for:', name, postcode);
    return cached.rows[0].entities_data;
  }

  // Check if ABR search is enabled
  if (process.env.ENABLE_ABR_SEARCH === 'false') {
    console.log('ABR search disabled via feature flag');
    return [];
  }

  // Call ABR API
  const entities = await callABRSearchAPI(name, postcode);

  // Cache results for 24 hours
  await pool.query(`
    INSERT INTO abr_search_cache (search_name, search_postcode, entities_found, entities_data)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (search_name, search_postcode)
    DO UPDATE SET
      entities_found = $3,
      entities_data = $4,
      searched_at = NOW(),
      cache_expires_at = NOW() + INTERVAL '24 hours'
  `, [name.trim(), postcode.trim(), entities.length, JSON.stringify(entities)]);

  return entities;
}

/**
 * Call ABR XML Search API
 * Documentation: https://abr.business.gov.au/abrxmlsearch/
 */
async function callABRSearchAPI(
  name: string,
  postcode: string
): Promise<ABREntity[]> {
  const abrApiKey = process.env.ABR_API_KEY;
  const abrApiUrl = process.env.ABR_API_URL || 'https://abr.business.gov.au/abrxmlsearch/ABRXMLSearch.asmx';

  if (!abrApiKey) {
    console.warn('ABR_API_KEY not configured. Skipping ABR search.');
    return [];
  }

  try {
    // ABR XML Search API - Search by name and postcode
    // Note: ABR XML Search API requires specific SOAP format
    // This is a simplified implementation - may need adjustment based on actual API response format

    const searchUrl = `${abrApiUrl}/SearchByNameAdvancedSimpleProtocol2017?name=${encodeURIComponent(name)}&postcode=${encodeURIComponent(postcode)}&guid=${abrApiKey}`;

    const response = await fetch(searchUrl, {
      headers: {
        'Accept': 'application/xml',
      },
    });

    if (response.ok) {
      const xmlText = await response.text();
      const entities = parseABRXMLResponse(xmlText);
      return entities;
    } else {
      console.error('ABR API error:', response.status, response.statusText);
      return [];
    }
  } catch (error) {
    console.error('ABR search API call failed:', error);
    return [];
  }
}

/**
 * Parse ABR XML response
 * ABR returns XML format - needs to be parsed to extract entity details
 */
function parseABRXMLResponse(xmlText: string): ABREntity[] {
  // Basic XML parsing (in production, use a proper XML parser like 'xml2js')
  // This is a simplified version - adjust based on actual ABR response format
  
  const entities: ABREntity[] = [];
  
  // Try to extract ABN, ACN, name, status from XML
  // ABR XML format varies - this needs to match actual response structure
  // Example structure:
  // <response>
  //   <entity>
  //     <ABN>12345678901</ABN>
  //     <ACN>123456789</ACN>
  //     <name>Business Name</name>
  //     <status>Active</status>
  //   </entity>
  // </response>
  
  // For now, return empty array - this needs to be implemented based on actual ABR response
  // TODO: Implement proper XML parsing once ABR API response format is confirmed
  
  console.warn('ABR XML parsing not fully implemented - needs actual response format');
  
  return entities;
}

/**
 * Get cached search results count
 */
export async function getCacheStats(): Promise<{
  total_cached: number;
  expired_count: number;
}> {
  const stats = await pool.query(`
    SELECT 
      COUNT(*) as total_cached,
      COUNT(*) FILTER (WHERE cache_expires_at <= NOW()) as expired_count
    FROM abr_search_cache
  `);

  return {
    total_cached: parseInt(stats.rows[0].total_cached),
    expired_count: parseInt(stats.rows[0].expired_count),
  };
}

