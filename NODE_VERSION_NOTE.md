# Node.js version compatibility

This edition is prepared for the Node.js version reported in the installation log: **v24.18.0**.

- Replaced `better-sqlite3` with Node.js' built-in `node:sqlite` (`DatabaseSync`).
- Removed the native SQLite dependency from `package.json`.
- The project continues to use a real SQLite database with the `api_keys` and `api_usage` tables.
- No separate Python installation or Visual Studio C++ build tools are needed for SQLite.

Run `node -v` (should show v24.x), then `npm install`, then `npm start`.
