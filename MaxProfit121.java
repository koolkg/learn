public class MaxProfit121 {
    /*
    You are given an array prices where prices[i] is the price of a given stock on the ith day.

    You want to maximize your profit by choosing a single day to buy one stock and choosing a different day in the future to sell that stock.

    Return the maximum profit you can achieve from this transaction. If you cannot achieve any profit, return 0.
    Example 1:

    Input: prices = [7,1,5,3,6,4]
    Output: 5
    Explanation: Buy on day 2 (price = 1) and sell on day 5 (price = 6), profit = 6-1 = 5.
    Note that buying on day 2 and selling on day 1 is not allowed because you must buy before you sell.
    Example 2:

    Input: prices = [7,6,4,3,1]
    Output: 0
    Explanation: In this case, no transactions are done and the max profit = 0.
    

    Constraints:

    1 <= prices.length <= 105
    0 <= prices[i] <= 104
    */

   public int maxProfit(int[] pricesByDay) {
    // This is a very easy sliding window problem
    // We maintain two pointers, left - starts at 0 and right starts at left+1
    // if price at left > righ then move left to right (coz it's cheaper to buy at right)
    // otherwise simply compute the profit and update global max profit

    int left = 0;
    int right = left + 1;

    // let's do bounday condition checks
    if (pricesByDay == null || pricesByDay.length < 2) {
        return 0;
    }

    int maxProfit = 0;
    // [7,2,5,3,1,6,4]
    // for (int i = 0; i < pricesByDay.length-1; i++) {
    while (right < pricesByDay.length) {
        int leftVal = pricesByDay[left];
        int rightVal = pricesByDay[right];
        if (leftVal >= rightVal ) {
            left = right;
            // maxProfit = 0;
        } else {
            maxProfit = Math.max((rightVal-leftVal), maxProfit);
        }
        right++;
    }
    return maxProfit;

   }
    

    public static void main(String[] args) {
        MaxProfit121 mp = new MaxProfit121();
        int[] prices = new int[] {7,2,9,3,1,6,4}; //{7,1,5,3,6,4};
        int p = mp.maxProfit(prices);
        System.out.println("max profit = " + p);
    }
}