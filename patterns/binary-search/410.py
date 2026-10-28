'''
Given an integer array nums and an integer k, split nums into k non-empty subarrays such that the largest sum of any subarray is minimized.
Return the minimized largest sum of the split.
A subarray is a contiguous part of the array.

Example 1:

Input: nums = [7,2,5,10,8], k = 2
Output: 18
Explanation: There are four ways to split nums into two subarrays.
The best way is to split it into [7,2,5] and [10,8], where the largest sum among the two subarrays is only 18.
Example 2:

Input: nums = [1,2,3,4,5], k = 2
Output: 9
Explanation: There are four ways to split nums into two subarrays.
The best way is to split it into [1,2,3] and [4,5], where the largest sum among the two subarrays is only 9.
 

Constraints:

1 <= nums.length <= 1000
0 <= nums[i] <= 106
1 <= k <= min(50, nums.length)
'''
from typing import List
def splitArray(nums: List[int], k: int) -> int:
    
    # find the search space.
    # the sum of sub arrays is max value in the nums 
    # the reason we have pick the max value from nums is because 
    # if we have anything less than that value you cannot put that max element in any sub array
    # max value of the sum of all the elements 
    low = max(nums)
    high = sum(nums)
    print(f"initial low={low}, high={high}")
    
    # there are literally two ways we can solve this at this point
    # we can walk over the search space  [low to high] and try to devide up nums with sum value in the search space
    # time complexity will be O(NXM) where N is numner of elements in the input and M is the size of the search space (low to high)
    # since low to high is by default a range (i.e. it contains sorted numbers by definition) we can use binary search
    # this apporach will give us O(NlogM) -> M search sapce, and N number of elements in the input array

    # let's try the iterative version of binary search on the search space.

    while (low <= high):
        subarraySum = (low + high) // 2 # we shall try if we can devide the nums with this sum
        if canDivide(nums, subarraySum) <= k:
            high = subarraySum - 1
            ans = subarraySum # in case its is equal we may still find a better sum
        else:
            low = subarraySum + 1
        
    return ans

'''
[1,2,3,4,5]
low = 5, high = 15
split = low + (high-low)/2 = 5 + 5 = 10

sum = 10
k = 2
1, 2, 3, 4 | 5 <-- this method must return or max sum?

let's say we return true
 then we want to try another index which is towards the left?
 low = 5
 high = 10
 split = low + (high-low)/2 = 5 + 2 = 7

sum  = 7
k =2
1, 2, 3 | 4 | 5 

so we move the low pointer right?
low = 7
high =10
split = low + (high - low)/2 = 7 + (10-7)/2 = 8
sum = 6
k=2
1, 2, 3 | 4 | 5 
so we move the low to right
low = 8
high = 10
split = low + (high - low)/2 = 8 + (10-8)/2 = 9
sum = 9
1, 2, 3 | 4, 5 


'''
# nums, subarray sum, num sub arrays
def canDivide(nums: List[int], s: int) -> int:
    currentSum = 0
    count = 1 # count number of sub arrays we are creating
    for num in nums:
        if currentSum + num <= s:
            currentSum += num
        else:
            count += 1
            currentSum = num
    return count

    

def main():
    k = 2
    nums = [7,2,5,10,8]
    maxSum = splitArray(nums, k)
    print(f"maxSum={maxSum}")

if __name__ == '__main__':
    main()