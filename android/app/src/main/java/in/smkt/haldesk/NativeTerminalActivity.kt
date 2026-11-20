package in.smkt.haldesk

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

/** Read-only Compose terminal based on the Library design.
 * Retains schema-1 BookStore as the sole authoritative book. */
class NativeTerminalActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        setContent { TerminalScreen(this, onClose = { finish() }) }
    }
}
private val dark = Color(0xFF0A1124)
private val panel = Color(0xFF15243B)
private val edge = Color(0xFF2C4563)
private val cyan = Color(0xFF68E7E8)
private val muted = Color(0xFFB1C4DA)
private data class Leg(val type: String, val expiry: String, val lots: Int?, val lotSize: Int?, val entry: Double?, val strike: Double?)
private data class Snapshot(val loading: Boolean = false, val issue: String? = null, val savedAt: Long? = null, val legs: List<Leg> = emptyList())
private fun finite(v: Double): Double? = v.takeIf { it.isFinite() && it >= 0.0 }
private fun money(v: Double?): String = v?.let { NumberFormat.getCurrencyInstance(Locale("en", "IN")).format(it) } ?: "Not recorded"
private fun readSnapshot(context: Context): Snapshot = try {
    BookStore(context).use { store ->
        val original = store.load(false)
        val book = original.optJSONObject("book")
        if (book == null) Snapshot(issue = "No saved book found. Nothing has been changed.")
        else {
            val arr = book.optJSONArray("legs")
            val legs = if (arr == null) emptyList() else (0 until arr.length()).mapNotNull { i ->
                val row: JSONObject = arr.optJSONObject(i) ?: return@mapNotNull null
                Leg(row.optString("type"), row.optString("expiry").ifBlank { "Unavailable" },
                    row.optInt("lots",0).takeIf { it > 0 }, row.optInt("lotSize",0).takeIf { it > 0 },
                    finite(row.optDouble("entry",Double.NaN)),finite(row.optDouble("strike",Double.NaN)))
            }
            Snapshot(savedAt = original.optLong("updatedAt",0).takeIf { it > 0 },legs = legs)
        }
    }
} catch (_: Exception) {
    Snapshot(issue = "Saved book unavailable or failed validation. Nothing was changed. Use the existing recovery screen.")
}
@Composable private fun TerminalScreen(context: Context, onClose: () -> Unit) {
    val state by produceState(initialValue = Snapshot(loading = true),key1 = context) {
        value = withContext(Dispatchers.IO) { readSnapshot(context) }
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
                        Text(when(leg.type){"FUT"->"Long future";"PE"->"Protective put";else->"Unverified contract"},fontWeight=FontWeight.SemiBold)
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
                if (!state.loading && state.issue == null) {
                    val c = nominalCoverage(state.legs.map { ExposureLeg(it.type, it.expiry, it.lots, it.lotSize) },
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
                Panel("Analysis and market data"){
                    Text("Open the full desk for verified Upstox/NSE quotes, hedge scenarios and lifetime P&L.",color=muted)
                    Text("This preview does not substitute the HAL spot price for futures or option marks.",color=cyan,fontSize=12.sp)
                    Button(onClick=onClose){Text("Return to full HAL analysis")}
                }
                Text("Read-only preview · no broker orders · no database writes.",color=muted,fontSize=11.sp)
            }
        }
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
