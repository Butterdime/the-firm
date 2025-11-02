// src/lib/mismatch-detection.ts
/**
 * Advanced Mismatch Detection Engine
 * Prevents identity verification mismatches using fuzzy string matching and risk scoring
 */

export interface VerificationData {
  name: string;
  address: string;
  dateOfBirth?: string;
  confidence: number;
}

export interface MismatchDetail {
  field: string;
  extracted: string;
  registry: string;
  matchScore: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  recommendation: string;
}

export interface MismatchResult {
  sessionId: string;
  riskScore: number; // 0-100
  riskLevel: 'clear' | 'low_risk' | 'medium_risk' | 'high_risk' | 'critical_risk';
  mismatches: MismatchDetail[];
  requiresManualReview: boolean;
  canProceedToCIS: boolean;
  timestamp: Date;
}

/**
 * Levenshtein Distance - Fuzzy String Matching
 * Calculates similarity between two strings (0-100%)
 */
export function calculateLevenshteinDistance(str1: string, str2: string): number {
  const s1 = normalizeString(str1);
  const s2 = normalizeString(str2);

  if (s1 === s2) return 100;
  if (s1.length === 0 || s2.length === 0) return 0;

  const matrix: number[][] = Array(s2.length + 1)
    .fill(null)
    .map(() => Array(s1.length + 1).fill(0));

  // Initialize first row and column
  for (let i = 0; i <= s1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= s2.length; j++) matrix[j][0] = j;

  // Calculate distances
  for (let j = 1; j <= s2.length; j++) {
    for (let i = 1; i <= s1.length; i++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // insertion
        matrix[j - 1][i] + 1, // deletion
        matrix[j - 1][i - 1] + cost // substitution
      );
    }
  }

  const distance = matrix[s2.length][s1.length];
  const maxLength = Math.max(s1.length, s2.length);
  return Math.round(((maxLength - distance) / maxLength) * 100);
}

/**
 * Normalize strings for comparison
 */
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .replace(/\b(jr|sr|iii|ii|iv|esq|ltd|pty|inc|corp)\b/g, '')
    .trim();
}

/**
 * Parse name components (first, middle, last)
 */
function parseNameComponents(
  name: string
): { first: string; middle: string; last: string } {
  const parts = normalizeString(name).split(/\s+/);
  return {
    first: parts[0] || '',
    middle: parts.slice(1, -1).join(' '),
    last: parts[parts.length - 1] || '',
  };
}

/**
 * Compare full names with component analysis
 */
export function compareNames(
  documentName: string,
  registryName: string,
  threshold: number = 85
): MismatchDetail | null {
  const overallMatch = calculateLevenshteinDistance(documentName, registryName);

  if (overallMatch >= threshold) {
    return null; // Acceptable match
  }

  const docParts = parseNameComponents(documentName);
  const regParts = parseNameComponents(registryName);

  const lastNameMatch = calculateLevenshteinDistance(docParts.last, regParts.last);
  const firstNameMatch = calculateLevenshteinDistance(
    docParts.first,
    regParts.first
  );

  let severity: 'critical' | 'high' | 'medium' | 'low' = 'low';
  let recommendation = '';

  // Critical: Last names don't match
  if (lastNameMatch < 70) {
    severity = 'critical';
    recommendation =
      'CRITICAL: Last names do not match. Possible identity mismatch.';
  }
  // High: First names don't match
  else if (firstNameMatch < 70) {
    severity = 'high';
    recommendation =
      'First names do not match. Verify name variations (nicknames, etc).';
  }
  // Medium: Overall low match
  else if (overallMatch < 80) {
    severity = 'medium';
    recommendation = `Names match at ${overallMatch}%. Verify spelling variations.`;
  }
  // Low: Minor variations
  else {
    severity = 'low';
    recommendation = `Names match at ${overallMatch}%. Minor variations acceptable.`;
  }

  return {
    field: 'Full Name',
    extracted: documentName,
    registry: registryName,
    matchScore: overallMatch,
    severity,
    recommendation,
  };
}

/**
 * Standardize and parse address components
 */
