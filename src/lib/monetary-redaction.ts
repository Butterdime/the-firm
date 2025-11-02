/**
 * Monetary Value Redaction Utility
 * 
 * Ensures complete privacy and compliance by redacting all fiat currency values
 * from bank statements and financial documents.
 * 
 * REDACTION POLICY:
 * - All balance amounts (opening, closing, available)
 * - All transaction amounts (credits, debits)
 * - All totals and summaries
 * - Any numeric value with currency symbols or decimal places
 * 
 * WHAT REMAINS:
 * - Account holder names
 * - BSB and account numbers
 * - Transaction dates
 * - Merchant/payee names
 * - Transaction descriptions (without amounts)
 */

export const REDACTION_TOKEN = '[REDACTED]';

/**
 * Comprehensive regex patterns for detecting monetary values
 */
const MONETARY_PATTERNS = [
  // Australian dollar formats
  /\$\s*[\d,]+\.?\d*/g,                           // $1,234.56 or $1234
  /AUD\s*[\d,]+\.?\d*/g,                          // AUD 1,234.56
  /A\$\s*[\d,]+\.?\d*/g,                          // A$ 1,234.56
  
  // Generic currency formats
  /[\d,]+\.\d{2}\s*(CR|DR|C|D)?/g,               // 1,234.56 CR/DR
  /[\d,]+\.\d{2}/g,                              // 1,234.56
  
  // Amounts with parentheses (negative)
  /\(\$?\s*[\d,]+\.?\d*\)/g,                     // ($1,234.56) or (1234.56)
  
  // Currency codes followed by amounts
  /[A-Z]{3}\s*[\d,]+\.?\d*/g,                    // USD 1234.56
  
  // Amounts with + or - signs
  /[+-]\s*\$?\s*[\d,]+\.?\d*/g,                  // +$1,234.56 or -1234.56
  
  // Balance descriptors with amounts
  /balance[:\s]*\$?\s*[\d,]+\.?\d*/gi,           // Balance: $1,234.56
  /opening[:\s]*\$?\s*[\d,]+\.?\d*/gi,           // Opening: 1234.56
  /closing[:\s]*\$?\s*[\d,]+\.?\d*/gi,           // Closing: $1,234.56
  /available[:\s]*\$?\s*[\d,]+\.?\d*/gi,         // Available: 1234
  
  // Credit/Debit with amounts
  /credit[:\s]*\$?\s*[\d,]+\.?\d*/gi,            // Credit: $500.00
  /debit[:\s]*\$?\s*[\d,]+\.?\d*/gi,             // Debit: $200.00
  /total[:\s]*\$?\s*[\d,]+\.?\d*/gi,             // Total: $1,234.56
  
  // Statement period totals
  /total\s+(credits?|debits?)[:\s]*\$?\s*[\d,]+\.?\d*/gi,
  
  // Numeric values that look like money (4+ digits with commas or decimals)
  /\b[\d]{1,3}(,\d{3})+(\.\d{2})?\b/g,          // 1,234.56 or 1,234,567.89
];

/**
 * Redact all monetary values from text
 */
export function redactMonetaryValues(text: string): string {
  if (!text) return text;
  
  let redacted = text;
  
  // Apply all patterns
  for (const pattern of MONETARY_PATTERNS) {
    redacted = redacted.replace(pattern, REDACTION_TOKEN);
  }
  
  return redacted;
}

/**
 * Redact monetary values from structured bank statement data
 */
export interface BankStatementData {
  account_holder_name: string;
  bsb: string;
  account_number: string;
  bank_name: string;
  opening_balance?: string;
  closing_balance?: string;
  total_credits?: string;
  total_debits?: string;
  transactions?: Array<{
    date: string;
    description: string;
    amount?: string;
    balance?: string;
  }>;
  raw_text?: string;
}

export function redactBankStatement(statement: BankStatementData): BankStatementData {
  return {
    ...statement,
    // Redact balance fields
    opening_balance: statement.opening_balance ? REDACTION_TOKEN : undefined,
    closing_balance: statement.closing_balance ? REDACTION_TOKEN : undefined,
    total_credits: statement.total_credits ? REDACTION_TOKEN : undefined,
    total_debits: statement.total_debits ? REDACTION_TOKEN : undefined,
    
    // Redact transaction amounts but keep descriptions
    transactions: statement.transactions?.map(txn => ({
      date: txn.date,
      description: redactMonetaryValues(txn.description),
      amount: txn.amount ? REDACTION_TOKEN : undefined,
      balance: txn.balance ? REDACTION_TOKEN : undefined,
    })),
    
    // Redact any amounts in raw text
    raw_text: statement.raw_text ? redactMonetaryValues(statement.raw_text) : undefined,
  };
}

/**
 * Generate redacted bank statement summary for CIS report
 */
export interface RedactedBankSummary {
  account_holder_name: string;
  bsb: string;
  account_number: string;
  bank_name: string;
  statement_period: string;
  transaction_count: number;
  opening_balance: string;  // Always [REDACTED]
  closing_balance: string;  // Always [REDACTED]
  total_credits: string;    // Always [REDACTED]
  total_debits: string;     // Always [REDACTED]
  sample_transactions: Array<{
    date: string;
    description: string;
    amount: string;         // Always [REDACTED]
  }>;
}

