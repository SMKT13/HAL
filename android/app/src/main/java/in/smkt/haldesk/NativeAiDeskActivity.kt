package `in`.smkt.haldesk

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/**
 * Read-only native entry into AI Desk. Approved Gemini calls remain in MainActivity,
 * behind its exact-evidence Android consent dialog. This screen never sends requests.
 */
class NativeAiDeskActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        setContent {
            val open: (String) -> Unit = { page ->
                startActivity(Intent(this, MainActivity::class.java)
                    .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                    .putExtra("open_ai_desk", page))
            }
            NativeAiDesk(onClose = { finish() }, open = open, history = {
                AiHistoryStore(applicationContext).list()
            }, keySaved = {
                SecretStore(applicationContext).has("gemini")
            }, risk = {
                readNativeRisk(applicationContext)
            })
        }
    }
}

private val aiBg = Color(0xFF0B1120)
private val aiCard = Color(0xFF192538)
private val aiAccent = Color(0xFF31C9EE)
private val aiViolet = Color(0xFFA58CF4)
private val aiMuted = Color(0xFFBBC9DB)
private val aiBorder = Color(0xFF34435A)
private val aiDates = DateTimeFormatter.ofPattern("dd MMM yyyy, HH:mm 'IST'")
    .withZone(ZoneId.of("Asia/Kolkata"))

private data class NativeRiskPreview(
    val status: String = "Checking saved Room tradebook…",
    val ledgerNetPaise: Long? = null,
    val ledgerRows: Long = 0,
    val checkedAt: String? = null,
    val futures: Long? = null,
    val puts: Long? = null,
    val uncovered: Long? = null,
    val notes: List<String> = emptyList()
)

/** Room v2 only, opened read-only. Missing/mismatched records never imply zero risk. */
private fun readNativeRisk(context: Context): NativeRiskPreview {
    return try {
        val raw = RoomReadOnlyPreview.read(context)
            ?: return NativeRiskPreview(status = "Legacy or empty book: use the full HAL desk for the current saved position.")
        if (!raw.optBoolean("ledgerReconciled", false))
            return NativeRiskPreview(status = "Saved ledgers disagree. Reconcile Room and legacy records before trusting risk totals.")
        if (raw.optInt("legacyOnly", 0) > 0 || raw.optInt("contractDifferences", 0) > 0)
            return NativeRiskPreview(status = "Legacy and native position records differ. Review the complete book before interpreting exposure.")
        val legs = raw.getJSONArray("legs")
        val exposure = (0 until legs.length()).map { i ->
            val leg = legs.getJSONObject(i)
            ExposureLeg(leg.getString("type"),leg.getString("expiry"),
                leg.getInt("lots"),leg.getInt("lotSize"),leg.optString("side","BUY"))
        }
        val coverage = nominalCoverage(exposure,LocalDate.now(ZoneId.of("Asia/Kolkata")))
        NativeRiskPreview(
            status = if (exposure.isEmpty()) "Reconciled Room v2 ledger; no open contracts recorded."
                     else "Read-only Room v2 position · source: saved device records, not live exchange marks.",
            checkedAt = aiDates.format(Instant.now()),
            ledgerNetPaise = if (raw.getLong("ledgerRows") > 0) raw.getLong("ledgerNetPaise") else null,
            ledgerRows = raw.getLong("ledgerRows"),
            futures = coverage.futures, puts = coverage.puts, uncovered = coverage.uncovered,
            notes = coverage.notes + if (raw.optInt("nativeOnly",0)>0)
                listOf("Native-only position records are included in the Room snapshot.") else emptyList()
        )
    } catch (_: Exception) {
        NativeRiskPreview(status = "Saved-book verification failed. Do not infer exposure or P&L. Original records were not changed.")
    }
}

private data class ReportPreview(
    val id: String, val question: String, val reply: String,
    val updatedAt: String, val pinned: Boolean, val financial: Boolean
)

private fun parseHistory(input: JSONObject): List<ReportPreview> {
    val entries = input.optJSONArray("items") ?: return emptyList()
    return (0 until entries.length()).mapNotNull { i ->
        val record = entries.optJSONObject(i) ?: return@mapNotNull null
        ReportPreview(record.optString("id"), record.optString("question"),
            record.optString("reply"), record.optString("updatedAt"),
            record.optBoolean("pinned"), record.optBoolean("portfolioIncluded"))
    }
}

