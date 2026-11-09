class Solution {
    // Write your solution here.
    
    
    public class LRUCache<K, V> {
        
        public Map<K, V> map = new HashMap<K, V>();
        LinkedList<K> list = new LinkedList<K>();
        
        LRUCache(int capacity) {
           this.capacity = capacity; 
        }
        
        public void put(K k, V, v) {
            map.put(k, v);
            list.addFirst(k);
        }
        
        public V get(K k) {
            
        }
        
        private void moveToFirst() {
            
        }
        
        private void removeLast() {
            
        }

    }

}
