package in.smkt.haldesk;

import android.content.Context;
import android.content.SharedPreferences;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import org.json.JSONObject;

/**
 * Conservative local Gemini-request allowance. A reservation counts a requested
 * stage even if a network failure prevents its completion. Not a billing limit.
 */
final class AiDailyBudget {
    static final int DEFAULT_LIMIT=20;
    private static final String STORE="hal_atlas_ai_budget_private_v1";
    private static final String KEY_DATE="day";
    private static final String KEY_RESERVED="reserved";
    private static final String KEY_LIMIT="limit";
    private static final ZoneId IST=ZoneId.of("Asia/Kolkata");
    private final SharedPreferences prefs;

    AiDailyBudget(Context context) {
        prefs=context.getSharedPreferences(STORE,Context.MODE_PRIVATE);
    }
    static String day(long now) {
        return LocalDate.ofInstant(Instant.ofEpochMilli(now),IST).toString();
    }
    synchronized int limit() {
        return Math.max(1,Math.min(60,prefs.getInt(KEY_LIMIT,DEFAULT_LIMIT)));
    }
    synchronized void setLimit(int newLimit)throws Exception {
        if(newLimit<1||newLimit>60)throw new Exception("Choose a daily AI allowance between 1 and 60.");
        if(!prefs.edit().putInt(KEY_LIMIT,newLimit).commit())
            throw new Exception("Could not save the AI request allowance.");
    }
    private int used(String date) {
        return date.equals(prefs.getString(KEY_DATE,""))?Math.max(0,prefs.getInt(KEY_RESERVED,0)):0;
    }
    synchronized JSONObject status()throws Exception {
        String today=day(System.currentTimeMillis());
        int reserved=used(today),limit=limit();
        return new JSONObject().put("dateIST",today).put("reserved",reserved)
            .put("limit",limit).put("remaining",Math.max(0,limit-reserved))
            .put("estimated",true);
    }
    synchronized void reserve(int count)throws Exception {
        if(count<1||count>6)throw new Exception("Invalid model request count.");
        String today=day(System.currentTimeMillis());
        String previous=prefs.getString(KEY_DATE,"");
        // A clock rollback must not silently restore the allowance.
        if(!previous.isEmpty()&&previous.compareTo(today)>0)
            throw new Exception("Phone date is earlier than the last AI budget record. Check the clock.");
        int reserved=used(today),limit=limit();
        if(reserved>limit-count)
            throw new Exception("Local AI allowance reached. Open AI settings to review the daily request limit. Google billing limits remain separate.");
        if(!prefs.edit().putString(KEY_DATE,today).putInt(KEY_RESERVED,reserved+count).commit())
            throw new Exception("Unable to reserve the local AI request allowance.");
    }
}
