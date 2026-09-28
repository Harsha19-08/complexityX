import type { Language } from "./types";

export interface Sample {
  id: string;
  buttonLabel: string;
  title: string;
  language: Language;
  code: string;
}

export const SAMPLES: Sample[] = [
  {
    id: "max-subarray",
    buttonLabel: "Maximum Subarray",
    title: "Maximum Subarray",
    language: "java",
    code: `class Solution {
    public int maxSubArray(int[] nums) {
        int max = nums[0];
        int current = nums[0];

        for (int i = 1; i < nums.length; i++) {
            current = Math.max(nums[i], current + nums[i]);
            max = Math.max(max, current);
        }

        return max;
    }
}`,
  },
  {
    id: "two-sum",
    buttonLabel: "Analyze Two Sum",
    title: "Two Sum",
    language: "java",
    code: `class Solution {
    public int[] twoSum(int[] nums, int target) {
        for (int i = 0; i < nums.length; i++) {
            for (int j = i + 1; j < nums.length; j++) {
                if (nums[i] + nums[j] == target) {
                    return new int[] { i, j };
                }
            }
        }
        return new int[] {};
    }
}`,
  },
  {
    id: "binary-search",
    buttonLabel: "Analyze Binary Search",
    title: "Binary Search",
    language: "java",
    code: `class Solution {
    public int search(int[] nums, int target) {
        int lo = 0, hi = nums.length - 1;

        while (lo <= hi) {
            int mid = lo + (hi - lo) / 2;
            if (nums[mid] == target) return mid;
            if (nums[mid] < target) lo = mid + 1;
            else hi = mid - 1;
        }

        return -1;
    }
}`,
  },
  {
    id: "longest-subarray",
    buttonLabel: "Analyze Longest Subarray",
    title: "Longest Subarray With Sum K",
    language: "java",
    code: `class Solution {
    public int longestSubarray(int[] nums, int k) {
        int best = 0;

        for (int i = 0; i < nums.length; i++) {
            int sum = 0;
            for (int j = i; j < nums.length; j++) {
                sum += nums[j];
                if (sum == k) {
                    best = Math.max(best, j - i + 1);
                }
            }
        }

        return best;
    }
}`,
  },
];

export const DEFAULT_EXAMPLE = SAMPLES[0];
export const EXAMPLE_BUTTONS = SAMPLES.slice(1);
