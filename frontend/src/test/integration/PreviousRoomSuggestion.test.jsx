import React from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import { renderWithPermissions } from '../renderWithPermissions';
import SessionEditor from '../../features/scheduling/SessionEditor';

vi.mock('axios');
afterEach(() => vi.restoreAllMocks());
const offering = { id: 'course', name: 'Lớp thử gợi ý phòng', status: 'active', participantCount: 20, groupLinks: [], sessionSummary: {} };
const rooms = [{ id: 'r1', code: '301', capacity: 40, isActive: true }, { id: 'r2', code: '302', capacity: 40, isActive: true }];
const history = [{ id: 'before', courseOfferingId: 'course', sessionDate: '2099-01-04', period: 'AFTERNOON', roomId: 'r1', lecturerId: 'teacher', status: 'held', room: rooms[0] }];
let previousSessions, busySessions, availabilityError;
beforeEach(() => {
  previousSessions = history;
  busySessions = [];
  availabilityError = false;
  axios.get.mockImplementation(async (url) => {
    if (url.includes('/teaching-sessions?')) {
      if (availabilityError) throw new Error('Không tải được lịch');
      return { data: busySessions };
    }
    return { data: url.endsWith('/system/rooms') ? rooms
      : url.endsWith('/system/lecturers') ? [{ id: 'teacher', name: 'Giảng viên', active: true }]
      : url.endsWith('/course-offerings/course') ? offering
      : url.endsWith('/course-offerings/course/teaching-sessions') ? previousSessions : [] };
  });
});
const open = () => renderWithPermissions(<SessionEditor offering={offering} date="2099-01-05" period="MORNING" onClose={vi.fn()} onSaved={vi.fn()} />, ['scheduling.view', 'scheduling.write']);

it('marks only the previous room without a header suggestion, selection or reordering', async () => {
  const { container } = open();
  const previous = await screen.findByRole('button', { name: /301.*Buổi trước/ });
  const other = screen.getByRole('button', { name: /302.*40 chỗ/ });
  expect(previous).toHaveAttribute('aria-pressed', 'false');
  expect([...container.ownerDocument.querySelectorAll('.v20-room')].map(room => room.querySelector('strong').firstChild.textContent)).toEqual(['301', '302']);
  expect(screen.queryByText('Phòng buổi trước')).not.toBeInTheDocument();
  fireEvent.click(other);
  expect(other).toHaveAttribute('aria-pressed', 'true');
  expect(previous).toHaveAttribute('aria-pressed', 'false');
  fireEvent.click(previous);
  expect(previous).toHaveClass('sl-on');
  expect(previous).toHaveTextContent('Buổi trước');
});

it('uses existing availability, keeps a busy suggestion disabled, and recalculates for another period', async () => {
  busySessions = [{ id: 'busy', roomId: 'r1', period: 'MORNING', status: 'planned', courseOfferingId: 'other' }];
  open();
  await screen.findByRole('button', { name: /301.*Buổi trước.*ĐÃ CÓ LỊCH|301.*ĐÃ CÓ LỊCH.*Buổi trước/ });
  expect(screen.getByRole('button', { name: /301.*Buổi trước/ })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Buổi'), { target: { value: 'AFTERNOON' } });
  await waitFor(() => expect(screen.getByRole('button', { name: /301.*Buổi trước/ })).toBeEnabled());
});

it('does not treat a failed availability request as an empty room', async () => {
  availabilityError = true;
  open();
  await screen.findByText('Không tải được lịch');
  await screen.findByRole('button', { name: /301.*Buổi trước/ });
  expect(screen.getByRole('button', { name: /301.*Buổi trước/ })).toBeDisabled();
});

it('displays an inactive historical room as unavailable without inserting a selectable room', async () => {
  previousSessions = [{ ...history[0], roomId: 'retired', room: { id: 'retired', code: '901', isActive: false } }];
  open();
  await waitFor(() => expect(screen.getByRole('button', { name: /301.*40 chỗ/ })).toBeEnabled());
  expect(screen.queryByRole('button', { name: /901/ })).not.toBeInTheDocument();
});

it('does not show a suggestion before the course has a previous session', async () => {
  previousSessions = [];
  open();
  await waitFor(() => expect(screen.getByRole('button', { name: /301.*40 chỗ/ })).toBeEnabled());
  expect(screen.queryByLabelText(/Phòng buổi trước:/)).not.toBeInTheDocument();
});

const mockOffscreenRoom = () => {
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function () {
    return this.classList.contains('sl-room-list') ? 300 : 0;
  });
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function () {
    return this.classList.contains('sl-room-list') ? 1200 : 0;
  });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
    const top = this.classList.contains('sl-room-list') ? 100 : 950;
    const height = this.classList.contains('sl-room-list') ? 300 : 78;
    return { top, bottom: top + height, height, left: 0, right: 200, width: 200, x: 0, y: top, toJSON() {} };
  });
  return vi.spyOn(HTMLElement.prototype, 'scrollTop', 'set');
};

it('scrolls only the room container once and does not repeat on hover or selection', async () => {
  const scroll = mockOffscreenRoom();
  // MUI also initializes its own dialog scrollTop to zero when opening.
  const roomScrolls = () => scroll.mock.calls.filter((_, index) => scroll.mock.instances[index]?.classList.contains('sl-room-list'));
  open();
  const previous = await screen.findByRole('button', { name: /301.*Buổi trước/ });
  await waitFor(() => expect(previous).toBeEnabled());
  expect(roomScrolls()).toHaveLength(1);
  expect(roomScrolls()[0][0]).toBeGreaterThan(0);
  fireEvent.mouseEnter(previous);
  fireEvent.mouseLeave(previous);
  fireEvent.click(screen.getByRole('button', { name: /302.*40 chỗ/ }));
  expect(roomScrolls()).toHaveLength(1);
  expect(screen.getByRole('button', { name: /301.*Buổi trước/ })).toHaveAttribute('aria-pressed', 'false');
});

it('skips automatic scrolling when the user has interacted while availability is loading', async () => {
  const scroll = mockOffscreenRoom();
  const get = axios.get.getMockImplementation();
  let resolveAvailability;
  axios.get.mockImplementation((url, options) => url.includes('/teaching-sessions?')
    ? new Promise(resolve => { resolveAvailability = resolve; }) : get(url, options));
  open();
  const previous = await screen.findByRole('button', { name: /301.*Buổi trước/ });
  fireEvent.wheel(previous.closest('.sl-room-list'));
  await act(async () => resolveAvailability({ data: [] }));
  await waitFor(() => expect(previous).toBeEnabled());
  expect(scroll.mock.instances.filter(element => element?.classList.contains('sl-room-list'))).toHaveLength(0);
});
