import 'package:flutter/material.dart';
import 'package:mederp_mobile/api/api_client.dart';
import 'package:mederp_mobile/realtime/socket_service.dart';
import 'package:mederp_mobile/session.dart';

void main() {
  runApp(const MedErpApp());
}

class MedErpApp extends StatefulWidget {
  const MedErpApp({super.key});

  @override
  State<MedErpApp> createState() => _MedErpAppState();
}

class _MedErpAppState extends State<MedErpApp> {
  final NotificationFeed feed = NotificationFeed();

  @override
  void dispose() {
    feed.dispose();
    super.dispose();
  }

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
      home: SessionStore.isSignedIn ? HomeShell(feed: feed) : LoginPage(feed: feed),
    );
  }
}

class LoginPage extends StatefulWidget {
  const LoginPage({super.key, required this.feed});

  final NotificationFeed feed;

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _identifier = TextEditingController();
  final _password = TextEditingController();
  String? _error;
  bool _pending = false;

  @override
  void dispose() {
    _identifier.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _error = null;
      _pending = true;
    });
    try {
      final data = await ApiClient().login(
        identifier: _identifier.text.trim(),
        password: _password.text,
      );
      if (data['ok'] != true || data['sessionToken'] == null) {
        setState(() {
          _error = data['error'] as String? ?? 'Sign in failed.';
          _pending = false;
        });
        return;
      }
      SessionStore.save(
        token: data['sessionToken'] as String,
        username: data['username'] as String? ?? _identifier.text.trim(),
        role: data['role'] as String? ?? '',
      );
      await widget.feed.start();
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => HomeShell(feed: widget.feed)),
      );
    } catch (_) {
      setState(() {
        _error = 'Could not reach the MedERP API. Start the web app on port 3000.';
        _pending = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            const SizedBox(height: 32),
            Text('MedERP', style: Theme.of(context).textTheme.headlineMedium),
            const SizedBox(height: 8),
            const Text('Sign in to get live hospital notifications on this device.'),
            const SizedBox(height: 24),
            TextField(
              controller: _identifier,
              decoration: const InputDecoration(labelText: 'Username or mobile'),
              textInputAction: TextInputAction.next,
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _password,
              decoration: const InputDecoration(labelText: 'Password'),
              obscureText: true,
              onSubmitted: (_) => _submit(),
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!, style: const TextStyle(color: Colors.red)),
            ],
            const SizedBox(height: 20),
            FilledButton(
              onPressed: _pending ? null : _submit,
              child: Text(_pending ? 'Signing in…' : 'Sign in'),
            ),
          ],
        ),
      ),
    );
  }
}

class HomeShell extends StatefulWidget {
  const HomeShell({super.key, required this.feed});

  final NotificationFeed feed;

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final pages = [
      DashboardPage(feed: widget.feed),
      const PatientsPage(),
      const AppointmentsPage(),
    ];

    return ListenableBuilder(
      listenable: widget.feed,
      builder: (context, _) {
        final latest = widget.feed.latest;
        if (latest != null) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (!mounted || widget.feed.latest == null) return;
            final notice = widget.feed.latest!;
            widget.feed.clearLatest();
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('${notice.title}\n${notice.body}')),
            );
          });
        }

        return Scaffold(
          appBar: AppBar(
            title: const Text('MedERP'),
            actions: [
              IconButton(
                tooltip: widget.feed.connected ? 'Live notifications' : 'Connecting…',
                onPressed: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => NotificationsPage(feed: widget.feed)),
                  );
                },
                icon: Badge(
                  isLabelVisible: widget.feed.unreadCount > 0,
                  label: Text(widget.feed.unreadCount > 9 ? '9+' : '${widget.feed.unreadCount}'),
                  child: Icon(
                    widget.feed.connected ? Icons.notifications : Icons.notifications_none,
                  ),
                ),
              ),
            ],
          ),
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
      },
    );
  }
}

class NotificationsPage extends StatelessWidget {
  const NotificationsPage({super.key, required this.feed});

  final NotificationFeed feed;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          TextButton(
            onPressed: feed.unreadCount == 0 ? null : feed.markAllRead,
            child: const Text('Mark all read'),
          ),
        ],
      ),
      body: ListenableBuilder(
        listenable: feed,
        builder: (context, _) {
          if (feed.items.isEmpty) {
            return const Center(child: Text('No notifications yet.'));
          }
          return ListView.separated(
            itemCount: feed.items.length,
            separatorBuilder: (_, _) => const Divider(height: 1),
            itemBuilder: (context, index) {
              final item = feed.items[index];
              return ListTile(
    tileColor: item.isRead ? null : const Color(0xFFE6FFFA),
                title: Text(item.title),
                subtitle: Text(item.body),
                onTap: item.isRead ? null : () => feed.markRead(item.id),
              );
            },
          );
        },
      ),
    );
  }
}

class DashboardPage extends StatefulWidget {
  const DashboardPage({super.key, required this.feed});

  final NotificationFeed feed;

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
            ? 'Live notifications ${widget.feed.connected ? 'connected' : 'connecting'} · ${SessionStore.username ?? ''}'
            : 'API reachable, database down';
      });
    } catch (_) {
      setState(() {
        _status = 'Start the Next.js app on port 3000 to connect.';
      });
    }
  }

  Future<void> _signOut() async {
    await widget.feed.stop();
    await ApiClient().logout();
    SessionStore.clear();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => LoginPage(feed: widget.feed)),
      (_) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    const cards = [
      ('Patients today', '42'),
      ('Appointments', '18'),
      ('Occupied beds', '27 / 40'),
      ('Lab pending', '9'),
    ];

    return ListenableBuilder(
      listenable: widget.feed,
      builder: (context, _) {
        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(
              widget.feed.connected
                  ? 'Live notifications on · ${SessionStore.username ?? ''} · ${SessionStore.role ?? ''}'
                  : _status,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 12),
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton(onPressed: _signOut, child: const Text('Sign out')),
            ),
            const SizedBox(height: 8),
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
      },
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
