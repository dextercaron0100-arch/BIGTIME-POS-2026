package com.apex.pos.pos_flutter

import android.app.ActivityOptions
import android.content.Context
import android.content.Intent
import android.hardware.display.DisplayManager
import android.os.Build
import android.view.Display
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    companion object {
        private const val CHANNEL = "com.apex.pos/customer_display"
    }

    private var usbPrinterBridge: AndroidUsbPrinterBridge? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        usbPrinterBridge = AndroidUsbPrinterBridge(
            activity = this,
            messenger = flutterEngine.dartExecutor.binaryMessenger,
        )

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "hasSecondaryDisplay" -> {
                        result.success(hasSecondaryDisplay())
                    }
                    "openOnSecondaryDisplay" -> {
                        try {
                            result.success(openCustomerDisplayOnSecondaryDisplay())
                        } catch (error: Throwable) {
                            result.error(
                                "open_secondary_display_failed",
                                error.message,
                                null,
                            )
                        }
                    }
                    else -> result.notImplemented()
                }
            }
    }

    override fun onDestroy() {
        usbPrinterBridge?.dispose()
        usbPrinterBridge = null
        super.onDestroy()
    }

    private fun hasSecondaryDisplay(): Boolean {
        return findSecondaryDisplay() != null
    }

    private fun openCustomerDisplayOnSecondaryDisplay(): Boolean {
        val targetDisplay = findSecondaryDisplay() ?: return false

        val intent = Intent(this, CustomerDisplayActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            addFlags(Intent.FLAG_ACTIVITY_MULTIPLE_TASK)
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val options = ActivityOptions.makeBasic()
            options.launchDisplayId = targetDisplay.displayId
            startActivity(intent, options.toBundle())
        } else {
            startActivity(intent)
        }

        return true
    }

    private fun findSecondaryDisplay(): Display? {
        val displayManager = getSystemService(Context.DISPLAY_SERVICE) as DisplayManager
        val currentDisplayId = display?.displayId ?: Display.DEFAULT_DISPLAY
        return displayManager.displays.firstOrNull { display ->
            display.displayId != currentDisplayId && display.state == Display.STATE_ON
        }
    }
}
