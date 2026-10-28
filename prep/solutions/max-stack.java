class MaxStack {
    
    private static class Node{
        Node prev;
        Node next;
        int val;
        
        Node(int val) {
            this.val = val;
        }
    }
    
    Node head;
    Node tail;
    
    TreeMap<Integer, Deque<Node>> map = new TreeMap<>();

    public MaxStack() {
        head = new Node(Integer.MIN_VALUE);
        tail = new Node(Integer.MIN_VALUE);
        head.next = tail;
        tail.prev = head;
    }

    private Node newNode(int val) {
        Node node = new Node(val);
        return node;
    }
    
    private Node removeFromMap(int val) {
        Deque<Node> q = map.get(val);
        Node node = q.removeLast();
        if (q.isEmpty()) map.remove(val);
        return node;
        
    }
    private void remove(Node node) {
        Node prev = node.prev;
        Node next = node.next;
        
        prev.next = next;
        next.prev = prev;
        node.prev = null;
        node.next = null;
    }
    
    public void push(int x) {
        Node node = newNode(x);
        Node last = tail.prev;
        node.next = tail;
        tail.prev = node;
        last.next = node;
        node.prev = last;
        
        Deque<Node> q = map.get(node.val);
        if (q == null) {
            q = new ArrayDeque<Node>();
            map.put(x, q);
        }
        q.offer(node);
        
    }

    public int pop() {
        Node last = tail.prev;
        tail.prev = last.prev;
        last.prev.next = tail;
        remove(last);
        removeFromMap(last.val);

        return last.val;
    }

    public int top() {
        if (tail.prev == head) return -1;
        return tail.prev.val;
    }

    public int peekMax() {
        return map.lastKey();
    }

    public int popMax() {
        int max = map.lastKey();
        Node node = removeFromMap(max);
        remove(node);
        return max;

    }
}
