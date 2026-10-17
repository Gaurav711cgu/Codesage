# CodeSageZ — Staff Engineer (L5) Deep Dive & Brutal Audit

**Reviewer:** Staff Software Engineer, ML Infrastructure (Meta/Uber/Stripe level)
**Evaluation For:** SDE / ML / AI Intern & New Grad Roles
**Objective:** Deconstruct the system, brutally rate the engineering decisions, and outline the Delta to FAANG-Ready.

---

## 1. System Design & Distributed State (SDE)
**Rating: 4/10 — The "Works on My Machine" Anti-Pattern**

**The Reality Check:**
You have correctly implemented advanced concurrency patterns (Circuit Breakers, Idempotency Keys, SingleFlight). However, they are all completely **In-Memory**. 

If deployed in Kubernetes (e.g., 5 pods behind an Ingress Controller):
- Pod A's Circuit Breaker trips to `OPEN`, but Pod B is still `CLOSED` and hammering the failing downstream service.
- Client retries a POST request. Request 1 hits Pod A. Network drops. Request 2 hits Pod B. Pod B's in-memory idempotency store doesn't have the key. The side-effect happens twice.
- SingleFlight on Pod A only coalesces requests *on that pod*. 

**The L5 Verdict:**
An interviewer will say: "You built idempotency for Stripe-tier reliability, but it breaks the second you scale past 1 instance." 
**The Fix:** You must adapterize the state. The cache uses Redis correctly (`_redis_available`). SingleFlight and Idempotency must also use Redis Distributed Locks or Redis SETNX for cluster-wide consistency.

---

## 2. Token Budgeting & Recursive Context (AI Engineer)
**Rating: 3/10 — The "Naive String Slicer"**

**The Reality Check:**
In `repo.py`, you assemble the context window like this:
```python
remaining_context = 12_000
source = c.content[: min(3_000, remaining_context)]
```
You are truncating code purely by character count. 
1. **Syntax Destruction:** Cutting a Python file at exactly character 3,000 will slice mid-word, leaving dangling brackets `def do_so` or `["incomplete`. The LLM has to waste attention decoding malformed syntax.
2. **Context Window Underutilization:** Gemini 2.0 Flash has a 1 Million token context window. You are feeding it ~3k tokens (12k chars). Why are you throwing away the LLM's biggest strength?

**The L5 Verdict:**
"You claim to be building an AI-native codebase search, but you are hand-slicing strings instead of tokenizing or chunking by AST (Abstract Syntax Tree)."
**The Fix:** Use `tiktoken` to count actual tokens. If truncating, truncate at newline boundaries. Exploit the massive context window (pass 100k tokens if needed, let the model synthesize).

---

## 3. LLMOps & ML Pipeline (ML Engineer)
**Rating: 5/10 — Hardcoded Prompts & Missing Evals**

**The Reality Check:**
- Your system prompts are hardcoded directly into your FastAPI route handlers (`app/api/v1/code.py`).
- You have no way to A/B test a new prompt, no way to rollback a bad prompt without deploying new backend code, and no evaluation dataset for the prompt logic.

**The L5 Verdict:**
"This isn't LLMOps; this is an LLM wrapper. Where is the prompt registry? How do you measure if a prompt tweak regressed code review quality?"
**The Fix:** Prompts must be decoupled from business logic. Create a `prompts/` module.

---

## 4. Database Transaction Integrity
**Rating: 4/10 — The "Blind Commit"**

**The Reality Check:**
In `database.py`:
```python
async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session
        await session.commit()
```
Every single API request (even `GET /api/v1/repos`) triggers a database `COMMIT`. A `GET` request should be read-only. Auto-committing globally masks transaction boundary bugs.

**The L5 Verdict:**
"You are creating database transaction overhead on every read. Transaction boundaries must be explicitly controlled by the service layer."

---

## Action Plan: Fixing it to 9/10 FAANG-Ready
I am actively patching these issues in the codebase now.
1. **Fixing Token Budgeting:** Upgrading `repo.py` to use a token-aware chunking strategy without slicing mid-syntax.
2. **Fixing DB Commits:** Removing the blind auto-commit from `get_db`.
3. **Decoupling Prompts:** Moving prompts to a centralized LLMOps structure.
