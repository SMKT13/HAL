package in.smkt.haldesk;
import java.net.URL;
public final class FinbertPolicyTest {
    static int checks;static void check(boolean v){checks++;if(!v)throw new AssertionError("FinBERT policy check "+checks);}
    public static void main(String[] args)throws Exception {
        check(!FinbertClassifier.MODEL_URL.contains("/main/"));check(FinbertClassifier.MODEL_URL.contains(FinbertClassifier.REVISION));
        check(FinbertClassifier.MODEL_SHA256.matches("[a-f0-9]{64}"));check(FinbertClassifier.VOCAB_SHA256.matches("[a-f0-9]{64}"));
        check(FinbertClassifier.MODEL_BYTES==110717965L);check(FinbertClassifier.VOCAB_BYTES==231508L);
        for(String u:new String[]{"https://huggingface.co/model","https://cas-bridge.xethub.hf.co/model","https://cdn-lfs.hf.co/model"})check(FinbertClassifier.allowedDownload(new URL(u)));
        for(String u:new String[]{"http://huggingface.co/model","https://huggingface.co.evil.example/model","https://user:password@huggingface.co/model","https://huggingface.co:8443/model","https://example.org/model"})check(!FinbertClassifier.allowedDownload(new URL(u)));
        check(FinbertClassifier.supportedLanguage("HAL announces earnings","en"));check(FinbertClassifier.supportedLanguage("HAL announces earnings","en-IN"));
        check(!FinbertClassifier.supportedLanguage("HAL announces earnings","fr"));check(!FinbertClassifier.supportedLanguage("हिन्दुस्तान एयरोनॉटिक्स","en"));check(!FinbertClassifier.supportedLanguage("123","en"));
        System.out.println("PASS "+checks+" offline-model download/language policy checks (no model download or inference)");
    }
}
