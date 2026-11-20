package `in`.smkt.haldesk

import android.content.Context
import androidx.room.withTransaction
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withContext
import okhttp3.*
import org.json.JSONObject
import java.util.zip.GZIPInputStream
import com.google.gson.stream.JsonReader
import com.google.gson.JsonParser

class Broker(context:Context,private val db:TradebookDb){
    private val prefs=settings(context)
    private val http=OkHttpClient.Builder().followRedirects(false).build()
    private fun read(path:String):JSONObject{
        require(path in listOf("user/profile","portfolio/short-term-positions"))
        val token=prefs.getString("token",null);require(!token.isNullOrBlank()){"Save an Upstox token first"}
        val req=Request.Builder().url("https://api.upstox.com/v2/"+path).header("Authorization","Bearer "+token).build()
        return http.newCall(req).execute().use{require(it.isSuccessful){"Upstox HTTP "+it.code};JSONObject(it.body!!.string())}
    }
    suspend fun test()=withContext(Dispatchers.IO){require(read("user/profile").getString("status")=="success")}
    suspend fun sync():Int=withContext(Dispatchers.IO){
        val rows=read("portfolio/short-term-positions").getJSONArray("data")
        val positions=(0 until rows.length()).map{rows.getJSONObject(it)}.filter{it.optString("exchange")=="NFO" && it.optInt("quantity")!=0 && it.optString("instrument_token").startsWith("NSE_FO|")}
        val wanted=positions.associateBy{it.getString("instrument_token")}
        require(wanted.size==positions.size){"Multiple broker products share a contract; review them before syncing"}
        val updates=mutableListOf<FoPositionEntity>()
        if(wanted.isNotEmpty()){
            val req=Request.Builder().url("https://assets.upstox.com/market-quote/instruments/exchange/NSE.json.gz").build()
            http.newCall(req).execute().use{response->
                require(response.isSuccessful);JsonReader(GZIPInputStream(response.body!!.byteStream()).reader()).use {reader->
                    reader.beginArray()
                    while(reader.hasNext()){
                        val c=JsonParser.parseReader(reader).asJsonObject
                        val key=c["instrument_key"]?.asString?:continue
                        val p=wanted[key]?:continue
                        if(c["underlying_symbol"]?.asString!="HAL" || c["segment"]?.asString!="NSE_FO")continue
                        val type=c["instrument_type"].asString;require(type in listOf("FUT","PE","CE"))
                        val qty=p.getInt("quantity");val size=c["lot_size"].asInt;require(size>0 && qty%size==0)
                        val expiry=java.time.Instant.ofEpochMilli(c["expiry"].asLong).atZone(ist).toLocalDate()
                        val j=JSONObject().put("type",type).put("side",if(qty>0)"BUY" else "SELL").put("expiry",expiry.toString())
                            .put("lots",kotlin.math.abs(qty)/size).put("lotSize",size).put("entry",p.getDouble("average_price"))
                            .put("instrumentKey",key).put("source","UPSTOX").put("retrievedAt",System.currentTimeMillis())
                        if(type!="FUT")j.put("strike",c["strike_price"].asDouble)
                        if(!p.isNull("last_price"))j.put("brokerMark",p.getDouble("last_price"))
                        if(p.optInt("overnight_quantity",-1)==0)j.put("opened",java.time.LocalDate.now(ist).toString())
                        updates.add(FoPositionEntity(key,j.toString()))
                    }
                }
            }
        }
        val dao=db.book()
        db.withTransaction{
            val existing=dao.positions().first()
            for(row in updates){
                val j=JSONObject(row.payload)
                if(dao.cached("closed/"+row.id)!=null)continue
                val match=existing.filter{val p=JSONObject(it.payload)
                    p.optString("instrumentKey")==row.id || (p.optString("type")==j.getString("type") && p.optString("expiry")==j.getString("expiry")
                        && p.optDouble("strike",0.0)==j.optDouble("strike",0.0) && p.optString("side","BUY")==j.getString("side"))}
                if(match.size>1)error("Multiple local legs match this contract; reconcile before sync")
                val prev=match.singleOrNull()
                require(existing.none { it.id==row.id && it.id!=prev?.id }) {
                    "Broker contract ID belongs to a different saved position"
                }
                if(prev!=null){val p=JSONObject(prev.payload)
                    require(quantity(p)==quantity(j)){"Contract quantity changed; reconcile locally before syncing"}
                    // Keep user fields, manual marks and imported metadata on matching rows.
                    for(k in p.keys()) if(!j.has(k) || k in listOf("entry","opened")) j.put(k,p.get(k))
                    j.put("id",prev.id)
                }
                dao.save(FoPositionEntity(prev?.id?:row.id,j.toString()))
            }
        };updates.size
    }
}
