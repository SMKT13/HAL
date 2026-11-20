package `in`.smkt.haldesk

import android.content.SharedPreferences
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.HttpUrl.Companion.toHttpUrl
import org.json.JSONObject
import java.time.*
import java.time.format.DateTimeFormatter
import java.util.Locale
import java.util.UUID

class PublicSources(private val prefs:SharedPreferences){
    private val jar=mutableListOf<Cookie>()
    private val http=OkHttpClient.Builder().followRedirects(false).cookieJar(object:CookieJar{
        override fun loadForRequest(url:HttpUrl)=synchronized(jar){jar.filter{it.matches(url)&&it.expiresAt>System.currentTimeMillis()}}
        override fun saveFromResponse(url:HttpUrl,cookies:List<Cookie>){synchronized(jar){for(c in cookies){jar.removeAll{it.name==c.name && it.domain==c.domain && it.path==c.path};jar.add(c)}}}
    }).build()
    fun nse(path:String):JSONObject{
        fun get(path:String)=http.newCall(Request.Builder().url("https://www.nseindia.com"+path).header("User-Agent","Mozilla/5.0").header("Accept","*/*").build()).execute()
        get("/").use{require(it.isSuccessful)}
        return get(path).use{require(it.isSuccessful);JSONObject(it.body!!.string())}
    }
    fun nseQuote():Quote{
        val json=nse("/api/quote-equity?symbol=HAL");val info=json.getJSONObject("metadata")
        require(info.getString("symbol")=="HAL")
        val t=LocalDateTime.parse(info.getString("lastUpdateTime"),DateTimeFormatter.ofPattern("dd-MMM-yyyy HH:mm:ss",Locale.ENGLISH)).atZone(ist).toInstant()
        val p=json.getJSONObject("priceInfo")
        return Quote(p.getDouble("lastPrice"),p.getDouble("previousClose"),"NSE Public",t.toEpochMilli(),emptyList())
    }
    fun rpc(method:String,params:JSONObject):JSONObject{
        var session:String?=null
        var version="2025-03-26"
        fun exchange(action:String,payload:JSONObject,notification:Boolean=false):JSONObject{
        val url=prefs.getString("mcp","").orEmpty().toHttpUrl()
        require(url.isHttps && url.username.isEmpty() && url.password.isEmpty()){"Use an HTTPS MCP endpoint"}
        val id=UUID.randomUUID().toString()
        val body=JSONObject().put("jsonrpc","2.0").put("method",action).put("params",payload).also{if(!notification)it.put("id",id)}
        val req=Request.Builder().url(url).header("Accept","application/json, text/event-stream")
        session?.let{req.header("Mcp-Session-Id",it)};if(action!="initialize")req.header("MCP-Protocol-Version",version)
        prefs.getString("mcpAuth","")?.takeIf{it.isNotEmpty()}?.let{req.header("Authorization",it)}
        return http.newCall(req.post(body.toString().toRequestBody("application/json".toMediaType())).build()).execute().use{res->
            require(res.isSuccessful);res.header("Mcp-Session-Id")?.let{session=it};if(notification)return@use JSONObject()
            val stream=res.body!!
            val reply=if(stream.contentType()?.subtype=="event-stream"){
                val source=stream.source();var found:JSONObject?=null;val data=mutableListOf<String>()
                while(found==null){
                    val line=source.readUtf8Line()?:break
                    if(line.startsWith("data:"))data.add(line.removePrefix("data:").trimStart())
                    if(line.isEmpty()&&data.isNotEmpty()){val obj=JSONObject(data.joinToString("\n"));data.clear();if(obj.optString("id")==id)found=obj}
                };requireNotNull(found)
            }else JSONObject(stream.string())
            require(reply.optString("id")==id);reply.getJSONObject("result")
        }
    }
        val hello=exchange("initialize",JSONObject().put("protocolVersion",version).put("capabilities",JSONObject()).put("clientInfo",JSONObject().put("name","HAL Tradebook").put("version","5.3.0")))
        version=hello.getString("protocolVersion")
        exchange("notifications/initialized",JSONObject(),true)
        return exchange(method,params)
    }
    fun mcpQuote():Quote{
        val result=rpc("tools/call",JSONObject().put("name",prefs.getString("quoteTool","get_stock_quote")).put("arguments",JSONObject().put("symbol","HAL")))
        require(!result.optBoolean("isError"))
        val obj=result.optJSONObject("structuredContent")?:JSONObject(result.getJSONArray("content").getJSONObject(0).getString("text"))
        require(obj.getString("symbol")=="HAL")
        val raw=obj.getString("timestamp");val ts=raw.toLongOrNull()?.let{if(it<100000000000L)it*1000 else it}?:Instant.parse(raw).toEpochMilli()
        return Quote(obj.getDouble("lastPrice"),obj.getDouble("previousClose"),"NSE MCP",ts,emptyList())
    }
}
