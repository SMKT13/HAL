package in.smkt.haldesk

import java.time.LocalDate

/** Deterministic share-count and expiry checks; not valuation or broker margin. */
data class ExposureLeg(val type: String, val expiry: String, val lots: Int?, val lotSize: Int?, val side: String = "BUY")
data class NominalCoverage(val futures: Long?, val puts: Long?, val uncovered: Long?, val notes: List<String>)

fun nominalCoverage(legs: List<ExposureLeg>, today: LocalDate): NominalCoverage {
    val futures = legs.filter { it.type == "FUT" && it.side == "BUY" }
    val puts = legs.filter { it.type == "PE" && it.side == "BUY" }
    val notes = mutableListOf<String>()
    if (legs.any { it.side != "BUY" || (it.type != "FUT" && it.type != "PE") }) {
        notes += "This book includes short contracts, calls or unsupported exposures. Basic protective-put coverage is withheld."
        return NominalCoverage(null, null, null, notes)
    }
    val all = futures + puts
    if (all.any { it.lots == null || it.lotSize == null || it.lots <= 0 || it.lotSize <= 0 }) {
        notes += "At least one contract has an unverified lot size or quantity; exposure is withheld."
        return NominalCoverage(null, null, null, notes)
    }
    fun shares(items: List<ExposureLeg>): Long? = try {
        items.fold(0L) { sum, leg ->
            Math.addExact(sum, Math.multiplyExact(leg.lots!!.toLong(), leg.lotSize!!.toLong()))
        }
    } catch (_: ArithmeticException) { null }
    val f = shares(futures)
    val p = shares(puts)
    if (f == null || p == null) {
        notes += "Position quantity overflow; exposure is withheld."
        return NominalCoverage(null, null, null, notes)
    }
    if (f > 0 && p == 0L) notes += "No recorded put coverage for the futures position."
    if (p > f) notes += "Put contracts exceed futures share quantity; review intended hedge."
    val dates = all.associateWith { runCatching { LocalDate.parse(it.expiry) }.getOrNull() }
    if (dates.values.any { it == null }) notes += "An expiry is missing or invalid; duration protection cannot be confirmed."
    val maxFuture = futures.mapNotNull { dates[it] }.maxOrNull()
    val minPut = puts.mapNotNull { dates[it] }.minOrNull()
    if (maxFuture != null && minPut != null && minPut.isBefore(maxFuture)) {
        notes += "One or more puts expire before the latest futures expiry. A protection gap is possible."
    }
    if (puts.any { dates[it]?.isBefore(today) == true }) {
        notes += "An option expiry is past. Reconcile settled options; active put coverage is unavailable."
        return NominalCoverage(f, null, null, notes)
    }
    if (futures.any { dates[it]?.isBefore(today) == true }) {
        notes += "A futures expiry is past. Reconcile settlement before relying on this snapshot."
        return NominalCoverage(null, null, null, notes)
    }
    return NominalCoverage(f, p, (f - p).coerceAtLeast(0L), notes)
}
