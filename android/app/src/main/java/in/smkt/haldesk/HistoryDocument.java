package in.smkt.haldesk;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.StringReader;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import org.json.JSONArray;
import org.json.JSONObject;
import org.xmlpull.v1.XmlPullParser;
import org.xmlpull.v1.XmlPullParserFactory;

/** Reads one user-selected document into a preview, without changing the stored book. */
final class HistoryDocument {
    private static final int MAX_INPUT = 2_000_000;
    private static final int MAX_EXPANDED = 8_000_000;
    private static final int MAX_ROWS = 12_000;
    private static final int MAX_COLUMNS = 64;
    private static final int MAX_FIELD = 4096;

    private static IOException invalid(String message) { return new IOException(message); }

    static JSONObject read(InputStream in, String displayName) throws Exception {
        if (in == null) throw invalid("The selected document could not be opened.");
        byte[] bytes = boundedRead(in, MAX_INPUT);
        if (bytes.length == 0) throw invalid("The selected document is empty.");
        if (displayName == null || displayName.trim().isEmpty()) displayName = "HAL statement";
        displayName = displayName.replaceAll("[\\p{Cntrl}]", " ").trim();
        if (displayName.length() > 180) displayName = displayName.substring(0, 180);
        String digest = hex(MessageDigest.getInstance("SHA-256").digest(bytes));
        // Use a stable identity for amended downloads; retain the exact content hash.
        String stableName = displayName.toLowerCase(Locale.ROOT).replaceAll("\\s*\\(\\d+\\)(?=\\.[^.]+$)", "");
        String stableId = hex(MessageDigest.getInstance("SHA-256").digest(stableName.getBytes(StandardCharsets.UTF_8)));
        JSONObject result = new JSONObject().put("sourceId", "document-name-sha256:" + stableId)
                .put("sourceHash", "sha256:" + digest).put("sourceName", displayName);
        if (bytes.length >= 4 && bytes[0] == 'P' && bytes[1] == 'K') {
            return result.put("rows", readWorkbook(bytes));
        }
        String value = new String(bytes, StandardCharsets.UTF_8);
        if (value.startsWith("\ufeff")) value = value.substring(1);
        if (value.trim().startsWith("{")) {
            JSONObject packet = new JSONObject(value);
            BookValidator.rejectCredentials(packet, 0);
            if (!"HALDeskHistory".equals(packet.optString("format")) || packet.optJSONObject("payload") == null)
                throw invalid("Choose a HAL Desk history file. Use Settings to restore a book backup.");
            return packet;
        }
        if (value.indexOf('\0') >= 0 || value.indexOf('\ufffd') >= 0)
            throw invalid("Choose an XLSX, UTF-8 CSV or HAL Desk history JSON document.");
        return result.put("csv", value);
    }

