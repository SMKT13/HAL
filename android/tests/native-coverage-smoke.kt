package `in`.smkt.haldesk

import java.time.LocalDate

/**
 * Runs without Android SDK, Gradle, Maven, or JUnit.
 * Execute android/tests/test-native-coverage.sh on a machine with Kotlin + Java.
 */
fun main() {
    val today = LocalDate.parse("2026-11-21")
    fun leg(type:String, expiry:String="2026-12-29", lots:Int?=1, size:Int?=150, side:String="BUY") =
        ExposureLeg(type,expiry,lots,size,side)

    val under = nominalCoverage(listOf(leg("FUT",lots=2),leg("PE",lots=1)),today)
    check(under.futures==300L && under.puts==150L && under.uncovered==150L)

    val gap = nominalCoverage(listOf(leg("FUT",lots=2),leg("PE","2026-11-23",lots=2)),today)
    check(gap.uncovered==0L && gap.notes.any { it.contains("protection gap") })

    val expired = nominalCoverage(listOf(leg("FUT"),leg("PE","2026-11-20")),today)
    check(expired.puts==null && expired.uncovered==null)
    check(expired.notes.any { it.contains("option expiry is past") })

    val unsupported = nominalCoverage(listOf(leg("FUT"),leg("CE")),today)
    check(unsupported.futures==null && unsupported.uncovered==null)
    val sold = nominalCoverage(listOf(leg("FUT"),leg("PE",side="SELL")),today)
    check(sold.puts==null && sold.uncovered==null)

    val invalid = nominalCoverage(listOf(leg("FUT",size=null)),today)
    check(invalid.futures==null && invalid.uncovered==null)

    val zeros = nominalCoverage(emptyList(),today)
    check(zeros.futures==0L && zeros.puts==0L && zeros.uncovered==0L)

    println("PASS: HAL Atlas native coverage standalone smoke checks")
}
