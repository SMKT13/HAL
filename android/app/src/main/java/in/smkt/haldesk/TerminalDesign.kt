package `in`.smkt.haldesk

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.automirrored.outlined.ShowChart
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.*
import java.time.Instant
import java.time.format.DateTimeFormatter

private val ink=Color(0xffe5edf5)
private val muted=Color(0xffa5b3c6)
private val cyan=Color(0xff38bdf8)
private val tile=Color(0xff192230)
private val edge=Color(0xff233044)
private val tabs=listOf("Desk","Analysis","F&O","Recovery","Connect")
private val icons=listOf(Icons.Outlined.Dashboard,Icons.AutoMirrored.Outlined.ShowChart,Icons.Outlined.AccountBalanceWallet,Icons.Outlined.TrackChanges,Icons.Outlined.Settings)

@Composable fun DeskNav(index:Int,select:(Int)->Unit){
    NavigationBar(containerColor=Color(0xff101620),tonalElevation=0.dp){
        tabs.forEachIndexed{i,label->NavigationBarItem(i==index,{select(i)},icon={Icon(icons[i],null)},label={Text(label,fontSize=11.sp,maxLines=1)},
            colors=NavigationBarItemDefaults.colors(selectedIconColor=cyan,indicatorColor=Color(0xff102a3a),selectedTextColor=ink,unselectedIconColor=muted,unselectedTextColor=muted))}
    }
}
@Composable fun PageTitle(tab:Int){
    Text("HAL  /  TRADEBOOK",color=cyan,fontWeight=FontWeight.Bold,letterSpacing=2.sp,fontSize=11.sp)
    Text(listOf("Market desk","Market analysis","Open positions","Lifetime recovery","Connections")[tab],color=ink,fontSize=32.sp,lineHeight=36.sp,fontWeight=FontWeight.SemiBold)
}
@Composable fun StatTiles(items:List<Pair<String,String>>){
    Column(verticalArrangement=Arrangement.spacedBy(6.dp)){
        items.chunked(2).forEach{pair->Row(horizontalArrangement=Arrangement.spacedBy(6.dp)){
            pair.forEach{(label,value)->Column(Modifier.weight(1f).background(tile,RoundedCornerShape(8.dp)).padding(10.dp)){
                Text(label,color=muted,fontSize=12.sp)
                Text(value,color=ink,fontFamily=FontFamily.Monospace,fontSize=15.sp,fontWeight=FontWeight.Medium)
            }}
            if(pair.size==1)Spacer(Modifier.weight(1f))
        }}
    }
}
@Composable fun InstrumentHero(q:Quote?,now:Long,busy:Boolean,refresh:()->Unit,money:(Double)->String){
    Column(Modifier.fillMaxWidth().background(Brush.verticalGradient(listOf(Color(0xff102a3a),Color(0xff121821))),RoundedCornerShape(12.dp))
        .border(1.dp,edge,RoundedCornerShape(12.dp)).padding(16.dp),verticalArrangement=Arrangement.spacedBy(6.dp)){
        Row(verticalAlignment=Alignment.CenterVertically){Column(Modifier.weight(1f)){
            Text("HAL  ·  NSE",fontWeight=FontWeight.Bold,color=ink)
            Text("Hindustan Aeronautics",color=muted,fontSize=13.sp)
        };IconButton(onClick=refresh,enabled=!busy){Icon(Icons.Outlined.Refresh,"Refresh market data",tint=cyan)}}
        if(q==null){Text(if(busy)"Fetching quote…" else "Quote unavailable",color=muted);return@Column}
        Text(money(q.price),fontWeight=FontWeight.Bold,fontFamily=FontFamily.Monospace,fontSize=36.sp,color=ink)
        val d=q.price-q.previous
        Text("%+.2f   (%+.2f%%)".format(d,100*d/q.previous),color=if(d>=0)Color(0xff00d084)else Color(0xffff4d5e),fontFamily=FontFamily.Monospace)
        if(q.candles.size>=2){Spacer(Modifier.height(4.dp));PriceChart(q.candles,21);Text("1M  ·  Daily close and 20/50 EMA",color=muted,fontSize=12.sp)}
        val time=Instant.ofEpochMilli(q.time).atZone(ist)
        val clock=Instant.ofEpochMilli(now).atZone(ist)
        val minute=clock.hour*60+clock.minute
        val session=when{q.cached->"Cached";clock.dayOfWeek.value>5->"Weekend";minute<555->"Pre-market";minute>930->"Post-market";now-q.time in 0..180000->"Intraday";else->"Last quote"}
        Text(session+" · "+q.source+" · "+time.format(DateTimeFormatter.ofPattern("dd MMM, HH:mm"))+" IST",color=muted,fontSize=12.sp)
    }
}
@Composable fun Details(title:String,body:@Composable ColumnScope.()->Unit){
    var expanded by rememberSaveable(title){mutableStateOf(false)}
    Column(Modifier.fillMaxWidth().border(1.dp,edge,RoundedCornerShape(12.dp)).background(Color(0xff121821),RoundedCornerShape(12.dp))){
        Row(Modifier.fillMaxWidth().clickable{expanded=!expanded}.padding(16.dp),verticalAlignment=Alignment.CenterVertically){
            Text(title,Modifier.weight(1f),fontWeight=FontWeight.SemiBold,color=ink)
            Icon(if(expanded)Icons.Outlined.ExpandLess else Icons.Outlined.ExpandMore,if(expanded)"Collapse" else "Expand",tint=muted)
        }
        if(expanded)Column(Modifier.fillMaxWidth().padding(start=16.dp,end=16.dp,bottom=16.dp),verticalArrangement=Arrangement.spacedBy(6.dp),content=body)
    }
}
