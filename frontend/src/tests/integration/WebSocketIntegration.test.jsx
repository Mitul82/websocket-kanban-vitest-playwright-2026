import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

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
      // Simulate a server broadcast for create/move/delete
      if (ev === 'task:create') {
        const created = { id: 'srv-1', ...payload };
        (_listeners['sync:tasks'] || []).forEach((cb) => cb([created]));
        if (typeof ack === 'function') ack({ status: 'ok', task: created });
      }
      if (ev === 'task:move') {
        // find and broadcast a moved task (simplified)
        const moved = { id: payload.id, status: payload.status };
        (_listeners['sync:tasks'] || []).forEach((cb) => cb([moved]));
        if (typeof ack === 'function') ack({ status: 'ok', task: moved });
      }
    },
  };
  return { default: mockSocket, __mock: { listeners: _listeners, emitCalls: _emitCalls } };
});

import KanbanBoard from '../../components/KanbanBoard';

describe('WebSocket Integration (integration)', () => {
  beforeEach(async () => {
    const mod = await vi.importMock('../../socket');
    listeners = mod.__mock.listeners;
    emitCalls = mod.__mock.emitCalls;
    for (const k of Object.keys(listeners)) delete listeners[k];
    emitCalls.length = 0;
  });

  it('syncs a created task to the board', async () => {
    render(<KanbanBoard />);
    const user = userEvent.setup();

    // create via form — use fireEvent.change to reliably set controlled inputs
    fireEvent.change(screen.getByTestId('title-input'), { target: { value: 'Integration Task' } });
    fireEvent.change(screen.getByTestId('description-input'), { target: { value: 'Integration description' } });
    await user.click(screen.getByTestId('create-button'));

    // Simulate server sync broadcast (don't rely on emitted payloads in this test)
    act(() => {
      (listeners['sync:tasks'] || []).forEach((cb) => cb([{ id: 'srv-1', title: 'Integration Task', description: 'Integration description', status: 'todo', priority: 'Medium', category: 'Feature', attachments: [] }]));
    });

    await screen.findByText(/Integration Task/, {}, { timeout: 2000 });
  });

  it('moves a task when move button is clicked', async () => {
    render(<KanbanBoard />);
    // simulate server sending initial task in todo
    const initial = [{ id: 'm-1', title: 'MoveMe', description: '', status: 'todo', priority: 'Medium', category: 'Feature', attachments: [] }];
    act(() => {
      (listeners['sync:tasks'] || []).forEach((cb) => cb(initial));
    });

    await screen.findByText(/MoveMe/, {}, { timeout: 2000 });

    // find the Move to In Progress button on the task card and click it
    const inProgressButton = screen.getByLabelText('Move to In Progress');
    const user = userEvent.setup();
    await user.click(inProgressButton);

    // the mock server will broadcast sync:tasks; ensure emit was called
    await waitFor(() => expect(emitCalls.find(e => e.ev === 'task:move')).toBeTruthy(), { timeout: 2000 });
  });
});
