#!/usr/bin/env bash
exec "$(dirname "$0")/../framework/agent-watcher.sh" "$(cd "$(dirname "$0")" && pwd)"
