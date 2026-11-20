package in.smkt.haldesk

import org.junit.Assert.*
import org.junit.Test
import java.time.LocalDate

class NativeCoverageTest {
    private val today = LocalDate.parse("2026-11-20")
    @Test fun putExpiresBeforeFutureFlagsGap() {
        val result = nominalCoverage(listOf(
            ExposureLeg("FUT","2026-12-29",2,150),
            ExposureLeg("PE","2026-11-23",1,150),
            ExposureLeg("PE","2026-11-23",1,150)
        ),today)
        assertEquals(300L,result.futures)
        assertEquals(300L,result.puts)
        assertEquals(0L,result.uncovered)
        assertTrue(result.notes.any { it.contains("protection gap") })
    }
    @Test fun invalidLotWithholdsAllCoverage() {
        val result=nominalCoverage(listOf(ExposureLeg("FUT","2026-12-29",2,null)),today)
        assertNull(result.futures)
        assertNull(result.uncovered)
    }
    @Test fun underHedgedLotsShowNominalUncoveredShares() {
        val result=nominalCoverage(listOf(ExposureLeg("FUT","2026-12-29",2,150),
            ExposureLeg("PE","2026-12-29",1,150)),today)
        assertEquals(150L,result.uncovered)
    }
    @Test fun expiredPutWarnsRatherThanCountingAsCurrentProtection() {
        val result=nominalCoverage(listOf(ExposureLeg("FUT","2026-12-29",1,150),
            ExposureLeg("PE","2026-10-27",1,150)),today)
        assertTrue(result.notes.any { it.contains("option expiry is past") })
        assertNull(result.puts)
        assertNull(result.uncovered)
    }
}