export function generateRedactedBankSummary(
  statement: BankStatementData,
  maxTransactions: number = 5
): RedactedBankSummary {
  return {
    account_holder_name: statement.account_holder_name,
    bsb: statement.bsb,
    account_number: statement.account_number,
    bank_name: statement.bank_name,
    statement_period: 'Last 3 months', // Or extract from statement
    transaction_count: statement.transactions?.length || 0,
    
    // All monetary values redacted
    opening_balance: REDACTION_TOKEN,
    closing_balance: REDACTION_TOKEN,
    total_credits: REDACTION_TOKEN,
    total_debits: REDACTION_TOKEN,
    
    // Sample transactions with redacted amounts
    sample_transactions: (statement.transactions || [])
      .slice(0, maxTransactions)
      .map(txn => ({
        date: txn.date,
        description: redactMonetaryValues(txn.description),
        amount: REDACTION_TOKEN,
      })),
  };
}

/**
 * Validate that all monetary values have been redacted
 */
export function validateRedaction(text: string): {
  is_fully_redacted: boolean;
  remaining_values: string[];
} {
  const remaining: string[] = [];
  
  for (const pattern of MONETARY_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      remaining.push(...matches);
    }
  }
  
  return {
    is_fully_redacted: remaining.length === 0,
    remaining_values: [...new Set(remaining)],
  };
}

/**
 * Format redacted bank statement for display in CIS
 */
export function formatRedactedStatementForCIS(summary: RedactedBankSummary): string {
  const lines = [
    '=== BANK ACCOUNT VERIFICATION ===',
    '',
    `Account Holder: ${summary.account_holder_name}`,
    `BSB: ${summary.bsb}`,
    `Account Number: ${summary.account_number}`,
    `Bank: ${summary.bank_name}`,
    `Statement Period: ${summary.statement_period}`,
    '',
    '--- Account Summary ---',
    `Opening Balance: ${summary.opening_balance}`,
    `Total Credits: ${summary.total_credits}`,
    `Total Debits: ${summary.total_debits}`,
    `Closing Balance: ${summary.closing_balance}`,
    '',
    `--- Sample Transactions (${summary.transaction_count} total) ---`,
  ];
  
  summary.sample_transactions.forEach(txn => {
    lines.push(`${txn.date} | ${txn.description} | ${txn.amount}`);
  });
  
  lines.push('');
  lines.push('Note: All monetary values have been redacted for privacy and compliance.');
  
  return lines.join('\n');
}

/**
 * Example usage and test cases
 */
export const REDACTION_EXAMPLES = {
  input: {
    balance: 'Opening Balance $196,885.98 CR',
    transaction: '22 Sep 25 HH CONCRETE $4,500.00 $192,385.98',
    credit: 'Total Credits $45,000.00',
    debit: 'Total Debits $48,500.00',
    various: [
      'Balance: AUD 1,234.56',
      'Available: 500.00 CR',
      'Payment of $150 processed',
      'Transfer +$1,000.00',
      'Withdrawal ($250.50)',
    ]
  },
  expected_output: {
    balance: `Opening Balance ${REDACTION_TOKEN} CR`,
    transaction: `22 Sep 25 HH CONCRETE ${REDACTION_TOKEN} ${REDACTION_TOKEN}`,
    credit: `Total Credits ${REDACTION_TOKEN}`,
    debit: `Total Debits ${REDACTION_TOKEN}`,
    various: [
      `Balance: ${REDACTION_TOKEN}`,
      `Available: ${REDACTION_TOKEN} CR`,
      `Payment of ${REDACTION_TOKEN} processed`,
      `Transfer ${REDACTION_TOKEN}`,
      `Withdrawal ${REDACTION_TOKEN}`,
    ]
  }
};

/**
 * Test the redaction function
 */
export function testRedaction(): void {
  console.log('🧪 Testing Monetary Redaction...\n');
  
  const tests = [
    { input: REDACTION_EXAMPLES.input.balance, expected: REDACTION_EXAMPLES.expected_output.balance },
    { input: REDACTION_EXAMPLES.input.transaction, expected: REDACTION_EXAMPLES.expected_output.transaction },
    { input: REDACTION_EXAMPLES.input.credit, expected: REDACTION_EXAMPLES.expected_output.credit },
    { input: REDACTION_EXAMPLES.input.debit, expected: REDACTION_EXAMPLES.expected_output.debit },
  ];
  
  tests.forEach((test, idx) => {
    const result = redactMonetaryValues(test.input);
    const passed = result === test.expected;
    console.log(`Test ${idx + 1}: ${passed ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Input:    "${test.input}"`);
    console.log(`  Expected: "${test.expected}"`);
    console.log(`  Got:      "${result}"`);
    console.log('');
  });
  
  // Validation test
  const testText = 'Account balance is $1,234.56 with total credits of $500.00';
  const redactedText = redactMonetaryValues(testText);
  const validation = validateRedaction(redactedText);
  
  console.log('📋 Validation Test:');
  console.log(`  Original: "${testText}"`);
  console.log(`  Redacted: "${redactedText}"`);
  console.log(`  Fully Redacted: ${validation.is_fully_redacted ? '✅ YES' : '❌ NO'}`);
  if (!validation.is_fully_redacted) {
    console.log(`  Remaining Values: ${validation.remaining_values.join(', ')}`);
  }
}

