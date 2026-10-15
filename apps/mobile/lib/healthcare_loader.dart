import 'dart:math' as math;

import 'package:flutter/material.dart';

/// Full-screen clinic loader shown while the app opens the MedERP site.
class HealthcareLoader extends StatefulWidget {
  const HealthcareLoader({super.key});

  @override
  State<HealthcareLoader> createState() => _HealthcareLoaderState();
}

class _HealthcareLoaderState extends State<HealthcareLoader> with SingleTickerProviderStateMixin {
  late final AnimationController _pulse;

  @override
  void initState() {
    super.initState();
    _pulse = AnimationController(vsync: this, duration: const Duration(milliseconds: 1400))..repeat();
  }

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: const Color(0xFFFFF7F7),
      child: Center(
        child: AnimatedBuilder(
          animation: _pulse,
          builder: (context, _) {
            final beat = 0.94 + (0.06 * math.sin(_pulse.value * math.pi * 2));
            return Semantics(
              label: 'Opening MedERP',
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  SizedBox(
                    width: 168,
                    height: 72,
                    child: CustomPaint(painter: _PulsePainter(_pulse.value)),
                  ),
                  const SizedBox(height: 8),
                  Transform.scale(
                    scale: beat,
                    child: Container(
                      width: 72,
                      height: 72,
                      decoration: BoxDecoration(
                        color: const Color(0xFFDC2626),
                        borderRadius: BorderRadius.circular(22),
                        boxShadow: const [
                          BoxShadow(color: Color(0x33DC2626), blurRadius: 18, offset: Offset(0, 8)),
                        ],
                      ),
                      child: const Icon(Icons.monitor_heart, color: Colors.white, size: 36),
                    ),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'MedERP',
                    style: TextStyle(
                      color: Color(0xFF7F1D1D),
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.2,
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

class _PulsePainter extends CustomPainter {
  _PulsePainter(this.t);

  final double t;

  @override
  void paint(Canvas canvas, Size size) {
    final mid = size.height / 2;
    final w = size.width;
    final trace = Path()
      ..moveTo(0, mid)
      ..lineTo(w * 0.28, mid)
      ..lineTo(w * 0.34, mid - 6)
      ..lineTo(w * 0.40, mid + 16)
      ..lineTo(w * 0.48, mid - 26)
      ..lineTo(w * 0.54, mid + 4)
      ..lineTo(w * 0.60, mid)
      ..lineTo(w, mid);

    final stroke = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.5
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    canvas.drawPath(trace, stroke..color = const Color(0xFFFECACA));
    canvas.save();
    canvas.clipRect(Rect.fromLTWH(0, 0, w * t, size.height));
    canvas.drawPath(trace, stroke..color = const Color(0xFFDC2626));
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant _PulsePainter oldDelegate) => oldDelegate.t != t;
}
