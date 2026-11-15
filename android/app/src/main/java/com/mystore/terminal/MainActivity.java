package com.mystore.terminal;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Bundle;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

public class MainActivity extends Activity {
    private WebView webView;
    private LinearLayout errorOverlay;
    private TextView errorMessageView;
    private EditText urlInput;
    private SharedPreferences prefs;

    private static final String PREFS_NAME = "mystore_terminal_prefs";
    private static final String KEY_SERVER_URL = "server_url";
    private static final String DEFAULT_URL = "https://mystore.tezkur.kg/terminal";

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        String savedUrl = prefs.getString(KEY_SERVER_URL, DEFAULT_URL);

        FrameLayout root = new FrameLayout(this);

        webView = new WebView(this);
        root.addView(webView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
        ));

        errorOverlay = buildErrorOverlay(savedUrl);
        errorOverlay.setVisibility(View.GONE);
        root.addView(errorOverlay, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
        ));

        setContentView(root);

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
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                if (request != null && request.isForMainFrame()) {
                    CharSequence desc = error != null ? error.getDescription() : "Ошибка сети";
                    showErrorOverlay(request.getUrl().toString(), String.valueOf(desc));
                }
            }
        });

        loadServerUrl(savedUrl);
    }

    private LinearLayout buildErrorOverlay(String initialUrl) {
        int pad = dp(24);
        LinearLayout container = new LinearLayout(this);
        container.setOrientation(LinearLayout.VERTICAL);
        container.setGravity(Gravity.CENTER);
        container.setBackgroundColor(Color.parseColor("#0f172a"));
        container.setPadding(pad, pad, pad, pad);

        TextView title = new TextView(this);
        title.setText("Не удалось открыть MyStore");
        title.setTextColor(Color.WHITE);
        title.setTextSize(20);
        title.setGravity(Gravity.CENTER);
        container.addView(title);

        errorMessageView = new TextView(this);
        errorMessageView.setTextColor(Color.parseColor("#94a3b8"));
        errorMessageView.setTextSize(14);
        errorMessageView.setGravity(Gravity.CENTER);
        errorMessageView.setPadding(0, dp(8), 0, dp(20));
        container.addView(errorMessageView);

        urlInput = new EditText(this);
        urlInput.setText(initialUrl);
        urlInput.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        urlInput.setSingleLine(true);
        urlInput.setTextColor(Color.WHITE);
        urlInput.setHintTextColor(Color.parseColor("#64748b"));
        urlInput.setBackgroundColor(Color.parseColor("#1e293b"));
        urlInput.setPadding(dp(12), dp(12), dp(12), dp(12));
        LinearLayout.LayoutParams inputParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
        inputParams.bottomMargin = dp(12);
        container.addView(urlInput, inputParams);

        Button retryBtn = new Button(this);
        retryBtn.setText("Сохранить и повторить");
        retryBtn.setOnClickListener(v -> {
            String entered = urlInput.getText().toString().trim();
            if (!entered.isEmpty()) {
                if (!entered.startsWith("http://") && !entered.startsWith("https://")) {
                    entered = "https://" + entered;
                }
                prefs.edit().putString(KEY_SERVER_URL, entered).apply();
                loadServerUrl(entered);
            }
        });
        LinearLayout.LayoutParams btnParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
        btnParams.bottomMargin = dp(8);
        container.addView(retryBtn, btnParams);

        Button resetBtn = new Button(this);
        resetBtn.setText("Сбросить адрес по умолчанию");
        resetBtn.setOnClickListener(v -> {
            prefs.edit().putString(KEY_SERVER_URL, DEFAULT_URL).apply();
            urlInput.setText(DEFAULT_URL);
            loadServerUrl(DEFAULT_URL);
        });
        container.addView(resetBtn, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        ));

        return container;
    }

    private void showErrorOverlay(String url, String errorText) {
        urlInput.setText(url);
        errorMessageView.setText("Ошибка загрузки (" + errorText + "). Проверьте интернет или измените адрес сервера:");
        errorOverlay.setVisibility(View.VISIBLE);
    }

    private void loadServerUrl(String url) {
        errorOverlay.setVisibility(View.GONE);
        webView.loadUrl(url);
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    @Override
    public void onBackPressed() {
        if (errorOverlay != null && errorOverlay.getVisibility() == View.VISIBLE) {
            super.onBackPressed();
            return;
        }
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
