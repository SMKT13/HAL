package in.smkt.haldesk;

import ai.onnxruntime.OnnxTensor;
import ai.onnxruntime.OrtEnvironment;
import ai.onnxruntime.OrtSession;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.text.Normalizer;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;

/** Opt-in, offline financial headline classification. No position or headline is uploaded. */
final class FinbertClassifier {
    // Xenova/finbert ONNX quantization of ProsusAI/finbert, output order POSITIVE, NEGATIVE, NEUTRAL.
    static final String REVISION = "8f269abebfdd9009d7d9b5e96af7e5c6bfe50b20";
    static final String MODEL_URL = "https://huggingface.co/Xenova/finbert/resolve/"+REVISION+"/onnx/model_quantized.onnx";
    static final String VOCAB_URL = "https://huggingface.co/Xenova/finbert/resolve/"+REVISION+"/vocab.txt";
    static final String MODEL_SHA256 = "56cd19c7068ca5670c326816845bb7d7edda508b68a228697a1460d0e821ce76";
    static final String MODEL_NAME = "Xenova/finbert (quantized ONNX)";
    static final String VOCAB_SHA256 = "07eced375cec144d27c900241f3e339478dec958f92fddbc551f295c992038a3";
    static final long MODEL_BYTES=110717965L, VOCAB_BYTES=231508L;
    static final String LICENSE="ProsusAI FinBERT weights: CC BY-NC-SA 4.0; personal, non-commercial use. Xenova ONNX conversion.";
    private static final int MAX_TOKENS = 96;
    private static final String[] LABELS = {"positive", "negative", "neutral"};
    private final File dir, model, vocab;
    private final AtomicBoolean installing = new AtomicBoolean(false);
    private Map<String,Integer> vocabulary;
    private OrtSession session;
    private final AtomicLong operationGeneration=new AtomicLong();
    private volatile HttpURLConnection activeDownload;

    interface Progress { void update(int percent); }
    FinbertClassifier(File files) {
        dir = new File(files, "offline-finbert");
        model = new File(dir, "model.onnx");
        vocab = new File(dir, "vocab.txt");
    }
    synchronized boolean ready() {
        return model.isFile() && model.length() == MODEL_BYTES && vocab.isFile() && vocab.length() == VOCAB_BYTES;
    }
    boolean isInstalling() { return installing.get(); }
    long newOperation(){long ticket=operationGeneration.incrementAndGet();HttpURLConnection c=activeDownload;if(c!=null)c.disconnect();return ticket;}
    void cancel(){operationGeneration.incrementAndGet();HttpURLConnection c=activeDownload;if(c!=null)c.disconnect();}
    private void checkCancelled(long ticket)throws IOException{if(ticket!=operationGeneration.get()||Thread.currentThread().isInterrupted())throw new IOException("Offline operation cancelled");}

