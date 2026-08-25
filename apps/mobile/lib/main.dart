import 'package:flutter/material.dart';
import 'package:mederp_mobile/api/api_client.dart';

void main() {
  runApp(const MedErpApp());
}

class MedErpApp extends StatelessWidget {
  const MedErpApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'MedERP',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF0F766E),
          brightness: Brightness.light,
        ),
        useMaterial3: true,
      ),
      home: const HomeShell(),
    );
  }
}

class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final pages = [
      const DashboardPage(),
      const PatientsPage(),
      const AppointmentsPage(),
    ];

    return Scaffold(
      appBar: AppBar(title: const Text('MedERP')),
      body: pages[_index],
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (value) => setState(() => _index = value),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.dashboard_outlined),
            selectedIcon: Icon(Icons.dashboard),
            label: 'Home',
          ),
          NavigationDestination(
            icon: Icon(Icons.people_outline),
            selectedIcon: Icon(Icons.people),
            label: 'Patients',
          ),
          NavigationDestination(
            icon: Icon(Icons.event_outlined),
            selectedIcon: Icon(Icons.event),
            label: 'Appointments',
          ),
        ],
      ),
    );
  }
}

class DashboardPage extends StatefulWidget {
  const DashboardPage({super.key});

  @override
  State<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends State<DashboardPage> {
  String _status = 'Checking API…';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final health = await ApiClient().health();
      setState(() {
        _status = health['ok'] == true
            ? 'API connected · database ${health['database']}'
            : 'API reachable, database down';
      });
    } catch (_) {
      setState(() {
        _status = 'Start the Next.js app on port 3000 to connect.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    const cards = [
      ('Patients today', '42'),
      ('Appointments', '18'),
      ('Occupied beds', '27 / 40'),
      ('Lab pending', '9'),
    ];

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(_status, style: Theme.of(context).textTheme.bodyMedium),
        const SizedBox(height: 16),
        Wrap(
          spacing: 12,
          runSpacing: 12,
          children: [
            for (final card in cards)
              SizedBox(
                width: 160,
                child: Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(card.$1, style: Theme.of(context).textTheme.labelMedium),
                        const SizedBox(height: 8),
                        Text(
                          card.$2,
                          style: Theme.of(context).textTheme.headlineSmall,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
          ],
        ),
      ],
    );
  }
}

class PatientsPage extends StatelessWidget {
  const PatientsPage({super.key});

  @override
  Widget build(BuildContext context) {
    const patients = [
      ('MRN-1001', 'Rahul Sharma', 'B+'),
      ('MRN-1002', 'Fatima Khan', 'O+'),
      ('MRN-1003', 'Arjun Patel', 'A+'),
    ];

    return ListView.separated(
      itemCount: patients.length,
      separatorBuilder: (_, _) => const Divider(height: 1),
      itemBuilder: (context, index) {
        final patient = patients[index];
        return ListTile(
          leading: CircleAvatar(child: Text(patient.$2[0])),
          title: Text(patient.$2),
          subtitle: Text(patient.$1),
          trailing: Text(patient.$3),
        );
      },
    );
  }
}

class AppointmentsPage extends StatelessWidget {
  const AppointmentsPage({super.key});

  @override
  Widget build(BuildContext context) {
    const rows = [
      ('09:00', 'Rahul Sharma', 'Cardiology'),
      ('09:20', 'Fatima Khan', 'General Medicine'),
      ('11:00', 'Arjun Patel', 'Cardiology'),
    ];

    return ListView.separated(
      itemCount: rows.length,
      separatorBuilder: (_, _) => const Divider(height: 1),
      itemBuilder: (context, index) {
        final row = rows[index];
        return ListTile(
          leading: Text(row.$1),
          title: Text(row.$2),
          subtitle: Text(row.$3),
        );
      },
    );
  }
}
