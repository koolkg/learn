class Solution {
    public List<String> letterCombinations(String digits) {
        List<String> res = new ArrayList<>();
        
        Map<Character, String> keypad = new HashMap<>();
        keypad.put('2', "abc");
        keypad.put('3', "def");
        keypad.put('4', "ghi");
        keypad.put('5', "jkl");
        keypad.put('6', "mno");
        keypad.put('7', "pqrs");
        keypad.put('8', "tuv");
        keypad.put('9', "wxyz");  
        
        if (digits.trim().length() > 0 ) {
            backtrack(0, "", digits, res, keypad);
        }
        return res;
    }
    
    private void backtrack(int i, String currentStr, String digits, List<String> res, Map<Character, String> keypad) {
        if (currentStr.length() == digits.length()) {
            res.add(currentStr);
            return;
        }
        
        String letters = keypad.get(digits.charAt(i));
        for (char c: letters.toCharArray()) {
             backtrack(i+1, currentStr + c, digits, res, keypad);

        }
    }
}
