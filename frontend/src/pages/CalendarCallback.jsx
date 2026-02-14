import React, { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

const CalendarCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      // Handle error
      if (window.opener) {
        window.opener.postMessage({ type: 'GOOGLE_CALENDAR_CALLBACK', error }, window.location.origin);
        window.close();
      } else {
        navigate('/');
      }
      return;
    }

    if (code) {
      // Send code back to parent window
      if (window.opener) {
        window.opener.postMessage({ type: 'GOOGLE_CALENDAR_CALLBACK', code }, window.location.origin);
        window.close();
      } else {
        // If opened directly (not as popup), redirect to dashboard
        navigate('/');
      }
    }
  }, [searchParams, navigate]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{ fontSize: '4rem', marginBottom: '20px' }}>📅</div>
      <h2 style={{ color: '#333', marginBottom: '10px' }}>Connecting Google Calendar...</h2>
      <p style={{ color: '#666' }}>This window will close automatically.</p>
    </div>
  );
};

export default CalendarCallback;
