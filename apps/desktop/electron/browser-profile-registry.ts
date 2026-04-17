import { createHash } from "node:crypto";
import { session, type Session } from "electron";

export class BrowserProfileRegistry {
  private readonly sessions = new Map<string, Session>();

  private partitionName(workspaceId: string): string {
    const digest = createHash("sha256").update(workspaceId).digest("hex").slice(0, 24);
    return `persist:pi-gui-browser-${digest}`;
  }

  getSession(workspaceId: string): Session {
    const existing = this.sessions.get(workspaceId);
    if (existing) {
      return existing;
    }

    const created = session.fromPartition(this.partitionName(workspaceId), { cache: true });
    this.sessions.set(workspaceId, created);
    return created;
  }

  async flushStorageData(): Promise<void> {
    await Promise.all(
      [...this.sessions.values()].map(async (browserSession) => {
        await browserSession.flushStorageData();
      }),
    );
  }
}
