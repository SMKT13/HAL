package `in`.smkt.haldesk

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk=[35])
class NativeScreenTest {
    @get:Rule val screen=createAndroidComposeRule<NativeTerminalActivity>()
    @Test fun nativeBookReviewOpensWithoutBrokerCredentials() {
        screen.onNodeWithText("Native terminal").assertIsDisplayed()
        screen.onNodeWithText("Full desk").assertIsDisplayed()
        screen.onNodeWithText("Your HAL position").assertIsDisplayed()
    }
}
