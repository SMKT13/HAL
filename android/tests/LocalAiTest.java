package in.smkt.haldesk;

import java.io.*;
import java.nio.file.*;
import java.util.Arrays;
import java.util.concurrent.atomic.AtomicBoolean;

public final class LocalAiTest {
    interface Checked {void run()throws Exception;}
    private static int checks;
    static void check(boolean value){if(!value)throw new AssertionError();checks++;}
    static void rejects(Checked action)throws Exception{try{action.run();}catch(Exception expected){checks++;return;}throw new AssertionError("Invalid input accepted");}
    public static void main(String[] args)throws Exception{
        for(String address:new String[]{ModelPolicy.DOWNLOAD_URL,"https://us.aws.cdn.hf.co/model?X-Amz-Signature=test","https://cas-bridge.xethub.hf.co/file"}){ModelPolicy.downloadDestination(address);checks++;}
        for(String address:new String[]{"http://huggingface.co/model","https://huggingface.co.evil.example/file","https://evil.example/file","https://secret@huggingface.co/file","https://huggingface.co:8443/file","file:///tmp/model","https://127.0.0.1/file"})rejects(()->ModelPolicy.downloadDestination(address));
        rejects(()->ModelPolicy.size(0));rejects(()->ModelPolicy.size(ModelPolicy.MAX_BYTES+1));
        rejects(()->ModelPolicy.header(new byte[8]));
        check(!ModelPolicy.label("../bad\nmodel.litertlm").contains("/"));
        check(ModelPolicy.label(new String(new char[200]).replace('\0','x')).length()==100);
        for(String mode:new String[]{"copilot","deliberate","research"}){
            String prompt=LocalPrompt.build(mode,"Review the saved metrics","{\"quoteFreshness\":\"Older market quote\",\"pnl\":null}");
            check(prompt.contains("NO internet"));check(prompt.contains("Older market quote"));check(prompt.contains("\"pnl\":null"));
        }
        rejects(()->LocalPrompt.build("orders","buy", "{}"));
        rejects(()->LocalPrompt.build("copilot","", "{}"));
        rejects(()->LocalPrompt.build("copilot",new String(new char[2001]),"{}"));
        rejects(()->LocalPrompt.build("copilot","review",new String(new char[8001])));
        check(LocalPrompt.build("deliberate","","{}").contains("six headings"));
        Path root=Files.createTempDirectory("hal-local-ai-");
        try {
            ModelStore store=new ModelStore(root.toFile());byte[] good=new byte[(int)ModelPolicy.MIN_BYTES];
            System.arraycopy("LITERTLM".getBytes("US-ASCII"),0,good,0,8);
            AtomicBoolean cancelled=new AtomicBoolean(false);ModelStore.Progress progress=(b,t)->{};
            store.install(new ByteArrayInputStream(good),"First model.litertlm",good.length,null,cancelled,progress);
            check(store.ready());check(store.label().equals("First model.litertlm"));
            byte[] bad=good.clone();bad[0]=0;
            rejects(()->store.install(new ByteArrayInputStream(bad),"bad",bad.length,null,cancelled,progress));
            check(Arrays.equals(Files.readAllBytes(store.file().toPath()),good));
            rejects(()->store.install(new ByteArrayInputStream(good),"short",good.length+1,null,cancelled,progress));
            rejects(()->store.install(new ByteArrayInputStream(good),"checksum",good.length,"0000",cancelled,progress));
            cancelled.set(true);rejects(()->store.install(new ByteArrayInputStream(good),"cancelled",good.length,null,cancelled,progress));cancelled.set(false);
            rejects(()->store.install(new ByteArrayInputStream(good),"cancel midway",good.length,null,cancelled,(b,t)->cancelled.set(true)));cancelled.set(false);
            check(Arrays.equals(Files.readAllBytes(store.file().toPath()),good));
            check(store.label().equals("First model.litertlm"));check(!Files.exists(root.resolve("local-ai/model.part")));
            store.remove();check(!store.ready());
        } finally {try(java.util.stream.Stream<Path> files=Files.walk(root)){files.sorted(java.util.Comparator.reverseOrder()).forEach(path->{try{Files.delete(path);}catch(Exception error){throw new RuntimeException(error);}});}}
        System.out.println("PASS "+checks+" local AI checks: fixed model hosts, prompt bounds, unknown evidence, atomic model import, checksum/size failure and cancellation preserve previous weights.");
    }
}
