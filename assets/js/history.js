document.addEventListener("DOMContentLoaded", () => {
  function cloneState(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function createManager(config) {
    const options = config && typeof config === "object" ? config : {};
    const maxEntries = Number.isFinite(options.maxEntries) ? Math.max(1, Math.floor(options.maxEntries)) : 60;
    const applyState = typeof options.applyState === "function" ? options.applyState : null;
    const emitStateChange = typeof options.onStateChange === "function" ? options.onStateChange : null;

    const undoStack = [];
    const redoStack = [];

    function emit() {
      if (emitStateChange) {
        emitStateChange({ canUndo: undoStack.length > 0, canRedo: redoStack.length > 0 });
      }
    }

    function record(beforeState, afterState) {
      if (!applyState) return false;
      const before = cloneState(beforeState);
      const after = cloneState(afterState);
      if (JSON.stringify(before) === JSON.stringify(after)) return false;

      undoStack.push({ before, after });
      if (undoStack.length > maxEntries) undoStack.shift();
      redoStack.length = 0;
      emit();
      return true;
    }

    function undo() {
      if (!undoStack.length || !applyState) {
        emit();
        return false;
      }

      const entry = undoStack.pop();
      redoStack.push(entry);
      applyState(cloneState(entry.before));
      emit();
      return true;
    }

    function redo() {
      if (!redoStack.length || !applyState) {
        emit();
        return false;
      }

      const entry = redoStack.pop();
      undoStack.push(entry);
      applyState(cloneState(entry.after));
      emit();
      return true;
    }

    function clear() {
      undoStack.length = 0;
      redoStack.length = 0;
      emit();
    }

    function canUndo() {
      return undoStack.length > 0;
    }

    function canRedo() {
      return redoStack.length > 0;
    }

    emit();

    return {
      record,
      undo,
      redo,
      clear,
      canUndo,
      canRedo
    };
  }

  window.scheduleHistory = {
    createManager
  };
});
