'''
Given an array of integers nums which is sorted in ascending order, and an integer target, write a function to search target in nums. If target exists, then return its index. Otherwise, return -1.

You must write an algorithm with O(log n) runtime complexity.

Example 1:

Input: nums = [-1,0,3,5,9,12], target = 9
Output: 4
Explanation: 9 exists in nums and its index is 4
Example 2:

Input: nums = [-1,0,3,5,9,12], target = 2
Output: -1
Explanation: 2 does not exist in nums so return -1
 

Constraints:

1 <= nums.length <= 104
-104 < nums[i], target < 104
All the integers in nums are unique.
nums is sorted in ascending order.
'''

from typing import List

def search(nums: List[int], k : int) -> int:
    return binary_search(nums, k, 0, len(nums)-1)

def binary_search(nums: List[int], k: int, l: int, h: int) -> int:
    print(f"nums={nums}, k={k}, l={l}, h={h}")
    if l >= h :
        return -1
    mid = int((h - l)/2) + l
    
    print(f"mid={mid}")

    if k < nums[mid]:
        return binary_search(nums, k, l, mid)
    elif k > nums[mid]:
        return binary_search(nums, k, mid+1, h)
    else:
        return mid

def 
def main():
    k = 13
    nums = [-1,0,3,5,9,12]
    i = search(nums, k)
    print(f"index={i}")

if __name__ == '__main__':
    main()
