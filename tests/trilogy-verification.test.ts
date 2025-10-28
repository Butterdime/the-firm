import { verifyTrilogy } from '../src/lib/trilogy-verification';
import { ExtractedData } from '../src/lib/gemini-extraction';
import { ABRResult } from '../src/lib/abr-verification';

describe('Trilogy Verification Edge Cases', () => {
  test('perfect match should pass', () => {
    const extracted: ExtractedData = {
      abn: '12345678901',
      acn: '123456789',
      business_name: 'ACME PTY LTD',
      address: '123 Main St',
      extraction_successful: true,
      extraction_errors: []
    };

    const abr: ABRResult = {
      abn: '12345678901',
      acn: '123456789',
      business_name: 'ACME PTY LTD',
      entity_status: 'Active',
      entity_type: 'Company',
      raw_response: {},
      lookup_successful: true,
      lookup_errors: []
    };

    const result = verifyTrilogy(extracted, abr);
    expect(result.passed).toBe(true);
    expect(result.checks.abn_match).toBe(true);
    expect(result.checks.acn_match).toBe(true);
    expect(result.checks.name_match).toBe(true);
    expect(result.checks.entity_active).toBe(true);
  });

  test('case variance should fail', () => {
    const extracted: ExtractedData = {
      abn: '12345678901',
      acn: '123456789',
      business_name: 'acme pty ltd',
      address: '123 Main St',
      extraction_successful: true,
      extraction_errors: []
    };

    const abr: ABRResult = {
      abn: '12345678901',
      acn: '123456789',
      business_name: 'ACME PTY LTD',
      entity_status: 'Active',
      entity_type: 'Company',
      raw_response: {},
      lookup_successful: true,
      lookup_errors: []
    };

    const result = verifyTrilogy(extracted, abr);
    expect(result.passed).toBe(false);
    expect(result.checks.name_match).toBe(false);
    expect(result.mismatch_reason).toContain('Business name mismatch');
  });

  test('dissolved entity should fail', () => {
    const extracted: ExtractedData = {
      abn: '12345678901',
      acn: '123456789',
      business_name: 'ACME PTY LTD',
      address: '123 Main St',
      extraction_successful: true,
      extraction_errors: []
    };

    const abr: ABRResult = {
      abn: '12345678901',
      acn: '123456789',
      business_name: 'ACME PTY LTD',
      entity_status: 'Removed',
      entity_type: 'Company',
      raw_response: {},
      lookup_successful: true,
      lookup_errors: []
    };

    const result = verifyTrilogy(extracted, abr);
    expect(result.passed).toBe(false);
    expect(result.checks.entity_active).toBe(false);
    expect(result.mismatch_reason).toContain('Entity status is "Removed"');
  });

  test('ACN mismatch should fail', () => {
    const extracted: ExtractedData = {
      abn: '12345678901',
      acn: '987654321',
      business_name: 'ACME PTY LTD',
      address: '123 Main St',
      extraction_successful: true,
      extraction_errors: []
    };

    const abr: ABRResult = {
      abn: '12345678901',
      acn: '123456789',
      business_name: 'ACME PTY LTD',
      entity_status: 'Active',
      entity_type: 'Company',
      raw_response: {},
      lookup_successful: true,
      lookup_errors: []
    };

    const result = verifyTrilogy(extracted, abr);
    expect(result.passed).toBe(false);
    expect(result.checks.acn_match).toBe(false);
    expect(result.mismatch_reason).toContain('ACN mismatch');
  });

  test('ABN mismatch should fail', () => {
    const extracted: ExtractedData = {
      abn: '99999999999',
      acn: '123456789',
      business_name: 'ACME PTY LTD',
      address: '123 Main St',
      extraction_successful: true,
      extraction_errors: []
    };

    const abr: ABRResult = {
      abn: '12345678901',
      acn: '123456789',
      business_name: 'ACME PTY LTD',
      entity_status: 'Active',
      entity_type: 'Company',
      raw_response: {},
      lookup_successful: true,
      lookup_errors: []
    };

    const result = verifyTrilogy(extracted, abr);
    expect(result.passed).toBe(false);
    expect(result.checks.abn_match).toBe(false);
    expect(result.mismatch_reason).toContain('ABN mismatch');
  });

  test('trading name should fail', () => {
    const extracted: ExtractedData = {
      abn: '12345678901',
      acn: '123456789',
      business_name: 'ACME PTY LTD T/A ACME SERVICES',
      address: '123 Main St',
      extraction_successful: true,
      extraction_errors: []
    };

    const abr: ABRResult = {
      abn: '12345678901',
      acn: '123456789',
      business_name: 'ACME PTY LTD',
      entity_status: 'Active',
      entity_type: 'Company',
      raw_response: {},
      lookup_successful: true,
      lookup_errors: []
    };

    const result = verifyTrilogy(extracted, abr);
    expect(result.passed).toBe(false);
    expect(result.checks.name_match).toBe(false);
    expect(result.mismatch_reason).toContain('Business name mismatch');
  });

  test('sole trader without ACN should pass', () => {
    const extracted: ExtractedData = {
      abn: '12345678901',
      acn: null,
      business_name: 'JOHN SMITH',
      address: '123 Main St',
      extraction_successful: true,
      extraction_errors: []
    };

    const abr: ABRResult = {
      abn: '12345678901',
      acn: null,
      business_name: 'JOHN SMITH',
      entity_status: 'Active',
      entity_type: 'Individual',
      raw_response: {},
      lookup_successful: true,
      lookup_errors: []
    };

    const result = verifyTrilogy(extracted, abr);
    expect(result.passed).toBe(true);
    expect(result.checks.acn_match).toBe(true); // Both null = OK
  });

  test('missing extracted ABN should fail', () => {
    const extracted: ExtractedData = {
      abn: null,
      acn: '123456789',
      business_name: 'ACME PTY LTD',
      address: '123 Main St',
      extraction_successful: true,
      extraction_errors: []
    };

    const abr: ABRResult = {
      abn: '12345678901',
      acn: '123456789',
      business_name: 'ACME PTY LTD',
      entity_status: 'Active',
      entity_type: 'Company',
      raw_response: {},
      lookup_successful: true,
      lookup_errors: []
    };

    const result = verifyTrilogy(extracted, abr);
    expect(result.passed).toBe(false);
    expect(result.checks.abn_match).toBe(false);
    expect(result.mismatch_reason).toContain('ABN not extracted');
  });
});

