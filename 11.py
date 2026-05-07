'''
Container with most water
You are given an integer array height of length n. There are n vertical lines drawn such that the two endpoints of the ith line are (i, 0) and (i, height[i]).

Find two lines that together with the x-axis form a container, such that the container contains the most water.

Return the maximum amount of water a container can store.

Notice that you may not slant the container.
Example 1:

Input: height = [1,8,6,2,5,4,8,3,7]
Output: 49
Explanation: The above vertical lines are represented by array [1,8,6,2,5,4,8,3,7]. In this case, the max area of water (blue section) the container can contain is 49.
Example 2:

Input: height = [1,1]
Output: 1
 
Constraints:

n == height.length
2 <= n <= 105
0 <= height[i] <= 104
'''

# this is O(n^2)

from typing import List


def containerWithMostWater_bruteforce(height: List[int]) -> int:
    n = len(height)

    if n < 2 :
        return 0
    max_water_units = 0
    for i in range(0, n):
        current_water_units = 0
        for j in range(i+1, n):
            current_water_units = min (height[i], height[j]) * (j-i)
            if current_water_units > max_water_units:
                max_water_units = current_water_units
    return max_water_units

def containerWithMostWater(height: List[int]) -> int:
    n = len(height)
    if n < 2: # nothing to compute
        return 0
    left = 0
    right = n-1

    max_water_units = 0
    while left < right:
        h_left = height[left]
        h_right = height[right]
        d = right - left

        curr_water_units = min(h_left, h_right) * d

        if curr_water_units > max_water_units: 
            max_water_units = curr_water_units
        
        if h_left < h_right:
            left +=1
        else:
            right -=1
    return max_water_units
        

def main():
    height = [1,8,6,2,5,4,8,3,7]
    print(containerWithMostWater(height))

if __name__ == '__main__':
    main()

