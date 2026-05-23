/**
 * Live EventSource subscription client with exponential backoff reconnect.
 */
export function subscribeToEvents(onEvent, onError) {
  let eventSource = null;
  let reconnectTimeout = null;
  let backoffMs = 1000;
  const maxBackoffMs = 30000;
  let isClosed = false;

  function connect() {
    if (isClosed) return;

    // Connect to /stream endpoint
    eventSource = new EventSource('/stream');

    eventSource.onopen = () => {
      console.log('[ccgmon/sse] live stream connected');
      backoffMs = 1000; // Reset backoff on successful connection
    };

    eventSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        onEvent(parsed);
      } catch (err) {
        console.error('[ccgmon/sse] error parsing SSE message payload:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.warn('[ccgmon/sse] stream disconnected or encountered error. Reconnecting...');
      eventSource.close();

      if (onError) {
        onError(err);
      }

      // Schedule reconnect with exponential backoff
      reconnectTimeout = setTimeout(() => {
        backoffMs = Math.min(backoffMs * 2, maxBackoffMs);
        connect();
      }, backoffMs);
    };
  }

  connect();

  return {
    close: () => {
      isClosed = true;
      if (eventSource) {
        eventSource.close();
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      console.log('[ccgmon/sse] unsubscribed from live stream');
    }
  };
}
