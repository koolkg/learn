import java.util.*;
import java.concurrent.*;

public class URLCrawler { 

    public static void main(String[] args) {

    }

    public List<String> crawlSequential(String startUrl, HtmlParser parser) {
        List<String> urls = new ArrayList<>();
        String hostname = hostname(startUrl);

        Set<String> visited = new HashSet<>();
        visited.add(startUrl);
        Queue<String> queue = new ArrayDequeue<>();

        queue.offer(startUrl);
        while(!queue.isEmpty()) {
            String url = queue.poll();
            for (String next: parser.getUrls(url)) {
                if (next.hostname.equalsIgnoreCase(next) && !visited.contains(next)) {
                    visited.add(next);
                    queue.offer(next);
                }
            }

        }
        
        return new ArrayList<>(visited);
    }

    public List<String> crawl(String startUrl, HtmlParser parser) {
        String hostname = hostname(startUrl);
        ExecutorService executor = new Executors.newFixedThreadPool(8);
        Set<String> visited = new ConncurrentHashMap<String, String>().keySet();

        try {
            fetchUrls(startUrl, hostname, parser, executor).join();
        } finally {
            executor.shutdown();
        }
        return new ArrayList
    }

    public CompletableFuture<void> fetchUrls(String url, String hostname, HtmlParser parser,  ThreadpoolExecutor executor) {
        return CompletableFuture
            .supplyAsync(() -> parser.getUrls(url), executor)
            .thenComposeAsync(childUrls -> {
                List<CompletableFuture> subUrlFetches = new ArrayList<>();
                for (String childUrl : childUrls){
                    if (hostname.equalsIgnoreCase(hostname(childUrl))) && !visited.contains(childUrl)) {
                        subUrlFetches.add(fetchUrls(childUrl, hostname, parser, executor))
                    }
                } 
                return CompletableFuture.allOf(subs.toArray(new CompletableFuture[0]));
            }, pool)
    }

    public String hostname(String url) {
        // all urls start with http, for example http://example.com
        // in this case host name is exmaple.com
        int start = 7; // http://
        int end = url.indexOf('/',  start);
        return end == -1 ? url.substring(start) : url.substring(start, end);
    }


}

interface HtmlParser {
    // Return a list of all urls from a webpage of given url.
    // This is a blocking call, that means it will do HTTP request and return when this request is finished.
    public List<String> getUrls(String url);
}

