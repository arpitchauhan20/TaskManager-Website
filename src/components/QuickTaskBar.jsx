import React, { useState } from 'react';

export default function QuickTaskBar({ onQuickAdd, onOpenDetailedModal }) {
  const [text, setText] = useState('');

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      const trimmed = text.trim();
      if (!trimmed) return;
      onQuickAdd(trimmed);
      setText('');
    }
  };

  return (
    <section className="quick-task-bar">
      <span className="quick-plus-icon">+</span>
      <input
        type="text"
        id="quick-task-input"
        placeholder="Quick add task... (e.g. Call client tomorrow at 3pm, then press Enter)"
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        autoComplete="off"
      />
      <button
        type="button"
        className="btn btn-sm btn-secondary"
        onClick={onOpenDetailedModal}
        title="Open Detailed Task Creator"
      >
        <span>Detailed Options</span>
        <kbd className="kbd-micro">N</kbd>
      </button>
    </section>
  );
}
