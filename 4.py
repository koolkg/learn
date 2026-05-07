'''
4. Median of Two Sorted Arrays

Given two sorted arrays nums1 and nums2 of size m and n respectively, return the median of the two sorted arrays.

The overall run time complexity should be O(log (m+n)).

Example 1:

Input: nums1 = [1,3], nums2 = [2]
Output: 2.00000
Explanation: merged array = [1,2,3] and median is 2.
Example 2:

Input: nums1 = [1,2], nums2 = [3,4]
Output: 2.50000
Explanation: merged array = [1,2,3,4] and median is (2 + 3) / 2 = 2.5.
 

Constraints:

nums1.length == m
nums2.length == n
0 <= m <= 1000
0 <= n <= 1000
1 <= m + n <= 2000
-106 <= nums1[i], nums2[i] <= 106
'''

'''
SOLUTIONS
There are multiple ways to solve this problem
1. Merge arrays and then perform a sort then calculate the median - this will be O(m+n) space and O(nlog(n)) time then
2. Merge using a technique similar to merge sort and then calcualte median - this will be O(m+n) space and O(m+n) or O(N) time
3. Calculate the total size of the combined array (m+n) and calculate the mid point index in the combined array - 
    Use two pointers both starting at the beggining each array keep moving until you hit the desired index then calculate the median becuaes you know that will be the mid point
    - This will be O(m+n) or O(N) time and O(1) space
4. This partition two arrays and use binary search to find out the proper partitioning
   approach:
   total = m+n
   find the min length array 
   find low and high of the min array
   mid element should be total/2 (both arrays when combined)

   set your left partition size to be mid element
   
   bin search partition on the min array = (low + high) /2
   so the second array partition should be at total - (low + high) /2

   both arrays are now partioned
   combined left partition will have  left partition size 
   combined right partiion will have the remianing elemements
   if
        max element of left partition in first array should < min element in right partition of 2nd array and 
        max element of left partition in second array should < min element in right partition of 1st array
        if true this is the mid point
            if total is even
            (max (max element of left partition in first array  and max element of left partition in second array ) + 
            min (min element in right partition of 2nd array and min element in right partition of 1st array))/2
            else if max element of left partition in first array should > min element in right partition of 2nd array
        if odd 
            max (max element of left partition in first array and max element of left partition in second array)
    else if max element of left partition in first array > min element in right partition of 2nd array
        # partition in first array is too far to the right adjust the high to lower so the partition can move left
        high = partition on the min array -1
    else 
        # move the partition to righ i.e move to the right of current patition
        low = partition on the min array + 1

    return 0

'''
from typing import List

# both arrays must be sorted
def median(nums1: List[int], nums2: List[int]) -> int:
    n = len(nums1)
    m = len(nums2)
    total = m + n
    # pick the smaller array for binary search so that we have less searhes to make
    smaller = nums1 if n <= m else nums2
    larger = nums1 if n > m else nums2
    len_smaller = len(smaller)
    len_larger = len(larger)
    #handle edge case
    if total == 0 :
        print("1")
        return 0
    if n == 0 and m > 0:
        middle = int(m/2)
        if m % 2 == 0:
            return (nums2[middle-1] + nums2[middle])/2
        else:
            return nums2[middle]
    if m == 0 and n > 0:
        middle = int(n/2)
        if n % 2 == 0:
            return (nums1[middle-1] + nums1[middle])/2
        else:
            return nums1[middle]

    # initialize the low and high bounds for binary search
    low = 0
    high = len(smaller)

    lowest_val_in_both = min (nums1[0], nums2[0])
    highest_val_in_both = max (nums1[n-1], nums2[m-1])
    print(f"n={n}, m={m}, lowest_val_in_both={lowest_val_in_both}, highest_val_in_both={highest_val_in_both}")

    # binary search condition
    while low <= high:
        print(f"loop start low={low}, high={high}")
        # first partition
        f_partition = int((low + high) / 2) # this is where the first array is partitioned

        #second parition
        s_partition = int((total + 1)/2) - f_partition # this is where we must partition the second
        print(f"f_partition={f_partition} s_partition={s_partition}")

        f_left_max = lowest_val_in_both - 1 if f_partition == 0 else smaller[f_partition - 1] 
        f_right_min = highest_val_in_both + 1 if f_partition == len_smaller else smaller[f_partition]

        s_left_max = lowest_val_in_both - 1 if s_partition == 0 else larger[s_partition - 1] 
        s_right_min = highest_val_in_both + 1 if s_partition == len_larger else larger[s_partition]

        print(f"f_left_max={f_left_max}, f_right_min={f_right_min}, s_left_max={s_left_max}, s_right_min={s_right_min}")

        if f_left_max <= s_right_min and s_left_max <= f_right_min: # we found the right partition
            # is the total length (lengths of both arrays combined) even? then we need to average
            # the max value from both lefts and min value both rights 
            print(f"f_left_max < s_right_min and s_left_max < f_right_min" )

            if total % 2 == 0:
                median = (max(f_left_max, s_left_max) + min(f_right_min, s_right_min)) / 2
                print(f"even median={median}")
                return median
            else: # if odd then we want the max of both lefts
                median = max(f_left_max, s_left_max)
                print(f"odd median={median}")
                return median
        # if the max left on the first partition is larger than min in the second partition
        # then we went too far to the right in the first array
        # let's try binary search with high as partition
        elif f_left_max > s_right_min: 
            high = f_partition - 1
            print(f"f_left_max > s_right_min high={high}")
        # otherwise we need to binary search in the right parition 
        else:
            low = f_partition + 1
            print(f"else low={low}")
        print(f"current low={low}, high={high}")
    return 0

def main():
    first = [1]
    second = [1]
    # first = [1,12, 15, 26, 38]
    # second = [2, 13, 17, 30, 45, 60]
    print(median(first, second))

if __name__ == '__main__':
    main()

