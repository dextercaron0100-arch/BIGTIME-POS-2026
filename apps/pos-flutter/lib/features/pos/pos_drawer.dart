import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/app_providers.dart';
import '../../core/services/back_office_client.dart';

class _DrawerColors {
  static const androidBgStart = Color(0xFF0B0F13);
  static const androidBgEnd = Color(0xFF141A22);
  static const androidPanel = Color(0x59000000);
  static const androidPanelSoft = Color(0x0DFFFFFF);
  static const androidPanelBorder = Color(0x26FFFFFF);
  static const androidText = Color(0xFFF8FAFC);
  static const androidTextMuted = Color(0xFF94A3B8);
  static const androidActionBg = Color(0x14FFFFFF);
  static const androidActionBorder = Color(0x1FFFFFFF);
  static const androidPillActiveBg = Color(0x3310B981);
  static const androidPillActiveBorder = Color(0x6658D0A9);
  static const androidPillText = Color(0xFFD1FAE5);
  static const androidDangerBg = Color(0x19EF4444);
  static const androidDangerBorder = Color(0x33EF4444);
}

enum PosNavItem {
  sales,
  receipts,
  shift,
  items,
  settings,
  backOffice,
  apps,
  support,
}

class PosDrawer extends ConsumerWidget {
  static Duration get _navigationDelay => Platform.isAndroid
      ? const Duration(milliseconds: 40)
      : const Duration(milliseconds: 220);

  const PosDrawer({
    super.key,
    required this.userName,
    required this.posName,
    required this.storeName,
    required this.appVersion,
    required this.activeItem,
    this.onItemTap,
  });

