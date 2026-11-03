class Solution {
    public int maxSubArray(int[] nums) {
        int max = Integer.MIN_VALUE;
        for (int i = 0; i< nums.length; i++) {
            int localMax = 0;
            for (int j = i; j < nums.length; j++) {
                localMax += nums[j];
                max = Math.max(max, localMax);
            }
        }
        return max;
    }
}
