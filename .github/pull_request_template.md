## Summary of Changes

Brief description of what this PR introduces or fixes.

## Component Impact
- [ ] Backend API / Core Services (`backend/app/`)
- [ ] Ingestion & Graph Pipeline (`backend/app/services/`)
- [ ] Frontend Application (`frontend/`)
- [ ] CI/CD & Infrastructure (`.github/`, `Dockerfile`)

## Security & System Design Checklist
- [ ] Added/updated unit tests in `backend/tests/`
- [ ] Verified non-blocking async execution (`asyncio.to_thread` for sync calls)
- [ ] No hardcoded secrets or unredacted credentials in logs
- [ ] `X-API-Key` auth and rate limits enforced on new endpoints
- [ ] Checked type hints with `mypy` and linting with `ruff`

## Verification
Detail the manual or automated test commands run to verify this PR.
```bash
pytest backend/tests/ -v
ruff check backend/app/
```
