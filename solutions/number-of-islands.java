class Solution {
    public int numIslands(char[][] grid) {
        if (grid == null || grid.length == 0) return 0;
        int numIslands = 0;
        for (int r = 0; r < grid.length; r++) {
            for (int c = 0; c < grid[0].length; c++) {
                if (grid[r][c] == '1') {
                    dfs(grid, r, c);
                    numIslands++;
                }
            }
        }
        return numIslands;
    }
    
    private void dfs(char[][] grid, int row, int col) {
        if (row < 0 || col < 0 || 
            row >= grid.length || 
            col >= grid[0].length || 
            grid[row][col] == '0') { // base case
            return;
        }
        grid[row][col] = '0';
        dfs(grid, row, col+1); // explore right
        dfs(grid, row+1, col); // explore bottom
        dfs(grid, row, col-1); // explore left
        dfs(grid, row-1, col); // explore up
    }
}
