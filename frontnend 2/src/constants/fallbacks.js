export const FALLBACK_COMPLETION_CODE = `    seen = set()
    duplicates = []

    for num in nums:
        if num in seen:
            if num not in duplicates:
                duplicates.append(num)
        else:
            seen.add(num)

    return sorted(duplicates)`;

export const DEFAULT_COMPLETION_INPUT = `def find_duplicates(nums: list[int]) -> list[int]:
    \"\"\"
    Find all duplicate numbers in a list.
    Returns a list of numbers that appear more than once.

    Args:
        nums: List of integers to check
    Returns:
        List of integers that appear more than once
    Examples:
        find_duplicates([1,2,3,2,4,3]) -> [2, 3]
        find_duplicates([1,2,3]) -> []
    \"\"\"
    # CodeSage completes from here...`;

export const DEFAULT_REVIEW_INPUT = `async function fetchUserData(userId) {
  const response = await fetch(\`/api/users/\${userId}\`)
  const data = response.json()
  return data.user
}`;

export const DEFAULT_TESTGEN_INPUT = `def calculate_discount(price: float,
                       discount_pct: float,
                       min_price: float = 0.0) -> float:
    \"\"\"Apply percentage discount, with minimum price floor.\"\"\"
    if not 0 <= discount_pct <= 100:
        raise ValueError(f"Discount must be 0-100, got {discount_pct}")
    discounted = price * (1 - discount_pct / 100)
    return max(discounted, min_price)`;

export const DEFAULT_DOCSTRING_INPUT = `def process_batch(items, config, retry=3, timeout=30):
    results = []
    for item in items:
        try:
            r = execute(item, **config)
            if r.status == 'ok':
                results.append(r.data)
            elif retry > 0:
                results.append(process_batch(
                    [item], config, retry-1, timeout
                )[0])
        except Exception as e:
            log.error(f"Failed: {item}, {e}")
    return results`;

export const COMPLETION_PRESETS = {
  'Binary search': `def binary_search(arr: list[int], target: int) -> int:
    \"\"\"Find target in sorted array. Return index or -1.\"\"\"
    # CodeSage completes from here...`,
  'Async rate limiter': `class RateLimiter:
    \"\"\"Token bucket rate limiter for async operations.\"\"\"
    def __init__(self, max_tokens: int, refill_rate: float):
        # CodeSage completes from here...`,
  'LRU cache': `class LRUCache:
    \"\"\"Least Recently Used cache with O(1) operations.\"\"\"
    def __init__(self, capacity: int):
        # CodeSage completes from here...`,
  'SQL query builder': `class QueryBuilder:
    \"\"\"Fluent SQL query builder with parameterized queries.\"\"\"
    def __init__(self, table: str):
        # CodeSage completes from here...`,
};

export const BENCHMARK_DATA = [
  { name: 'HumanEval pass@1', base: 72.6, codesage: 79.7, delta: '+7.1pp' },
  { name: 'MBPP pass@1', base: 72.8, codesage: 79.1, delta: '+6.3pp' },
  { name: 'HumanEval pass@10', base: 83.4, codesage: 89.2, delta: '+5.8pp' },
  { name: 'MBPP pass@10', base: 84.1, codesage: 89.7, delta: '+5.6pp' },
  { name: 'HumanEval+ pass@1', base: 68.9, codesage: 75.3, delta: '+6.4pp' },
  { name: 'SQL generation', base: 61.4, codesage: 74.8, delta: '+13.4pp' },
];

export const BENCHMARK_DOMAIN = [
  { name: 'Code Review (custom)', value: 87.3, badge: 'domain' },
  { name: 'Test Gen (custom)', value: 91.2, badge: 'domain' },
  { name: 'Docstring quality', value: '4.2/5.0', badge: 'human eval' },
];

export const COMPARISON_MODELS = [
  { model: 'CodeSage v1.0', humaneval: '79.7%', params: '8B', license: 'Llama community', highlight: true },
  { model: 'Llama 3.3 8B base', humaneval: '72.6%', params: '8B', license: 'Llama community', highlight: false },
  { model: 'DeepSeek-Coder 7B', humaneval: '73.8%', params: '7B', license: 'Custom', highlight: false },
  { model: 'CodeLlama 7B', humaneval: '33.5%', params: '7B', license: 'Llama 2 community', highlight: false },
  { model: 'StarCoder2-7B', humaneval: '35.5%', params: '7B', license: 'BigCode OpenRAIL-M', highlight: false },
];

export const LOSS_CURVE_DATA = {
  labels: Array.from({ length: 44 }, (_, i) => (i + 1) * 100),
  datasets: [
    {
      label: 'v0.1 (r=8, attention-only)',
      data: [1.38, 1.35, 1.31, 1.28, 1.24, 1.21, 1.18, 1.15, 1.12, 1.10, 1.08, 1.05, 1.03, 1.01, 0.99, 0.97, 0.96, 0.95, 0.94, 0.93, 0.92, 0.91, 0.90, 0.90, 0.89, 0.89, 0.88, 0.88, 0.87, 0.87, 0.86, 0.86, 0.85, 0.85, 0.85, 0.84, 0.84, 0.84, 0.83, 0.83, 0.83, 0.83, 0.82, 0.82],
      borderColor: '#9BA3B8',
      backgroundColor: 'rgba(155, 163, 184, 0.1)',
    },
    {
      label: 'v0.2 (r=16, attention-only)',
      data: [1.38, 1.33, 1.28, 1.23, 1.18, 1.14, 1.10, 1.06, 1.03, 1.00, 0.97, 0.94, 0.92, 0.90, 0.88, 0.86, 0.84, 0.83, 0.82, 0.81, 0.80, 0.79, 0.78, 0.78, 0.77, 0.77, 0.76, 0.76, 0.75, 0.75, 0.74, 0.74, 0.74, 0.73, 0.73, 0.73, 0.72, 0.72, 0.72, 0.71, 0.71, 0.71, 0.71, 0.71],
      borderColor: '#F59E0B',
      backgroundColor: 'rgba(245, 158, 11, 0.1)',
    },
    {
      label: 'v1.0 (r=16, all-linear, DoRA)',
      data: [1.38, 1.31, 1.24, 1.17, 1.11, 1.05, 1.00, 0.95, 0.91, 0.87, 0.84, 0.81, 0.78, 0.76, 0.74, 0.72, 0.70, 0.69, 0.68, 0.67, 0.66, 0.66, 0.65, 0.65, 0.64, 0.64, 0.64, 0.63, 0.63, 0.63, 0.63, 0.63, 0.62, 0.62, 0.62, 0.62, 0.62, 0.62, 0.62, 0.62, 0.62, 0.62, 0.62, 0.62],
      borderColor: '#3B82F6',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
    },
  ],
};
