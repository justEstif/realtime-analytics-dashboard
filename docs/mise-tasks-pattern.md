# Mise Tasks Pattern

This document describes the conventions used for mise task scripts in this project.

## Structure

Tasks are organized in `.mise/tasks/{namespace}/{task-name}` where:

- `{namespace}` groups related tasks
- `{task-name}` is the executable script file

## File Conventions

1. **Shebang**: `#!/usr/bin/env fish` (uses Fish shell)
2. **Description**: `#MISE description="Short task description"` (second line)
3. **Executable**: Files must be executable (`chmod +x`)
4. **Env vars**: Access mise environment variables directly

## Pattern Template

```fish
#!/usr/bin/env fish
#MISE description="Brief description (7-10 words max)"

# Task implementation here
echo "✓ Action completed"
```

## Best Practices

- **Short names**: Use action-oriented verbs (`start`, `stop`, `logs`, `reset`)
- **Concise descriptions**: Keep to 7-10 words maximum
- **User-friendly output**: Include checkmarks (✓) and formatted messages
- **Idempotency**: Use error suppression for operations that may fail: `2>/dev/null; or true`
- **Environment variables**: Reference variables from `mise.toml` directly without export statements
