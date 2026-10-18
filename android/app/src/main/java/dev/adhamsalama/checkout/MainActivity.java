package dev.adhamsalama.checkout;

import android.os.Bundle;
import android.webkit.WebView;
import androidx.activity.EdgeToEdge;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final String EDITABLE_FOCUSED_JS =
        "(() => { const e = document.activeElement;" +
        " return !!e && (e.isContentEditable || e.tagName === 'INPUT' || e.tagName === 'TEXTAREA'); })()";

    private boolean imeVisibleOnFocusLoss;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Android 15+ forces edge-to-edge, older versions don't. Capacitor's SystemBars (insetsHandling "css")
        // still reports the system bar insets to the page, so without this the web UI pads for the
        // navigation bar while the system also lays the WebView out above it, doubling the gap.
        EdgeToEdge.enable(this);
    }

    // Picking another keyboard app (long-press space in Gboard) opens a system dialog that takes window focus.
    // When it closes, the field still has focus in the WebView but Android doesn't show the new keyboard,
    // so show it again if it was open before and a text field is still focused.
    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        WebView webView = getBridge() == null ? null : getBridge().getWebView();
        if (webView == null) return;
        if (!hasFocus) {
            WindowInsetsCompat insets = ViewCompat.getRootWindowInsets(webView);
            imeVisibleOnFocusLoss = insets != null && insets.isVisible(WindowInsetsCompat.Type.ime());
            return;
        }
        if (!imeVisibleOnFocusLoss) return;
        imeVisibleOnFocusLoss = false;
        webView.evaluateJavascript(EDITABLE_FOCUSED_JS, (result) -> {
            if ("true".equals(result)) {
                WindowCompat.getInsetsController(getWindow(), webView).show(WindowInsetsCompat.Type.ime());
            }
        });
    }
}
