<?php
/**
 * Export existing MariaDB TOTPVault data into Cloudflare D1 (SQLite) INSERT statements.
 * Usage: php tools/export-mariadb-to-d1.php [output_path]
 */
declare(strict_types=1);

$outFile = $argv[1] ?? __DIR__ . '/../migrations/seed-mariadb.sql';

// Load .env manually if present
$envFile = __DIR__ . '/../.env';
$env = [];
if (file_exists($envFile)) {
    foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) continue;
        [$k, $v] = explode('=', $line, 2);
        $env[trim($k)] = trim($v, " \t\n\r\0\x0B\"'");
    }
}

$host = $env['DB_HOST'] ?? getenv('DB_HOST') ?: '127.0.0.1';
$port = $env['DB_PORT'] ?? getenv('DB_PORT') ?: '3306';
$name = $env['DB_NAME'] ?? getenv('DB_NAME') ?: 'totpvault';
$user = $env['DB_USER'] ?? getenv('DB_USER') ?: 'root';
$pass = $env['DB_PASSWORD'] ?? getenv('DB_PASSWORD') ?: '';

$pdo = new PDO("mysql:host={$host};port={$port};dbname={$name};charset=utf8mb4", $user, $pass, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);

function sqlVal(mixed $v): string {
    if ($v === null) return 'NULL';
    if (is_int($v) || is_float($v)) return (string)$v;
    return "'" . str_replace("'", "''", (string)$v) . "'";
}

$tables = [
    'users' => ['id', 'email', 'name', 'avatar_url', 'google_id', 'microsoft_id', 'github_id', 'created_at', 'updated_at'],
    'oauth_identities' => ['id', 'user_id', 'provider', 'provider_id', 'created_at', 'updated_at'],
    'whitelist_users' => ['id', 'email', 'name', 'role_label', 'is_admin', 'created_by_email', 'created_at'],
    'otp_profiles' => ['id', 'user_id', 'name', 'issuer', 'secret_encrypted', 'algorithm', 'digits', 'period', 'color', 'icon', 'hide_code', 'created_at', 'updated_at'],
    'profile_shares' => ['id', 'profile_id', 'shared_by_user_id', 'shared_with_email', 'shared_with_user_id', 'can_edit', 'created_at'],
];

$sql = "-- Exported from MariaDB on " . date('c') . "\n";
$counts = [];

foreach ($tables as $table => $cols) {
    $rows = $pdo->query("SELECT " . implode(', ', $cols) . " FROM `{$table}` ORDER BY id ASC")->fetchAll();
    $counts[$table] = count($rows);
    if (empty($rows)) continue;

    $sql .= "\n-- Table: {$table} (" . count($rows) . " rows)\n";
    foreach ($rows as $row) {
        $vals = array_map(fn($c) => sqlVal($row[$c] ?? null), $cols);
        $sql .= "INSERT OR IGNORE INTO {$table} (" . implode(', ', $cols) . ") VALUES (" . implode(', ', $vals) . ");\n";
    }
}

file_put_contents($outFile, $sql);
echo "Exported to {$outFile}\n";
foreach ($counts as $t => $c) {
    echo "  - {$t}: {$c} rows\n";
}
