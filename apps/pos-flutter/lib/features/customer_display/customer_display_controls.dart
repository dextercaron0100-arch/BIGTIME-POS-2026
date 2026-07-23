import 'dart:io';

import 'package:file_selector/file_selector.dart';
import 'package:flutter/material.dart';

import 'customer_display_app.dart';
import 'customer_display_launcher.dart';
import 'customer_display_models.dart';
import 'customer_display_storage.dart';

Future<void> showCustomerDisplayControls(BuildContext context) {
  return showDialog<void>(
    context: context,
    barrierDismissible: false,
    builder: (_) => const _CustomerDisplaySettingsDialog(),
  );
}

class _CustomerDisplaySettingsDialog extends StatefulWidget {
  const _CustomerDisplaySettingsDialog();

  @override
  State<_CustomerDisplaySettingsDialog> createState() =>
      _CustomerDisplaySettingsDialogState();
}

class _CustomerDisplaySettingsDialogState
    extends State<_CustomerDisplaySettingsDialog> {
  final CustomerDisplayStorage _storage = CustomerDisplayStorage();
  late final CustomerDisplayLauncher _launcher = CustomerDisplayLauncher(
    _storage,
  );
  final TextEditingController _thankYouController = TextEditingController();

  List<CustomerDisplayMediaAsset> _assets = const <CustomerDisplayMediaAsset>[];
  bool _launchFullscreen = true;
  int _imageDurationSeconds = 7;
  bool _loading = true;
  bool _saving = false;
  bool _isRunning = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _thankYouController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final settings = await _storage.readSettings();
    final running = await _storage.hasFreshHeartbeat();

    if (!mounted) {
      return;
    }

    setState(() {
      _assets = settings.assets;
      _launchFullscreen = settings.launchFullscreen;
      _imageDurationSeconds = settings.imageDurationSeconds;
      _thankYouController.text = settings.thankYouMessage;
      _isRunning = running;
      _loading = false;
    });
  }

  Future<void> _saveSettings({bool showFeedback = true}) async {
    if (_saving) {
      return;
    }

    setState(() => _saving = true);

    final thankYouMessage = _thankYouController.text.trim().isNotEmpty
        ? _thankYouController.text.trim()
        : CustomerDisplaySettings.defaults().thankYouMessage;

    try {
      await _storage.pruneCachedMediaFiles(
        _assets.map((asset) => asset.path).toSet(),
      );
      await _storage.writeSettings(
        CustomerDisplaySettings(
          assets: _assets,
          thankYouMessage: thankYouMessage,
          launchFullscreen: _launchFullscreen,
          imageDurationSeconds: _imageDurationSeconds,
        ),
      );

      if (!mounted) {
        return;
      }

      if (showFeedback) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('CFD settings saved.')));
      }
    } catch (error) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to save CFD settings: $error')),
      );
    } finally {
      if (mounted) {
        setState(() => _saving = false);
      }
    }
  }

  Future<void> _addMediaFiles() async {
    final files = await openFiles(
      acceptedTypeGroups: const <XTypeGroup>[
        XTypeGroup(
          label: 'Customer display media',
          extensions: <String>[
            'jpg',
            'jpeg',
            'png',
            'gif',
            'bmp',
            'webp',
            'mp4',
            'mov',
            'm4v',
            'avi',
            'wmv',
            'mkv',
            'webm',
          ],
        ),
      ],
      confirmButtonText: 'Add',
    );

    if (files.isEmpty) {
      return;
    }

    var added = 0;
    var skipped = 0;
    final nextAssets = List<CustomerDisplayMediaAsset>.from(_assets);

    for (final selectedFile in files) {
      final sourcePath = selectedFile.path;
      final kind = customerDisplayMediaKindForPath(sourcePath);
      if (kind == null) {
        skipped += 1;
        continue;
      }

      final bytes = await selectedFile.readAsBytes();
      if (bytes.isEmpty) {
        skipped += 1;
        continue;
      }

      final sanitizedName = selectedFile.name.replaceAll(
        RegExp(r'[^A-Za-z0-9._-]'),
        '_',
      );
      final cacheName =
          '${DateTime.now().microsecondsSinceEpoch}_$sanitizedName';
      final targetFile = await _storage.mediaFile(cacheName);
      await targetFile.writeAsBytes(bytes, flush: true);

      nextAssets.add(
        CustomerDisplayMediaAsset(
          id: '${DateTime.now().microsecondsSinceEpoch}-${targetFile.path.hashCode}',
          path: targetFile.path,
          kind: kind,
          label: selectedFile.name,
        ),
      );
      added += 1;
    }

    if (!mounted) {
      return;
    }

    setState(() {
      _assets = nextAssets;
    });

    final message = skipped > 0
        ? '$added media file(s) added, $skipped skipped.'
        : '$added media file(s) added.';
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _removeAsset(CustomerDisplayMediaAsset asset) async {
    setState(() {
      _assets = _assets
          .where((existingAsset) => existingAsset.id != asset.id)
          .toList(growable: false);
    });

    try {
      final file = File(asset.path);
      if (await file.exists()) {
        await file.delete();
      }
    } catch (_) {
      // Keep UI responsive even if the old cached file cannot be deleted.
    }
  }

  Future<void> _launchDisplay() async {
    await _saveSettings(showFeedback: false);
    if (!mounted) {
      return;
    }

    if (!Platform.isWindows && !Platform.isAndroid) {
      await Navigator.of(context).push<void>(
        MaterialPageRoute<void>(
          builder: (_) => const CustomerDisplayScreen(),
          fullscreenDialog: true,
        ),
      );
      return;
    }

    bool launched = false;
    String? errorMessage;
    try {
      launched = await _launcher.launch();
    } catch (error) {
      errorMessage = error.toString();
    }
    final running = await _storage.hasFreshHeartbeat();

    if (!mounted) {
      return;
    }

    setState(() => _isRunning = running || launched);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          errorMessage ??
              (Platform.isAndroid
                  ? (running
                        ? 'Customer face display is running on the second screen.'
                        : 'No secondary display detected for CFD.')
                  : (launched
                        ? 'Customer face display launched.'
                        : 'Customer face display is already running.')),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Dialog(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: SizedBox(
            width: 320,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                CircularProgressIndicator(),
                SizedBox(height: 16),
                Text('Loading customer display settings...'),
              ],
            ),
          ),
        ),
      );
    }

    return Dialog(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 820, maxHeight: 720),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Customer Face Display',
                          style: Theme.of(context).textTheme.headlineSmall,
                        ),
                        const SizedBox(height: 6),
                        Text(
                          _isRunning
                              ? Platform.isWindows
                                    ? 'Running on Windows. Edit and save your CFD settings here.'
                                    : 'Running on the second screen. Edit and save your CFD settings here.'
                              : 'Configure your CFD experience and launch the customer-facing display.',
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.close),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              DecoratedBox(
                decoration: BoxDecoration(
                  color: const Color(0xFFF9F1E8),
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: const Color(0xFFE6D9CC)),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Text(
                    Platform.isWindows
                        ? 'You can edit CFD settings here. Dashboard sync may overwrite local changes after the next successful sync.'
                        : 'You can configure CFD settings from mobile here. When a second screen is connected, CFD opens there automatically instead of overlaying the POS screen.',
                  ),
                ),
              ),
              const SizedBox(height: 18),
              Row(
                children: [
                  const Spacer(),
                  FilledButton.icon(
                    onPressed: _addMediaFiles,
                    icon: const Icon(Icons.add_photo_alternate_outlined),
                    label: const Text('Add Media'),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Expanded(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: const Color(0xFFE6D9CC)),
                    color: const Color(0xFFFFFBF7),
                  ),
                  child: _assets.isEmpty
                      ? Center(
                          child: Padding(
                            padding: const EdgeInsets.all(24),
                            child: Text(
                              'No media selected yet.\nAdd images or videos that should play while the customer sees the current total.',
                              textAlign: TextAlign.center,
                              style: Theme.of(context).textTheme.titleMedium,
                            ),
                          ),
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.all(16),
                          itemBuilder: (context, index) {
                            final asset = _assets[index];
                            final isVideo =
                                asset.kind == CustomerDisplayMediaKind.video;
                            return ListTile(
                              leading: Icon(
                                isVideo
                                    ? Icons.video_library_outlined
                                    : Icons.image_outlined,
                              ),
                              title: Text(asset.fileName),
                              subtitle: Text(asset.path),
                              trailing: IconButton(
                                onPressed: () => _removeAsset(asset),
                                icon: const Icon(Icons.delete_outline),
                              ),
                            );
                          },
                          separatorBuilder: (_, _) => const Divider(height: 1),
                          itemCount: _assets.length,
                        ),
                ),
              ),
              const SizedBox(height: 20),
              TextField(
                controller: _thankYouController,
                decoration: const InputDecoration(
                  labelText: 'Thank-you message',
                  hintText: 'Thank you for your purchase',
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: DropdownButtonFormField<int>(
                      initialValue: _imageDurationSeconds,
                      decoration: const InputDecoration(
                        labelText: 'Image rotation',
                      ),
                      items: const <int>[4, 6, 8, 10, 12]
                          .map(
                            (seconds) => DropdownMenuItem<int>(
                              value: seconds,
                              child: Text('$seconds seconds'),
                            ),
                          )
                          .toList(growable: false),
                      onChanged: (value) {
                        if (value == null) {
                          return;
                        }
                        setState(() => _imageDurationSeconds = value);
                      },
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: SwitchListTile.adaptive(
                      value: _launchFullscreen,
                      onChanged: (value) =>
                          setState(() => _launchFullscreen = value),
                      title: const Text('Launch fullscreen'),
                      contentPadding: EdgeInsets.zero,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              Row(
                children: [
                  TextButton(
                    onPressed: () => Navigator.of(context).pop(),
                    child: const Text('Close'),
                  ),
                  const Spacer(),
                  FilledButton(
                    onPressed: _saving ? null : _saveSettings,
                    child: Text(_saving ? 'Saving...' : 'Save'),
                  ),
                  const SizedBox(width: 10),
                  FilledButton.icon(
                    onPressed: _launchDisplay,
                    icon: const Icon(Icons.monitor_outlined),
                    label: Text(
                      Platform.isWindows
                          ? (_isRunning ? 'Display Running' : 'Open CFD')
                          : (_isRunning ? 'CFD Running' : 'Open CFD'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
