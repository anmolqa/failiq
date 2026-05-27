import re


# ── ANSI escape code stripper ─────────────────────────────────────────────────
_ANSI = re.compile(r"\x1b\[[0-9;]*m")

# ── Secret / PII redaction patterns ──────────────────────────────────────────
# Applied BEFORE sending logs to any external LLM.
_REDACTION_RULES: list[tuple[re.Pattern, str]] = [
    # API keys / tokens (generic long alphanumeric strings after key= or token=)
    (re.compile(r"(?i)(api[_-]?key|token|secret|password|passwd|pwd|auth)[=:\s]+['\"]?[\w\-\.]{8,}['\"]?"), r"\1=<REDACTED>"),
    # AWS keys
    (re.compile(r"AKIA[0-9A-Z]{16}"), "<AWS_KEY_REDACTED>"),
    # Generic bearer tokens
    (re.compile(r"(?i)bearer\s+[\w\-\.]{20,}"), "Bearer <TOKEN_REDACTED>"),
    # Private key blocks
    (re.compile(r"-----BEGIN [A-Z ]+PRIVATE KEY-----.*?-----END [A-Z ]+PRIVATE KEY-----", re.DOTALL), "<PRIVATE_KEY_REDACTED>"),
    # Email addresses
    (re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}"), "<EMAIL_REDACTED>"),
    # IP addresses (IPv4)
    (re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b"), "<IP_REDACTED>"),
    # UUIDs that look like secrets (keep test UUIDs but redact long hex strings in auth contexts)
    (re.compile(r"(?i)(key|secret|token|credential)[=:\s]+[0-9a-f\-]{32,}"), r"\1=<REDACTED>"),
    # GitHub / GitLab tokens
    (re.compile(r"gh[ps]_[A-Za-z0-9]{36}"), "<GH_TOKEN_REDACTED>"),
    (re.compile(r"glpat-[A-Za-z0-9\-_]{20}"), "<GL_TOKEN_REDACTED>"),
]


def redact_secrets(text: str) -> str:
    """Remove secrets and PII from log text before sending to an external LLM."""
    for pattern, replacement in _REDACTION_RULES:
        text = pattern.sub(replacement, text)
    return text


def clean_logs(log_text: str) -> str:
    """
    Extract high-signal lines from CI/test logs, then redact secrets/PII.

    Parser heuristics (priority tiers):
    1. Pytest summary section (=== N failed, N passed ===)
    2. Test failure headers (___ test_function_name ___)
    3. Assertion errors and failure details (E assert, AssertionError)
    4. Python exception tracebacks
    5. Infrastructure/setup errors (auth failures, HTTP 5xx, timeouts)

    After extraction, all secrets and PII are redacted before the text
    is sent to any external LLM.
    """

    # Patterns that indicate a meaningful failure signal
    important_patterns = [
        # Pytest structural markers
        r"={3,}.*={3,}",           # === test session starts ===, === N failed ===
        r"_{5,}\s+\w",             # _____ test_function_name _____
        r"short test summary",

        # Actual test failures
        r"FAILED\s+test_",
        r"AssertionError",
        r"assert\s+.+==",
        r"E\s+assert",
        r"E\s+AssertionError",
        r"\d+ failed,",
        r"\d+ passed",

        # Python exceptions
        r"Traceback \(most recent call last\)",
        r"^\s+File \".*\", line \d+",
        r"raise\s+\w+",

        # Infrastructure errors
        r"\bERROR\b",
        r"\bFAILED\b",
        r"Exception",
        r"Timeout",
        r"Connection refused",
        r"500\s+Internal Server Error",
        r"HTTP.*5\d\d",
    ]

    combined = re.compile(
        "|".join(f"(?:{p})" for p in important_patterns),
        re.IGNORECASE,
    )

    cleaned_lines = []
    for line in log_text.splitlines():
        clean = _ANSI.sub("", line).strip()
        if clean and combined.search(clean):
            cleaned_lines.append(clean)

    extracted = "\n".join(cleaned_lines)

    # Redact secrets and PII before returning
    return redact_secrets(extracted)
