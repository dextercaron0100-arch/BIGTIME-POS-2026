package com.apex.pos.pos_flutter

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbDeviceConnection
import android.hardware.usb.UsbEndpoint
import android.hardware.usb.UsbInterface
import android.hardware.usb.UsbManager
import android.os.Build
import android.util.Log
import io.flutter.embedding.android.FlutterActivity
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import java.util.Locale
import java.util.concurrent.CompletableFuture
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

class AndroidUsbPrinterBridge(
    private val activity: FlutterActivity,
    messenger: BinaryMessenger,
) : MethodChannel.MethodCallHandler {
    companion object {
        private const val CHANNEL = "com.apex.pos/hardware"
        private const val LOG_TAG = "AndroidUsbPrinterBridge"
    }

    private val methodChannel = MethodChannel(messenger, CHANNEL)
    private val usbManager = activity.getSystemService(Context.USB_SERVICE) as UsbManager
    private val executor: ExecutorService = Executors.newSingleThreadExecutor()
    private val permissionAction = "${activity.packageName}.USB_PERMISSION"
    private val permissionLock = Any()
    private var pendingPermissionDeviceId: Int? = null
    private var pendingPermission: CompletableFuture<Boolean>? = null
    private var permissionReceiverRegistered = false

    private val permissionReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action != permissionAction) {
                return
            }

            val device = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                intent.getParcelableExtra(UsbManager.EXTRA_DEVICE, UsbDevice::class.java)
            } else {
                @Suppress("DEPRECATION")
                intent.getParcelableExtra(UsbManager.EXTRA_DEVICE)
            }
            val granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)

            synchronized(permissionLock) {
                if (pendingPermissionDeviceId != null &&
                    device?.deviceId == pendingPermissionDeviceId
                ) {
                    pendingPermission?.complete(granted)
                    pendingPermission = null
                    pendingPermissionDeviceId = null
                }
            }
        }
    }

    init {
        methodChannel.setMethodCallHandler(this)
        registerPermissionReceiver()
    }

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "checkHealth" -> runAsync(result) { buildHealthPayload() }
            "probeHardware" -> runAsync(result) {
                val device = requirePrinterDevice()
                ensurePermission(device, requestIfMissing = true)
                null
            }
            "printReceipt" -> runAsync(result) {
                val payload = call.argument<String>("payload")
                    ?.takeIf { it.isNotBlank() }
                    ?: throw IllegalArgumentException("Receipt payload is empty.")
                sendEscPosBytes(buildReceiptBytes(payload), jobName = "printReceipt")
                null
            }
            "openCashDrawer" -> runAsync(result) {
                sendEscPosBytes(
                    byteArrayOf(0x1B, 0x70, 0x00, 0x19, 0xFA.toByte()),
                    jobName = "openCashDrawer",
                )
                null
            }
            else -> result.notImplemented()
        }
    }

    fun dispose() {
        methodChannel.setMethodCallHandler(null)
        if (permissionReceiverRegistered) {
            activity.unregisterReceiver(permissionReceiver)
            permissionReceiverRegistered = false
        }
        executor.shutdownNow()
    }

    private fun runAsync(
        result: MethodChannel.Result,
        action: () -> Any?,
    ) {
        executor.execute {
            try {
                val value = action()
                activity.runOnUiThread {
                    result.success(value)
                }
            } catch (error: Throwable) {
                Log.e(LOG_TAG, "Hardware action failed", error)
                activity.runOnUiThread {
                    result.error(
                        "android_usb_printer_error",
                        error.message ?: error.javaClass.simpleName,
                        null,
                    )
                }
            }
        }
    }

    private fun buildHealthPayload(): Map<String, Any?> {
        val device = findPrinterDevice()
        if (device == null) {
            return mapOf(
                "printerReady" to false,
                "cashDrawerReady" to false,
                "printerName" to null,
                "note" to "No USB printer detected.",
            )
        }

        val hasWritablePipe = try {
            resolvePrinterPipe(device)
            true
        } catch (_: Throwable) {
            false
        }
        val hasPermission = usbManager.hasPermission(device)
        val ready = hasWritablePipe && hasPermission

        return mapOf(
            "printerReady" to ready,
            "cashDrawerReady" to ready,
            "printerName" to device.displayName(),
            "note" to when {
                !hasWritablePipe ->
                    "USB printer was found, but no writable bulk endpoint is available."
                !hasPermission ->
                    "USB printer detected. Tap Probe or print once to grant access."
                else -> "USB printer is ready."
            },
        )
    }

    private fun sendEscPosBytes(bytes: ByteArray, jobName: String) {
        if (bytes.isEmpty()) {
            return
        }

        val device = requirePrinterDevice()
        if (!ensurePermission(device, requestIfMissing = true)) {
            throw IllegalStateException("USB access was denied for ${device.displayName()}.")
        }

        val pipe = resolvePrinterPipe(device)
        val connection = usbManager.openDevice(device)
            ?: throw IllegalStateException("Unable to open USB printer ${device.displayName()}.")
        try {
            if (!connection.claimInterface(pipe.usbInterface, true)) {
                throw IllegalStateException(
                    "Unable to claim printer interface on ${device.displayName()}.",
                )
            }
            try {
                writeChunks(connection, pipe.outEndpoint, bytes)
                Log.i(
                    LOG_TAG,
                    "Sent ${bytes.size} byte(s) to ${device.displayName()} for $jobName.",
                )
            } finally {
                connection.releaseInterface(pipe.usbInterface)
            }
        } finally {
            connection.close()
        }
    }

    private fun writeChunks(
        connection: UsbDeviceConnection,
        endpoint: UsbEndpoint,
        bytes: ByteArray,
    ) {
        var offset = 0
        val chunkSize = endpoint.maxPacketSize
            .takeIf { it > 0 }
            ?.coerceAtMost(4096)
            ?: 2048

        while (offset < bytes.size) {
            val size = minOf(chunkSize, bytes.size - offset)
            val chunk = bytes.copyOfRange(offset, offset + size)
            val written = connection.bulkTransfer(endpoint, chunk, chunk.size, 4000)
            if (written <= 0) {
                throw IllegalStateException(
                    "Printer write failed after $offset of ${bytes.size} byte(s).",
                )
            }
            offset += written
        }
    }

    private fun requirePrinterDevice(): UsbDevice {
        return findPrinterDevice()
            ?: throw IllegalStateException("No compatible USB printer is connected.")
    }

    private fun findPrinterDevice(): UsbDevice? {
        return usbManager.deviceList
            .values
            .sortedBy { it.deviceId }
            .sortedByDescending { deviceHasPrinterInterface(it) }
            .firstOrNull { looksLikeSupportedPrinter(it) }
    }

    private fun looksLikeSupportedPrinter(device: UsbDevice): Boolean {
        if (deviceHasPrinterInterface(device)) {
            return true
        }

        val searchable = listOfNotNull(
            device.manufacturerName,
            device.productName,
            device.deviceName,
        ).joinToString(" ").lowercase(Locale.US)

        return searchable.contains("printer") || searchable.contains("caysn")
    }

    private fun deviceHasPrinterInterface(device: UsbDevice): Boolean {
        if (device.deviceClass == UsbConstants.USB_CLASS_PRINTER) {
            return true
        }

        for (index in 0 until device.interfaceCount) {
            if (device.getInterface(index).interfaceClass == UsbConstants.USB_CLASS_PRINTER) {
                return true
            }
        }
        return false
    }

    private fun resolvePrinterPipe(device: UsbDevice): PrinterPipe {
        var fallbackPipe: PrinterPipe? = null

        for (index in 0 until device.interfaceCount) {
            val usbInterface = device.getInterface(index)
            val outEndpoint = findBulkOutEndpoint(usbInterface) ?: continue

            val pipe = PrinterPipe(usbInterface = usbInterface, outEndpoint = outEndpoint)
            if (usbInterface.interfaceClass == UsbConstants.USB_CLASS_PRINTER) {
                return pipe
            }
            fallbackPipe = fallbackPipe ?: pipe
        }

        return fallbackPipe
            ?: throw IllegalStateException(
                "Connected USB printer does not expose a writable bulk endpoint.",
            )
    }

    private fun findBulkOutEndpoint(usbInterface: UsbInterface): UsbEndpoint? {
        for (index in 0 until usbInterface.endpointCount) {
            val endpoint = usbInterface.getEndpoint(index)
            if (endpoint.direction == UsbConstants.USB_DIR_OUT &&
                endpoint.type == UsbConstants.USB_ENDPOINT_XFER_BULK
            ) {
                return endpoint
            }
        }
        return null
    }

    private fun ensurePermission(
        device: UsbDevice,
        requestIfMissing: Boolean,
    ): Boolean {
        if (usbManager.hasPermission(device)) {
            return true
        }
        if (!requestIfMissing) {
            return false
        }

        val permissionFuture = CompletableFuture<Boolean>()
        synchronized(permissionLock) {
            pendingPermission?.complete(false)
            pendingPermission = permissionFuture
            pendingPermissionDeviceId = device.deviceId
        }

        val intent = Intent(permissionAction).setPackage(activity.packageName)
        val pendingIntent = PendingIntent.getBroadcast(
            activity,
            device.deviceId,
            intent,
            permissionIntentFlags(),
        )
        usbManager.requestPermission(device, pendingIntent)

        return try {
            permissionFuture.get(8, TimeUnit.SECONDS)
        } finally {
            synchronized(permissionLock) {
                if (pendingPermission === permissionFuture) {
                    pendingPermission = null
                    pendingPermissionDeviceId = null
                }
            }
        }
    }

    private fun permissionIntentFlags(): Int {
        var flags = PendingIntent.FLAG_UPDATE_CURRENT
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            flags = flags or PendingIntent.FLAG_MUTABLE
        }
        return flags
    }

    private fun registerPermissionReceiver() {
        if (permissionReceiverRegistered) {
            return
        }

        val filter = IntentFilter(permissionAction)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            activity.registerReceiver(
                permissionReceiver,
                filter,
                Context.RECEIVER_NOT_EXPORTED,
            )
        } else {
            @Suppress("DEPRECATION")
            activity.registerReceiver(permissionReceiver, filter)
        }
        permissionReceiverRegistered = true
    }

    private fun buildReceiptBytes(payload: String): ByteArray {
        val normalized = payload.replace("\r\n", "\n").replace('\r', '\n')
        val textBytes = normalized.map { character ->
            val codePoint = character.code
            if (codePoint <= 0xFF) {
                codePoint.toByte()
            } else {
                '?'.code.toByte()
            }
        }

        return byteArrayOf(
            0x1B,
            0x40,
        ) + textBytes.toByteArray() + byteArrayOf(
            0x0A,
            0x0A,
            0x1D,
            0x56,
            0x41,
            0x10,
        )
    }

    private fun UsbDevice.displayName(): String {
        val parts = listOfNotNull(
            manufacturerName?.trim()?.takeIf { it.isNotEmpty() },
            productName?.trim()?.takeIf { it.isNotEmpty() },
        )
        return when {
            parts.isNotEmpty() -> parts.joinToString(" ")
            deviceName.isNotBlank() -> deviceName
            else -> "USB printer"
        }
    }

    private data class PrinterPipe(
        val usbInterface: UsbInterface,
        val outEndpoint: UsbEndpoint,
    )
}
