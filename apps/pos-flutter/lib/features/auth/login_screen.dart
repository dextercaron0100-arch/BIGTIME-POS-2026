import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/app_providers.dart';
import '../../core/services/back_office_client.dart';
import '../../core/services/sync_service.dart';
import '../app_flow/app_flow_controller.dart';
import '../pos/pos_drawer_actions.dart';

class _L {
  static const brand = Color(0xFF166534);
  static const brandDark = Color(0xFF14532D);
  static const gradStart = Color(0xFF1F2937);
  static const gradMid = Color(0xFF111827);
  static const gradEnd = Color(0xFF030712);
  static const textPrimary = Color(0xFF1A1A1A);
  static const textSecondary = Color(0xFF666666);
  static const textTertiary = Color(0xFF999999);
  static const bgPage = Color(0xFFE8EDF5);
  static const bgPrimary = Color(0xFFFFFFFF);
  static const border = Color(0x1F000000);
  static const keyBg = Color(0xFF1F2937);
  static const keyPressed = Color(0xFF334155);
  static const keyText = Color(0xFFE8F0FA);
  static const keyMutedPressed = Color(0xFFF1F4F8);
  static const online = Color(0xFF3CB97A);
  static const offline = Color(0xFFE58C2C);
}

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  static const _maxPinLength = 4;

  final _employeeCodeController = TextEditingController();
  final _pinController = TextEditingController();
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _employeeCodeController.addListener(_handleFieldChanged);
    _pinController.addListener(_handleFieldChanged);
  }

  @override
  void dispose() {
    _employeeCodeController.removeListener(_handleFieldChanged);
    _pinController.removeListener(_handleFieldChanged);
    _employeeCodeController.dispose();
    _pinController.dispose();
    super.dispose();
  }

  void _handleFieldChanged() {
    if (mounted) {
      setState(() {});
    }
  }

  void _appendDigit(String digit) {
    if (_pinController.text.length >= _maxPinLength) {
      return;
    }

    _pinController.text = '${_pinController.text}$digit';
    _pinController.selection = TextSelection.collapsed(
      offset: _pinController.text.length,
    );
  }

  void _backspace() {
    final text = _pinController.text;
    if (text.isEmpty) {
      return;
    }

    final nextText = text.substring(0, text.length - 1);
    _pinController.text = nextText;
    _pinController.selection = TextSelection.collapsed(offset: nextText.length);
  }

  Future<void> _submit() async {
    final messenger = ScaffoldMessenger.of(context);
    final employeeCodeRaw = _employeeCodeController.text.trim();
    final pin = _pinController.text.trim();

    if (employeeCodeRaw.isEmpty || pin.length < _maxPinLength) {
      messenger.showSnackBar(
        const SnackBar(content: Text('Enter employee code and PIN.')),
      );
      return;
    }

    if (_isSubmitting) {
      return;
    }

    final employeeCode = employeeCodeRaw.toUpperCase();
    final branchId = branchIdForEmployeeCode(employeeCode);
    final terminal = ref.read(terminalInfoProvider);
    final client = ref.read(backOfficeClientProvider);
    final syncService = ref.read(syncServiceProvider);
    final flowController = ref.read(appFlowControllerProvider.notifier);

    _employeeCodeController.value = _employeeCodeController.value.copyWith(
      text: employeeCode,
      selection: TextSelection.collapsed(offset: employeeCode.length),
    );

    setState(() => _isSubmitting = true);

    try {
      client.clearSession();
      final session = await client.login(
        branchId: branchId,
        terminalId: terminal.id,
        terminalName: terminal.name,
        platform: defaultTargetPlatform == TargetPlatform.windows
            ? 'windows'
            : 'android',
        employeeCode: employeeCode,
        pin: pin,
      );

      if (!mounted) {
        return;
      }

      if (session.pinChangeRequired) {
        final pinUpdated = await _completeRequiredPinChange(
          client: client,
          session: session,
          currentPin: pin,
        );
        if (!pinUpdated) {
          client.clearSession();
          messenger.showSnackBar(
            const SnackBar(
              content: Text(
                'PIN change is required before opening a shift. Sign in again when ready.',
              ),
            ),
          );
          return;
        }
      }

      flowController.signIn(
        cashierId: session.userId,
        employeeCode: session.employeeCode,
        cashierName: session.name,
        branchId: session.branchId,
        terminalId: terminal.id,
        terminalName: terminal.name,
      );
      messenger.showSnackBar(
        SnackBar(content: Text('Signed in as ${session.name}.')),
      );
      unawaited(_runPostLoginSync(syncService, branchId: session.branchId));
    } on BackOfficeException catch (error) {
      if (mounted) {
        messenger.showSnackBar(SnackBar(content: Text(error.message)));
      }
    } catch (error) {
      if (mounted) {
        messenger.showSnackBar(
          SnackBar(content: Text(error.toString().split('\n').first)),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }

  Future<bool> _completeRequiredPinChange({
    required BackOfficeClient client,
    required BackOfficeSession session,
    required String currentPin,
  }) async {
    final result = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => _PinChangeDialog(
        title: session.pinChangeReason == 'RESET'
            ? 'Set a new PIN'
            : 'PIN rotation required',
        message: session.pinChangeReason == 'RESET'
            ? 'Your PIN was reset. Set a new alphanumeric PIN (6–12 characters, at least one letter and one digit) before continuing.'
            : 'For BIR compliance, PINs must be changed every 30 days. Update your PIN before continuing.',
        onSubmit: (newPin) =>
            client.changePin(currentPin: currentPin, newPin: newPin),
      ),
    );

    return result == true;
  }

  Future<void> _runPostLoginSync(
    SyncService syncService, {
    required String branchId,
  }) async {
    var catalogWarning = false;
    var displayWarning = false;
    var paymentWarning = false;

    try {
      await syncService.refreshCatalog(branchId: branchId);
    } catch (_) {
      catalogWarning = true;
    }

    try {
      await syncService.refreshCustomerDisplaySettings(branchId: branchId);
    } catch (_) {
      displayWarning = true;
    }

    try {
      await syncService.refreshPaymentSettings(branchId: branchId);
    } catch (_) {
      paymentWarning = true;
    }

    if (!mounted || (!catalogWarning && !displayWarning && !paymentWarning)) {
      return;
    }

    final warnings = <String>[
      if (catalogWarning) 'catalog',
      if (displayWarning) 'customer display media',
      if (paymentWarning) 'payment settings',
    ];
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          'Signed in. ${warnings.join(' and ')} will retry on the next sync.',
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final keyboardInset = MediaQuery.of(context).viewInsets.bottom;
    final isConnected = ref.watch(onlineStatusProvider).valueOrNull ?? true;

    return Scaffold(
      backgroundColor: _L.bgPage,
      resizeToAvoidBottomInset: false,
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            final compact = constraints.maxWidth < 640;
            final wide = constraints.maxWidth >= 980;
            final outerPadding = compact ? 12.0 : 20.0;
            final cardMaxWidth = wide ? 1180.0 : 760.0;
            final wideCardHeight = (constraints.maxHeight - (outerPadding * 2))
                .clamp(720.0, 860.0);

            return SingleChildScrollView(
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              padding: EdgeInsets.fromLTRB(
                outerPadding,
                outerPadding,
                outerPadding,
                outerPadding + keyboardInset,
              ),
              child: Center(
                child: ConstrainedBox(
                  constraints: BoxConstraints(maxWidth: cardMaxWidth),
                  child: Container(
                    height: wide ? wideCardHeight : null,
                    decoration: BoxDecoration(
                      color: _L.bgPrimary,
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(color: _L.border),
                      boxShadow: const [
                        BoxShadow(
                          color: Color(0x1F000000),
                          blurRadius: 40,
                          offset: Offset(0, 8),
                        ),
                      ],
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: Flex(
                      direction: wide ? Axis.horizontal : Axis.vertical,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        if (wide)
                          const Expanded(
                            flex: 38,
                            child: _BrandPanel(compact: false, stacked: false),
                          )
                        else
                          SizedBox(
                            height: compact ? 240 : 280,
                            child: _BrandPanel(compact: compact, stacked: true),
                          ),
                        if (wide)
                          Expanded(
                            flex: 62,
                            child: _LoginPane(
                              employeeCodeController: _employeeCodeController,
                              pinController: _pinController,
                              isSubmitting: _isSubmitting,
                              isConnected: isConnected,
                              compact: compact,
                              useWideLayout: true,
                              onLogin: _submit,
                              onDigit: _appendDigit,
                              onDelete: _backspace,
                            ),
                          )
                        else
                          _LoginPane(
                            employeeCodeController: _employeeCodeController,
                            pinController: _pinController,
                            isSubmitting: _isSubmitting,
                            isConnected: isConnected,
                            compact: compact,
                            useWideLayout: false,
                            onLogin: _submit,
                            onDigit: _appendDigit,
                            onDelete: _backspace,
                          ),
                      ],
                    ),
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}

class _PinChangeDialog extends StatefulWidget {
  const _PinChangeDialog({
    required this.title,
    required this.message,
    required this.onSubmit,
  });

  final String title;
  final String message;
  final Future<BackOfficePinChangeResult> Function(String newPin) onSubmit;

  @override
  State<_PinChangeDialog> createState() => _PinChangeDialogState();
}

class _PinChangeDialogState extends State<_PinChangeDialog> {
  final _newPinController = TextEditingController();
  final _confirmPinController = TextEditingController();
  String? _errorText;
  bool _isSubmitting = false;

  @override
  void dispose() {
    _newPinController.dispose();
    _confirmPinController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final newPin = _newPinController.text.trim();
    final confirmPin = _confirmPinController.text.trim();
    if (!RegExp(
      r'^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z0-9]{6,12}$',
    ).hasMatch(newPin)) {
      setState(
        () => _errorText =
            'New PIN must be 6–12 characters, with at least one letter and one digit.',
      );
      return;
    }
    if (newPin != confirmPin) {
      setState(() => _errorText = 'New PIN entries do not match.');
      return;
    }

    setState(() {
      _errorText = null;
      _isSubmitting = true;
    });

    try {
      final result = await widget.onSubmit(newPin);
      if (!mounted) {
        return;
      }
      Navigator.of(context).pop(true);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(result.message)));
    } on BackOfficeException catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _errorText = error.message;
        _isSubmitting = false;
      });
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _errorText = error.toString().split('\n').first;
        _isSubmitting = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: Colors.white,
      title: Text(widget.title),
      content: SizedBox(
        width: 360,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(widget.message),
            const SizedBox(height: 16),
            TextField(
              controller: _newPinController,
              keyboardType: TextInputType.visiblePassword,
              obscureText: true,
              maxLength: 12,
              decoration: const InputDecoration(
                labelText: 'New PIN',
                counterText: '',
                hintText: 'Letters + digits, 6–12 chars',
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _confirmPinController,
              keyboardType: TextInputType.visiblePassword,
              obscureText: true,
              maxLength: 12,
              decoration: const InputDecoration(
                labelText: 'Confirm new PIN',
                counterText: '',
              ),
            ),
            if (_errorText != null) ...[
              const SizedBox(height: 12),
              Text(
                _errorText!,
                style: const TextStyle(color: Color(0xFFB42318), fontSize: 12),
              ),
            ],
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: _isSubmitting
              ? null
              : () => Navigator.of(context).pop(false),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: _isSubmitting ? null : _submit,
          child: Text(_isSubmitting ? 'Updating...' : 'Update PIN'),
        ),
      ],
    );
  }
}

class _BrandPanel extends StatelessWidget {
  const _BrandPanel({required this.compact, required this.stacked});

  final bool compact;
  final bool stacked;

  @override
  Widget build(BuildContext context) {
    final headlineSize = compact ? 30.0 : 36.0;
    final bodySize = compact ? 12.0 : 13.0;
    final panelPadding = compact ? 24.0 : 36.0;

    return Container(
      padding: EdgeInsets.all(panelPadding),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment(-0.6, -1),
          end: Alignment(0.6, 1),
          colors: [_L.gradStart, _L.gradMid, _L.gradEnd],
        ),
      ),
      child: Stack(
        children: [
          Positioned(
            top: -60,
            right: -60,
            child: Container(
              width: 220,
              height: 220,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: Color(0x0FFFFFFF),
              ),
            ),
          ),
          Positioned(
            bottom: -40,
            left: -40,
            child: Container(
              width: 180,
              height: 180,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: Color(0x0AFFFFFF),
              ),
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: const Color(0x2EFFFFFF),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(
                      Icons.point_of_sale_rounded,
                      color: Colors.white,
                      size: 20,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Text(
                    'BIGTIME POS',
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.7),
                      fontSize: 11,
                      letterSpacing: 2,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                posAppVersionLabel,
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.45),
                  fontSize: 10,
                  letterSpacing: 1.5,
                ),
              ),
              const Spacer(),
              Text(
                stacked ? 'Your store, always on.' : 'Your store,\nalways on.',
                style: TextStyle(
                  fontSize: headlineSize,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                  height: 1.15,
                  letterSpacing: -0.5,
                ),
              ),
              const SizedBox(height: 16),
              Text(
                'Windows and Android terminal shell with offline queueing, local Drift storage, and BIR-aware transaction flow.',
                style: TextStyle(
                  fontSize: bodySize,
                  color: Colors.white.withValues(alpha: 0.65),
                  height: 1.65,
                ),
              ),
              const SizedBox(height: 18),
              for (final text in const [
                'Offline-capable queue',
                'Local Drift storage',
                'BIR-compliant receipts',
              ])
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Row(
                    children: [
                      Container(
                        width: 6,
                        height: 6,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: Colors.white.withValues(alpha: 0.4),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        text,
                        style: TextStyle(
                          fontSize: 11,
                          color: Colors.white.withValues(alpha: 0.7),
                        ),
                      ),
                    ],
                  ),
                ),
              const Spacer(),
            ],
          ),
        ],
      ),
    );
  }
}