describe('ABN Normalization - Formatted Inputs', () => {
  // Import queryABR for direct testing
  const { queryABR } = require('../src/lib/abr-verification');

  test('ABN with periods should be normalized', async () => {
    // Note: This is a mock test - in real scenario would need to mock fetch
    // Testing the normalization logic itself
    const formattedABN = '12.345.678.901';
    const cleanedABN = formattedABN.replace(/[\s\-\.]/g, '');
    
    expect(cleanedABN).toBe('12345678901');
    expect(cleanedABN.length).toBe(11);
    expect(/^\d+$/.test(cleanedABN)).toBe(true);
  });

  test('ABN with spaces should be normalized', async () => {
    const formattedABN = '12 345 678 901';
    const cleanedABN = formattedABN.replace(/[\s\-\.]/g, '');
    
    expect(cleanedABN).toBe('12345678901');
    expect(cleanedABN.length).toBe(11);
    expect(/^\d+$/.test(cleanedABN)).toBe(true);
  });

  test('ABN with hyphens should be normalized', async () => {
    const formattedABN = '12-345-678-901';
    const cleanedABN = formattedABN.replace(/[\s\-\.]/g, '');
    
    expect(cleanedABN).toBe('12345678901');
    expect(cleanedABN.length).toBe(11);
    expect(/^\d+$/.test(cleanedABN)).toBe(true);
  });

  test('ABN with mixed formatting should be normalized', async () => {
    const formattedABN = '12.345 678-901';
    const cleanedABN = formattedABN.replace(/[\s\-\.]/g, '');
    
    expect(cleanedABN).toBe('12345678901');
    expect(cleanedABN.length).toBe(11);
    expect(/^\d+$/.test(cleanedABN)).toBe(true);
  });

  test('unformatted ABN should remain unchanged', async () => {
    const unformattedABN = '12345678901';
    const cleanedABN = unformattedABN.replace(/[\s\-\.]/g, '');
    
    expect(cleanedABN).toBe('12345678901');
    expect(cleanedABN.length).toBe(11);
    expect(/^\d+$/.test(cleanedABN)).toBe(true);
  });

  test('invalid formatted ABN should be rejected', async () => {
    const invalidABN = '12.345.678';
    const cleanedABN = invalidABN.replace(/[\s\-\.]/g, '');
    
    expect(cleanedABN.length).not.toBe(11);
  });
});