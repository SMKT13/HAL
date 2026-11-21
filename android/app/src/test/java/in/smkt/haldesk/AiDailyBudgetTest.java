package in.smkt.haldesk;

import android.content.Context;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;

import java.time.Instant;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk=28,manifest=Config.NONE)
public final class AiDailyBudgetTest {
    private AiDailyBudget budget;

    @Before public void reset() {
        Context context=RuntimeEnvironment.getApplication();
        context.getSharedPreferences("hal_atlas_ai_budget_private_v1",Context.MODE_PRIVATE)
            .edit().clear().commit();
        budget=new AiDailyBudget(context);
    }

    @Test public void defaultsToTwentyLocalReservedRequests()throws Exception {
        assertEquals(20,budget.limit());
        assertEquals(20,budget.status().getInt("remaining"));
        budget.reserve(1);
        assertEquals(1,budget.status().getInt("reserved"));
        budget.reserve(6);
        assertEquals(7,budget.status().getInt("reserved"));
    }

    @Test public void cannotExceedDailyLimitOrSelectInvalidAllowance()throws Exception {
        budget.setLimit(3);
        assertEquals(3,budget.limit());
        budget.reserve(1);
        try {budget.reserve(6);fail("Over-budget request accepted");}
        catch(Exception expected){assertTrue(expected.getMessage().contains("allowance"));}
        assertEquals(1,budget.status().getInt("reserved"));
        try {budget.setLimit(0);fail("Invalid budget accepted");}
        catch(Exception expected){assertEquals(3,budget.limit());}
    }

    @Test public void dailyBoundaryUsesIndiaClock() {
        long before=Instant.parse("2026-11-20T18:29:59Z").toEpochMilli();
        long after=Instant.parse("2026-11-20T18:30:00Z").toEpochMilli();
        assertEquals("2026-11-20",AiDailyBudget.day(before));
        assertEquals("2026-11-21",AiDailyBudget.day(after));
    }

    @Test public void reservationsSurviveNewInstance()throws Exception {
        budget.reserve(6);
        Context context=RuntimeEnvironment.getApplication();
        AiDailyBudget reopened=new AiDailyBudget(context);
        assertEquals(6,reopened.status().getInt("reserved"));
    }
}
