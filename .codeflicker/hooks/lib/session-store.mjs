import fs from "node:fs";
import path from "node:path";
import { ensureDir, nowIso, sessionsDir } from "./utils.mjs";

export const SESSION_SCHEMA_VERSION = 4;

export function loadSessionState(rootDir, sessionId) {
  ensureRuntimeStructure(rootDir);
  const target = sessionFile(rootDir, sessionId);
  if (!fs.existsSync(target)) {
    return createInitialState(sessionId);
  }
  try {
    const raw = fs.readFileSync(target, "utf8");
    return migrateSessionState({ ...createInitialState(sessionId), ...JSON.parse(raw) }, sessionId);
  } catch {
    return createInitialState(sessionId);
  }
}

export function saveSessionState(rootDir, sessionState) {
  ensureRuntimeStructure(rootDir);
  const nextState = {
    ...createInitialState(sessionState.session_id),
    ...migrateSessionState(sessionState, sessionState.session_id),
    updated_at: nowIso(),
  };
  fs.writeFileSync(sessionFile(rootDir, nextState.session_id), JSON.stringify(nextState, null, 2));
  return nextState;
}

export function deleteSessionState(rootDir, sessionId) {
  const target = sessionFile(rootDir, sessionId);
  if (fs.existsSync(target)) {
    fs.unlinkSync(target);
  }
}

function ensureRuntimeStructure(rootDir) {
  ensureDir(sessionsDir(rootDir));
}

function sessionFile(rootDir, sessionId) {
  return path.join(sessionsDir(rootDir), `${sessionId}.json`);
}

function createInitialState(sessionId) {
  return {
    schema_version: SESSION_SCHEMA_VERSION,
    session_id: sessionId,
    current_command: null,
    workflow_active: false,
    stage: null,
    project: null,
    plan_id: null,
    wave: null,
    last_outputs: {
      prd: null,
      biz_discovery: null,
      question_backlog: null,
      context: null,
      scope_map: null,
      tech_design: null,
      tasks: null,
      execution_plan_index: null,
      execution_plan: null,
      plan_slice: null,
      execution_state: null,
      execution_report: null,
      archive: null,
    },
    confirmations: {
      tech_design_confirmed: false,
      tasks_confirmed: false,
    },
    notifications: {},
    updated_at: nowIso(),
  };
}

function migrateSessionState(sessionState, fallbackSessionId) {
  const nextState = { ...sessionState };
  nextState.schema_version = SESSION_SCHEMA_VERSION;
  nextState.session_id =
    typeof nextState.session_id === "string" && nextState.session_id.trim()
      ? nextState.session_id.trim()
      : fallbackSessionId;

  nextState.workflow_active = sessionState.workflow_active === true;
  if (!nextState.workflow_active) {
    nextState.current_command = null;
    nextState.stage = null;
    nextState.project = null;
    nextState.plan_id = null;
    nextState.wave = null;
  }

  nextState.last_outputs = {
    ...createInitialState(nextState.session_id).last_outputs,
    ...(nextState.last_outputs ?? {}),
  };
  nextState.confirmations = {
    ...createInitialState(nextState.session_id).confirmations,
    ...(nextState.confirmations ?? {}),
  };
  nextState.notifications = {
    ...createInitialState(nextState.session_id).notifications,
    ...(nextState.notifications ?? {}),
  };

  return nextState;
}
