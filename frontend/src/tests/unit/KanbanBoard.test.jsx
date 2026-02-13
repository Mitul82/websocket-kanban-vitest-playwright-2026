import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

// Prevent external integrations from keeping the test process alive.
// Mock socket.io so tests don't attempt network activity.
vi.mock('../../socket', () => ({
  default: {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    connected: false,
  },
}));

// Mock react-dnd so DnD provider doesn't initialize HTML5 backend in JSDOM
vi.mock('react-dnd', () => ({
  DndProvider: ({ children }) => <div>{children}</div>,
  useDrop: () => ([{ isOver: false }, vi.fn()]),
  useDrag: () => ([{ isDragging: false }, vi.fn()]),
}));

// Mock the html5 backend module imported by the app
vi.mock('react-dnd-html5-backend', () => ({
  HTML5Backend: {},
}));

// Mock react-select to a simple select element for deterministic behavior
vi.mock('react-select', () => ({
  default: ({ onChange, options, value }) => (
    <select data-testid="mock-react-select" value={value?.value || ''} onChange={(e) => onChange(options.find(o => o.value === e.target.value))}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  ),
}));

// We'll use a hoist-safe mock factory so Vitest doesn't try to access
// test-scoped variables before they're initialized. The factory returns
// a `__mock` object (listeners/emitCalls) we can import inside tests.
let listeners;
let emitCalls;
vi.mock('../../socket', () => {
  const _listeners = {};
  const _emitCalls = [];
  const mockSocket = {
    connected: true,
    on: (ev, cb) => {
      _listeners[ev] = _listeners[ev] || [];
      _listeners[ev].push(cb);
    },
    off: (ev, cb) => {
      if (!_listeners[ev]) return;
      _listeners[ev] = _listeners[ev].filter((f) => f !== cb);
    },
    emit: (ev, payload, ack) => {
      _emitCalls.push({ ev, payload });
      if (typeof ack === 'function') {
        ack({ status: 'ok', task: { id: 'server-1', ...payload } });
      }
    },
  };
  return { default: mockSocket, __mock: { listeners: _listeners, emitCalls: _emitCalls } };
});

import KanbanBoard from '../../components/KanbanBoard';

describe('KanbanBoard (unit)', () => {
  beforeEach(async () => {
    // import the mocked module to get access to its internal __mock
    const mod = await vi.importMock('../../socket');
    listeners = mod.__mock.listeners;
    emitCalls = mod.__mock.emitCalls;
    // clear listeners and emits
    for (const k of Object.keys(listeners)) delete listeners[k];
    emitCalls.length = 0;
    // ensure a clean localStorage for deterministic rendering
    try { localStorage.removeItem('kanban:tasks'); } catch (e) {}
  });

  it('renders tasks when present in localStorage', async () => {
    // Put tasks into localStorage so the board renders deterministically without needing a socket broadcast
    const sample = [{ id: 't-1', title: 'Hello', description: 'desc', status: 'todo', priority: 'Medium', category: 'Feature', attachments: [] }];
    localStorage.setItem('kanban:tasks', JSON.stringify(sample));

    render(<KanbanBoard />);

    // assert UI rendered the task
    await screen.findByText(/Hello/, {}, { timeout: 2000 });
  });

  it('emits task:create when creating a task while connected', async () => {
    render(<KanbanBoard />);
    const user = userEvent.setup();

    // fill title and click create
    const titleInput = screen.getByTestId('title-input');
    await user.type(titleInput, 'New Task');

    const createButton = screen.getByTestId('create-button');
    await user.click(createButton);

    // emit should have been called with task:create
    await waitFor(() => {
      const found = emitCalls.find((e) => e.ev === 'task:create');
      expect(found).toBeTruthy();
      expect(found.payload.title).toBe('New Task');
    }, { timeout: 2000 });
  });
});
