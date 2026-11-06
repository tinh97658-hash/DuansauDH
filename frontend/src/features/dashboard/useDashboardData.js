import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../../config/http';
import { useAuthSession } from '../../context/AuthSession';
import { listenForBackgroundRefresh } from '../../utils/backgroundRefresh';
import { useGradebookRevision } from '../../utils/gradebookRevision';

export function useDashboardData(year, program, section) {
  const session = useAuthSession();
  const identity = `${session?.user?.id || ''}:${session?.activeProfile?.id || ''}`;
  const scope = `${identity}:${year}:${program}:${section || ''}`;
  const [state, setState] = useState({ scope, loading: true, sources: {} });
  const [revision, setRevision] = useState(0);
  const generation = useRef(0), inFlight = useRef(false), sourceRequests = useRef({});
  const lastRequest = useRef(0);
  const gradeRevision = useGradebookRevision();
  useEffect(() => {
    const request = ++generation.current, controller = new AbortController();
    sourceRequests.current = {};
    inFlight.current = true;
    lastRequest.current = Date.now();
    setState(previous => previous.scope === scope && previous.permissions ? { ...previous, error: false }
      : { scope, loading: true, sources: {} });
    axios.get(`${API_BASE_URL}/dashboard/operational`, { params: { year, program, ...(section ? { section } : {}) }, withCredentials: true, signal: controller.signal })
      .then(({ data }) => { if (request === generation.current) setState({ ...data, scope, loading: false, error: false }); })
      .catch(() => { if (request === generation.current) setState({ scope, loading: false, sources: {}, error: true }); })
      .finally(() => { if (request === generation.current) inFlight.current = false; });
    return () => { controller.abort(); generation.current += 1; inFlight.current = false; };
  }, [scope, year, program, section, revision, gradeRevision]);
  useEffect(() => listenForBackgroundRefresh(() => setRevision(value => value + 1), {
    interval: 30000,
    canRefresh: () => !inFlight.current && Date.now() - lastRequest.current >= 30000,
  }), []);
  const retry = useCallback(async source => {
    if (!source) { setRevision(value => value + 1); return; }
    const request = generation.current, token = {};
    sourceRequests.current[source] = token;
    setState(previous => ({ ...previous, sources: { ...previous.sources, [source]: { status: 'loading' } } }));
    try {
      const { data } = await axios.get(`${API_BASE_URL}/dashboard/operational`, { params: { year, program, section: source }, withCredentials: true });
      if (request === generation.current && sourceRequests.current[source] === token) setState(previous => ({ ...previous,
        permissions: data.permissions, sources: { ...previous.sources, ...data.sources } }));
    } catch (error) {
      if (request !== generation.current || sourceRequests.current[source] !== token) return;
      if ([401, 403].includes(error.response?.status)) setState({ scope, loading: false, error: true, sources: {} });
      else setState(previous => ({ ...previous, sources: { ...previous.sources, [source]: { status: 'error' } } }));
    }
  }, [year, program, scope]);
  // Hide old-profile data during render, before the new effect starts.
  return { state: state.scope === scope ? state : { scope, loading: true, sources: {} }, retry };
}
