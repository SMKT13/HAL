package `in`.smkt.haldesk

import org.json.JSONObject
import java.time.LocalDate
import kotlin.math.*

data class Greeks(val delta:Double,val thetaDay:Double,val vegaPoint:Double)
private fun density(x:Double)=exp(-x*x/2)/sqrt(2*Math.PI)
private fun normal(x:Double):Double{
    val t=1/(1+0.2316419*abs(x))
    val upper=density(x)*t*(0.319381530+t*(-0.356563782+t*(1.781477937+t*(-1.821255978+1.330274429*t))))
    return if(x>=0)1-upper else upper
}
fun quantity(j:JSONObject)=j.getLong("lots")*j.getLong("lotSize")*(if(j.optString("side")=="SELL")-1 else 1)
fun greeks(j:JSONObject,spot:Double,iv:Double?,day:LocalDate):Greeks?{
    val qty=quantity(j);val type=j.getString("type")
    val days=LocalDate.parse(j.getString("expiry")).toEpochDay()-day.toEpochDay()
    if(days<0 || spot<=0)return null
    if(type=="FUT")return Greeks(qty.toDouble(),0.0,0.0)
    if(days==0L || iv==null || iv<=0)return null
    val r=0.068;val t=days/365.0;val k=j.getDouble("strike");val vol=iv/100
    val d1=(ln(spot/k)+(r+vol*vol/2)*t)/(vol*sqrt(t));val d2=d1-vol*sqrt(t)
    val sign=if(type=="CE")1 else -1
    val theta=-spot*density(d1)*vol/(2*sqrt(t))-sign*r*k*exp(-r*t)*normal(sign*d2)
    return Greeks(qty*sign*normal(sign*d1),qty*theta/365,qty*spot*density(d1)*sqrt(t)/100)
}
fun payoff(legs:List<JSONObject>,s:Double):Double=legs.sumOf{j->
    val value=when(j.getString("type")){"FUT"->s;"CE"->max(0.0,s-j.getDouble("strike"));else->max(0.0,j.getDouble("strike")-s)}
    quantity(j)*(value-j.getDouble("entry"))
}
