/**
 * Monoova NPP PayID Integration
 * Lookup PayID information for bank account verification
 * Cost: $0.05 per lookup (tracked in database)
 */

import pool from '../../config/database';

export interface PayIDLookupResult {
  success: boolean;
  account_name: string | null;
  payid_value: string;
  payid_type: 'email' | 'phone' | 'abn';
  error: string | null;
  cost: number;
}

/**
 * Lookup PayID via Monoova API
 * Tracks cost and usage in database
 */
export async function lookupPayID(
  payid: string,
  type: 'email' | 'phone' | 'abn',
  individualId?: string
): Promise<PayIDLookupResult> {
  // Check if PayID lookup is enabled
  if (process.env.ENABLE_NPP_PAYID === 'false') {
    return {
      success: false,
      account_name: null,
      payid_value: payid,
      payid_type: type,
      error: 'PayID lookup disabled via feature flag',
      cost: 0,
    };
  }

  // Check monthly budget
  const budgetCheck = await checkMonthlyBudget();
  if (!budgetCheck.within_budget) {
    return {
      success: false,
      account_name: null,
      payid_value: payid,
      payid_type: type,
      error: `Monthly PayID budget exceeded: $${budgetCheck.current_month_cost} / $${budgetCheck.monthly_limit}`,
      cost: 0,
    };
  }

  const apiKey = process.env.MONOOVA_API_KEY;
  const apiSecret = process.env.MONOOVA_API_SECRET;
  const apiUrl = process.env.MONOOVA_API_URL || 'https://api.monoova.com/v2';
  const environment = process.env.MONOOVA_ENVIRONMENT || 'sandbox';

  if (!apiKey || !apiSecret) {
    return {
      success: false,
      account_name: null,
      payid_value: payid,
      payid_type: type,
      error: 'Monoova API credentials not configured',
      cost: 0,
    };
  }

  try {
    // Monoova PayID lookup API
    const lookupUrl = `${apiUrl}/payid/lookup`;
    
    // Create Basic Auth header
    const credentials = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
    
    const response = await fetch(lookupUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        payid: payid,
        type: type,
        environment: environment,
      }),
    });

    const responseData = await response.json() as any;
    const cost = 0.05; // $0.05 per lookup

    // Store usage record
    await pool.query(`
      INSERT INTO npp_payid_usage (
        individual_id, payid_value, payid_type,
        api_success, api_response, api_error, cost
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      individualId || null,
      payid,
      type,
      response.ok,
      JSON.stringify(responseData),
      response.ok ? null : ((responseData as any)?.error || response.statusText),
      cost,
    ]);

    if (response.ok && (responseData as any)?.accountName) {
      return {
        success: true,
        account_name: (responseData as any).accountName,
        payid_value: payid,
        payid_type: type,
        error: null,
        cost,
      };
    } else {
      return {
        success: false,
        account_name: null,
        payid_value: payid,
        payid_type: type,
        error: (responseData as any)?.error || response.statusText || 'PayID lookup failed',
        cost,
      };
    }
  } catch (error) {
    const cost = 0.05;
    
    // Store failed usage record
    await pool.query(`
      INSERT INTO npp_payid_usage (
        individual_id, payid_value, payid_type,
        api_success, api_response, api_error, cost
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      individualId || null,
      payid,
      type,
      false,
      null,
      error instanceof Error ? error.message : 'Unknown error',
      cost,
    ]);

    return {
      success: false,
      account_name: null,
      payid_value: payid,
      payid_type: type,
      error: error instanceof Error ? error.message : 'Unknown error',
      cost,
    };
  }
}

/**
 * Check if monthly PayID budget is within limits
 */
async function checkMonthlyBudget(): Promise<{
  within_budget: boolean;
  current_month_cost: number;
  monthly_limit: number;
}> {
  const monthlyLimit = parseFloat(process.env.MONTHLY_PAYID_BUDGET || '5');
  
  // Get current month's total cost
  const currentMonth = new Date();
  const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  
  const result = await pool.query(`
    SELECT COALESCE(SUM(cost), 0) as total_cost
    FROM npp_payid_usage
    WHERE created_at >= $1
  `, [startOfMonth]);

  const currentMonthCost = parseFloat(result.rows[0].total_cost);

  return {
    within_budget: currentMonthCost < monthlyLimit,
    current_month_cost: currentMonthCost,
    monthly_limit: monthlyLimit,
  };
}

/**
 * Get PayID usage statistics
 */
export async function getPayIDUsageStats(): Promise<{
  total_lookups: number;
  successful_lookups: number;
  total_cost: number;
  current_month_cost: number;
}> {
  const stats = await pool.query(`
    SELECT 
      COUNT(*) as total_lookups,
      COUNT(*) FILTER (WHERE api_success = true) as successful_lookups,
      COALESCE(SUM(cost), 0) as total_cost,
      COALESCE(SUM(cost) FILTER (WHERE created_at >= date_trunc('month', NOW())), 0) as current_month_cost
    FROM npp_payid_usage
  `);

  return {
    total_lookups: parseInt(stats.rows[0].total_lookups),
    successful_lookups: parseInt(stats.rows[0].successful_lookups),
    total_cost: parseFloat(stats.rows[0].total_cost),
    current_month_cost: parseFloat(stats.rows[0].current_month_cost),
  };
}

