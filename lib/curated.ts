/**
 * Hand-written, reviewed analyses for the built-in examples. They are returned instantly (no AI call)
 * when the submitted code matches a sample exactly, and they seed the History page.
 */
import { AnalysisSchema, finalizeAnalysis, type Analysis } from "./schema";
import { SAMPLES } from "./samples";
import { normalizeCode } from "./utils";
import type { Language } from "./types";

const raw: Record<string, unknown> = {
  "max-subarray": {
    summary:
      "Finds the largest sum of any contiguous subarray using Kadane's algorithm: at each index it decides whether to extend the running subarray or start fresh at the current element.",
    timeComplexity: {
      value: "O(n)",
      explanation: "One pass over the array; each iteration does a constant amount of work (two Math.max calls and an addition).",
      best: "O(n)", average: "O(n)", worst: "O(n)",
    },
    spaceComplexity: {
      value: "O(1)",
      explanation: "Only two integer variables (current, max) are kept, regardless of input size.",
      inputSpace: "O(n)", auxiliarySpace: "O(1)", stackSpace: "O(1)",
      breakdown: [
        { label: "current", value: "O(1)", explanation: "Best subarray sum ending at index i." },
        { label: "max", value: "O(1)", explanation: "Best sum seen so far." },
      ],
    },
    confidence: { level: "high", reason: "A single loop with a bound of nums.length and only constant-time operations inside." },
    assumptions: ["n = nums.length", "nums is non-empty (nums[0] is read unconditionally)"],
    hotspots: [
      { startLine: 6, endLine: 8, cost: "O(n)", label: "Single linear pass", explanation: "The loop runs n − 1 times and each iteration is O(1), so total work grows linearly with n.", snippet: "" },
    ],
    patterns: [
      { name: "Kadane's Algorithm", status: "detected", why: "current = max(nums[i], current + nums[i]) is the classic 'extend or restart' recurrence." },
      { name: "Dynamic Programming", status: "detected", why: "dp[i] (best sum ending at i) only depends on dp[i-1], so the table collapses into one variable." },
    ],
    optimization: {
      canImprove: false,
      optimalityKind: "provably_optimal",
      optimalityNote:
        "Every element can change the answer, so any correct algorithm must read all n elements: Ω(n) time. O(1) extra space is the minimum possible. This solution matches both bounds.",
      targetTime: "O(n)", targetSpace: "O(1)",
      assumptions: [],
      approaches: [
        { name: "Brute Force (all subarrays)", time: "O(n²)", space: "O(1)", isCurrent: false,
          whenToUse: "Tiny inputs or as a correctness oracle when testing a faster solution.",
          whyItWorks: "Tries every start and end index and keeps a running sum for each start.",
          tradeoffs: "Simple but quadratic — too slow beyond roughly 10⁴ elements." },
        { name: "Kadane's Algorithm (your solution)", time: "O(n)", space: "O(1)", isCurrent: true,
          whenToUse: "The default choice for maximum contiguous sum, including all-negative arrays.",
          whyItWorks: "The best subarray ending at i either extends the best one ending at i−1 or starts at i.",
          tradeoffs: "Returns the sum only; recovering the subarray indices needs two extra variables." },
        { name: "Divide and Conquer", time: "O(n log n)", space: "O(log n)", isCurrent: false,
          whenToUse: "Useful for learning recurrences, or when the array is split across workers and partial results must be merged.",
          whyItWorks: "The best subarray lies fully left, fully right, or crosses the midpoint; combine the three.",
          tradeoffs: "Asymptotically slower than Kadane and needs recursion stack." },
      ],
      learningPath: ["Brute Force", "Prefix sums (min prefix so far)", "Kadane's Algorithm"],
      thinkingSteps: [
        { title: "Define the subproblem", detail: "Let best[i] be the maximum sum of a subarray that ends exactly at index i." },
        { title: "Find the transition", detail: "A subarray ending at i either is just nums[i], or extends the best one ending at i−1: best[i] = max(nums[i], best[i−1] + nums[i])." },
        { title: "Notice the table is unnecessary", detail: "best[i] only reads best[i−1], so one variable replaces the whole array." },
        { title: "Track the global answer", detail: "The overall answer is the maximum of best[i] over all i." },
        { title: "Result", detail: "Quadratic enumeration collapses to one pass: O(n²) → O(n) time and O(n) → O(1) space." },
      ],
      hints: [
        "Every element must be examined at least once — could any algorithm skip elements and still be correct?",
        "Ask: what is the best subarray that ENDS at index i, and how does it relate to the one ending at i−1?",
        "Your solution is Kadane's algorithm. Try to argue why O(n) time and O(1) space cannot be beaten.",
      ],
      whyFaster:
        "Nothing needs to change: instead of re-summing many overlapping subarrays, the solution carries the best 'ending here' sum forward, so each element is processed exactly once.",
    },
    optimizedCode: "",
    codeExplanation: [],
    comparison: {
      optimizedTime: "O(n)", optimizedSpace: "O(1)",
      tradeoff: "Already at the lower bound for both time and space — there is no time/space trade-off left to make.",
    },
    edgeCases: [
      { title: "All negative numbers", detail: "The answer is the largest single element. Initialising max to 0 instead of nums[0] would wrongly return 0 — your code handles this correctly." },
      { title: "Empty array", detail: "nums[0] throws ArrayIndexOutOfBoundsException. Add a guard if the problem does not promise n ≥ 1." },
      { title: "Integer overflow", detail: "Long inputs can overflow int sums; use long for current and max when values or n are large." },
    ],
  },

  "two-sum": {
    summary:
      "Finds two indices whose values add up to target by checking every pair (i, j) with j > i and returning the first match.",
    timeComplexity: {
      value: "O(n²)",
      explanation: "Nested loops examine n(n−1)/2 pairs in the worst case; the inner loop starts at i+1 but still scales with n.",
      best: "O(1)", average: "O(n²)", worst: "O(n²)",
    },
    spaceComplexity: {
      value: "O(1)",
      explanation: "Only loop counters are used; the returned 2-element array is constant size.",
      inputSpace: "O(n)", auxiliarySpace: "O(1)", stackSpace: "O(1)",
      breakdown: [
        { label: "i, j", value: "O(1)", explanation: "Two loop indices." },
        { label: "new int[]{i, j}", value: "O(1)", explanation: "Fixed-size result." },
      ],
    },
    confidence: { level: "high", reason: "Both loop bounds are directly nums.length and the body is constant time." },
    assumptions: ["n = nums.length", "Best case O(1) occurs if the first pair matches"],
    hotspots: [
      { startLine: 3, endLine: 4, cost: "O(n²)", label: "Nested loops over all pairs", explanation: "For each i the inner loop scans the remaining elements: (n−1) + (n−2) + … + 1 = n(n−1)/2 comparisons.", snippet: "" },
      { startLine: 5, endLine: 5, cost: "O(1)", label: "Pair check", explanation: "Each pair is tested from scratch — the 'complement' of nums[i] is searched for by brute force.", snippet: "" },
    ],
    patterns: [
      { name: "HashMap / Frequency Map", status: "suggested", why: "For every nums[i] you scan the array to find target − nums[i]. A hash map answers 'have I seen this value?' in O(1) average." },
      { name: "Two Pointers", status: "suggested", why: "If you only need the values (or can sort while remembering indices), sorting then moving two pointers inward also avoids the pair scan." },
    ],
    optimization: {
      canImprove: true,
      optimalityKind: "assumption_dependent",
      optimalityNote:
        "O(n) time is optimal for an unsorted array because every element may be part of the answer (Ω(n) to read the input). The O(n) HashMap solution relies on average-case O(1) hashing; worst-case hash collisions can degrade it. O(1) extra space at O(n) time is only achievable if the input is already sorted (two pointers).",
      targetTime: "O(n)", targetSpace: "O(n)",
      assumptions: ["Hash operations are O(1) on average", "Input is unsorted and original indices must be returned"],
      approaches: [
        { name: "Brute Force (your solution)", time: "O(n²)", space: "O(1)", isCurrent: true,
          whenToUse: "Very small n, or when memory is extremely constrained.",
          whyItWorks: "Checks every possible pair, so it cannot miss the answer.",
          tradeoffs: "No extra memory, but time explodes: 10⁵ elements ≈ 5 × 10⁹ pair checks." },
        { name: "Sort + Two Pointers", time: "O(n log n)", space: "O(n)", isCurrent: false,
          whenToUse: "Input already sorted (then O(n) time, O(1) space), or you only need values rather than indices.",
          whyItWorks: "In sorted order, if the sum is too small move the left pointer up; if too large move the right pointer down.",
          tradeoffs: "Sorting destroys original indices — you must store (value, index) pairs, costing O(n) memory." },
        { name: "HashMap (one pass)", time: "O(n)", space: "O(n)", isCurrent: false,
          whenToUse: "Unsorted input where original indices are required — the standard solution.",
          whyItWorks: "For each element, look up target − nums[i] among previously seen values, then record nums[i].",
          tradeoffs: "Trades O(n) memory for time; average-case hashing assumption; more constant-factor overhead than arrays." },
      ],
      learningPath: ["Brute Force", "Sort + Two Pointers", "HashMap (one pass)"],
      thinkingSteps: [
        { title: "Identify repeated work", detail: "For each nums[i] the inner loop searches the array for target − nums[i]. That search is repeated n times." },
        { title: "Name what you are searching for", detail: "The partner value is fully determined: need = target − nums[i]. You do not need to test every j." },
        { title: "Store what you have already seen", detail: "Keep a map from value → index for elements visited so far." },
        { title: "Replace the inner loop with a lookup", detail: "The O(n) scan becomes a single map.get(need) — O(1) on average." },
        { title: "Result", detail: "n × O(n) becomes n × O(1): O(n²) → O(n) time, paid for with O(n) extra space." },
      ],
      hints: [
        "Look for repeated work: what exactly does the inner loop search for, and how many times is that search repeated?",
        "The partner of nums[i] is completely determined by target. Could you remember values you have already seen instead of rescanning?",
        "Think HashMap: store value → index as you go, and look up target − nums[i] before inserting.",
      ],
      whyFaster:
        "Instead of scanning the previous elements for every index, the HashMap stores values seen so far, so finding the complement is an average-constant-time lookup. Each element is touched once, and the extra memory is the map (up to n entries).",
    },
    optimizedCode: `class Solution {
    public int[] twoSum(int[] nums, int target) {
        Map<Integer, Integer> seen = new HashMap<>(); // value -> index

        for (int i = 0; i < nums.length; i++) {
            int need = target - nums[i];
            Integer j = seen.get(need);
            if (j != null) return new int[] { j, i };
            seen.put(nums[i], i); // insert AFTER lookup so an element can't pair with itself
        }
        return new int[] {};
    }
}`,
    codeExplanation: [
      "seen maps each value we've passed to its index.",
      "For nums[i], the only partner that works is need = target − nums[i].",
      "If need is already in the map, we've found the pair (earlier index j, current index i).",
      "Otherwise record nums[i]. Inserting after the lookup prevents pairing an element with itself.",
    ],
    comparison: {
      optimizedTime: "O(n)", optimizedSpace: "O(n)",
      tradeoff: "Time drops from quadratic to linear by spending O(n) memory on the map. If memory is the hard constraint and the array is sorted, two pointers reach O(n) time with O(1) space.",
    },
    edgeCases: [
      { title: "Duplicate values", detail: "[3, 3] with target 6 must work. Looking up before inserting handles it; inserting first would pair an element with itself." },
      { title: "Negative numbers", detail: "The complement can be negative or zero; the hash approach is unaffected (unlike some sliding-window ideas)." },
      { title: "Integer overflow", detail: "target − nums[i] can overflow int for extreme inputs; use long if constraints allow values near Integer.MAX_VALUE." },
      { title: "No valid pair", detail: "The fallback return of an empty array must be handled by the caller." },
    ],
  },

  "binary-search": {
    summary:
      "Iterative binary search: repeatedly compares the middle element of a sorted array with the target and discards the half that cannot contain it.",
    timeComplexity: {
      value: "O(log n)",
      explanation: "Each iteration halves the search range [lo, hi], so at most ⌊log₂ n⌋ + 1 iterations run.",
      best: "O(1)", average: "O(log n)", worst: "O(log n)",
    },
    spaceComplexity: {
      value: "O(1)",
      explanation: "Three integers (lo, hi, mid); iterative, so there is no recursion stack.",
      inputSpace: "O(n)", auxiliarySpace: "O(1)", stackSpace: "O(1)",
      breakdown: [
        { label: "lo, hi, mid", value: "O(1)", explanation: "Range boundaries and midpoint." },
      ],
    },
    confidence: { level: "high", reason: "The loop variable range halves on every path through the body; there are no other loops or calls." },
    assumptions: ["nums is sorted in ascending order", "n = nums.length"],
    hotspots: [
      { startLine: 5, endLine: 9, cost: "O(log n)", label: "Range halving loop", explanation: "Every branch sets lo = mid + 1 or hi = mid − 1, so the interval shrinks by at least half each iteration.", snippet: "" },
    ],
    patterns: [
      { name: "Binary Search", status: "detected", why: "Sorted input + a mid computed from lo/hi + discarding half the range each step." },
    ],
    optimization: {
      canImprove: false,
      optimalityKind: "provably_optimal",
      optimalityNote:
        "For searching a sorted array using only comparisons, Ω(log n) comparisons are required (an information-theoretic bound: n+1 possible outcomes need at least log₂(n+1) binary decisions). This solution meets it. Faster lookups (O(1) average) require a different structure such as a hash table, which does not preserve order and costs O(n) memory.",
      targetTime: "O(log n)", targetSpace: "O(1)",
      assumptions: ["Comparison-based search on a sorted array"],
      approaches: [
        { name: "Linear Scan", time: "O(n)", space: "O(1)", isCurrent: false,
          whenToUse: "Unsorted or very small arrays where sorting isn't worth it.",
          whyItWorks: "Checks each element in turn.",
          tradeoffs: "Doesn't use the sorted order at all." },
        { name: "Binary Search (your solution)", time: "O(log n)", space: "O(1)", isCurrent: true,
          whenToUse: "Sorted, random-access data (arrays).",
          whyItWorks: "Sorted order lets one comparison rule out half the remaining candidates.",
          tradeoffs: "Requires sorted input; useless on linked lists (no O(1) mid access)." },
        { name: "HashSet / HashMap lookup", time: "O(1)", space: "O(n)", isCurrent: false,
          whenToUse: "Many repeated membership queries on static data where extra memory is fine.",
          whyItWorks: "Hashing jumps directly to the bucket that would hold the key.",
          tradeoffs: "O(n) memory, average-case only, no ordering (no floor/ceiling queries), O(n) build cost." },
      ],
      learningPath: ["Linear Scan", "Binary Search", "Binary Search on Answer"],
      thinkingSteps: [
        { title: "Exploit structure", detail: "Sortedness means a comparison at mid tells you which side the target can be on." },
        { title: "Shrink the range", detail: "Set lo = mid + 1 or hi = mid − 1 so mid is excluded and the loop always progresses." },
        { title: "Avoid overflow", detail: "mid = lo + (hi − lo) / 2 avoids the classic (lo + hi) overflow bug." },
        { title: "Result", detail: "Halving n repeatedly yields O(log n) iterations with O(1) space." },
      ],
      hints: [
        "Could any comparison-based algorithm search a sorted array with fewer than log₂ n comparisons? Think about how many outcomes exist.",
        "The mid computation already avoids overflow — why does lo + (hi − lo) / 2 matter for large arrays?",
        "Consider generalising: 'Binary Search on Answer' uses the same loop on a monotonic predicate instead of an array.",
      ],
      whyFaster: "Nothing to change — the range is halved each iteration, which is already the theoretical minimum for comparison-based search.",
    },
    optimizedCode: "",
    codeExplanation: [],
    comparison: {
      optimizedTime: "O(log n)", optimizedSpace: "O(1)",
      tradeoff: "At the comparison-search lower bound. Only a different data structure (hash table) can do better on average, by paying O(n) memory and giving up ordering.",
    },
    edgeCases: [
      { title: "Empty array", detail: "hi = −1 so the loop never runs and −1 is returned — handled correctly." },
      { title: "Overflow in mid", detail: "Your mid = lo + (hi − lo) / 2 is the overflow-safe form; (lo + hi) / 2 can overflow int for huge arrays." },
      { title: "Duplicates", detail: "Any matching index may be returned. If you need the first/last occurrence, keep searching instead of returning immediately." },
      { title: "Unsorted input", detail: "The algorithm silently returns wrong answers if the precondition (sorted) is violated." },
    ],
  },

  "longest-subarray": {
    summary:
      "Finds the length of the longest contiguous subarray whose sum equals k by starting a fresh running sum at every index i and extending it through every j ≥ i.",
    timeComplexity: {
      value: "O(n²)",
      explanation: "The inner loop starts at i and runs to n, so total iterations are n + (n−1) + … + 1 = n(n+1)/2. Each does O(1) work.",
      best: "O(n²)", average: "O(n²)", worst: "O(n²)",
    },
    spaceComplexity: {
      value: "O(1)",
      explanation: "Only best, sum, i and j are stored.",
      inputSpace: "O(n)", auxiliarySpace: "O(1)", stackSpace: "O(1)",
      breakdown: [
        { label: "best", value: "O(1)", explanation: "Longest length found so far." },
        { label: "sum", value: "O(1)", explanation: "Running sum for the current start index." },
      ],
    },
    confidence: { level: "high", reason: "Both loops are bounded by nums.length and the inner start depends on i, giving a triangular iteration count." },
    assumptions: ["n = nums.length", "nums may contain negative values (no ordering assumption)"],
    hotspots: [
      { startLine: 5, endLine: 8, cost: "O(n²)", label: "Restarting the running sum for every i", explanation: "sum resets to 0 for each start index and re-adds elements that the previous start already added — the same partial sums are recomputed over and over.", snippet: "" },
    ],
    patterns: [
      { name: "Prefix Sum", status: "suggested", why: "sum(i..j) = prefix[j+1] − prefix[i]. Your inner loop recomputes range sums that prefix sums provide in O(1)." },
      { name: "HashMap / Frequency Map", status: "suggested", why: "We want the earliest index where prefix == currentPrefix − k. Storing first occurrences of each prefix turns that search into a lookup." },
      { name: "Sliding Window", status: "suggested", why: "Only valid if all numbers are non-negative (then the window sum is monotonic). With negatives it fails — that's why prefix + HashMap is the general answer." },
    ],
    optimization: {
      canImprove: true,
      optimalityKind: "assumption_dependent",
      optimalityNote:
        "O(n) time is optimal because every element can affect the answer (Ω(n)). The O(n)-time solution for arbitrary integers needs O(n) space (hash of prefix sums) and assumes O(1) average hash operations. If all values are non-negative, a sliding window achieves O(n) time with O(1) space.",
      targetTime: "O(n)", targetSpace: "O(n)",
      assumptions: ["Hash operations are O(1) on average", "Values may be negative (general case)", "With only non-negative values, O(1) space is possible via sliding window"],
      approaches: [
        { name: "Brute Force (your solution)", time: "O(n²)", space: "O(1)", isCurrent: true,
          whenToUse: "Small n, or to validate a faster solution.",
          whyItWorks: "Enumerates every subarray with a running sum, so nothing is missed.",
          tradeoffs: "Constant memory but quadratic time; 10⁵ elements ≈ 5 × 10⁹ steps." },
        { name: "Prefix Sum + HashMap", time: "O(n)", space: "O(n)", isCurrent: false,
          whenToUse: "General case: arrays that may contain negatives or zeros.",
          whyItWorks: "A subarray (j, i] sums to k iff prefix[i] − prefix[j] = k. Store the FIRST index of each prefix so the subarray is as long as possible.",
          tradeoffs: "O(n) map memory and average-case hashing; watch for int overflow in prefix sums." },
        { name: "Sliding Window", time: "O(n)", space: "O(1)", isCurrent: false,
          whenToUse: "ONLY when all elements are non-negative (or strictly positive).",
          whyItWorks: "With non-negative values the window sum only grows when expanding and only shrinks when contracting, so two pointers never need to backtrack.",
          tradeoffs: "Fails with negative numbers — extending the window can decrease the sum, breaking the monotonic argument." },
      ],
      learningPath: ["Brute Force", "Prefix Sum", "Prefix Sum + HashMap", "Sliding Window (non-negative case)"],
      thinkingSteps: [
        { title: "Identify repeated work", detail: "Starting a new sum at each i re-adds the same elements many times." },
        { title: "Express a range sum as a difference", detail: "sum(j+1..i) = prefix[i] − prefix[j], so two prefix values describe any subarray." },
        { title: "Turn the condition into a lookup", detail: "We need prefix[j] = prefix[i] − k. Given i, the target prefix is known." },
        { title: "Store previously computed information", detail: "Keep a map prefix → earliest index. Earliest index gives the longest subarray." },
        { title: "Result", detail: "The inner loop becomes a map lookup: O(n²) → O(n) time, O(1) → O(n) space." },
      ],
      hints: [
        "Look for repeated work: how many times is the same partial sum recomputed by different starting indices?",
        "Can a range sum be written using two 'running total' values? What does prefix[i] − prefix[j] equal?",
        "Think Prefix Sum + HashMap: store the first index of each prefix value and look up (current prefix − k).",
      ],
      whyFaster:
        "Instead of restarting a running sum at every index, one running prefix sum is kept. A HashMap remembers the earliest index of every prefix value, so 'is there a start such that the subarray sums to k?' becomes one average-constant-time lookup. The cost is up to n stored prefix values.",
    },
    optimizedCode: `class Solution {
    public int longestSubarray(int[] nums, int k) {
        Map<Long, Integer> firstIndex = new HashMap<>();
        firstIndex.put(0L, -1); // empty prefix ends before index 0
        long prefix = 0;
        int best = 0;

        for (int i = 0; i < nums.length; i++) {
            prefix += nums[i];

            Integer j = firstIndex.get(prefix - k);
            if (j != null) best = Math.max(best, i - j);

            // keep the EARLIEST index so the subarray is as long as possible
            firstIndex.putIfAbsent(prefix, i);
        }
        return best;
    }
}`,
    codeExplanation: [
      "prefix is the running sum of nums[0..i]; firstIndex stores where each prefix value first appeared.",
      "Seeding (0 → −1) lets subarrays that start at index 0 be found.",
      "A subarray ending at i sums to k exactly when an earlier prefix equals prefix − k; its length is i − j.",
      "putIfAbsent keeps the earliest index, which maximises length. Prefix uses long to avoid overflow.",
    ],
    comparison: {
      optimizedTime: "O(n)", optimizedSpace: "O(n)",
      tradeoff: "We reduce time complexity by using additional memory: up to n prefix sums are stored. If every value is non-negative, a sliding window gets the same O(n) time using O(1) space.",
    },
    edgeCases: [
      { title: "Negative numbers and zeros", detail: "Sliding window breaks with negatives; the prefix + HashMap solution stays correct." },
      { title: "Subarray starting at index 0", detail: "Requires seeding the map with prefix 0 at index −1." },
      { title: "Integer overflow", detail: "Prefix sums can exceed int range — use long as in the optimized code." },
      { title: "Duplicate prefix values", detail: "Zeros or cancelling values repeat prefixes; storing only the first index is what yields the longest subarray." },
      { title: "No valid subarray", detail: "best stays 0 — confirm 0 is the intended 'not found' answer." },
    ],
  },
};

export const CURATED: Record<string, Analysis> = {};
for (const s of SAMPLES) {
  const parsed = AnalysisSchema.safeParse(raw[s.id]);
  if (!parsed.success) {
    // Fail loudly in development — a curated example must always validate.
    throw new Error(`Curated analysis "${s.id}" failed validation: ${parsed.error.message}`);
  }
  CURATED[s.id] = finalizeAnalysis(parsed.data, s.code);
}

export function matchCurated(code: string, language: Language): { sampleId: string; analysis: Analysis } | null {
  const n = normalizeCode(code);
  for (const s of SAMPLES) {
    if (s.language === language && normalizeCode(s.code) === n) return { sampleId: s.id, analysis: CURATED[s.id] };
  }
  return null;
}
