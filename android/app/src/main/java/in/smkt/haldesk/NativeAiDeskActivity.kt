package `in`.smkt.haldesk

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
    keySaved: () -> Boolean
) {
    var tab by remember { mutableIntStateOf(0) }
    var reports by remember { mutableStateOf<List<ReportPreview>>(emptyList()) }
    var historyError by remember { mutableStateOf<String?>(null) }
    var configured by remember { mutableStateOf(false) }
    var showHistory by remember { mutableStateOf(false) }

    LaunchedEffect(tab) {
        val loaded = withContext(Dispatchers.IO) {
            Pair(runCatching { keySaved() }.getOrDefault(false),
                runCatching { parseHistory(history()) })
        }
        configured = loaded.first
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
