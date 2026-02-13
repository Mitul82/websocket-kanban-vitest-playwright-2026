import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { vi } from 'vitest';

// Mock react-dnd so tests don't need a real backend or DOM drag/drop support
vi.mock('react-dnd', () => ({
  DndProvider: ({ children }) => children,
  useDrag: () => [{ isDragging: false }, () => {}],
}));

import TaskCard from '../../components/TaskCard';

describe('TaskCard', () => {
  it('renders attachments thumbnails and opens lightbox on click', async () => {
    const task = {
      id: 't-1',
      title: 'T1',
      description: 'desc',
      status: 'todo',
      priority: 'Medium',
      category: 'Feature',
      attachments: [{ name: 'img1.png', url: 'data:image/png;base64,AAA' }],
    };

    render(<TaskCard task={task} onDelete={() => {}} onMove={() => {}} onUpdate={() => {}} />);

    // thumbnail is rendered
    const thumb = await screen.findByAltText('img1.png');
    expect(thumb).toBeInTheDocument();

    // clicking thumbnail opens the lightbox (portal)
    fireEvent.click(thumb);

    await waitFor(() => {
      const light = document.querySelector('.attachment-lightbox');
      expect(light).toBeTruthy();
      expect(light.getAttribute('src')).toContain('data:image/png');
    });

    // close by pressing Escape
    // close the lightbox by clicking the overlay (role=dialog)
    const overlay = document.querySelector('[role="dialog"]');
    expect(overlay).toBeTruthy();
    fireEvent.click(overlay);
    await waitFor(() => {
      expect(document.querySelector('.attachment-lightbox')).toBeNull();
    });
  });

  it('accepts dropped files in edit mode and shows new thumbnail', async () => {
    const task = {
      id: 't-2',
      title: 'T2',
      description: 'desc',
      status: 'todo',
      priority: 'Medium',
      category: 'Feature',
      attachments: [],
    };

    // Mock FileReader so readAsDataURL returns quickly
    class MockFileReader {
      constructor() {
        this.onload = null;
        this.onerror = null;
        this.result = null;
      }
      readAsDataURL(file) {
        // produce a simple data URL
        this.result = `data:image/png;base64,MOCK-${file.name}`;
        if (this.onload) this.onload({ target: { result: this.result } });
      }
    }

    // Replace global FileReader for this test
    const origFR = global.FileReader;
    // eslint-disable-next-line no-undef
    global.FileReader = MockFileReader;

    const { container } = render(<TaskCard task={task} onDelete={() => {}} onMove={() => {}} onUpdate={() => {}} />);
    const editBtn = screen.getByLabelText('Edit task');
    await userEvent.click(editBtn);

    // find the drop area label
    const dropLabel = container.querySelector('.task-edit-droparea');
    expect(dropLabel).toBeTruthy();

    // emulate dropping a file
    const file = new File(['dummy'], 'dropped.png', { type: 'image/png' });
    fireEvent.drop(dropLabel, {
      dataTransfer: { files: [file] },
    });

    // the mocked FileReader will synchronously add an attachment which should render a thumbnail
    await waitFor(() => expect(container.querySelectorAll('.attachment-thumb').length).toBeGreaterThan(0));

    // restore FileReader
    global.FileReader = origFR;
  });
});
