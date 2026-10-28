/*
You are climbing a staircase. It takes n steps to reach the top.
Each time you can either climb 1 or 2 steps. In how many distinct ways can you climb to the top?

Example 1:
Input: n = 2
Output: 2
Explanation: There are two ways to climb to the top.
1. 1 step + 1 step
2. 2 steps

Example 2:
Input: n = 3
Output: 3
Explanation: There are three ways to climb to the top.
1. 1 step + 1 step + 1 step
2. 1 step + 2 steps
3. 2 steps + 1 step
 
Constraints:

1 <= n <= 45
*/
// Dynamic Progrmaming problem
// This is a top-down apprach not bottom up
public class ClimbingStairs70 {

    public int climbinStairs(int n) {
        // Approach:
        // step i can be reached from step i-1 or step i-2
        // total number of ways to reach step i = total number of ways to reach step i-1 + total number of ways to reach step i-2
        // This is almost like a fibanacci series exepct it starts from 1
        // we can create numberof ways to cache for each step and the number of ways shall be n+1
        // once we compute all we simply return the cached value for n
        // base cases are 0th and 1st steps there are only 1 way each
        int[] ways = new int[n+1];
        ways[0] = 1;
        ways[1] = 1;
        for (int i=2; i<=n; i++) {
            ways[i] = ways[i-1] + ways[i-2];
        }
        return ways[n];
    }

    public static void main(String args[]) {
        ClimbingStairs70 cs = new ClimbingStairs70();
        int nunOfWays = cs.climbinStairs(3);
        System.out.println(String.format("number of ways %d", nunOfWays));
    }

}
