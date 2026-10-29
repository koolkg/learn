class Solution {
    public boolean canPlaceFlowers(int[] flowerbed, int n) {
        if (n ==0) return true; 
        if (flowerbed.length == 0) return false;
        int i = 0;
        while(i < flowerbed.length) {
            if (canPlantAt(i, flowerbed)) {
                flowerbed[i] = 1;
                // System.out.println(Arrays.toString(flowerbed));
                n--;
                if (n == 0) {
                    return true;
                }
            }
            i++;
        }
        
        return n == 0;
    }
            
    private boolean canPlantAt(int i, int[] flowerbed) {
       if (flowerbed[i] == 0) {
           if (flowerbed.length == 1) return true;
           if (i == 0) { // first
               return flowerbed[i+1] == 0;
           } else if (i == flowerbed.length -1) { //last
               return flowerbed[i-1] == 0;
           } else { // middle
                return flowerbed[i+1] == 0 && flowerbed[i-1] == 0;
           }
       }
        return false;
    }
}
    