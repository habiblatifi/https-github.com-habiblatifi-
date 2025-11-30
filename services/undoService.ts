import { UndoAction } from '../types';

class UndoService {
  private actions: UndoAction[] = [];
  private maxActions = 10;

  /**
   * Add an undoable action
   */
  addAction(action: UndoAction): void {
    this.actions.unshift(action);
    if (this.actions.length > this.maxActions) {
      this.actions = this.actions.slice(0, this.maxActions);
    }
  }

  /**
   * Get the most recent undoable action
   */
  getLastAction(): UndoAction | null {
    return this.actions.length > 0 ? this.actions[0] : null;
  }

  /**
   * Execute undo for the last action
   */
  undo(): UndoAction | null {
    const action = this.actions.shift();
    if (action) {
      action.undo();
      return action;
    }
    return null;
  }

  /**
   * Clear all undo actions
   */
  clear(): void {
    this.actions = [];
  }

  /**
   * Check if there are any undoable actions
   */
  hasActions(): boolean {
    return this.actions.length > 0;
  }

  /**
   * Get action description for display
   */
  getActionDescription(action: UndoAction): string {
    switch (action.type) {
      case 'dose_taken':
        return 'Mark dose as taken';
      case 'dose_skipped':
        return 'Skip dose';
      case 'medication_added':
        return 'Add medication';
      case 'medication_deleted':
        return 'Delete medication';
      case 'medication_edited':
        return 'Edit medication';
      default:
        return 'Undo action';
    }
  }
}

export const undoService = new UndoService();

