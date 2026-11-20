package `in`.smkt.haldesk

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.work.*
import kotlinx.coroutines.flow.first
import java.util.concurrent.TimeUnit

class Monitor(context:Context,parameters:WorkerParameters):CoroutineWorker(context,parameters){
    override suspend fun doWork():Result{
        val c=applicationContext
        if(Build.VERSION.SDK_INT>=33 && c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)return Result.success()
        val prefs=settings(c)
        if(!prefs.getBoolean("monitor",false))return Result.success()
        val dao=TradebookDb.get(c).book()
        val manager=c.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(NotificationChannel("hal_price","HAL price and risk",NotificationManager.IMPORTANCE_HIGH))
        fun signal(id:String,breached:Boolean,body:String){
            val key="armed/"+id
            if(breached && !prefs.getBoolean(key,false)){
                manager.notify(id.hashCode(),NotificationCompat.Builder(c,"hal_price").setSmallIcon(android.R.drawable.stat_notify_more)
                    .setContentTitle("HAL Tradebook").setContentText(body).setAutoCancel(true).setPriority(NotificationCompat.PRIORITY_HIGH).build())
            }
            prefs.edit().putBoolean(key,breached).apply()
        }
        return try{
            val legs=dao.positions().first()
            val marks=runCatching{Marks(c).load(legs)}.getOrDefault(emptyMap())
            val mtm=totalMtm(legs,marks)
            val risk=riskSignals(prefs,legs,dao.ledger().first(),marks)
            for(p in legs)for(kind in listOf("expiry","stop","target","risk")){
                val key=kind+"/"+p.id
                if(kind=="expiry" || p.id in marks)signal(key,key in risk,risk[key].orEmpty())
            }
            risk.filterKeys{it.startsWith("day/")}.forEach{(id,msg)->signal(id,true,msg)}
            val alerts=dao.alerts().first()
            val q=if(alerts.any{it.enabled && it.kind.startsWith("Spot")})HalRepository(c,dao).refresh() else null
            for(a in alerts){
                if(!a.enabled){signal(a.id,false,"");continue}
                val v=if(a.kind.startsWith("Spot"))q?.takeIf{!it.cached && System.currentTimeMillis()-it.time in 0..300000}?.price else mtm
                if(v==null)continue
                val hit=if(a.kind.endsWith("≥"))v>=a.threshold else v<=a.threshold
                signal(a.id,hit,"HAL "+a.kind+" ₹"+a.threshold+" · observed ₹"+v)
            }
            Result.success()
        }catch(e:Exception){Result.retry()}
    }
    companion object{
        fun schedule(c:Context,on:Boolean){
            val w=WorkManager.getInstance(c)
            if(!on){w.cancelUniqueWork("hal-monitor");return}
            val req=PeriodicWorkRequestBuilder<Monitor>(15,TimeUnit.MINUTES).setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()).build()
            w.enqueueUniquePeriodicWork("hal-monitor",ExistingPeriodicWorkPolicy.UPDATE,req)
        }
    }
}
