import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDb } from './db';
import { replaySessions, replayPlaylist } from '../drizzle/schema';
import { getActiveReplaySession, getPlaylistBySessionId } from './db';
import { eq } from 'drizzle-orm';

describe('Playlist Display Functionality', () => {
  let testSessionId: number;
  
  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');
    
    // Create a test session
    const result = await db.insert(replaySessions).values({
      status: 'idle',
      speed: 10,
      maxDelay: 10000,
      nodeId: 'test-node',
    });
    
    testSessionId = Number(result[0].insertId);
    
    // Add test matches to playlist
    await db.insert(replayPlaylist).values([
      {
        sessionId: testSessionId,
        matchId: 'sr:match:test001',
        playOrder: 0,
      },
      {
        sessionId: testSessionId,
        matchId: 'sr:match:test002',
        playOrder: 1,
      },
    ]);
  });
  
  afterAll(async () => {
    const db = await getDb();
    if (!db) return;
    
    // Clean up test data
    await db.delete(replayPlaylist).where(eq(replayPlaylist.sessionId, testSessionId));
    await db.delete(replaySessions).where(eq(replaySessions.id, testSessionId));
  });
  
  it('should get the most recent session regardless of status', async () => {
    const session = await getActiveReplaySession();
    
    expect(session).toBeTruthy();
    expect(session?.id).toBe(testSessionId);
    expect(session?.status).toBe('idle');
  });
  
  it('should retrieve playlist for a session', async () => {
    const playlist = await getPlaylistBySessionId(testSessionId);
    
    expect(playlist).toBeTruthy();
    expect(playlist.length).toBe(2);
    expect(playlist[0].matchId).toBe('sr:match:test001');
    expect(playlist[1].matchId).toBe('sr:match:test002');
  });
  
  it('should display playlist even when session is idle', async () => {
    // This test verifies the core fix:
    // Users should see their playlist even when not actively playing
    
    const session = await getActiveReplaySession();
    expect(session).toBeTruthy();
    
    if (session) {
      const playlist = await getPlaylistBySessionId(session.id);
      expect(playlist.length).toBeGreaterThan(0);
    }
  });
});
