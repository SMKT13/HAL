package in.smkt.haldesk;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.time.Instant;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import org.json.JSONArray;
import org.json.JSONObject;

/** Separate encrypted, no-plaintext AI history. Never touches the Room/legacy tradebook. */
final class AiHistoryStore {
    private static final String PREFS="hal_atlas_ai_history_private_v1";
    private static final String ALIAS="hal-atlas-ai-history-v1";
    private static final String DATA="history";
    private final SharedPreferences preferences;
    AiHistoryStore(Context context){preferences=context.getSharedPreferences(PREFS,Context.MODE_PRIVATE);}
    private SecretKey key(boolean create)throws Exception {
        KeyStore store=KeyStore.getInstance("AndroidKeyStore");store.load(null);
        if(store.containsAlias(ALIAS))return (SecretKey)store.getKey(ALIAS,null);
        if(!create)throw new Exception("History encryption key unavailable. Existing records were not erased.");
        KeyGenerator generator=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(ALIAS,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true).build());
        return generator.generateKey();
    }
    private JSONObject loadRaw()throws Exception {
        String raw=preferences.getString(DATA,"");
        if(raw.isEmpty())return AiHistoryRetention.empty();
        String[] parts=raw.split(":",2);if(parts.length!=2)throw new Exception("AI history ciphertext is damaged; no records were erased.");
        Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE,key(false),new GCMParameterSpec(128,Base64.decode(parts[0],Base64.NO_WRAP)));
        cipher.updateAAD(DATA.getBytes(StandardCharsets.UTF_8));
        byte[] plain=cipher.doFinal(Base64.decode(parts[1],Base64.NO_WRAP));
        if(plain.length>524288)throw new Exception("AI history exceeds supported size; no records were erased.");
        return new JSONObject(new String(plain,StandardCharsets.UTF_8));
    }
    private void write(JSONObject doc)throws Exception {
        byte[] plain=doc.toString().getBytes(StandardCharsets.UTF_8);
        if(plain.length>524288)throw new Exception("AI history storage is full. Unpin or delete older reports.");
        Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,key(true));
        cipher.updateAAD(DATA.getBytes(StandardCharsets.UTF_8));
        String encoded=Base64.encodeToString(cipher.getIV(),Base64.NO_WRAP)+":"+
                Base64.encodeToString(cipher.doFinal(plain),Base64.NO_WRAP);
        if(!preferences.edit().putString(DATA,encoded).commit())throw new Exception("AI history could not be saved.");
    }
    synchronized JSONObject list()throws Exception {
        JSONObject original=loadRaw(),current=AiHistoryRetention.prune(original,System.currentTimeMillis());
        if(current.getJSONArray("items").length()!=original.getJSONArray("items").length())write(current);
        return current;
    }
    synchronized JSONObject context(String threadId,String currentRevision,boolean allowPortfolio)throws Exception {
        JSONObject valid=AiHistoryRetention.prune(loadRaw(),System.currentTimeMillis());
        return AiConversationContext.select(valid,threadId,currentRevision,allowPortfolio);
    }
    synchronized void save(String id,String threadId,String question,String mode,JSONObject result,JSONObject evidence)throws Exception {
        if(threadId==null||!threadId.matches("[A-Za-z0-9_-]{1,80}"))
            throw new Exception("Invalid AI conversation identifier.");
        if(id==null||!id.matches("[A-Za-z0-9_-]{1,80}")||question==null||question.length()>2000)
            throw new Exception("Invalid AI history item.");
        String reply=result.optString("reply","");
        if(reply.length()>24000)throw new Exception("AI history answer exceeds the storage limit.");
        String now=Instant.now().toString();
        JSONObject item=new JSONObject().put("id",id).put("conversationId",threadId).put("createdAt",now).put("updatedAt",now)
            .put("question",question).put("mode",mode).put("reply",reply)
            .put("source",result.optString("source","")).put("generatedAt",result.opt("generatedAt"))
            .put("bookRevision",evidence.opt("bookRevision")).put("portfolioIncluded",evidence.optBoolean("portfolioIncluded",false))
            .put("evidenceDigest",AiPolicy.evidenceDigest(evidence)).put("dataAsOf",evidence.opt("quoteAsOf"))
            .put("pinned",false);
        JSONObject structured=result.optJSONObject("structured");
        if(structured!=null && structured.toString().length()<=16000)
            item.put("structured",structured);
        JSONArray agents=result.optJSONArray("agents");if(agents!=null){
            JSONArray safe=new JSONArray();
            for(int i=0;i<Math.min(6,agents.length());i++){
                JSONObject agent=agents.optJSONObject(i);if(agent!=null)
                    safe.put(new JSONObject().put("role",agent.optString("role","")).put("reply",agent.optString("reply","").substring(0,Math.min(1600,agent.optString("reply","").length()))));
            }
            item.put("agents",safe);
        }
        write(AiHistoryRetention.upsert(loadRaw(),item,System.currentTimeMillis()));
    }
    synchronized JSONObject pin(String id,boolean pinned)throws Exception {
        JSONObject next=AiHistoryRetention.setPinned(loadRaw(),id,pinned,System.currentTimeMillis());write(next);return next;
    }
    synchronized JSONObject delete(String id)throws Exception {
        JSONObject next=AiHistoryRetention.remove(loadRaw(),id,System.currentTimeMillis());write(next);return next;
    }
    synchronized JSONObject clear()throws Exception {
        JSONObject empty=AiHistoryRetention.empty();write(empty);return empty;
    }
}
