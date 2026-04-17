import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { SessionManager } from "@mariozechner/pi-coding-agent";
import { SessionSupervisor } from "../dist/session-supervisor.js";

function createFakeSession(sessionManager, options = {}) {
  const { mode = "streaming" } = options;
  const listeners = new Set();
  let streaming = false;
  const messages = [];

  return {
    sessionId: sessionManager.getSessionId(),
    sessionFile: sessionManager.getSessionFile(),
    sessionManager,
    sessionName: "Duplicate completion test",
    promptTemplates: [],
    extensionRunner: undefined,
    resourceLoader: {
      getSkills() {
        return { skills: [] };
      },
    },
    get messages() {
      return messages;
    },
    get isStreaming() {
      return streaming;
    },
    async bindExtensions() {},
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async prompt(text) {
      const userMessage = {
        role: "user",
        content: text,
        timestamp: Date.now(),
      };
      messages.push(userMessage);

      if (mode === "handled-input") {
        return;
      }

      const assistantMessage = {
        role: "assistant",
        content: [{ type: "text", text: "READY" }],
        stopReason: "stop",
        timestamp: Date.now() + 1,
      };

      streaming = true;
      for (const listener of listeners) {
        listener({ type: "agent_start" });
        listener({ type: "message_start", message: userMessage });
        listener({ type: "message_end", message: userMessage });
      }

      streaming = false;
      setTimeout(() => {
        messages.push(assistantMessage);
        for (const listener of listeners) {
          listener({
            type: "message_update",
            message: assistantMessage,
            assistantMessageEvent: {
              type: "text_delta",
              delta: "READY",
            },
          });
          listener({ type: "message_end", message: assistantMessage });
          listener({ type: "agent_end", messages: [...messages] });
        }
      }, 0);
    },
  };
}

test("sendUserMessage emits runCompleted once per prompt", async () => {
  const workspacePath = await mkdtemp(join(tmpdir(), "pi-sdk-driver-session-supervisor-"));
  await writeFile(join(workspacePath, "README.md"), "# session-supervisor test\n", "utf8");

  const supervisor = new SessionSupervisor({
    catalogFilePath: join(workspacePath, "catalogs.json"),
    createAgentSessionImpl: async ({ sessionManager }) => ({
      session: createFakeSession(sessionManager ?? SessionManager.create(workspacePath)),
    }),
  });

  const workspace = {
    workspaceId: randomUUID(),
    path: workspacePath,
    displayName: "session-supervisor-test",
  };
  const snapshot = await supervisor.createSession(workspace, { title: "Duplicate completion test" });

  const events = [];
  let resolveCompletion;
  const completion = new Promise((resolve) => {
    resolveCompletion = resolve;
  });
  const unsubscribe = supervisor.subscribe(snapshot.ref, (event) => {
    events.push(event);
    if (event.type === "runCompleted") {
      resolveCompletion();
    }
  });

  try {
    await supervisor.sendUserMessage(snapshot.ref, { text: "Reply with only READY." });
    await completion;

    const runCompletedEvents = events.filter((event) => event.type === "runCompleted");
    assert.equal(runCompletedEvents.length, 1);
    assert.equal(runCompletedEvents[0]?.snapshot.preview, "READY");
  } finally {
    unsubscribe();
  }
});

test("sendUserMessage returns session to idle when input is handled without starting a run", async () => {
  const workspacePath = await mkdtemp(join(tmpdir(), "pi-sdk-driver-session-supervisor-handled-"));
  await writeFile(join(workspacePath, "README.md"), "# session-supervisor handled-input test\n", "utf8");

  const supervisor = new SessionSupervisor({
    catalogFilePath: join(workspacePath, "catalogs.json"),
    createAgentSessionImpl: async ({ sessionManager }) => ({
      session: createFakeSession(sessionManager ?? SessionManager.create(workspacePath), { mode: "handled-input" }),
    }),
  });

  const workspace = {
    workspaceId: randomUUID(),
    path: workspacePath,
    displayName: "session-supervisor-handled-input-test",
  };
  const snapshot = await supervisor.createSession(workspace, { title: "Handled input test" });

  const events = [];
  const unsubscribe = supervisor.subscribe(snapshot.ref, (event) => {
    events.push(event);
  });

  try {
    await supervisor.sendUserMessage(snapshot.ref, { text: "mở https://example.com bằng browser companion" });
    await new Promise((resolve) => setTimeout(resolve, 10));

    const updates = events.filter((event) => event.type === "sessionUpdated");
    assert.ok(updates.length > 0);
    assert.equal(updates.at(-1)?.snapshot.status, "idle");
    assert.equal(events.some((event) => event.type === "runCompleted"), false);
    assert.equal(events.some((event) => event.type === "runFailed"), false);
  } finally {
    unsubscribe();
  }
});
