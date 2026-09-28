export interface PatternDoc {
  slug: string;
  name: string;
  tagline: string;
  what: string;
  recognize: string[];
  clues: string[];
  template: string;
  time: string;
  space: string;
  examples: string[];
  mistakes: string[];
  match: RegExp;
}

export const PATTERNS: PatternDoc[] = [
  {
    slug: "two-pointers", name: "Two Pointers", match: /two.?pointer|sort\s*\+\s*two/i,
    tagline: "Walk two indices through the data so nothing is scanned twice.",
    what: "Keep two indices, usually at opposite ends or moving in the same direction, and move them by rule instead of testing every pair. Each pointer only moves one way, so the total work is linear.",
    recognize: ["Sorted array or string and you need a pair, triple or partition", "In-place removal, dedupe or reordering", "Palindrome or symmetric checks", "Merging two sorted sequences"],
    clues: ["“Find two numbers that…” on sorted input", "Asked for O(1) extra space", "Brute force is a nested loop over i < j"],
    template: `def two_pointers(a, target):
    lo, hi = 0, len(a) - 1
    while lo < hi:
        s = a[lo] + a[hi]
        if s == target:
            return lo, hi
        if s < target:
            lo += 1      # need a bigger sum
        else:
            hi -= 1      # need a smaller sum
    return None`,
    time: "O(n) after sorting", space: "O(1)",
    examples: ["Two Sum II (sorted)", "3Sum", "Container With Most Water", "Remove Duplicates from Sorted Array", "Valid Palindrome"],
    mistakes: ["Using it on unsorted data without sorting first", "Moving both pointers when only one should move", "Off-by-one on lo < hi versus lo <= hi"],
  },
  {
    slug: "sliding-window", name: "Sliding Window", match: /sliding.?window/i,
    tagline: "Grow and shrink a contiguous range while keeping a running summary.",
    what: "Maintain a window [left, right] over a sequence. Extend right to include more, shrink left when a constraint breaks. Every index enters and leaves the window at most once, so the inner while loop is amortized O(1) per step.",
    recognize: ["Longest or shortest contiguous subarray or substring with a property", "Fixed size k windows (max sum, averages)", "Counting distinct elements in a range"],
    clues: ["“Contiguous”, “substring”, “subarray”", "Condition becomes monotone as the window grows (all values non-negative, or a distinct-count limit)", "Nested loop where the inner start never needs to reset"],
    template: `def longest_valid(a):
    left = best = 0
    state = {}                      # counts, running sum, ...
    for right, x in enumerate(a):
        state[x] = state.get(x, 0) + 1
        while violates(state):      # shrink until valid again
            state[a[left]] -= 1
            left += 1
        best = max(best, right - left + 1)
    return best`,
    time: "O(n)", space: "O(1) to O(k)",
    examples: ["Longest Substring Without Repeating Characters", "Minimum Size Subarray Sum", "Maximum Sum Subarray of Size K", "Fruit Into Baskets"],
    mistakes: ["Using it when values can be negative and the sum is not monotone (use prefix sums instead)", "Forgetting to update state when left moves", "Recomputing the window contents from scratch each step"],
  },
  {
    slug: "binary-search", name: "Binary Search", match: /binary.?search|bisect/i,
    tagline: "Halve the search space using a monotone yes/no question.",
    what: "If a predicate flips from false to true exactly once across a range, you can find the flip point in O(log n). It works on sorted arrays and also on answer spaces such as “smallest capacity that works”.",
    recognize: ["Sorted or rotated sorted data", "Minimize the maximum or maximize the minimum", "Find the first index satisfying a condition"],
    clues: ["Target complexity O(log n)", "A feasibility check that is monotone in the answer", "n up to 10⁹ or more"],
    template: `def first_true(lo, hi, ok):
    # smallest x in [lo, hi] with ok(x) True; ok is monotone
    while lo < hi:
        mid = lo + (hi - lo) // 2   # avoids overflow
        if ok(mid):
            hi = mid
        else:
            lo = mid + 1
    return lo`,
    time: "O(log n) × cost of check", space: "O(1)",
    examples: ["Search in Rotated Sorted Array", "Koko Eating Bananas", "Capacity To Ship Packages", "Find First and Last Position"],
    mistakes: ["(lo + hi) / 2 overflow in Java or C++", "Infinite loop from lo = mid when mid == lo", "Applying it when the predicate is not monotone"],
  },
  {
    slug: "prefix-sum", name: "Prefix Sum", match: /prefix/i,
    tagline: "Precompute running totals so any range sum is a subtraction.",
    what: "Let P[i] be the sum of the first i elements. Then sum(l..r) = P[r+1] − P[l]. Combined with a HashMap of earlier prefixes it solves range-sum-equals-k problems even with negative numbers.",
    recognize: ["Many range sum queries", "Subarray with sum k, divisible by k, or balanced counts", "2D region sums"],
    clues: ["Inner loop re-adds a range each time", "Negative numbers rule out sliding window"],
    template: `def count_subarrays(a, k):
    seen = {0: 1}                    # prefix -> how many times
    pref = ans = 0
    for x in a:
        pref += x
        ans += seen.get(pref - k, 0)
        seen[pref] = seen.get(pref, 0) + 1
    return ans`,
    time: "O(n)", space: "O(n)",
    examples: ["Subarray Sum Equals K", "Range Sum Query", "Contiguous Array", "Product of Array Except Self"],
    mistakes: ["Forgetting the empty prefix {0: 1}", "Integer overflow in prefix totals", "Off-by-one between P[r+1] and P[r]"],
  },
  {
    slug: "hashmap", name: "HashMap / Frequency Map", match: /hash|frequency|lookup|membership/i,
    tagline: "Trade memory for O(1) average lookups.",
    what: "Store what you have already seen (values, counts, indices, prefix sums) so a later step can answer “have I seen the complement?” without rescanning.",
    recognize: ["Find a pair or complement", "Count occurrences, group by key", "Detect duplicates", "Repeated membership queries on a list"],
    clues: ["Inner loop only searches for a value", "list.contains or indexOf inside a loop", "Unsorted input where indices matter"],
    template: `def two_sum(a, target):
    seen = {}                        # value -> index
    for i, x in enumerate(a):
        if target - x in seen:
            return seen[target - x], i
        seen[x] = i
    return None`,
    time: "O(n) average", space: "O(n)",
    examples: ["Two Sum", "Group Anagrams", "Contains Duplicate", "Subarray Sum Equals K", "Longest Consecutive Sequence"],
    mistakes: ["Inserting before checking, so an element pairs with itself", "Assuming O(1) worst case; hashing is average-case", "Using floating point or mutable objects as keys"],
  },
  {
    slug: "kadane", name: "Kadane's Algorithm", match: /kadane|max.*subarray/i,
    tagline: "Best subarray ending here is either extend or restart.",
    what: "A tiny dynamic program: the best sum of a subarray ending at i is max(a[i], best_ending_here + a[i]). Track the best over all i. It replaces the O(n²) or O(n³) enumeration of subarrays.",
    recognize: ["Maximum sum contiguous subarray", "Best profit from a single run", "Optimal choice depends only on the previous state"],
    clues: ["Contiguous and sum-maximizing", "Negative numbers present"],
    template: `def max_subarray(a):
    cur = best = a[0]
    for x in a[1:]:
        cur = max(x, cur + x)        # extend or restart
        best = max(best, cur)
    return best`,
    time: "O(n)", space: "O(1)",
    examples: ["Maximum Subarray", "Maximum Product Subarray", "Best Time to Buy and Sell Stock", "Maximum Sum Circular Subarray"],
    mistakes: ["Initializing best to 0, which breaks all-negative arrays", "Not tracking indices when the range is required"],
  },
  {
    slug: "monotonic-stack", name: "Monotonic Stack", match: /monoton|next greater|stack/i,
    tagline: "Keep candidates in order so each element resolves its answer once.",
    what: "Maintain a stack whose values are monotone. When a new element breaks the order, pop and resolve the popped ones. Every element is pushed and popped once, so the total is O(n).",
    recognize: ["Next greater or smaller element", "Span, temperature or histogram problems", "Matching nested structure"],
    clues: ["For each i, look right or left for the first element that is bigger or smaller", "Brute force is an inner loop that scans forward"],
    template: `def next_greater(a):
    res = [-1] * len(a)
    st = []                          # indices, values decreasing
    for i, x in enumerate(a):
        while st and a[st[-1]] < x:
            res[st.pop()] = x
        st.append(i)
    return res`,
    time: "O(n)", space: "O(n)",
    examples: ["Daily Temperatures", "Next Greater Element", "Largest Rectangle in Histogram", "Trapping Rain Water"],
    mistakes: ["Storing values when you need indices", "Wrong comparison direction (strict vs non-strict) with duplicates", "Forgetting to drain the stack at the end when needed"],
  },
  {
    slug: "dynamic-programming", name: "Dynamic Programming", match: /dynamic|memo|tabulation|\bdp\b/i,
    tagline: "Solve each distinct subproblem once and reuse it.",
    what: "When a recursion revisits the same states, cache the answers. Cost is (number of states) × (work per state). Top-down memoization is easiest to write; bottom-up tabulation allows space optimization.",
    recognize: ["Overlapping subproblems", "Optimal substructure", "Count ways, min cost, max value, feasibility"],
    clues: ["Naive recursion is exponential", "State can be described by one to three integers"],
    template: `from functools import lru_cache

def solve(n):
    @lru_cache(None)
    def go(i):
        if i <= 1:
            return i
        return go(i - 1) + go(i - 2)
    return go(n)`,
    time: "O(states × transition)", space: "O(states)",
    examples: ["Climbing Stairs", "House Robber", "Coin Change", "Longest Common Subsequence", "0/1 Knapsack"],
    mistakes: ["State that misses a dimension the answer depends on", "Recursion depth limits in Python or Java", "Keeping the whole table when only the last row is needed"],
  },
  {
    slug: "divide-and-conquer", name: "Divide and Conquer", match: /divide|merge sort|quick/i,
    tagline: "Split, solve halves independently, combine.",
    what: "Break the problem into independent subproblems of the same kind, solve them recursively and merge results. The Master theorem gives the cost: T(n) = a·T(n/b) + f(n).",
    recognize: ["Sorting", "Counting inversions", "Closest pair, maximum crossing subarray", "Tree-shaped recursion with balanced halves"],
    clues: ["Two recursive calls on n/2", "A linear merge step"],
    template: `def merge_sort(a):
    if len(a) <= 1:
        return a
    mid = len(a) // 2
    l, r = merge_sort(a[:mid]), merge_sort(a[mid:])
    out, i, j = [], 0, 0
    while i < len(l) and j < len(r):
        if l[i] <= r[j]:
            out.append(l[i]); i += 1
        else:
            out.append(r[j]); j += 1
    return out + l[i:] + r[j:]`,
    time: "O(n log n) for the classic 2-way split", space: "O(n) plus O(log n) stack",
    examples: ["Merge Sort", "Count of Smaller Numbers After Self", "Kth Largest (quickselect)", "Maximum Subarray (D&C form)"],
    mistakes: ["Slicing copies that hide extra O(n) per level", "Unbalanced splits degrading to O(n²)", "Missing base case"],
  },
  {
    slug: "dfs-bfs", name: "DFS / BFS", match: /dfs|bfs|depth|breadth|graph|traversal/i,
    tagline: "Visit every node and edge once with a visited set.",
    what: "Depth-first uses recursion or a stack; breadth-first uses a queue and finds shortest paths in unweighted graphs. With a visited set each node and edge is processed once: O(V + E).",
    recognize: ["Connected components, flood fill", "Shortest path in unweighted graph or grid", "Cycle detection, topological order"],
    clues: ["Grid or adjacency list input", "“Minimum steps” (BFS)", "Explore all reachable states (DFS)"],
    template: `from collections import deque

def bfs(graph, start):
    seen, q = {start}, deque([start])
    while q:
        u = q.popleft()
        for v in graph[u]:
            if v not in seen:
                seen.add(v)          # mark when enqueued
                q.append(v)
    return seen`,
    time: "O(V + E)", space: "O(V)",
    examples: ["Number of Islands", "Word Ladder", "Course Schedule", "Clone Graph"],
    mistakes: ["Marking visited on dequeue, causing duplicate queue entries", "Deep recursion overflow on large graphs", "Forgetting disconnected components"],
  },
  {
    slug: "backtracking", name: "Backtracking", match: /backtrack|permut|combinat|subset/i,
    tagline: "Build a candidate step by step and undo when it fails.",
    what: "Explore a decision tree: choose, recurse, un-choose. It is exponential by nature, so pruning invalid branches early is what makes it practical.",
    recognize: ["Enumerate subsets, permutations, combinations", "Constraint puzzles (N-Queens, Sudoku)", "Find all valid configurations"],
    clues: ["“Return all…”", "Small n (roughly ≤ 20)", "Choices that can be checked incrementally"],
    template: `def subsets(a):
    res, cur = [], []
    def go(i):
        if i == len(a):
            res.append(cur[:])
            return
        go(i + 1)                    # skip
        cur.append(a[i]); go(i + 1)  # take
        cur.pop()                    # undo
    go(0)
    return res`,
    time: "O(2ⁿ) to O(n!)", space: "O(n) stack",
    examples: ["Subsets", "Permutations", "N-Queens", "Combination Sum", "Sudoku Solver"],
    mistakes: ["Appending the live list instead of a copy", "Forgetting to undo the choice", "No pruning, so it explores hopeless branches"],
  },
  {
    slug: "heap", name: "Heap / Priority Queue", match: /heap|priority|top.?k/i,
    tagline: "Get the smallest or largest item in O(log n).",
    what: "A binary heap keeps the extreme element on top. For top-k problems a heap of size k gives O(n log k), better than sorting everything when k is small.",
    recognize: ["K largest or smallest", "Merge k sorted lists", "Running median, scheduling", "Dijkstra"],
    clues: ["Repeatedly need the current minimum or maximum", "Sorting is overkill because only k items matter"],
    template: `import heapq

def top_k(a, k):
    h = []                           # min-heap of the k largest
    for x in a:
        heapq.heappush(h, x)
        if len(h) > k:
            heapq.heappop(h)
    return sorted(h, reverse=True)`,
    time: "O(n log k)", space: "O(k)",
    examples: ["Kth Largest Element", "Top K Frequent Elements", "Merge k Sorted Lists", "Find Median from Data Stream"],
    mistakes: ["Using a max-heap when a min-heap of size k is the right tool", "Python heapq is min-only; negate values for max", "Heapify is O(n), not O(n log n)"],
  },
  {
    slug: "sorting", name: "Sorting", match: /sort/i,
    tagline: "Pay O(n log n) once to make later steps linear or logarithmic.",
    what: "Sorting exposes structure: equal items become adjacent, pairs can be found with two pointers, intervals can be merged in a single pass. It is often the cheapest way to remove an O(n²) search.",
    recognize: ["Intervals, meeting rooms, merging", "Duplicates or closest pairs", "Greedy choices by order"],
    clues: ["Order of the original input does not matter", "Comparisons between neighbours are enough"],
    template: `def merge_intervals(iv):
    iv.sort(key=lambda p: p[0])
    out = [iv[0]]
    for s, e in iv[1:]:
        if s <= out[-1][1]:
            out[-1][1] = max(out[-1][1], e)
        else:
            out.append([s, e])
    return out`,
    time: "O(n log n)", space: "O(1) to O(n)",
    examples: ["Merge Intervals", "Meeting Rooms II", "3Sum", "Non-overlapping Intervals"],
    mistakes: ["Losing original indices", "Sorting inside a loop", "Assuming sort is stable when the language does not guarantee it"],
  },
];

export const getPattern = (slug: string) => PATTERNS.find((p) => p.slug === slug);

/** Map a free-text pattern name from the analysis to a library page, if any. */
export function patternSlug(name: string): string | null {
  const hit = PATTERNS.find((p) => p.match.test(name));
  return hit ? hit.slug : null;
}