    void install(Progress progress) throws Exception {install(progress,newOperation());}
    void install(Progress progress,long ticket) throws Exception {
        checkCancelled(ticket);
        if (!installing.compareAndSet(false, true)) throw new IllegalStateException("Model download already running");
        try {
            checkCancelled(ticket);
            if (ready()&&verify(model,MODEL_SHA256,ticket)&&verify(vocab,VOCAB_SHA256,ticket)) { progress.update(100); return; }
            if (!dir.exists() && !dir.mkdirs()) throw new IOException("Cannot create private model folder");
            // Download to temporary files, cap file size and validate the published weights SHA-256.
            download(MODEL_URL, model, MODEL_BYTES, MODEL_SHA256, p -> progress.update(p * 98 / 100),ticket);
            download(VOCAB_URL, vocab, VOCAB_BYTES, VOCAB_SHA256, p -> progress.update(98 + p * 2 / 100),ticket);
            checkCancelled(ticket);
            if (!ready()) throw new IOException("Model or tokenizer was incomplete");
            progress.update(100);
        } finally { installing.set(false); }
    }
    private void download(String address, File dest, long cap, String sha, Progress progress,long ticket) throws Exception {
        File part = new File(dest.getPath() + ".part");
        if (part.exists()) part.delete();
        HttpURLConnection conn = null;
        try {
            URL url = new URL(address);
            for (int redirect = 0; redirect < 6; redirect++) {
                checkCancelled(ticket);if (!allowedDownload(url)) throw new IOException("Model download destination is not permitted");
                conn = (HttpURLConnection)url.openConnection();
                activeDownload=conn;
                conn.setInstanceFollowRedirects(false);
                conn.setConnectTimeout(15000); conn.setReadTimeout(30000);
                conn.setRequestProperty("User-Agent", "HAL-Desk-Offline-FinBERT/1");
                int status = conn.getResponseCode();
                if (status == 301 || status == 302 || status == 303 || status == 307 || status == 308) {
                    String location = conn.getHeaderField("Location");
                    if (location == null) throw new IOException("Download redirect missing Location");
                    url = new URL(url, location); conn.disconnect(); conn = null; continue;
                }
                if (status != 200) throw new IOException("Model host returned HTTP " + status);
                int length = conn.getContentLength();
                if (length > cap) throw new IOException("Model exceeds allowed download size");
                MessageDigest digest = MessageDigest.getInstance("SHA-256");
                long total = 0;
                try (InputStream in = new BufferedInputStream(conn.getInputStream());
                     OutputStream out = new BufferedOutputStream(new FileOutputStream(part))) {
                    byte[] block = new byte[65536]; int n;
                    while ((n = in.read(block)) != -1) {
                        checkCancelled(ticket);
                        total += n; if (total > cap) throw new IOException("Model exceeds allowed download size");
                        digest.update(block, 0, n); out.write(block, 0, n);
                        progress.update((int)Math.min(99, total * 100 / (length > 0 ? length : cap)));
                    }
                }
                if (total != cap)
                    throw new IOException("Model download truncated");
                if (sha != null) {
                    StringBuilder hex = new StringBuilder();
                    for (byte b : digest.digest()) hex.append(String.format(Locale.ROOT, "%02x", b & 255));
                    if (!sha.equals(hex.toString())) throw new IOException("Model checksum mismatch");
                }
                checkCancelled(ticket);
                if (dest.exists() && !dest.delete()) throw new IOException("Cannot replace old model");
                if (!part.renameTo(dest)) throw new IOException("Cannot save model");
                return;
            }
            throw new IOException("Too many HTTPS redirects");
        } finally { activeDownload=null;if (conn != null) conn.disconnect(); if (part.exists()) part.delete(); }
    }
    static boolean allowedDownload(URL url){
        if(!"https".equals(url.getProtocol())||url.getUserInfo()!=null||(url.getPort()!=-1&&url.getPort()!=443))return false;
        String h=url.getHost().toLowerCase(Locale.ROOT);return h.equals("huggingface.co")||h.equals("cdn-lfs.huggingface.co")||h.equals("cdn-lfs.hf.co")||h.equals("cdn-lfs-us-1.hf.co")||h.equals("cdn-lfs-eu-1.hf.co")||h.equals("cas-bridge.xethub.hf.co");
    }
    private boolean verify(File file,String expected,long ticket)throws Exception{
        MessageDigest digest=MessageDigest.getInstance("SHA-256");try(InputStream in=new BufferedInputStream(new FileInputStream(file))){byte[] b=new byte[65536];int n;while((n=in.read(b))!=-1){checkCancelled(ticket);digest.update(b,0,n);}}
        StringBuilder hex=new StringBuilder();for(byte b:digest.digest())hex.append(String.format(Locale.ROOT,"%02x",b&255));return expected.equals(hex.toString());
    }

