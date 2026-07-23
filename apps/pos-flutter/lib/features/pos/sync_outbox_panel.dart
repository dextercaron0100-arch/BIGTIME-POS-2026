import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/database/app_database.dart';
import '../../core/providers/app_providers.dart';
import '../../core/services/sync_service.dart';

Future<void> showSyncOutboxPanel(
  BuildContext context, {
  required String branchId,
  required String terminalId,
}) {
  return showDialog<void>(
    context: context,
    builder: (_) => Dialog(
      child: SizedBox(
        width: 980,
        height: 620,
        child: _SyncOutboxPanel(branchId: branchId, terminalId: terminalId),
      ),
    ),
  );
}

class _SyncOutboxPanel extends ConsumerStatefulWidget {
  const _SyncOutboxPanel({required this.branchId, required this.terminalId});

  final String branchId;
  final String terminalId;

  @override
  ConsumerState<_SyncOutboxPanel> createState() => _SyncOutboxPanelState();
}

class _SyncOutboxPanelState extends ConsumerState<_SyncOutboxPanel> {
  bool _syncing = false;

  Future<void> _flushQueue() async {
    if (_syncing) {
      return;
    }
    setState(() => _syncing = true);
    try {
      final result = await ref
          .read(syncServiceProvider)
          .flushPending(
            branchId: widget.branchId,
            terminalId: widget.terminalId,
          );
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(result.message)));
    } finally {
      if (mounted) {
        setState(() => _syncing = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final entriesState = ref
        .read(syncServiceProvider)
        .watchOutboxRecords(limit: 180);
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                'Sync Reliability Center',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const Spacer(),
              OutlinedButton.icon(
                onPressed: _syncing ? null : _flushQueue,
                icon: Icon(_syncing ? Icons.sync : Icons.cloud_upload_outlined),
                label: Text(_syncing ? 'Syncing...' : 'Sync Now'),
              ),
              const SizedBox(width: 8),
              IconButton(
                tooltip: 'Close',
                onPressed: () => Navigator.of(context).pop(),
                icon: const Icon(Icons.close),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            'Branch ${widget.branchId} • Terminal ${widget.terminalId}',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 12),
          Expanded(
            child: StreamBuilder<List<SyncQueueEntry>>(
              stream: entriesState,
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting &&
                    !snapshot.hasData) {
                  return const Center(child: CircularProgressIndicator());
                }
                final rows = snapshot.data ?? const <SyncQueueEntry>[];
                if (rows.isEmpty) {
                  return const Center(child: Text('Outbox is empty.'));
                }

                final syncService = ref.read(syncServiceProvider);
                return DecoratedBox(
                  decoration: BoxDecoration(
                    border: Border.all(color: const Color(0xFFDCE5F1)),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: ListView.separated(
                    itemBuilder: (_, index) {
                      final entry = rows[index];
                      final status = _entryStatus(entry, syncService);
                      return ListTile(
                        dense: true,
                        title: Text(
                          '${entry.targetTable} • ${entry.operation}',
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                        subtitle: Text(
                          'ID: ${entry.id}\nRecord: ${entry.recordId}\nCreated: ${entry.localCreatedAt.toLocal().toString().split('.').first}',
                        ),
                        trailing: SizedBox(
                          width: 280,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              _StatusPill(
                                status: status.label,
                                tone: status.tone,
                              ),
                              const SizedBox(height: 4),
                              Text(
                                'Retry #${entry.retryCount}',
                                style: const TextStyle(fontSize: 12),
                              ),
                              if (status.nextRetryAt != null)
                                Text(
                                  'Next retry: ${status.nextRetryAt!.toLocal().toString().split('.').first}',
                                  style: const TextStyle(
                                    fontSize: 11,
                                    color: Colors.black54,
                                  ),
                                ),
                              if (status.message != null &&
                                  status.message!.trim().isNotEmpty)
                                Text(
                                  status.message!,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  textAlign: TextAlign.end,
                                  style: const TextStyle(
                                    fontSize: 11,
                                    color: Color(0xFFB91C1C),
                                  ),
                                ),
                            ],
                          ),
                        ),
                      );
                    },
                    separatorBuilder: (context, index) =>
                        const Divider(height: 1),
                    itemCount: rows.length,
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  _OutboxEntryStatus _entryStatus(
    SyncQueueEntry entry,
    SyncService syncService,
  ) {
    if (entry.syncedAt != null) {
      return const _OutboxEntryStatus(
        label: 'Synced',
        tone: _StatusTone.success,
      );
    }
    final message = syncService.outboxErrorMessage(entry.error);
    final nextRetryAt = syncService.outboxNextRetryAt(entry.error);
    if (message.trim().isNotEmpty) {
      final waitingRetry =
          nextRetryAt != null && nextRetryAt.isAfter(DateTime.now().toUtc());
      return _OutboxEntryStatus(
        label: waitingRetry ? 'Retry Pending' : 'Failed',
        tone: waitingRetry ? _StatusTone.warning : _StatusTone.danger,
        message: message,
        nextRetryAt: nextRetryAt,
      );
    }

    return const _OutboxEntryStatus(
      label: 'Pending',
      tone: _StatusTone.warning,
    );
  }
}

enum _StatusTone { success, warning, danger }

class _OutboxEntryStatus {
  const _OutboxEntryStatus({
    required this.label,
    required this.tone,
    this.message,
    this.nextRetryAt,
  });

  final String label;
  final _StatusTone tone;
  final String? message;
  final DateTime? nextRetryAt;
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.status, required this.tone});

  final String status;
  final _StatusTone tone;

  @override
  Widget build(BuildContext context) {
    final (background, textColor) = switch (tone) {
      _StatusTone.success => (const Color(0xFFEFFAF3), const Color(0xFF15803D)),
      _StatusTone.warning => (const Color(0xFFFFF7ED), const Color(0xFFB45309)),
      _StatusTone.danger => (const Color(0xFFFEF2F2), const Color(0xFFB91C1C)),
    };
    return DecoratedBox(
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        child: Text(
          status,
          style: TextStyle(
            color: textColor,
            fontWeight: FontWeight.w600,
            fontSize: 11,
          ),
        ),
      ),
    );
  }
}
