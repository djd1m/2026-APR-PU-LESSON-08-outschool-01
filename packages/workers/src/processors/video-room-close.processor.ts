import { Job } from 'bullmq';
import type { VideoRoomCloseJobData } from '../queues';

/**
 * Auto-close video room processor.
 *
 * Scheduled as a delayed BullMQ job (10 min after section endTime).
 * Marks the VideoRoom as CLOSED in the database so the Jitsi iframe
 * stops accepting new participants.
 *
 * In production this would use a shared Prisma client or HTTP call
 * to the API. For now we log the action and rely on the API's own
 * close endpoint being called by the worker via an internal HTTP request.
 */
const API_URL = process.env.API_INTERNAL_URL || 'http://localhost:4000';

export async function processVideoRoomCloseJob(
  job: Job<VideoRoomCloseJobData>,
): Promise<void> {
  const { sectionId, roomName } = job.data;

  console.log(
    `[video-room-close] auto-closing room "${roomName}" for section ${sectionId}`,
  );

  try {
    // Call the internal API endpoint to close the room
    const response = await fetch(
      `${API_URL}/api/v1/video/rooms/${sectionId}/auto-close`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`API returned ${response.status}: ${text}`);
    }

    console.log(
      `[video-room-close] room "${roomName}" closed successfully`,
    );
  } catch (error) {
    console.error(
      `[video-room-close] failed to close room "${roomName}":`,
      error instanceof Error ? error.message : error,
    );
    throw error; // Let BullMQ retry
  }
}
