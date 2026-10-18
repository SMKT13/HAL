package in.smkt.haldesk;

import org.json.JSONObject;
import javax.net.ssl.HttpsURLConnection;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.SocketTimeoutException;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/** Calls the existing HAL AI gateway. No Gemini or broker key enters the WebView. */
final class AiClient {
    JSONObject request(String origin, String viewerKey, String mode, JSONObject body) throws Exception {
        if (viewerKey == null || viewerKey.isEmpty()) throw new Exception("Connect your AI server and viewer key first.");
        if (mode != null && (body == null || !Boolean.TRUE.equals(body.opt("consent"))))
            throw new Exception("Confirm sharing this request with Gemini.");
        byte[] bytes = body == null ? null : body.toString().getBytes(StandardCharsets.UTF_8);
        if (bytes != null && bytes.length > 128000) throw new Exception("This position book is too large for one AI request.");
        HttpsURLConnection connection = (HttpsURLConnection) new URL(AiEndpoint.target(origin, mode)).openConnection();
        try {
            connection.setInstanceFollowRedirects(false);
            connection.setConnectTimeout(20000);
            connection.setReadTimeout(mode == null ? 20000 : 120000);
            connection.setUseCaches(false);
            connection.setRequestProperty("Accept", "application/json");
            connection.setRequestProperty("X-HAL-Viewer-Key", viewerKey);
            connection.setRequestProperty("User-Agent", "HAL-Desk-Android/2.2");
            connection.setRequestMethod(mode == null ? "GET" : "POST");
            if (bytes != null) {
                connection.setDoOutput(true);
                connection.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
                connection.setFixedLengthStreamingMode(bytes.length);
                try (OutputStream output = connection.getOutputStream()) { output.write(bytes); }
            }
            int status = connection.getResponseCode();
            if (status >= 300 && status < 400) throw new Exception("AI server redirect blocked. Check the saved server address.");
            InputStream stream = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
            if (stream == null) throw new Exception("AI server unavailable. Check the server address and connection.");
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            try (InputStream input = stream) {
                byte[] buffer = new byte[8192]; int count;
                while ((count = input.read(buffer)) != -1) {
                    if (output.size() + count > 512000) throw new Exception("AI server response was too large.");
                    output.write(buffer, 0, count);
                }
            }
            JSONObject result;
            try { result = new JSONObject(new String(output.toByteArray(), StandardCharsets.UTF_8)); }
            catch (Exception error) { throw new Exception("The server did not return a HAL AI response. Check its address and version."); }
            if (status >= 400) {
                String message = result.optString("error", "AI request failed. Check the viewer key, server configuration and quota.");
                throw new Exception(message.substring(0, Math.min(message.length(), 800)));
            }
            return result;
        } catch (SocketTimeoutException error) {
            throw new Exception("AI request timed out. No generated answer was substituted; retry when connected.");
        } finally { connection.disconnect(); }
    }
}
