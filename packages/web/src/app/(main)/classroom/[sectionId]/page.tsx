'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { JitsiMeet } from '@/components/JitsiMeet';
import { useAuth } from '@/hooks/useAuth';
import { apiFetch } from '@/lib/api';

type RoomStatus = 'WAITING' | 'ACTIVE' | 'CLOSED';

interface RoomInfo {
  id: string;
  sectionId: string;
  roomName: string;
  status: RoomStatus;
  jitsiDomain: string;
  createdAt: string;
  closedAt: string | null;
  section: {
    id: string;
    startTime: string;
    endTime: string;
    class: {
      id: string;
      title: string;
    };
  };
}

interface JoinResponse {
  roomName: string;
  jitsiDomain: string;
  jwt: string;
  moderator: boolean;
  status: RoomStatus;
}

function formatTimeLeft(ms: number): string {
  if (ms <= 0) return 'Сейчас';
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  if (minutes > 60) {
    const hours = Math.floor(minutes / 60);
    const remainMinutes = minutes % 60;
    return `${hours} ч ${remainMinutes} мин`;
  }
  if (minutes > 0) {
    return `${minutes} мин ${seconds} сек`;
  }
  return `${seconds} сек`;
}

export default function ClassroomPage() {
  const params = useParams();
  const router = useRouter();
  const sectionId = params.sectionId as string;
  const { user, isLoading: authLoading } = useAuth();

  const [roomInfo, setRoomInfo] = useState<RoomInfo | null>(null);
  const [joinData, setJoinData] = useState<JoinResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasJoined, setHasJoined] = useState(false);
  const [callEnded, setCallEnded] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  // Fetch room info
  useEffect(() => {
    if (!user || !sectionId) return;

    apiFetch<RoomInfo>(`/video/rooms/${sectionId}`)
      .then((data) => {
        setRoomInfo(data);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Не удалось загрузить информацию о занятии');
        setIsLoading(false);
      });
  }, [user, sectionId]);

  // Countdown timer
  useEffect(() => {
    if (!roomInfo) return;

    const startTime = new Date(roomInfo.section.startTime).getTime();

    const updateTimer = () => {
      const now = Date.now();
      const diff = startTime - now;
      setTimeLeft(diff);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [roomInfo]);

  const handleJoin = useCallback(async () => {
    if (!sectionId) return;
    setIsJoining(true);
    setError(null);

    try {
      const data = await apiFetch<JoinResponse>(
        `/video/rooms/${sectionId}/join`,
        { method: 'POST' },
      );
      setJoinData(data);
      setHasJoined(true);
      setConnectionStatus('connecting');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Не удалось присоединиться',
      );
    } finally {
      setIsJoining(false);
    }
  }, [sectionId]);

  const handleEndClass = useCallback(async () => {
    if (!sectionId) return;

    try {
      await apiFetch(`/video/rooms/${sectionId}`, { method: 'DELETE' });
      setCallEnded(true);
      setConnectionStatus('disconnected');
    } catch (err) {
      console.error('Failed to close room:', err);
    }
  }, [sectionId]);

  const handleCallEnded = useCallback(() => {
    setCallEnded(true);
    setConnectionStatus('disconnected');
  }, []);

  const handleReady = useCallback(() => {
    setConnectionStatus('connected');
  }, []);

  // Auth loading state
  if (authLoading) {
    return (
      <div className="container-page py-16 text-center text-gray-500">
        Загрузка...
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return (
      <div className="container-page py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900">
          Войдите в аккаунт
        </h1>
        <p className="mt-2 text-gray-600">
          Для доступа к видео-классу необходимо авторизоваться.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-primary-700 transition-colors"
        >
          Войти
        </Link>
      </div>
    );
  }

  // Loading room info
  if (isLoading) {
    return (
      <div className="container-page py-16">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="h-12 animate-pulse rounded-2xl bg-gray-100" />
          <div className="h-96 animate-pulse rounded-2xl bg-gray-100" />
        </div>
      </div>
    );
  }

  // Error loading room
  if (error && !roomInfo) {
    return (
      <div className="container-page py-16 text-center">
        <Card className="max-w-lg mx-auto p-8">
          <h2 className="text-xl font-bold text-gray-900">
            Видео-класс недоступен
          </h2>
          <p className="mt-2 text-gray-600">{error}</p>
          <Link
            href="/dashboard"
            className="mt-6 inline-block text-primary-600 hover:underline"
          >
            Вернуться в личный кабинет
          </Link>
        </Card>
      </div>
    );
  }

  // Room is closed / call ended
  if (callEnded || roomInfo?.status === 'CLOSED') {
    return (
      <div className="container-page py-16 text-center">
        <Card className="max-w-lg mx-auto p-8">
          <div className="text-5xl mb-4">
            <span role="img" aria-label="completed">&#9989;</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">
            Занятие завершено
          </h2>
          <p className="mt-2 text-gray-600">
            {roomInfo?.section.class.title}
          </p>

          {user.role === 'PARENT' && (
            <div className="mt-6 p-4 rounded-xl bg-primary-50">
              <p className="text-sm font-medium text-primary-700">
                Как прошло занятие?
              </p>
              <div className="mt-3 flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    className="text-2xl text-yellow-400 hover:scale-110 transition-transform"
                    onClick={() => {
                      // Would navigate to review page
                      router.push(`/classes/${roomInfo?.section.class.id}?review=true&rating=${star}`);
                    }}
                  >
                    &#9733;
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 flex justify-center gap-3">
            <Link href="/dashboard">
              <Button variant="primary">В личный кабинет</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  // Pre-join screen (not yet joined the video)
  if (!hasJoined) {
    const isClassStartingSoon = timeLeft <= 15 * 60 * 1000; // 15 minutes
    const hasClassStarted = timeLeft <= 0;

    return (
      <div className="container-page py-8">
        <div className="max-w-2xl mx-auto">
          <Card className="p-8">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900">
                {roomInfo?.section.class.title}
              </h1>

              <div className="mt-4 flex justify-center gap-2">
                <Badge variant={roomInfo?.status === 'ACTIVE' ? 'primary' : 'secondary'}>
                  {roomInfo?.status === 'ACTIVE'
                    ? 'Идёт занятие'
                    : roomInfo?.status === 'WAITING'
                      ? 'Ожидание'
                      : roomInfo?.status}
                </Badge>

                {/* Connection status indicator */}
                <span className="inline-flex items-center gap-1.5 text-xs">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      connectionStatus === 'connected'
                        ? 'bg-green-500'
                        : connectionStatus === 'connecting'
                          ? 'bg-yellow-400 animate-pulse'
                          : 'bg-gray-400'
                    }`}
                  />
                  {connectionStatus === 'connected'
                    ? 'Подключено'
                    : connectionStatus === 'connecting'
                      ? 'Ожидание'
                      : 'Отключено'}
                </span>
              </div>

              {!hasClassStarted && (
                <div className="mt-6 p-6 rounded-xl bg-blue-50">
                  <p className="text-sm text-blue-600">
                    Занятие начнётся через
                  </p>
                  <p className="mt-1 text-3xl font-bold text-blue-700">
                    {formatTimeLeft(timeLeft)}
                  </p>
                </div>
              )}

              {hasClassStarted && roomInfo?.status === 'ACTIVE' && (
                <div className="mt-6 p-6 rounded-xl bg-green-50">
                  <p className="text-lg font-medium text-green-700">
                    Занятие уже началось!
                  </p>
                </div>
              )}

              {error && (
                <div className="mt-4 p-4 rounded-xl bg-red-50">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <div className="mt-6">
                <Button
                  size="lg"
                  onClick={handleJoin}
                  disabled={isJoining || (!isClassStartingSoon && user.role !== 'TEACHER')}
                >
                  {isJoining
                    ? 'Подключение...'
                    : hasClassStarted
                      ? 'Войти в класс'
                      : isClassStartingSoon
                        ? 'Войти в класс'
                        : 'Войти можно за 15 мин до начала'}
                </Button>
              </div>

              {roomInfo && (
                <p className="mt-4 text-sm text-gray-500">
                  Время:{' '}
                  {new Date(roomInfo.section.startTime).toLocaleString('ru-RU', {
                    day: 'numeric',
                    month: 'long',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  &mdash;{' '}
                  {new Date(roomInfo.section.endTime).toLocaleString('ru-RU', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // Active video session
  return (
    <div className="container-page py-4">
      <div className="max-w-6xl mx-auto">
        {/* Header bar */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-bold text-gray-900">
              {roomInfo?.section.class.title}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="primary">Идёт занятие</Badge>
              <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                <span
                  className={`h-2 w-2 rounded-full ${
                    connectionStatus === 'connected'
                      ? 'bg-green-500'
                      : connectionStatus === 'connecting'
                        ? 'bg-yellow-400 animate-pulse'
                        : 'bg-red-500'
                  }`}
                />
                {connectionStatus === 'connected'
                  ? 'Подключено'
                  : connectionStatus === 'connecting'
                    ? 'Подключение...'
                    : 'Отключено'}
              </span>
            </div>
          </div>

          {joinData?.moderator && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleEndClass}
              className="text-red-600 border-red-300 hover:bg-red-50"
            >
              Завершить занятие
            </Button>
          )}
        </div>

        {/* Jitsi embed */}
        <Card className="overflow-hidden" style={{ height: 'calc(100vh - 200px)' }}>
          {joinData && (
            <JitsiMeet
              domain={joinData.jitsiDomain}
              roomName={joinData.roomName}
              jwt={joinData.jwt}
              displayName={user.name}
              isModerator={joinData.moderator}
              onCallEnded={handleCallEnded}
              onReady={handleReady}
            />
          )}
        </Card>
      </div>
    </div>
  );
}
