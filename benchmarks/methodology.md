# RAG Benchmark Methodology

**Version:** 1.0  
**Status:** Pre-run scaffolding — results filled after evaluation  
**Last updated:** —

---

## Overview

This document describes the methodology for evaluating graph-augmented RAG
versus naive retrieval on the internal 60-question stratified benchmark.
It also covers judge calibration, statistical reporting, and the criteria for
claiming a result.

---

## 1. Primary Benchmark: RepoBench-R

RepoBench-R (Liu et al., 2023) is the retrieval subtask of the RepoBench suite.
Given a line of code that requires cross-file context to complete, the system
must retrieve the correct context from the repository.

**Repos used:** FastAPI, HTTPX, Celery (Python)  
**Metric:** Recall@5 and Recall@10  
**Split:** cross_file_first (the most challenging, most relevant to our contribution)

Results are in `benchmarks/results/repobench_naive.json` and
`benchmarks/results/repobench_graph.json`.

If graph-augmented does not outperform naive on the cross-file split, the
graph expansion logic has a bug. Fix the bug before reporting results.

---

## 2. Internal Stratified Benchmark

### 2.1 Question Design

60 questions across 3 repos (FastAPI, HTTPX, Celery), stratified into 3 categories:

| Category | n | What it tests | Expected graph benefit |
|---|---|---|---|
| Single-function | 20 | Questions answerable by reading one function | None |
| Cross-file | 20 | Questions requiring 2+ files | Moderate |
| Call-chain | 20 | Questions requiring tracing an execution path | High |

**Before writing any question, answer:** "Can this be answered by reading one
function in isolation?" If yes → Category 1. If it requires understanding
call relationships → Category 2 or 3.

**Questions must have objectively correct answers.** Subjective architecture
questions are not allowed. Every question has a `ground_truth` field with the
specific function name, file path, or behaviour that constitutes a correct answer.

Questions are committed to `benchmarks/rag_eval_questions.json` **before running
any evaluations**. Questions are never modified after seeing results.

### 2.2 LLM Judge

**Model:** GPT-4o-mini  
**Scoring:** Binary (0 or 1 per question per retrieval mode)  
**Anti-length-bias instruction** (verbatim in every judge call):

```
You are evaluating whether an AI assistant correctly answered a question about
a code repository.

Question: {question}
Correct answer (ground truth): {ground_truth}
AI answer: {ai_answer}

Score the AI answer 0 or 1.
Score 1 if: The AI answer identifies the correct function(s), file(s), or
behavior described in the ground truth. Minor differences in wording are
acceptable.
Score 0 if: The AI answer is incorrect, identifies the wrong function or file,
describes incorrect behavior, or says it cannot find the information.

Important: Do not score based on answer length. A short correct answer scores 1.
A long incorrect answer scores 0.

Respond with only "0" or "1". No explanation.
```

### 2.3 Judge Calibration

Before running the main evaluation, the judge is calibrated as follows:

1. Select 10 questions from the eval set.
2. Feed identical context and answer to the judge for both retrieval modes.
3. Record whether the judge assigns identical scores to identical inputs.
4. **Pass criteria:** identical answers receive identical scores 10/10 times.
5. If calibration fails, adjust the prompt until it passes.

Calibration results are recorded below (fill after running):

| Run | Questions | Identical inputs | Same score | Pass? |
|-----|-----------|-----------------|------------|-------|
| 1   | —         | —               | —          | —     |

Length-bias correlation:

After the main eval, compute Pearson r between answer length (characters) and
judge score. If r > 0.3, the judge is biased and results are invalid.

**Correlation (fill after eval):** —

---

## 3. Statistical Reporting

All results are reported as `X% [CI_low%, CI_high%]` using Wilson confidence
intervals at 95%.

```python
from statsmodels.stats.proportion import proportion_confint

def wilson_ci(successes, n, alpha=0.05):
    low, high = proportion_confint(successes, n, alpha=alpha, method='wilson')
    return round(low * 100, 1), round(high * 100, 1)
```

If confidence intervals overlap between naive and graph-augmented for a
category, that is acknowledged explicitly: "The difference is not statistically
significant at 95% confidence with n=20 samples per category."

---

## 4. Result Format

```
RAG Accuracy — Internal Benchmark (60 questions, 3 repos)
                          Naive               Graph-Aug
Single-function (n=20):   X% [CI_low–CI_high]  X% [CI_low–CI_high]  → no significant difference (expected)
Cross-file (n=20):        X% [CI_low–CI_high]  X% [CI_low–CI_high]  → Xpp improvement
Call-chain (n=20):        X% [CI_low–CI_high]  X% [CI_low–CI_high]  → Xpp improvement
Aggregate (n=60):         X% [CI_low–CI_high]  X% [CI_low–CI_high]  → Xpp improvement
```

---

## 5. What Constitutes a Valid Claim

**"Graph-augmented RAG improves cross-file Q&A accuracy"** is a valid claim if:
- Graph-augmented outperforms naive on the cross-file + call-chain categories
- The RepoBench-R cross-file Recall@10 delta is ≥5 points
- The confidence intervals for the cross-file category do not fully overlap

**"Fine-tuning improves bug-fix capability"** is a valid claim if:
- CodeBLEU on the held-out test set improves vs. the zero-shot baseline
- The test split was committed before training began and never modified

---

## 6. Reproducibility Checklist

- [ ] `benchmarks/rag_eval_questions.json` committed before any eval run
- [ ] `training/data/test.jsonl` committed before training began
- [ ] `training/data/split_indices.json` committed (proves test/train separation)
- [ ] All four result JSON files committed (`base_codeblu.json`,
      `finetuned_codeblu.json`, `base_humaneval.json`, `finetuned_humaneval.json`)
- [ ] `benchmarks/results/rag_eval_results.json` committed with raw per-question scores
- [ ] Judge calibration results documented above
- [ ] `benchmarks/results/repobench_naive.json` and `repobench_graph.json` committed

---

## 7. Hop Ablation

Per PRD interview prep: a 2-hop ablation was run on 20 questions to justify
the 1-hop choice.

Results are in `benchmarks/results/hop_ablation.json`.

**Finding (fill after running ablation):** —
