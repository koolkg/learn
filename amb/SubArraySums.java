public class SubArraySums {


    public static void main(String[] args) {

    }

    /*
    Part 1:
    Given a list of integers and a target k, return true if any contiguous subarray sums to k.
    nums = [3, 1, 4, 2, 5], k = 7
    Output: True  # [3, 1, 4, 2] — wait, that's 10... [1, 4, 2] = 7 ✓
    Hint: a naive solution is O(n²). Can you do it in O(n)?
    */

   public SubArraySum1(int[] nums, int k) {
    Map<Integer, Integer> numsMap = new HashMap<>();
    for (int num: nums) {
        numsMap.computeIfAbsent(num, nums.getOrDefault(num, 0) + 1)
    }

    int r = k
    for (int i=0; i< nums.length; i++) {
        r
    }
   }

}