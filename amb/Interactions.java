import java.util.*;

public class Interactions {
    Map<Integer, Map<Integer, Double>> interactionsMap;
    private static final double RISK_SCORE_THRESHOLD = 0.7;

    public Interactions(double[][] interactions) {
        interactionsMap = new HashMap<Integer, Map<Integer, Double>>();
        this.populate(interactions);
    }

    public static void main(String[] args) {
        Interactions i = new Interactions(new double[][]{
                                {1, 3, 0.5}, 
                                {2, 3, 0.3}, 
                                {1, 4, 0.9}});
        boolean harmful = i.isHarmful(new int[]{1, 5}, 4);
        System.out.println("isHarmful=" + harmful);

        boolean tripletHarmful = i.isTripletHarmful(new int[]{1, 2}, 3);
        System.out.println("tripletHarmful=" + tripletHarmful);
        String sub = i.trySubstitute(new int[]{1, 2}, 3, new int[][]{{2, 4}, {1, 5}});
        System.out.println(sub);
    }

    private void addInteraction(int firstDrugId, int secondDrugId, double riskScore) {
        int from = Math.min(firstDrugId, secondDrugId);
        int to = Math.max(firstDrugId, secondDrugId);
        interactionsMap.computeIfAbsent(from, k -> new HashMap<>()).put(to, riskScore);
    }

    private void populate(double[][] interactions) {
        for (double[] interaction: interactions) {
            int firstDrugId = (int) interaction[0];
            int secondDrugId = (int) interaction[1];
            double riskScore = interaction[2];
            addInteraction(firstDrugId, secondDrugId, riskScore);
        }
    }

    private double getScore(int firstDrugId, int secondDrugId) {
        int from = Math.min(firstDrugId, secondDrugId);
        int to = Math.max(firstDrugId, secondDrugId);
        return interactionsMap.getOrDefault(from, Collections.emptyMap()).getOrDefault(to, 0.0);
    }


    public boolean isHarmful(int[] currentList, int proposed) {
        for (int drugId : currentList) {
            double riskScore = getScore(drugId, proposed);   
            if (riskScore > RISK_SCORE_THRESHOLD ) {
                return true;
            }
        }
        return false;
    }

    public boolean isTripletHarmful(int[] currentList, int proposed) {
        double totalScore = 0.0;
        for (int drugId : currentList) {
            double currentScore = getScore(drugId, proposed);  
            totalScore += currentScore;
            System.out.println("isTripletHarmful currentScore=" + currentScore + ", totalScore=" +totalScore);

            if (totalScore > RISK_SCORE_THRESHOLD ) {
                return true;
            }
        }
        return false;
    }

    public String trySubstitute(int[] currentList, int proposed, int[][] substitutes) {
        for (int[] substituePair: substitutes) {
            int original = substituePair[0];
            int sub = substituePair[1];

            double totalScore = 0.0;
            for (int drugId : currentList){
                int updatedDrugId  = (drugId == original) ? sub : drugId;
                totalScore += getScore(updatedDrugId, proposed);
                if (updatedDrugId == drugId) {
                    totalScore += getScore(updatedDrugId, newId);
                }

            }

            if (totalScore <= RISK_SCORE_THRESHOLD) {
                return "Substitute " + original + " for " + sub + 
                   ", which avoids the harmful triplet  " + Arrays.toString(currentList) + ", " + proposed;
            }
        }
        return "Cannot find a substitute that is harmless";
    }
}