  final String userName;
  final String posName;
  final String storeName;
  final String appVersion;
  final PosNavItem activeItem;
  final ValueChanged<PosNavItem>? onItemTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isAndroid = Platform.isAndroid;
    return Drawer(
      width: 280,
      backgroundColor: isAndroid
          ? _DrawerColors.androidBgStart
          : const Color(0xFF1A1F2E),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.only(
          topRight: Radius.circular(0),
          bottomRight: Radius.circular(0),
        ),
      ),
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: isAndroid
                ? const [
                    _DrawerColors.androidBgStart,
                    _DrawerColors.androidBgEnd,
                  ]
                : const [Color(0xFF1A1F2E), Color(0xFF151927)],
          ),
        ),
        child: Column(
          children: [
            _buildHeader(isAndroid),
            const SizedBox(height: 8),
            Expanded(child: _buildNavItems(context, ref, isAndroid)),
            _buildFooter(isAndroid),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(bool isAndroid) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(20, 48, 20, 24),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: isAndroid
              ? const [
                  _DrawerColors.androidPanel,
                  _DrawerColors.androidPanelSoft,
                ]
              : const [Color(0xFF2563EB), Color(0xFF1D4ED8)],
        ),
        border: Border(
          bottom: BorderSide(
            color: isAndroid
                ? _DrawerColors.androidPanelBorder
                : Colors.white.withValues(alpha: 0.12),
          ),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: isAndroid
                  ? _DrawerColors.androidActionBg
                  : Colors.white.withValues(alpha: 0.2),
              shape: BoxShape.circle,
              border: Border.all(
                color: isAndroid
                    ? _DrawerColors.androidActionBorder
                    : Colors.white.withValues(alpha: 0.4),
                width: 1.5,
              ),
            ),
            child: Center(
              child: Text(
                _initials(userName),
                style: TextStyle(
                  color: isAndroid
                      ? _DrawerColors.androidText
                      : Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                  letterSpacing: 0.5,
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),
          Text(
            userName,
            style: TextStyle(
              color: isAndroid ? _DrawerColors.androidText : Colors.white,
              fontWeight: FontWeight.w700,
              fontSize: 16,
              letterSpacing: 0.3,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            posName,
            style: TextStyle(
              color: isAndroid
                  ? _DrawerColors.androidTextMuted
                  : Colors.white.withValues(alpha: 0.75),
              fontSize: 12,
              fontWeight: FontWeight.w400,
            ),
          ),
          const SizedBox(height: 1),
          Text(
            storeName,
            style: TextStyle(
              color: isAndroid
                  ? _DrawerColors.androidTextMuted.withValues(alpha: 0.8)
                  : Colors.white.withValues(alpha: 0.6),
              fontSize: 11,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNavItems(BuildContext context, WidgetRef ref, bool isAndroid) {
    final isOnline = ref.watch(onlineStatusProvider).valueOrNull ?? true;
    return ListView(
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
      children: [
        _navItem(
          context,
          isAndroid: isAndroid,
          item: PosNavItem.sales,
          icon: Icons.storefront_outlined,
          activeIcon: Icons.storefront,
          label: 'Sales',
        ),
        _navItem(
          context,
          isAndroid: isAndroid,
          item: PosNavItem.receipts,
          icon: Icons.receipt_long_outlined,
          activeIcon: Icons.receipt_long,
          label: 'Receipts',
        ),
        _navItem(
          context,
          isAndroid: isAndroid,
          item: PosNavItem.shift,
          icon: Icons.access_time_outlined,
          activeIcon: Icons.access_time_filled,
          label: 'Shift',
        ),
        _navItem(
          context,
          isAndroid: isAndroid,
          item: PosNavItem.items,
          icon: Icons.inventory_2_outlined,
          activeIcon: Icons.inventory_2,
          label: 'Items',
        ),
        _navItem(
          context,
          isAndroid: isAndroid,
          item: PosNavItem.settings,
          icon: Icons.settings_outlined,
          activeIcon: Icons.settings,
          label: 'Settings',
        ),
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 4),
          child: Divider(
            color: isAndroid
                ? _DrawerColors.androidPanelBorder
                : Colors.white.withValues(alpha: 0.08),
            height: 1,
          ),
        ),
        _navItem(
          context,
          isAndroid: isAndroid,
          item: PosNavItem.backOffice,
          icon: Icons.bar_chart_outlined,
          activeIcon: Icons.bar_chart,
          label: 'Back Office',
        ),
        const SizedBox(height: 10),
        _AuthSessionsPanel(isOnline: isOnline, isAndroid: isAndroid),
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 4),
          child: Divider(
            color: isAndroid
                ? _DrawerColors.androidPanelBorder
                : Colors.white.withValues(alpha: 0.08),
            height: 1,
          ),
        ),
        _navItem(
          context,
          isAndroid: isAndroid,
          item: PosNavItem.apps,
          icon: Icons.apps_outlined,
          activeIcon: Icons.apps,
          label: 'Apps',
        ),
        _navItem(
          context,
          isAndroid: isAndroid,
          item: PosNavItem.support,
          icon: Icons.help_outline,
          activeIcon: Icons.help,
          label: 'Support',
        ),
      ],
    );
  }

  Widget _navItem(
    BuildContext context, {
    required bool isAndroid,
    required PosNavItem item,
    required IconData icon,
    required IconData activeIcon,
    required String label,
  }) {
    final isActive = activeItem == item;

    return Padding(
      padding: const EdgeInsets.only(bottom: 2),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(10),
        child: InkWell(
          borderRadius: BorderRadius.circular(10),
          onTap: () {
            final callback = onItemTap;
            Navigator.of(context).pop();
            if (callback == null) {
              return;
            }
            Future<void>.delayed(_navigationDelay, () => callback(item));
          },
          child: AnimatedContainer(
            duration: Platform.isAndroid
                ? Duration.zero
                : const Duration(milliseconds: 180),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(10),
              color: isActive
                  ? (isAndroid
                        ? _DrawerColors.androidPillActiveBg
                        : const Color(0xFF2563EB).withValues(alpha: 0.15))
                  : (isAndroid ? _DrawerColors.androidActionBg : Colors.transparent),
              border: Border.all(
                color: isActive
                    ? (isAndroid
                          ? _DrawerColors.androidPillActiveBorder
                          : Colors.transparent)
                    : (isAndroid
                          ? _DrawerColors.androidActionBorder
                          : Colors.transparent),
              ),
            ),
            child: Row(
              children: [
                Icon(
                  isActive ? activeIcon : icon,
                  size: 20,
                  color: isActive
                      ? (isAndroid
                            ? _DrawerColors.androidPillText
                            : const Color(0xFF60A5FA))
                      : (isAndroid
                            ? _DrawerColors.androidTextMuted
                            : const Color(0xFF9CA3AF)),
                ),
                const SizedBox(width: 14),
                Text(
                  label,
                  style: TextStyle(
                    color: isActive
                        ? (isAndroid
                              ? _DrawerColors.androidText
                              : const Color(0xFFE0EEFF))
                        : (isAndroid
                              ? _DrawerColors.androidTextMuted
                              : const Color(0xFFD1D5DB)),
                    fontWeight: isActive ? FontWeight.w600 : FontWeight.w400,
                    fontSize: 14,
                    letterSpacing: 0.2,
                  ),
                ),
                if (isActive) ...[
                  const Spacer(),
                  Container(
                    width: 6,
                    height: 6,
                    decoration: BoxDecoration(
                      color: isAndroid
                          ? const Color(0xFF34D399)
                          : const Color(0xFF60A5FA),
                      shape: BoxShape.circle,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildFooter(bool isAndroid) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      child: Row(
        children: [
          Icon(
            Icons.info_outline,
            size: 14,
            color: isAndroid
                ? _DrawerColors.androidTextMuted.withValues(alpha: 0.6)
                : Colors.white.withValues(alpha: 0.3),
          ),
          const SizedBox(width: 6),
          Text(
            appVersion,
            style: TextStyle(
              color: isAndroid
                  ? _DrawerColors.androidTextMuted.withValues(alpha: 0.6)
                  : Colors.white.withValues(alpha: 0.3),
              fontSize: 11,
            ),
          ),
        ],
      ),
    );
  }

  String _initials(String name) {
    final parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
    }
    return name.isNotEmpty ? name[0].toUpperCase() : '?';
  }
}

class _AuthSessionsPanel extends ConsumerStatefulWidget {
  const _AuthSessionsPanel({
    required this.isOnline,
    required this.isAndroid,
  });

  final bool isOnline;
  final bool isAndroid;

  @override
  ConsumerState<_AuthSessionsPanel> createState() => _AuthSessionsPanelState();
}

class _AuthSessionsPanelState extends ConsumerState<_AuthSessionsPanel> {
  BackOfficeSessionPresence? _presence;
  bool _loading = true;
  bool _signingOutOthers = false;
  String? _signingOutSessionId;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      unawaited(_loadSessions());
    });
  }

  @override
  void didUpdateWidget(covariant _AuthSessionsPanel oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!oldWidget.isOnline && widget.isOnline) {
      unawaited(_loadSessions());
    }
  }

  Future<void> _loadSessions({bool showSpinner = true}) async {
    final client = ref.read(backOfficeClientProvider);
    if (!client.hasAccessToken) {
      if (!mounted) {
        return;
      }
      setState(() {
        _loading = false;
        _presence = null;
        _error = null;
      });
      return;
    }

    if (showSpinner && mounted) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }

    try {
      final presence = await client.fetchActiveSessions();
      if (!mounted) {
        return;
      }
      setState(() {
        _presence = presence;
        _loading = false;
        _error = null;
      });
    } on BackOfficeException catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _loading = false;
        _error = error.statusCode == 401 ? null : error.message;
      });
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _loading = false;
        _error = error.toString().split('\n').first;
      });
    }
  }

  Future<void> _signOutOthers() async {
    if (_signingOutOthers) {
      return;
    }

    final messenger = ScaffoldMessenger.of(context);
    setState(() {
      _signingOutOthers = true;
    });

    try {
      final count = await ref
          .read(backOfficeClientProvider)
          .signOutOtherSessions();
      if (!mounted) {
        return;
      }
      messenger.showSnackBar(
        SnackBar(
          content: Text(
            count == 0
                ? 'No other active devices were using this account.'
                : 'Signed out $count other device${count == 1 ? '' : 's'}.',
          ),
        ),
      );
      await _loadSessions(showSpinner: false);
    } on BackOfficeException catch (error) {
      if (mounted && error.statusCode != 401) {
        messenger.showSnackBar(SnackBar(content: Text(error.message)));
      }
    } finally {
      if (mounted) {
        setState(() {
          _signingOutOthers = false;
        });
      }
    }
  }

  Future<void> _signOutSession(BackOfficeDeviceSession session) async {
    if (_signingOutSessionId != null) {
      return;
    }

    final messenger = ScaffoldMessenger.of(context);
    setState(() {
      _signingOutSessionId = session.id;
    });

    try {
      await ref.read(backOfficeClientProvider).signOutSession(session.id);
      if (!mounted) {
        return;
      }
      messenger.showSnackBar(
        SnackBar(content: Text('${session.terminalName} signed out.')),
      );
      await _loadSessions(showSpinner: false);
    } on BackOfficeException catch (error) {
      if (mounted && error.statusCode != 401) {
        messenger.showSnackBar(SnackBar(content: Text(error.message)));
      }
    } finally {
      if (mounted) {
        setState(() {
          _signingOutSessionId = null;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final client = ref.watch(backOfficeClientProvider);
    final sessions = _presence?.sessions ?? const <BackOfficeDeviceSession>[];
    final otherSessions = sessions
        .where((session) => !session.isCurrent)
        .toList();

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: widget.isAndroid
            ? _DrawerColors.androidPanelSoft
            : const Color(0x111E293B),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: widget.isAndroid
              ? _DrawerColors.androidPanelBorder
              : Colors.white.withValues(alpha: 0.08),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  color: widget.isAndroid
                      ? _DrawerColors.androidPillActiveBg
                      : const Color(0xFF2563EB).withValues(alpha: 0.18),
                  borderRadius: BorderRadius.circular(9),
                  border: widget.isAndroid
                      ? Border.all(color: _DrawerColors.androidPillActiveBorder)
                      : null,
                ),
                child: Icon(
                  Icons.devices_outlined,
                  color: widget.isAndroid
                      ? _DrawerColors.androidPillText
                      : const Color(0xFF93C5FD),
                  size: 16,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      "Where You're Logged In",
                      style: TextStyle(
                        color: widget.isAndroid
                            ? _DrawerColors.androidText
                            : const Color(0xFFE5EEF9),
                        fontWeight: FontWeight.w600,
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Manage other devices using this account.',
                      style: TextStyle(
                        color: widget.isAndroid
                            ? _DrawerColors.androidTextMuted
                            : const Color(0xFF94A3B8),
                        fontSize: 11,
                        height: 1.3,
                      ),
                    ),
                  ],
                ),
              ),
              IconButton(
                onPressed: _loading ? null : () => unawaited(_loadSessions()),
                icon: _loading
                    ? const SizedBox(
                        width: 14,
                        height: 14,
                        child: CircularProgressIndicator(strokeWidth: 1.6),
                      )
                    : const Icon(Icons.refresh_rounded, size: 18),
                color: widget.isAndroid
                    ? _DrawerColors.androidTextMuted
                    : const Color(0xFFCBD5E1),
                splashRadius: 18,
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (!widget.isOnline)
            _buildHint('Reconnect to the internet to check active devices.')
          else if (!client.hasAccessToken)
            _buildHint(
              'This appears after an online login. Offline-only login cannot manage other devices.',
            )
          else if (_error != null)
            _buildHint(_error!)
          else if (_loading && _presence == null)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 12),
              child: Center(
                child: SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 1.8),
                ),
              ),
            )
          else if (sessions.isEmpty)
            _buildHint('No active sessions found for this account yet.')
          else ...[
            for (final session in sessions)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: _SessionRow(
                  session: session,
                  busy: _signingOutSessionId == session.id,
                  onSignOut: session.isCurrent
                      ? null
                      : () => unawaited(_signOutSession(session)),
                ),
              ),
            if (otherSessions.isNotEmpty) ...[
              const SizedBox(height: 4),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: _signingOutOthers ? null : _signOutOthers,
                  icon: _signingOutOthers
                      ? const SizedBox(
                          width: 14,
                          height: 14,
                          child: CircularProgressIndicator(strokeWidth: 1.6),
                        )
                      : const Icon(Icons.logout_rounded, size: 16),
                  label: const Text('Sign Out Other Devices'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: widget.isAndroid
                        ? _DrawerColors.androidText
                        : const Color(0xFFE2E8F0),
                    backgroundColor: widget.isAndroid
                        ? _DrawerColors.androidDangerBg
                        : null,
                    side: BorderSide(
                      color: widget.isAndroid
                          ? _DrawerColors.androidDangerBorder
                          : Colors.white.withValues(alpha: 0.12),
                    ),
                    padding: const EdgeInsets.symmetric(vertical: 11),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
              ),
            ],
          ],
        ],
      ),
    );
  }

  Widget _buildHint(String text) {
    return Text(
      text,
      style: TextStyle(
        color: widget.isAndroid
            ? _DrawerColors.androidTextMuted
            : const Color(0xFF94A3B8),
        fontSize: 11.5,
        height: 1.45,
      ),
    );
  }
}

