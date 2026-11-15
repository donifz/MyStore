package com.mystore.terminal;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.os.Bundle;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintJob;
import android.print.PrintManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.OutputStream;
import java.net.Socket;
import java.nio.charset.Charset;

public class MainActivity extends Activity {
    private WebView webView;
    private static final String DEFAULT_URL = "https://mystore.kg/seller/login";

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);

        // Bridge for Silent Print via JavascriptInterface
        webView.addJavascriptInterface(new PrinterBridge(), "AndroidPrinter");

        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
            }
        });

        webView.loadUrl(DEFAULT_URL);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    public class PrinterBridge {
        @JavascriptInterface
        public boolean isAvailable() {
            return true;
        }

        @JavascriptInterface
        public boolean printEscPosReceipt(String jsonPayload) {
            try {
                JSONObject json = new JSONObject(jsonPayload);
                final String shopName = json.optString("shopName", "MyStore");
                final String method = json.optString("method", "cash");
                final long totalMinor = json.optLong("totalMinor", 0);
                final String createdAt = json.optString("createdAt", "");
                final String header = json.optString("receiptHeader", "");
                final String footer = json.optString("receiptFooter", "Спасибо за покупку!");
                final JSONArray lines = json.optJSONArray("lines");

                // Execute print on UI thread via Android Print Framework
                runOnUiThread(() -> {
                    try {
                        PrintManager printManager = (PrintManager) getSystemService(PRINT_SERVICE);
                        PrintDocumentAdapter printAdapter = webView.createPrintDocumentAdapter("Receipt");
                        PrintAttributes.Builder builder = new PrintAttributes.Builder();
                        builder.setColorMode(PrintAttributes.COLOR_MODE_MONOCHROME);
                        // 58mm roll dimensions in mils (1 inch = 1000 mils, 58mm ~ 2283 mils)
                        PrintAttributes.MediaSize mediaSize = new PrintAttributes.MediaSize(
                                "58mmRoll", "58mm Roll", 2283, 7874
                        );
                        builder.setMediaSize(mediaSize);
                        builder.setMinMargins(PrintAttributes.Margins.NO_MARGINS);
                        printManager.print("Чек MyStore", printAdapter, builder.build());
                    } catch (Exception e) {
                        Toast.makeText(MainActivity.this, "Ошибка печати: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                    }
                });
                return true;
            } catch (Exception e) {
                return false;
            }
        }
    }
}