function standardizeAddress(address: string): {
  streetNumber: string;
  streetName: string;
  suburb: string;
  state: string;
  postcode: string;
} {
  const normalized = address.toUpperCase();

  // Extract postcode (4 digits at end)
  const postcodeMatch = normalized.match(/(\d{4})$/);
  const postcode = postcodeMatch ? postcodeMatch[1] : '';

  // Extract state
  const stateMatch = normalized.match(/\b(QLD|NSW|VIC|WA|SA|TAS|ACT|NT)\b/);
  const state = stateMatch ? stateMatch[1] : '';

  // Extract suburb (usually before state/postcode)
  const suburbMatch = normalized.match(
    /(?:^|,\s*)([A-Z\s]+?)(?:\s+(?:QLD|NSW|VIC|WA|SA|TAS|ACT|NT)|$)/
  );
  const suburb = suburbMatch ? suburbMatch[1].trim() : '';

  // Extract street (everything before suburb)
  const streetMatch = normalized.match(/^(.+?)(?:,\s*)?(?:QLD|NSW|VIC|WA|SA|TAS|ACT|NT|$)/);
  const fullStreet = streetMatch ? streetMatch[1].trim() : '';

  const streetParts = fullStreet.match(/^(\d+)\s+(.+)$/);
  const streetNumber = streetParts ? streetParts[1] : '';
  const streetName = streetParts ? streetParts[2] : fullStreet;

  return { streetNumber, streetName, suburb, state, postcode };
}

/**
 * Compare addresses with component analysis
 */
export function compareAddresses(
  documentAddress: string,
  registryAddress: string,
  threshold: number = 80
): MismatchDetail | null {
  const docStd = standardizeAddress(documentAddress);
  const regStd = standardizeAddress(registryAddress);

  // Check critical components
  const postcodeMatch = docStd.postcode === regStd.postcode;
  const stateMatch = docStd.state === regStd.state;
  const suburbMatch =
    calculateLevenshteinDistance(docStd.suburb, regStd.suburb) > 85;
  const streetMatch =
    calculateLevenshteinDistance(docStd.streetName, regStd.streetName) > 85;

  const componentMatches = [postcodeMatch, stateMatch, suburbMatch, streetMatch].filter(
    Boolean
  ).length;
  const matchScore = Math.round((componentMatches / 4) * 100);

  if (matchScore >= threshold) {
    return null; // Acceptable match
  }

  let severity: 'critical' | 'high' | 'medium' | 'low' = 'low';
  let recommendation = '';

  if (!postcodeMatch || !stateMatch) {
    severity = 'critical';
    recommendation = 'CRITICAL: Postcode/State mismatch. Possible wrong address.';
  } else if (!suburbMatch) {
    severity = 'high';
    recommendation = 'Suburb mismatch. Verify correct location.';
  } else if (!streetMatch) {
    severity = 'medium';
    recommendation = 'Street name differs. Verify address accuracy.';
  } else {
    severity = 'low';
    recommendation = `Address match at ${matchScore}%. Minor formatting differences.`;
  }

  return {
    field: 'Address',
    extracted: documentAddress,
    registry: registryAddress,
    matchScore,
    severity,
    recommendation,
  };
}

/**
 * Validate ABN format and checksum
 */
export function validateABN(abn: string): { isValid: boolean; error?: string } {
  const cleanABN = abn.replace(/[\s\-]/g, '');

  if (cleanABN.length !== 11) {
    return { isValid: false, error: 'ABN must be 11 digits' };
  }

  if (!/^\d{11}$/.test(cleanABN)) {
    return { isValid: false, error: 'ABN must contain only digits' };
  }

  // ABN checksum validation (modulo 89)
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const digits = cleanABN.split('').map(Number);
  digits[0] -= 1; // Subtract 1 from first digit

  const sum = digits.reduce((total, digit, idx) => total + digit * weights[idx], 0);
  const isValid = sum % 89 === 0;

  return {
    isValid,
    error: isValid ? undefined : 'Invalid ABN checksum',
  };
}