    private static byte[] boundedRead(InputStream input, int maximum) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] block = new byte[8192];
        int count;
        while ((count = input.read(block)) != -1) {
            if (count > maximum - output.size()) throw invalid("The document exceeds the import size limit.");
            output.write(block, 0, count);
        }
        return output.toByteArray();
    }

    private static String hex(byte[] bytes) {
        StringBuilder s = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) s.append(String.format(Locale.ROOT, "%02x", b & 0xff));
        return s.toString();
    }

    private static XmlPullParser xml(byte[] bytes) throws Exception {
        if (bytes == null) throw invalid("The workbook is missing a required XML part.");
        String s = new String(bytes, StandardCharsets.UTF_8);
        if (s.contains("<!DOCTYPE") || s.contains("<!ENTITY") || s.indexOf('\0') >= 0)
            throw invalid("Workbook XML must be UTF-8 and contain no external entities.");
        XmlPullParserFactory f = XmlPullParserFactory.newInstance();
        f.setNamespaceAware(true);
        XmlPullParser p = f.newPullParser();
        p.setInput(new StringReader(s));
        return p;
    }

    private static JSONArray readWorkbook(byte[] bytes) throws Exception {
        Map<String,byte[]> parts = new HashMap<>();
        int total = 0, entries = 0;
        try (ZipInputStream z = new ZipInputStream(new ByteArrayInputStream(bytes))) {
            ZipEntry entry;
            while ((entry = z.getNextEntry()) != null) {
                if (++entries > 500) throw invalid("The workbook has too many archive entries.");
                byte[] value = boundedRead(z, MAX_EXPANDED - total);
                total += value.length;
                String name = entry.getName();
                if (name.equals("xl/workbook.xml") || name.equals("xl/_rels/workbook.xml.rels") ||
                    name.equals("xl/sharedStrings.xml") || name.matches("xl/worksheets/[^/]+\\.xml")) {
                    if (parts.put(name, value) != null) throw invalid("Workbook has duplicate XML parts.");
                }
            }
        }
        XmlPullParser workbook = xml(parts.get("xl/workbook.xml"));
        String id = null;
        for (int t = workbook.next(); t != XmlPullParser.END_DOCUMENT; t = workbook.next()) {
            if (t != XmlPullParser.START_TAG || !"sheet".equals(workbook.getName())) continue;
            if (id != null) throw invalid("Choose a workbook containing one HAL summary worksheet.");
            for (int a = 0; a < workbook.getAttributeCount(); a++)
                if ("id".equals(workbook.getAttributeName(a))) id = workbook.getAttributeValue(a);
            if (id == null) throw invalid("The worksheet reference is missing.");
        }
        if (id == null) throw invalid("The workbook contains no worksheets.");
        XmlPullParser rels = xml(parts.get("xl/_rels/workbook.xml.rels"));
        String target = null;
        for (int t = rels.next(); t != XmlPullParser.END_DOCUMENT; t = rels.next()) {
            if (t != XmlPullParser.START_TAG || !id.equals(rels.getAttributeValue(null,"Id"))) continue;
            String name = rels.getAttributeValue(null,"Target");
            if (name == null || "External".equalsIgnoreCase(rels.getAttributeValue(null,"TargetMode"))) throw invalid("External worksheet references are unsupported.");
            target = name.startsWith("/") ? name.substring(1) : "xl/" + name;
            if (!target.matches("xl/worksheets/[^/]+\\.xml")) throw invalid("Unsupported worksheet path.");
        }
        List<String> strings = sharedStrings(parts.get("xl/sharedStrings.xml"));
        return sheet(xml(parts.get(target)), strings);
    }

    private static List<String> sharedStrings(byte[] bytes) throws Exception {
        List<String> values = new ArrayList<>();
        if (bytes == null) return values;
        XmlPullParser p = xml(bytes);
        StringBuilder field = null;
        for (int t=p.next(); t!=XmlPullParser.END_DOCUMENT; t=p.next()) {
            if (t==XmlPullParser.START_TAG && "si".equals(p.getName())) field=new StringBuilder();
            if (t==XmlPullParser.START_TAG && "t".equals(p.getName()) && field!=null) {
                field.append(p.nextText());
                if (field.length()>MAX_FIELD) throw invalid("A workbook field is too long.");
            }
            if (t==XmlPullParser.END_TAG && "si".equals(p.getName()) && field!=null) {
                if (values.size()>=100000) throw invalid("The workbook contains too many strings.");
                values.add(field.toString());
                field=null;
            }
        }
        return values;
    }

    private static int column(String ref) throws IOException {
        int value = 0;
        for (int i=0; i<ref.length(); i++) {
            char c=ref.charAt(i);
            if (c<'A' || c>'Z') break;
            value=value*26+c-'A'+1;
            if (value>MAX_COLUMNS) throw invalid("The statement exceeds the column limit.");
        }
        if (value==0) throw invalid("Invalid worksheet cell reference.");
        return value-1;
    }

    private static JSONArray sheet(XmlPullParser p, List<String> shared) throws Exception {
        JSONArray rows=new JSONArray(), current=null;
        int col=-1;
        String type=null;
        StringBuilder value=null;
        for (int t=p.next(); t!=XmlPullParser.END_DOCUMENT; t=p.next()) {
            String tag=p.getName();
            if(t==XmlPullParser.START_TAG && "row".equals(tag)){
                String index=p.getAttributeValue(null,"r");
                int row=index==null?rows.length()+1:Integer.parseInt(index);
                if(row<=rows.length() || row>MAX_ROWS) throw invalid("Invalid or oversized worksheet row.");
                while(rows.length()+1<row) rows.put(new JSONArray());
                current=new JSONArray(); rows.put(current); col=-1;
            }else if(t==XmlPullParser.START_TAG && "c".equals(tag) && current!=null){
                String ref=p.getAttributeValue(null,"r");
                int cell=ref==null?col+1:column(ref);
                if(cell<=col||cell>=MAX_COLUMNS)throw invalid("Invalid worksheet column order.");
                col=cell; type=p.getAttributeValue(null,"t"); value=new StringBuilder();
            }else if(t==XmlPullParser.START_TAG && "f".equals(tag) && value!=null){
                throw invalid("Export the HAL statement with values in place of spreadsheet formulas.");
            }else if(t==XmlPullParser.START_TAG && ("v".equals(tag)||"t".equals(tag)) && value!=null){
                value.append(p.nextText());if(value.length()>MAX_FIELD)throw invalid("A statement field is too long.");
            }else if(t==XmlPullParser.END_TAG && "c".equals(tag) && current!=null && value!=null){
                String s=value.toString();
                if("s".equals(type)){
                    int i=Integer.parseInt(s);
                    if(i<0||i>=shared.size()) throw invalid("Invalid shared string reference.");
                    s=shared.get(i);
                }
                while(current.length()<col) current.put("");
                current.put(s); value=null;
            }else if(t==XmlPullParser.END_TAG && "row".equals(tag))current=null;
        }
        return rows;
    }
}
