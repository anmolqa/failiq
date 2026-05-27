import re


def clean_logs(log_text: str) -> str:
    """
    Extract high-signal lines from CI/test logs.

    Priority tiers:
    1. Pytest summary section (===...===) — always included
    2. Test failure headers (___...___) — test function names
    3. Assertion errors and failure details
    4. Infrastructure/setup errors (auth, connection, etc.)
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

    # Strip ANSI escape codes
    ansi_escape = re.compile(r"\x1b\[[0-9;]*m")

    cleaned_lines = []
    for line in log_text.splitlines():
        clean = ansi_escape.sub("", line).strip()
        if clean and combined.search(clean):
            cleaned_lines.append(clean)

    return "\n".join(cleaned_lines)
