class Solution {
    public int depthSumInverse(List<NestedInteger> nestedList) {
      int depth = 1;
      int maxDepth = getMaxDepth(nestedList, 1);
      return dfs(nestedList, depth, maxDepth, 0);
        
    }
    
    public int getMaxDepth(List<NestedInteger> list, int depth) {
        int maxDepth = 0;
        for (NestedInteger n: list) {
            if (n.isInteger()) {
                maxDepth = Math.max(maxDepth, depth);
            } else {
                int childMaxDepth = getMaxDepth(n.getList(), depth+1);
                maxDepth = Math.max(maxDepth, childMaxDepth);
            }
        }
        return maxDepth;
    }
    
    public int dfs(List<NestedInteger> list, int depth, int maxDepth, int total) {
        for (NestedInteger n: list) {
            if (n.isInteger()) {
                total += n.getInteger() * (maxDepth - depth +1);
            } else {
                total = dfs(n.getList(), depth+1, maxDepth, total);
            }
        }
        return total;

    }
}
