package com.example.technicianhub

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.webkit.ConsoleMessage
import android.webkit.GeolocationPermissions
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.selection.selectable
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextField
import androidx.compose.material3.RadioButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.webkit.WebViewAssetLoader
import com.example.technicianhub.theme.TechnicianHubTheme

class MainActivity : ComponentActivity() {

    private lateinit var sharedPreferences: SharedPreferences
    private var filePathCallback: ValueCallback<Array<Uri>>? = null

    // File chooser launcher for WebView uploads
    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val results = if (result.resultCode == RESULT_OK) {
            val dataString = result.data?.dataString
            val clipData = result.data?.clipData
            if (clipData != null) {
                val uris = Array(clipData.itemCount) { i -> clipData.getItemAt(i).uri }
                uris
            } else if (dataString != null) {
                arrayOf(Uri.parse(dataString))
            } else {
                null
            }
        } else {
            null
        }
        filePathCallback?.onReceiveValue(results)
        filePathCallback = null
    }

    // Permission launcher for Location and Camera
    private var locationCallback: GeolocationPermissions.Callback? = null
    private var locationOrigin: String? = null

    private val permissionsLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val fineGranted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] ?: false
        val coarseGranted = permissions[Manifest.permission.ACCESS_COARSE_LOCATION] ?: false
        val cameraGranted = permissions[Manifest.permission.CAMERA] ?: false

        // Respond to geolocation prompt if pending
        if (locationCallback != null && locationOrigin != null) {
            val granted = fineGranted || coarseGranted
            locationCallback?.invoke(locationOrigin, granted, false)
            locationCallback = null
            locationOrigin = null
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        sharedPreferences = getSharedPreferences("TechnicianHubPrefs", Context.MODE_PRIVATE)
        
        // Enable WebView debugging for Chrome DevTools inspection
        WebView.setWebContentsDebuggingEnabled(true)
        
        enableEdgeToEdge()

        setContent {
            TechnicianHubTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    MainScreen()
                }
            }
        }

        requestPermissionsIfNeeded()
    }

    private fun requestPermissionsIfNeeded() {
        val permissions = arrayOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION,
            Manifest.permission.CAMERA
        )
        val missing = permissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (missing.isNotEmpty()) {
            permissionsLauncher.launch(missing.toTypedArray())
        }
    }

    @Composable
    fun MainScreen() {
        val activeUrl = "https://appassets.androidplatform.net/assets/app.html"
        var showSettings by remember { mutableStateOf(false) }
        var useRemote by remember { mutableStateOf(sharedPreferences.getBoolean("useRemote", false)) }
        var remoteUrl by remember { mutableStateOf(sharedPreferences.getString("remoteUrl", "https://awesomemyanmar.pages.dev/app.html") ?: "") }

        val resolvedUrl = if (useRemote) {
            formatUrl(remoteUrl)
        } else {
            "https://appassets.androidplatform.net/assets/app.html"
        }

        Box(modifier = Modifier.fillMaxSize()) {
            // WebView
            TechnicianWebView(url = resolvedUrl)

            // Settings Trigger Button
            FloatingActionButton(
                onClick = { showSettings = true },
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(16.dp)
                    .width(48.dp)
                    .height(48.dp)
            ) {
                Icon(imageVector = Icons.Default.Settings, contentDescription = "App Settings")
            }

            if (showSettings) {
                SettingsDialog(
                    initialUseRemote = useRemote,
                    initialUrl = remoteUrl,
                    onDismiss = { showSettings = false },
                    onSave = { remote, urlVal ->
                        useRemote = remote
                        remoteUrl = urlVal
                        sharedPreferences.edit().apply {
                            putBoolean("useRemote", remote)
                            putString("remoteUrl", urlVal)
                            apply()
                        }
                        showSettings = false
                    }
                )
            }
        }
    }

    private fun formatUrl(url: String): String {
        var trimmed = url.trim()
        if (trimmed.isBlank()) return "https://appassets.androidplatform.net/assets/index.html"
        if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
            // Prepend http:// for local IPs or standard domains
            trimmed = "http://$trimmed"
        }
        return trimmed
    }

    @SuppressLint("SetJavaScriptEnabled")
    @Composable
    fun TechnicianWebView(url: String) {
        AndroidView(
            modifier = Modifier.fillMaxSize(),
            factory = { context ->
                // Build the WebViewAssetLoader to intercept local file requests under a secure origin
                val assetLoader = WebViewAssetLoader.Builder()
                    .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(context))
                    .build()

                WebView(context).apply {
                    // Set explicit layout params to fill parent container
                    layoutParams = android.view.ViewGroup.LayoutParams(
                        android.view.ViewGroup.LayoutParams.MATCH_PARENT,
                        android.view.ViewGroup.LayoutParams.MATCH_PARENT
                    )

                    webViewClient = object : WebViewClient() {
                        override fun shouldOverrideUrlLoading(
                            view: WebView?,
                            request: WebResourceRequest?
                        ): Boolean {
                            return false
                        }

                        // Intercept requests and route them through WebViewAssetLoader
                        override fun shouldInterceptRequest(
                            view: WebView?,
                            request: WebResourceRequest?
                        ): WebResourceResponse? {
                            return assetLoader.shouldInterceptRequest(request?.url ?: return null)
                        }

                        override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                            Log.d("WebViewLifecycle", "Page started: $url")
                        }

                        override fun onPageFinished(view: WebView?, url: String?) {
                            Log.d("WebViewLifecycle", "Page finished: $url")
                        }

                        override fun onReceivedError(
                            view: WebView?,
                            request: WebResourceRequest?,
                            error: WebResourceError?
                        ) {
                            Log.e("WebViewError", "Error loading: ${request?.url} -- Code: ${error?.errorCode}, Description: ${error?.description}")
                        }
                    }

                    webChromeClient = object : WebChromeClient() {
                        // Forward JS console logs to Android Logcat
                        override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                            Log.d("WebViewConsole", "${consoleMessage?.message()} -- From line ${consoleMessage?.lineNumber()} of ${consoleMessage?.sourceId()}")
                            return true
                        }

                        override fun onGeolocationPermissionsShowPrompt(
                            origin: String?,
                            callback: GeolocationPermissions.Callback?
                        ) {
                            val fineLoc = ContextCompat.checkSelfPermission(
                                context,
                                Manifest.permission.ACCESS_FINE_LOCATION
                            ) == PackageManager.PERMISSION_GRANTED
                            val coarseLoc = ContextCompat.checkSelfPermission(
                                context,
                                Manifest.permission.ACCESS_COARSE_LOCATION
                            ) == PackageManager.PERMISSION_GRANTED

                            if (fineLoc || coarseLoc) {
                                callback?.invoke(origin, true, false)
                            } else {
                                locationCallback = callback
                                locationOrigin = origin
                                permissionsLauncher.launch(
                                    arrayOf(
                                        Manifest.permission.ACCESS_FINE_LOCATION,
                                        Manifest.permission.ACCESS_COARSE_LOCATION
                                    )
                                )
                            }
                        }

                        override fun onShowFileChooser(
                            webView: WebView?,
                            filePathCallback: ValueCallback<Array<Uri>>?,
                            fileChooserParams: FileChooserParams?
                        ): Boolean {
                            this@MainActivity.filePathCallback?.onReceiveValue(null)
                            this@MainActivity.filePathCallback = filePathCallback

                            val intent = fileChooserParams?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                                type = "image/*"
                                addCategory(Intent.CATEGORY_OPENABLE)
                            }
                            try {
                                fileChooserLauncher.launch(intent)
                            } catch (e: Exception) {
                                this@MainActivity.filePathCallback?.onReceiveValue(null)
                                this@MainActivity.filePathCallback = null
                                Toast.makeText(context, "No file chooser available", Toast.LENGTH_LONG).show()
                                return false
                            }
                            return true
                        }
                    }

                    settings.apply {
                        javaScriptEnabled = true
                        domStorageEnabled = true
                        allowFileAccess = true
                        allowContentAccess = true
                        databaseEnabled = true
                        loadWithOverviewMode = true
                        useWideViewPort = true
                        allowFileAccessFromFileURLs = true
                        allowUniversalAccessFromFileURLs = true
                        mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                    }
                }
            },
            update = { webView ->
                // Reload WebView if URL has changed
                if (webView.url != url) {
                    webView.loadUrl(url)
                }
            }
        )
    }

    @Composable
    fun SettingsDialog(
        initialUseRemote: Boolean,
        initialUrl: String,
        onDismiss: () -> Unit,
        onSave: (Boolean, String) -> Unit
    ) {
        var useRemote by remember { mutableStateOf(initialUseRemote) }
        var urlText by remember { mutableStateOf(initialUrl) }

        AlertDialog(
            onDismissRequest = onDismiss,
            title = { Text(text = "App Source Settings") },
            text = {
                Column {
                    Text(
                        text = "Select application source:",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(bottom = 12.dp)
                    )

                    // Option 1: Local Offline Mode
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .selectable(
                                selected = !useRemote,
                                onClick = { useRemote = false }
                            )
                            .padding(vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        RadioButton(
                            selected = !useRemote,
                            onClick = { useRemote = false }
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Column {
                            Text(text = "Local Offline Assets", style = MaterialTheme.typography.bodyLarge)
                            Text(
                                text = "Run packaged HTML/CSS/JS files locally.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    // Option 2: Remote/IP Server Mode
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .selectable(
                                selected = useRemote,
                                onClick = { useRemote = true }
                            )
                            .padding(vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        RadioButton(
                            selected = useRemote,
                            onClick = { useRemote = true }
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Column {
                            Text(text = "Remote Server / Local IP", style = MaterialTheme.typography.bodyLarge)
                            Text(
                                text = "Connect to an online server or local network IP.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }

                    if (useRemote) {
                        Spacer(modifier = Modifier.height(12.dp))
                        TextField(
                            value = urlText,
                            onValueChange = { urlText = it },
                            label = { Text("Server URL or IP Address") },
                            placeholder = { Text("e.g. 192.168.1.100:8080 or domain.com") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                }
            },
            confirmButton = {
                TextButton(
                    onClick = { onSave(useRemote, urlText) }
                ) {
                    Text("Save & Reload")
                }
            },
            dismissButton = {
                TextButton(onClick = onDismiss) {
                    Text("Cancel")
                }
            }
        )
    }
}