@Composable
private fun NativeAiDesk(
    onClose: () -> Unit,
    open: (String) -> Unit,
    history: () -> JSONObject,
    keySaved: () -> Boolean,
    risk: () -> NativeRiskPreview
) {
    var tab by remember { mutableIntStateOf(0) }
    var reports by remember { mutableStateOf<List<ReportPreview>>(emptyList()) }
    var historyError by remember { mutableStateOf<String?>(null) }
    var configured by remember { mutableStateOf(false) }
    var showHistory by remember { mutableStateOf(false) }
    var localRisk by remember { mutableStateOf(NativeRiskPreview()) }

    LaunchedEffect(tab) {
        val loaded = withContext(Dispatchers.IO) {
            Triple(runCatching { keySaved() }.getOrDefault(false),
                runCatching { parseHistory(history()) },
                risk())
        }
        configured = loaded.first
        localRisk = loaded.third
        loaded.second.onSuccess {
            reports = it
            historyError = null
        }.onFailure {
            historyError = "Encrypted AI history cannot be read on this device. No saved reports were erased."
            reports = emptyList()
        }
    }

    MaterialTheme(colorScheme = darkColorScheme(
        primary = aiAccent, background = aiBg, surface = aiCard, onSurface = Color.White
    )) {
        Scaffold(containerColor = aiBg, topBar = {
            Row(Modifier.fillMaxWidth().background(aiBg).padding(16.dp),
                horizontalArrangement = Arrangement.SpaceBetween) {
                Column {
                    Text("HAL ATLAS", fontSize = 12.sp, fontWeight = FontWeight.Bold,
                        color = aiAccent, letterSpacing = 2.sp)
                    Text("AI Intelligence", fontSize = 24.sp, fontWeight = FontWeight.Bold)
                }
                TextButton(onClick = onClose) { Text("Back") }
            }
        }) { contentPadding ->
            Column(Modifier.fillMaxSize().padding(contentPadding)) {
                TabRow(selectedTabIndex = tab, containerColor = aiBg,
                    contentColor = aiAccent) {
                    listOf("Brief", "Ask Atlas", "Deep Research").forEachIndexed { index, name ->
                        Tab(selected = tab == index, onClick = { tab = index },
                            text = { Text(name, fontSize = 11.sp, maxLines = 1) })
                    }
                }
                Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())
                    .padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    when (tab) {
                        0 -> {
                            Card(shape = RoundedCornerShape(20.dp),
                                colors = CardDefaults.cardColors(containerColor = aiCard),
                                border = BorderStroke(1.dp, aiBorder)) {
                                Column(Modifier.fillMaxWidth().background(Brush.linearGradient(
                                    listOf(Color(0xFF173957), Color(0xFF281F49))))
                                    .padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                    Text("DAILY INTELLIGENCE", color = aiViolet, fontSize = 11.sp)
                                    Text("What matters for HAL?", fontSize = 25.sp,
                                        fontWeight = FontWeight.Bold)
                                    Text("The full desk evaluates verified quotes, position exposure, hedge gaps, recovery and material changes. This native gateway does not generate a fresh quote or AI request.",
                                        fontSize = 13.sp, color = aiMuted)
                                    Text(if (configured) "Gemini key saved · availability not verified"
                                        else "No Gemini key configured · local intelligence remains available",
                                        fontSize = 12.sp, color = aiAccent)
                                    Button(onClick = { open("brief") }) {
                                        Text("Open intelligent Daily Brief")
                                    }
                                }
                            }
                            val cards = listOf(
                                "Market Outlook" to "Technical signals and verified sources",
                                "Position & Hedge" to "Open legs, protection and expiry review",
                                "Lifetime Recovery" to "Reconciled financial history and recovery gap",
                                "News Impact" to "Issuer filings and dated developments"
                            )
                            cards.chunked(2).forEach { chunk ->
                                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                    chunk.forEach { (title, description) ->
                                        NativeAiCard(title, description, Modifier.weight(1f),
                                            onClick = { open("brief") })
                                    }
                                }
                            }
                            NativeAiPanel("Saved position · local risk review") {
                                Text(localRisk.status, color = aiMuted, fontSize = 12.sp)
                                localRisk.checkedAt?.let { Text("Device records checked $it", color = aiMuted, fontSize = 12.sp) }
                                localRisk.ledgerNetPaise?.let { net ->
                                    val amount = java.math.BigDecimal.valueOf(net, 2).toPlainString()
                                    Text("Recorded ledger net after fees: ₹$amount · ${localRisk.ledgerRows} entries", color = aiMuted)
                                    Text("Open-position marks and lifetime recovery require the full brief.", color = aiMuted, fontSize = 12.sp)
                                }
                                if (localRisk.futures != null && localRisk.puts != null && localRisk.uncovered != null) {
                                    Text("Long futures units: ${localRisk.futures}", color = aiMuted)
                                    Text("Long put units: ${localRisk.puts}", color = aiMuted)
                                    Text("Nominal uncovered units: ${localRisk.uncovered}", color = aiAccent,
                                        fontWeight = FontWeight.Bold)
                                }
                                localRisk.notes.forEach { note ->
                                    Text(note, color = aiMuted, fontSize = 12.sp)
                                }
                                Text("Quantity overlap is not a guaranteed loss floor. No live marks, Greeks or verified lifetime P&L are calculated here.",
                                    color = aiViolet, fontSize = 12.sp)
                                Button(onClick = { open("brief") }) { Text("View full position intelligence") }
                            }
                            Text("No automatic Gemini calls. Every remote analysis requires explicit evidence consent.",
                                color = aiMuted, fontSize = 12.sp)
                            TextButton(onClick = { showHistory = !showHistory }) {
                                Text(if (showHistory) "Hide saved AI history" else "View saved AI history")
                            }
                            if (showHistory) NativeAiHistoryPanel(reports, historyError, open)
                        }
                        1 -> {
                            NativeAiPanel("Ask Atlas") {
                                Text("Ask about HAL trends, recorded futures, protective puts or lifetime recovery. Relevant evidence is selected locally; private records are sent only after approval.",
                                    color = aiMuted, fontSize = 13.sp)
                                Button(onClick = { open("assistant") }) { Text("Open Ask Atlas conversation") }
                            }
                        }
                        2 -> {
                            NativeAiPanel("Six-Perspective Research") {
                                listOf("Technical", "Business & News", "F&O", "Bull",
                                    "Bear", "Risk Chair").forEachIndexed { index, role ->
                                    Text("${index + 1}. $role", color = aiMuted)
                                }
                                Text("A full analysis can make up to six Gemini requests. The exact evidence and request count are shown before consent.",
                                    color = aiMuted, fontSize = 12.sp)
                                Button(onClick = { open("deep") }) { Text("Open Deep Research") }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable private fun NativeAiHistoryPanel(
    reports: List<ReportPreview>, historyError: String?, open: (String) -> Unit
) {
    var expandedId by remember { mutableStateOf<String?>(null) }
                            NativeAiPanel("Local encrypted history") {
                                Text("Ordinary conversations expire 90 days after their last activity. Pinned research is kept until deletion.",
                                    color = aiMuted, fontSize = 12.sp)
                                historyError?.let { Text(it, color = Color(0xFFFFC07B)) }
                                if (reports.isEmpty() && historyError == null)
                                    Text("No locally saved AI reports.", color = aiMuted)
                                reports.forEach { item ->
                                    HorizontalDivider(color = aiBorder)
                                    Column(Modifier.fillMaxWidth().clickable {
                                        expandedId = if (expandedId == item.id) null else item.id
                                    }.padding(vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                                        val whenSaved = runCatching {
                                            aiDates.format(Instant.parse(item.updatedAt))
                                        }.getOrDefault("Date unavailable")
                                        Text(whenSaved + if (item.pinned) " · Pinned" else "",
                                            color = aiViolet, fontSize = 11.sp)
                                        Text(item.question.ifBlank { "Saved AI review" },
                                            fontWeight = FontWeight.SemiBold)
                                        Text(if (item.financial) "Saved position-specific analysis · historical"
                                            else "Saved market/research analysis · historical",
                                            color = aiMuted, fontSize = 11.sp)
                                        if (expandedId == item.id) {
                                            Text(item.reply, fontSize = 13.sp, color = aiMuted)
                                            Text("This saved answer is not a current market quote or risk calculation.",
                                                color = aiAccent, fontSize = 11.sp)
                                        }
                                    }
                                }
                                Button(onClick = { open("assistant") }) {
                                    Text("Manage history / continue conversation")
                                }
                            }
}

@Composable private fun NativeAiCard(
    title: String, subtitle: String, modifier: Modifier = Modifier, onClick: () -> Unit
) {
    Card(modifier.clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = aiCard),
        shape = RoundedCornerShape(16.dp), border = BorderStroke(1.dp, aiBorder)) {
        Column(Modifier.fillMaxWidth().padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(7.dp)) {
            Text(title, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
            Text(subtitle, fontSize = 11.sp, color = aiMuted)
        }
    }
}

@Composable private fun NativeAiPanel(
    title: String, content: @Composable () -> Unit
) {
    Card(colors = CardDefaults.cardColors(containerColor = aiCard),
        shape = RoundedCornerShape(16.dp), border = BorderStroke(1.dp, aiBorder)) {
        Column(Modifier.fillMaxWidth().padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(title, fontSize = 20.sp, fontWeight = FontWeight.SemiBold)
            content()
        }
    }
}
