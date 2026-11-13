class RequestBlocker {

    private int limit;
    private int window;
    private int blockFor;
    private Map<String, Integer> blockedUntil = new HashMap<>();
    private Map<String, Deque<Integer>> recent = new HashMap<>();
    
    public RequestBlocker(int limit, int window, int blockFor) {
        this.limit = limit;
        this.window = window;
        this.blockFor = blockFor;
    }

    public boolean allow(String clientId, int timestamp) {
        Integer until = blockedUntil.get(clientId);
        if (until != null && timestamp < until) {
            return false;
        }
        
        Deque<Integer> reqs = recent.get(clientId);
        
        if (reqs == null) {
            reqs = new ArrayDeque<>();
            recent.put(clientId, reqs);
        }
        
        // we remove everything that is outside of t-window 
        if (!reqs.isEmpty() && reqs.peekFirst() <= timestamp-window) {
            reqs.pollFirst();
        }
       //now check howmany request we have during the window
        if (reqs.size() >= limit) {
            blockedUntil.put(clientId, (timestamp + blockFor));
            reqs.clear(); // we don't want to keep any history
            return false;
        }
            
        reqs.addLast(timestamp);
        return true;
    }
}
