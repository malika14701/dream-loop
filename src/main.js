import { GameManager } from './GameManager.js';

// Initialize game when DOM is ready
const game = new GameManager();

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  game.destroy();
});
