package dev.adhamsalama.checkout;

import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Android 15+ forces edge-to-edge, older versions don't. Capacitor's SystemBars (insetsHandling "css")
        // still reports the system bar insets to the page, so without this the web UI pads for the
        // navigation bar while the system also lays the WebView out above it, doubling the gap.
        EdgeToEdge.enable(this);
    }
}
