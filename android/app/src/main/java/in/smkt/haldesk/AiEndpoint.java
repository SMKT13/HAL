package in.smkt.haldesk;

import java.net.URI;
import java.util.Locale;

/** AI destinations are chosen in native settings; paths are fixed by the app. */
final class AiEndpoint {
    static String normalize(String value) throws Exception {
        if (value == null || value.length() > 500 || value.matches("(?s).*\\p{Cntrl}.*")) throw new Exception("Enter your HAL server's HTTPS address.");
        URI uri = new URI(value.trim());
        String host = uri.getHost();
        if (!"https".equalsIgnoreCase(uri.getScheme()) || host == null || uri.getRawUserInfo() != null ||
                (uri.getPort() != -1 && uri.getPort() != 443) || uri.getRawQuery() != null || uri.getRawFragment() != null ||
                !(uri.getRawPath() == null || uri.getRawPath().isEmpty() || "/".equals(uri.getRawPath())))
            throw new Exception("Use an HTTPS server origin without a path, query or login details.");
        host = host.toLowerCase(Locale.ROOT);
        if (host.length() > 253 || !host.matches("(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?") ||
                host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".lan"))
            throw new Exception("Use the public HTTPS hostname of your private HAL server.");
        return "https://" + host;
    }

    static String target(String origin, String mode) throws Exception {
        String base = normalize(origin);
        if (mode == null) return base + "/api/config";
        if (!"copilot".equals(mode) && !"deliberate".equals(mode) && !"research".equals(mode))
            throw new Exception("Unknown AI mode.");
        return base + "/api/ai/" + mode;
    }
}
