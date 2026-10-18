package in.smkt.haldesk;

public final class AiEndpointTest {
    private static int count;
    private static void equal(String expected,String actual) {
        if(!expected.equals(actual))throw new AssertionError(actual);count++;
    }
    private static void reject(String address) {
        try {AiEndpoint.normalize(address);}catch(Exception expected){count++;return;}
        throw new AssertionError("Unsafe AI origin accepted: "+address);
    }
    public static void main(String[] args)throws Exception {
        equal("https://hal.example.com",AiEndpoint.normalize(" https://HAL.example.com:443/ "));
        equal("https://hal.example.com/api/config",AiEndpoint.target("https://hal.example.com",null));
        for(String mode:new String[]{"copilot","deliberate","research"})
            equal("https://hal.example.com/api/ai/"+mode,AiEndpoint.target("https://hal.example.com/",mode));
        for(String value:new String[]{"http://hal.example.com","https://user:secret@hal.example.com","https://hal.example.com:8443","https://hal.example.com/api/ai/copilot","https://hal.example.com?token=x","https://hal.example.com#fragment","https://127.0.0.1","https://[::1]","https://localhost","https://hal.local","https://hal.localhost","https://hal.internal","https://hal.lan","https://hal.example.com/%2e%2e","https://hal.example.com\\@evil.example.com","https://hal.example.com\n","https://%68al.example.com"})reject(value);
        try{AiEndpoint.target("https://hal.example.com","../orders");throw new AssertionError("Arbitrary endpoint accepted");}catch(Exception expected){count++;}
        System.out.println("PASS "+count+" AI destination checks: HTTPS origin, credential boundaries and fixed routes.");
    }
}
