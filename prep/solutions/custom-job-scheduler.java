class JobScheduler {

    static class Execution implements Comparable<Execution> {
        String jobId;
        int time;
        int interval;
        
        Execution(String jobId, int time, int interval) {
            this.jobId = jobId;
            this.time = time;
            this.interval = interval;
        }
        
        public int compareTo(Execution other) {
            if (this.time != other.time) return Integer.compare(this.time, other.time); // same job compare times
            return this.jobId.compareTo(other.jobId);
        }
    }
    
    private PriorityQueue<Execution> heap = new PriorityQueue<>();
    private Map<String, Execution> pending = new HashMap<>();
        
        
    public JobScheduler() {

    }
    
    void add(String jobId, int time, int interval) {
        Execution e = new Execution(jobId, time, interval);
        heap.add(e);
        pending.put(jobId, e);
    }

    public void schedule(String jobId, int runAt) {
        add(jobId, runAt, 0); // no interval
    }

    public void scheduleRecurring(String jobId, int firstRunAt, int interval) {
        add(jobId, firstRunAt, interval); // recurring at interval
    }

    public boolean cancel(String jobId) {
        return pending.remove(jobId) != null;
    }

    public List<String> runUntil(int now) {
        List<String> kickedOff = new ArrayList<>();
        while(!heap.isEmpty() && heap.peek().time <= now) {
            Execution e = heap.poll();
            Execution pe = pending.get(e.jobId);
            if (pe == null || pe != e) {
                continue;
            }
            kickedOff.add(e.jobId + "@" + e.time);
            if (e.interval != 0) {
                add(e.jobId, e.time + e.interval, e.interval);
            } else {
                pending.remove(e.jobId);
            }
            
        }
        
        return kickedOff;
    }
}
