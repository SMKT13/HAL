package `in`.smkt.haldesk

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withContext
import okhttp3.*
import okhttp3.HttpUrl.Companion.toHttpUrl
import org.json.JSONObject


data class ContractMark(val price:Double,val previous:Double?,val time:Long)
class Marks(c:Context){
    private val prefs=settings(c)
    private val http=OkHttpClient.Builder().followRedirects(false).build()
    suspend fun load(rows:List<FoPositionEntity>):Map<String,ContractMark> = withContext(Dispatchers.IO){
        val token=prefs.getString("token","").orEmpty()
        if(token.isBlank())return@withContext emptyMap()
        val byKey=rows.groupBy{JSONObject(it.payload).optString("instrumentKey")}.filterKeys{it.startsWith("NSE_FO|")}
        if(byKey.isEmpty())return@withContext emptyMap()
        val url="https://api.upstox.com/v2/market-quote/quotes".toHttpUrl().newBuilder().addQueryParameter("instrument_key",byKey.keys.joinToString(",")).build()
        val req=Request.Builder().url(url).header("Authorization","Bearer "+token).build()
        http.newCall(req).execute().use{r->
            require(r.isSuccessful);val data=JSONObject(r.body!!.string()).getJSONObject("data")
            buildMap{
                val now=System.currentTimeMillis()
                for((key,legs) in byKey){
                    val quote=MarketClient.quote(data,key,now) ?: continue
                    if(quote.optString("quality")!="recent") continue
                    val provider=MarketClient.epoch(quote.opt("quote_as_of"))
                    val trade=MarketClient.epoch(quote.opt("last_trade_at"))
                    if(provider>now || trade>now) continue
                    val raw=data.keys().asSequence().mapNotNull { data.optJSONObject(it) }
                        .first { it.optString("instrument_token")==key }
                    val previous=raw.optJSONObject("ohlc")?.optDouble("close")?.takeIf{it.isFinite()&&it>0}
                    for(leg in legs) put(leg.id,ContractMark(quote.getDouble("last_price"),previous,provider))
                }
            }
        }
    }
}
fun totalMtm(legs:List<FoPositionEntity>,marks:Map<String,ContractMark>):Double?{
    if(legs.any{it.id !in marks})return null
    return legs.sumOf{val j=JSONObject(it.payload);(marks.getValue(it.id).price-j.getDouble("entry"))*quantity(j)}
}
fun riskSignals(prefs:android.content.SharedPreferences,legs:List<FoPositionEntity>,ledger:List<TradeLedgerEntity>,marks:Map<String,ContractMark>):Map<String,String>{
    val messages=mutableMapOf<String,String>();val today=java.time.LocalDate.now(ist).toString()
    var day=ledger.filter{JSONObject(it.payload).optString("date")==today}.sumOf{it.gross-it.fees}/100.0
    var dayComplete=true
    for(leg in legs){val p=JSONObject(leg.payload);val mark=marks[leg.id]
        val qty=quantity(p);val buy=qty>0
        val expiry=java.time.LocalDate.parse(p.getString("expiry")).toEpochDay()-java.time.LocalDate.parse(today).toEpochDay()
        if(expiry in 0..3)messages["expiry/"+leg.id]="HAL "+p.getString("type")+" expires "+p.getString("expiry")
        val entry=p.getDouble("entry");val stop=p.optDouble("stop");val target=p.optDouble("target")
        val limit=prefs.getString("tradeCap","0")!!.toDouble()
        if(limit>0 && stop.isFinite() && (entry-stop)*qty>limit)messages["risk/"+leg.id]="Configured stop exceeds the per-trade cap"
        if(mark==null){dayComplete=false;continue}
        if(stop.isFinite() && (if(buy)mark.price<=stop else mark.price>=stop))messages["stop/"+leg.id]="HAL stop-loss crossed"
        if(target.isFinite() && (if(buy)mark.price>=target else mark.price<=target))messages["target/"+leg.id]="HAL target reached"
        if(limit>0 && (entry-mark.price)*qty>=limit)messages["risk/"+leg.id]="Per-trade loss cap reached"
        val reference=if(p.optString("opened")==today)entry else if(p.has("opened") && p.getString("opened")<today)mark.previous else null
        if(reference==null)dayComplete=false else day+=(mark.price-reference)*qty
    }
    val cap=prefs.getString("dailyCap","0")!!.toDouble()
    if(dayComplete && cap>0 && day <= -cap)messages["day/"+today]="Daily loss cap reached"
    return messages
}
