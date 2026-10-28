// a helpful teammate has already cleaned the data for us!
import java.io.*;
import java.util.*;

class Solution {

  static String[][] notes = {
    {"0", "the patient has chest pain a nd shortness of breath"},
    {"1", "patient complains of hypertension also mentions heart disease specifically angina"},
    {"2", "htn chest discomfort and occasional migraines"},
    {"3", "no chest issues but has migraine headaches heart disease not indicated"},
    {"4", "htn htn htn repeated for emphasis"},
    {"5", "angina was noted mi is suspected the patient might have another form of heart disease"},
    {"6", "we have a multiline styled note first line second line mentions possible hypertension"},
    {"7", ""},
    {"8", "some punctuation chest pain shortness of breath or chest pain also htn"},
    {"9", "he complains of htn we suspect hypertension but not certain heart disease"}
  };

  // note -> <noteId, counts>
  private static final Map<String, Map<Integer, Integer>> invertedIndexMap = new HashMap<>();

  public Solution() {
    try {
      buildInvertedIndexMap();
    } catch(Exception e) {
      e.printStackTrace();
    }
  }

  private void buildInvertedIndexMap() throws RuntimeException {
    for (String[] note : notes) {
      int noteId = Integer.parseInt(note[0]);
      String phrase = note[1].trim();
      String[] words = phrase.trim().split(" ");
      for (String word : words) {
        if (word.trim().length() == 0) continue;
        Map<Integer, Integer> noteCountsMap = invertedIndexMap.get(word);
        if (noteCountsMap == null) {
          noteCountsMap = new HashMap<>();
          invertedIndexMap.put(word, noteCountsMap);
        }
        // System.out.println("word=" + word +", noteId=" + noteId + ", invertedIndexMap=" + invertedIndexMap);
        noteCountsMap.put(noteId, noteCountsMap.getOrDefault(noteId, 0) + 1);
        // System.out.println("noteIds="+noteIds);
      }
    }
  }

  private Set<Integer> searchForNotes(String phrase) {

    Set<Integer> ret = new HashSet<Integer>();
    String[] words = phrase.split(" ");
    for (String word: words) {
      if (word.trim().length() == 0) continue;
      Map<Integer, Integer> noteIds = invertedIndexMap.getOrDefault(word, new HashMap<>());
      ret.addAll(noteIds.keySet());
    }
    return ret;
  }
// “chest pain” - [8: 4, 0:2, 2:1, 3:1] - Expected output: [8,0,2,3] or [8,0,3,2]
  private List<Map.Entry<Integer, Integer>> rank(String phrase) {
    // note Id -> counts
    Map<Integer, Integer> map = new HashMap<>();
    String[] words = phrase.split(" ");
    for (String word: words) {
      if (word.trim().length() == 0) continue;
      Map<Integer, Integer> noteIdCountsForWord = invertedIndexMap.getOrDefault(word, new HashMap<>());
      Set<Integer> noteIds = noteIdCountsForWord.keySet();
      for (Integer noteId : noteIds) {
        Integer count = noteIdCountsForWord.get(noteId);
        map.put(noteId, map.getOrDefault(noteId, 0) + count);
      }
    }
    System.out.println("map="+map);
    List<Map.Entry<Integer, Integer>> list = new ArrayList<>();
    list.addAll(map.entrySet());
    System.out.println("list="+list);
    Collections.sort(list, (a, b) -> Integer.compare(b.getValue(), a.getValue()));
    return list;
  }


  public static void main(String[] args) { 
    // System.out.println("Hello");
    Solution s = new Solution();
    // System.out.println("InvertedMap = " + Solution.invertedIndexMap);
    Set<Integer> results = s.searchForNotes("chest pain");
    System.out.println(results);
    List<Map.Entry<Integer, Integer>> ranks = s.rank("chest pain");
    System.out.println("ranks="+ranks);

  }
}
