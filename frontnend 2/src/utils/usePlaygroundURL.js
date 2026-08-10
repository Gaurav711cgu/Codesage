import { useEffect, useCallback } from 'react';

/**
 * Hook to sync playground state with URL search params.
 * Enables sharing specific playground configurations via URL.
 */
export function usePlaygroundURL(state, setState) {
  // Read URL params on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const updates = {};
    if (params.get('tab')) updates.tab = params.get('tab');
    if (params.get('lang')) updates.language = params.get('lang');
    if (params.get('fw')) updates.framework = params.get('fw');
    if (params.get('style')) updates.docStyle = params.get('style');
    if (params.get('preset')) updates.preset = params.get('preset');
    if (Object.keys(updates).length > 0) {
      setState(prev => ({ ...prev, ...updates }));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Write URL params on state change
  const updateURL = useCallback((newState) => {
    const params = new URLSearchParams();
    if (newState.tab && newState.tab !== 'completion') params.set('tab', newState.tab);
    if (newState.language && newState.language !== 'Python') params.set('lang', newState.language);
    if (newState.framework && newState.framework !== 'pytest') params.set('fw', newState.framework);
    if (newState.docStyle && newState.docStyle !== 'Google') params.set('style', newState.docStyle);
    if (newState.preset) params.set('preset', newState.preset);
    const qs = params.toString();
    const newURL = qs ? `${window.location.pathname}?${qs}#playground` : window.location.pathname;
    window.history.replaceState({}, '', newURL);
  }, []);

  return updateURL;
}

export default usePlaygroundURL;
