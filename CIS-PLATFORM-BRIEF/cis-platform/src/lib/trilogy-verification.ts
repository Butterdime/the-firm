import { ExtractedData } from './gemini-extraction';
import { ABRResult } from './abr-verification';

export interface Trilogy VerificationResult {
  passed: boolean;
  mismatch_reason: string | null;
  checks: {
    abn_match: boolean;
    acn_match: boolean;
    name_match: boolean;
    entity_active: boolean;
  };
}

/**
 * TRILOGY VERIFICATION: ABN + ACN + Name exact match
 * 
 * CRITICAL RULES:
 * 1. Case-sensitive exact match (after trimming whitespace)
 * 2. NO fuzzy matching, NO normalization
 * 3. Entity status must be "Active"
 * 4. If ANY check fails → verification fails
 * 
 * This is the core of mismatched verification prevention
 */
export function verifyTrilogy(
  extracted: ExtractedData,
  abr: ABRResult
): TrilogyVerificationResult {
  const checks = {
    abn_match: false,
    acn_match: false,
    name_match: false,
    entity_active: false,
  };

  const reasons: string[] = [];

  // Check 1: ABN exact match
  if (!extracted.abn) {
    reasons.push('ABN not extracted from document');
  } else if (!abr.abn) {
    reasons.push('ABN not found in ABR registry');
  } else if (extracted.abn !== abr.abn) {
    reasons.push(`ABN mismatch: extracted=${extracted.abn}, ABR=${abr.abn}`);
  } else {
    checks.abn_match = true;
  }

  // Check 2: ACN exact match (optional - only check if both present)
  if (extracted.acn && abr.acn) {
    if (extracted.acn !== abr.acn) {
      reasons.push(`ACN mismatch: extracted=${extracted.acn}, ABR=${abr.acn}`);
    } else {
      checks.acn_match = true;
    }
  } else if (extracted.acn && !abr.acn) {
    reasons.push('ACN extracted but not found in ABR');
  } else if (!extracted.acn && abr.acn) {
    reasons.push('ACN in ABR but not extracted from document');
  } else {
    // Neither has ACN - this is OK for sole traders, trusts, etc.
    checks.acn_match = true;
  }

  // Check 3: Business name EXACT match (case-sensitive)
  if (!extracted.business_name) {
    reasons.push('Business name not extracted from document');
  } else if (!abr.business_name) {
    reasons.push('Business name not found in ABR registry');
  } else {
    // Exact string comparison after trim
    const extractedName = extracted.business_name.trim();
    const abrName = abr.business_name.trim();
    
    if (extractedName !== abrName) {
      reasons.push(
        `Business name mismatch (case-sensitive exact match required):\n` +
        `  Extracted: "${extractedName}"\n` +
        `  ABR: "${abrName}"`
      );
    } else {
      checks.name_match = true;
    }
  }

  // Check 4: Entity status is "Active"
  if (!abr.entity_status) {
    reasons.push('Entity status not available from ABR');
  } else if (!isActiveStatus(abr.entity_status)) {
    reasons.push(`Entity status is "${abr.entity_status}" (must be "Active")`);
  } else {
    checks.entity_active = true;
  }

  // Trilogy passes only if ALL checks pass
  const passed = 
    checks.abn_match && 
    checks.acn_match && 
    checks.name_match && 
    checks.entity_active;

  return {
    passed,
    mismatch_reason: passed ? null : reasons.join('; '),
    checks,
  };
}

/**
 * Check if entity status indicates "Active"
 * Case-insensitive check for common active status values
 */
function isActiveStatus(status: string): boolean {
  const activeStatuses = ['active', 'current'];
  return activeStatuses.includes(status.toLowerCase());
}

/**
 * Check document staleness
 * Returns warning if document is >7 days old, requires review if >30 days
 */
export function checkStaleness(documentCaptureDate: Date | null): {
  is_stale: boolean;
  requires_review: boolean;
  staleness_days: number | null;
  warning_message: string | null;
} {
  if (!documentCaptureDate) {
    return {
      is_stale: false,
      requires_review: false,
      staleness_days: null,
      warning_message: 'Document capture date not available',
    };
  }

  const now = new Date();
  const diffMs = now.getTime() - documentCaptureDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays > 30) {
    return {
      is_stale: true,
      requires_review: true,
      staleness_days: diffDays,
      warning_message: `Document is ${diffDays} days old - manual review required (entity may have changed status)`,
    };
  } else if (diffDays > 7) {
    return {
      is_stale: true,
      requires_review: false,
      staleness_days: diffDays,
      warning_message: `Document is ${diffDays} days old - review recommended`,
    };
  }

  return {
    is_stale: false,
    requires_review: false,
    staleness_days: diffDays,
    warning_message: null,
  };
}
