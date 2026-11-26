package `in`.smkt.haldesk

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import kotlin.math.*

val ist:ZoneId=ZoneId.of("Asia/Kolkata")
val halKey="NSE_EQ|INE066F01020"
fun settings(c:Context)=EncryptedSharedPreferences.create(c,"tradebook_private",
    MasterKey.Builder(c).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM).also{prefs->
        synchronized(SecretStore::class.java){
            if(!prefs.contains("legacyCredentialsChecked")){
                val old=SecretStore(c)
                if(old.has("direct") && !prefs.contains("token")){
                    val token=old.get("direct")
                    check(prefs.edit().putString("token",token).putBoolean("legacyCredentialsChecked",true).commit())
                }else check(prefs.edit().putBoolean("legacyCredentialsChecked",true).commit())
            }
        }
    }
data class Candle(val day:LocalDate,val open:Double,val high:Double,val low:Double,val close:Double)
data class Quote(val price:Double,val previous:Double,val source:String,val time:Long,val candles:List<Candle>,val cached:Boolean=false,val open:Double?=null,val high:Double?=null,val low:Double?=null,val vwap:Double?=null,val volume:Long?=null)
class HalRepository(c:Context,private val dao:BookDao){
    private val prefs=settings(c)
    private val sources=PublicSources(prefs)
    private val http=OkHttpClient.Builder().followRedirects(false).build()
    private fun get(url:String,token:String?=null):JSONObject{
        val req=Request.Builder().url(url).header("User-Agent","HAL-Atlas/5.4.0")
        token?.let{req.header("Authorization","Bearer "+it)}
        return http.newCall(req.build()).execute().use{require(it.isSuccessful){"Market service HTTP "+it.code};JSONObject(it.body!!.string())}
    }
    private fun yahoo():Quote{
        val r=get("https://query1.finance.yahoo.com/v8/finance/chart/HAL.NS?interval=1d&range=2y").getJSONObject("chart").getJSONArray("result").getJSONObject(0)
        val meta=r.getJSONObject("meta")
        require(meta.getString("symbol")=="HAL.NS" && meta.getString("currency")=="INR")
        val ts=r.getJSONArray("timestamp")
        val v=r.getJSONObject("indicators").getJSONArray("quote").getJSONObject(0)
        val today=LocalDate.now(ist)
        val bars=(0 until ts.length()).mapNotNull{i->
            val date=Instant.ofEpochSecond(ts.getLong(i)).atZone(ist).toLocalDate()
            if(date>=today || listOf("open","high","low","close").any{v.getJSONArray(it).isNull(i)}) null
            else Candle(date,v.getJSONArray("open").getDouble(i),v.getJSONArray("high").getDouble(i),v.getJSONArray("low").getDouble(i),v.getJSONArray("close").getDouble(i))
        }
        val time=meta.getLong("regularMarketTime")*1000
        val day=Instant.ofEpochMilli(time).atZone(ist).toLocalDate()
        val i=ts.length()-1
        fun field(k:String)=v.getJSONArray(k).optDouble(i).takeIf{it.isFinite()}
        return Quote(meta.getDouble("regularMarketPrice"),bars.last{it.day<day}.close,"Yahoo",time,bars,open=field("open"),high=field("high"),low=field("low"),volume=field("volume")?.toLong())
    }
    suspend fun refresh():Quote=withContext(Dispatchers.IO){
        val token=prefs.getString("token","").orEmpty()
        val broker=if(token.isBlank())null else runCatching{
            val q=get("https://api.upstox.com/v2/market-quote/quotes?instrument_key=NSE_EQ%7CINE066F01020",token).getJSONObject("data").getJSONObject("NSE_EQ:HAL")
            require(q.getString("instrument_token")==halKey)
            val provider=MarketClient.epoch(q.opt("timestamp"))
            val trade=MarketClient.epoch(q.opt("last_trade_time"))
            require(provider>0 && trade>0 && trade<=provider+60000)
            val t=minOf(provider,trade)
            val o=q.getJSONObject("ohlc")
            Quote(q.getDouble("last_price"),o.getDouble("close"),"Upstox",t,emptyList(),open=o.getDouble("open"),high=o.getDouble("high"),low=o.getDouble("low"),
                vwap=q.optDouble("average_price").takeIf{it.isFinite() && it>0},volume=q.optLong("volume",-1).takeIf{it>=0})
        }.getOrNull()
        val public=if(prefs.getBoolean("yahoo",true))runCatching{yahoo()}.getOrNull() else null
        val mcp=if(broker==null && !prefs.getString("mcp","").isNullOrBlank())runCatching{sources.mcpQuote()}.getOrNull() else null
        val nse=if(broker==null && mcp==null && public==null && prefs.getBoolean("nse",true))runCatching{sources.nseQuote()}.getOrNull() else null
        val live=listOfNotNull(broker,mcp,public,nse).filter{it.price>0 && it.previous>0 && it.time in 1..System.currentTimeMillis()}
        val quote=live.firstOrNull{System.currentTimeMillis()-it.time<300000}?:live.maxByOrNull{it.time}
        if(quote!=null){
            val bars=if(token.isNotBlank())runCatching{
                val day=LocalDate.now(ist)
                val data=get("https://api.upstox.com/v2/historical-candle/NSE_EQ%7CINE066F01020/day/"+day+"/"+day.minusYears(2),token)
                    .getJSONObject("data").getJSONArray("candles")
                List(data.length()){i->val a=data.getJSONArray(i);Candle(LocalDate.parse(a.getString(0).take(10)),a.getDouble(1),a.getDouble(2),a.getDouble(3),a.getDouble(4))}
                    .filter{it.day<day}.distinctBy{it.day}.sortedBy{it.day}.also{require(it.isNotEmpty())}
            }.getOrElse{public?.candles.orEmpty()} else public?.candles.orEmpty()
            val rows=org.json.JSONArray()
            bars.forEach{rows.put(org.json.JSONArray(listOf(it.day.toString(),it.open,it.high,it.low,it.close)))}
            val json=JSONObject().put("price",quote.price).put("previous",quote.previous).put("source",quote.source).put("time",quote.time).put("bars",rows).put("open",quote.open).put("high",quote.high).put("low",quote.low).put("vwap",quote.vwap).put("volume",quote.volume)
            dao.cache(CachedSnapshotEntity("spot",json.toString(),System.currentTimeMillis()))
            quote.copy(candles=bars)
        }else{
            val q=JSONObject(requireNotNull(dao.cached("spot")){"No HAL quote available"}.payload)
            val a=q.getJSONArray("bars")
            Quote(q.getDouble("price"),q.getDouble("previous"),q.getString("source"),q.getLong("time"),List(a.length()){i->val b=a.getJSONArray(i);Candle(LocalDate.parse(b.getString(0)),b.getDouble(1),b.getDouble(2),b.getDouble(3),b.getDouble(4))},true,q.optDouble("open").takeIf{it.isFinite()},q.optDouble("high").takeIf{it.isFinite()},q.optDouble("low").takeIf{it.isFinite()},q.optDouble("vwap").takeIf{it.isFinite()},q.optLong("volume",-1).takeIf{it>=0})
        }
    }
}
fun ema(xs:List<Double>,n:Int):List<Double>{
    if(xs.size<n)return emptyList()
    val values=mutableListOf(xs.take(n).average())
    for(x in xs.drop(n))values.add(values.last()+(x-values.last())*2/(n+1))
    return values
}
fun indicators(b:List<Candle>):Map<String,Double>{
    val x=b.map{it.close}; val out=linkedMapOf<String,Double>()
    for(n in listOf(9,20,50,200))ema(x,n).lastOrNull()?.let{out["EMA "+n]=it}
    val dif=x.zipWithNext{a,c->c-a}
    fun wilder(a:List<Double>):Double=a.drop(14).fold(a.take(14).average()){v,d->(v*13+d)/14}
    if(dif.size>=14){
        val up=wilder(dif.map{max(0.0,it)});val down=wilder(dif.map{max(0.0,-it)})
        out["RSI 14"]=if(up+down==0.0)50.0 else 100*up/(up+down)
        out["ATR 14"]=wilder(b.zipWithNext{p,c->max(c.high-c.low,max(abs(c.high-p.close),abs(c.low-p.close)))})
    }
    val slow=ema(x,26);val macd=ema(x,12).takeLast(slow.size).zip(slow){a,c->a-c}
    ema(macd,9).lastOrNull()?.let{out["MACD histogram"]=macd.last()-it}
    if(x.size>=20){val xs=x.takeLast(20);val m=xs.average();val sd=sqrt(xs.map{(it-m)*(it-m)}.average());out["Bollinger upper"]=m+2*sd;out["Bollinger lower"]=m-2*sd}
    return out
}
