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

/** Opt-in, offline financial headline classification. No position or headline is uploaded. */
final class FinbertClassifier {
    // Xenova/finbert ONNX quantization of ProsusAI/finbert, output order POSITIVE, NEGATIVE, NEUTRAL.
    static final String MODEL_URL = "https://huggingface.co/Xenova/finbert/resolve/main/onnx/model_quantized.onnx";
    static final String VOCAB_URL = "https://huggingface.co/Xenova/finbert/resolve/main/vocab.txt";
    static final String MODEL_SHA256 = "56cd19c7068ca5670c326816845bb7d7edda508b68a228697a1460d0e821ce76";
    static final String MODEL_NAME = "Xenova/finbert (quantized ONNX)";
    private static final int MAX_TOKENS = 96;
    private static final String[] LABELS = {"positive", "negative", "neutral"};
    private final File dir, model, vocab;
    private final AtomicBoolean installing = new AtomicBoolean(false);
    private Map<String,Integer> vocabulary;
    private OrtSession session;

    interface Progress { void update(int percent); }
    FinbertClassifier(File files) {
        dir = new File(files, "offline-finbert");
        model = new File(dir, "model.onnx");
        vocab = new File(dir, "vocab.txt");
    }
    synchronized boolean ready() {
        return model.isFile() && model.length() > 80_000_000L &&
               vocab.isFile() && vocab.length() > 100_000;
    }
    boolean isInstalling() { return installing.get(); }

    void install(Progress progress) throws Exception {
        if (!installing.compareAndSet(false, true)) throw new IllegalStateException("Model download already running");
        try {
            if (ready()) { progress.update(100); return; }
            if (!dir.exists() && !dir.mkdirs()) throw new IOException("Cannot create private model folder");
            // Download to temporary files, cap file size and validate the published weights SHA-256.
            download(MODEL_URL, model, 200_000_000L, MODEL_SHA256, p -> progress.update(p * 98 / 100));
            download(VOCAB_URL, vocab, 500_000L, null, p -> progress.update(98 + p * 2 / 100));
            if (!ready()) throw new IOException("Model or tokenizer was incomplete");
            progress.update(100);
        } finally { installing.set(false); }
    }
    private static void download(String address, File dest, long cap, String sha, Progress progress) throws Exception {
        File part = new File(dest.getPath() + ".part");
        if (part.exists()) part.delete();
        HttpURLConnection conn = null;
        try {
            URL url = new URL(address);
            for (int redirect = 0; redirect < 6; redirect++) {
                if (!"https".equals(url.getProtocol())) throw new IOException("Only HTTPS model downloads permitted");
                conn = (HttpURLConnection)url.openConnection();
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
                        total += n; if (total > cap) throw new IOException("Model exceeds allowed download size");
                        digest.update(block, 0, n); out.write(block, 0, n);
                        progress.update((int)Math.min(99, total * 100 / (length > 0 ? length : cap)));
                    }
                }
                if (total < (sha == null ? 100_000L : 80_000_000L))
                    throw new IOException("Model download truncated");
                if (sha != null) {
                    StringBuilder hex = new StringBuilder();
                    for (byte b : digest.digest()) hex.append(String.format(Locale.ROOT, "%02x", b & 255));
                    if (!sha.equals(hex.toString())) throw new IOException("Model checksum mismatch");
                }
                if (dest.exists() && !dest.delete()) throw new IOException("Cannot replace old model");
                if (!part.renameTo(dest)) throw new IOException("Cannot save model");
                return;
            }
            throw new IOException("Too many HTTPS redirects");
        } finally { if (conn != null) conn.disconnect(); if (part.exists()) part.delete(); }
    }

    private synchronized void init() throws Exception {
        if (!ready()) throw new IOException("Download the offline model first");
        if (session != null) return;
        Map<String,Integer> tokens = new HashMap<>();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(new FileInputStream(vocab), StandardCharsets.UTF_8))) {
            String line; int id = 0;
            while ((line = reader.readLine()) != null) tokens.put(line.trim(), id++);
        }
        if (!tokens.containsKey("[CLS]") || !tokens.containsKey("[SEP]") || !tokens.containsKey("[UNK]"))
            throw new IOException("Tokenizer vocabulary invalid");
        OrtSession prepared = OrtEnvironment.getEnvironment().createSession(model.getAbsolutePath(), new OrtSession.SessionOptions());
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
    synchronized JSONArray score(JSONArray items) throws Exception {
        init();
        JSONArray output = new JSONArray();
        OrtEnvironment env = OrtEnvironment.getEnvironment();
        int count = Math.min(12, items.length());
        for (int index = 0; index < count; index++) {
            JSONObject item = items.optJSONObject(index); if (item == null) continue;
            String title = item.optString("title", "").trim();
            String id = item.optString("id", "");
            if (title.isEmpty() || title.length() > 480 || id.length() > 500) continue;
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
                    Object raw = result.get(0).getValue();
                    if (!(raw instanceof float[][])) throw new IOException("Unexpected ONNX output");
                    float[] logits = ((float[][])raw)[0];
                    if (logits.length != LABELS.length) throw new IOException("Unexpected label count");
                    double max = Math.max(logits[0], Math.max(logits[1], logits[2]));
                    double total = 0; double[] probs = new double[3];
                    for (int i = 0; i < 3; i++) total += probs[i] = Math.exp(logits[i] - max);
                    int best = 0; for (int i = 1; i < 3; i++) if (probs[i] > probs[best]) best = i;
                    output.put(new JSONObject().put("id", id).put("label", LABELS[best])
                        .put("confidence", probs[best] / total));
                }
            } finally { for (OnnxTensor tensor : inputs.values()) tensor.close(); }
        }
        return output;
    }
    synchronized void close() { if (session != null) { session.close(); session = null; } }
}
