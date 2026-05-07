'''
Given a 1-indexed array of integers numbers that is already sorted in non-decreasing order, find two numbers such that they add up to a specific target number. Let these two numbers be numbers[index1] and numbers[index2] where 1 <= index1 < index2 <= numbers.length.

Return the indices of the two numbers index1 and index2, each incremented by one, as an integer array [index1, index2] of length 2.

The tests are generated such that there is exactly one solution. You may not use the same element twice.

Your solution must use only constant extra space.

Example 1:

Input: numbers = [2,7,11,15], target = 9
Output: [1,2]
Explanation: The sum of 2 and 7 is 9. Therefore, index1 = 1, index2 = 2. We return [1, 2].
Example 2:

Input: numbers = [2,3,4], target = 6
Output: [1,3]
Explanation: The sum of 2 and 4 is 6. Therefore index1 = 1, index2 = 3. We return [1, 3].
Example 3:

Input: numbers = [-1,0], target = -1
Output: [1,2]
Explanation: The sum of -1 and 0 is -1. Therefore index1 = 1, index2 = 2. We return [1, 2].
 

Constraints:

2 <= numbers.length <= 3 * 104
-1000 <= numbers[i] <= 1000
numbers is sorted in non-decreasing order.
-1000 <= target <= 1000
The tests are generated such that there is exactly one solution.
'''

from typing import List

# this is oO(n^2) implementation
def twoSumII_brtueforce(numbers: List[int], target: int) -> List[int]:
    
    n = len(numbers)

    if (n < 2) :
        return []

    for i in range(n):
        first = numbers[i]
        for j in range(i+1, n):
            second = numbers[j]
            if (first + second == target):
                return [i+1, j+1]
    return []

# this is O(n) time and O(1) space
# this will be using two pointers
def twoSumII(numbers: List[int], target: int) -> List[int]:
    n = len(numbers)
    if n < 2:
        return []
    first = 0
    last = n-1
    while (first < last):
        f = numbers[first]
        s = numbers[last]
        if  f + s == target:
            return [first+1, last+1]
        elif (f + s > target):
            last -=1
        else:
            first +=1
    return []

def main():
    numbers =  [2,7,11,15]
    target = 9
    # print(twoSumII_brtueforce(numbers, target))
    print(twoSumII(numbers, target))

if __name__ == '__main__':
    main()