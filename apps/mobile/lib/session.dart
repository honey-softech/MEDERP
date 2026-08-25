class SessionStore {
  static String? token;
  static String? username;
  static String? role;

  static bool get isSignedIn => token != null && token!.isNotEmpty;

  static void save({required String token, required String username, required String role}) {
    SessionStore.token = token;
    SessionStore.username = username;
    SessionStore.role = role;
  }

  static void clear() {
    token = null;
    username = null;
    role = null;
  }
}
