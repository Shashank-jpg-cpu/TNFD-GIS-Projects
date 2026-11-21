// TNFD GIS Portal - Automatic Tab Lifetime & State Synchronization
(function() {
  try {
    const rawPath = window.location.pathname;
    const decoded = decodeURIComponent(rawPath);
    let pid = null;
    if (decoded.includes('/projects/')) {
      pid = decoded.split('/projects/')[1].split('/')[0];
    } else if (decoded.includes('projects/')) {
      pid = decoded.split('projects/')[1].split('/')[0];
    }
    if (!pid) return;

    const CHANNEL_NAME = 'TNFD_PORTAL_SYNC';
    const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL_NAME) : null;

    function notify(type) {
      const now = Date.now();
      if (bc) {
        try {
          bc.postMessage({ type: type, projectId: pid, timestamp: now });
        } catch (e) {}
      }
      try {
        if (type === 'CLOSED') {
          localStorage.removeItem('tnfd_alive_' + pid);
          localStorage.setItem('tnfd_event_closed', JSON.stringify({ id: pid, t: now }));
        } else {
          localStorage.setItem('tnfd_alive_' + pid, now.toString());
        }
      } catch (e) {}
    }

    // Immediately mark tab as active & alive
    notify('OPEN');

    // Continuous heartbeat every 800ms
    const interval = setInterval(function() {
      notify('HEARTBEAT');
    }, 800);

    // Instant close notification on tab close / reload / navigate away
    function handleClose() {
      clearInterval(interval);
      notify('CLOSED');
    }

    window.addEventListener('beforeunload', handleClose);
    window.addEventListener('unload', handleClose);
    window.addEventListener('pagehide', handleClose);
  } catch (err) {
    console.warn('tabSync error:', err);
  }
})();
