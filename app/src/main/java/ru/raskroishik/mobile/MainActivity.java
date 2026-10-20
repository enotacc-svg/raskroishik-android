package ru.raskroishik.mobile;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.OutputStream;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {
    private WebView webView;
    private final ExecutorService io = Executors.newSingleThreadExecutor();

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(11, 50, 94));
        getWindow().setNavigationBarColor(Color.rgb(240, 245, 250));
        webView = new WebView(this);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setAllowFileAccess(true);
        webView.getSettings().setAllowContentAccess(false);
        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient());
        webView.addJavascriptInterface(new AndroidBridge(), "AndroidApp");
        setContentView(webView);
        webView.loadUrl("file:///android_asset/index.html");
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) webView.destroy();
        io.shutdown();
        super.onDestroy();
    }

    public final class AndroidBridge {
        @JavascriptInterface
        public void savePng(String dataUrl, String requestedName) {
            io.execute(() -> {
                try {
                    Uri image = writePng(dataUrl, requestedName);
                    notifyUser(image == null ? "Не удалось сохранить схему" : "PNG сохранён в Галерею → Раскройщик");
                } catch (Exception e) {
                    notifyUser("Ошибка сохранения PNG: " + e.getMessage());
                }
            });
        }

        @JavascriptInterface
        public void sharePng(String dataUrl, String requestedName, String email) {
            io.execute(() -> {
                try {
                    Uri image = writePng(dataUrl, requestedName);
                    if (image == null) {
                        notifyUser("Не удалось подготовить PNG");
                        return;
                    }
                    runOnUiThread(() -> {
                        Intent send = new Intent(Intent.ACTION_SEND);
                        send.setType("image/png");
                        send.putExtra(Intent.EXTRA_STREAM, image);
                        send.putExtra(Intent.EXTRA_SUBJECT, "Схема раскроя");
                        if (email != null && !email.trim().isEmpty()) {
                            send.putExtra(Intent.EXTRA_EMAIL, new String[]{email.trim()});
                        }
                        send.setClipData(ClipData.newUri(getContentResolver(), "Схема раскроя", image));
                        send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        startActivity(Intent.createChooser(send, "Отправить схему раскроя"));
                    });
                } catch (Exception e) {
                    notifyUser("Ошибка отправки: " + e.getMessage());
                }
            });
        }

        @JavascriptInterface
        public void copyText(String value) {
            runOnUiThread(() -> {
                ClipboardManager clipboard = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                clipboard.setPrimaryClip(ClipData.newPlainText("Email", value));
                Toast.makeText(MainActivity.this, "Адрес скопирован", Toast.LENGTH_SHORT).show();
            });
        }
    }

    private void notifyUser(String message) {
        runOnUiThread(() -> Toast.makeText(this, message, Toast.LENGTH_LONG).show());
    }

    private Uri writePng(String dataUrl, String requestedName) throws Exception {
        int comma = dataUrl.indexOf(',');
        if (comma < 0 || !dataUrl.startsWith("data:image/png;base64,")) throw new IllegalArgumentException("Неверный формат изображения");
        byte[] png = Base64.decode(dataUrl.substring(comma + 1), Base64.DEFAULT);
        if (png.length < 8) throw new IllegalArgumentException("Пустое изображение");
        String safeName = requestedName == null ? "raskroy.png" : requestedName.replaceAll("[^a-zA-Z0-9_.-]", "_");
        if (!safeName.endsWith(".png")) safeName += ".png";
        // Prevent same-name overwrites in gallery when sharing the same drawing repeatedly.
        safeName = safeName.substring(0, safeName.length() - 4) + "_" + System.currentTimeMillis() + ".png";

        ContentValues values = new ContentValues();
        values.put(MediaStore.MediaColumns.DISPLAY_NAME, safeName);
        values.put(MediaStore.MediaColumns.MIME_TYPE, "image/png");
        values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/Раскройщик");
        values.put(MediaStore.MediaColumns.IS_PENDING, 1);
        ContentResolver resolver = getContentResolver();
        Uri image = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
        if (image == null) throw new IllegalStateException("Не удалось создать файл");
        try {
            try (OutputStream output = resolver.openOutputStream(image)) {
                if (output == null) throw new IllegalStateException("Недоступна память устройства");
                output.write(png);
            }
            values.clear();
            values.put(MediaStore.MediaColumns.IS_PENDING, 0);
            resolver.update(image, values, null, null);
            return image;
        } catch (Exception e) {
            resolver.delete(image, null, null);
            throw e;
        }
    }
}
