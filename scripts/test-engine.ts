import { analyzeHeuristic } from "../lib/heuristic";
import { CURATED, matchCurated } from "../lib/curated";
import { SAMPLES } from "../lib/samples";
import { parseComplexity, prettyComplexity } from "../lib/complexity";
import { extractJson } from "../lib/analyzer";
import type { Language } from "../lib/types";

let fail = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`}`);
};

// complexity parsing
for (const [raw, id] of [["O(n²)", "n2"], ["O(n^2)", "n2"], ["O(n log n)", "nlogn"], ["O(log n)", "logn"], ["O(1)", "1"], ["O(2^n)", "2n"], ["O(2ⁿ)", "2n"], ["O(n!)", "nfact"], ["O(V + E)", "n"], ["O(n·m)", "n2"], ["O(n)", "n"], ["O(√n)", "sqrtn"], ["O(n * log n)", "nlogn"], ["O(log^2 n)", "logn"]] as const)
  eq(`parse ${raw}`, parseComplexity(raw).id, id);
eq("pretty", prettyComplexity("O(n^2)"), "O(n²)");

// json extraction
eq("extract fenced", (extractJson('Here:\n```json\n{"a":1,}\n```') as { a: number }).a, 1);
eq("extract braces in strings", (extractJson('{"a":"}{","b":2} trailing') as { b: number }).b, 2);

const run = (name: string, lang: Language, code: string, wantTime: string, wantSpace?: string) => {
  const a = analyzeHeuristic({ language: lang, code, problemTitle: name });
  eq(`${name} time`, a.timeComplexity.value, wantTime);
  if (wantSpace) eq(`${name} space`, a.spaceComplexity.value, wantSpace);
  return a;
};

// curated samples: heuristic should independently agree with hand analysis
for (const s of SAMPLES) {
  const c = CURATED[s.id];
  const h = analyzeHeuristic({ language: s.language, code: s.code });
  eq(`heuristic agrees with curated time: ${s.id}`, h.timeComplexity.value, c.timeComplexity.value);
  eq(`heuristic agrees with curated space: ${s.id}`, h.spaceComplexity.value, c.spaceComplexity.value);
  eq(`curated match: ${s.id}`, matchCurated(s.code.replace(/\n/g, "\n  "), s.language)?.sampleId, s.id);
}

// amortized sliding window — must be O(n), not O(n²)
run("sliding window", "java", `class S {
  int f(int[] a, int k) {
    int left = 0, sum = 0, best = 0;
    for (int right = 0; right < a.length; right++) {
      sum += a[right];
      while (sum > k) {
        sum -= a[left++];
      }
      best = Math.max(best, right - left + 1);
    }
    return best;
  }
}`, "O(n)", "O(1)");

// spec example: shared pointer j
run("spec amortized j", "java", `class S { void f(int n) {
  int j = 0;
  for (int i = 0; i < n; i++) {
    while (j < n) {
      j++;
    }
  }
}}`, "O(n)");

// spec example: triangular nested loop
run("triangular", "java", `class S { void f(int n) {
  for (int i = 0; i < n; i++)
    for (int j = i; j < n; j++)
      System.out.println(i + j);
}}`, "O(n^2)".replace("^2", "²"));

// reset pointer -> multiplicative
run("reset pointer", "java", `class S { void f(int n) {
  for (int i = 0; i < n; i++) {
    int j = 0;
    while (j < n) {
      j++;
    }
  }
}}`, "O(n²)");

// monotonic stack
run("daily temperatures", "java", `class Solution {
  public int[] dailyTemperatures(int[] t) {
    int n = t.length;
    int[] res = new int[n];
    Deque<Integer> st = new ArrayDeque<>();
    for (int i = 0; i < n; i++) {
      while (!st.isEmpty() && t[st.peek()] < t[i]) {
        int j = st.pop();
        res[j] = i - j;
      }
      st.push(i);
    }
    return res;
  }
}`, "O(n)", "O(n)");

// brute-force next warmer
run("daily temperatures brute", "java", `class Solution {
  public int[] dailyTemperatures(int[] t) {
    int[] res = new int[t.length];
    for (int i = 0; i < t.length; i++) {
      for (int j = i + 1; j < t.length; j++) {
        if (t[j] > t[i]) { res[i] = j - i; break; }
      }
    }
    return res;
  }
}`, "O(n²)");

// fib
const fib = run("fib", "java", `class S {
  int fib(int n) {
    if (n <= 1) return n;
    return fib(n - 1) + fib(n - 2);
  }
}`, "O(2ⁿ)", "O(n)");
eq("fib suggests memoization", fib.patterns.some((p) => p.name === "Memoization"), true);

// memoized fib
run("fib memo", "java", `class S {
  int[] memo = new int[100];
  int fib(int n) {
    if (n <= 1) return n;
    if (memo[n] != 0) return memo[n];
    return memo[n] = fib(n - 1) + fib(n - 2);
  }
}`, "O(n)");

// merge sort
run("merge sort", "java", `class S {
  void sort(int[] a, int lo, int hi) {
    if (lo >= hi) return;
    int mid = (lo + hi) / 2;
    sort(a, lo, mid);
    sort(a, mid + 1, hi);
    for (int i = lo; i <= hi; i++) { a[i] = a[i]; }
  }
}`, "O(n log n)");

// sort call
run("sort + scan", "java", `class S {
  int f(int[] a) {
    Arrays.sort(a);
    int c = 0;
    for (int i = 1; i < a.length; i++) if (a[i] == a[i-1]) c++;
    return c;
  }
}`, "O(n log n)", "O(log n)");

// python two-pointer
run("python nested", "python", `def f(nums):
    n = len(nums)
    for i in range(n):
        for j in range(i + 1, n):
            if nums[i] + nums[j] == 0:
                return True
    return False
`, "O(n²)", "O(1)");

// python amortized
run("python window", "python", `def f(a, k):
    left = 0
    s = 0
    for right in range(len(a)):
        s += a[right]
        while s > k:
            s -= a[left]
            left += 1
    return left
`, "O(n)");

// js with list contains-ish
run("js indexOf", "javascript", `function dedupe(arr) {
  const out = [];
  for (const x of arr) {
    if (out.indexOf(x) === -1) out.push(x);
  }
  return out;
}`, "O(n²)", "O(n)");

// dfs
run("dfs", "java", `class S {
  void dfs(int u, List<List<Integer>> adj, boolean[] visited) {
    visited[u] = true;
    for (int v : adj.get(u)) {
      if (!visited[v]) dfs(v, adj, visited);
    }
  }
}`, "O(V + E)");

// c++ nested
run("cpp nested", "cpp", `class Solution {
public:
    int f(vector<int>& a) {
        int c = 0;
        for (int i = 0; i < a.size(); i++)
            for (int j = 0; j < a.size(); j++)
                if (a[i] < a[j]) c++;
        return c;
    }
};`, "O(n²)", "O(1)");

// constant loop
run("const loop", "java", `class S { int f(int[] a) {
  int[] cnt = new int[26];
  for (int i = 0; i < a.length; i++) {
    for (int c = 0; c < 26; c++) cnt[c] += a[i];
  }
  return cnt[0];
}}`, "O(n)", "O(1)");

// comment/string masking
run("masking", "java", `class S { int f(int[] a) {
  // for (int i...) while (true)
  String s = "for (int j = 0; j < n; j++) { for (;;) }";
  return a[0];
}}`, "O(1)");

console.log(fail ? `\n${fail} FAILED` : "\nall passed");
process.exit(fail ? 1 : 0);
