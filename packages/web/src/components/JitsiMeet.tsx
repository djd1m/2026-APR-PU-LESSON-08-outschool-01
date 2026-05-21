'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

interface JitsiMeetProps {
  domain: string;
  roomName: string;
  jwt: string;
  displayName: string;
  isModerator: boolean;
  onParticipantJoined?: (participant: { id: string; displayName: string }) => void;
  onParticipantLeft?: (participant: { id: string }) => void;
  onCallEnded?: () => void;
  onReady?: () => void;
}

declare global {
  interface Window {
    JitsiMeetExternalAPI: new (
      domain: string,
      options: Record<string, unknown>,
    ) => JitsiApi;
  }
}

interface JitsiApi {
  executeCommand: (command: string, ...args: unknown[]) => void;
  addListener: (event: string, handler: (...args: unknown[]) => void) => void;
  dispose: () => void;
}

export function JitsiMeet({
  domain,
  roomName,
  jwt,
  displayName,
  isModerator,
  onParticipantJoined,
  onParticipantLeft,
  onCallEnded,
  onReady,
}: JitsiMeetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<JitsiApi | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const muteAll = useCallback(() => {
    if (apiRef.current && isModerator) {
      apiRef.current.executeCommand('muteEveryone');
    }
  }, [isModerator]);

  const endCall = useCallback(() => {
    if (apiRef.current) {
      apiRef.current.executeCommand('hangup');
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    // Load the Jitsi external API script
    const script = document.createElement('script');
    script.src = `https://${domain}/external_api.js`;
    script.async = true;

    script.onload = () => {
      if (!containerRef.current) return;

      try {
        const api = new window.JitsiMeetExternalAPI(domain, {
          roomName,
          jwt,
          parentNode: containerRef.current,
          width: '100%',
          height: '100%',
          configOverwrite: {
            startWithAudioMuted: true,
            startWithVideoMuted: false,
            disableRecordAudioNotification: true,
            prejoinPageEnabled: false,
            // Disable recording for safety
            fileRecordingsEnabled: false,
            liveStreamingEnabled: false,
            localRecording: { enabled: false },
            // UI
            hideConferenceSubject: false,
            hideConferenceTimer: false,
            disableDeepLinking: true,
          },
          interfaceConfigOverwrite: {
            TOOLBAR_BUTTONS: [
              'microphone',
              'camera',
              'desktop',
              'chat',
              'raisehand',
              'tileview',
              'hangup',
            ],
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
            DISABLE_JOIN_LEAVE_NOTIFICATIONS: false,
            DEFAULT_REMOTE_DISPLAY_NAME: 'Участник',
          },
          userInfo: {
            displayName,
          },
        });

        apiRef.current = api;

        api.addListener('videoConferenceJoined', () => {
          setIsLoading(false);
          onReady?.();
        });

        api.addListener('participantJoined', (participant: unknown) => {
          onParticipantJoined?.(participant as { id: string; displayName: string });
        });

        api.addListener('participantLeft', (participant: unknown) => {
          onParticipantLeft?.(participant as { id: string });
        });

        api.addListener('videoConferenceLeft', () => {
          onCallEnded?.();
        });

        api.addListener('readyToClose', () => {
          onCallEnded?.();
        });
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to initialize Jitsi',
        );
        setIsLoading(false);
      }
    };

    script.onerror = () => {
      setError('Failed to load Jitsi Meet. Check your internet connection.');
      setIsLoading(false);
    };

    document.head.appendChild(script);

    return () => {
      if (apiRef.current) {
        apiRef.current.dispose();
        apiRef.current = null;
      }
      // Remove the script tag on cleanup
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [domain, roomName, jwt, displayName, onParticipantJoined, onParticipantLeft, onCallEnded, onReady]);

  return (
    <div className="relative w-full h-full min-h-[400px]">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white rounded-2xl z-10">
          <div className="text-center">
            <div className="h-10 w-10 mx-auto animate-spin rounded-full border-4 border-white border-t-transparent" />
            <p className="mt-4 text-sm">Подключение к видео-классу...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-50 rounded-2xl z-10">
          <div className="text-center p-6">
            <p className="text-red-600 font-medium">Ошибка подключения</p>
            <p className="mt-2 text-sm text-red-500">{error}</p>
          </div>
        </div>
      )}

      <div
        ref={containerRef}
        className="w-full h-full rounded-2xl overflow-hidden"
      />

      {isModerator && !isLoading && !error && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3 z-20">
          <button
            onClick={muteAll}
            className="rounded-lg bg-yellow-500 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-600 transition-colors shadow-lg"
          >
            Выключить всем микрофон
          </button>
          <button
            onClick={endCall}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors shadow-lg"
          >
            Завершить занятие
          </button>
        </div>
      )}
    </div>
  );
}
