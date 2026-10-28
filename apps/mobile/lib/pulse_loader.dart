import 'package:flutter/material.dart';

/// Three pulsing dots — the same loading signal the web app uses, so the
/// installed app and the site never show two different spinners.
class PulseDots extends StatefulWidget {
  const PulseDots({super.key, this.size = 10, this.color = const Color(0xFF1976D2)});

  final double size;
  final Color color;

  @override
  State<PulseDots> createState() => _PulseDotsState();
}

class _PulseDotsState extends State<PulseDots> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1100),
  )..repeat();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        return Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (var index = 0; index < 3; index++) ...[
              if (index > 0) SizedBox(width: widget.size * 0.6),
              _dot(index),
            ],
          ],
        );
      },
    );
  }

  Widget _dot(int index) {
    // Each dot trails the one before it by ~15% of the cycle.
    final phase = (_controller.value - index * 0.15) % 1.0;
    final wave = (1 - (phase * 2 - 1).abs()).clamp(0.0, 1.0);
    final scale = 0.72 + 0.28 * wave;
    return Opacity(
      opacity: 0.25 + 0.75 * wave,
      child: Container(
        height: widget.size * scale,
        width: widget.size * scale,
        decoration: BoxDecoration(color: widget.color, shape: BoxShape.circle),
      ),
    );
  }
}

/// Full-screen loading state shown until the site paints for the first time.
class PulseScreen extends StatelessWidget {
  const PulseScreen({super.key, this.label = 'Loading'});

  final String label;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: Colors.white,
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const PulseDots(size: 12),
            const SizedBox(height: 16),
            Text(
              '$label…',
              style: const TextStyle(fontSize: 14, color: Color(0xFF616161)),
            ),
          ],
        ),
      ),
    );
  }
}
