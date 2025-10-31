/**
 * Entity Linking Service
 * Manages relationships between individuals and business entities
 */

import pool from '../config/database';

export interface EntityLinkResult {
  link_id: string;
  individual_id: string;
  verification_id: string;
  is_primary: boolean;
  entity_type: string;
}

/**
 * Set primary entity for an individual
 * Only one primary entity allowed per individual
 */
export async function setPrimaryEntity(
  individualId: string,
  verificationId: string
): Promise<EntityLinkResult> {
  // First, unset any existing primary entity
  await pool.query(`
    UPDATE individual_entity_links
    SET is_primary_entity = FALSE
    WHERE individual_id = $1
  `, [individualId]);

  // Set new primary entity
  const result = await pool.query(`
    UPDATE individual_entity_links
    SET is_primary_entity = TRUE,
        entity_type = 'bank_matched',
        updated_at = NOW()
    WHERE individual_id = $1 AND verification_id = $2
    RETURNING id, individual_id, verification_id, is_primary_entity, entity_type
  `, [individualId, verificationId]);

  if (result.rows.length === 0) {
    throw new Error('Entity link not found. Ensure the verification is linked to this individual.');
  }

  return {
    link_id: result.rows[0].id,
    individual_id: result.rows[0].individual_id,
    verification_id: result.rows[0].verification_id,
    is_primary: result.rows[0].is_primary_entity,
    entity_type: result.rows[0].entity_type,
  };
}

/**
 * Link discovered entities to individual
 */
export async function linkDiscoveredEntities(
  individualId: string,
  verificationIds: string[]
): Promise<EntityLinkResult[]> {
  const results: EntityLinkResult[] = [];

  for (const verificationId of verificationIds) {
    // Check if link already exists
    const existing = await pool.query(`
      SELECT id FROM individual_entity_links
      WHERE individual_id = $1 AND verification_id = $2
    `, [individualId, verificationId]);

    if (existing.rows.length === 0) {
      const result = await pool.query(`
        INSERT INTO individual_entity_links (
          individual_id, verification_id, is_primary_entity,
          entity_type, link_source, match_confidence
        ) VALUES ($1, $2, FALSE, 'discovered_abr', 'abr_search', 0.90)
        RETURNING id, individual_id, verification_id, is_primary_entity, entity_type
      `, [individualId, verificationId]);

      results.push({
        link_id: result.rows[0].id,
        individual_id: result.rows[0].individual_id,
        verification_id: result.rows[0].verification_id,
        is_primary: result.rows[0].is_primary_entity,
        entity_type: result.rows[0].entity_type,
      });
    }
  }

  return results;
}

/**
 * Get all entities linked to an individual
 */
export async function getLinkedEntities(individualId: string): Promise<Array<{
  verification_id: string;
  abn: string;
  business_name: string;
  is_primary: boolean;
  entity_type: string;
}>> {
  const result = await pool.query(`
    SELECT 
      iel.verification_id,
      v.abr_abn as abn,
      v.abr_business_name as business_name,
      iel.is_primary_entity as is_primary,
      iel.entity_type
    FROM individual_entity_links iel
    JOIN verifications v ON v.id = iel.verification_id
    WHERE iel.individual_id = $1
    ORDER BY iel.is_primary_entity DESC, iel.created_at ASC
  `, [individualId]);

  return result.rows.map(row => ({
    verification_id: row.verification_id,
    abn: row.abn,
    business_name: row.business_name,
    is_primary: row.is_primary,
    entity_type: row.entity_type,
  }));
}

