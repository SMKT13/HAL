package in.smkt.haldesk;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk={26,35},manifest=Config.NONE)
public class HistoryImportTest {
    private JSONObject record() throws Exception {
        JSONObject source=new JSONObject().put("id","source:example").put("name","Synthetic").put("row","Sheet 1/3");
        return new JSONObject().put("id","source%3Aexample/Sheet%201%2F3").put("source",source)
            .put("type","CE").put("contractMonth","2025-03").put("strike",125)
            .put("units",8).put("gross",0).put("entry",JSONObject.NULL).put("exit",0);
    }
    private JSONObject book() throws Exception {
        JSONObject h=new JSONObject().put("version",1).put("records",new JSONArray().put(record()));
        return new JSONObject().put("version",4).put("journal",new JSONArray()).put("legs",new JSONArray()).put("history",h);
    }
    @Test public void exactSourceRowsAndNullDatesSurviveAStoreRestart() throws Exception {
        android.content.Context context=RuntimeEnvironment.getApplication();
        context.deleteDatabase("haldesk_book.db");
        BookStore store=new BookStore(context);
        try {store.save(book().toString(),0);} finally {store.close();}
        store=new BookStore(context);
        try {
            JSONObject r=store.load(false).getJSONObject("book").getJSONObject("history").getJSONArray("records").getJSONObject(0);
            assertEquals("source%3Aexample/Sheet%201%2F3",r.getString("id"));
            assertTrue(r.isNull("date"));assertTrue(r.isNull("entry"));assertEquals(0,r.getInt("exit"));
            JSONObject invalid=book();invalid.getJSONObject("history").getJSONArray("records").put(record());
            try {store.save(invalid.toString(),1);fail("duplicate source row accepted");}
            catch(Exception e){assertEquals("duplicate_historical_source_row",e.getMessage());}
            assertEquals(1,store.load(false).getInt("revision"));
        } finally {store.close();}
    }
    @Test public void rejectsMalformedItemAndReconciliationReferences() throws Exception {
        JSONObject invalid=book();
        invalid.getJSONObject("history").getJSONArray("records").getJSONObject(0).put("id","different");
        assertRejected(invalid,"history_source_identity_mismatch");
        invalid=book();invalid.getJSONObject("history").put("excludedJournalIds",new JSONArray().put("unknown"));
        assertRejected(invalid,"invalid_history_journal_reconciliation");
        invalid=book();invalid.getJSONObject("history").getJSONArray("records").getJSONObject(0).put("units",1.5);
        assertRejected(invalid,"invalid_history_units");
    }
    private static void assertRejected(JSONObject b,String reason) {
        try {BookValidator.parse(b.toString());fail("invalid book accepted");}
        catch(Exception e){assertEquals(reason,e.getMessage());}
    }
    private byte[] worksheet(String cells,String relMode) throws Exception {
        ByteArrayOutputStream bytes=new ByteArrayOutputStream();
        try(ZipOutputStream z=new ZipOutputStream(bytes)){
            part(z,"xl/workbook.xml","<workbook xmlns:r='urn:relationships'><sheets><sheet r:id='r1'/></sheets></workbook>");
            part(z,"xl/_rels/workbook.xml.rels","<Relationships><Relationship Id='r1' Target='worksheets/sheet1.xml' "+relMode+"/></Relationships>");
            part(z,"xl/sharedStrings.xml","<sst><si><r><t>Scrip </t></r><r><t>Name</t></r></si></sst>");
            part(z,"xl/worksheets/sheet1.xml","<worksheet><sheetData>"+cells+"</sheetData></worksheet>");
        }
        return bytes.toByteArray();
    }
    private static void part(ZipOutputStream z,String name,String text) throws Exception {
        z.putNextEntry(new ZipEntry(name));z.write(text.getBytes(StandardCharsets.UTF_8));z.closeEntry();
    }
    @Test public void pickerPreservesWorksheetRowAndColumnProvenance() throws Exception {
        byte[] workbook=worksheet("<row r='3'><c r='A3' t='s'><v>0</v></c><c r='C3' t='inlineStr'><is><t>HAL</t></is></c><c r='D3'><v>0</v></c></row>","");
        JSONObject selected=HistoryDocument.read(new ByteArrayInputStream(workbook),"sample.xlsx");
        JSONArray rows=selected.getJSONArray("rows");assertEquals(3,rows.length());assertEquals(0,rows.getJSONArray(0).length());
        JSONArray row=rows.getJSONArray(2);assertEquals("Scrip Name",row.getString(0));assertEquals("",row.getString(1));
        assertEquals("HAL",row.getString(2));assertEquals("0",row.getString(3));
        assertNotEquals(selected.getString("sourceId"),HistoryDocument.read(new ByteArrayInputStream(workbook),"renamed.xlsx").getString("sourceId"));
        assertEquals(selected.getString("sourceHash"),HistoryDocument.read(new ByteArrayInputStream(workbook),"renamed.xlsx").getString("sourceHash"));
    }
    @Test public void correctedAndRenamedFileIdentitiesAreSeparated() throws Exception {
        byte[] original=worksheet("<row r='1'><c r='A1' t='inlineStr'><is><t>HAL</t></is></c></row>","");
        byte[] corrected=worksheet("<row r='1'><c r='A1' t='inlineStr'><is><t>HAL revised</t></is></c></row>","");
        JSONObject first=HistoryDocument.read(new ByteArrayInputStream(original),"HAL.xlsx");
        JSONObject changed=HistoryDocument.read(new ByteArrayInputStream(corrected),"HAL (2).xlsx");
        assertEquals(first.getString("sourceId"),changed.getString("sourceId"));
        assertNotEquals(first.getString("sourceHash"),changed.getString("sourceHash"));
    }
    @Test public void rejectsFormulaAndExternalWorksheetBeforePreview() throws Exception {
        byte[][] rejected={worksheet("<row><c><f>1+2</f><v>3</v></c></row>",""),worksheet("","TargetMode='External'")};
        for(byte[] bytes:rejected){try{HistoryDocument.read(new ByteArrayInputStream(bytes),"test.xlsx");fail("untrusted worksheet accepted");}
        catch(IOException expected){assertFalse(expected.getMessage().isEmpty());}}
    }
    @Test public void historyPickerRejectsBookBackupOrCredentialPayload() throws Exception {
        for(String text:new String[]{"{\"app\":\"HAL Desk\",\"book\":{}}",
             "{\"format\":\"HALDeskHistory\",\"payload\":{\"token\":\"synthetic\"}}"}){
            try{HistoryDocument.read(new ByteArrayInputStream(text.getBytes(StandardCharsets.UTF_8)),"test.json");fail();}
            catch(Exception expected){assertFalse(expected.getMessage().isEmpty());}
        }
    }
}
