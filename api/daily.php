<?php
/*
 * Хранилище текстов Ежедневника АА для обычного PHP-хостинга (Beget).
 *
 * GET    /api/daily.php            — все сохранённые дни { "10-19": {...}, ... }
 * POST   /api/daily.php            — сохранить день   (нужен пароль)
 * DELETE /api/daily.php?key=MM-DD  — удалить день     (нужен пароль)
 *
 * Пароль передаётся в заголовке X-Admin-Password.
 * Хэш пароля лежит в api/config.php — этот файл создаётся при публикации
 * из секрета ADMIN_PASSWORD в GitHub и в репозиторий не попадает.
 * Тексты хранятся в api/storage/daily.json — публикация этот файл не трогает.
 */

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

const KEY_RE = '/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/';
const LIMITS = ['title' => 300, 'quote' => 3000, 'source' => 500, 'text' => 10000];

$storageDir = __DIR__ . '/storage';
$storageFile = $storageDir . '/daily.json';

function reply($data, int $status = 200): void {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function load_all(string $file): array {
    if (!is_file($file)) return [];
    $data = json_decode((string) file_get_contents($file), true);
    return is_array($data) ? $data : [];
}

function authorized(): bool {
    $configFile = __DIR__ . '/config.php';
    if (!is_file($configFile)) return false;
    $config = require $configFile;
    $hash = is_array($config) ? ($config['password_hash'] ?? '') : '';
    $given = $_SERVER['HTTP_X_ADMIN_PASSWORD'] ?? '';
    return $hash !== '' && $given !== '' && password_verify($given, $hash);
}

// Изменение файла под блокировкой, чтобы два сохранения не затёрли друг друга
function update_all(string $dir, string $file, callable $change): array {
    if (!is_dir($dir) && !mkdir($dir, 0755, true)) reply(['error' => 'Не удалось создать папку хранилища'], 500);
    $fp = fopen($file, 'c+');
    if (!$fp || !flock($fp, LOCK_EX)) reply(['error' => 'Хранилище недоступно'], 500);
    $raw = stream_get_contents($fp);
    $all = json_decode($raw ?: '{}', true);
    if (!is_array($all)) $all = [];
    $all = $change($all);
    ksort($all);
    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode($all ?: new stdClass(), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
    return $all;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    header('Cache-Control: public, max-age=60');
    $all = load_all($storageFile);
    reply($all ?: new stdClass());
}

if (!authorized()) {
    usleep(500000); // замедляем подбор пароля
    reply(['error' => 'Неверный пароль'], 401);
}

if ($method === 'POST') {
    $body = json_decode((string) file_get_contents('php://input'), true);
    if (!is_array($body)) reply(['error' => 'Некорректные данные'], 400);
    if (!empty($body['check'])) reply(['ok' => true]); // проверка пароля

    $key = (string) ($body['key'] ?? '');
    if (!preg_match(KEY_RE, $key)) reply(['error' => 'Дата должна быть в формате ММ-ДД'], 400);

    $entry = [];
    foreach (LIMITS as $field => $max) {
        $v = trim((string) ($body[$field] ?? ''));
        if (mb_strlen($v) > $max) reply(['error' => "Поле «{$field}» слишком длинное"], 400);
        if ($v !== '') $entry[$field] = $v;
    }
    if (empty($entry['title']) || empty($entry['text'])) reply(['error' => 'Нужны хотя бы заголовок и текст'], 400);

    $all = update_all($storageDir, $storageFile, function ($all) use ($key, $entry) {
        $all[$key] = $entry;
        return $all;
    });
    reply(['ok' => true, 'count' => count($all)]);
}

if ($method === 'DELETE') {
    $key = (string) ($_GET['key'] ?? '');
    if (!preg_match(KEY_RE, $key)) reply(['error' => 'Неверная дата'], 400);
    $all = update_all($storageDir, $storageFile, function ($all) use ($key) {
        unset($all[$key]);
        return $all;
    });
    reply(['ok' => true, 'count' => count($all)]);
}

reply(['error' => 'Метод не поддерживается'], 405);
