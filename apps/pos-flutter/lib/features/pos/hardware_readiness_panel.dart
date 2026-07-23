import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/app_providers.dart';
import '../../platform/hardware_adapter.dart';

Future<void> showHardwareReadinessPanel(BuildContext context) {
  return showDialog<void>(
    context: context,
    barrierDismissible: true,
    builder: (dialogContext) => const Dialog(
      child: SizedBox(width: 780, child: _HardwareReadinessPanel()),
    ),
  );
}

class _HardwareReadinessPanel extends ConsumerStatefulWidget {
  const _HardwareReadinessPanel();

  @override
  ConsumerState<_HardwareReadinessPanel> createState() =>
      _HardwareReadinessPanelState();
}

class _HardwareReadinessPanelState
    extends ConsumerState<_HardwareReadinessPanel> {
  final TextEditingController _scannerInputController = TextEditingController();
  HardwareHealthStatus? _hardwareStatus;
  String? _lastProbeError;
  String? _lastScannedValue;
  String? _lastPrintPayload;
  bool _loading = true;
  bool _busy = false;
  bool _online = false;
  DateTime? _lastOnlineCheckedAt;

  @override
  void initState() {
    super.initState();
    _refreshAll();
  }

  @override
  void dispose() {
    _scannerInputController.dispose();
    super.dispose();
  }

  Future<void> _refreshAll() async {
    setState(() => _loading = true);
    try {
      final adapter = ref.read(hardwareAdapterProvider);
      final sync = ref.read(syncServiceProvider);
      final result = await Future.wait<Object?>([
        adapter.checkHealth(),
        sync.isOnline(),
      ]);

      if (!mounted) {
        return;
      }

      setState(() {
        _hardwareStatus = result[0]! as HardwareHealthStatus;
        _online = result[1]! as bool;
        _lastOnlineCheckedAt = DateTime.now();
        _lastProbeError = null;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _lastProbeError = error.toString().split('\n').first;
        _loading = false;
      });
    }
  }

  Future<void> _runAction(Future<void> Function() action) async {
    if (_busy) {
      return;
    }
    setState(() => _busy = true);
    try {
      await action();
    } catch (error) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.toString().split('\n').first)),
      );
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  Future<void> _printTest() {
    final payload = StringBuffer()
      ..writeln('BIGTIME POS')
      ..writeln('HARDWARE SELF TEST')
      ..writeln('------------------------------')
      ..writeln('Terminal: ${ref.read(terminalInfoProvider).name}')
      ..writeln('Checked at: ${DateTime.now().toLocal()}')
      ..writeln('Result: PASS')
      ..writeln('------------------------------')
      ..writeln('This is a printer readiness test.');

    final receipt = payload.toString();
    return _runAction(() async {
      await ref.read(hardwareAdapterProvider).printReceipt(receipt);
      if (!mounted) {
        return;
      }
      setState(() => _lastPrintPayload = receipt);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Printer test sent successfully.')),
      );
    });
  }

  Future<void> _retrySpool() {
    final payload = _lastPrintPayload;
    if (payload == null || payload.isEmpty) {
      return _printTest();
    }
    return _runAction(() async {
      await ref.read(hardwareAdapterProvider).printReceipt(payload);
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Last print payload sent again.')),
      );
    });
  }

  Future<void> _pulseDrawer() {
    return _runAction(() async {
      await ref.read(hardwareAdapterProvider).openCashDrawer();
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Cash drawer pulse command sent.')),
      );
    });
  }

  Future<void> _reconnectHardware() {
    return _runAction(() async {
      await ref.read(hardwareAdapterProvider).reconnect();
      await _refreshAll();
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Hardware reconnection probe completed.')),
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final status = _hardwareStatus;
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                'Hardware Readiness',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const Spacer(),
              IconButton(
                tooltip: 'Refresh',
                onPressed: _busy ? null : _refreshAll,
                icon: const Icon(Icons.refresh),
              ),
              IconButton(
                tooltip: 'Close',
                onPressed: () => Navigator.of(context).pop(),
                icon: const Icon(Icons.close),
              ),
            ],
          ),
          const SizedBox(height: 8),
          if (_loading)
            const LinearProgressIndicator(minHeight: 2)
          else if (_lastProbeError != null)
            Text(_lastProbeError!, style: const TextStyle(color: Colors.red)),
          const SizedBox(height: 12),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              _HealthTile(
                label: 'Network',
                ready: _online,
                value: _online ? 'Online' : 'Offline',
                note: _lastOnlineCheckedAt == null
                    ? null
                    : 'Checked ${_lastOnlineCheckedAt!.toLocal().toString().split('.').first}',
              ),
              _HealthTile(
                label: 'Printer',
                ready: status?.printerReady ?? false,
                value: status?.printerName ?? 'No printer detected',
                note: status?.note,
              ),
              _HealthTile(
                label: 'Cash Drawer',
                ready: status?.cashDrawerReady ?? false,
                value: status?.cashDrawerReady == true
                    ? 'Ready'
                    : 'Unavailable',
              ),
              _HealthTile(
                label: 'Scanner',
                ready: status?.scannerReady ?? true,
                value: _lastScannedValue == null
                    ? 'Waiting for scan'
                    : 'Last scan: $_lastScannedValue',
                note: 'Use scanner input field below and press Enter.',
              ),
            ],
          ),
          const SizedBox(height: 14),
          TextField(
            controller: _scannerInputController,
            textInputAction: TextInputAction.done,
            onSubmitted: (value) {
              final trimmed = value.trim();
              if (trimmed.isEmpty) {
                return;
              }
              setState(() {
                _lastScannedValue = trimmed;
                _scannerInputController.clear();
              });
            },
            decoration: const InputDecoration(
              labelText: 'Scanner test input',
              hintText: 'Scan barcode here then press Enter',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              FilledButton.icon(
                onPressed: _busy ? null : _printTest,
                icon: const Icon(Icons.print_outlined),
                label: const Text('Printer Test'),
              ),
              OutlinedButton.icon(
                onPressed: _busy ? null : _retrySpool,
                icon: const Icon(Icons.replay_circle_filled_outlined),
                label: const Text('Retry Spool'),
              ),
              OutlinedButton.icon(
                onPressed: _busy ? null : _pulseDrawer,
                icon: const Icon(Icons.point_of_sale_outlined),
                label: const Text('Open Drawer'),
              ),
              OutlinedButton.icon(
                onPressed: _busy ? null : _reconnectHardware,
                icon: const Icon(Icons.usb_outlined),
                label: Text(Platform.isWindows ? 'Reconnect' : 'Probe'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _HealthTile extends StatelessWidget {
  const _HealthTile({
    required this.label,
    required this.ready,
    required this.value,
    this.note,
  });

  final String label;
  final bool ready;
  final String value;
  final String? note;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 170,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: ready ? const Color(0xFFEFFAF3) : const Color(0xFFFEF2F2),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: ready ? const Color(0xFFB7E4C7) : const Color(0xFFF8CACA),
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(
                    ready ? Icons.check_circle : Icons.error_outline,
                    size: 16,
                    color: ready
                        ? const Color(0xFF15803D)
                        : const Color(0xFFB91C1C),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    label,
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(value, style: const TextStyle(fontSize: 12)),
              if (note != null && note!.trim().isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  note!,
                  style: const TextStyle(fontSize: 11, color: Colors.black54),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
