class Solution {
    /* public int maxSubArray(int[] nums) {
        int max = Integer.MIN_VALUE;
        for (int i = 0; i< nums.length; i++) {
            int localMax = 0;
            for (int j = i; j < nums.length; j++) {
                localMax += nums[j];
                max = Math.max(max, localMax);
            }
        }
        return max;
    } */
    
    // This is Kaden's Algorithm
    public int maxSubArray(int[] nums) {
        int max = nums[0];
        int localMax = nums[0];
        for (int i = 1; i < nums.length; i++) {
            localMax = Math.max(nums[i], nums[i] + localMax);
            max = Math.max(localMax, max);
        }
        return max;
    }
    
}
