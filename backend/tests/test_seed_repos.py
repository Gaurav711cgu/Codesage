"""
Automated unit & integration tests for Dynamic Repository Seeder (benchmarks/seed_repos.py).
"""
import pytest
from benchmarks.seed_repos import seed_target, TARGET_PRESETS
from app.models.repo import RepoStatus


@pytest.mark.asyncio
async def test_seed_sample_repo():
    repo = await seed_target("sample", force=True)
    assert repo is not None
    assert repo.status == RepoStatus.complete
    assert repo.name == "codesage-sample-repo"
    assert repo.stats is not None
    assert repo.stats["files"] == 3
    assert repo.stats["functions"] >= 4
    assert repo.stats["edges"] >= 1


@pytest.mark.asyncio
async def test_seed_idempotency():
    repo1 = await seed_target("sample", force=False)
    assert repo1.status == RepoStatus.complete

    repo2 = await seed_target("sample", force=False)
    assert repo1.id == repo2.id


@pytest.mark.asyncio
async def test_seed_invalid_target():
    with pytest.raises(ValueError) as exc:
        await seed_target("invalid_preset_target")
    assert "Unknown preset" in str(exc.value)
