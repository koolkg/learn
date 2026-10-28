/*
You are given an integer array cost where cost[i] is the cost of ith step on a staircase. Once you pay the cost, you can either climb one or two steps.
You can either start from the step with index 0, or the step with index 1.
Return the minimum cost to reach the top of the floor.

Example 1:
Input: cost = [10,15,20]
Output: 15
Explanation: You will start at index 1.
- Pay 15 and climb two steps to reach the top.
The total cost is 15.

Example 2:
Input: cost = [1,100,1,1,1,100,1,1,100,1]
Output: 6
Explanation: You will start at index 0.
- Pay 1 and climb two steps to reach index 2.
- Pay 1 and climb two steps to reach index 4.
- Pay 1 and climb two steps to reach index 6.
- Pay 1 and climb one step to reach index 7.
- Pay 1 and climb two steps to reach index 9.
- Pay 1 and climb one step to reach the top.
The total cost is 6.
 
Constraints:

2 <= cost.length <= 1000
0 <= cost[i] <= 999
https://www.youtube.com/watch?v=9k31KcQmS_U - Explanation (2nd problem in the video).
*/



public class MinCostStairs746 {
    
    public int minCostClimbStairs(int[] costs) {
        // Approach
        // This is very similar to ClimbingStairs70 but the difference is we don't want total, we want min of i-1, i-2 costs
        // Note: costs represent the cost to pay to leave step i to go to step i+1, you pay before laving a step
        // cost for step 0 or step 1 is 0
        // min cost for step i = min(total cost for step i-1, total cost for step i-2)

        int[] minCosts = new int[costs.length+1];
        minCosts[0] = 0;
        minCosts[1] = 0;
        for (int i=2; i<=costs.length; i++) {
            int costForOpt1 = minCosts[i-1] + costs[i-1]; // come to i from previous step; min cost to reach i-1 + cost to leave i-1
            int costForOpt2 = minCosts[i-2] + costs[i-2]; // come to i from 2 steps before (prev to prev); min cost to reach i-2 + cost to leave i-2
            minCosts[i] = Math.min(costForOpt1, costForOpt2);
        }
        return minCosts[costs.length];
    }

    public static void main(String[] args) {
        MinCostStairs746 mc = new MinCostStairs746();
        int[] costs = new int[] {10,15,20};
        int minCost = mc.minCostClimbStairs(costs);
        System.out.println("minCost = " + minCost);
    }
}