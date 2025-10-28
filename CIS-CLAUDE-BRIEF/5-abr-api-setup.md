# ABR API Credential Management - Setup Guide for Claude

## Current Status: ABR API Access

To complete the CIS platform implementation, Claude needs clarification on Australian Business Register (ABR) API access.

---

## Question 1: Do You Have Existing ABR API Access?

**Option A: Yes, I have ABR API credentials**
- Provide: ABR API Key / Subscription Details
- Provide: ABR API endpoint URL
- Provide: Rate limits (requests/minute, daily quota)
- Provide: Documentation link or sample response

**Option B: No, I need to set up ABR API access**
- ABR Public Search API is FREE for basic queries
- Registration required at: https://www.asic.gov.au/
- Alternative: Use ABN Lookup API (free tier available)

**Option C: Uncertain about current setup**
- Check existing code repository for ABR integration
- Check .env files for `ABR_API_KEY` or similar

---

## ABR API Integration Options

### Option 1: ASIC ABN Lookup (Recommended for SMB)
**Cost**: Free for basic use  
**Access**: Public API, no authentication required  
**Rate Limits**: Standard (typically not enforced for SMB volume)

**API Endpoint**:
```
GET https://data.business.gov.au/data/v1/abn/
?q=ACN:XXXXXXXXX
&limit=1
&highlight=off
&pretty=on
```

**Response Fields**:
```json
{
  "response": {
    "docs": [
      {
        "abn": "12345678901",
        "acn": "123456789",
        "name": "BUSINESS NAME PTY LTD",
        "entity_status": "Active",
        "entity_type": "Australian Private Company",
        "postcode": "3000"
      }
    ]
  }
}
```

**What We Need From This**:
- `abn` (verify exact match)
- `acn` (verify exact match)
- `name` (verify exact match, case-sensitive)
- `entity_status` (verify = "Active")

---

### Option 2: ABR API (Commercial/Enterprise)
**Cost**: Paid subscription (~AUD 100-500/month depending on volume)  
**Access**: Requires ABR API key authentication  
**Rate Limits**: Higher than public API  
**Benefit**: More detailed entity information + status history

If you have this, provide:
- ABR API endpoint
- API Key
- Available data fields
- Rate limit info

---

### Option 3: Third-Party ABN Service (ABN Lookup APIs)
**Cost**: Varies ($10-50/month for SMB volumes)  
**Services**: 
- ABN.net.au API
- Business.gov.au Data API
- Specialty ABN lookup services

---

## What Claude Needs From You (Required for Phase 1C)

For Phase 1C (ABR Verification Engine), Claude must know:

| Requirement | What Claude Needs | Where to Find It |
|---|---|---|
| **API Endpoint** | Full URL (e.g., `https://data.business.gov.au/...`) | Your ABR subscription docs or .env file |
| **Authentication** | Method: None / API Key / OAuth / Other | ABR provider documentation |
| **API Key** | Actual credential (if required) | .env file or credentials manager |
| **Response Format** | Sample JSON response | Documentation or test call |
| **Rate Limits** | Requests/min, daily quota, retry strategy | Documentation or contact ABR provider |
| **Status Field** | How entity status is returned (e.g., "Active", "Removed") | Sample response or API docs |
| **Name Matching** | How business name is returned vs. what we query | Test with a known ABN |

---

## Decision Point for You

**What should Claude assume for Phase 1C?**

Choose one:

### Path A: Use Public ABN Lookup API (No credentials needed)
**Pros**: 
- Free, no setup
- Works immediately
- Sufficient for SMB 10 customers/week

**Cons**:
- Limited fields
- Basic status info only
- May not have full history

**For Claude**: Implement against public API, no credentials required

---

### Path B: Provide ABR Commercial API Credentials
**Pros**:
- Complete entity data
- Full status history
- Better audit trail

**Cons**:
- Requires subscription
- Setup time needed
- Ongoing cost

**For Claude**: Needs you to provide API key + endpoint

---

### Path C: Wait, I need to set up ABR access first
**Action**: 
1. Register at https://www.asic.gov.au/
2. Request ABR API access
3. Get API key
4. Return to Claude with credentials

**Timeline**: 1-3 business days

