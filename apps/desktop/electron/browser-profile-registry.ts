import { session, type Session } from "electron";

export class BrowserProfileRegistry {
  private readonly sessions = new Map<string, Session>();

  private partitionName(workspaceId: string): string {
    return `persist:pi-gui-browser-${workspaceId}`;
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
}
