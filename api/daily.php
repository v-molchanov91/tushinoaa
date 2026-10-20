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
 *
 * Код совместим с PHP 5.6 (такая версия стоит на бесплатном тарифе Beget по умолчанию).
 */

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

const KEY_RE = '/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/';
const LIMITS = ['title' => 300, 'quote' => 3000, 'source' => 500, 'text' => 10000];

$storageDir = __DIR__ . '/storage';
$storageFile = $storageDir . '/daily.json';

function reply($data, $status = 200) {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function load_all($file) {
    if (!is_file($file)) return [];
    $data = json_decode((string) file_get_contents($file), true);
    return is_array($data) ? $data : [];
}

// Проверка пароля. Возвращает '' при успехе или код причины отказа
// (сам пароль и хэш в ответ никогда не попадают).
function auth_problem() {
    $configFile = __DIR__ . '/config.php';
    if (!is_file($configFile)) return 'no_config';
    $config = require $configFile;
    $hash = (is_array($config) && isset($config['password_hash'])) ? $config['password_hash'] : '';
    if ($hash === '') return 'no_config';
    // Пароль — из заголовка X-Admin-Password или из поля password в теле запроса
    $given = isset($_SERVER['HTTP_X_ADMIN_PASSWORD']) ? $_SERVER['HTTP_X_ADMIN_PASSWORD'] : '';
    if ($given === '') {
        $body = json_decode((string) file_get_contents('php://input'), true);
        if (is_array($body) && isset($body['password'])) $given = (string) $body['password'];
    }
    $given = trim($given);
    if ($given === '') return 'no_password';
    return password_verify($given, $hash) ? '' : 'mismatch';
}

// Изменение файла под блокировкой, чтобы два сохранения не затёрли друг друга
function update_all($dir, $file, $change) {
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

$method = isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : 'GET';

if ($method === 'GET') {
    header('Cache-Control: public, max-age=60');
    $all = load_all($storageFile);
    reply($all ?: new stdClass());
}

$problem = auth_problem();
if ($problem !== '') {
    usleep(500000); // замедляем подбор пароля
    $messages = [
        'no_config'   => 'На сервере не задан пароль: опубликуйте сайт заново (секрет ADMIN_PASSWORD)',
        'no_password' => 'Пароль не дошёл до сервера',
        'mismatch'    => 'Неверный пароль',
    ];
    reply(['error' => $messages[$problem], 'reason' => $problem], 401);
}

if ($method === 'POST') {
    $body = json_decode((string) file_get_contents('php://input'), true);
    if (!is_array($body)) reply(['error' => 'Некорректные данные'], 400);
    if (!empty($body['check'])) reply(['ok' => true]); // проверка пароля

    $key = isset($body['key']) ? (string) $body['key'] : '';
    if (!preg_match(KEY_RE, $key)) reply(['error' => 'Дата должна быть в формате ММ-ДД'], 400);

    $entry = [];
    foreach (LIMITS as $field => $max) {
        $v = isset($body[$field]) ? trim((string) $body[$field]) : '';
        $len = function_exists('mb_strlen') ? mb_strlen($v, 'UTF-8') : strlen(utf8_decode($v));
        if ($len > $max) reply(['error' => "Поле «{$field}» слишком длинное"], 400);
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
    $key = isset($_GET['key']) ? (string) $_GET['key'] : '';
    if (!preg_match(KEY_RE, $key)) reply(['error' => 'Неверная дата'], 400);
    $all = update_all($storageDir, $storageFile, function ($all) use ($key) {
        unset($all[$key]);
        return $all;
    });
    reply(['ok' => true, 'count' => count($all)]);
}

reply(['error' => 'Метод не поддерживается'], 405);
