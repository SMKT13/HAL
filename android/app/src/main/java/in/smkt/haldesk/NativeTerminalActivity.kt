package `in`.smkt.haldesk

import android.content.Context
import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.text.NumberFormat
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/** Read-only book review and entry point for the native Room tradebook. */
class NativeTerminalActivity : ComponentActivity() {
    private var visits by mutableIntStateOf(0)
    override fun onResume() { super.onResume(); visits++ }
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        setContent { key(visits) { TerminalScreen(this, onClose = { finish() }) } }
    }
}
private val dark = Color(0xFF0A1124)
private val panel = Color(0xFF15243B)
private val edge = Color(0xFF2C4563)
private val cyan = Color(0xFF68E7E8)
private val muted = Color(0xFFB1C4DA)
private data class Leg(val type: String, val expiry: String, val lots: Int?, val lotSize: Int?, val entry: Double?, val strike: Double?, val side: String = "BUY")
private data class Snapshot(val readable: Boolean = false, val ledgerReconciled:Boolean = false, val loading: Boolean = false, val issue: String? = null, val savedAt: Long? = null, val legs: List<Leg> = emptyList(), val ledgerGross: Long? = null, val ledgerFees: Long? = null, val ledgerNet: Long? = null, val ledgerRows: Long? = null, val nativeRows: Long? = null)
private fun finite(v: Double): Double? = v.takeIf { it.isFinite() && it >= 0.0 }
private fun money(v: Double?): String = v?.let { NumberFormat.getCurrencyInstance(Locale("en", "IN")).format(it) } ?: "Not recorded"
private fun paiseMoney(value: Long?): String = value?.let { NumberFormat.getCurrencyInstance(Locale("en", "IN")).format(java.math.BigDecimal.valueOf(it, 2)) } ?: "Not reconciled"
private fun readSnapshot(context: Context): Snapshot = try {
    // When Library 5.1.24 migrated the database to Room v2, read its native
    // position table WITHOUT triggering the legacy helper's schema downgrade.
    val room = RoomReadOnlyPreview.read(context)
    if (room != null) {
        val entries = room.getJSONArray("legs")
        val visible = (0 until entries.length()).map { i ->
            val row = entries.getJSONObject(i)
            Leg(row.getString("type"),row.getString("expiry"),
                row.getInt("lots"),row.getInt("lotSize"),
                finite(row.getDouble("entry")),finite(row.optDouble("strike",Double.NaN)),
                row.getString("side"))
        }
        Snapshot(readable=true,ledgerReconciled=room.getBoolean("ledgerReconciled"),issue = room.getString("message") + " · Native-only: " +
            room.getInt("nativeOnly") + " · Changed: " + room.getInt("contractDifferences") +
            " · Legacy-only: " + room.getInt("legacyOnly") +
            " · Ledger entries retained: " + room.getLong("ledgerRows"),
            legs = visible, ledgerGross = room.getLong("ledgerGrossPaise"), ledgerFees = room.getLong("ledgerFeesPaise"), ledgerNet = room.getLong("ledgerNetPaise"), ledgerRows = room.getLong("ledgerRows"), nativeRows = room.getLong("nativeLedgerRows"))
    } else BookStore(context).use { store ->
        val original = store.load(false)
        val book = original.optJSONObject("book")
        if (book == null) Snapshot(readable=true,issue = "No saved book found. Nothing has been changed.")
        else {
            val arr = book.optJSONArray("legs")
            val legs = if (arr == null) emptyList() else (0 until arr.length()).mapNotNull { i ->
                val row: JSONObject = arr.optJSONObject(i) ?: return@mapNotNull null
                Leg(row.optString("type"), row.optString("expiry").ifBlank { "Unavailable" },
                    row.optInt("lots",0).takeIf { it > 0 }, row.optInt("lotSize",0).takeIf { it > 0 },
                    finite(row.optDouble("entry",Double.NaN)),finite(row.optDouble("strike",Double.NaN)))
            }
            Snapshot(readable=true,savedAt = original.optLong("updatedAt",0).takeIf { it > 0 },legs = legs)
        }
    }
} catch (_: Exception) {
    Snapshot(issue = "Saved book unavailable or failed validation. Nothing was changed. Use the existing recovery screen.")
}
@Composable private fun TerminalScreen(context: Context, onClose: () -> Unit) {
    var state by remember(context) { mutableStateOf(Snapshot(loading = true)) }
    LaunchedEffect(context) {
        state = withContext(Dispatchers.IO) { readSnapshot(context) }
    }
    MaterialTheme(colorScheme = darkColorScheme(primary = cyan,background = dark,surface = panel,onSurface = Color.White)) {
        Scaffold(containerColor = dark,topBar = {
            Row(Modifier.fillMaxWidth().background(dark).padding(16.dp),horizontalArrangement = Arrangement.SpaceBetween) {
                Column {
                    Text("HAL ATLAS",color=cyan,fontSize=12.sp,letterSpacing=2.sp,fontWeight=FontWeight.Bold)
                    Text("Native terminal",fontSize=23.sp,fontWeight=FontWeight.Bold)
                }
                TextButton(onClick=onClose){Text("Full desk")}
            }
        }) { inset ->
            Column(Modifier.fillMaxSize().padding(inset).verticalScroll(rememberScrollState()).padding(16.dp),verticalArrangement=Arrangement.spacedBy(14.dp)) {
                Card(colors=CardDefaults.cardColors(containerColor=panel),shape=RoundedCornerShape(16.dp)) {
                    Column(Modifier.fillMaxWidth().background(Brush.linearGradient(listOf(Color(0xFF123C55),Color(0xFF251A48)))).padding(16.dp),verticalArrangement=Arrangement.spacedBy(8.dp)) {
                        Text("NSE · HINDUSTAN AERONAUTICS",color=cyan,fontSize=11.sp)
                        Text("Your HAL position",fontSize=27.sp,fontWeight=FontWeight.Bold)
                        Text("Saved-book snapshot · not a live exchange quote",color=muted,fontSize=12.sp)
                        Row(horizontalArrangement=Arrangement.spacedBy(10.dp)) {
                            CountCard("Futures",state.legs.count{it.type=="FUT"},Modifier.weight(1f))
                            CountCard("Puts",state.legs.count{it.type=="PE"},Modifier.weight(1f))
                        }
                    }
                }
                if(state.loading)LinearProgressIndicator(Modifier.fillMaxWidth())
                state.issue?.let { message -> Panel("Data status"){Text(message,color=muted)} }
                Panel("Saved open contracts") {
                    if(!state.loading&&state.legs.isEmpty())Text("No saved contracts to display.",color=muted)
                    state.legs.forEach { leg ->
                        Text(when(leg.type){"FUT"->if(leg.side=="SELL")"Short future" else "Long future";"PE"->if(leg.side=="SELL")"Short put" else "Long put";"CE"->if(leg.side=="SELL")"Short call" else "Long call";else->"Unverified contract"},fontWeight=FontWeight.SemiBold)
                        val qty=if(leg.lots!=null&&leg.lotSize!=null)
                            leg.lots.toString()+" lot(s) · "+(leg.lots.toLong()*leg.lotSize)+" shares"
                            else "Quantity requires verification"
                        Text(qty,color=muted,fontSize=12.sp)
                        Text("Expiry: "+leg.expiry+(leg.strike?.let{" · Strike: "+money(it)}?:""),color=muted,fontSize=12.sp)
                        Text("Recorded entry: "+money(leg.entry),color=cyan)
                        HorizontalDivider(color=edge)
                    }
                    state.savedAt?.let{
                        val time=DateTimeFormatter.ofPattern("dd MMM yyyy HH:mm 'IST'").withZone(ZoneId.of("Asia/Kolkata")).format(Instant.ofEpochMilli(it))
                        Text("Last saved: "+time,color=muted,fontSize=11.sp)
                    }
                }
                if (!state.loading && (state.issue == null || state.ledgerRows != null)) {
                    val c = nominalCoverage(state.legs.map { ExposureLeg(it.type, it.expiry, it.lots, it.lotSize, it.side) },
                        LocalDate.now(ZoneId.of("Asia/Kolkata")))
                    Panel("Hedge coverage & expiry") {
                        Text("Futures shares: " + (c.futures?.toString() ?: "Unavailable"), color=muted)
                        Text("Put shares: " + (c.puts?.toString() ?: "Unavailable"), color=muted)
                        Text("Nominal uncovered shares: " + (c.uncovered?.toString() ?: "Unavailable"), color=cyan)
                        c.notes.forEach { Text(it, color=muted, fontSize=12.sp) }
                        Text("Share-count coverage is not guaranteed downside protection. Strike, expiry and settlement matter.",
                            color=cyan,fontSize=12.sp)
                    }
                }
                if(state.ledgerRows != null) {
                    Panel("Recorded Room ledger · pending reconciliation") {
                        Text("Gross ledger amount: " + paiseMoney(state.ledgerGross), color=muted)
                        Text("Recorded fees: " + paiseMoney(state.ledgerFees), color=muted)
                        Text("Recorded net: " + paiseMoney(state.ledgerNet), color=cyan)
                        Text("Rows: " + state.ledgerRows + " · Native-only ledger rows: " + state.nativeRows, color=muted)
                        Text("Ledger totals are raw saved entries, not verified lifetime P&L or a market valuation. Reconcile original history, charges and completed contracts before relying on them.", color=muted, fontSize=12.sp)
                    }
                }
                Panel("Analysis and market data"){
                    Text("Open the full desk for verified Upstox/NSE quotes, hedge scenarios and lifetime P&L.",color=muted)
                    Text("This preview does not substitute the HAL spot price for futures or option marks.",color=cyan,fontSize=12.sp)
                    Button(onClick=onClose){Text("Return to full HAL analysis")}
                }
                if (state.readable && (state.ledgerRows == null || state.ledgerReconciled)) {
                    TradebookLauncher(context, legacy=state.ledgerRows==null)
                }
                PriceAlertsPanel(context)
                Text("Broker access is read-only. Portfolio edits are saved on this device.",color=muted,fontSize=11.sp)
            }
        }
    }
}

