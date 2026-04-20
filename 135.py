'''
LC-135 Candy:

There are n children standing in a line. Each child is assigned a rating value given in the integer array ratings.

You are giving candies to these children subjected to the following requirements:

Each child must have at least one candy.
Children with a higher rating get more candies than their neighbors.
Return the minimum number of candies you need to have to distribute the candies to the children.

 
Example 1:

Input: ratings = [1,0,2]
Output: 5
Explanation: You can allocate to the first, second and third child with 2, 1, 2 candies respectively.
Example 2:

Input: ratings = [1,2,2]
Output: 4
Explanation: You can allocate to the first, second and third child with 1, 2, 1 candies respectively.
The third child gets 1 candy because it satisfies the above two conditions.

Constraints:

n == ratings.length
1 <= n <= 2 * 104
0 <= ratings[i] <= 2 * 104
'''
# one apporach is to sort and give candy to each in creasing order - this seems naive approach
# 
def distribute_candy(ratings):
    n = len(ratings)
    # everyone gets at least one candy - base case
    candies = [1] * n

    # we divide this into two pases
    # forward pass
    # we check if a child has rating greater than the predecessor 
    # if so we give one more candy to the child
    # we can ignore the first child as there is noone infront of the first child.
    # Note: the upper range is only n-1 when it is n
    for i in range(1, n):
        if (ratings[i] > ratings[i-1]):
            candies[i] = candies[i-1] + 1;
    
    # backward pass
    # check if the child at i has more rating than the child at i + 1
    # if so we give the child one more candy than the child on right
    # Note: the lower range is excluded so only goes to 0
    # we start at second from last eleemnt as there will nothing on the right of last element.
    for i in range ( n-2, -1, -1):
        if (ratings[i] > ratings [i+1]):
            candies[i] = max (candies[i], candies [i+1] + 1 ) # we want to pcik the max of this and the value from forward pass
    
    # we return the sum of all candies distributed.
    return sum(candies)

def main():
    ratings = [1, 1, 2]
    candies = distribute_candy(ratings)
    print ("Total candies = ", candies)

if __name__ == "__main__":
    main()