---

## Credential Security Best Practice

**⚠️ CRITICAL: Do NOT commit credentials to GitHub**

Claude should implement:

```typescript
// .env (gitignored)
ABR_API_KEY=your-actual-key-here
ABR_API_ENDPOINT=https://your-api-endpoint

// config.ts (source this from .env)
export const abrConfig = {
  apiKey: process.env.ABR_API_KEY,
  endpoint: process.env.ABR_API_ENDPOINT,
};

// verification.ts (use config, never expose in code)
const response = await fetch(`${abrConfig.endpoint}?abn=${abn}`, {
  headers: {
    'Authorization': `Bearer ${abrConfig.apiKey}`,
  },
});
```

**Never**:
- ❌ Hardcode API keys in source code
- ❌ Commit .env to GitHub
- ❌ Expose keys in error messages
- ❌ Log keys to stdout

**Always**:
- ✅ Use environment variables
- ✅ Rotate keys regularly
- ✅ Add `.env` to `.gitignore`
- ✅ Store secrets in Railway environment config

---

## What to Do Right Now

### Action 1: Check Current Setup
Look for ABR configuration in your existing code:
- Is there already ABR API integration?
- Do you have credentials set up?
- What endpoint is being used?

### Action 2: Decide Which Path
- Path A (public API - easiest)
- Path B (commercial API - you provide credentials)
- Path C (wait, need to set up access first)

### Action 3: Provide Decision to Claude
Tell Claude: "Use Path A/B/C and here are the details..."

---

## Sample Credentials Template for Claude

If you choose Path B, provide this information:

```
ABR API Configuration
====================

Endpoint: https://[your-api-provider].com/api/v1/abn-lookup
Authentication Method: API Key (Bearer token)
API Key: [NOT VISIBLE HERE - provide via secure channel]
Rate Limit: 1000 requests/day
Retry Strategy: Exponential backoff (max 3 retries)

Sample Response:
{
  "abn": "12345678901",
  "name": "EXAMPLE PTY LTD",
  "status": "Active",
  "acn": "123456789",
  "entity_type": "Private Company",
  "registration_date": "2010-01-15"
}

Fields Needed for Verification:
- abn (string, 11 digits)
- name (string, exact match required)
- status (enum: "Active", "Removed", "Cancelled", "Transferred")
- acn (string, optional but use if available)
```

---

## Claude's Next Steps (Once You Decide)

1. **Receive Path Decision**: You tell Claude which path
2. **Receive Credentials** (if Path B): You provide API endpoint + key via secure method
3. **Implement Phase 1C**: Claude builds `lib/abr-verification.ts` against the chosen API
4. **Write Tests**: Claude tests with real ABN data (e.g., ABN 12345678901)
5. **Error Handling**: Claude implements retry logic + graceful failures

---

## For Claude: What to Assume

**If you receive this document and the user hasn't specified:**

⚠️ **BLOCK**: Do not proceed with Phase 1C until you have:
1. Confirmation of which path (A, B, or C)
2. If Path B: Actual API endpoint + credentials

**What to respond to user**:
> "I'm ready to build Phase 1C (ABR Verification Engine), but I need clarification on ABR API access. Which path are you taking? (A) Public API, (B) Commercial API, or (C) Setting up access? Please provide details and credentials."

---

## One-Time Setup Checklist for Claude

Once credentials are provided, Claude should:

- [ ] Add `ABR_API_KEY` to Railway environment variables (never in code)
- [ ] Add `ABR_API_ENDPOINT` to Railway environment variables
- [ ] Test ABR endpoint with sample ABN before writing to database
- [ ] Implement rate-limiting + exponential backoff
- [ ] Add ABR API failure logging (separate from application logs)
- [ ] Document API response schema in code comments
- [ ] Add integration test with real ABN lookup

---

## Your Decision (Choose One and Reply):

**Path A: Use Public ABN Lookup API (No credentials needed)**
- I choose this, proceed with public API implementation

**Path B: I have ABR commercial API credentials**
- I choose this, here's my API endpoint and I'll provide the key via secure channel

**Path C: I need to set up ABR access first**
- I choose this, pause implementation until I complete ABR registration
