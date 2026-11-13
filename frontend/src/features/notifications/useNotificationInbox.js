import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useAuthSession } from '../../context/AuthSession';
import { API_BASE_URL } from '../../config/http';

const initial = identity => ({ identity, status: 'idle', items: [], total: 0, unreadCount: null, page: 1, actionError: '', busy: false });
export function useNotificationInbox() {
  const session = useAuthSession();
  const profile = session?.activeProfile?.id;
  const identity = `${session?.user?.id || ''}:${profile || ''}`;
  const enabled = Boolean(session?.user?.id && profile && !session?.user?.mustChangePassword && session?.authenticated !== false);
  const [state, setState] = useState(() => initial(identity));
  const current = useRef(identity), request = useRef(0), fetchController = useRef(null), mutationController = useRef(null), pageRef = useRef(1);
  current.current = identity;
  const headers = { 'X-Working-Profile-Id': profile };
  const refresh = useCallback(async (page = 1) => {
    if (!enabled || current.current !== identity) return;
    fetchController.current?.abort();
    const controller = new AbortController(), token = ++request.current;
    fetchController.current = controller;
    setState(previous => ({ ...(previous.identity === identity ? previous : initial(identity)), status: 'loading' }));
    try {
      const { data } = await axios.get(`${API_BASE_URL}/notifications`, { params: { page, pageSize: 6 }, headers: { 'X-Working-Profile-Id': profile }, signal: controller.signal, withCredentials: true });
      if (controller.signal.aborted || request.current !== token || current.current !== identity) return;
      pageRef.current = data.page;
      setState(previous => ({ ...previous, identity, status: 'ready', items: data.items, total: data.total, unreadCount: data.unreadCount, page: data.page, error: '' }));
    } catch (error) {
      if (controller.signal.aborted || request.current !== token || current.current !== identity) return;
      setState(previous => ({ ...previous, identity, status: 'error', unreadCount: null,
        error: error.response?.status === 503 && error.response?.data?.code === 'NOTIFICATION_V2_DISABLED'
          ? 'Thông báo chưa được kích hoạt trên môi trường này.' : 'Chưa tải được thông báo.' }));
    }
  }, [identity, enabled, profile]);

  useEffect(() => {
    current.current = identity;
    setState(initial(identity)); pageRef.current = 1;
    void refresh(1);
    const poll = () => { if (document.visibilityState !== 'hidden' && !mutationController.current) void refresh(pageRef.current); };
    const timer = enabled ? window.setInterval(poll, 45000) : null;
    window.addEventListener('focus', poll);
    document.addEventListener('visibilitychange', poll);
    return () => {
      if (current.current === identity) current.current = null;
      ++request.current;
      fetchController.current?.abort(); mutationController.current?.abort(); mutationController.current = null;
      if (timer !== null) window.clearInterval(timer);
      window.removeEventListener('focus', poll); document.removeEventListener('visibilitychange', poll);
    };
  }, [identity, enabled, refresh]);

  const mutate = async path => {
    if (!enabled || mutationController.current || current.current !== identity) return null;
    fetchController.current?.abort(); ++request.current;
    const controller = new AbortController(); mutationController.current = controller;
    setState(previous => ({ ...previous, busy: true, actionError: '' }));
    try {
      const { data } = await axios.post(`${API_BASE_URL}/notifications/${path}`, {}, { headers, signal: controller.signal, withCredentials: true });
      if (controller.signal.aborted || current.current !== identity) return null;
      await refresh(pageRef.current);
      return current.current === identity && !controller.signal.aborted ? data : null;
    } catch {
      if (!controller.signal.aborted && current.current === identity) setState(previous => ({ ...previous, actionError: 'Chưa đánh dấu đã đọc được. Vui lòng thử lại.' }));
      return null;
    } finally {
      if (mutationController.current === controller) mutationController.current = null;
      if (!controller.signal.aborted && current.current === identity) setState(previous => ({ ...previous, busy: false }));
    }
  };
  return { ...(state.identity === identity ? state : initial(identity)), enabled, identity, refresh,
    read: id => mutate(`${encodeURIComponent(id)}/read`), readAll: () => mutate('read-all') };
}
