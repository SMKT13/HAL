package `in`.smkt.haldesk

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.unit.dp
import org.json.JSONObject
import kotlin.math.abs

@Composable fun PriceChart(bars:List<Candle>,range:Int){
    val x=bars.map{it.close}
    val shown=x.takeLast(range);if(shown.size<2)return
    fun aligned(n:Int)=List<Double?>(minOf(n-1,x.size)){null}+ema(x,n)
    val series=listOf(shown to Color(0xff38bdf8),aligned(20).takeLast(range) to Color(0xfff5a623),aligned(50).takeLast(range) to Color(0xff00d084))
    val values=series.flatMap{it.first.filterNotNull()};val lo=values.min();val span=(values.max()-lo).coerceAtLeast(.01)
    Canvas(Modifier.fillMaxWidth().height(150.dp)){
        for((points,color) in series){
            fun point(i:Int,v:Double)=Offset(i*size.width/(shown.size-1),size.height*(1-(v-lo)/span).toFloat())
            for(i in 1 until points.size){val a=points[i-1]?:continue;val b=points[i]?:continue;drawLine(color,point(i-1,a),point(i,b),1.5.dp.toPx())}
        }
    }
}
@Composable fun PayoffChart(legs:List<JSONObject>,spot:Double){
    val lo=spot*.85;val hi=spot*1.15
    val grid=((0..120).map{lo+(hi-lo)*it/120}+legs.mapNotNull{it.optDouble("strike").takeIf{x->x.isFinite()&&x in lo..hi}}).distinct().sorted()
    val points=grid.map{it to payoff(legs,it)}
    Canvas(Modifier.fillMaxWidth().height(150.dp)){
        val low=minOf(0.0,points.minOf{it.second});val span=(maxOf(0.0,points.maxOf{it.second})-low).coerceAtLeast(.01)
        fun xy(x:Double,y:Double)=Offset(size.width*((x-lo)/(hi-lo)).toFloat(),size.height*(1-(y-low)/span).toFloat())
        val dash=PathEffect.dashPathEffect(floatArrayOf(8f,6f))
        drawLine(Color.Gray,xy(lo,0.0),xy(hi,0.0),pathEffect=dash)
        drawLine(Color.Gray,Offset(size.width/2,0f),Offset(size.width/2,size.height),pathEffect=dash)
        fun segment(a:Pair<Double,Double>,b:Pair<Double,Double>){drawLine(if(a.second+b.second>=0)Color(0xff00d084) else Color(0xffff4d5e),xy(a.first,a.second),xy(b.first,b.second),2.dp.toPx())}
        for((a,b) in points.zipWithNext()){
            if(a.second*b.second<0){val cross=(a.first+(b.first-a.first)*abs(a.second)/(abs(a.second)+abs(b.second))) to 0.0;segment(a,cross);segment(cross,b)}else segment(a,b)
        }
    }
}
fun breakevens(legs:List<JSONObject>):List<Double>{
    val strikes=legs.mapNotNull{it.optDouble("strike").takeIf{x->x.isFinite()&&x>0}}.distinct().sorted()
    val grid=listOf(0.0)+strikes+listOf((strikes.lastOrNull()?:0.0)+1)
    val roots=mutableListOf<Double>()
    grid.zipWithNext().forEachIndexed{i,(a,b)->
        val y=payoff(legs,a);val slope=(payoff(legs,b)-y)/(b-a)
        if(slope!=0.0){val root=a-y/slope;if(root>=a && (root<=b || i==grid.size-2))roots.add(root)}
    };return roots.distinct()
}

@Composable fun RecoveryChart(values:List<Double>){
    if(values.isEmpty())return
    val low=minOf(0.0,values.min());val high=maxOf(0.0,values.max())
    Canvas(Modifier.fillMaxWidth().height(140.dp)){
        fun point(i:Int,v:Double)=Offset(size.width*i/(values.size-1).coerceAtLeast(1),size.height*(1-(v-low)/(high-low).coerceAtLeast(.01)).toFloat())
        val y=point(0,0.0).y.coerceIn(1f,size.height-1f)
        drawLine(Color.Gray,Offset(0f,y),Offset(size.width,y),pathEffect=PathEffect.dashPathEffect(floatArrayOf(8f,6f)))
        for(i in 1 until values.size)drawLine(Color(0xff38bdf8),point(i-1,values[i-1]),point(i,values[i]),2.dp.toPx())
        drawCircle(Color(0xff38bdf8),3.dp.toPx(),point(values.lastIndex,values.last()))
    }
}
