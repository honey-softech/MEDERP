import 'package:flutter_test/flutter_test.dart';
import 'package:mederp_mobile/main.dart';

void main() {
  testWidgets('MedERP shell renders', (WidgetTester tester) async {
    await tester.pumpWidget(const MedErpApp());
    await tester.pump();
    expect(find.text('MedERP'), findsWidgets);
    expect(find.text('Patients'), findsOneWidget);
  });
}
