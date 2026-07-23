import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:scroll_animator/scroll_animator.dart';
import 'core/providers/app_providers.dart';
import 'features/app_flow/app_flow_view.dart';
import 'features/customer_display/customer_display_sync.dart';
import 'features/pos/pos_drawer_actions.dart';

class PosApp extends ConsumerWidget {
  const PosApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bootstrap = ref.watch(databaseBootstrapProvider);
    final isWindows = Platform.isWindows;
    final isAndroid = Platform.isAndroid;
    final useReducedMotion = isWindows || isAndroid;
    final baseTextTheme = Typography.material2021(
      platform: defaultTargetPlatform,
    ).black;
    final lightTextTheme = baseTextTheme.copyWith(
      displayLarge: baseTextTheme.displayLarge?.copyWith(
        fontWeight: FontWeight.w300,
      ),
      displayMedium: baseTextTheme.displayMedium?.copyWith(
        fontWeight: FontWeight.w300,
      ),
      displaySmall: baseTextTheme.displaySmall?.copyWith(
        fontWeight: FontWeight.w300,
      ),
      headlineLarge: baseTextTheme.headlineLarge?.copyWith(
        fontWeight: FontWeight.w300,
      ),
      headlineMedium: baseTextTheme.headlineMedium?.copyWith(
        fontWeight: FontWeight.w300,
      ),
      headlineSmall: baseTextTheme.headlineSmall?.copyWith(
        fontWeight: FontWeight.w300,
      ),
      titleLarge: baseTextTheme.titleLarge?.copyWith(
        fontWeight: FontWeight.w400,
      ),
      titleMedium: baseTextTheme.titleMedium?.copyWith(
        fontWeight: FontWeight.w300,
      ),
      titleSmall: baseTextTheme.titleSmall?.copyWith(
        fontWeight: FontWeight.w300,
      ),
      bodyLarge: baseTextTheme.bodyLarge?.copyWith(fontWeight: FontWeight.w300),
      bodyMedium: baseTextTheme.bodyMedium?.copyWith(
        fontWeight: FontWeight.w300,
      ),
      bodySmall: baseTextTheme.bodySmall?.copyWith(fontWeight: FontWeight.w300),
      labelLarge: baseTextTheme.labelLarge?.copyWith(
        fontWeight: FontWeight.w300,
      ),
      labelMedium: baseTextTheme.labelMedium?.copyWith(
        fontWeight: FontWeight.w300,
      ),
      labelSmall: baseTextTheme.labelSmall?.copyWith(
        fontWeight: FontWeight.w300,
      ),
    );

    return MaterialApp(
      title: 'BIGTIME POS',
      debugShowCheckedModeBanner: false,
      themeAnimationDuration: useReducedMotion
          ? Duration.zero
          : kThemeAnimationDuration,
      actions: {
        ...WidgetsApp.defaultActions,
        if (isWindows) ScrollIntent: AnimatedScrollAction(),
      },
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF1A2E4A)),
        scaffoldBackgroundColor: const Color(0xFFF3F6FB),
        useMaterial3: !isWindows,
        textTheme: lightTextTheme,
        primaryTextTheme: lightTextTheme,
        visualDensity: isWindows
            ? VisualDensity.compact
            : VisualDensity.standard,
        splashFactory: useReducedMotion
            ? InkRipple.splashFactory
            : InkSparkle.splashFactory,
        pageTransitionsTheme: PageTransitionsTheme(
          builders: {
            for (final platform in TargetPlatform.values)
              platform: useReducedMotion
                  ? const _NoTransitionsBuilder()
                  : const FadeUpwardsPageTransitionsBuilder(),
          },
        ),
        cardTheme: const CardThemeData(
          color: Colors.white,
          elevation: 0,
          margin: EdgeInsets.zero,
        ),
        appBarTheme: AppBarTheme(
          titleTextStyle: lightTextTheme.titleLarge?.copyWith(
            color: const Color(0xFF1A2E4A),
            fontWeight: FontWeight.w300,
          ),
        ),
        filledButtonTheme: FilledButtonThemeData(
          style: ButtonStyle(
            animationDuration: useReducedMotion ? Duration.zero : null,
            splashFactory: isWindows ? NoSplash.splashFactory : null,
            tapTargetSize: isWindows
                ? MaterialTapTargetSize.shrinkWrap
                : MaterialTapTargetSize.padded,
          ),
        ),
        outlinedButtonTheme: OutlinedButtonThemeData(
          style: ButtonStyle(
            animationDuration: useReducedMotion ? Duration.zero : null,
            splashFactory: isWindows ? NoSplash.splashFactory : null,
            tapTargetSize: isWindows
                ? MaterialTapTargetSize.shrinkWrap
                : MaterialTapTargetSize.padded,
          ),
        ),
        textButtonTheme: TextButtonThemeData(
          style: ButtonStyle(
            animationDuration: useReducedMotion ? Duration.zero : null,
            splashFactory: isWindows ? NoSplash.splashFactory : null,
            tapTargetSize: isWindows
                ? MaterialTapTargetSize.shrinkWrap
                : MaterialTapTargetSize.padded,
          ),
        ),
        inputDecorationTheme: const InputDecorationTheme(
          isDense: true,
          border: OutlineInputBorder(),
        ),
      ),
      home: bootstrap.when(
        data: (_) => const CustomerDisplaySyncHost(child: AppFlowView()),
        loading: () => const _BootstrapSplash(),
        error: (error, _) => _BootstrapError(message: error.toString()),
      ),
    );
  }
}

class _NoTransitionsBuilder extends PageTransitionsBuilder {
  const _NoTransitionsBuilder();

  @override
  Widget buildTransitions<T>(
    PageRoute<T> route,
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) {
    return child;
  }
}

class _BootstrapSplash extends StatelessWidget {
  const _BootstrapSplash();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0C1E36),
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.point_of_sale_rounded,
              color: Colors.white54,
              size: 48,
            ),
            const SizedBox(height: 16),
            const Text(
              'BIGTIME POS',
              style: TextStyle(
                color: Colors.white,
                fontSize: 22,
                fontWeight: FontWeight.w700,
                letterSpacing: 2,
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              posAppVersionLabel,
              style: TextStyle(
                color: Colors.white38,
                fontSize: 12,
                letterSpacing: 1.5,
              ),
            ),
            const SizedBox(height: 32),
            const CircularProgressIndicator(color: Colors.white54),
          ],
        ),
      ),
    );
  }
}

class _BootstrapError extends StatelessWidget {
  const _BootstrapError({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            'BIGTIME POS failed to initialize.\n$message',
            textAlign: TextAlign.center,
          ),
        ),
      ),
    );
  }
}