class _SessionRow extends StatelessWidget {
  const _SessionRow({
    required this.session,
    required this.busy,
    required this.onSignOut,
  });

  final BackOfficeDeviceSession session;
  final bool busy;
  final VoidCallback? onSignOut;

  @override
  Widget build(BuildContext context) {
    final isAndroid = Platform.isAndroid;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
      decoration: BoxDecoration(
        color: isAndroid
            ? _DrawerColors.androidActionBg
            : Colors.white.withValues(alpha: 0.04),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isAndroid
              ? _DrawerColors.androidActionBorder
              : Colors.white.withValues(alpha: 0.06),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 30,
            height: 30,
            decoration: BoxDecoration(
              color: isAndroid
                  ? _DrawerColors.androidPanel
                  : const Color(0xFF0F172A).withValues(alpha: 0.65),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(
              _iconForPlatform(session.platform),
              color: isAndroid
                  ? _DrawerColors.androidText
                  : const Color(0xFFBFDBFE),
              size: 16,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        session.terminalName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: isAndroid
                              ? _DrawerColors.androidText
                              : const Color(0xFFF8FAFC),
                          fontWeight: FontWeight.w600,
                          fontSize: 12.5,
                        ),
                      ),
                    ),
                    if (session.isCurrent)
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 7,
                          vertical: 3,
                        ),
                        decoration: BoxDecoration(
                          color: isAndroid
                              ? _DrawerColors.androidPillActiveBg
                              : const Color(
                                  0xFF2563EB,
                                ).withValues(alpha: 0.18),
                          borderRadius: BorderRadius.circular(999),
                          border: isAndroid
                              ? Border.all(
                                  color: _DrawerColors.androidPillActiveBorder,
                                )
                              : null,
                        ),
                        child: Text(
                          'This device',
                          style: TextStyle(
                            color: isAndroid
                                ? _DrawerColors.androidPillText
                                : const Color(0xFFBFDBFE),
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 3),
                Text(
                  '${_labelForPlatform(session.platform)} • Active ${_relativeTime(session.lastSeenAt)}',
                  style: TextStyle(
                    color: isAndroid
                        ? _DrawerColors.androidTextMuted
                        : const Color(0xFF94A3B8),
                    fontSize: 11,
                  ),
                ),
                if (!session.isCurrent && session.terminalId.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    session.terminalId,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: isAndroid
                          ? _DrawerColors.androidTextMuted.withValues(alpha: 0.7)
                          : const Color(0xFF64748B),
                      fontSize: 10.5,
                    ),
                  ),
                ],
              ],
            ),
          ),
          if (!session.isCurrent)
            TextButton(
              onPressed: busy ? null : onSignOut,
              style: TextButton.styleFrom(
                foregroundColor: isAndroid
                    ? const Color(0xFFFCA5A5)
                    : const Color(0xFFBFDBFE),
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                minimumSize: const Size(0, 0),
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              child: busy
                  ? const SizedBox(
                      width: 12,
                      height: 12,
                      child: CircularProgressIndicator(strokeWidth: 1.5),
                    )
                  : const Text('Sign out', style: TextStyle(fontSize: 11.5)),
            ),
        ],
      ),
    );
  }

  static IconData _iconForPlatform(String platform) {
    return switch (platform.toLowerCase()) {
      'android' => Icons.tablet_android_rounded,
      'windows' => Icons.desktop_windows_rounded,
      'web' => Icons.language_rounded,
      _ => Icons.devices_rounded,
    };
  }

  static String _labelForPlatform(String platform) {
    return switch (platform.toLowerCase()) {
      'android' => 'Android POS',
      'windows' => 'Windows POS',
      'web' => 'Back Office Web',
      _ => 'POS Device',
    };
  }

  static String _relativeTime(DateTime value) {
    final elapsed = DateTime.now().difference(value.toLocal());
    if (elapsed.inMinutes <= 1) {
      return 'just now';
    }
    if (elapsed.inHours < 1) {
      return '${elapsed.inMinutes} min ago';
    }
    if (elapsed.inDays < 1) {
      return '${elapsed.inHours}h ago';
    }
    return '${elapsed.inDays}d ago';
  }
}
