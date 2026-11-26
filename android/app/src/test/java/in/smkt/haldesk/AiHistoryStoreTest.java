package in.smkt.haldesk;

import android.content.Context;
import android.content.SharedPreferences;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import org.json.JSONObject;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 28, manifest = Config.NONE)
public class AiHistoryStoreTest {
    private Context context;
    private SharedPreferences preferences;
    private SecretKey key;

    @Before public void setup() throws Exception {
        context = RuntimeEnvironment.getApplication();
        preferences = context.getSharedPreferences("hal_atlas_ai_history_private_v1", Context.MODE_PRIVATE);
        assertTrue(preferences.edit().clear().commit());
        key = KeyGenerator.getInstance("AES").generateKey();
    }

    private AiHistoryStore open() {
        return new AiHistoryStore(context, create -> key);
    }

    private void save(AiHistoryStore store, String id) throws Exception {
        store.save(id, "thread", "Review the position", "copilot",
                new JSONObject().put("reply", "private-answer"), new JSONObject());
    }

    @Test public void encryptedPreferencesSurviveReopenAndPin() throws Exception {
        save(open(), "report1");
        String ciphertext = preferences.getString("history", "");
        assertFalse(ciphertext.isEmpty());
        assertFalse(ciphertext.contains("private-answer"));
        open().pin("report1", true);
        JSONObject item = open().list().getJSONArray("items").getJSONObject(0);
        assertEquals("private-answer", item.getString("reply"));
        assertTrue(item.getBoolean("pinned"));
        open().delete("report1");
        assertEquals(0, open().list().getJSONArray("items").length());
    }

    @Test public void wrongKeyCannotOverwriteUnreadableHistory() throws Exception {
        save(open(), "report1");
        String original = preferences.getString("history", "");
        SecretKey other = KeyGenerator.getInstance("AES").generateKey();
        AiHistoryStore unreadable = new AiHistoryStore(context, create -> other);
        assertThrows(java.security.GeneralSecurityException.class, () -> save(unreadable, "report2"));
        assertEquals(original, preferences.getString("history", ""));
        assertEquals(1, open().list().getJSONArray("items").length());
    }
}