class _LoginPane extends StatelessWidget {
  const _LoginPane({
    required this.employeeCodeController,
    required this.pinController,
    required this.isSubmitting,
    required this.isConnected,
    required this.compact,
    required this.useWideLayout,
    required this.onLogin,
    required this.onDigit,
    required this.onDelete,
  });

  final TextEditingController employeeCodeController;
  final TextEditingController pinController;
  final bool isSubmitting;
  final bool isConnected;
  final bool compact;
  final bool useWideLayout;
  final VoidCallback onLogin;
  final ValueChanged<String> onDigit;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final headerFontSize = compact ? 22.0 : 24.0;
    final bodyPadding = compact ? 20.0 : 32.0;
    final statusColor = isConnected ? _L.online : _L.offline;

    return Padding(
      padding: EdgeInsets.fromLTRB(bodyPadding, bodyPadding, bodyPadding, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: useWideLayout ? MainAxisSize.max : MainAxisSize.min,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Cashier Login',
                      style: TextStyle(
                        fontSize: headerFontSize,
                        fontWeight: FontWeight.w700,
                        color: _L.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Enter your employee code and PIN to continue.',
                      style: TextStyle(fontSize: 12, color: _L.textTertiary),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      apiBaseUrlLabel,
                      style: const TextStyle(
                        fontSize: 11,
                        color: _L.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 7,
                ),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 7,
                      height: 7,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: statusColor,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      isConnected ? 'Network Ready' : 'Offline Mode',
                      style: TextStyle(
                        fontSize: 11,
                        color: statusColor,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          _FloatingLabelField(
            label: 'EMPLOYEE CODE',
            child: TextField(
              controller: employeeCodeController,
              textCapitalization: TextCapitalization.characters,
              textInputAction: TextInputAction.done,
              style: const TextStyle(fontSize: 14, color: _L.textPrimary),
              decoration: InputDecoration(
                isDense: true,
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 12,
                ),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: _L.border, width: 1.5),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: _L.border, width: 1.5),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: _L.brand, width: 1.5),
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),
          _PinDotsRow(
            pin: pinController.text,
            maxLength: _LoginScreenState._maxPinLength,
          ),
          const SizedBox(height: 16),
          SizedBox(
            height: 320,
            child: _NumpadColumn(
              isSubmitting: isSubmitting,
              pinLength: pinController.text.length,
              loginLabel: isConnected ? 'Login' : 'Offline',
              onDigit: onDigit,
              onDelete: onDelete,
              onLogin: onLogin,
            ),
          ),
          if (useWideLayout) const Spacer(),
          Padding(
            padding: const EdgeInsets.only(top: 16),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.only(top: 14),
              decoration: const BoxDecoration(
                border: Border(top: BorderSide(color: _L.border, width: 0.5)),
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    'Powered by ',
                    style: TextStyle(fontSize: 10.5, color: _L.textTertiary),
                  ),
                  Text(
                    'Herrera Technologies',
                    style: TextStyle(
                      fontSize: 10.5,
                      color: _L.textSecondary,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _FloatingLabelField extends StatelessWidget {
  const _FloatingLabelField({required this.label, required this.child});

  final String label;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        child,
        Positioned(
          top: -9,
          left: 12,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            color: _L.bgPrimary,
            child: Text(
              label,
              style: const TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w500,
                letterSpacing: 0.5,
                color: _L.textSecondary,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _PinDotsRow extends StatelessWidget {
  const _PinDotsRow({required this.pin, required this.maxLength});

  final String pin;
  final int maxLength;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 44,
      padding: const EdgeInsets.symmetric(horizontal: 14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: pin.isNotEmpty ? _L.brand : _L.border,
          width: 1.5,
        ),
      ),
      child: Row(
        children: List.generate(maxLength, (index) {
          final filled = index < pin.length;
          return Padding(
            padding: const EdgeInsets.only(right: 10),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 150),
              width: 10,
              height: 10,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: filled ? _L.brand : _L.border,
              ),
            ),
          );
        }),
      ),
    );
  }
}

class _NumpadColumn extends StatelessWidget {
  const _NumpadColumn({
    required this.isSubmitting,
    required this.pinLength,
    required this.loginLabel,
    required this.onDigit,
    required this.onDelete,
    required this.onLogin,
  });

  final bool isSubmitting;
  final int pinLength;
  final String loginLabel;
  final ValueChanged<String> onDigit;
  final VoidCallback onDelete;
  final VoidCallback onLogin;

  @override
  Widget build(BuildContext context) {
    Widget key(String digit) => Expanded(
      child: _NumKey(
        label: digit,
        onTap: isSubmitting ? null : () => onDigit(digit),
      ),
    );

    return Column(
      children: [
        for (final row in const [
          ['1', '2', '3'],
          ['4', '5', '6'],
          ['7', '8', '9'],
        ])
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                children: [
                  key(row[0]),
                  const SizedBox(width: 8),
                  key(row[1]),
                  const SizedBox(width: 8),
                  key(row[2]),
                ],
              ),
            ),
          ),
        Expanded(
          child: Row(
            children: [
              Expanded(
                child: _NumKey(
                  label: 'Del',
                  isDel: true,
                  onTap: isSubmitting ? null : onDelete,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _NumKey(
                  label: '0',
                  onTap: isSubmitting ? null : () => onDigit('0'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _NumKey(
                  label: isSubmitting ? '...' : loginLabel,
                  isLogin: true,
                  ready: pinLength >= _LoginScreenState._maxPinLength,
                  onTap: isSubmitting ? null : onLogin,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _NumKey extends StatefulWidget {
  const _NumKey({
    required this.label,
    this.onTap,
    this.isDel = false,
    this.isLogin = false,
    this.ready = false,
  });

  final String label;
  final VoidCallback? onTap;
  final bool isDel;
  final bool isLogin;
  final bool ready;

  @override
  State<_NumKey> createState() => _NumKeyState();
}

class _NumKeyState extends State<_NumKey> {
  bool _pressed = false;

  void _setPressed(bool value) {
    if (_pressed == value || widget.onTap == null) {
      return;
    }
    setState(() => _pressed = value);
  }

  @override
  Widget build(BuildContext context) {
    final Color background;
    final Color foreground;
    final Border? border;
    final Color pressedBackground;

    if (widget.isDel) {
      background = Colors.transparent;
      foreground = _L.textSecondary;
      border = Border.all(color: _L.border, width: 1.5);
      pressedBackground = _L.keyMutedPressed;
    } else if (widget.isLogin) {
      background = _L.brand;
      foreground = Colors.white;
      border = widget.ready
          ? Border.all(color: _L.brand.withValues(alpha: 0.25), width: 3)
          : null;
      pressedBackground = _L.brandDark;
    } else {
      background = _L.keyBg;
      foreground = _L.keyText;
      border = null;
      pressedBackground = _L.keyPressed;
    }

    return AnimatedScale(
      duration: const Duration(milliseconds: 110),
      curve: Curves.easeOutCubic,
      scale: _pressed ? 0.975 : 1,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 110),
        curve: Curves.easeOutCubic,
        decoration: BoxDecoration(
          color: _pressed ? pressedBackground : background,
          borderRadius: BorderRadius.circular(12),
          border: border,
          boxShadow: widget.isDel
              ? null
              : [
                  BoxShadow(
                    color: const Color(0x14000000),
                    blurRadius: _pressed ? 6 : 14,
                    offset: Offset(0, _pressed ? 2 : 5),
                  ),
                ],
        ),
        child: Material(
          color: Colors.transparent,
          borderRadius: BorderRadius.circular(12),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            borderRadius: BorderRadius.circular(12),
            onTap: widget.onTap,
            onTapDown: (_) => _setPressed(true),
            onTapUp: (_) => _setPressed(false),
            onTapCancel: () => _setPressed(false),
            splashFactory: NoSplash.splashFactory,
            highlightColor: Colors.transparent,
            splashColor: Colors.transparent,
            hoverColor: Colors.transparent,
            focusColor: Colors.transparent,
            child: Center(
              child: Text(
                widget.label,
                style: TextStyle(
                  fontSize: widget.isDel || widget.isLogin ? 13 : 18,
                  fontWeight: FontWeight.w500,
                  color: foreground,
                  letterSpacing: widget.isDel || widget.isLogin ? 0.5 : 0,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
