const SAVE_KEY = 'dream-loop-save';

export class SaveSystem {
  static save(data) {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      return true;
    } catch { return false; }
  }

  static load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  static clear() {
    localStorage.removeItem(SAVE_KEY);
  }
}
