# Handoff Strategy: You → Claude

## What Just Happened

You identified the **single most critical issue** in your CIS platform: **mismatched verification**. This is the issue that creates legal liability for your customers (accountants) and determines whether your product is trustworthy or dangerous.

Instead of trying to solve implementation details yourself, you're executing a **clear division of labor**:

- **You (Human)**: Strategic clarity on what problem needs solving
- **Claude (AI)**: Technical implementation of the solution

This is the PDCA framework in action:
- **Plan**: Final objectives document + Claude job brief (done ✅)
- **Do**: Claude builds the implementation
- **Check**: You review and validate
- **Act**: Iterate based on findings

---

## What Claude Gets

You're handing Claude **two documents**:

### Document 1: Final Objectives (`final-objectives.md`)
**Purpose**: High-level context only  
**Claude reads this to understand**:
- What product you're building (document verification for accountants)
- Who your customer is (SMB accountants in Australia)
- What problem you're solving (mismatched verification)
- Business constraints (freemium model, <$0.10 API cost)

### Document 2: Job Brief (`claude-job-brief.md`)
**Purpose**: Specific technical mandate  
**Claude reads this to understand**:
- Exactly what "mismatched verification" means (4 failure scenarios)
- Why it matters (legal liability for customers)
- Non-negotiable design principles (trilogy-based verification, status checking, extraction validation loop)
- What success looks like (no false positives, complete audit trail)
- What you want delivered (code + implementation)

---

## Why This Handoff Strategy Works

**1. No Ambiguity**
Claude doesn't have to guess what you want. You've defined the constraint: "Mismatched verification can NEVER happen." That's a binary pass/fail requirement.

**2. Implementation Freedom**
Once the constraint is clear, Claude has freedom to choose architecture. You're not telling Claude "use this database schema" — you're saying "this outcome must not occur."

**3. Prevents AI Misalignment**
Earlier, Perplexity and Claude disagreed on whether to remove the photo feature. Now they're aligned because you've made the decision: **Remove it.** No debate. Claude implements within those guardrails.

**4. Auditable Decisions**
Claude's implementation will include the reasoning for every design choice, and you can validate against the job brief. If Claude's code doesn't match the principles (no fuzzy matching, trilogy checking, etc.), you catch it immediately.

---

## Claude's Next Steps (What To Expect)

### Phase 1: Validation (Claude's first response)
Claude will likely:
- Confirm understanding of mismatched verification
- Ask clarifying questions about ABR API access
- Outline the technical approach
- Show test cases for what would fail/pass

### Phase 2: Implementation (Claude's deliverable)
Claude will provide:
- Updated document verification pipeline code
- ABR integration logic
- Extraction validation loop
- Audit logging schema
- Manual review UI markup
- Test scenarios

### Phase 3: Iteration (Your feedback loop)
You review and either:
- ✅ Approve (if it meets the job brief)
- 🔄 Ask for adjustments (if something doesn't match the principles)
- 📋 Add new constraints (if you think of additional edge cases)

---

## You Remain In Control

This handoff **does not** mean you step away. You:

1. **Review every deliverable** against the job brief
2. **Make final approval decisions** on design choices
3. **Can reject code** that doesn't meet the principles
4. **Can add constraints** as you learn more

The framework is: "Claude, build this system such that mismatched verification is impossible. Show me how you did it. I'll validate it meets the constraints."

---

## Why This Matters for Your Product

**Right now**, your CIS platform is **dangerous without this**:
- Accountants rely on your verification to process client payments
- If your system approves the wrong entity, their liability chains to you
- If this happens to 5-10 customers, your product doesn't survive

**After Claude's implementation**, your platform is **trustworthy because**:
- You have architectural guarantees against mismatched verification
- Every decision is logged with full evidence
- Accountants can confidently rely on the system
- You can show compliance auditors: "Here's how we prevent this failure"

---

## Ready to Brief Claude?

You now have two documents in this folder:
- `final-objectives.md` → Share with Claude
- `claude-job-brief.md` → Share with Claude

Then ask Claude: "Here's the context and the specific job I need done. Can you build the implementation?"

Claude will handle the rest. Your job is to review and validate.