    private synchronized void init(long ticket) throws Exception {
        checkCancelled(ticket);
        if (!ready()) throw new IOException("Download the offline model first");
        if (session != null) return;
        if(!verify(model,MODEL_SHA256,ticket)||!verify(vocab,VOCAB_SHA256,ticket))throw new IOException("Model or tokenizer checksum mismatch. Remove and download again.");
        Map<String,Integer> tokens = new HashMap<>();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(new FileInputStream(vocab), StandardCharsets.UTF_8))) {
            String line; int id = 0;
            while ((line = reader.readLine()) != null) tokens.put(line.trim(), id++);
        }
        if (!tokens.containsKey("[CLS]") || !tokens.containsKey("[SEP]") || !tokens.containsKey("[UNK]"))
            throw new IOException("Tokenizer vocabulary invalid");
        OrtSession prepared;try(OrtSession.SessionOptions options=new OrtSession.SessionOptions()){options.setIntraOpNumThreads(2);options.setInterOpNumThreads(1);OrtEnvironment env=OrtEnvironment.getEnvironment();env.setTelemetry(false);prepared=env.createSession(model.getAbsolutePath(),options);}
        try {checkCancelled(ticket);}catch(IOException cancelled){prepared.close();throw cancelled;}
        vocabulary = tokens; session = prepared;
    }
    // BERT uncased basic tokenizer followed by greedy WordPiece. English news only.
    private List<String> words(String input) {
        String normalized = Normalizer.normalize(input.toLowerCase(Locale.ROOT), Normalizer.Form.NFD)
            .replaceAll("\\p{M}+", "");
        ArrayList<String> out = new ArrayList<>();
        StringBuilder word = new StringBuilder();
        for (int i = 0; i < normalized.length(); i++) {
            char c = normalized.charAt(i);
            if (Character.isLetterOrDigit(c) || (c >= 0x4E00 && c <= 0x9FFF)) word.append(c);
            else { if (word.length() > 0) { out.add(word.toString()); word.setLength(0); }
                   if (!Character.isWhitespace(c) && !Character.isISOControl(c)) out.add(String.valueOf(c)); }
        }
        if (word.length() > 0) out.add(word.toString());
        return out;
    }
    private long[] tokenize(String text) {
        ArrayList<Integer> ids = new ArrayList<>();
        ids.add(vocabulary.get("[CLS]"));
        int unknown = vocabulary.get("[UNK]");
        outer: for (String word : words(text)) {
            if (word.length() > 100) { ids.add(unknown); continue; }
            int start = 0; ArrayList<Integer> parts = new ArrayList<>();
            while (start < word.length()) {
                int end = word.length(); Integer matched = null;
                while (start < end) {
                    String piece = (start > 0 ? "##" : "") + word.substring(start, end);
                    matched = vocabulary.get(piece);
                    if (matched != null) break;
                    end--;
                }
                if (matched == null) { parts.clear(); parts.add(unknown); break; }
                parts.add(matched); start = end;
            }
            for (int id : parts) {
                if (ids.size() >= MAX_TOKENS - 1) break outer;
                ids.add(id);
            }
        }
        ids.add(vocabulary.get("[SEP]"));
        long[] result = new long[ids.size()];
        for (int i = 0; i < ids.size(); i++) result[i] = ids.get(i);
        return result;
    }
    JSONArray score(JSONArray items) throws Exception {return score(items,newOperation());}
    synchronized JSONArray score(JSONArray items,long ticket) throws Exception {
        checkCancelled(ticket);
        init(ticket);
        JSONArray output = new JSONArray();
        OrtEnvironment env = OrtEnvironment.getEnvironment();
        int count = Math.min(12, items.length());
        for (int index = 0; index < count; index++) {
            checkCancelled(ticket);
            JSONObject item = items.optJSONObject(index); if (item == null) continue;
            String title = item.optString("title", "").trim();
            String id = item.optString("id", "");
            if (title.isEmpty() || title.length() > 480 || id.length() > 500) continue;
            if(!supportedLanguage(title,item.optString("language","en"))){output.put(new JSONObject().put("id",id).put("label",JSONObject.NULL).put("confidence",JSONObject.NULL).put("status","unsupported_language").put("reason","English financial headlines only."));continue;}
            long[] tokenIds = tokenize(title), mask = new long[tokenIds.length], types = new long[tokenIds.length];
            Arrays.fill(mask, 1L);
            Map<String,OnnxTensor> inputs = new HashMap<>();
            try {
                Set<String> names = session.getInputNames();
                if (names.contains("input_ids")) inputs.put("input_ids", OnnxTensor.createTensor(env, new long[][] {tokenIds}));
                if (names.contains("attention_mask")) inputs.put("attention_mask", OnnxTensor.createTensor(env, new long[][] {mask}));
                if (names.contains("token_type_ids")) inputs.put("token_type_ids", OnnxTensor.createTensor(env, new long[][] {types}));
                if (!inputs.containsKey("input_ids")) throw new IOException("Unexpected ONNX input names");
                try (OrtSession.Result result = session.run(inputs)) {
                    checkCancelled(ticket);
                    Object raw = result.get(0).getValue();
                    if (!(raw instanceof float[][])) throw new IOException("Unexpected ONNX output");
                    float[] logits = ((float[][])raw)[0];
                    if (logits.length != LABELS.length) throw new IOException("Unexpected label count");
                    for(float v:logits)if(Float.isNaN(v)||Float.isInfinite(v))throw new IOException("Invalid model output");
                    double max = Math.max(logits[0], Math.max(logits[1], logits[2]));
                    double total = 0; double[] probs = new double[3];
                    for (int i = 0; i < 3; i++) total += probs[i] = Math.exp(logits[i] - max);
                    int best = 0; for (int i = 1; i < 3; i++) if (probs[i] > probs[best]) best = i;
                    output.put(new JSONObject().put("id", id).put("label", LABELS[best])
                        .put("confidence", probs[best] / total).put("status","classified").put("model",MODEL_NAME).put("revision",REVISION).put("meaning","Text sentiment; not a HAL price forecast."));
                }
            } finally { for (OnnxTensor tensor : inputs.values()) tensor.close(); }
        }
        checkCancelled(ticket);
        return output;
    }
    static boolean supportedLanguage(String text,String language){if(language==null||!language.toLowerCase(Locale.ROOT).matches("en(?:[-_][a-z]{2})?"))return false;int letters=0;for(int i=0;i<text.length();i++){char c=text.charAt(i);if(Character.isLetter(c)){letters++;if(Character.UnicodeScript.of(c)!=Character.UnicodeScript.LATIN)return false;}}return letters>0;}
    synchronized void remove()throws IOException{if(installing.get())throw new IOException("Cancel the download before removing the model");close();vocabulary=null;for(File f:new File[]{model,vocab,new File(model.getPath()+".part"),new File(vocab.getPath()+".part")})if(f.exists()&&!f.delete())throw new IOException("Cannot remove offline model");}
    synchronized void close() { if (session != null) { try { session.close(); } catch (Exception ignored) {} finally { session = null; } } }
}

