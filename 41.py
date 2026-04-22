'''
Given an unsorted integer array nums. Return the smallest positive integer that is not present in nums.
You must implement an algorithm that runs in O(n) time and uses O(1) auxiliary space.

Example 1:

Input: nums = [1,2,0]
Output: 3
Explanation: The numbers in the range [1,2] are all in the array.
Example 2:

Input: nums = [3,4,-1,1]
Output: 2
Explanation: 1 is in the array but 2 is missing.
Example 3:

Input: nums = [7,8,9,11,12]
Output: 1
Explanation: The smallest positive integer 1 is missing.
 
Constraints:

1 <= nums.length <= 105
-231 <= nums[i] <= 231 - 1
'''

from typing import List


def smallest_missing_int(values: List[int]) -> int:
    n = len(values)
    present = {i: False for i in range(1, n+2)}

    for v in values:
        if v in present: 
            present[v] = True
    
    for k, v in present.items():
        if (v == False):
            return k
    
def smallest_missing_int2(values: List[int]) -> int:
    seen = set(values)
    i = 1
    while(i in seen):
        i += 1
    return i

def smallest_missing_int3(values: List[int]) -> int:
    n = len(values)
    i = 0
    while (i < n):
        v = values[i]

        if (1 <= v <= n and values[v-1] != v):
            values[i],  values[v-1] = values[v-1], values[i]
        else:
            i +=1
    for i in range (n):
        if values[i] != i+1:
            return i+1
    return n+1

def main():
    values = [7,8,9,11,12]
    print(smallest_missing_int3(values))

if __name__ == '__main__':
    main()


    

    