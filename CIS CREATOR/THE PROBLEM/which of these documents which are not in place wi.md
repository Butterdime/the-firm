<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# which of these documents which are not in place will cause a "mismatched verification" alert?

Perfect! Now let me create a final one-page summary:

# ✅ ANSWER: What Causes "Mismatched Verification" Alert?

## The Simple Answer

**ONLY ONE THING triggers a "mismatched verification" alert:**

### **When ABN holder name ≠ Customer name (at <95% confidence)**


***

## The 4 Documents - What They Do

| Document | Missing = What Happens? | Mismatch = What Happens? |
| :-- | :-- | :-- |
| **1. Identity Doc** | ❌ REJECT (restart) | ⚠️ Alert IF name differs |
| **2. Bank Statements** | ❌ REJECT (restart) | ⚠️ Alert IF different name |
| **3. CIS Form** | ❌ REJECT (restart) | ✅ Can have alert if doesn't match ABN |
| **4. ABN/ABN Number** | ❌ REJECT (restart) | ⚠️ **MAIN ALERT if doesn't match** |


***

## What Causes the Alert (Real Examples)

### ✅ NO ALERT

```
CIS Form: "John Smith PTY LTD"
ABN Record: "JOHN SMITH PTY LIMITED"
Confidence: 98%
Result: ✅ Approved - Proceeds to Step 4
```


### ⚠️ ALERT TRIGGERED

```
CIS Form: "Smith Trading"
ABN Record: "ACME CORPORATION PTY LTD"
Confidence: 15%
Result: ⚠️ Mismatch Alert - Developer reviews
```


### ⚠️ CLOSE MATCH ALERT (Just Below 95%)

```
CIS Form: "John Smith PTY LTD"
ABN Record: "Jon Smyth PTY LIMITED"
Confidence: 89%
Result: ⚠️ Alert (below 95% threshold) - Manual review needed
```


***

## Summary Table

| Scenario | Document Status | Name Match | Result |
| :-- | :-- | :-- | :-- |
| **Missing** | 1 of 4 missing | N/A | ❌ REJECT |
| **Provided** | All 4 present | ≥95% match | ✅ APPROVE |
| **Mismatch** | All 4 present | <95% match | ⚠️ ALERT |


***

**TL;DR**: Missing any document = REJECT. Mismatched ABN name = ALERT. Matched name ≥95% = APPROVE.

See  for complete details.
<span style="display:none">[^1][^10][^11][^12][^13][^14][^15][^16][^17][^18][^19][^2][^20][^21][^22][^23][^24][^25][^26][^27][^28][^29][^3][^30][^31][^32][^33][^34][^35][^36][^37][^38][^39][^4][^40][^41][^5][^6][^7][^8][^9]</span>

<div align="center">⁂</div>

[^1]: https://ieeexplore.ieee.org/document/8720134/

[^2]: https://arxiv.org/pdf/2307.12489.pdf

[^3]: https://arxiv.org/pdf/2112.01237.pdf

[^4]: https://arxiv.org/pdf/2112.09767.pdf

[^5]: https://www.austrac.gov.au/about-us/amlctf-reform/reforms-guidance/amlctf-program-reform/customer-due-diligence-reform/enhanced-customer-due-diligence-reform

[^6]: https://www.austrac.gov.au/about-us/amlctf-reform/reforms-guidance/amlctf-program-reform/customer-due-diligence-reform/overview-customer-due-diligence-reform

[^7]: https://www.austrac.gov.au/about-us/amlctf-reform/reforms-guidance/amlctf-program-reform/customer-due-diligence-reform/initial-customer-due-diligence-reform/delayed-initial-customer-due-diligence-reform

[^8]: https://www.austrac.gov.au/business/core-guidance/customer-identification-and-verification

[^9]: https://www.minterellison.com/articles/reimagining-customer-due-diligence-aml-ctf-reform

[^10]: https://www.austrac.gov.au/sites/default/files/2024-09/Assisting customers who don’t have standard forms of identification (clean version).pdf

[^11]: https://www.macquarie.com.au/assets/bfs/documents/general/Discrepancy-management-cheat-sheet.pdf

[^12]: https://www.grantthornton.com.au/insights/client-alerts/eight-key-changes-to-the-new-amlctf-rules-for-existing-entities/

[^13]: https://www.austrac.gov.au/about-us/amlctf-reform/reforms-guidance/amlctf-program-reform/customer-due-diligence-reform/initial-customer-due-diligence-reform/identifying-individuals-who-dont-have-standard-identification-reform/alternative-identification-aboriginal-and-torres-strait

[^14]: https://www.sifma.org/wp-content/uploads/2017/09/AML_suggested-practices-for-customer-identification-programs.pdf

[^15]: https://www.homeaffairs.gov.au/criminal-justice/Pages/changes-to-customer-due-diligence.aspx

[^16]: https://www.austrac.gov.au/business/core-guidance/customer-identification-and-verification/assisting-customers-who-dont-have-standard-forms-identification

[^17]: https://complyadvantage.com/insights/kyc-aml-know-your-customer-vs-anti-money-laundering/

[^18]: https://www.tookitaki.com/blog/austrac-aml-ctf-regulations-guide

[^19]: https://www.austrac.gov.au/business/core-guidance/customer-identification-and-verification/customer-identification-and-verification-easy-reference-guide

[^20]: https://www.transfermate.com/post/account-validation-and-account-verifcation

[^21]: https://www.austrac.gov.au/about-us/amlctf-reform/reforms-guidance/amlctf-program-reform/customer-due-diligence-reform/ongoing-customer-due-diligence-reform/overview-ongoing-customer-due-diligence-reform

[^22]: https://www.austrac.gov.au/business/core-guidance/customer-identification-and-verification/customer-identification-know-your-customer-kyc

[^23]: https://www.acams.org/en/resources/aml-glossary-of-terms

[^24]: https://www.austrac.gov.au/about-us/amlctf-reform/reforms-guidance/amlctf-program-reform/customer-due-diligence-reform/reliance-customer-identification-third-party-reform/reliance-case-case-basis-reform

[^25]: https://arxiv.org/pdf/2405.18517.pdf

[^26]: https://www.arxiv.org/pdf/2408.09935.pdf

[^27]: https://huggingface.co/Cherishh/wav2vec2-slu-1/resolve/refs%2Fpr%2F1/unigrams.txt?download=true

[^28]: https://arxiv.org/pdf/1712.09691.pdf

[^29]: https://arxiv.org/html/2408.09935v1

[^30]: https://arxiv.org/pdf/1909.12946.pdf

[^31]: https://arxiv.org/pdf/2305.16758.pdf

[^32]: https://arxiv.org/pdf/1812.00076.pdf

[^33]: https://github.com/DFW1N/DFW1N-OSINT?search=1

[^34]: https://www.arxiv.org/pdf/2509.19359.pdf

[^35]: https://www.arxiv.org/list/cs/new?skip=550\&show=1000

[^36]: https://arxiv.org/html/2405.19383v2

[^37]: https://arxiv.org/html/2405.19383v4

[^38]: https://arxiv.org/pdf/2011.01826.pdf

[^39]: https://arxiv.org/pdf/2302.13823.pdf

[^40]: https://arxiv.org/html/2402.02455v2

[^41]: https://arxiv.org/pdf/2409.15389.pdf