/**
 * Compare dates with tolerance
 */
export function compareDates(
  documentDate: Date | string,
  registryDate: Date | string,
  toleranceDays: number = 30
): MismatchDetail | null {
  const docDate = new Date(documentDate);
  const regDate = new Date(registryDate);

  const timeDiff = Math.abs(docDate.getTime() - regDate.getTime());
  const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

  if (daysDiff <= toleranceDays) {
    return null; // Within tolerance
  }

  let severity: 'critical' | 'high' | 'medium' | 'low' = 'low';
  if (daysDiff > 365) severity = 'critical';
  else if (daysDiff > 180) severity = 'high';
  else severity = 'medium';

  return {
    field: 'Date',
    extracted: docDate.toISOString().split('T')[0],
    registry: regDate.toISOString().split('T')[0],
    matchScore: Math.max(0, 100 - (daysDiff / 365) * 100),
    severity,
    recommendation: `Date discrepancy of ${daysDiff} days. Please verify correct date.`,
  };
}

/**
 * Calculate overall risk score
 */
function calculateRiskScore(mismatches: MismatchDetail[]): number {
  if (mismatches.length === 0) return 0;

  const severityWeights = {
    critical: 40,
    high: 25,
    medium: 15,
    low: 5,
  };

  const totalWeight = mismatches.reduce(
    (sum, m) => sum + severityWeights[m.severity],
    0
  );

  return Math.min(100, totalWeight);
}

/**
 * Determine risk level
 */
function determineRiskLevel(riskScore: number, hasCritical: boolean): MismatchResult['riskLevel'] {
  if (riskScore === 0) return 'clear';
  if (hasCritical) return 'critical_risk';
  if (riskScore >= 75) return 'high_risk';
  if (riskScore >= 50) return 'medium_risk';
  if (riskScore >= 20) return 'low_risk';
  return 'clear';
}

/**
 * Main verification analysis function
 */
export function analyzeMismatches(
  sessionId: string,
  documentData: VerificationData,
  registryData: VerificationData,
  abnData?: { abn: string }
): MismatchResult {
  const mismatches: MismatchDetail[] = [];

  // Validate ABN first
  if (abnData?.abn) {
    const abnValidation = validateABN(abnData.abn);
    if (!abnValidation.isValid) {
      return {
        sessionId,
        riskScore: 100,
        riskLevel: 'critical_risk',
        mismatches: [
          {
            field: 'ABN',
            extracted: abnData.abn,
            registry: 'Invalid',
            matchScore: 0,
            severity: 'critical',
            recommendation: `ABN validation failed: ${abnValidation.error}`,
          },
        ],
        requiresManualReview: true,
        canProceedToCIS: false,
        timestamp: new Date(),
      };
    }
  }

  // Compare names
  const nameMismatch = compareNames(documentData.name, registryData.name);
  if (nameMismatch) mismatches.push(nameMismatch);

  // Compare addresses
  const addressMismatch = compareAddresses(
    documentData.address,
    registryData.address
  );
  if (addressMismatch) mismatches.push(addressMismatch);

  // Compare dates if provided
  if (documentData.dateOfBirth && registryData.dateOfBirth) {
    const dateMismatch = compareDates(
      documentData.dateOfBirth,
      registryData.dateOfBirth,
      1 // No tolerance for DOB
    );
    if (dateMismatch) mismatches.push(dateMismatch);
  }

  // Calculate scores
  const riskScore = calculateRiskScore(mismatches);
  const hasCritical = mismatches.some((m) => m.severity === 'critical');
  const riskLevel = determineRiskLevel(riskScore, hasCritical);

  return {
    sessionId,
    riskScore,
    riskLevel,
    mismatches,
    requiresManualReview: riskLevel !== 'clear' && riskLevel !== 'low_risk',
    canProceedToCIS: riskLevel === 'clear' || riskLevel === 'low_risk',
    timestamp: new Date(),
  };
}

export default {
  calculateLevenshteinDistance,
  compareNames,
  compareAddresses,
  compareDates,
  validateABN,
  analyzeMismatches,
};
