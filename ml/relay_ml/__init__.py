"""Relay ML: personalized anomaly engine behind a stdin/stdout CLI.

The package never reads private data except through the HEALTH_EXPORT_XML
environment variable or an explicit CLI path, and it never writes
person-level output inside the repository.
"""

MODEL_VERSION = "baseline-iforest-v1"
WINDOW_HOURS = 6