@Composable private fun PriceAlertsPanel(context: Context) {
    val currentAbove=remember { LocalPriceAlerts.threshold(context,"above") }
    val currentBelow=remember { LocalPriceAlerts.threshold(context,"below") }
    var above by remember { mutableStateOf(if(currentAbove.isFinite())currentAbove.toString() else "") }
    var below by remember { mutableStateOf(if(currentBelow.isFinite())currentBelow.toString() else "") }
    var message by remember { mutableStateOf("") }
    Panel("HAL cash price alerts · app open") {
        Text("Evaluated only after a fresh Upstox cash quote. No background monitoring or orders.",
            color=muted,fontSize=12.sp)
        OutlinedTextField(value=above,onValueChange={above=it.take(18)},
            label={Text("Alert when at or above ₹")},singleLine=true,modifier=Modifier.fillMaxWidth())
        OutlinedTextField(value=below,onValueChange={below=it.take(18)},
            label={Text("Alert when at or below ₹")},singleLine=true,modifier=Modifier.fillMaxWidth())
        Button(onClick={
            try{
                val hi=above.trim().takeIf{it.isNotEmpty()}?.toDoubleOrNull()
                val lo=below.trim().takeIf{it.isNotEmpty()}?.toDoubleOrNull()
                require(above.isBlank()||hi!=null){"Invalid upper price"}
                require(below.isBlank()||lo!=null){"Invalid lower price"}
                if(hi!=null)require(hi.isFinite()&&hi>0){"Invalid upper price"}
                if(lo!=null)require(lo.isFinite()&&lo>0){"Invalid lower price"}
                LocalPriceAlerts.configureBoth(context,hi,lo)
                message="Saved locally. Alerts run only while the app is open."
            }catch(e:Exception){message=e.message?:"Invalid price"}
        }){Text("Save thresholds")}
        if(message.isNotBlank())Text(message,color=cyan,fontSize=12.sp)
    }
}
@Composable private fun CountCard(label:String,count:Int,modifier:Modifier=Modifier) {
    Column(modifier.background(Color(0x331A3752),RoundedCornerShape(10.dp)).padding(12.dp)){
        Text(label,color=muted,fontSize=12.sp)
        Text(count.toString(),fontSize=25.sp,fontWeight=FontWeight.Bold)
    }
}
@Composable private fun Panel(title:String,content:@Composable ColumnScope.()->Unit){
    Card(border=BorderStroke(1.dp,edge),colors=CardDefaults.cardColors(containerColor=panel),shape=RoundedCornerShape(14.dp)){
        Column(Modifier.fillMaxWidth().padding(16.dp),verticalArrangement=Arrangement.spacedBy(10.dp)){
            Text(title,fontSize=17.sp,fontWeight=FontWeight.Bold)
            content()
        }
    }
}

@Composable private fun TradebookLauncher(context:Context, legacy:Boolean) {
    var opening by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf("") }
    if(opening) LaunchedEffect(Unit) {
        try {
            withContext(Dispatchers.IO) {
                val db=TradebookDb.get(context)
                db.openHelper.writableDatabase
                val checked=requireNotNull(RoomReadOnlyPreview.read(context))
                require(checked.getBoolean("ledgerReconciled"))
            }
            context.startActivity(android.content.Intent(context,TradebookActivity::class.java))
        } catch (e:Exception) {
            message="Could not open the verified native book. Return to the full desk to review your saved data."
        } finally { opening=false }
    }
    Panel("Native tradebook") {
        if(legacy) Text("Opening the native tradebook upgrades this database to Room v2 and keeps the original book and recovery records.")
        Button(enabled=!opening,onClick={opening=true}) { Text(if(opening) "Opening…" else "Open native tradebook") }
        if(message.isNotEmpty()) Text(message)
    }
}
