[2026-04-03 10:57] - Updated by Junie
{
    "TYPE": "negative",
    "CATEGORY": "configuration missing",
    "EXPECTATION": "They expected the app to run without errors by configuring the HackMD API token, or to have clear steps to set it up.",
    "NEW INSTRUCTION": "WHEN a static app requires a secret THEN implement runtime env.js config and document setup"
}

[2026-04-03 11:04] - Updated by Junie
{
    "TYPE": "negative",
    "CATEGORY": "CORS error",
    "EXPECTATION": "They expected the app to call HackMD from the browser without CORS failures, or to be given clear steps/workarounds.",
    "NEW INSTRUCTION": "WHEN browser CORS blocks third-party API THEN add a proxy endpoint and document setup"
}

[2026-04-03 11:06] - Updated by Junie
{
    "TYPE": "negative",
    "CATEGORY": "authentication failure",
    "EXPECTATION": "They expected authenticated HackMD API calls to succeed or to get clear steps to fix 401 errors.",
    "NEW INSTRUCTION": "WHEN HackMD API response status is 401 THEN show Settings modal and auth checklist with curl test"
}

[2026-04-03 11:20] - Updated by Junie
{
    "TYPE": "preference",
    "CATEGORY": "secrets handling",
    "EXPECTATION": "They want zero sensitive data in the repository or source; all secrets must be user-injected at runtime.",
    "NEW INSTRUCTION": "WHEN handling API tokens or note IDs THEN collect via runtime Settings UI and store locally"
}

[2026-04-03 14:06] - Updated by Junie
{
    "TYPE": "negative",
    "CATEGORY": "CORS on save",
    "EXPECTATION": "They expected the Save to HackMD action to succeed without CORS errors or to get clear steps to fix it.",
    "NEW INSTRUCTION": "WHEN CORS occurs on save requests THEN handle OPTIONS preflight and allow Authorization, Content-Type"
}

