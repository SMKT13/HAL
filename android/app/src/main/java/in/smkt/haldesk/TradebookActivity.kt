package `in`.smkt.haldesk

import android.app.Application
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import androidx.room.withTransaction
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.time.*
import java.util.UUID

private val bg=Color(0xff0a0e14)
private val surface=Color(0xff121821)
private val accent=Color(0xff38bdf8)
private val green=Color(0xff00d084)
private val red=Color(0xffff4d5e)
private fun currency(x:Double)="₹%,.2f".format(java.util.Locale.forLanguageTag("en-IN"),x)
data class DeskState(val positions:List<FoPositionEntity> = emptyList(),val bookReady:Boolean=false,val ledger:List<TradeLedgerEntity> = emptyList(),
    val quote:Quote?=null,val message:String="",val busy:Boolean=false,val research:ResearchData?=null,val marks:Map<String,ContractMark> = emptyMap())
class MainViewModel(app:Application):AndroidViewModel(app){
    private val db=TradebookDb.get(app)
    val dao=db.book()
    val prefs=settings(app)
    private val markFeed=Marks(app)
    private val broker=Broker(app,db)
    fun sync()=act{val n=broker.sync();ui.update{it.copy(message="Broker sync reviewed "+n+" HAL contracts")}}
    fun test()=act{broker.test();ui.update{it.copy(message="Upstox profile connected")}}
    private val research=Research(app)
    fun saveLeg(row:FoPositionEntity,before:FoPositionEntity?)=act{db.withTransaction{
        if(before!=null)check(dao.removeVersion(before.id,before.payload)==1){"Position changed; reopen the editor"}
        dao.save(row)
    }}
    private val mcp=PublicSources(prefs)
    fun testMcp()=act{kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO){mcp.rpc("tools/list",JSONObject()).getJSONArray("tools")};ui.update{it.copy(message="MCP tools connected")}}
    private val repo=HalRepository(app,dao)
    fun saveGoalSnapshot(payload:String)=act{dao.cache(CachedSnapshotEntity("recovery-goals",payload,System.currentTimeMillis()))}
    private val ui=MutableStateFlow(DeskState())
    val state=combine(ui,dao.positions(),dao.ledger()){s,p,l->s.copy(positions=p,ledger=l,bookReady=true)}
        .catch{emit(ui.value.copy(message="Book unavailable: "+it.message))}
        .stateIn(viewModelScope,SharingStarted.WhileSubscribed(5000),DeskState())
    fun act(block:suspend ()->Unit){viewModelScope.launch{try{block()}catch(e:Exception){ui.update{it.copy(message=e.message?:"Operation failed")}}}}
    fun refresh(){if(ui.value.busy)return;ui.update{it.copy(busy=true,message="")};act{val r=research.load();ui.update{it.copy(research=r)}};act{try{val q=repo.refresh();val marks=runCatching{markFeed.load(dao.positions().first())}.getOrDefault(emptyMap());ui.update{it.copy(quote=q,marks=marks)}}finally{ui.update{it.copy(busy=false)}}}}
    fun close(p:FoPositionEntity,exit:Double)=act{
        val j=JSONObject(p.payload)
        require(exit.isFinite() && exit>=0 && (j.getString("type")!="FUT" || exit>0))
        val gross=(exit-j.getDouble("entry"))*j.getInt("lots")*j.getInt("lotSize")*(if(j.optString("side")=="SELL")-1 else 1)
        val record=JSONObject().put("leg",j.put("id",p.id)).put("exit",exit).put("kind","close").put("date",LocalDate.now(ist))
        db.withTransaction{
            check(dao.removeVersion(p.id,p.payload)==1){"Position changed; review before closing"}
            if(j.optString("instrumentKey").isNotBlank())dao.cache(CachedSnapshotEntity("closed/"+j.getString("instrumentKey"),"{}",System.currentTimeMillis()))
            dao.log(TradeLedgerEntity(UUID.randomUUID().toString(),record.toString(),paise(gross),0))
        }
    }
}
class TradebookActivity:ComponentActivity(){
    private val vm by viewModels<MainViewModel>()
    override fun onCreate(savedInstanceState:Bundle?){super.onCreate(savedInstanceState)
        window.addFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE)
        setContent{MaterialTheme(colorScheme=darkColorScheme(primary=accent,background=bg,surface=surface)){
            Terminal(vm,intent.getIntExtra("tab",0).coerceIn(0,4))
        }}
    }
}
@Composable private fun Panel(title:String,body:@Composable ColumnScope.()->Unit){
    Column(Modifier.fillMaxWidth().border(1.dp,Color(0xff233044),RoundedCornerShape(12.dp))
        .background(surface,RoundedCornerShape(12.dp)).padding(16.dp),verticalArrangement=Arrangement.spacedBy(6.dp)){
        Text(title,style=MaterialTheme.typography.titleMedium);body()
    }
}
@Composable private fun Metric(text:String,color:Color=Color.White){Text(text,color=color,fontFamily=FontFamily.Monospace)}
@Composable private fun Form(title:String,names:List<String>,initial:List<String>,dismiss:()->Unit,save:(List<String>)->Unit){
    val fields=remember{mutableStateListOf(*initial.toTypedArray())}
    var error by remember{mutableStateOf("")}
    AlertDialog(onDismissRequest=dismiss,title={Text(title)},text={Column(Modifier.verticalScroll(rememberScrollState())){
        names.forEachIndexed{i,n->OutlinedTextField(fields[i],{fields[i]=it},visualTransformation=if(n=="Authorization header")PasswordVisualTransformation() else androidx.compose.ui.text.input.VisualTransformation.None,label={Text(n)},singleLine=true)}
        if(error.isNotBlank())Text(error,color=red)
    }},confirmButton={TextButton(onClick={try{save(fields.toList());dismiss()}catch(e:Exception){error=e.message?:"Check values"}}){Text("Save")}},
        dismissButton={TextButton(onClick=dismiss){Text("Cancel")}})
}
@Composable private fun Terminal(vm:MainViewModel,initialTab:Int){
    val s by vm.state.collectAsState()
    var tab by androidx.compose.runtime.saveable.rememberSaveable{mutableIntStateOf(initialTab)}
    var dialog by remember{mutableStateOf("")}
    var chosen by remember{mutableStateOf<FoPositionEntity?>(null)}
    var target by remember{mutableDoubleStateOf(vm.prefs.getString("startingLoss","0")!!.toDouble())}
    var reveal by remember{mutableStateOf(false)}
    var token by remember{mutableStateOf(vm.prefs.getString("token","").orEmpty())}
    var now by remember{mutableLongStateOf(System.currentTimeMillis())}
    LaunchedEffect(Unit){while(true){kotlinx.coroutines.delay(30000);now=System.currentTimeMillis()}}
    var range by remember{mutableIntStateOf(63)}
    val ctx=androidx.compose.ui.platform.LocalContext.current
    val permission=androidx.activity.compose.rememberLauncherForActivityResult(androidx.activity.result.contract.ActivityResultContracts.RequestPermission()){}
    val alerts by vm.dao.alerts().collectAsState(initial=emptyList())
    val freshMarks=s.marks.filterValues{now-it.time in 0..180000}
    val q=s.quote
    val freshSpot=q?.takeIf { !it.cached && now-it.time in 0..180000 }
    var anchor by remember{mutableStateOf(vm.prefs.getStringSet("openingRows",emptySet()).orEmpty().toSet())}
    val recoveryRows=s.ledger.filter{it.id !in anchor}.sortedBy{JSONObject(it.payload).optString("date")}
    val recovered=recoveryRows.sumOf{java.math.BigDecimal.valueOf(it.gross,2)-java.math.BigDecimal.valueOf(it.fees,2)}.toDouble()
    val net=s.ledger.sumOf{java.math.BigDecimal.valueOf(it.gross,2)-java.math.BigDecimal.valueOf(it.fees,2)}.toDouble()
    LaunchedEffect(Unit){vm.refresh()}
    Scaffold(bottomBar={DeskNav(tab){tab=it}}){pad->key(tab){Column(Modifier.fillMaxSize().padding(pad).verticalScroll(rememberScrollState()).padding(horizontal=16.dp,vertical=10.dp),verticalArrangement=Arrangement.spacedBy(10.dp)){
        TextButton(onClick={(ctx as? android.app.Activity)?.finish()}){Text("‹  HAL Atlas")}
        PageTitle(tab)
        if(s.message.isNotBlank())Text(s.message,color=Color(0xfff5a623))
        if(!s.bookReady){if(s.message.isBlank())Text("Opening the saved Atlas book…");return@Column}
        when(tab){
            0->{InstrumentHero(q,now,s.busy,vm::refresh,::currency)
            Panel("Your position"){
                StatTiles(listOf("Live MTM" to (totalMtm(s.positions,freshMarks)?.let(::currency)?:"Marks pending"),"Booked net" to currency(net),
                    "Open legs" to s.positions.size.toString(),"Recovery remaining" to (if(target>0)currency((target-recovered).coerceAtLeast(0.0)) else "Goal unset")))
                if(target>0)LinearProgressIndicator(progress={(recovered/target).toFloat().coerceIn(0f,1f)},modifier=Modifier.fillMaxWidth())
            }
            if(q!=null)Details("Session statistics"){StatTiles(listOf("Open" to q.open,"High" to q.high,"Low" to q.low,"VWAP" to q.vwap).map{it.first to (it.second?.let(::currency)?:"—")}+("Volume" to (q.volume?.toString()?:"—")))}
            val stats=indicators(q?.candles.orEmpty())
            if(q!=null && freshSpot!=null){val votes=mutableListOf<Pair<String,Int>>()
                for(k in listOf("EMA 20","EMA 50"))stats[k]?.let{votes.add(k to q.price.compareTo(it))}
                q.vwap?.let{votes.add("VWAP" to q.price.compareTo(it))};stats["RSI 14"]?.let{votes.add("RSI 14" to (if(it>55)1 else if(it<45)-1 else 0))}
                stats["MACD histogram"]?.let{votes.add("MACD histogram" to it.compareTo(0.0))}
                s.research?.takeUnless{it.note.startsWith("Cached")}?.chain?.pcr?.let{votes.add("OI PCR" to (if(it>1.1)1 else if(it<0.9)-1 else 0))}
                if(votes.isNotEmpty())Panel("Daily market bias"){
                    val score=votes.sumOf{it.second}*100/votes.size
                    Metric((when{score>=70->"Strong bullish";score>=25->"Bullish";score<=-70->"Strong bearish";score<=-25->"Bearish";else->"Neutral"})+"  "+score)
                    votes.forEach{Text(it.first+" · "+when(it.second){1->"bullish";-1->"bearish";else->"neutral"})}
                }
            }
            s.research?.articles?.takeIf{it.isNotEmpty()}?.let{articles->Details("News and catalysts"){articles.forEach{a->
                TextButton(onClick={ctx.startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW,android.net.Uri.parse(a.url)))}){Text(a.title)}
                Text(a.date,style=MaterialTheme.typography.labelSmall)
            }}}
            q?.candles?.lastOrNull()?.let{c->Details("Intraday levels · "+c.day){val p=(c.high+c.low+c.close)/3
                listOf("P" to p,"R1" to 2*p-c.low,"S1" to 2*p-c.high,"R2" to p+c.high-c.low,"S2" to p-c.high+c.low,
                    "R3" to c.high+2*(p-c.low),"S3" to c.low-2*(c.high-p),"Camarilla R3" to c.close+1.1*(c.high-c.low)/4,"Camarilla R4" to c.close+1.1*(c.high-c.low)/2,"Camarilla S3" to c.close-1.1*(c.high-c.low)/4,"Camarilla S4" to c.close-1.1*(c.high-c.low)/2).forEach{Metric(it.first+"   "+currency(it.second))}
            }}}
            1->{var fundamentals by remember{mutableStateOf(false)}
                Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){FilterChip(!fundamentals,{fundamentals=false},{Text("Technicals & OI")});FilterChip(fundamentals,{fundamentals=true},{Text("Fundamentals")})}
                if(fundamentals){Panel("HAL fundamentals"){
                    val facts=s.research?.facts.orEmpty();if(facts.isEmpty())Text("Fundamentals unavailable")
                    facts.forEach{(k,v)->Metric(k+"  %,.2f".format(v))}
                    for(k in listOf("Order book and fresh awards","Engine deliveries and delivery schedule","Revenue conversion","Operating margin","Receivable collections")){
                        var reviewed by remember{mutableStateOf(vm.prefs.getBoolean("reviewed/"+k,false))}
                        Row{Checkbox(reviewed,{reviewed=it;vm.prefs.edit().putBoolean("reviewed/"+k,it).apply()});Text(k)}
                    }
                }}else{Panel("Daily closing prices"){Row{listOf("1M" to 21,"3M" to 63,"6M" to 126,"1Y" to 252).forEach{FilterChip(range==it.second,{range=it.second},{Text(it.first)})}}
                PriceChart(q?.candles.orEmpty(),range);Text("Close · cyan     EMA 20 · amber     EMA 50 · green")}
                Details("Technical indicators"){val rows=indicators(q?.candles.orEmpty());if(rows.isEmpty())Text("Daily candles unavailable")
                    rows.forEach{(k,v)->Metric(k+"   %.2f".format(v))}}
            }
            s.research?.chain?.let{chain->Panel("Option chain · "+chain.expiry){
                    Text(s.research?.note.orEmpty());Text("Call OI / LTP     Strike     Put LTP / OI")
                    chain.rows.sortedBy{kotlin.math.abs(it.strike-(q?.price?:0.0))}.take(11).sortedBy{it.strike}.forEach{r->
                        Metric(listOf(r.callOi,r.callPrice,r.strike,r.putPrice,r.putOi).joinToString("   "){it?.toString()?:"—"})
                    }
                    if(chain.complete){Metric("Call OI wall  "+chain.rows.maxBy{it.callOi!!}.strike);Metric("Put OI wall  "+chain.rows.maxBy{it.putOi!!}.strike)};chain.pcr?.let{Metric("PCR   %.2f".format(it))};chain.pain()?.let{Metric("Max pain   "+currency(it))}
                }}
            }
            2->{Panel("Portfolio overview"){StatTiles(listOf("Net live MTM" to (totalMtm(s.positions,freshMarks)?.let(::currency)?:"Marks pending"),"Open legs" to s.positions.size.toString()))
                Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){Button(onClick={chosen=null;dialog="leg"}){Text("Add leg")};OutlinedButton(onClick={vm.sync()}){Text("Sync Upstox")}}}
                val legs=s.positions.map{JSONObject(it.payload)}
                if(q!=null && freshSpot!=null && legs.isNotEmpty()){
                    val gs=legs.map{j->val iv=s.research?.takeUnless{it.note.startsWith("Cached")}?.chain?.takeIf{it.expiry==j.getString("expiry")}?.rows?.singleOrNull{it.strike==j.optDouble("strike")}?.let{if(j.optString("type")=="PE") it.iv else it.callIv}
                        greeks(j,q.price,iv,LocalDate.now(ist))}
                    if(gs.all{it!=null})Details("Portfolio Greeks · 6.8% rate"){
                        val values=gs.filterNotNull();Metric("Delta %.2f".format(values.sumOf{it.delta}));Metric("Theta/day %.2f".format(values.sumOf{it.thetaDay}));Metric("Vega / IV point %.2f".format(values.sumOf{it.vegaPoint}))}
                }
                if(q!=null && legs.isNotEmpty() && legs.map{it.getString("expiry")}.distinct().size==1){
                    Panel("Expiry payoff · ±15% around spot"){
                        PayoffChart(legs,q.price);Metric("Breakeven  "+breakevens(legs).joinToString { currency(it) }.ifBlank{"—"})
                        Metric("At current spot  "+currency(payoff(legs,q.price)))
                    }
                }else if(legs.size>1){Text("Select a common expiry to compare settlement payoffs.")}
                s.positions.forEach{p->val j=JSONObject(p.payload);Panel(j.optString("side","BUY")+" HAL "+j.getString("type")+" · "+j.getString("expiry")){
                    Metric((j.optString("source","Manual"))+" · BE "+currency(when(j.getString("type")){"FUT"->j.getDouble("entry");"CE"->j.getDouble("strike")+j.getDouble("entry");else->j.getDouble("strike")-j.getDouble("entry")}));Metric("Qty "+j.getInt("lots")*j.getInt("lotSize")+"   Avg "+currency(j.getDouble("entry")))
                    val days=LocalDate.parse(j.getString("expiry")).toEpochDay()-LocalDate.now(ist).toEpochDay()
                    Text(when{days<0->"Expired · reconcile settlement";days<=5->"Rollover window · "+days+" days";else->days.toString()+" days to expiry"})
                    if(q!=null && freshSpot!=null){val iv=s.research?.takeUnless{it.note.startsWith("Cached")}?.chain?.takeIf{it.expiry==j.getString("expiry")}?.rows?.singleOrNull{it.strike==j.optDouble("strike")}?.let{if(j.optString("type")=="PE") it.iv else it.callIv}
                        greeks(j,q.price,iv,LocalDate.now(ist))?.let{Metric("Δ %.2f  Θ/day %.2f  Vega %.2f".format(it.delta,it.thetaDay,it.vegaPoint))}
                    }
                    freshMarks[p.id]?.let{Metric("LTP  "+currency(it.price))};for(k in listOf("stop","target"))if(!j.isNull(k))Metric(k+"  "+currency(j.getDouble(k)))
                    if(!j.isNull("strike"))Metric("Strike "+currency(j.getDouble("strike")))
                    Row{TextButton(onClick={chosen=p;dialog="leg"}){Text("Edit")};TextButton(onClick={chosen=p;dialog="close"}){Text("Close & log")}}
                }}
            }
            3->{riskSignals(vm.prefs,s.positions,s.ledger,freshMarks).values.forEach{Text(it,color=red)};Panel("Recovery goal"){
                val months=vm.prefs.getInt("months",12)
                Text(if(target>0)currency((target-recovered).coerceAtLeast(0.0)) else "Set a starting loss",style=MaterialTheme.typography.headlineMedium)
                if(target>0){Text("Remaining to breakeven");LinearProgressIndicator(progress={(recovered/target).toFloat().coerceIn(0f,1f)},modifier=Modifier.fillMaxWidth())}
                StatTiles(listOf("Starting loss" to currency(target),"Recovered" to currency(recovered),"Monthly pace" to currency((target-recovered).coerceAtLeast(0.0)/months),"Booked net" to currency(net)))
                val trades=recoveryRows.filter{it.id.startsWith("history/") || JSONObject(it.payload).optString("kind")=="close"}
                if(trades.isNotEmpty()){
                    Metric("Win rate  %.1f%%".format(100.0*trades.count{it.gross>it.fees}/trades.size))
                    val loss=trades.sumOf{(it.fees-it.gross).coerceAtLeast(0L)}
                    Metric("Profit factor  "+if(loss==0L)"—" else "%.2f".format(trades.sumOf{(it.gross-it.fees).coerceAtLeast(0L)}.toDouble()/loss))
                }
                Metric("Daily cap  "+vm.prefs.getString("dailyCap","Unset"));Metric("Per-trade cap  "+vm.prefs.getString("tradeCap","Unset"))
                TextButton(onClick={dialog="goal"}){Text("Goals") }}
                Panel("Recovery trajectory"){RecoveryChart(recoveryRows.runningFold(-target){v,r->v+(r.gross-r.fees)/100.0})}
                if(target>0)Panel("Milestones"){for(n in listOf(10,25,50,75,100))Text(n.toString()+"%   "+if(recovered>=target*n/100)"Reached" else "Pending")}
                var page by remember{mutableIntStateOf(0)}
                Panel("Realized ledger"){val last=(s.ledger.size-1).coerceAtLeast(0)/30;val current=page.coerceAtMost(last);s.ledger.asReversed().drop(current*30).take(30).forEach{r->val j=JSONObject(r.payload);Metric(j.optString("date","Opening balance")+"   "+currency((r.gross-r.fees)/100.0))}
                    if(last>0)Row{TextButton(onClick={page=current-1},enabled=current>0){Text("Previous")};TextButton(onClick={page=current+1},enabled=current<last){Text("Next")}}
                    TextButton(onClick={dialog="log"}){Text("Log closed trade")}}
            }
            4->{Details("Upstox daily access token"){OutlinedTextField(token,{token=it},singleLine=true,visualTransformation=if(reveal)androidx.compose.ui.text.input.VisualTransformation.None else PasswordVisualTransformation());TextButton(onClick={reveal=!reveal}){Text(if(reveal)"Hide" else "Show")}
                Text(s.message.takeIf{it.contains("connected",ignoreCase=true)}.orEmpty());Text("Updated "+vm.prefs.getString("tokenUpdated","—"));TextButton(onClick={vm.test()}){Text("Test saved token")};Row{TextButton(onClick={vm.prefs.edit().putString("token",token.trim()).putString("tokenUpdated",LocalDate.now(ist).toString()).apply();vm.refresh()}){Text("Save")}
                    TextButton(onClick={token="";vm.prefs.edit().remove("token").remove("tokenUpdated").apply();SecretStore(ctx).remove("direct")}){Text("Clear")}}}
                Details("NSE MCP server"){
                    Text(vm.prefs.getString("mcp","").orEmpty().ifBlank{"Unconfigured"})
                    TextButton(onClick={dialog="mcp"}){Text("Connection settings")}
                    TextButton(onClick={vm.testMcp()}){Text("Test MCP tools")}}
                Panel("Local alerts"){
                    var on by remember{mutableStateOf(vm.prefs.getBoolean("monitor",false))}
                    Text("15-minute background monitor");Switch(on,{on=it;vm.prefs.edit().putBoolean("monitor",it).apply();Monitor.schedule(ctx,it)})
                    if(android.os.Build.VERSION.SDK_INT>=33)TextButton(onClick={permission.launch(android.Manifest.permission.POST_NOTIFICATIONS)}){Text("Allow notifications")}
                    for(a in alerts){Row{Text(a.kind+" "+currency(a.threshold));Switch(a.enabled,{vm.act{vm.dao.save(a.copy(enabled=it))}});TextButton(onClick={vm.act{vm.dao.remove(a)}}){Text("Delete")}}}
                    TextButton(onClick={dialog="alert"}){Text("New alert")}
                }
                Details("Free data"){var yahoo by remember{mutableStateOf(vm.prefs.getBoolean("yahoo",true))};for((key,label) in listOf("nse" to "NSE Public","news" to "Google News RSS")){var active by remember{mutableStateOf(vm.prefs.getBoolean(key,true))};Text(label);Switch(active,{active=it;vm.prefs.edit().putBoolean(key,it).apply()})};Text("Yahoo Finance");Switch(yahoo,{yahoo=it;vm.prefs.edit().putBoolean("yahoo",it).apply()})}}
        }
    }}}
    val dismiss={dialog=""}
    when(dialog){
        "alert"->Form("HAL spot alert",listOf("Condition: above / below / mtm above / mtm below","Threshold"),listOf("above",""),dismiss){a->
            val v=a[1].toDouble();require(v.isFinite() && (v>0 || a[0].startsWith("mtm")) && a[0] in listOf("above","below","mtm above","mtm below"))
            vm.act{vm.dao.save(PriceAlertEntity(UUID.randomUUID().toString(),when(a[0]){"above"->"Spot ≥";"below"->"Spot ≤";"mtm above"->"MTM ≥";else->"MTM ≤"},v,true))}}
        "mcp"->Form("MCP connection",listOf("Server URL","Authorization header","Quote tool","Chain tool"),
            listOf("mcp","mcpAuth","quoteTool","chainTool").zip(listOf("","","get_stock_quote","get_option_chain")).map{vm.prefs.getString(it.first,it.second).orEmpty()},dismiss){a->
                val e=vm.prefs.edit();listOf("mcp","mcpAuth","quoteTool","chainTool").forEachIndexed{i,k->e.putString(k,a[i])};e.apply();vm.refresh()}
        "goal"->Form("Recovery goals",listOf("Starting loss today (₹)","Timeline (months)","Capital (₹)","Daily loss cap (₹)","Risk per trade (₹)"),
            listOf(target.toString(),vm.prefs.getInt("months",12).toString(),vm.prefs.getString("capital","0")!!,vm.prefs.getString("dailyCap","0")!!,vm.prefs.getString("tradeCap","0")!!),dismiss){a->
            val v=a[0].toDouble();val m=a[1].toInt();require(m>0 && listOf(0,2,3,4).all{a[it].toDouble().isFinite()&&a[it].toDouble()>=0})
            if(target!=v || !vm.prefs.contains("openingRows"))anchor=s.ledger.map{it.id}.toSet()
            target=v;vm.prefs.edit().putStringSet("openingRows",anchor).putString("startingLoss",v.toString()).putInt("months",m)
                .putString("capital",a[2]).putString("dailyCap",a[3]).putString("tradeCap",a[4]).apply();vm.saveGoalSnapshot(JSONObject().put("startingLoss",v).put("months",m).put("capital",a[2]).put("dailyCap",a[3]).put("tradeCap",a[4]).toString())}
        "close"->Form("Close locally",listOf("Actual exit price"),listOf(""),dismiss){a->val v=a[0].toDouble();require(v.isFinite()&&v>=0);vm.close(chosen!!,v)}
        "log"->Form("Completed trade",listOf("Gross profit or loss","Charges","Date"),listOf("","0",LocalDate.now(ist).toString()),dismiss){a->
            val g=paise(a[0].toDouble());val f=paise(a[1].toDouble());require(f>=0 && LocalDate.parse(a[2])<=LocalDate.now(ist))
            vm.act{vm.dao.log(TradeLedgerEntity(UUID.randomUUID().toString(),JSONObject().put("date",a[2]).put("kind","close").toString(),g,f))}}
        "leg"->{val old=chosen?.let{JSONObject(it.payload)}?:JSONObject()
            Form("HAL contract",listOf("BUY or SELL","FUT, CE or PE","Expiry (YYYY-MM-DD)","Strike (options)","Lots","Units per lot","Entry price","Stop-loss (optional)","Target (optional)","Entry date (optional)"),
                listOf(old.optString("side","BUY"),old.optString("type","FUT"),old.optString("expiry"),old.optString("strike"),old.optString("lots","1"),old.optString("lotSize"),old.optString("entry"),old.optString("stop"),old.optString("target"),old.optString("opened")),dismiss){a->
                val side=a[0].uppercase();val type=a[1].uppercase();require(side in listOf("BUY","SELL") && type in listOf("FUT","CE","PE"))
                LocalDate.parse(a[2]);val lots=a[4].toInt();val size=a[5].toInt();val entry=a[6].toDouble()
                require(lots in 1..10000 && size in 1..100000 && entry.isFinite() && entry>=0 && (type!="FUT"||entry>0))
                val id=chosen?.id?:UUID.randomUUID().toString()
                if(old.optString("type")!=type || old.optString("expiry")!=a[2] ||
                    (type!="FUT" && old.optDouble("strike")!=a[3].toDoubleOrNull())) {
                    for(key in listOf("instrumentKey","manual","brokerMark","source","retrievedAt")) old.remove(key)
                }
                old.put("id",id).put("side",side).put("type",type).put("expiry",a[2]).put("lots",lots).put("lotSize",size).put("entry",entry)
                if(a[9].isNotBlank()){require(LocalDate.parse(a[9])<=LocalDate.now(ist));old.put("opened",a[9])}else old.remove("opened")
                for((i,k) in listOf(7 to "stop",8 to "target")){if(a[i].isBlank())old.remove(k) else {val x=a[i].toDouble();require(x.isFinite()&&x>0);old.put(k,x)}}
                if(type!="FUT"){val k=a[3].toDouble();require(k.isFinite()&&k>0);old.put("strike",k)}else old.remove("strike")
                vm.saveLeg(FoPositionEntity(id,old.toString()),chosen)
            }}
    }
}
