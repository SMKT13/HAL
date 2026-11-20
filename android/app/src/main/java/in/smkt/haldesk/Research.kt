package `in`.smkt.haldesk

import android.content.Context
import android.util.Xml
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.*
import org.json.JSONObject
import org.xmlpull.v1.XmlPullParser
import java.time.LocalDate
import kotlin.math.abs

data class Strike(val strike:Double,val callOi:Long?,val callPrice:Double?,val putPrice:Double?,val putOi:Long?,val iv:Double?,val callIv:Double?=null)
data class Chain(val expiry:String,val rows:List<Strike>){
    val complete get()=rows.isNotEmpty() && rows.all{it.callOi!=null && it.putOi!=null}
    val pcr get()=if(complete && rows.sumOf{it.callOi!!}>0)rows.sumOf{it.putOi!!}.toDouble()/rows.sumOf{it.callOi!!} else null
    fun pain()=if(complete)rows.minByOrNull{p-> rows.sumOf{r->(p.strike-r.strike).coerceAtLeast(0.0)*r.callOi!!+(r.strike-p.strike).coerceAtLeast(0.0)*r.putOi!!}}?.strike else null
}
data class Article(val title:String,val url:String,val date:String)
data class ResearchData(val chain:Chain?,val facts:Map<String,Double>,val articles:List<Article>,val note:String="")
class Research(c:Context){
    private val prefs=settings(c)
    private val sources=PublicSources(prefs)
    private val dao=TradebookDb.get(c).book()
    private val http=OkHttpClient.Builder().followRedirects(false).build()
    private fun request(url:String,token:String?=null):String{
        val r=Request.Builder().url(url).header("User-Agent","Mozilla/5.0")
        if(token!=null)r.header("Authorization","Bearer "+token)
        return http.newCall(r.build()).execute().use{require(it.isSuccessful);it.body!!.string()}
    }
    private fun chain(token:String):Chain{
        val root="https://api.upstox.com/v2/option/"
        val key="instrument_key=NSE_EQ%7CINE066F01020"
        val contracts=JSONObject(request(root+"contract?"+key,token)).getJSONArray("data")
        val expiry=(0 until contracts.length()).map{contracts.getJSONObject(it).getString("expiry")}.filter{it>=LocalDate.now(ist).toString()}.min()
        val a=JSONObject(request(root+"chain?"+key+"&expiry_date="+expiry,token)).getJSONArray("data")
        val rows=List(a.length()){i->
            val r=a.getJSONObject(i);val c=r.optJSONObject("call_options");val p=r.optJSONObject("put_options")
            val cm=c?.optJSONObject("market_data");val pm=p?.optJSONObject("market_data")
            fun oi(j:JSONObject?)=j?.takeUnless{it.isNull("oi")}?.getLong("oi")?.takeIf{it>=0}
            fun price(j:JSONObject?)=j?.optDouble("ltp")?.takeIf{it.isFinite()&&it>=0}
            Strike(r.getDouble("strike_price"),oi(cm),price(cm),price(pm),oi(pm),p?.optJSONObject("option_greeks")?.optDouble("iv")?.takeIf{it.isFinite()&&it>0},c?.optJSONObject("option_greeks")?.optDouble("iv")?.takeIf{it.isFinite()&&it>0})
        }
        return Chain(expiry,rows.sortedBy{it.strike})
    }
    private fun facts():Map<String,Double>{
        val r=JSONObject(request("https://query1.finance.yahoo.com/v10/finance/quoteSummary/HAL.NS?modules=summaryDetail,defaultKeyStatistics,financialData")).getJSONObject("quoteSummary").getJSONArray("result").getJSONObject(0)
        val names=mapOf("marketCap" to "Market cap (₹ Cr)","trailingPE" to "P/E TTM","priceToBook" to "P/B","returnOnEquity" to "ROE (%)","trailingEps" to "EPS TTM","dividendYield" to "Dividend yield (%)","revenueGrowth" to "Revenue growth (%)","profitMargins" to "Profit margin (%)","debtToEquity" to "Debt/equity (%)","fiftyTwoWeekHigh" to "52W high","fiftyTwoWeekLow" to "52W low","targetMeanPrice" to "Analyst target")
        return buildMap{for(group in r.keys()){val fields=r.optJSONObject(group)?:continue
            for((k,n) in names){val x=fields.optJSONObject(k)?.optDouble("raw")?:continue
                if(x.isFinite())put(n,when(k){"marketCap"->x/1e7;"returnOnEquity","dividendYield","revenueGrowth","profitMargins"->100*x;else->x})}
        }}
    }
    private fun news():List<Article>{
        val rss=request("https://news.google.com/rss/search?q=Hindustan+Aeronautics+HAL+NSE+stock&hl=en-IN&gl=IN&ceid=IN:en")
        val p=Xml.newPullParser();p.setInput(rss.reader());val rows=mutableListOf<Article>()
        var inside=false;var title="";var url="";var date=""
        while(p.eventType!=XmlPullParser.END_DOCUMENT && rows.size<12){
            if(p.eventType==XmlPullParser.START_TAG)when(p.name){
                "item"->{inside=true;title="";url="";date=""}
                "title"->if(inside)title=p.nextText()
                "link"->if(inside)url=p.nextText()
                "pubDate"->if(inside)date=p.nextText()
            }else if(p.eventType==XmlPullParser.END_TAG && p.name=="item"){inside=false;if(title.isNotBlank()&&url.startsWith("https://"))rows.add(Article(title,url,date))}
            p.next()
        };return rows
    }
    private fun publicChain(json:JSONObject):Chain{
        val rec=json.optJSONObject("records")?:json
        val a=rec.getJSONArray("data")
        val groups=(0 until a.length()).map{a.getJSONObject(it)}.groupBy{it.getString("expiryDate")}
        val fmt=java.time.format.DateTimeFormatter.ofPattern("dd-MMM-yyyy",java.util.Locale.ENGLISH)
        val day=LocalDate.now(ist)
        val expiry=groups.keys.map{key->key to runCatching{LocalDate.parse(key,fmt)}.getOrElse{LocalDate.parse(key)}}.filter{it.second>=day}.minBy{it.second}
        val rows=groups.getValue(expiry.first).map{r->
            val c=r.optJSONObject("CE");val p=r.optJSONObject("PE")
            fun oi(o:JSONObject?)=o?.optLong("openInterest",-1)?.takeIf{it>=0}
            fun value(o:JSONObject?,k:String)=o?.optDouble(k)?.takeIf{it.isFinite()&&it>=0}
            Strike(r.getDouble("strikePrice"),oi(c),value(c,"lastPrice"),value(p,"lastPrice"),oi(p),value(p,"impliedVolatility")?.takeIf{it>0},value(c,"impliedVolatility")?.takeIf{it>0})
        };return Chain(expiry.second.toString(),rows.sortedBy{it.strike})
    }
    suspend fun load()=withContext(Dispatchers.IO){
        val t=prefs.getString("token","").orEmpty()
        var label="Upstox"
        var chain=if(t.isBlank())null else runCatching{chain(t)}.getOrNull()
        if(chain==null && !prefs.getString("mcp","").isNullOrBlank()){
            label="NSE MCP";chain=runCatching{
                val r=sources.rpc("tools/call",JSONObject().put("name",prefs.getString("chainTool","get_option_chain")).put("arguments",JSONObject().put("symbol","HAL")))
                publicChain(r.optJSONObject("structuredContent")?:JSONObject(r.getJSONArray("content").getJSONObject(0).getString("text")))
            }.getOrNull()
        }
        if(chain==null && prefs.getBoolean("nse",true)){
            label="NSE Public";chain=runCatching{publicChain(sources.nse("/api/option-chain-equities?symbol=HAL"))}.getOrNull()
        }
        val gson=com.google.gson.Gson()
        val live=ResearchData(chain,if(prefs.getBoolean("yahoo",true))runCatching{facts()}.getOrDefault(emptyMap()) else emptyMap(),
            if(prefs.getBoolean("news",true))runCatching{news()}.getOrDefault(emptyList()) else emptyList(),
            if(chain!=null)label+" · retrieved "+java.time.ZonedDateTime.now(ist).toLocalDateTime() else "Option chain unavailable")
        if(live.chain!=null || live.facts.isNotEmpty() || live.articles.isNotEmpty()){
            dao.cache(CachedSnapshotEntity("research",gson.toJson(live),System.currentTimeMillis()));live
        }else dao.cached("research")?.let{val cached=gson.fromJson(it.payload,ResearchData::class.java)
            cached.copy(note="Cached · "+cached.note)}?:live
    }
}
