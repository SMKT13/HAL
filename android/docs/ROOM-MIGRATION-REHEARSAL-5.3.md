# HAL Atlas 5.3 — isolated migration rehearsal

From android/ with Python 3:

    python -m unittest discover -s tests -p 'test_*.py' -v
    python tests/rehearse_room_v2.py --db /secure/offline-copy/haldesk_book.db

Provide a consistent PRIVATE copy of the schema-1 SQLite database together with applicable WAL/SHM companions. The rehearsal makes a memory-only clone and projects Library 5.1.24 Room-v2 mirror tables without changing the source. Output is summary counts and states only.

Seven independent synthetic tests exercise successful copying, checksum rejection, version-2 refusal, missing book records, duplicate contract IDs, excluded close records and rounding. They do NOT prove production Room migration, Room identity hashes, Android compatibility, signing or physical-device upgrade.

Do not upload user account data or signing credentials to GitHub. Main stays unchanged until explicitly approved.
