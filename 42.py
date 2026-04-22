'''
https://leetcode.com/problems/trapping-rain-water/description/?envType=study-plan-v2&envId=top-interview-150

Given n non-negative integers representing an elevation map where the width of each bar is 1, compute how much water it can trap after raining.


Example 1:

Input: height = [0,1,0,2,1,0,1,3,2,1,2,1]
Output: 6
Explanation: The above elevation map (black section) is represented by array [0,1,0,2,1,0,1,3,2,1,2,1]. In this case, 6 units of rain water (blue section) are being trapped.
Example 2:

Input: height = [4,2,0,3,2,5]
Output: 9
 
Constraints:

n == height.length
1 <= n <= 2 * 104
0 <= height[i] <= 105

'''

from typing import List


def trap(height: List[int]) -> int:
    
    n = len(height)
    if (n <= 1):
        return 0
    max_left = [0] * n
    max_right = [0] * n

    max_left[0] = height[0]
    max_right[n-1] = height[n-1]
    for i in range(1, n):
        max_left[i] = max(max_left[i-1], height[i])
    
    for i in range(n-2, -1, -1):
        max_right[i] = max(max_right[i+1], height[i])

    trapped_water = 0

    for i in range (1, n):
        current = min(max_left[i], max_right[i]) - height[i] # this is the formula
        #if current > 0:
        trapped_water += current if current > 0 else 0
    return trapped_water

def main():
    heights = [4,2,0,3,2,5] # [0,1,0,2,1,0,1,3,2,1,2,1]
    trapped = trap(heights)
    print("trapped water = ", trapped)


if __name__ == '__main__':
    main()