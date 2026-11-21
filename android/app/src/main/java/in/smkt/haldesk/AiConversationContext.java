package in.smkt.haldesk;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import org.json.JSONArray;
import org.json.JSONObject;

/** Pure, bounded, fail-closed context selection from encrypted history records. */
final class AiConversationContext {
    private AiConversationContext() { }

    static JSONObject select(JSONObject document, String conversationId, String activeRevision,
                             boolean allowPortfolio) throws Exception {
        if (conversationId == null || !conversationId.matches("[A-Za-z0-9_-]{1,80}"))
            throw new Exception("Invalid conversation identifier.");
        if (document == null || document.optInt("schema", 0) != 1)
            throw new Exception("AI history schema is unavailable.");
        JSONArray records = document.optJSONArray("items");
        if (records == null) throw new Exception("AI history is unavailable.");
        ArrayList<JSONObject> matches = new ArrayList<>();
        int excluded = 0;
        for (int i = 0; i < records.length(); i++) {
            JSONObject item = records.optJSONObject(i);
            if (item == null) continue;
            String thread = item.optString("conversationId", item.optString("id", ""));
            if (!conversationId.equals(thread)) continue;
            if (item.optBoolean("portfolioIncluded", false) &&
                (!allowPortfolio || activeRevision == null || !activeRevision.equals(item.optString("bookRevision", "")))) {
                excluded++;
                continue;
            }
            if (AiHistoryRetention.time(item) < 0) { excluded++; continue; }
            matches.add(item);
        }
        matches.sort(Comparator.comparingLong(AiHistoryRetention::time));
        int from = Math.max(0, matches.size() - 8);
        JSONArray context = new JSONArray();
        for (int i = from; i < matches.size(); i++) {
            JSONObject item = matches.get(i);
            String question = bounded(item.optString("question", ""), 400);
            String reply = bounded(item.optString("reply", ""), 650);
            if (question.isEmpty() || reply.isEmpty()) continue;
            context.put(new JSONObject().put("question", question).put("reply", reply));
        }
        return new JSONObject().put("conversation", context)
            .put("excludedCount", excluded)
            .put("includedCount", context.length())
            .put("portfolioAllowed", allowPortfolio);
    }

    private static String bounded(String value, int max) {
        String clean = value.replaceAll("[\\p{Cntrl}]", " ").trim();
        return clean.substring(0, Math.min(max, clean.length()));
    }
}
