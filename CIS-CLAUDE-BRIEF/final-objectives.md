# Final Project Objectives - CIS Platform (Customer Information Sheet Generator)

## Primary Objective

Deliver an **AI-powered document verification and data extraction platform** for Australian SMB accountants that automates the processing of business documents (invoices, incorporation certificates, ABN registrations) while **guaranteeing verification accuracy** through mismatched verification prevention.

---

## Core Business Objectives

### 1. **Eliminate Manual Data Entry Friction**
**What**: Reduce time accountants spend manually transcribing business entity data from documents into accounting software  
**How**: Gemini Vision API extracts structured data automatically  
**Success Metric**: <2 minutes per document (including review + correction)

### 2. **Build Trust Through Accuracy Guarantees**
**What**: Provide accountants confidence that verified entities are legitimate and accurate  
**How**: Implement trilogy-based verification (ABN + name + ACN) with manual review gates  
**Success Metric**: Zero false positive approvals; 100% audit trail coverage

### 3. **Reduce Legal Liability for Customers**
**What**: Protect SMB accounting firms from fraud claims if they rely on platform verification  
**How**: Mismatched verification prevention architecture ensures no entity substitution  
**Success Metric**: Platform never approves mismatched entities; all decisions logged

### 4. **Market Entry & Revenue Path**
**What**: Launch initial product targeting solo CPAs and small accounting partnerships (1-5 partners)  
**How**: Freemium model with paid tiers (Pro: $29/mo, Enterprise: $299/mo)  
**Success Metric**: 5% free-to-paid conversion; <$0.10 API cost per document processed

---

## Technical Objectives

### 1. **Document OCR Pipeline**
- Extract entity name, ABN, ACN, business address from uploaded documents
- Validate extraction against ABR registry
- Flag discrepancies for manual review

### 2. **Entity Verification Engine**
- Query Australian Business Register (ABR) for entity status
- Validate entity is "Active" (not dissolved/transferred/removed)
- Cross-check business name exactly against ABR records
- Timestamp verification and detect stale documentation

### 3. **Mismatched Verification Prevention** (CRITICAL)
- Implement extraction validation loop (OCR → ABR validation → trilogy check)
- No fuzzy matching on business names
- Block approval if status ≠ "Active"
- Warn/block if document older than 7 days without confirmation
- Maintain complete audit trail of every decision

### 4. **User Experience for Accountants**
- Simple upload interface (drag & drop document)
- Auto-approval for clean cases (instant feedback)
- Clear manual review workflow when concerns exist
- Audit log download for compliance records

---

## Feature Decision: Camera/Photo Feature

**Status**: ✅ **REMOVED**  
**Rationale**: 
- SMB accountants need document automation, not biometric verification
- Photo feature adds complexity without revenue justification
- Removes Australian Privacy Act Section 1C compliance burden (biometric data)
- Eliminates customer privacy concerns from compliance-conscious buyers
- Frees up development time for core verification accuracy

**Impact**: Product launches focused on document OCR excellence with zero scope creep.

---

## Customer Profile (Confirmed)

**Primary**: Solo practitioners and small CPA firms (1-5 partners) in Australia  
**Pain Point**: Manual data entry from business documents into accounting systems  
**Budget**: $29-299/month  
**Use Case**: Process 10-50 business documents/month for client data collection

---

## Compliance & Governance

### 1. **Privacy Act Compliance (Australian)**
- No biometric data collection (photo feature removed)
- Document handling: Secure storage, user consent, 5-year retention policy
- Privacy impact assessment completed

### 2. **Data Security Standards**
- Encrypt stored documents at rest
- Audit log for all data access
- No financial services regulation applies (client doesn't handle funds)

### 3. **Audit Trail Requirements**
- Every verification decision logged with:
  - OCR extracted values
  - ABR query parameters
  - ABR response (status, name, ACN)
  - User decision + override reason
  - Timestamp

---

## Timeline

**This Week**: Implement mismatched verification prevention  
**Next Phase**: Beta launch to 5-10 accounting firms  
**Q1 2026**: Full market launch with revenue tiers

---

## Success Won't Look Like

❌ Photo/liveness detection shipped  
❌ Fuzzy entity name matching  
❌ Unverified ABN lookups  
❌ No audit trail  
❌ Enterprise-grade compliance burden  

---

## Success Will Look Like

✅ Documents uploaded → instant approval or clear manual review path  
✅ Zero false positive entity matches  
✅ Complete audit trail downloadable  
✅ Accountant confidence: "I can rely on this for client verification"  
✅ Revenue flowing from first 10 paying customers