package com.example

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import com.example.ui.theme.MyApplicationTheme
import com.example.ui.theme.OffWhiteBackground
import java.io.IOException

private const val PWA_HOST = "appassets.androidplatform.net"
private const val PWA_ENTRY_URL = "https://$PWA_HOST/assets/pwa/index.html"

class MainActivity : ComponentActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    enableEdgeToEdge()
    setContent {
      MyApplicationTheme(darkTheme = false, dynamicColor = false) {
        Scaffold(
          modifier = Modifier.fillMaxSize(),
          containerColor = OffWhiteBackground,
          contentWindowInsets = WindowInsets.safeDrawing,
        ) { innerPadding ->
          HuluGuardPwaScreen(
            modifier = Modifier.fillMaxSize().padding(innerPadding).testTag("hulu_guard_pwa_view"),
            onExitApp = { finish() },
          )
        }
      }
    }
  }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun HuluGuardPwaScreen(modifier: Modifier = Modifier, onExitApp: () -> Unit) {
  val context = LocalContext.current
  var webViewRef by remember { mutableStateOf<WebView?>(null) }
  var pendingWebPermission by remember { mutableStateOf<PermissionRequest?>(null) }
  var pendingFileCallback by remember { mutableStateOf<ValueCallback<Array<Uri>>?>(null) }

  val cameraPermissionLauncher =
    rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
      val req = pendingWebPermission
      pendingWebPermission = null
      if (req != null) {
        if (granted) {
          req.grant(req.resources)
        } else {
          req.deny()
        }
      }
    }

  val photoPickerLauncher =
    rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
      val callback = pendingFileCallback
      pendingFileCallback = null
      callback?.onReceiveValue(if (uri != null) arrayOf(uri) else emptyArray())
    }

  val filePickerLauncher =
    rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
      val callback = pendingFileCallback
      pendingFileCallback = null
      callback?.onReceiveValue(if (uri != null) arrayOf(uri) else emptyArray())
    }

  BackHandler {
    val wv = webViewRef
    if (wv != null) {
      wv.evaluateJavascript("window.huluNavigateBack ? window.huluNavigateBack() : false") { result ->
        if (result != "true") {
          if (wv.canGoBack()) {
            wv.goBack()
          } else {
            onExitApp()
          }
        }
      }
    } else {
      onExitApp()
    }
  }

  DisposableEffect(Unit) {
    onDispose {
      webViewRef?.destroy()
      webViewRef = null
    }
  }

  Box(modifier = modifier) {
    AndroidView(
      modifier = Modifier.fillMaxSize(),
      factory = { ctx ->
        WebView(ctx).apply {
          settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            allowFileAccess = false
            allowContentAccess = true
            cacheMode = WebSettings.LOAD_DEFAULT
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
          }

          webViewClient =
            object : WebViewClient() {
              override fun shouldInterceptRequest(
                view: WebView?,
                request: WebResourceRequest?,
              ): WebResourceResponse? {
                val url = request?.url ?: return null
                if (url.host == PWA_HOST && url.path?.startsWith("/assets/") == true) {
                  val assetPath = url.path!!.removePrefix("/assets/")
                  return loadAssetResponse(ctx, assetPath)
                }
                return super.shouldInterceptRequest(view, request)
              }
            }

          webChromeClient =
            object : WebChromeClient() {
              override fun onPermissionRequest(request: PermissionRequest?) {
                if (request == null) return
                val wantsCamera =
                  request.resources.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE)
                if (!wantsCamera) {
                  request.deny()
                  return
                }
                val hasPermission =
                  ContextCompat.checkSelfPermission(ctx, Manifest.permission.CAMERA) ==
                    PackageManager.PERMISSION_GRANTED
                if (hasPermission) {
                  request.grant(request.resources)
                } else {
                  pendingWebPermission = request
                  cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
                }
              }

              override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?,
              ): Boolean {
                pendingFileCallback?.onReceiveValue(null)
                pendingFileCallback = filePathCallback
                val acceptTypes = fileChooserParams?.acceptTypes ?: emptyArray()
                val wantsImage = acceptTypes.any { it.contains("image") }
                if (wantsImage) {
                  photoPickerLauncher.launch(
                    PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
                  )
                } else {
                  filePickerLauncher.launch("*/*")
                }
                return true
              }
            }

          loadUrl(PWA_ENTRY_URL)
          webViewRef = this
        }
      },
    )
  }
}

private fun loadAssetResponse(context: Context, rawAssetPath: String): WebResourceResponse? {
  val cleanPath = rawAssetPath.trimEnd('/').ifEmpty { "pwa/index.html" }
  val finalPath = if (cleanPath == "pwa") "pwa/index.html" else cleanPath
  return try {
    val inputStream = context.assets.open(finalPath)
    val mimeType =
      when {
        finalPath.endsWith(".html") -> "text/html"
        finalPath.endsWith(".js") || finalPath.endsWith(".mjs") -> "application/javascript"
        finalPath.endsWith(".css") -> "text/css"
        finalPath.endsWith(".json") -> "application/json"
        finalPath.endsWith(".png") -> "image/png"
        finalPath.endsWith(".jpg") || finalPath.endsWith(".jpeg") -> "image/jpeg"
        finalPath.endsWith(".svg") -> "image/svg+xml"
        finalPath.endsWith(".wasm") -> "application/wasm"
        finalPath.endsWith(".onnx") -> "application/octet-stream"
        else -> "application/octet-stream"
      }
    val encoding = if (mimeType.startsWith("text/") || mimeType == "application/javascript" || mimeType == "application/json") "utf-8" else null
    return WebResourceResponse(
      mimeType,
      encoding,
      200,
      "OK",
      mapOf("Access-Control-Allow-Origin" to "*"),
      inputStream,
    )
  } catch (_: IOException) {
    null
  }
}
